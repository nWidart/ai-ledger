import os
import shutil
import tempfile
import unittest
from datetime import date, datetime, timedelta

from ai_ledger import context, metrics, store

TODAY = date(2026, 11, 5)
T0 = datetime(2026, 11, 4, 9, 0, 0)
ALL = {k: 1 for k in metrics.PRICE_KINDS}
PRICES = {
    "m-a": dict(input=1, output=1, cache_read=0.1, cache_5m=1, cache_1h=1, context=200_000),
    "m-b": dict(input=3, output=3, cache_read=0.3, cache_5m=3, cache_1h=3, context=200_000),
    "m-nowin": dict(input=1, output=1, cache_read=0.1, cache_5m=1, cache_1h=1, context=None),  # as the OpenAI models: no window in the table
    "m-long": dict(input=1, output=1, cache_read=1, cache_5m=1, cache_1h=1, context=2_000_000, long_above=100_000,
                   long={k: 10 for k in metrics.PRICE_KINDS}),
    "m-cheap": dict(input=1, output=1, cache_read=1, cache_5m=1, cache_1h=1, context=2_000_000, long_above=100_000,
                    long={k: 3 for k in metrics.PRICE_KINDS}),
}


def at(minutes=0, base=T0):
    """The stored timestamp text `minutes` after base."""
    return (base + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")


class Builder:
    """A store holding the rows a test needs, written through the derived tables as the parsers do."""

    def __init__(self, test):
        tmp = tempfile.mkdtemp()
        test.addCleanup(shutil.rmtree, tmp)
        self.con = store.open_store(os.path.join(tmp, "d", "x.duckdb"))
        test.addCleanup(self.con.close)
        self.c = self.con.cursor()
        self.n = 0

    def session(self, sid, project="foo", minute=0, source="claude", prompts=1, peak=None, peak_model="m-a", compactions=0,
                window=None, compaction_at=None, base=T0):
        store.insert(self.c, "sessions", ["session_id", "project", "first_ts", "last_ts", "compactions", "peak_context", "peak_model",
                                          "source", "context_window", "first_compaction_ts"],
                     [(sid, project, at(minute, base), at(minute + 60, base), compactions, peak, peak_model, source, window,
                       None if compaction_at is None else at(compaction_at, base))])
        store.insert(self.c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"],
                     [(f"{sid}-p{i}", sid, at(minute + i, base), False) for i in range(prompts)])

    def turn(self, sid, minute, prompt, model="m-a", cache_read=0, subagent=False, output=10, base=T0, cache_5m=0, cache_1h=0):
        self.n += 1
        store.insert(self.c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read",
                                          "cache_5m", "cache_1h", "thinking_ms"],
                     [(f"r{self.n:05d}", sid, at(minute, base), model, subagent, prompt - cache_read - cache_5m - cache_1h, output, 0, cache_read,
                       cache_5m, cache_1h, 0)])

    def turns(self, sid, prompts, minute=0.0, step=1.0, **kw):
        for i, prompt in enumerate(prompts):
            self.turn(sid, minute + i * step, prompt, **kw)

    def call(self, sid, tool, minute, size=None, mcp=None, subagent=False, summary="", error=False, done=True, tid=None):
        self.n += 1
        store.insert(self.c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "input_summary", "start_ts", "end_ts",
                                            "is_error", "subagent", "result_bytes"],
                     [(tid or f"t{self.n:05d}", sid, tool, mcp, summary, at(minute), at(minute + 0.1) if done else None, error, subagent, size)])

    def title(self, sid, title):
        store.insert(self.c, "session_titles", ["session_id", "custom", "agent"], [(sid, title, None)])

    def payload(self, **kw):
        return context.payload(self.con.cursor(), prices=PRICES, today=TODAY, **kw)


def rich(b):
    """Every section populated and five tips firing (near_limit critical): foo (three Claude sessions), bar (two in range, one before),
    a Codex session, and an automated one."""
    # f1: a side request, a subagent request before the first turn, the 20,000 to 32,000 climb with a fall, three compactions, 85% of the window
    b.session("f1", "foo", 0, prompts=2, peak=170_000, compactions=3, compaction_at=50)
    b.turn("f1", -1, 5000, subagent=True)
    b.turn("f1", 0, 300)
    for i, prompt in enumerate([20_000, 30_000, 45_000, 25_000, 32_000]):
        b.turn("f1", 1 + i, prompt, cache_read=0 if i == 0 else prompt - 1_000)
    b.call("f1", "Read", 2, 120_000, summary="src/app.ts")
    b.call("f1", "Bash", 3, 250_000, summary="npm test")
    b.call("f1", "mcp__github__issue", 4, 1_000, mcp="github", summary="list")
    b.call("f1", "Read", 3, 500_000, subagent=True)
    b.call("f1", "Bash", 5, None, done=False)  # still running
    # f2: a model switch and then an expiry, the two cache breaks of the view
    b.session("f2", "foo", 60, prompts=2, peak=90_000)
    b.turn("f2", 60, 24_000)
    b.turn("f2", 61, 80_000, cache_read=76_000)
    b.turn("f2", 61.3, 85_000, model="m-b")
    b.turn("f2", 74, 90_000, model="m-b", cache_read=1_000)
    b.call("f2", "Grep", 62, 2_000, summary="TODO")
    # f3: resumed (a large start), a request on the long-prompt tier
    b.session("f3", "foo", 120, prompts=1, peak=150_000, peak_model="m-long")
    b.turn("f3", 120, 70_000, model="m-long", cache_read=70_000)
    b.turn("f3", 121, 150_000, model="m-long")
    b.session("b1", "bar", 180, peak=8_000)
    b.turn("b1", 180, 8_000)
    b.session("b2", "bar", 200, peak=9_000)
    b.turns("b2", [9_000, 12_000], minute=200)
    b.session("b3", "bar", 0, peak=7_000, base=T0 - timedelta(days=34))
    b.turn("b3", 0, 7_000, base=T0 - timedelta(days=34))
    # a Codex session: the window comes from the turn, the table has none
    b.session("x1", "codex-app", 240, source="codex", peak=26_000, peak_model="m-nowin", window=258_400)
    b.turns("x1", [15_000, 26_000], minute=240, model="m-nowin", cache_read=0)
    b.call("x1", "exec_command", 241, 300, summary="ls")
    b.call("x1", "apply_patch", 242, None, summary="a.py")
    b.title("f1", "Fix the importer")
    b.session("o1", "observer-sessions", 300, peak=3_000)
    b.turn("o1", 300, 3_000)


class ContextPayloadTest(unittest.TestCase):
    def test_views_run_and_bad_filters_raise(self):
        b = Builder(self)
        rich(b)
        for kw in (dict(), dict(range_days=7), dict(project="foo"), dict(source="codex"), dict(automated=True),
                   dict(project="bar", range_days=30, source="claude")):
            p = b.payload(**kw)
            self.assertEqual(sorted(p), sorted(["project", "range", "automated", "source", "start", "end", "projects", "project_order",
                                                "automated_file", "coverage", "starting", "growth", "fills", "cost", "tips"]), kw)
        with self.assertRaises(ValueError):
            b.payload(source="grok")
        with self.assertRaises(ValueError):
            b.payload(range_days=-1)
        self.assertEqual(b.payload(range_days=7)["start"], "2026-10-30")
        self.assertEqual(b.payload(source="codex")["starting"]["sessions"], 1)
        self.assertEqual(b.payload(automated=True)["coverage"]["sessions"], b.payload()["coverage"]["sessions"] + 1)
        self.assertEqual(b.payload(range_days=7)["coverage"]["sessions"], b.payload()["coverage"]["sessions"] - 1)  # b3 is before the range

    def test_rich_fixture_populates_every_section(self):
        b = Builder(self)
        rich(b)
        p = b.payload()
        self.assertGreaterEqual(len(p["tips"]), 2)
        self.assertEqual(p["tips"][0]["severity"], "critical")
        self.assertEqual([t["id"] for t in p["tips"]], ["near_limit", "frequent_compactions", "large_results", "cache_breaks", "long_tier"])
        self.assertTrue(p["starting"]["by_project"] and p["starting"]["trend"])
        self.assertTrue(p["growth"]["fill"] and p["growth"]["to_compaction"]["sessions"] == 1)
        self.assertTrue(p["fills"]["tools"] and p["fills"]["mcp"] and p["fills"]["largest"])
        self.assertTrue(p["cost"]["breaks"] and p["cost"]["long_cost"])
        self.assertFalse(p["coverage"]["rebuild_needed"])


class StartingTest(unittest.TestCase):
    def test_side_request_and_subagent_are_not_the_start(self):
        b = Builder(self)
        b.session("s1", "side", peak=31_000)
        b.turn("s1", -2, 5_000, subagent=True)
        b.turn("s1", 0, 300)  # a side request
        b.turn("s1", 1, 24_000)
        b.turn("s1", 2, 31_000)
        b.session("s2", "nothing", peak=300)
        b.turn("s2", 0, 300)  # no turn at all
        p = b.payload()
        self.assertEqual([(r["project"], r["sessions"], r["median"]) for r in p["starting"]["by_project"]], [("side", 1, 24_000)])
        self.assertEqual(p["coverage"]["sessions"], 2)

    def test_median_and_percentiles_per_project(self):
        b = Builder(self)
        for sid, project, start in (("a", "foo", 20_000), ("b", "foo", 24_000), ("c", "foo", 70_000), ("d", "bar", 8_000), ("e", "bar", 9_000)):
            b.session(sid, project, peak=start)
            b.turn(sid, 0, start)
        got = {r["project"]: r for r in b.payload()["starting"]["by_project"]}
        self.assertEqual((got["foo"]["median"], got["foo"]["sessions"], got["foo"]["p10"], got["foo"]["p90"]), (24_000, 3, 20_800, 60_800))
        self.assertEqual((got["bar"]["median"], got["bar"]["sessions"]), (8_500, 2))
        total = b.payload()["starting"]
        self.assertEqual((total["sessions"], total["median"]), (5, 20_000))

    def test_window_share_and_resolution(self):
        b = Builder(self)
        b.session("a", "claude-p", peak=50_000)  # the table: 200,000
        b.turn("a", 0, 50_000)
        b.session("c", "codex-p", source="codex", peak=60_000, peak_model="m-nowin", window=258_400)
        b.turn("c", 0, 60_000, model="m-nowin")
        b.session("d", "stated", source="codex", peak=60_000, peak_model="m-a", window=1_000_000)  # a stated window beats the table
        b.turn("d", 0, 60_000)
        b.session("n", "unknown", peak=60_000, peak_model="m-nowin")
        b.turn("n", 0, 60_000, model="m-nowin")
        p = b.payload()
        got = {r["project"]: r for r in p["starting"]["by_project"]}
        self.assertEqual((got["claude-p"]["window"], got["claude-p"]["window_share"]), (200_000, 0.25))
        self.assertEqual(got["codex-p"]["window"], 258_400)
        self.assertAlmostEqual(got["codex-p"]["window_share"], 60_000 / 258_400)
        self.assertEqual(got["stated"]["window"], 1_000_000)
        self.assertEqual((got["unknown"]["window"], got["unknown"]["window_share"]), (None, None))
        self.assertEqual((p["coverage"]["sessions"], p["coverage"]["with_window"]), (4, 3))

    def test_trend_by_week(self):
        b = Builder(self)
        for sid, days, start in (("a", 0, 10_000), ("b", 1, 20_000), ("c", 8, 30_000)):
            base = T0 + timedelta(days=days)
            b.session(sid, "foo", base=base, peak=start)
            b.turn(sid, 0, start, base=base)
        trend = b.payload()["starting"]["trend"]
        self.assertEqual([(r["week"], r["median"], r["sessions"]) for r in trend], [("2026-11-02", 15_000, 2), ("2026-11-09", 30_000, 1)])


class GrowthTest(unittest.TestCase):
    def test_curve_points_need_five_sessions(self):
        b = Builder(self)
        for i, n in enumerate((6, 6, 6, 4, 4)):
            b.session(f"s{i}", "foo", peak=10_000)
            b.turns(f"s{i}", [10_000 + 1_000 * k for k in range(n)], minute=0)
        b.session("other", "small", peak=9_000)  # two sessions: no curve of its own
        b.turns("other", [9_000, 9_500], minute=0)
        b.session("other2", "small", peak=9_000)
        b.turns("other2", [9_000, 9_500], minute=0)
        g = b.payload()["growth"]
        self.assertEqual([(p["turn"], p["sessions"]) for p in g["curve"]], [(1, 7), (2, 7), (3, 5), (4, 5)])
        self.assertEqual([(c["project"], c["sessions"], len(c["curve"])) for c in g["by_project_curves"]], [("foo", 5, 4)])
        self.assertEqual(g["curve"][0]["p25"] <= g["curve"][0]["median"] <= g["curve"][0]["p75"], True)

    def test_curve_stops_at_turn_100_and_projects_are_the_busiest(self):
        b = Builder(self)
        for i in range(6):  # projects p0 to p5 with 5 to 10 sessions: only the five busiest get a curve
            for j in range(5 + i):
                b.session(f"s{i}-{j}", f"p{i}", peak=5_000)
                b.turns(f"s{i}-{j}", [5_000, 6_000])
        g = b.payload()["growth"]
        self.assertEqual([(c["project"], c["sessions"]) for c in g["by_project_curves"]], [("p5", 10), ("p4", 9), ("p3", 8), ("p2", 7), ("p1", 6)])
        long = Builder(self)
        for i in range(5):
            long.session(f"l{i}", "long", peak=5_000)
            long.turns(f"l{i}", [5_000 + k for k in range(120)], step=0.5)
        self.assertEqual(long.payload()["growth"]["curve"][-1]["turn"], context.GROWTH_MAX_TURN)

    def test_added_per_prompt(self):
        b = Builder(self)
        b.session("a", "foo", prompts=2, peak=45_000)
        b.turns("a", [20_000, 30_000, 45_000, 25_000, 32_000])
        b.session("z", "helper", prompts=0, peak=90_000)  # a helper session with no prompt: only in the automated view, and left out
        b.turns("z", [20_000, 90_000])
        b.session("one", "foo", prompts=1, peak=20_000)  # one turn: nothing was added
        b.turn("one", 0, 20_000)
        p = b.payload(automated=True)
        self.assertEqual(p["growth"]["added_per_prompt"], 16_000)
        got = {r["project"]: r for r in p["growth"]["by_project"]}
        self.assertEqual(got["foo"]["added_per_prompt"], 16_000)
        self.assertIsNone(got["helper"]["added_per_prompt"])

    def test_turns_and_active_minutes_to_the_first_compaction(self):
        b = Builder(self)
        b.session("a", "foo", prompts=3, peak=100_000, compactions=2, compaction_at=225)
        first = [0] + list(range(1, 13)) + [30]  # 14 turns over 30 minutes
        second = [210, 212, 214, 216, 218, 220]  # after a 3-hour pause: 6 turns over 10 minutes
        for m in first + second:
            b.turn("a", m, 50_000)
        b.turn("a", 230, 50_000)  # after the compaction
        b.session("b", "foo", prompts=1, peak=10_000)  # never compacted
        b.turns("b", [10_000, 11_000])
        p = b.payload()
        tc = p["growth"]["to_compaction"]
        self.assertEqual((tc["sessions"], tc["turns"], tc["minutes"]), (1, 20, 40))
        got = {r["project"]: r for r in p["growth"]["by_project"]}["foo"]
        self.assertEqual((got["compacted"], got["turns_to_compaction"], got["minutes_to_compaction"]), (1, 20, 40))

    def test_no_compaction(self):
        b = Builder(self)
        b.session("a", "foo", peak=10_000)
        b.turns("a", [10_000, 12_000])
        tc = b.payload()["growth"]["to_compaction"]
        self.assertEqual((tc["sessions"], tc["turns"], tc["minutes"]), (0, None, None))

    def test_fill_bins_by_window(self):
        b = Builder(self)
        for i, peak in enumerate((40_000, 50_000, 100_000, 160_000, 180_000, 240_000)):  # 20%, 25%, 50%, 80%, 90%, 120%
            b.session(f"a{i}", "foo", peak=peak)
            b.turn(f"a{i}", 0, 5_000)
        b.session("c1", "cdx", source="codex", peak=100_000, peak_model="m-nowin", window=258_400)
        b.turn("c1", 0, 5_000, model="m-nowin")
        b.session("n1", "unknown", peak=100_000, peak_model="m-nowin")  # no window: not counted
        b.turn("n1", 0, 5_000, model="m-nowin")
        fill = b.payload()["growth"]["fill"]
        self.assertEqual([(f["window"], f["sessions"], f["bins"]) for f in fill], [(200_000, 6, [1, 1, 1, 1, 2]), (258_400, 1, [0, 1, 0, 0, 0])])
        for f in fill:
            self.assertEqual(sum(f["bins"]), f["sessions"])


class FillsTest(unittest.TestCase):
    def test_tools_mcp_and_subagent_bytes(self):
        b = Builder(self)
        b.session("a", "foo")
        b.turn("a", 0, 5_000)
        b.call("a", "Read", 1, 1_000)
        b.call("a", "Read", 2, 3)
        b.call("a", "Read", 3, None)  # no size: a call, not a sized one
        b.call("a", "Bash", 4, 20)
        b.call("a", "Edit", 5, None)  # no sized call at all: not a row
        b.call("a", "Agent", 6, 7)
        b.call("a", "Read", 7, 5_000, subagent=True)
        b.call("a", "mcp__srv__q", 8, 100, mcp="srv")
        f = b.payload()["fills"]
        self.assertEqual([(r["name"], r["calls"], r["with_bytes"], r["bytes"], r["est_tokens"]) for r in f["tools"]],
                         [("Read", 3, 2, 1_003, 250), ("mcp__srv__q", 1, 1, 100, 25), ("Bash", 1, 1, 20, 5), ("Agent", 1, 1, 7, 1)])
        self.assertEqual((f["tools"][0]["p50_bytes"], f["tools"][0]["max_bytes"]), (502, 1_000))  # (3 + 1,000) / 2, rounded
        self.assertEqual([(r["name"], r["bytes"]) for r in f["mcp"]], [("srv", 100)])
        self.assertEqual((f["main_bytes"], f["subagent_bytes"]), (1_130, 5_000))  # the subagent's 5,000 is in no tool row

    def test_largest_results(self):
        b = Builder(self)
        b.session("a", "foo")
        b.turn("a", 0, 5_000)
        b.session("b", "bar")
        b.turn("b", 0, 5_000)
        b.title("b", "The bar session")
        for i in range(24):
            b.call("a", "Read", i, 1_000 + i, tid=f"x{i:02d}")
        b.call("b", "Bash", 30, 900_000, summary="y" * 500, tid="big")
        b.call("a", "Read", 31, 1_010, tid="tie-b")  # the same size as x10: the tool_use_id breaks the tie
        b.call("a", "Read", 32, 5, tid="small")  # the 26th: left out
        b.call("a", "Read", 33, 9_999_999, subagent=True)  # not main thread
        largest = b.payload()["fills"]["largest"]
        self.assertEqual(len(largest), context.LARGEST_RESULTS)
        self.assertEqual((largest[0]["id"], largest[0]["bytes"], largest[0]["est_tokens"], largest[0]["title"], largest[0]["project"]),
                         ("big", 900_000, 225_000, "The bar session", "bar"))
        self.assertEqual(len(largest[0]["input"]), 200)
        ids = [r["id"] for r in largest]
        self.assertLess(ids.index("tie-b"), ids.index("x10"))  # "tie-b" < "x10"
        self.assertNotIn("small", ids)
        self.assertEqual([r["bytes"] for r in largest], sorted((r["bytes"] for r in largest), reverse=True))
        self.assertTrue(largest[0]["ts"].endswith("Z"))

    def test_coverage(self):
        b = Builder(self)
        b.session("a", "foo", compactions=1, compaction_at=5)
        b.turn("a", 0, 5_000)
        b.call("a", "Read", 1, 10)
        b.call("a", "Read", 2, None)  # completed without a size: a store from before the column
        b.call("a", "Bash", 3, None, done=False)  # still running: not counted
        b.call("a", "apply_patch", 4, None)  # never has a size
        b.call("a", "mcp__x__y", 5, None, error=True)  # a failed call may have no result
        c = b.payload()["coverage"]
        self.assertEqual((c["calls"], c["with_bytes"], c["rebuild_needed"]), (2, 1, True))
        b.c.execute("UPDATE tool_calls SET result_bytes = 5 WHERE tool = 'Read' AND result_bytes IS NULL")
        c = b.payload()["coverage"]
        self.assertEqual((c["calls"], c["with_bytes"], c["compacted"], c["with_first_compaction"], c["rebuild_needed"]), (2, 2, 1, 1, False))
        b.c.execute("UPDATE sessions SET first_compaction_ts = NULL")
        c = b.payload()["coverage"]
        self.assertEqual((c["compacted"], c["with_first_compaction"], c["rebuild_needed"]), (1, 0, True))


class CostTest(unittest.TestCase):
    def test_long_tier_matches_the_requests_cte(self):
        b = Builder(self)
        b.session("a", "foo", peak=150_000, peak_model="m-long")
        b.turn("a", 0, 150_000, model="m-long")  # long tier
        b.turn("a", 1, 50_000, model="m-long", cache_read=40_000)
        b.session("c", "bar", peak=130_000, peak_model="m-cheap")
        b.turn("c", 0, 130_000, model="m-cheap", output=0)
        p = b.payload()
        _, _, _, _, _, rq, rp = metrics.view("", 0, PRICES, TODAY)
        want = metrics.rows(b.con.cursor(), f"{rq} SELECT sum(cost) FILTER (WHERE lg) AS c, count(*) FILTER (WHERE lg) AS n, sum(cost) AS t, "
                                            f"sum(cost_cache_read) AS cr FROM rq", rp)[0]
        self.assertEqual((p["cost"]["long_requests"], p["cost"]["long_cost"], p["cost"]["cost"], p["cost"]["cache_read_cost"]),
                         (2, want["c"], want["t"], want["cr"]))
        self.assertEqual(want["n"], 2)
        by = {r["project"]: r for r in p["cost"]["by_project"]}
        self.assertEqual((by["bar"]["long_requests"], by["bar"]["long_cost"]), (1, 130_000 * 3 / 1e6))
        self.assertAlmostEqual(by["foo"]["cache_hit_ratio"], 40_000 / 200_000)
        self.assertAlmostEqual(p["cost"]["cache_hit_ratio"], 40_000 / 330_000)

    def test_unpriced_models_cost_nothing_known(self):
        b = Builder(self)
        b.session("a", "foo", peak=10_000, peak_model="m-unknown")
        b.turns("a", [10_000, 12_000], model="m-unknown")
        c = b.payload()["cost"]
        self.assertIsNone(c["cost"])
        self.assertIsNone(c["cache_read_cost"])
        self.assertIsNone(c["long_cost"])
        self.assertEqual(c["long_requests"], 0)
        self.assertIsNone(c["by_project"][0]["cost"])
        self.assertEqual(c["cache_hit_ratio"], 0)

    def test_cache_breaks_and_their_causes(self):
        b = Builder(self)
        b.session("sw", "foo", peak=85_000)
        b.turn("sw", 0, 80_000, cache_read=80_000)
        b.turn("sw", 20 / 60, 85_000, model="m-b")  # 20 seconds later on another model, 0 cache reads
        b.session("ex", "foo", peak=60_000)
        b.turn("ex", 0, 60_000)  # the first turn reads nothing and is never a break
        b.turn("ex", 12, 60_000, cache_read=1_000)  # 12 minutes later on the same model
        b.session("ot", "foo", peak=50_000)
        b.turn("ot", 0, 50_000, cache_read=50_000)
        b.turn("ot", 1, 50_000, cache_read=10_000)  # same model, a minute later, cache gone
        b.session("sm", "foo", peak=9_000)
        b.turn("sm", 0, 9_000, cache_read=9_000)
        b.turn("sm", 1, 9_000)  # 9,000 prompt tokens: too small
        b.session("ok", "foo", peak=80_000)
        b.turn("ok", 0, 80_000)
        b.turn("ok", 1, 80_000, cache_read=60_000)  # reads most of its prompt: no break
        c = b.payload()["cost"]
        got = {r["session_id"]: r for r in c["breaks"]}
        self.assertEqual(sorted(got), ["ex", "ot", "sw"])
        self.assertEqual(c["break_sessions"], 3)
        self.assertEqual((got["sw"]["breaks"], got["sw"]["model_switch"], got["sw"]["expired"], got["sw"]["other"]), (1, 1, 0, 0))
        self.assertEqual((got["ex"]["model_switch"], got["ex"]["expired"], got["ex"]["other"]), (0, 1, 0))
        self.assertEqual((got["ot"]["model_switch"], got["ot"]["expired"], got["ot"]["other"]), (0, 0, 1))
        self.assertEqual((got["sw"]["uncached_tokens"], got["ex"]["uncached_tokens"], got["ot"]["uncached_tokens"]), (85_000, 59_000, 40_000))
        self.assertAlmostEqual(got["sw"]["cost"], 85_000 * 3 / 1e6)  # m-b: 3 USD per million input tokens
        self.assertEqual([r["session_id"] for r in c["breaks"]], ["sw", "ex", "ot"])  # most uncached tokens first

    def test_break_counts_cache_writes_as_uncached(self):
        # Claude Code writes the re-read prompt back to the cache: only a few tokens are plain input
        b = Builder(self)
        b.session("cw", "foo", peak=60_000)
        b.turn("cw", 0, 60_000, cache_5m=60_000)
        b.turn("cw", 1, 60_000, cache_5m=59_990)
        got = b.payload()["cost"]["breaks"][0]
        self.assertEqual((got["breaks"], got["other"], got["uncached_tokens"]), (1, 1, 60_000))

    def test_one_hour_cache_does_not_expire_in_minutes(self):
        b = Builder(self)
        b.session("h1", "foo", peak=60_000)
        b.turn("h1", 0, 60_000, cache_1h=60_000)
        b.turn("h1", 12, 60_000, cache_1h=60_000)  # 12 minutes after a 1-hour write: the cache was still there
        b.session("h2", "foo", peak=60_000)
        b.turn("h2", 0, 60_000, cache_1h=60_000)
        b.turn("h2", 70, 60_000, cache_1h=60_000)  # 70 minutes: expired
        got = {r["session_id"]: r for r in b.payload()["cost"]["breaks"]}
        self.assertEqual((got["h1"]["expired"], got["h1"]["other"]), (0, 1))
        self.assertEqual((got["h2"]["expired"], got["h2"]["other"]), (1, 0))

    def test_break_cost_is_unknown_for_unpriced_models(self):
        b = Builder(self)
        b.session("a", "foo", peak=50_000, peak_model="m-unknown")
        b.turn("a", 0, 50_000, model="m-unknown", cache_read=50_000)
        b.turn("a", 1, 50_000, model="m-unknown")
        got = b.payload()["cost"]["breaks"][0]
        self.assertEqual((got["breaks"], got["uncached_tokens"], got["cost"]), (1, 50_000, None))


class TipsTest(unittest.TestCase):
    def tip(self, p, id):
        return next((t for t in p["tips"] if t["id"] == id), None)

    def test_nothing_fires(self):
        b = Builder(self)
        b.session("a", "foo", peak=20_000)
        b.turns("a", [8_000, 9_000, 10_000])
        self.assertEqual(b.payload()["tips"], [])
        self.assertEqual(Builder(self).payload()["tips"], [])  # an empty store too

    def test_order_is_critical_first_then_the_rules(self):
        b = Builder(self)
        for i, start in enumerate((42_000, 42_000, 44_000)):
            b.session(f"a{i}", "foo", peak=start)
            b.turn(f"a{i}", 0, start)
        b.session("n", "bar", peak=170_000, compactions=3)
        b.turn("n", 0, 10_000)
        p = b.payload()
        self.assertEqual([(t["id"], t["severity"]) for t in p["tips"]],
                         [("near_limit", "critical"), ("large_start", "warn"), ("frequent_compactions", "warn")])

    def test_large_start_names_projects_and_called_servers(self):
        b = Builder(self)
        for sid, start in (("a", 29_000), ("b", 42_000), ("c", 42_000), ("d", 44_000)):
            b.session(sid, "foo", int(start / 1000), peak=start)
            b.turn(sid, int(start / 1000), start)
        b.session("e", "bar", peak=8_000)
        b.turn("e", 0, 8_000)
        for i in range(4):
            b.call("b", "mcp__github__x", i, 10, mcp="github")
        for i in range(2):
            b.call("c", "mcp__figma__x", i, 10, mcp="figma")
        b.call("e", "mcp__other__x", 0, 10, mcp="other")  # in a project below the threshold
        b.call("b", "mcp__sub__x", 5, 10, mcp="sub", subagent=True)
        t = self.tip(b.payload(), "large_start")
        self.assertEqual((t["severity"], t["matched"]), ("warn", 3))
        ev = {e["label"]: e["value"] for e in t["evidence"]}
        self.assertIn("42,000 tokens", ev["foo"])
        self.assertNotIn("bar", ev)
        self.assertEqual(ev["MCP servers called (fewest calls first)"], "figma 2, github 4")
        self.assertIn("never called leave no trace in transcripts", t["advice"])
        self.assertIn("CLAUDE.md", t["advice"])
        self.assertEqual({s["session_id"] for s in t["sessions"]}, {"b", "c", "d"})  # starts of 30,000 or more

    def test_large_start_names_the_five_largest_projects(self):
        b = Builder(self)
        for i in range(7):
            b.session(f"s{i}", f"p{i}", peak=40_000 + i * 1000)
            b.turn(f"s{i}", 0, 40_000 + i * 1000)
        ev = [e["label"] for e in self.tip(b.payload(), "large_start")["evidence"]]
        self.assertEqual(ev[:6], ["p6", "p5", "p4", "p3", "p2", "Other projects"])

    def test_frequent_compactions(self):
        b = Builder(self)
        b.session("a", "foo", peak=10_000, compactions=3, compaction_at=20)
        b.turns("a", [10_000, 11_000, 12_000])
        b.session("b", "foo", peak=10_000, compactions=2)
        b.turn("b", 0, 10_000)
        t = self.tip(b.payload(), "frequent_compactions")
        self.assertEqual((t["severity"], t["matched"], [s["session_id"] for s in t["sessions"]]), ("warn", 1, ["a"]))
        ev = {e["label"]: e["value"] for e in t["evidence"]}
        self.assertEqual((ev["Sessions"], ev["Most compactions in one session"]), ("1", "3"))
        self.assertIn("Median turns before the first compaction", ev)
        self.assertIn("`/clear`", t["advice"])
        b.session("c", "foo", peak=10_000, compactions=6)
        b.turn("c", 0, 10_000)
        self.assertEqual(self.tip(b.payload(), "frequent_compactions")["severity"], "critical")

    def test_near_limit(self):
        b = Builder(self)
        b.session("a", "foo", peak=170_000)  # 85% of 200,000
        b.turn("a", 0, 10_000)
        b.session("b", "foo", peak=150_000)  # 75%
        b.turn("b", 0, 10_000)
        b.session("c", "foo", peak=900_000, peak_model="m-nowin")  # no window: never near it
        b.turn("c", 0, 10_000, model="m-nowin")
        t = self.tip(b.payload(), "near_limit")
        self.assertEqual((t["severity"], t["matched"], [s["session_id"] for s in t["sessions"]]), ("critical", 1, ["a"]))
        ev = {e["label"]: e["value"] for e in t["evidence"]}
        self.assertEqual((ev["Sessions"], ev["Highest share of the window"], ev["Windows"]), ("1", "85%", "200,000 tokens"))
        self.assertIn("new session", t["advice"])

    def test_large_results(self):
        b = Builder(self)
        b.session("a", "foo")
        b.turn("a", 0, 5_000)
        b.call("a", "Bash", 1, 250_000)
        b.call("a", "Read", 2, 99_999)  # under the line
        b.call("a", "Bash", 3, 900_000, subagent=True)  # not the main thread
        t = self.tip(b.payload(), "large_results")
        self.assertEqual((t["severity"], t["matched"]), ("warn", 1))
        self.assertIn("`head`, `tail` or `grep`", t["advice"])
        self.assertNotIn("offset", t["advice"])  # no Read result among them
        self.assertIn("subagent", t["advice"])
        ev = {e["label"]: e["value"] for e in t["evidence"]}
        self.assertEqual((ev["Results"], ev["Tools"], ev["Estimated tokens"]), ("1", "Bash 1", "about 62,500 tokens (estimate)"))
        b.call("a", "Read", 4, 400_000)
        t = self.tip(b.payload(), "large_results")
        self.assertEqual(t["severity"], "critical")
        self.assertIn("`offset` and `limit`", t["advice"])
        b.call("a", "mcp__srv__q", 5, 150_000, mcp="srv")
        ev = {e["label"]: e["value"] for e in self.tip(b.payload(), "large_results")["evidence"]}
        self.assertEqual(ev["MCP servers"], "srv 1")

    def test_cache_breaks(self):
        b = Builder(self)
        b.session("a", "foo", peak=90_000)
        b.turn("a", 0, 80_000, cache_read=80_000)
        b.turn("a", 0.3, 85_000, model="m-b")  # a model switch
        b.turn("a", 0.6, 85_000, model="m-a")  # another
        b.turn("a", 14, 90_000, model="m-a", cache_read=1_000)  # an expiry
        b.session("b", "foo", peak=90_000)
        b.turn("b", 0, 80_000, cache_read=80_000)
        b.turn("b", 0.3, 85_000, model="m-b")  # one break: no tip for it
        p = b.payload()
        t = self.tip(p, "cache_breaks")
        self.assertEqual((t["severity"], t["matched"], [s["session_id"] for s in t["sessions"]]), ("warn", 1, ["a"]))
        ev = {e["label"]: e["value"] for e in t["evidence"]}
        self.assertEqual((ev["Sessions"], ev["Breaks by cause"]), ("1", "2 model switches, 1 expired, 0 other"))
        self.assertEqual(ev["Uncached tokens"], f"{85_000 + 85_000 + 89_000:,} tokens")
        self.assertIn("one model", t["advice"])
        self.assertIn("Cache-hit ratio of the view", ev)
        only = Builder(self)
        only.session("b", "foo", peak=90_000)
        only.turn("b", 0, 80_000, cache_read=80_000)
        only.turn("b", 0.3, 85_000, model="m-b")
        self.assertIsNone(self.tip(only.payload(), "cache_breaks"))

    def test_cache_breaks_advice_follows_the_cause(self):
        b = Builder(self)
        b.session("a", "foo", peak=90_000)
        b.turn("a", 0, 80_000, cache_read=80_000)
        b.turn("a", 10, 85_000)
        b.turn("a", 20, 85_000)
        t = self.tip(b.payload(), "cache_breaks")
        self.assertIn("cache lifetime", t["advice"])
        self.assertNotIn("one model", t["advice"])

    def test_long_tier(self):
        b = Builder(self)
        b.session("a", "foo", peak_model="m-long", peak=1_000_000)
        b.turn("a", 0, 1_000_000, model="m-long", output=0)  # long tier at 10 per million: $10
        b.session("c", "foo", peak=40_000_000, peak_model="m-a")
        b.turn("c", 0, 40_000_000, output=0)  # $40 at base
        p = b.payload()
        self.assertAlmostEqual(p["cost"]["cost"], 50)
        t = self.tip(p, "long_tier")
        ev = " ".join(f"{e['label']} {e['value']}" for e in t["evidence"])
        self.assertIn("$10", ev)
        self.assertIn("20%", ev)
        self.assertIn("m-long 100,000 tokens", ev)
        self.assertEqual((t["severity"], t["matched"], [s["session_id"] for s in t["sessions"]]), ("warn", 1, ["a"]))
        self.assertIn("`/compact`", t["advice"])
        small = Builder(self)
        small.session("a", "foo", peak_model="m-cheap", peak=133_000)
        small.turn("a", 0, 133_000, model="m-cheap")  # $0.40
        self.assertIsNone(self.tip(small.payload(), "long_tier"))

    def test_matching_sessions_are_the_newest_twenty(self):
        b = Builder(self)
        for i in range(25):
            b.session(f"s{i:02d}", "foo", i, peak=10_000, compactions=3)
            b.turn(f"s{i:02d}", i, 10_000)
        b.title("s24", "The newest")
        b.session("quiet", "foo", 100, peak=10_000, compactions=1)
        b.turn("quiet", 100, 10_000)
        t = self.tip(b.payload(), "frequent_compactions")
        self.assertEqual((len(t["sessions"]), t["matched"]), (20, 25))
        self.assertEqual([s["session_id"] for s in t["sessions"]][:2], ["s24", "s23"])
        self.assertEqual(t["sessions"][-1]["session_id"], "s05")
        self.assertEqual(t["sessions"][0]["title"], "The newest")
        self.assertEqual(sorted(t["sessions"][0]), ["first_ts", "project", "session_id", "source", "title"])


if __name__ == "__main__":
    unittest.main()
