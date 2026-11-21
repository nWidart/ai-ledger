import json
import os
import shutil
from datetime import datetime

from ai_ledger import store  # first: store imports the source modules
from ai_ledger import grok, metrics, titles
from test_store import StoreCase, line

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "grok")
LABELS = ("probe", "long-turn", "compaction", "cancelled", "tools")
SESSION = {"probe": "0a1f0001-0000-7000-8000-000000000001", "long-turn": "0a1f0002-0000-7000-8000-000000000001",
           "compaction": "0a1f0003-0000-7000-8000-000000000001", "cancelled": "0a1f0004-0000-7000-8000-000000000001",
           "tools": "0a1f0005-0000-7000-8000-000000000001"}
CHILD = "0a1f0001-0000-7000-8000-000000000002"


class GrokCase(StoreCase):
    def setUp(self):
        super().setUp()
        self.home = os.path.join(self.tmp, "grok")
        self.roots = dict(grok=self.home)  # never the real homes

    def put(self, label):
        """Copies the fixture label's sessions into the test Grok home; returns the paths of its logs."""
        shutil.copytree(os.path.join(FIXTURES, label), self.home, dirs_exist_ok=True)
        return grok.files(self.home)

    def ingest(self):
        return store.ingest(self.con, self.roots)

    def lines_of(self, *labels):
        n = 0
        for label in labels:
            for p in grok.files(os.path.join(FIXTURES, label)):
                with open(p) as fh:
                    n += sum(1 for _ in fh)
        return n


class IngestTest(GrokCase):
    def test_missing_home_is_skipped(self):
        stats = self.ingest()
        self.assertEqual((stats["files"], self.count()), (0, 0))

    def test_each_line_is_stored_once(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        n = self.lines_of(*LABELS)
        self.assertEqual(self.count(), n)
        self.assertEqual(self.ingest()["files"], 0)
        self.assertEqual(self.count(), n)

    def test_truncated_file_read_again(self):
        path, = self.put("long-turn")
        with open(path, "rb") as fh:
            data = fh.read()
        self.ingest()
        n = self.count()
        with open(path, "wb") as fh:
            fh.write(data[:len(data) // 2])
        self.ingest()
        with open(path, "wb") as fh:
            fh.write(data)
        self.ingest()
        self.assertEqual(self.count(), n)
        self.assertEqual(self.count("starts_with(key, 'grok:')"), n)

    def test_repeated_event_ids_are_both_stored(self):
        self.put("probe")
        self.ingest()
        for n in (3, 5):
            eid = f"{SESSION['probe']}-{n}"
            self.assertEqual(self.count(f"uuid = '{eid}'"), 2, eid)

    def test_files_sort_child_after_parent(self):
        paths = self.put("probe")
        self.assertEqual([os.path.basename(os.path.dirname(p)) for p in paths], [SESSION["probe"], CHILD])


class FieldsTest(GrokCase):
    def test_types_and_times(self):
        self.put("probe")
        self.ingest()
        types = {r[0] for r in self.q("SELECT DISTINCT type FROM raw_lines")}
        self.assertTrue({"turn_completed", "tool_call", "tool_call_update", "user_message_chunk", "session_end",
                         "user_prompt_submit", "subagent_spawned"} <= types, types)
        self.assertNotIn("hook_execution", types)
        for (ts,) in self.q("SELECT ts FROM raw_lines"):
            self.assertRegex(ts, r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")
            datetime.fromisoformat(store.ts_of(ts))
        self.assertEqual(grok.iso(1795261348503), "2026-11-21T11:42:28.503Z")

    def test_session_rows(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        rows = dict((r[0], r[1:]) for r in self.q("SELECT session_id, cwd, source, first_ts, last_ts, project FROM sessions"))
        for label, sid in SESSION.items():
            with self.subTest(label=label):
                cwd, source, first, last, project = rows[sid]
                self.assertEqual((cwd, source, project), ("/work/app", "grok", "app"))
                # A subagent's lines are its parent's, and do not move the session's times.
                times = sorted(store.ts_of(r[0]) for r in self.q("SELECT ts FROM raw_lines WHERE session_id = ? AND NOT subagent", sid))
                self.assertEqual((first, last), (datetime.fromisoformat(times[0]), datetime.fromisoformat(times[-1])))

    def test_rebuild_keeps_sessions(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        before = self.q("SELECT * FROM sessions ORDER BY session_id")
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT * FROM sessions ORDER BY session_id"), before)

    def test_rebuild_keeps_sessions_and_requests(self):
        for label in LABELS:
            self.put(label)
        self.ingest()
        before = [self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")]
        store.rebuild(self.con)
        self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")], before)

    def test_key_without_meta_falls_back_to_offset(self):
        self.assertEqual(grok.key({"params": {}}, "/x/updates.jsonl", 7), "/x/updates.jsonl:7")
        self.assertEqual(grok.key({"params": {"_meta": {"eventId": "s-1", "agentTimestampMs": 5}}}, "/x", 0), "grok:s-1:5")


SUMS = "sum(input), sum(cache_read), sum(cache_5m), sum(output), sum(thinking), sum(reported_cost)"


def turns(path):
    """The turn_completed updates of a fixture log."""
    with open(path) as fh:
        lines = [json.loads(x) for x in fh]
    return [grok.update(d) for d in lines if grok.update(d).get("sessionUpdate") == "turn_completed"]


def reported(turns):
    """What the turns report, in SUMS order."""
    us = [t["usage"] for t in turns]
    n = lambda k: sum(u[k] for u in us)
    return (n("inputTokens") - n("cachedReadTokens") - n("cacheCreationTokens"), n("cachedReadTokens"), n("cacheCreationTokens"),
            n("outputTokens"), n("reasoningTokens"), n("costUsdTicks") / 1e10)


class UsageTest(GrokCase):
    def sums(self, sid):
        return self.q(f"SELECT {SUMS} FROM requests WHERE session_id = ?", sid)[0]

    def assertSums(self, sid, want):
        got = self.sums(sid)
        self.assertEqual(got[:5], want[:5])
        self.assertAlmostEqual(got[5], want[5], places=9)

    def test_split_adds_up_and_follows_the_weights(self):
        self.assertEqual(grok.split(80000, [20000, 60000]), [20000, 60000])
        self.assertEqual(grok.split(10, [1, 1, 1]), [4, 3, 3])
        self.assertEqual(grok.split(7, [0, 0]), [4, 3])
        self.assertEqual(grok.split(5, []), [])
        for total, weights in ((97245, [24840, 25046, 25095]), (1, [5, 3, 9]), (0, [4, 4])):
            self.assertEqual(sum(grok.split(total, weights)), total)

    def test_turn_becomes_one_request_per_model_call(self):
        path, = self.put("long-turn")
        self.ingest()
        sid = SESSION["long-turn"]
        rows = self.q("SELECT message_id, ts, model, effort, subagent, input + cache_read + cache_5m, stop_reason "
                      "FROM requests WHERE session_id = ? ORDER BY ts", sid)
        self.assertEqual(len(rows), 5)  # modelCalls 5
        self.assertEqual({r[2:5] for r in rows}, {("grok-4.7-build", None, False)})
        self.assertEqual([r[6] for r in rows], [None] * 4 + ["end_turn"])
        self.assertEqual(len({r[1] for r in rows}), 5)  # each at its own call's start
        streams = [int(r[0].rsplit(":", 1)[1]) for r in rows]
        self.assertEqual([r[1] for r in rows], [datetime.fromisoformat(store.ts_of(grok.iso(s))) for s in streams])
        prompts = [r[5] for r in rows]
        self.assertEqual(prompts, sorted(prompts))  # the context grows over the turn, and so do the shares
        self.assertSums(sid, (16218, 203717, 0, 7705, 6652, 0.1805245))
        self.assertSums(sid, reported(turns(path)))

    def test_cancelled_turn_is_counted(self):
        path, = self.put("cancelled")
        self.ingest()
        self.assertEqual(turns(path)[0]["stop_reason"], "cancelled")
        self.assertSums(SESSION["cancelled"], reported(turns(path)))
        self.assertEqual(self.q("SELECT count(*) FROM requests")[0][0], 3)  # the calls its lines state, not modelCalls

    def test_every_fixture_adds_up_to_what_its_turns_report(self):
        # The first two turns of `tools` share a prompt id: a call counts in the turn whose lines it is among.
        for label in LABELS:
            self.put(label)
        self.ingest()
        for label, sid in SESSION.items():
            with self.subTest(label=label):
                path = next(p for p in grok.files(self.home) if sid in p)
                self.assertSums(sid, reported(turns(path)))

    def test_turn_without_its_end_makes_no_request(self):
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = fh.readlines()
        end = next(i for i, x in enumerate(lines) if '"turn_completed"' in x)
        with open(path, "w") as fh:
            fh.writelines(lines[:end])
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(0,)])
        with open(path, "a") as fh:
            fh.writelines(lines[end:])
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(5,)])

    def test_turn_whose_calls_cannot_be_told_is_one_request(self):
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = fh.readlines()
        with open(path, "w") as fh:  # no line of a model call
            fh.writelines(x for x in lines if not any(f'"{t}"' in x for t in grok.CALL_TYPES))
        self.ingest()
        turn, = turns(path)
        rows = self.q("SELECT message_id, model, stop_reason FROM requests")
        (key,), = self.q("SELECT key FROM raw_lines WHERE type = 'turn_completed'")
        self.assertEqual(rows, [(f"{key}:grok-4.7-build", "grok-4.7-build", "end_turn")])  # the turn_completed line's key
        self.assertSums(SESSION["long-turn"], reported([turn]))
        end, = self.q("SELECT ts FROM raw_lines WHERE type = 'turn_completed'")
        self.assertEqual(self.q("SELECT ts FROM requests"), [(datetime.fromisoformat(store.ts_of(end[0])),)])

    def test_turns_whose_calls_cannot_be_told_and_share_a_prompt_id(self):
        # Prompt ids repeat: two such turns of one file, with the same prompt id (or none), are two requests each.
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = [json.loads(x) for x in fh if not any(f'"{t}"' in x for t in grok.CALL_TYPES)]
        end = next(d for d in lines if grok.update(d).get("sessionUpdate") == "turn_completed")
        again, bare, bare2 = (json.loads(json.dumps(end)) for _ in range(3))
        for i, d in enumerate((again, bare, bare2), 1):
            grok.meta(d)["eventId"] += f"{i}0"
            grok.meta(d)["agentTimestampMs"] += 1000 * i
        for d in (bare, bare2):
            del grok.update(d)["prompt_id"]
        with open(path, "w") as fh:
            fh.writelines(json.dumps(d) + "\n" for d in lines + [again, bare, bare2])
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(4,)])
        self.assertSums(SESSION["long-turn"], reported(turns(path)))
        before = self.q("SELECT * FROM requests ORDER BY 1")
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT * FROM requests ORDER BY 1"), before)

    def test_same_rows_however_the_file_is_cut(self):
        for label in ("long-turn", "compaction", "probe"):
            with self.subTest(label=label):
                paths = self.put(label)
                self.ingest()
                whole = [self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")]
                for t in ("raw_lines", "files", "sessions", "requests"):
                    self.con.execute(f"DELETE FROM {t}")
                texts = {}
                for p in paths:
                    with open(p) as fh:
                        texts[p] = fh.readlines()
                    open(p, "w").close()
                for p in paths:  # the parent whole before its child, one more line at each ingest
                    for line in texts[p]:
                        with open(p, "a") as fh:
                            fh.write(line)
                        self.ingest()
                self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")], whole)
                shutil.rmtree(self.home)
                for t in ("raw_lines", "files", "sessions", "requests"):
                    self.con.execute(f"DELETE FROM {t}")

    def test_context_of_a_compacted_session(self):
        self.put("compaction")
        self.ingest()
        (compactions, window, peak, model, first), = self.q(
            "SELECT compactions, context_window, peak_context, peak_model, first_compaction_ts FROM sessions")
        self.assertEqual((compactions, window, model), (1, 256000, "grok-4.7-build"))
        self.assertEqual(peak, 204851)  # the largest context a model call states
        self.assertIsNotNone(first)


class SubagentTest(GrokCase):
    def test_child_belongs_to_its_parent(self):
        parent, child = self.put("probe")
        self.ingest()
        sid = SESSION["probe"]
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(sid,)])
        self.assertEqual(self.q("SELECT DISTINCT session_id, subagent FROM raw_lines WHERE file = ?", child), [(sid, True)])
        self.assertEqual(self.q("SELECT DISTINCT session_id, subagent FROM raw_lines WHERE file = ?", parent), [(sid, False)])
        # The parent's turn reports its own three calls and the child's two; the child's own turn makes no request.
        self.assertEqual(turns(parent)[0]["usage"]["modelCalls"], 5)
        self.assertEqual(self.q("SELECT count(*), bool_or(subagent) FROM requests"), [(3, False)])
        got = self.q(f"SELECT {SUMS} FROM requests")[0]
        want = reported(turns(parent))
        self.assertEqual(got[:5], want[:5])
        self.assertAlmostEqual(got[5], want[5], places=9)

    def test_rebuild_needs_no_file(self):
        self.put("probe")
        self.ingest()
        before = [self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")]
        placed = self.q("SELECT key, session_id, subagent FROM raw_lines ORDER BY key")
        shutil.rmtree(self.home)
        store.rebuild(self.con)
        self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in ("sessions", "requests")], before)
        self.assertEqual(self.q("SELECT key, session_id, subagent FROM raw_lines ORDER BY key"), placed)

    def test_child_tool_calls_belong_to_the_parent(self):
        self.put("probe")
        self.ingest()
        sid = SESSION["probe"]
        self.assertEqual(self.q("SELECT session_id, tool, input_summary FROM tool_calls WHERE subagent"),
                         [(sid, "read_file", "/work/app/file-4.py")])
        self.assertEqual(self.q("SELECT DISTINCT session_id FROM tool_calls"), [(sid,)])
        # The task the parent gave its child is no prompt of the person's; the child's hooks ran, on the parent's session.
        self.assertEqual(self.q("SELECT count(*) FROM prompts"), [(2,)])
        self.assertEqual(self.q("SELECT count(*) FROM hooks WHERE hook = 'subagent_stop'"), [(2,)])
        self.assertEqual(self.q("SELECT DISTINCT session_id FROM hooks"), [(sid,)])
        self.assertEqual(self.q("SELECT count(*) FROM session_runs"), [(1,)])  # the parent's one finished turn

    def test_session_spawned_by_none_is_its_own(self):
        self.put("long-turn")
        self.ingest()
        self.assertIsNone(grok.parent_of(self.con.cursor(), SESSION["long-turn"]))


def rewrite(path, change):
    """Rewrites a copied fixture log, each line's dict passed through change (which edits it in place)."""
    with open(path) as fh:
        lines = [json.loads(x) for x in fh]
    for d in lines:
        change(d)
    with open(path, "w") as fh:
        fh.writelines(json.dumps(d) + "\n" for d in lines)


class ToolTest(GrokCase):
    COLS = "tool, mcp_server, input_summary, start_ts IS NOT NULL, end_ts IS NOT NULL, is_error, error, category, is_commit"

    def calls(self, where="TRUE"):
        return self.q(f"SELECT {self.COLS} FROM tool_calls WHERE {where} ORDER BY start_ts")

    def test_failing_command_marked_completed(self):
        self.put("probe")
        self.ingest()
        (tool, _, summary, _, _, err, text, cat, commit), = self.calls("input_summary = 'ls missing-dir'")
        self.assertEqual((tool, err, commit), ("run_terminal_command", True, False))
        self.assertTrue(text.startswith("Exit code 1\nls: cannot access"), text)
        self.assertIsNotNone(cat)
        self.assertIsNotNone(self.q("SELECT followup FROM tool_calls WHERE input_summary = 'ls missing-dir'")[0][0])

    def test_commit(self):
        self.put("probe")
        self.ingest()
        self.assertEqual(self.q("SELECT tool, is_error, is_commit, test_passed FROM tool_calls WHERE is_commit"),
                         [("run_terminal_command", False, True, True)])

    def test_call_still_running(self):
        self.put("probe")
        self.ingest()
        self.assertEqual(self.calls("input_summary = 'sleep 60'"),
                         [("run_terminal_command", None, "sleep 60", True, False, None, None, None, False)])

    def test_mcp_calls(self):
        self.put("tools")
        self.ingest()
        self.assertEqual([r[:3] + r[5:8] for r in self.calls("mcp_server IS NOT NULL")], [
            ("mcp__srv_a__tool_a", "srv_a", "text 62", False, None, None),
            ("mcp__srv_a__tool_b", "srv_a", '{"tabId": "text 76", "includeImage": true}', True, "text 91", "mcp"),
            ("mcp__srv_b__tool_c", "srv_b", "{}", True, "text 116", "mcp")])

    def test_other_failure_and_summaries(self):
        self.put("tools")
        self.put("cancelled")
        self.ingest()
        self.assertEqual([r[:3] + r[5:7] for r in self.calls("tool = 'grep'")],
                         [("grep", None, "text 10", True, "path_not_found"), ("grep", None, "text 20", False, None)])
        tools = dict(self.q("SELECT tool, any_value(input_summary) FROM tool_calls GROUP BY 1"))
        self.assertTrue(tools["read_file"].startswith("/work/app/"))
        self.assertEqual(tools["list_dir"], "/work/app")

    def test_error_rules(self):
        # A grep that finds nothing exits 1 and is no error: only a shell command's exit code says it failed.
        grep = dict(status="completed", rawOutput=dict(type="GrepSearch", exit_code=1, match_count=0))
        self.assertIsNone(grok.error_of("grep", grep))
        self.assertEqual(grok.error_of("run_terminal_command", dict(status="completed", rawOutput=dict(exit_code=2, output_for_prompt="no\n"))),
                         "Exit code 2\nno")
        self.assertIsNone(grok.error_of("run_terminal_command", dict(status="completed", rawOutput=dict(exit_code=0))))
        self.assertEqual(grok.error_of("mcp__s__t", dict(status="completed", rawOutput=dict(type="MCP", output={"Error": "bad"}, is_error=True))), "bad")
        self.assertEqual(grok.error_of("read_file", dict(status="failed", rawOutput=dict(FileNotFound="/x"))), "/x")
        self.assertEqual(grok.error_of("read_file", dict(status="failed", content=[dict(type="content", content=dict(type="text", text="gone"))])), "gone")

    def test_result_size_is_its_text(self):
        self.put("probe")
        self.ingest()
        text = "ls: cannot access 'missing-dir': No such file or directory\n"
        self.assertEqual(self.q("SELECT result_bytes FROM tool_calls WHERE input_summary = 'ls missing-dir'"), [(len(text.encode()),)])

    def test_result_in_a_later_ingest(self):
        path, = self.put("tools")
        with open(path) as fh:
            lines = fh.readlines()
        cut = next(i for i, x in enumerate(lines) if '"ls missing-dir"' in x and '"tool_call"' in x) + 1
        with open(path, "w") as fh:
            fh.writelines(lines[:cut])
        self.ingest()
        self.assertEqual(self.calls("input_summary = 'ls missing-dir'")[0][3:6], (True, False, None))
        with open(path, "a") as fh:
            fh.writelines(lines[cut:])
        self.ingest()
        whole = self.q("SELECT * EXCLUDE (followup) FROM tool_calls ORDER BY 1")
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT * EXCLUDE (followup) FROM tool_calls ORDER BY 1"), whole)
        self.assertTrue(self.calls("input_summary = 'ls missing-dir'")[0][5])


class PromptTest(GrokCase):
    def prompts(self):
        return self.q("SELECT prompt_id, session_id, interrupted FROM prompts ORDER BY ts")

    def test_prompt_in_two_chunks(self):
        self.put("long-turn")
        self.ingest()
        sid = SESSION["long-turn"]
        self.assertEqual(self.prompts(), [(f"{sid}:prompt-02000001", sid, False)])
        first, = self.q("SELECT min(ts) FROM raw_lines WHERE type = 'user_message_chunk'")[0]
        self.assertEqual(self.q("SELECT ts FROM prompts"), [(datetime.fromisoformat(store.ts_of(first)),)])
        self.assertEqual(titles.first_prompts(self.con.cursor(), [sid]), {sid: "text 3\ntext 5"})

    def test_cancelled_turn(self):
        self.put("cancelled")
        self.ingest()
        sid = SESSION["cancelled"]
        self.assertEqual(self.prompts(), [(f"{sid}:prompt-04000001", sid, True)])

    def test_turns_of_the_probe(self):
        self.put("probe")
        self.ingest()
        sid = SESSION["probe"]
        self.assertEqual(self.prompts(), [(f"{sid}:0a1f0001-0000-7000-8000-000000000003", sid, False),
                                          (f"{sid}:0a1f0001-0000-7000-8000-000000000010", sid, False)])
    def test_sessions_that_share_a_prompt_id(self):
        # A wrapper app can give two sessions the same prompt id: each keeps its own prompt, text and interrupted flag.
        path, = self.put("cancelled")
        sid, other = SESSION["cancelled"], "0a1f0004-0000-7000-8000-000000000009"
        copy = os.path.join(os.path.dirname(os.path.dirname(path)), other, grok.LOG)
        os.makedirs(os.path.dirname(copy))
        shutil.copy(path, copy)

        def change(d):
            p, u = grok.params(d), grok.update(d)
            p["sessionId"] = other
            p["_meta"]["eventId"] = other + p["_meta"]["eventId"][len(sid):]
            if u.get("sessionUpdate") == "turn_completed":
                u["stop_reason"] = "end_turn"
            if u.get("sessionUpdate") == "user_message_chunk":
                u["content"]["text"] = "other " + u["content"]["text"]
        rewrite(copy, change)
        self.ingest()
        want = [(f"{sid}:prompt-04000001", sid, True), (f"{other}:prompt-04000001", other, False)]
        self.assertEqual(self.q("SELECT prompt_id, session_id, interrupted FROM prompts ORDER BY session_id"), want)
        self.assertEqual(titles.first_prompts(self.con.cursor(), [sid, other]), {sid: "text 3\ntext 5", other: "other text 3\nother text 5"})
        store.rebuild(self.con)
        self.assertEqual(self.q("SELECT prompt_id, session_id, interrupted FROM prompts ORDER BY session_id"), want)

    def test_chunk_in_a_later_ingest_than_its_hook(self):
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = fh.readlines()
        cut = next(i for i, x in enumerate(lines) if '"user_message_chunk"' in x)
        with open(path, "w") as fh:
            fh.writelines(lines[:cut])
        self.ingest()
        self.assertEqual(self.prompts(), [])
        with open(path, "a") as fh:
            fh.writelines(lines[cut:])
        self.ingest()
        sid = SESSION["long-turn"]
        self.assertEqual(self.prompts(), [(f"{sid}:prompt-02000001", sid, False)])

    def test_title_is_the_first_prompt(self):
        self.put("tools")
        self.ingest()
        sid = SESSION["tools"]
        self.assertEqual(titles.titles(self.con.cursor(), [sid]), {sid: ("text 3", "prompt")})
        self.assertEqual(titles.first_prompt(self.con.cursor(), sid, cap=None), "text 3\ntext 5")


class HookTest(GrokCase):
    def test_two_hooks_on_session_start(self):
        self.put("cancelled")
        self.ingest()
        sid = SESSION["cancelled"]
        start, = self.q("SELECT ts FROM raw_lines WHERE type = 'session_start'")[0]
        self.assertEqual(self.q("SELECT session_id, ts, source, hook, command, duration_ms, is_error FROM hooks "
                                "WHERE hook = 'session_start' ORDER BY duration_ms"),
                         [(sid, datetime.fromisoformat(store.ts_of(start)), "hook_execution", "session_start", "hook-1", 11, False),
                          (sid, datetime.fromisoformat(store.ts_of(start)), "hook_execution", "session_start", "hook-2", 232, False)])

    def test_one_row_per_run(self):
        paths = self.put("probe")
        self.ingest()
        runs = 0
        for p in paths:
            with open(p) as fh:
                runs += sum(len(grok.update(json.loads(x)).get("runs") or []) for x in fh if '"hook_execution"' in x)
        self.assertEqual(self.q("SELECT count(*), bool_or(is_error) FROM hooks"), [(runs, False)])


class RunTest(GrokCase):
    def test_one_run_per_turn(self):
        path, = self.put("tools")
        self.ingest()
        with open(path) as fh:
            ends = [(grok.meta(d)["agentTimestampMs"] - grok.update(d)["elapsed_ms"], grok.update(d)["usage"]["apiDurationMs"])
                    for d in map(json.loads, fh) if grok.update(d).get("sessionUpdate") == "turn_completed"]
        self.assertEqual(self.q("SELECT start_ms, api_ms, tool_ms, lines_added, lines_removed FROM session_runs ORDER BY 1"),
                         [(start, api, None, None, None) for start, api in sorted(ends)])
        os.utime(path, (0, 0))
        self.con.execute("UPDATE files SET read_offset = 0, lines = 0")  # read again from the start: one row per turn still
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM session_runs"), [(3,)])

    def test_output_speed(self):
        path, = self.put("long-turn")

        def change(d):
            u = grok.update(d)
            if u.get("sessionUpdate") == "turn_completed":
                for x in (u["usage"], *u["usage"]["modelUsage"].values()):
                    x.update(outputTokens=100_000, reasoningTokens=0, apiDurationMs=1_000_000)
        rewrite(path, change)
        self.ingest()
        runs = metrics.session(self.con.cursor(), SESSION["long-turn"])["info"]["runs"]
        self.assertEqual(runs, dict(model_ms=1_000_000, tool_ms=None, lines_added=None, lines_removed=None, output_per_s=100.0))


class AllSourcesRebuildTest(GrokCase):
    """A store holding Claude Code, Codex and Grok sessions: a rebuild gives every derived table as ingest made it."""

    def test_rebuild_matches_ingest(self):
        from test_codex import LIVE, fixture
        from test_derive import assistant, cost_state, prompt, result, tool_use
        self.roots = dict(claude=self.root, codex=os.path.join(self.tmp, "codex"), grok=self.home)
        for label in LABELS:
            self.put(label)
        for label in ("v0156_commit", "v0166_aborted"):
            name, text = fixture(label)
            os.makedirs(os.path.join(self.roots["codex"], LIVE), exist_ok=True)
            with open(os.path.join(self.roots["codex"], LIVE, name), "w") as fh:
                fh.write(text)
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go")
                   + assistant("a1", "m1", "2026-11-01T10:00:01Z", [tool_use("t1", "Bash", command="x")])
                   + result("r1", "2026-11-01T10:00:02Z", "t1", "Exit code 1", error=True)
                   + assistant("a2", "m2", "2026-11-01T10:00:03Z", [dict(type="text", text="Hm.")])
                   + line(type="attachment", uuid="h1", timestamp="2026-11-01T10:00:04Z", sessionId="s1",
                          attachment=dict(type="hook_success", hookName="PostToolUse:Bash", command="lint", durationMs=12))
                   + cost_state(1_793_000_000_000, 90_000, 40_000, 120, 30))
        self.ingest()
        before = {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}
        self.assertEqual(self.q("SELECT source, count(*) FROM sessions GROUP BY 1 ORDER BY 1"),
                         [("claude", 1), ("codex", 2), ("grok", 5)])
        self.assertEqual(self.q("SELECT count(*) > 0 FROM requests WHERE reported_cost IS NOT NULL"), [(True,)])
        self.assertEqual(self.q("SELECT count(*) FILTER (WHERE tool_ms IS NULL), count(*) FILTER (WHERE tool_ms IS NOT NULL) "
                                "FROM session_runs"), [(7, 1)])
        for t, n in (("tool_calls", 3), ("prompts", 3), ("hooks", 2)):  # Codex records no hooks
            self.assertEqual(self.q(f"SELECT count(DISTINCT s.source) FROM {t} JOIN sessions s USING (session_id)"), [(n,)], t)
        store.rebuild(self.con)
        self.assertEqual({t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}, before)
