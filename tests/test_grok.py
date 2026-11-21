import json
import os
import shutil
from datetime import datetime

from ai_ledger import store  # first: store imports the source modules
from ai_ledger import grok
from test_store import StoreCase

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
        self.assertEqual(rows, [(f"grok:{SESSION['long-turn']}:{turn['prompt_id']}:grok-4.7-build", "grok-4.7-build", "end_turn")])
        self.assertSums(SESSION["long-turn"], reported([turn]))
        end, = self.q("SELECT ts FROM raw_lines WHERE type = 'turn_completed'")
        self.assertEqual(self.q("SELECT ts FROM requests"), [(datetime.fromisoformat(store.ts_of(end[0])),)])

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

    def test_session_spawned_by_none_is_its_own(self):
        self.put("long-turn")
        self.ingest()
        self.assertIsNone(grok.parent_of(self.con.cursor(), SESSION["long-turn"]))
