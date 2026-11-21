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
        tables = ("sessions", "requests", "prompts", "tool_calls")
        for label in ("long-turn", "compaction", "probe", "tools"):
            with self.subTest(label=label):
                paths = self.put(label)
                self.ingest()
                whole = [self.q(f"SELECT * FROM {t} ORDER BY 1") for t in tables]
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
                self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in tables], whole)
                store.rebuild(self.con)
                self.assertEqual([self.q(f"SELECT * FROM {t} ORDER BY 1") for t in tables], whole)
                shutil.rmtree(self.home)
                for t in ("raw_lines", "files", *store.DERIVED):
                    self.con.execute(f"DELETE FROM {t}")

    def stated(self, path):
        """[(streamStartMs, the largest totalTokens its lines state)] of a one-turn fixture log, oldest first."""
        with open(path) as fh:
            lines = [json.loads(x) for x in fh]
        sizes = {}
        for d in lines:
            m = grok.meta(d)
            if grok.update(d).get("sessionUpdate") in grok.CALL_TYPES and "streamStartMs" in m:
                sizes[m["streamStartMs"]] = max(sizes.get(m["streamStartMs"], 0), m.get("totalTokens") or 0)
        return sorted(sizes.items())

    def test_each_call_keeps_the_context_it_stated(self):
        path, = self.put("long-turn")
        self.ingest()
        want = [size for _, size in self.stated(path)]
        self.assertEqual([r[0] for r in self.q("SELECT context_tokens FROM requests ORDER BY ts")], want)
        # The Context page's turns read the stated sizes: its curves, starting context and the session map's start.
        from ai_ledger import context
        _, _, _, fp, _, rq, rp = metrics.view("", 0, {}, datetime(2026, 12, 1).date())
        got = [r[0] for r in self.con.execute(f"{context.ctes(rq)} SELECT prompt FROM turns ORDER BY turn", rp).fetchall()]
        self.assertEqual(got, [n for n in want if n >= context.START_MIN_TOKENS])
        self.assertNotEqual(got, [r[0] for r in self.q("SELECT input + cache_read + cache_5m + cache_1h FROM requests "
                                                       f"WHERE input + cache_read >= {context.START_MIN_TOKENS} ORDER BY ts")])

    def test_turns_without_an_event_id_are_two_requests(self):
        # A line with no eventId is stored under <path>:<offset>: each turn keeps its own identity, in ingest and rebuild.
        for cut_calls in (True, False):
            with self.subTest(cut_calls=cut_calls):
                shutil.rmtree(self.home, ignore_errors=True)
                for t in ("raw_lines", "files", *store.DERIVED):
                    self.con.execute(f"DELETE FROM {t}")
                path, = self.put("long-turn")
                with open(path) as fh:
                    lines = [json.loads(x) for x in fh if not cut_calls or not any(f'"{t}"' in x for t in grok.CALL_TYPES)]
                end = next(d for d in lines if grok.update(d).get("sessionUpdate") == "turn_completed")
                again = json.loads(json.dumps(end))
                for d in (end, again):
                    del grok.meta(d)["eventId"]
                with open(path, "w") as fh:
                    fh.writelines(json.dumps(d) + "\n" for d in lines + [again])
                self.ingest()
                self.assertEqual(self.q("SELECT count(*) FROM raw_lines WHERE type = 'turn_completed'"), [(2,)])
                self.assertSums(SESSION["long-turn"], reported(turns(path)))
                if not cut_calls:  # the first turn's calls are found through its stored line
                    self.assertEqual(self.q("SELECT count(*) FROM requests WHERE context_tokens > 0"), [(5,)])
                before = self.q("SELECT * FROM requests ORDER BY 1")
                store.rebuild(self.con)
                self.assertEqual(self.q("SELECT * FROM requests ORDER BY 1"), before)

    def test_cost_of_the_turn_when_its_model_states_none(self):
        path, = self.put("long-turn")

        def change(d):
            u = grok.update(d)
            if u.get("sessionUpdate") == "turn_completed":
                for mu in u["usage"]["modelUsage"].values():
                    del mu["costUsdTicks"]
        rewrite(path, change)
        self.ingest()
        self.assertAlmostEqual(self.q("SELECT sum(reported_cost) FROM requests")[0][0], 0.1805245, places=9)
        self.assertEqual(self.q("SELECT count(*) FROM requests WHERE reported_cost IS NULL"), [(0,)])

    def test_cost_of_the_turn_shared_over_models_that_state_none(self):
        # Two models, one without a cost: it takes the rest of the turn's cost, so the requests add up to the turn's.
        path, = self.put("long-turn")

        def change(d):
            u = grok.update(d)
            if u.get("sessionUpdate") == "turn_completed":
                usage = u["usage"]
                usage["costUsdTicks"] = 1_000_000_000  # $0.10
                usage["modelUsage"] = {"a": dict(inputTokens=300, outputTokens=0, costUsdTicks=400_000_000),
                                       "b": dict(inputTokens=100, outputTokens=0), "c": dict(inputTokens=200, outputTokens=0)}
        rewrite(path, change)
        self.ingest()
        got = dict(self.q("SELECT model, reported_cost FROM requests"))
        self.assertEqual(set(got), {"a", "b", "c"})
        self.assertAlmostEqual(got["a"], 0.04)
        self.assertAlmostEqual(got["b"], 0.02)  # 0.06 left, shared by tokens: 100 to 200
        self.assertAlmostEqual(got["c"], 0.04)
        self.assertAlmostEqual(sum(got.values()), 0.1)

    def test_call_figures_that_are_text_state_no_call(self):
        # "12" is no streamStartMs: a numeric string would make a call at the Unix epoch. The turn is then one request.
        path, = self.put("long-turn")

        def change(d):
            m = grok.meta(d)
            for k in ("streamStartMs", "totalTokens"):
                if k in m:
                    m[k] = str(m[k])
        rewrite(path, change)
        self.ingest()
        self.assertEqual(self.q("SELECT count(*), min(ts) > TIMESTAMP '2000-01-01' FROM requests"), [(1, True)])
        with open(path) as fh:
            chunk = next(d for d in map(json.loads, fh) if grok.update(d).get("sessionUpdate") == "agent_message_chunk")
        self.assertEqual([it["group"] for it in grok.live_items(chunk)], [None])

    def test_turn_whose_calls_cannot_be_told_states_no_context(self):
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = fh.readlines()
        with open(path, "w") as fh:
            fh.writelines(x for x in lines if not any(f'"{t}"' in x for t in grok.CALL_TYPES))
        self.ingest()
        # 0: the row's tokens are a whole turn's, not one call's, so its context is unknown (metrics.context_of: NULL).
        self.assertEqual(self.q("SELECT context_tokens FROM requests"), [(0,)])

    def test_fallback_turn_after_a_known_context_shows_none(self):
        # The newest main-thread request's context is the current one, unknown as it may be: no older context stands in.
        from ai_ledger import live
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = [json.loads(x) for x in fh]
        end = next(d for d in lines if grok.update(d).get("sessionUpdate") == "turn_completed")
        later = json.loads(json.dumps(end))
        grok.meta(later).update(eventId=grok.meta(later)["eventId"] + "0", agentTimestampMs=grok.meta(later)["agentTimestampMs"] + 60_000)
        grok.update(later)["prompt_id"] = "no-calls"
        with open(path, "a") as fh:
            fh.write(json.dumps(later) + "\n")
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FILTER (WHERE context_tokens > 0), count(*) FILTER (WHERE context_tokens = 0) FROM requests"),
                         [(5, 1)])
        (last,) = self.con.execute("SELECT last_ts FROM sessions").fetchone()
        self.assertIsNone(live.session(self.con.cursor(), SESSION["long-turn"], now=live.aware(last), prices={})["context"])

    def test_fallback_turn_shows_no_context(self):
        # A turn of millions of input tokens whose calls cannot be told: its tokens and cost count, its context is no point.
        from ai_ledger import context, live
        path, = self.put("long-turn")
        with open(path) as fh:
            lines = [json.loads(x) for x in fh if not any(f'"{t}"' in x for t in grok.CALL_TYPES)]
        for d in lines:
            u = grok.update(d)
            if u.get("sessionUpdate") == "turn_completed":
                for x in (u["usage"], *u["usage"]["modelUsage"].values()):
                    x["inputTokens"] = 5_000_000 + x["cachedReadTokens"]
        with open(path, "w") as fh:
            fh.writelines(json.dumps(d) + "\n" for d in lines)
        self.ingest()
        cur = self.con.cursor()
        sid = SESSION["long-turn"]
        self.assertEqual(self.q("SELECT input FROM requests"), [(5_000_000,)])
        (end, last) = cur.execute("SELECT max(r.ts), max(s.last_ts) FROM requests r, sessions s").fetchone()
        one = live.session(cur, sid, now=live.aware(last), prices={})
        self.assertIsNone(one["context"])
        self.assertEqual(one["requests"], 1)
        self.assertAlmostEqual(one["cost"], 0.1805245)
        self.assertEqual(live.pulse(cur, sid, live.aware(end))["context"], [])
        s = metrics.session(cur, sid, prices={})
        self.assertEqual([r["context"] for r in s["requests"]], [None])
        self.assertEqual([r["context"] for r in s["timeline"]], [None])
        self.assertEqual(s["models"][0]["input"], 5_000_000)
        _, _, _, _, _, rq, rp = metrics.view("", 0, {}, datetime(2026, 12, 1).date())
        self.assertEqual(self.con.execute(f"{context.ctes(rq)} SELECT count(*) FROM turns", rp).fetchall(), [(0,)])
        self.assertEqual(metrics.usage(cur, prices={}, today=datetime(2026, 12, 1).date())["totals"]["input"], 5_000_000)

    def test_store_without_context_tokens_gains_it_empty(self):
        self.put("long-turn")
        self.ingest()
        from ai_ledger import live
        cur = self.con.cursor()
        sid = SESSION["long-turn"]
        (last,) = cur.execute("SELECT last_ts FROM sessions").fetchone()
        now = live.aware(last)
        self.con.execute("ALTER TABLE requests DROP COLUMN context_tokens")  # the schema before stated context sizes
        self.con.close()
        self.con = store.open_store(self.db)
        self.assertEqual(self.q("SELECT count(*), count(context_tokens) FROM requests"), [(5, 0)])
        old = self.q("SELECT arg_max(input + cache_read + cache_5m + cache_1h, ts) FROM requests")[0][0]
        self.assertEqual(live.session(self.con.cursor(), sid, now=now, prices={})["context"], old)  # as before: no line read again
        self.assertEqual(self.count(), self.lines_of("long-turn"))

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

    def child_first(self):
        """The probe with the child's log under a working folder that sorts before the parent's; returns its path."""
        _, child = self.put("probe")
        moved = os.path.join(self.home, "sessions", "%2Fa", CHILD, grok.LOG)
        os.makedirs(os.path.dirname(moved))
        shutil.move(child, moved)
        shutil.rmtree(os.path.dirname(child))
        return moved

    def assertOneSession(self, parent):
        sid = SESSION["probe"]
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(sid,)])
        self.assertEqual(self.q("SELECT count(*), bool_or(subagent) FROM requests"), [(3, False)])
        got, want = self.q(f"SELECT {SUMS} FROM requests")[0], reported(turns(parent))
        self.assertEqual(got[:5], want[:5])
        self.assertAlmostEqual(got[5], want[5], places=9)
        self.assertEqual(self.q("SELECT DISTINCT session_id FROM tool_calls"), [(sid,)])
        self.assertEqual(self.q("SELECT session_id, tool FROM tool_calls WHERE subagent"), [(sid, "read_file")])
        self.assertEqual(self.q("SELECT DISTINCT session_id FROM hooks"), [(sid,)])
        self.assertEqual(self.q("SELECT count(*) FROM prompts"), [(2,)])
        self.assertEqual(self.q("SELECT count(*) FROM session_runs"), [(1,)])

    def test_files_sort_by_session_across_working_folders(self):
        moved = self.child_first()
        parent = os.path.join(self.home, "sessions", "%2Fwork%2Fapp", SESSION["probe"], grok.LOG)
        self.assertEqual(grok.files(self.home), [parent, moved])
        self.ingest()  # one ingest: the parent's subagent_spawned line is stored before the child's file is placed
        self.assertOneSession(parent)
        self.assertEqual(self.q("SELECT DISTINCT session_id, subagent FROM raw_lines WHERE file = ?", moved), [(SESSION["probe"], True)])

    def test_child_read_alone_first_is_moved_to_its_parent(self):
        parent = os.path.join(self.home, "sessions", "%2Fwork%2Fapp", SESSION["probe"], grok.LOG)
        self.put("probe")
        aside = os.path.join(self.tmp, "parent.jsonl")
        shutil.move(parent, aside)
        self.ingest()  # the child alone: a session of its own until its parent's spawn line is stored
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(CHILD,)])
        self.assertGreater(self.q("SELECT count(*) FROM requests WHERE session_id = ?", CHILD)[0][0], 0)
        shutil.move(aside, parent)
        self.ingest()
        self.assertOneSession(parent)
        self.assertEqual(self.q("SELECT DISTINCT session_id, subagent FROM raw_lines WHERE file <> ?", parent), [(SESSION["probe"], True)])
        healed = {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}
        placed = self.q("SELECT key, session_id, subagent FROM raw_lines ORDER BY key")
        store.rebuild(self.con)
        self.assertEqual({t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}, healed)
        self.assertEqual(self.q("SELECT key, session_id, subagent FROM raw_lines ORDER BY key"), placed)

    def test_spawn_line_naming_another_source_changes_nothing(self):
        # A Grok line can name any id: a Claude Code or Codex session it names keeps all its rows.
        from test_codex import LIVE, fixture
        from test_derive import assistant, prompt, result, tool_use
        self.roots = dict(claude=self.root, codex=os.path.join(self.tmp, "codex"), grok=self.home)
        self.write("a.jsonl", prompt("u1", "2026-11-01T10:00:00Z", "p1", "go")
                   + assistant("a1", "m1", "2026-11-01T10:00:01Z", [tool_use("t1", "Bash", command="x")])
                   + result("r1", "2026-11-01T10:00:02Z", "t1", "Exit code 1", error=True)
                   + line(type="attachment", uuid="h1", timestamp="2026-11-01T10:00:04Z", sessionId="s1",
                          attachment=dict(type="hook_success", hookName="PostToolUse:Bash", command="lint", durationMs=12)))
        name, text = fixture("v0156_commit")
        os.makedirs(os.path.join(self.roots["codex"], LIVE))
        with open(os.path.join(self.roots["codex"], LIVE, name), "w") as fh:
            fh.write(text)
        self.ingest()
        others = [r[0] for r in self.q("SELECT session_id FROM sessions ORDER BY source")]
        self.assertEqual(len(others), 2)
        tables = ("raw_lines", "sessions", "requests", "session_runs", "prompts", "session_titles", "tool_calls", "hooks")
        before = {t: self.q(f"SELECT * FROM {t} WHERE session_id IN (?, ?) ORDER BY ALL", *others) for t in tables}
        parent, child = self.put("probe")
        os.remove(child)

        def change(d):
            u = grok.update(d)
            if u.get("sessionUpdate") == "subagent_spawned":
                spawned = json.loads(json.dumps(d))
                u["child_session_id"] = others[0]
                grok.meta(spawned)["eventId"] += "0"
                grok.update(spawned)["child_session_id"] = others[1]
                extra.append(spawned)
        extra = []
        rewrite(parent, change)
        with open(parent, "a") as fh:
            fh.writelines(json.dumps(d) + "\n" for d in extra)
        self.ingest()
        self.assertEqual(self.q("SELECT count(*) FROM raw_lines WHERE type = 'subagent_spawned'"), [(2,)])
        self.assertEqual({t: self.q(f"SELECT * FROM {t} WHERE session_id IN (?, ?) ORDER BY ALL", *others) for t in tables}, before)

    def test_spawn_line_naming_its_own_spawner_changes_nothing(self):
        # A child that names its parent as its own child: no cycle, the parent stays a session of its own.
        parent, child = self.put("probe")
        spawn = next(json.loads(x) for x in open(parent) if '"subagent_spawned"' in x)
        back = json.loads(json.dumps(spawn))
        grok.params(back)["sessionId"] = CHILD
        grok.meta(back)["eventId"] = f"{CHILD}-999"
        grok.update(back)["child_session_id"] = SESSION["probe"]
        with open(child, "a") as fh:
            fh.write(json.dumps(back) + "\n")
        self.ingest()
        self.assertEqual(self.q("SELECT session_id FROM sessions"), [(SESSION["probe"],)])
        self.assertEqual(self.q("SELECT DISTINCT session_id, subagent FROM raw_lines WHERE file = ?", parent), [(SESSION["probe"], False)])
        self.assertEqual(self.q("SELECT count(*) FROM requests"), [(3,)])

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

    def opened(self, sid):
        """The keys of session sid's own user_prompt_submit hook lines, in file order: the stored ids of its prompts."""
        return [r[0] for r in self.q("SELECT key FROM raw_lines WHERE type = 'user_prompt_submit' AND session_id = ? "
                                     "AND NOT subagent ORDER BY byte_offset", sid)]

    def test_prompt_in_two_chunks(self):
        self.put("long-turn")
        self.ingest()
        sid = SESSION["long-turn"]
        self.assertEqual(self.prompts(), [(self.opened(sid)[0], sid, False)])
        first, = self.q("SELECT min(ts) FROM raw_lines WHERE type = 'user_message_chunk'")[0]
        self.assertEqual(self.q("SELECT ts FROM prompts"), [(datetime.fromisoformat(store.ts_of(first)),)])
        self.assertEqual(titles.first_prompts(self.con.cursor(), [sid]), {sid: "text 3\ntext 5"})

    def test_cancelled_turn(self):
        self.put("cancelled")
        self.ingest()
        sid = SESSION["cancelled"]
        self.assertEqual(self.prompts(), [(self.opened(sid)[0], sid, True)])

    def test_turns_of_the_probe(self):
        self.put("probe")
        self.ingest()
        sid = SESSION["probe"]
        self.assertEqual(self.prompts(), [(k, sid, False) for k in self.opened(sid)])
        self.assertEqual(len(self.opened(sid)), 2)

    def test_turns_that_share_a_prompt_id(self):
        # A wrapper app can give two turns of one session the same prompt id: each is a prompt of its own, with its own
        # text, and cancelling the second marks only the second.
        path, = self.put("tools")
        sid = SESSION["tools"]
        with open(path) as fh:
            pids = [grok.update(d)["prompt_id"] for d in map(json.loads, fh) if grok.update(d).get("event_name") == "user_prompt_submit"]
        self.assertEqual(pids[0], pids[1])
        n = []

        def change(d):
            u = grok.update(d)
            if u.get("sessionUpdate") == "turn_completed":
                n.append(d)
                if len(n) == 2:
                    u["stop_reason"] = "cancelled"
        rewrite(path, change)
        self.ingest()
        keys = self.opened(sid)
        want = [(k, sid, i == 1) for i, k in enumerate(keys)]
        self.assertEqual(len(want), 4)
        self.assertEqual(self.prompts(), want)
        cur = self.con.cursor()
        self.assertEqual([grok.prompt_texts(cur, {sid: k})[sid] for k in keys[:2]], ["text 3\ntext 5", "text 49\ntext 51"])
        store.rebuild(self.con)
        self.assertEqual(self.prompts(), want)
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
        want = [(self.opened(sid)[0], sid, True), (self.opened(other)[0], other, False)]
        self.assertNotEqual(want[0][0], want[1][0])
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
        self.assertEqual(self.prompts(), [(self.opened(sid)[0], sid, False)])

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


class MalformedTest(GrokCase):
    """Valid JSON lines with a field of the wrong type derive nothing and stop no ingest."""

    def bad_lines(self, sid):
        def line_of(n, update, **meta):
            return dict(timestamp=1, method="session/update", params=dict(
                sessionId=sid, update=update, _meta=dict(eventId=f"{sid}-9{n:03d}", agentTimestampMs=1794486999000 + n, **meta)))
        usage = dict(inputTokens=10, outputTokens=5, costUsdTicks=10000)
        bad = [dict(sessionUpdate="turn_completed", prompt_id="x1", stop_reason="end_turn", usage=dict(usage, modelUsage=["a", "b"])),
               dict(sessionUpdate="turn_completed", prompt_id="x2", stop_reason="end_turn", usage=dict(usage, modelUsage="grok")),
               dict(sessionUpdate="turn_completed", prompt_id={"a": 1}, stop_reason=["x"], elapsed_ms="3", usage="lots"),
               dict(sessionUpdate="turn_completed", prompt_id="x3", stop_reason=["x"], usage=dict(usage, modelUsage={"m": "x"})),
               dict(sessionUpdate="turn_completed", prompt_id=7, stop_reason=3, usage=[1, 2]),
               dict(sessionUpdate="tool_call", toolCallId={"a": 1}, rawInput="ls", _meta="x"),
               dict(sessionUpdate="tool_call", toolCallId="bad-1", rawInput=["ls"], _meta={"x.ai/tool": "run_terminal_command"}),
               dict(sessionUpdate="tool_call_update", toolCallId=["x"], status="completed", rawOutput="out"),
               dict(sessionUpdate="tool_call_update", toolCallId="bad-1", status="failed", rawOutput=["x"], content="text"),
               dict(sessionUpdate="tool_call_update", toolCallId="bad-2", status={"s": 1}, rawOutput={"exit_code": "1"}, content=[1, "x"]),
               dict(sessionUpdate="hook_execution", event_name={"e": 1}, prompt_id=["p"], runs="many"),
               dict(sessionUpdate="hook_execution", event_name="stop", runs=[{"name": {"n": 1}, "status": "ok"}, "run"]),
               dict(sessionUpdate=["agent_message_chunk"], content="hi"),
               dict(sessionUpdate="agent_message_chunk", content=["hi"]),
               dict(sessionUpdate="user_message_chunk", content={"text": 5}),
               dict(sessionUpdate="auto_compact_started", context_window="256000"),
               dict(sessionUpdate="auto_compact_completed", tokens_before="1"),
               dict(sessionUpdate="subagent_spawned", child_session_id={"id": 1}),
               "update"]
        # A call line whose figures are text, before the turn x2 it would count in.
        call = line_of(99, dict(sessionUpdate="agent_message_chunk", content=dict(type="text", text="x")),
                       streamStartMs="soon", totalTokens="many", promptId="x2")
        out = [line_of(i, u) for i, u in enumerate(bad)]
        out.insert(1, call)
        out += [dict(timestamp=1, params="text"), dict(timestamp=1, params=dict(sessionId=sid, update="u", _meta=["m"])),
                dict(timestamp=1, params=dict(sessionId=sid, update=dict(sessionUpdate="tool_call", toolCallId="bad-3"), _meta=["m"]))]
        return out

    def test_bad_lines_derive_nothing_and_raise_nothing(self):
        from ai_ledger import live
        path, = self.put("long-turn")
        sid = SESSION["long-turn"]
        self.ingest()
        good = {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in ("requests", "tool_calls", "prompts", "hooks", "session_runs")}
        with open(path) as fh:
            lines = fh.readlines()
        bad = self.bad_lines(sid)
        for d in bad:
            grok.live_items(d)
        live.assemble([(f"k{i}", path, None, False, "grok", json.dumps(d)) for i, d in enumerate(bad)])
        # In a file read from its start: the bad lines after the good turn's end, before the lines that close the session.
        end = next(i for i, x in enumerate(lines) if '"turn_completed"' in x) + 1
        for t in ("raw_lines", "files", *store.DERIVED):
            self.con.execute(f"DELETE FROM {t}")
        with open(path, "w") as fh:
            fh.writelines(lines[:end] + [json.dumps(d) + "\n" for d in bad] + lines[end:])
        self.ingest()
        self.assertEqual(self.count(), len(lines) + len(bad))
        for t in ("tool_calls", "prompts", "hooks", "session_runs"):
            self.assertEqual(self.q(f"SELECT * FROM {t} WHERE {'tool_use_id IS NULL OR NOT starts_with(tool_use_id, $$bad-$$)' if t == 'tool_calls' else 'TRUE'} "
                                    "ORDER BY ALL"), good[t], t)
        # A turn whose modelUsage is no breakdown is one request with the turn's totals and no model.
        got = self.q("SELECT * FROM requests WHERE model IS NOT NULL ORDER BY ALL")
        self.assertEqual(got, good["requests"])
        self.assertEqual(self.q("SELECT model, input, output, reported_cost, stop_reason FROM requests WHERE model IS NULL "
                                "ORDER BY stop_reason NULLS LAST"), [(None, 10, 5, 1e-6, "end_turn")] * 2 + [(None, 10, 5, 1e-6, None)])
        before = {t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}
        store.rebuild(self.con)
        self.assertEqual({t: self.q(f"SELECT * FROM {t} ORDER BY ALL") for t in store.DERIVED}, before)


class AbsurdNumberTest(GrokCase):
    """A figure that is no finite number from 0 to the largest signed 64-bit integer is absent: ingest goes on, and
    every payload is valid JSON."""

    def test_absurd_figures(self):
        from ai_ledger import live
        for raw in ("1e309", "-1e309", "NaN", "Infinity", "-1", str(2 ** 80), str(10 ** 400)):
            with self.subTest(raw=raw):
                shutil.rmtree(self.home, ignore_errors=True)
                for t in ("raw_lines", "files", *store.DERIVED):
                    self.con.execute(f"DELETE FROM {t}")
                path, = self.put("long-turn")
                with open(path) as fh:
                    lines = [json.loads(x) for x in fh]
                for d in lines:
                    u = grok.update(d)
                    if u.get("sessionUpdate") == "turn_completed":
                        u["elapsed_ms"] = "@"
                        for x in (u["usage"], *u["usage"]["modelUsage"].values()):
                            x.update(costUsdTicks="@", inputTokens="@", outputTokens="@", apiDurationMs="@")
                    if "totalTokens" in grok.meta(d):
                        grok.meta(d)["totalTokens"] = "@"
                    if u.get("sessionUpdate") == "auto_compact_started":
                        u["context_window"] = "@"
                    for r in u.get("runs") or []:
                        r["status"]["elapsed_ms"] = "@"
                with open(path, "w") as fh:
                    fh.writelines(json.dumps(d).replace('"@"', raw) + "\n" for d in lines)
                self.ingest()
                self.assertEqual(self.count(), len(lines))
                self.assertEqual(self.q("SELECT count(*), count(reported_cost), max(input), max(output) FROM requests"), [(5, 0, 0, 0)])
                self.assertEqual(self.q("SELECT count(*) FROM session_runs"), [(0,)])
                self.assertEqual(self.q("SELECT count(duration_ms) FROM hooks"), [(0,)])
                self.assertEqual(self.q("SELECT context_window FROM sessions"), [(None,)])
                cur = self.con.cursor()
                sid = SESSION["long-turn"]
                (last,) = cur.execute("SELECT last_ts FROM sessions").fetchone()
                for payload in (metrics.session(cur, sid, prices={}), live.session(cur, sid, now=live.aware(last), prices={}),
                                metrics.usage(cur, prices={}, today=datetime(2026, 12, 1).date())):
                    json.dumps(payload, default=str, allow_nan=False)


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
