import json
import os
import shutil
import subprocess
import tempfile
import unittest
from datetime import date, datetime
from unittest import mock

from ai_ledger import metrics, store
from test_store import StoreCase, line

S = dict(sessionId="s1", cwd="/nowhere/foo", gitBranch="main", entrypoint="cli", version="2.1")


def assistant(uuid, mid, ts, content, model="claude-opus-5-5", **usage):
    u = dict(input_tokens=10, output_tokens=20, cache_read_input_tokens=100, cache_creation_input_tokens=50,
             output_tokens_details=dict(thinking_tokens=5),
             cache_creation=dict(ephemeral_5m_input_tokens=20, ephemeral_1h_input_tokens=30))
    u.update(usage)
    return line(type="assistant", uuid=uuid, timestamp=ts, effort="high", thinkingDurationMs=700,
                message=dict(id=mid, model=model, stop_reason="tool_use", usage=u, content=content), **S)


def tool_use(tid, name, **inp):
    return dict(type="tool_use", id=tid, name=name, input=inp)


def result(uuid, ts, tid, text, error=False, prompt="p1"):
    return line(type="user", uuid=uuid, timestamp=ts, promptId=prompt,
                message=dict(role="user", content=[dict(type="tool_result", tool_use_id=tid, content=text, is_error=error)]), **S)


def prompt(uuid, ts, pid, text):
    return line(type="user", uuid=uuid, timestamp=ts, promptId=pid, message=dict(role="user", content=text), **S)


class ProjectTest(unittest.TestCase):
    def setUp(self):
        # A repo outside the system temp dirs, so the git rule is what runs.
        self.tmp = tempfile.mkdtemp(dir=os.path.dirname(os.path.abspath(__file__)))

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def git(self, *args, cwd=None):
        subprocess.run(["git", *args], cwd=cwd or self.tmp, check=True, capture_output=True)

    def test_real_worktree_resolves_to_main_checkout(self):
        repo = os.path.join(self.tmp, "foo")
        os.makedirs(repo)
        self.git("init", "-q", cwd=repo)
        self.git("-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "--allow-empty", "-m", "x", cwd=repo)
        wt = os.path.join(self.tmp, "elsewhere", "wt-1")
        self.git("worktree", "add", "-q", wt, cwd=repo)
        with mock.patch.object(store, "TEMP_PREFIXES", ()):
            self.assertEqual(store.resolve_project(wt), "foo")
            self.assertEqual(store.resolve_project(repo), "foo")

    def test_paths_without_a_git_checkout(self):
        codex = os.path.expanduser("~/Documents/Codex")
        for cwd, want in [
            ("/Users/x/Sites/gone-project", "gone-project"),  # a folder that is gone: its name
            ("/Users/x/Sites/foo/.claude/worktrees/agent-1", "foo"),  # worktree layouts
            ("/Users/x/ws/foo/worktrees/thread-9/sub", "foo"),
            ("/Users/x/.t3/worktrees/foo/t3-3fb14cfd", "foo"),
            (f"{codex}/2026-10-01/new-chat/work/invoice-export", "codex-desktop"),  # one project per app workspace folder
            (f"{codex}/2026-11-02/i", "codex-desktop"),
            (f"{codex}Other/foo", "foo"),
            ("/Users/x/Sites/projects/claude-errors-dashboard", "ai-ledger"),  # a renamed repository
            ("/Users/x/Sites/projects/claude-errors-dashboard/.claude/worktrees/x", "ai-ledger"),
            ("/Users/x/Sites/projects/ai-ledger", "ai-ledger"),
            ("/private/var/folders/ab/T/tmp123", "(temp)"),
            ("/tmp/scratch", "(temp)"),
        ]:
            self.assertEqual(store.resolve_project(cwd), want, cwd)

    def test_cached_per_cwd(self):
        tmp = tempfile.mkdtemp()
        try:
            con = store.open_store(os.path.join(tmp, "d", "x.duckdb"))
            cur = con.cursor()
            p = store.Projects(cur)
            with mock.patch.object(store, "resolve_project", return_value="one") as r:
                p.get(cur, "/a")
                p.get(cur, "/a")
                self.assertEqual(r.call_count, 1)
            with mock.patch.object(store, "resolve_project", return_value="two"):
                self.assertEqual(store.Projects(cur).get(cur, "/a"), "one")
            con.close()
        finally:
            shutil.rmtree(tmp)


class DeriveTest(StoreCase):
    def ingest(self):
        store.ingest(self.con, self.roots)

    def test_speed_is_stored_as_written_and_null_when_absent(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [dict(type="text", text="hi")], speed="fast")
                   + assistant("a2", "m2", "2026-11-01T10:00:01Z", [dict(type="text", text="hi")], speed="standard")
                   + assistant("a3", "m3", "2026-11-01T10:00:02Z", [dict(type="text", text="hi")]))
        self.ingest()
        want = [("m1", "fast"), ("m2", "standard"), ("m3", None)]
        self.assertEqual(self.q("SELECT message_id, speed FROM requests ORDER BY 1"), want)
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT message_id, speed FROM requests ORDER BY 1"), want)

    def test_result_bytes(self):
        text = "é" * 6000 + "x" * 345  # 12,345 bytes: each é is two
        blocks = [dict(type="text", text="abcde"), dict(type="image", source=dict(type="base64", data="A" * 5000))]
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [tool_use("t1", "Read", file_path="/x"),
                                                                              tool_use("t2", "Read", file_path="/y"),
                                                                              tool_use("t3", "Read", file_path="/z")])
                   + result("r1", "2026-11-01T10:00:01Z", "t1", text)
                   + result("r2", "2026-11-01T10:00:02Z", "t2", blocks))
        self.ingest()
        self.assertEqual(self.q("SELECT tool_use_id, result_bytes FROM tool_calls ORDER BY 1"), [("t1", 12345), ("t2", 5), ("t3", None)])
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT tool_use_id, result_bytes FROM tool_calls ORDER BY 1"), [("t1", 12345), ("t2", 5), ("t3", None)])

    def test_split_response_counts_usage_once(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [dict(type="thinking", thinking="")])
                   + assistant("a2", "m1", "2026-11-01T10:00:01Z", [dict(type="text", text="hi")])
                   + assistant("a3", "m1", "2026-11-01T10:00:02Z", [tool_use("t1", "Read", file_path="/x")]))
        self.ingest()
        self.assertEqual(self.q("SELECT count(*), sum(input), sum(output), sum(thinking), sum(cache_read), "
                                "sum(cache_5m), sum(cache_1h), any_value(effort), any_value(thinking_ms) FROM requests"),
                         [(1, 10, 20, 5, 100, 20, 30, "high", 700)])
        self.assertEqual(self.q("SELECT project, peak_context, peak_model FROM sessions"), [("foo", 160, "claude-opus-5-5")])

    def test_tool_call_pair(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [tool_use("t1", "Bash", command="ls nope")])
                   + result("r1", "2026-11-01T10:00:03.5Z", "t1", "Exit code 1\nls: nope: No such file or directory", error=True)
                   + assistant("a2", "m2", "2026-11-01T10:00:05Z", [dict(type="text", text="The path is wrong.")]))
        self.ingest()
        row = self.q("SELECT tool, input_summary, is_error, category, followup, "
                     "date_diff('millisecond', start_ts, end_ts), error FROM tool_calls")
        self.assertEqual(row[0][:6], ("Bash", "ls nope", True, "no_file", "The path is wrong.", 3500))
        self.assertIn("No such file", row[0][6])

    def test_followup_across_ingests(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [tool_use("t1", "Bash", command="x")])
                   + result("r1", "2026-11-01T10:00:01Z", "t1", "Exit code 2", error=True))
        self.ingest()
        self.write("a.jsonl", assistant("a2", "m2", "2026-11-01T10:00:05Z", [dict(type="text", text="Retrying.")]))
        self.ingest()
        self.assertEqual(self.q("SELECT followup FROM tool_calls"), [("Retrying.",)])

    def test_result_in_later_ingest(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [tool_use("t1", "Edit", file_path="/x")]))
        self.ingest()
        self.write("a.jsonl", result("r1", "2026-11-01T10:00:02Z", "t1", "String to replace not found in file.", error=True))
        self.ingest()
        self.assertEqual(self.q("SELECT tool, is_error, category, end_ts IS NOT NULL FROM tool_calls"),
                         [("Edit", True, "edit_nomatch", True)])
        self.assertEqual(self.q("SELECT result_bytes FROM tool_calls"), [(len("String to replace not found in file."),)])

    def test_commit_and_test_runs_flagged(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [
            tool_use("t1", "Bash", command="git add . && git commit -m 'x'"),
            tool_use("t2", "Bash", command="uv run pytest -q"),
            tool_use("t3", "Bash", command="npm test")])
            + result("r1", "2026-11-01T10:00:01Z", "t1", "[main 1a2b] x")
            + result("r2", "2026-11-01T10:00:02Z", "t2", "3 passed")
            + result("r3", "2026-11-01T10:00:03Z", "t3", "Exit code 1\n1 failed", error=True))
        self.ingest()
        self.assertEqual(self.q("SELECT tool_use_id, is_commit, is_test, test_passed FROM tool_calls ORDER BY 1"),
                         [("t1", True, False, True), ("t2", False, True, True), ("t3", False, True, False)])

    def test_mcp_and_skill(self):
        self.write("a.jsonl", assistant("a1", "m1", "2026-11-01T10:00:00Z", [
            tool_use("t1", "mcp__plugin_x_search__find", query="q"), tool_use("t2", "Skill", skill="review")]))
        self.ingest()
        self.assertEqual(self.q("SELECT mcp_server, skill FROM tool_calls ORDER BY 1"),
                         [("plugin_x_search", None), (None, "review")])

    def test_first_compaction_is_the_earliest_and_a_claude_session_has_no_window(self):
        cb = lambda u, ts: line(type="system", subtype="compact_boundary", uuid=u, timestamp=ts, **S)
        self.write("a.jsonl", cb("c2", "2026-11-01T11:30:00Z") + cb("c1", "2026-11-01T10:42:00Z"))
        self.ingest()
        self.assertEqual(self.q("SELECT compactions, first_compaction_ts, context_window FROM sessions"),
                         [(2, datetime(2026, 11, 1, 10, 42), None)])
        self.write("a.jsonl", cb("c3", "2026-11-01T12:00:00Z"))  # a later ingest keeps the earliest
        self.ingest()
        self.assertEqual(self.q("SELECT compactions, first_compaction_ts FROM sessions"), [(3, datetime(2026, 11, 1, 10, 42))])

    def test_first_compaction_in_a_later_ingest_fills_the_session(self):
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go"))
        self.ingest()
        self.assertEqual(self.q("SELECT first_compaction_ts FROM sessions"), [(None,)])
        self.write("a.jsonl", line(type="system", subtype="compact_boundary", uuid="c1", timestamp="2026-11-01T11:00:00Z", **S))
        self.ingest()
        self.assertEqual(self.q("SELECT first_compaction_ts FROM sessions"), [(datetime(2026, 11, 1, 11, 0),)])

    def test_store_from_before_the_column_keeps_the_first_compaction_unknown(self):
        cb = lambda u, ts: line(type="system", subtype="compact_boundary", uuid=u, timestamp=ts, **S)
        self.write("a.jsonl", cb("c1", "2026-11-01T10:42:00Z"))
        self.ingest()
        self.con.execute("UPDATE sessions SET first_compaction_ts = NULL")  # as an upgraded store holds it before rebuild
        self.write("a.jsonl", cb("c2", "2026-11-01T12:00:00Z"))
        self.ingest()
        self.assertEqual(self.q("SELECT compactions, first_compaction_ts FROM sessions"), [(2, None)])

    def test_prompts_and_interruptions(self):
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "fix the bug")
                   + prompt("u2", "2026-11-01T10:01:00Z", "p1", [dict(type="text", text="[Request interrupted by user]")])
                   + prompt("u3", "2026-11-01T10:02:00Z", "p2", "now tests")
                   + line(type="user", uuid="u4", timestamp="2026-11-01T10:03:00Z", promptId="p3", isMeta=True,
                          message=dict(role="user", content="<meta>"), **S))
        self.ingest()
        self.assertEqual(self.q("SELECT prompt_id, interrupted FROM prompts ORDER BY 1"), [("p1", True), ("p2", False)])

    def test_hooks(self):
        self.write("a.jsonl", line(type="system", subtype="stop_hook_summary", uuid="h1", timestamp="2026-11-01T10:00:00Z",
                                   hookInfos=[dict(command="a", durationMs=10), dict(command="b")], hookErrors=["boom"], **S)
                   + line(type="attachment", uuid="h2", timestamp="2026-11-01T10:00:00Z",
                          attachment=dict(type="hook_non_blocking_error", hookName="SessionStart:startup"), **S))
        self.ingest()
        self.assertEqual(self.q("SELECT hook, command, duration_ms, is_error FROM hooks ORDER BY source, command"),
                         [("SessionStart:startup", None, None, True), ("Stop", "a", 10, False), ("Stop", "b", None, True)])


class AliasTest(StoreCase):
    def test_open_renames_stored_projects(self):
        self.con.execute("INSERT INTO projects_by_cwd VALUES ('/gone/claude-errors-dashboard', 'claude-errors-dashboard')")
        self.con.execute("INSERT INTO sessions (session_id, project) VALUES ('s1', 'claude-errors-dashboard')")
        self.con.close()
        for _ in range(2):  # idempotent
            self.con = store.open_store(self.db)
            self.assertEqual(self.q("SELECT project FROM projects_by_cwd UNION ALL SELECT project FROM sessions"),
                             [("ai-ledger",), ("ai-ledger",)])
            self.con.close()
        self.con = store.open_store(self.db)


class RebuildTest(StoreCase):
    def counts(self):
        return {t: self.q(f"SELECT count(*) FROM {t}")[0][0] for t in store.DERIVED} | {
            "errors": self.q("SELECT count(*) FROM tool_calls WHERE is_error")[0][0],
            "followups": self.q("SELECT count(followup) FROM tool_calls")[0][0],
            "tokens": self.q("SELECT sum(input + output) FROM requests")[0][0],
            "compactions": self.q("SELECT sum(compactions) FROM sessions")[0][0],
            "context": self.q("SELECT session_id, context_window, first_compaction_ts FROM sessions ORDER BY ALL"),
            "result_bytes": self.q("SELECT tool_use_id, result_bytes FROM tool_calls ORDER BY ALL"),
            "titles": self.q("SELECT * FROM session_titles ORDER BY ALL")}

    def test_rebuild_matches_incremental(self):
        a = self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go")
                       + assistant("a1", "m1", "2026-11-01T10:00:01Z", [tool_use("t1", "Bash", command="x")])
                       + line(type="ai-title", aiTitle="Fix login redirect", sessionId="s1")
                       + line(type="custom-title", customTitle="auth bug", sessionId="s1")
                       + line(type="ai-title", aiTitle="x", sessionId="s2"))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", result("r1", "2026-11-01T10:00:02Z", "t1", "Exit code 1", error=True)
                   + assistant("a2", "m2", "2026-11-01T10:00:03Z", [dict(type="text", text="Hm.")])
                   + line(type="system", subtype="compact_boundary", uuid="c1", timestamp="2026-11-01T10:05:00Z", **S))
        self.write("s1/subagents/agent-1.jsonl", assistant("b1", "m3", "2026-11-01T10:00:04Z",
                                                          [tool_use("t2", "Read", file_path="/y")]))
        store.ingest(self.con, self.roots)
        os.remove(a)
        store.ingest(self.con, self.roots)
        before = self.counts()
        store.rebuild(self.con)
        self.assertEqual(self.counts(), before)
        self.assertEqual(before["requests"], 3)
        self.assertEqual(before["followups"], 1)
        self.assertEqual(before["result_bytes"], [("t1", len("Exit code 1")), ("t2", None)])
        self.assertEqual(before["context"], [("s1", None, datetime(2026, 11, 1, 10, 5))])
        self.assertEqual(before["titles"], [("s1", "auth bug", "Fix login redirect"), ("s2", None, "x")])


def cost_state(start, api, tool, added, removed, sid="s1", **kw):
    """A trimmed Claude Code cost-state line: running totals of one run (startTime), no uuid and no timestamp."""
    return line(type="cost-state", sessionId=sid, startTime=start, totalCostUSD=0.42, totalAPIDuration=api,
                totalAPIDurationWithoutRetries=api - 5 if isinstance(api, int) else api, totalToolDuration=tool,
                totalDuration=api + tool + 1000 if isinstance(api, int) and isinstance(tool, int) else None,
                totalLinesAdded=added, totalLinesRemoved=removed,
                modelUsage={"claude-opus-5-5": dict(inputTokens=10, outputTokens=20, costUSD=0.42)}, **kw)


class CostStateTest(StoreCase):
    """session_runs: one row per run (startTime) of a session, each figure the largest any of its cost-state lines stated."""
    START, LATER = 1_793_000_000_000, 1_793_090_000_000

    def runs(self):
        return self.q("SELECT session_id, start_ms, api_ms, tool_ms, lines_added, lines_removed FROM session_runs ORDER BY ALL")

    def session_sums(self):
        return self.q("SELECT session_id, sum(api_ms), sum(tool_ms), sum(lines_added), sum(lines_removed) FROM session_runs GROUP BY 1")

    def test_snapshots_of_one_run_keep_the_largest(self):
        self.write("a.jsonl", cost_state(self.START, 60_000, 50_000, 10, 3) + cost_state(self.START, 90_000, 40_000, 120, 30))
        store.ingest(self.con, self.roots)
        self.write("a.jsonl", cost_state(self.START, 70_000, 45_000, 100, 40))  # a later ingest: each figure grows only
        store.ingest(self.con, self.roots)
        self.assertEqual(self.runs(), [("s1", self.START, 90_000, 50_000, 120, 40)])

    def test_two_runs_sum(self):
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go") + cost_state(self.START, 60_000, 10_000, 5, 1))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.runs(), [("s1", self.START, 60_000, 10_000, 5, 1)])
        self.write("a.jsonl", cost_state(self.LATER, 20_000, 2_000, 7, 2))
        store.ingest(self.con, self.roots)
        self.assertEqual(len(self.runs()), 2)
        self.assertEqual(self.session_sums(), [("s1", 80_000, 12_000, 12, 3)])

    def test_line_read_twice_or_copied_changes_nothing(self):
        self.write("a.jsonl", cost_state(self.START, 90_000, 40_000, 120, 30))
        store.ingest(self.con, self.roots)
        before = self.runs()
        os.utime(os.path.join(self.root, "proj", "a.jsonl"), (0, 0))
        self.con.execute("UPDATE files SET read_offset = 0, lines = 0")  # read again from the start
        store.ingest(self.con, self.roots)
        self.assertEqual(self.runs(), before)
        self.write("b.jsonl", cost_state(self.START, 90_000, 40_000, 120, 30))  # a copy in another file: its own raw line
        store.ingest(self.con, self.roots)
        self.assertEqual(self.count("type = 'cost-state'"), 2)
        self.assertEqual(self.runs(), before)

    def test_malformed_lines_are_skipped(self):
        self.write("a.jsonl", line(type="cost-state", startTime=self.START, totalAPIDuration=1, totalToolDuration=1,
                                   totalLinesAdded=1, totalLinesRemoved=1)  # no session
                   + line(type="cost-state", sessionId="s1", totalAPIDuration=1, totalToolDuration=1, totalLinesAdded=1,
                          totalLinesRemoved=1)  # no run
                   + cost_state(self.START, "90000", 1, 1, 1)  # a figure as text
                   + cost_state(self.START, 1.5, 1, 1, 1)
                   + cost_state(self.START, 1, True, 1, 1)  # a bool is no figure
                   + cost_state(self.START, 1, 1, None, 1)
                   + cost_state(str(self.START), 1, 1, 1, 1)
                   + cost_state(self.LATER, 5, 6, 7, 8, sid="s2"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.runs(), [("s2", self.LATER, 5, 6, 7, 8)])

    def test_cost_state_makes_no_session_and_changes_none(self):
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go"))
        store.ingest(self.con, self.roots)
        before = self.q("SELECT * FROM sessions")
        self.write("a.jsonl", cost_state(self.START, 1, 1, 1, 1) + cost_state(self.START, 1, 1, 1, 1, sid="s9"))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.q("SELECT * FROM sessions"), before)
        self.assertEqual(len(self.runs()), 2)

    def test_subagent_file_records_nothing(self):
        self.write("s1/subagents/agent-1.jsonl", cost_state(self.START, 1, 1, 1, 1))
        store.ingest(self.con, self.roots)
        self.assertEqual(self.runs(), [])


class LiveItemsTest(unittest.TestCase):
    """store.live_items: what the Live page shows of one Claude Code line."""

    def items(self, text):
        return store.live_items(json.loads(text))

    def test_tool_use_and_failing_result(self):
        use, = self.items(assistant("a1", "m1", "2026-11-10T10:00:00Z", [tool_use("t1", "Bash", command="make test")]))[1:]
        self.assertEqual(use, dict(k="tool_use", id="t1", tool="Bash", summary="make test", description=None, timeout=None))
        res, = self.items(result("u1", "2026-11-10T10:00:01Z", "t1", "<tool_use_error>Exit code 2</tool_use_error>", error=True))
        self.assertEqual((res["k"], res["id"], res["error"]), ("tool_result", "t1", "Exit code 2"))

    def test_request_and_reply_without_thinking(self):
        req, reply = self.items(assistant("a1", "m1", "2026-11-10T10:00:00Z",
                                          [dict(type="thinking", thinking="secret plan"), dict(type="text", text="Done.")]))
        self.assertEqual(req, dict(k="request", id="m1", model="claude-opus-5-5", output=20, context=160))
        self.assertEqual(reply, dict(k="reply", text="Done."))

    def test_prompt_and_interrupt(self):
        self.assertEqual(self.items(prompt("u1", "2026-11-10T10:00:00Z", "p1", "Fix the build")), [dict(k="prompt", text="Fix the build")])
        self.assertEqual(self.items(prompt("u2", "2026-11-10T10:00:01Z", "p1", "[Request interrupted by user]")), [dict(k="interrupt")])


CONTEXT_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "claude", "context-command.jsonl")
CONTEXT_SID = "ad33f29e-a6c5-4a98-b97b-80ece1213936"


class ContextSnapshotTest(StoreCase):
    """A trimmed `claude -p "/context"` transcript (Claude Code 2.1.325): one user line and one system/local_command line."""

    def ingest_fixture(self):
        with open(CONTEXT_FIXTURE) as fh:
            self.write("measure.jsonl", fh.read())
        store.ingest(self.con, self.roots)

    def snapshots(self):
        return self.q("SELECT uuid, session_id, ts, project, cwd, version, model, context_window, total FROM context_snapshots ORDER BY uuid")

    def parts(self, kind=None):
        where = "WHERE kind = ?" if kind else ""
        return self.q(f"SELECT uuid, seq, kind, name, detail, state, tokens FROM context_parts {where} ORDER BY uuid, seq",
                      *([kind] if kind else []))

    def test_snapshot_of_a_print_mode_run(self):
        self.ingest_fixture()
        (uuid, sid, ts, project, cwd, version, model, window, total), = self.snapshots()
        self.assertEqual((uuid, sid, project, cwd, version, model, window, total),
                         ("cdf501fe-1ec1-4d8b-bfa4-75bc06e0ee46", CONTEXT_SID, "demo", "/home/dev/demo", "2.1.325", "claude-fable-5-2",
                          1_000_000, 30912))
        self.assertEqual(ts, datetime(2026, 11, 15, 10, 42, 41, 622000))
        cats = [(name, state, tokens) for _, _, _, name, _, state, tokens in self.parts("category")]
        self.assertEqual(len(cats), 12)
        self.assertEqual(cats[0], ("System prompt", "used", 4107))
        self.assertIn(("MCP tools (deferred)", "deferred", 81826), cats)
        self.assertIn(("Autocompact buffer", "buffer", 33000), cats)
        self.assertEqual(cats[-1], ("Free space", "free", 936088))
        self.assertTrue(all(detail is None for *_, detail, _, _ in self.parts("category")))
        rows = lambda kind: [(name, detail, state, tokens) for _, _, _, name, detail, state, tokens in self.parts(kind)]
        mcp = rows("mcp_tool")
        self.assertIn(("mcp__caveman__caveman_compress", "caveman", None, 254), mcp)
        self.assertEqual(rows("memory_file"), [("/home/dev/.claude/CLAUDE.md", "User", None, 81)])
        self.assertIn(("caveman:cavecrew-builder", "plugin", None, 136), rows("agent"))
        self.assertIn(("answer-review-feedback", "userSettings", None, 43), rows("skill"))
        seqs = [seq for _, seq, *_ in self.parts()]
        self.assertEqual(seqs, list(range(len(seqs))))  # one ordinal per part, in the order /context lists them

    def test_measuring_session_counts_nowhere(self):
        self.ingest_fixture()
        self.assertEqual(self.q("SELECT count(*) FROM requests")[0][0], 0)
        self.assertEqual(self.q("SELECT count(*) FROM prompts")[0][0], 0)  # /context calls no model: its command line is no prompt
        u = metrics.usage(self.con.cursor(), today=date(2026, 11, 15))
        self.assertEqual((u["totals"]["sessions"], u["totals"]["prompts"], u["totals"]["active_days"]), (0, 0, 0))
        self.assertEqual(u["sessions"], [])
        self.assertEqual(metrics.session_list(self.con.cursor(), today=date(2026, 11, 15))["total"], 0)

    def test_rebuild_and_reingest_give_the_same_rows(self):
        self.ingest_fixture()
        snaps, parts = self.snapshots(), self.parts()
        self.assertEqual(len(snaps), 1)
        store.ingest(self.con, self.roots)  # nothing new
        os.utime(os.path.join(self.root, "proj", "measure.jsonl"), (0, 0))
        self.con.execute("UPDATE files SET read_offset = 0, lines = 0")  # read again from the start: dedup drops the lines
        store.ingest(self.con, self.roots)
        self.assertEqual((self.snapshots(), self.parts()), (snaps, parts))
        store.rebuild(self.con)
        self.assertEqual((self.snapshots(), self.parts()), (snaps, parts))

    def test_lines_without_context_usage_give_none(self):
        cmd = dict(type="system", subtype="local_command", timestamp="2026-11-10T10:00:00Z", **S)
        self.write("a.jsonl", line(uuid="c1", content="<local-command-stdout>Context Usage</local-command-stdout>", **cmd)
                   + line(uuid="c2", contextUsage=dict(model="m", total_tokens=1), **cmd)
                   + line(uuid="c3", contextUsage=dict(categories="x"), **cmd)
                   + line(uuid="c4", contextUsage=[1], **cmd))
        store.ingest(self.con, self.roots)
        self.assertEqual((self.snapshots(), self.parts()), ([], []))

    def test_odd_values_are_kept_as_nulls(self):
        cu = dict(categories=[dict(name="System prompt", tokens="9", kind="used"), "x", dict(name=3, tokens=True)],
                  mcp_tools={"name": "not a list"}, raw_max_tokens=None)
        self.write("a.jsonl", line(type="system", subtype="local_command", uuid="c1", timestamp="2026-11-10T10:00:00Z",
                                   contextUsage=cu, **S))
        store.ingest(self.con, self.roots)
        (_, _, _, project, _, _, model, window, total), = self.snapshots()
        self.assertEqual((project, model, window, total), ("foo", None, None, None))
        self.assertEqual([(kind, name, state, tokens) for _, _, kind, name, _, state, tokens in self.parts()],
                         [("category", "System prompt", "used", None), ("category", None, None, None)])


if __name__ == "__main__":
    unittest.main()
