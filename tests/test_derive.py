import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import store  # noqa: E402
from test_store import StoreCase, line  # noqa: E402

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

    def test_missing_directory_uses_path(self):
        self.assertEqual(store.resolve_project("/Users/x/Sites/gone-project"), "gone-project")

    def test_claude_worktrees_path(self):
        self.assertEqual(store.resolve_project("/Users/x/Sites/foo/.claude/worktrees/agent-1"), "foo")
        self.assertEqual(store.resolve_project("/Users/x/ws/foo/worktrees/thread-9/sub"), "foo")
        self.assertEqual(store.resolve_project("/Users/x/.t3/worktrees/foo/t3-3fb14cfd"), "foo")

    def test_renamed_repository_alias(self):
        self.assertEqual(store.resolve_project("/Users/x/Sites/projects/claude-errors-dashboard"), "ai-ledger")
        self.assertEqual(store.resolve_project("/Users/x/Sites/projects/claude-errors-dashboard/.claude/worktrees/x"),
                         "ai-ledger")
        self.assertEqual(store.resolve_project("/Users/x/Sites/projects/ai-ledger"), "ai-ledger")

    def test_temp_path(self):
        self.assertEqual(store.resolve_project("/private/var/folders/ab/T/tmp123"), "(temp)")
        self.assertEqual(store.resolve_project("/tmp/scratch"), "(temp)")

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

    def test_compact_boundary_counts(self):
        cb = lambda u: line(type="system", subtype="compact_boundary", uuid=u, timestamp="2026-11-01T11:00:00Z", **S)
        self.write("a.jsonl", cb("c1") + cb("c2"))
        self.ingest()
        self.write("a.jsonl", cb("c3"))
        self.ingest()
        self.assertEqual(self.q("SELECT compactions FROM sessions"), [(3,)])

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

    def test_rebuild_keeps_alias(self):
        self.con.execute("INSERT INTO projects_by_cwd VALUES ('/gone/claude-errors-dashboard', 'claude-errors-dashboard')")
        self.con.close()
        self.con = store.open_store(self.db)
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go").replace("/nowhere/foo", "/gone/claude-errors-dashboard"))
        store.ingest(self.con, self.roots)
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT project FROM sessions"), [("ai-ledger",)])


class RebuildTest(StoreCase):
    def counts(self):
        return {t: self.q(f"SELECT count(*) FROM {t}")[0][0] for t in store.DERIVED} | {
            "errors": self.q("SELECT count(*) FROM tool_calls WHERE is_error")[0][0],
            "followups": self.q("SELECT count(followup) FROM tool_calls")[0][0],
            "tokens": self.q("SELECT sum(input + output) FROM requests")[0][0],
            "compactions": self.q("SELECT sum(compactions) FROM sessions")[0][0]}

    def test_rebuild_matches_incremental(self):
        a = self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go")
                       + assistant("a1", "m1", "2026-11-01T10:00:01Z", [tool_use("t1", "Bash", command="x")]))
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


class OtherDeriver(store.Deriver):
    """A second source's parser: Claude's line shapes under its own session ids."""

    def add(self, d):
        super().add(dict(d, sessionId="other-" + d["sessionId"]))


class TwoSourceRebuildTest(StoreCase):
    def rows(self):
        return {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED} | {
            "files": self.q("SELECT path, seq, source FROM files ORDER BY ALL")}

    def test_rebuild_uses_each_source_deriver(self):
        other = os.path.join(self.tmp, "other")
        os.makedirs(other)
        src = store.Source(lambda root: sorted(glob.glob(os.path.join(root, "*.jsonl"))),
                           lambda d, path, offset: "other:" + store.line_key(d, path, offset), OtherDeriver, lambda path: False)
        with mock.patch.dict(store.SOURCES, other=src):
            body = (prompt("u1", "2026-11-01T10:00:00Z", "p1", "go")
                    + assistant("a1", "m1", "2026-11-01T10:00:01Z", [tool_use("t1", "Bash", command="x")]))
            self.write("a.jsonl", body)
            with open(os.path.join(other, "b.jsonl"), "w") as fh:
                fh.write(body.replace('"m1"', '"m2"').replace('"t1"', '"t2"').replace('"p1"', '"p2"'))
            store.ingest(self.con, self.roots | dict(other=other))
            self.write("a.jsonl", result("r1", "2026-11-01T10:00:02Z", "t1", "Exit code 1", error=True)
                       + assistant("a2", "m3", "2026-11-01T10:00:03Z", [dict(type="text", text="Hm.")]))
            store.ingest(self.con, self.roots | dict(other=other))
            before = self.rows()
            store.rebuild(self.con)
            self.assertEqual(self.rows(), before)
        self.assertEqual(self.q("SELECT session_id, source FROM sessions ORDER BY 1"), [("other-s1", "other"), ("s1", "claude")])
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(3,)])


if __name__ == "__main__":
    unittest.main()
