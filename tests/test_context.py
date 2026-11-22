import os
import shutil
import tempfile
import unittest
from datetime import date, datetime, timedelta
from unittest import mock

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


def metrics_monday(day):
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


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

    def call(self, sid, tool, minute, size=None, mcp=None, subagent=False, summary="", error=False, done=True, tid=None, skill=None):
        self.n += 1
        store.insert(self.c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                                            "is_error", "subagent", "result_bytes"],
                     [(tid or f"t{self.n:05d}", sid, tool, mcp, skill, summary, at(minute), at(minute + 0.1) if done else None, error, subagent,
                       size)])

    def title(self, sid, title):
        store.insert(self.c, "session_titles", ["session_id", "custom", "agent"], [(sid, title, None)])

    def snapshot(self, uuid, project="foo", ts="2026-11-04 08:00:00", sid="m1", model="m-a", version="2.1.325", window=200_000,
                 categories=(("System prompt", 4000, "used"), ("Messages", 100, "used"), ("Free space", 190_000, "free")), parts=()):
        """A /context snapshot: categories are (name, tokens, state); parts are (kind, name, detail, tokens)."""
        store.insert(self.c, "context_snapshots", ["uuid", "session_id", "ts", "project", "cwd", "version", "model", "context_window", "total"],
                     [(uuid, sid, ts, project, f"/w/{project}", version, model, window, 1000)])
        rows = [("category", n, None, st, t) for n, t, st in categories] + [(k, n, d, None, t) for k, n, d, t in parts]
        store.insert(self.c, "context_parts", ["uuid", "seq", "kind", "name", "detail", "state", "tokens"],
                     [(uuid, i, *r) for i, r in enumerate(rows)])

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
    # baz: five more sessions on other days, so the charts have material: more weeks and days, a compaction, a break and many tools
    for i, (days, peak, start) in enumerate(((-2, 60_000, 12_000), (-3, 120_000, 18_000), (-9, 30_000, 14_000), (-10, 45_000, 22_000), (-16, 150_000, 16_000))):
        base = T0 + timedelta(days=days)
        sid = f"z{i}"
        b.session(sid, "baz", 0, prompts=2, peak=peak, compactions=1 if i == 1 else 0, compaction_at=8 if i == 1 else None, base=base)
        for k, prompt in enumerate([start, start + 6_000, start + 12_000, peak]):
            b.turn(sid, k, prompt, base=base, cache_read=0 if k == 0 else prompt - 1_000, cache_5m=prompt if k == 0 else 0)
        if i == 0:
            b.turn(sid, 5, peak, base=base, model="m-b")  # a model switch
    for i, (tool, mcp) in enumerate((("Glob", None), ("Edit", None), ("Write", None), ("WebFetch", None), ("Task", None), ("LS", None), ("NotebookEdit", None),
                                    ("mcp__linear__issue", "linear"), ("mcp__figma__node", "figma"))):
        b.call("z0" if i % 2 else "z1", tool, 1 + i, 3_000 * (i + 1) + 7 * i, mcp=mcp, summary="x")


class ContextPayloadTest(unittest.TestCase):
    def test_rich_fixture_populates_every_section_and_every_view_runs(self):
        # The key set and the refusals of a bad source or range: test_app.AppTest.test_context, at the API.
        b = Builder(self)
        rich(b)
        self.assertEqual(b.payload(project="foo")["coverage"]["sessions"], 3)
        self.assertEqual(b.payload(project="bar", range_days=30, source="claude")["coverage"]["sessions"], 2)  # b3 is before the range
        self.assertEqual(b.payload(range_days=7)["start"], "2026-10-30")
        self.assertEqual(b.payload(source="codex")["starting"]["sessions"], 1)
        codex = b.payload(source="codex")  # the map and the cache series cover a Codex session as they do a Claude Code one
        self.assertEqual([(p["session_id"], p["source"], p["window"]) for p in codex["sessions_map"]["points"]], [("x1", "codex", 258_400)])
        self.assertTrue(codex["cost"]["series"]["rows"])
        self.assertTrue(all(r["input"] + r["cache_read"] + r["cache_write"] > 0 for r in codex["cost"]["series"]["rows"]))
        self.assertEqual(b.payload(automated=True)["coverage"]["sessions"], b.payload()["coverage"]["sessions"] + 1)
        self.assertEqual(b.payload(range_days=7)["coverage"]["sessions"], b.payload()["coverage"]["sessions"] - 4)  # b3 and three baz sessions are before the range
        # The default view: every section the page tests render (test_web_fixtures writes it) is populated.
        p = b.payload()
        self.assertGreaterEqual(len(p["tips"]), 2)
        self.assertEqual(p["tips"][0]["severity"], "critical")
        self.assertEqual([t["id"] for t in p["tips"]], ["near_limit", "frequent_compactions", "large_results", "cache_breaks", "long_tier"])
        self.assertTrue(p["starting"]["by_project"] and p["starting"]["trend"])
        self.assertTrue(p["growth"]["fill"] and p["growth"]["to_compaction"]["sessions"] == 2)
        self.assertTrue(p["fills"]["tools"] and p["fills"]["mcp"] and p["fills"]["largest"])
        self.assertTrue(p["cost"]["breaks"] and p["cost"]["long_cost"])
        self.assertFalse(p["coverage"]["rebuild_needed"])
        # what the chart builders rely on
        self.assertEqual([f["window"] for f in p["growth"]["fill"]], [200_000, 258_400, 2_000_000])
        self.assertGreaterEqual(len(p["starting"]["trend"]), 2)
        self.assertTrue(p["growth"]["share_curve"] and all(r["p25"] <= r["median"] <= r["p75"] for r in p["growth"]["share_curve"]))
        self.assertGreaterEqual(len(p["sessions_map"]["points"]), 10)
        self.assertTrue(any(pt["compactions"] for pt in p["sessions_map"]["points"]))
        self.assertGreaterEqual(len(p["cost"]["series"]["rows"]), 3)
        self.assertTrue(any(r["model_switch"] + r["expired"] + r["other"] for r in p["cost"]["series"]["rows"]))
        self.assertGreater(len(p["fills"]["tools"]), 10)
        self.assertGreaterEqual(len(p["fills"]["mcp"]), 2)


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

    def test_grok_window_is_the_compaction_notice_s_else_the_table_s(self):
        b = Builder(self)
        b.session("g1", "stated", source="grok", peak=60_000, peak_model="m-long", window=256_000, compactions=1)
        b.turn("g1", 0, 60_000, model="m-long")
        b.session("g2", "table", source="grok", peak=60_000, peak_model="m-long")  # no compaction: the table's 2,000,000
        b.turn("g2", 0, 60_000, model="m-long")
        got = {r["project"]: r["window"] for r in b.payload(source="grok")["starting"]["by_project"]}
        self.assertEqual(got, {"stated": 256_000, "table": 2_000_000})

    def test_window_is_the_most_common_known_window(self):
        b = Builder(self)
        for sid, peak_model, window in (("a", "m-a", None), ("b", "m-a", None), ("c", "m-nowin", 258_400), ("d", "m-nowin", None)):
            b.session(sid, "foo", peak=50_000, peak_model=peak_model, window=window)
            b.turn(sid, 0, 50_000, model=peak_model)
        self.assertEqual(b.payload()["starting"]["window"], 200_000)  # two sessions at the table's 200,000; the others are unknown or 258,400

    def test_trend_by_week_with_its_quartiles(self):
        b = Builder(self)
        for sid, days, start in (("a", 0, 10_000), ("b", 1, 20_000), ("d", 0, 30_000), ("e", 1, 40_000), ("c", 8, 30_000)):
            base = T0 + timedelta(days=days)
            b.session(sid, "foo", base=base, peak=start)
            b.turn(sid, 0, start, base=base)
        trend = b.payload()["starting"]["trend"]
        self.assertEqual([(r["week"], r["p25"], r["median"], r["p75"], r["sessions"]) for r in trend],
                         [("2026-11-02", 17_500, 25_000, 32_500, 4), ("2026-11-09", 30_000, 30_000, 30_000, 1)])


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
        b.session("b", "foo", prompts=1, peak=10_000)  # never compacted
        b.turns("b", [10_000, 11_000])
        tc = b.payload()["growth"]["to_compaction"]
        self.assertEqual((tc["sessions"], tc["turns"], tc["minutes"]), (0, None, None))  # no compaction yet
        b.session("a", "foo", prompts=3, peak=100_000, compactions=2, compaction_at=225)
        first = [0] + list(range(1, 13)) + [30]  # 14 turns over 30 minutes
        second = [210, 212, 214, 216, 218, 220]  # after a 3-hour pause: 6 turns over 10 minutes
        for m in first + second:
            b.turn("a", m, 50_000)
        b.turn("a", 230, 50_000)  # after the compaction
        p = b.payload()
        tc = p["growth"]["to_compaction"]
        self.assertEqual((tc["sessions"], tc["turns"], tc["minutes"]), (1, 20, 40))
        got = {r["project"]: r for r in p["growth"]["by_project"]}["foo"]
        self.assertEqual((got["compacted"], got["turns_to_compaction"], got["minutes_to_compaction"]), (1, 20, 40))

    def test_share_curve_is_the_fraction_of_the_window_over_sessions_with_a_window(self):
        b = Builder(self)
        for i in range(5):  # five sessions with a 200,000 window; the 5th has none
            b.session(f"s{i}", "foo", peak=150_000, peak_model="m-a" if i < 4 else "m-nowin")
            b.turns(f"s{i}", [10_000, 150_000], model="m-a" if i < 4 else "m-nowin")
        g = b.payload()["growth"]
        self.assertEqual([(p["turn"], p["sessions"]) for p in g["curve"]], [(1, 5), (2, 5)])  # the token curve has all five
        self.assertEqual(g["share_curve"], [])  # four sessions with a window: under the minimum
        b.session("s5", "foo", peak=150_000)
        b.turns("s5", [10_000, 150_000])
        g = b.payload()["growth"]
        self.assertEqual([(p["turn"], p["median"], p["sessions"]) for p in g["share_curve"]], [(1, 0.05, 5), (2, 0.75, 5)])
        self.assertEqual([(p["turn"], p["sessions"]) for p in g["curve"]], [(1, 6), (2, 6)])
        self.assertEqual([(c["project"], len(c["share_curve"])) for c in g["by_project_curves"]], [("foo", 2)])
        self.assertEqual(g["by_project_curves"][0]["share_curve"][1]["p75"], 0.75)

    def test_peak_median_and_share_of_the_window(self):
        b = Builder(self)
        b.session("c", "foo", peak=150_000, peak_model="m-nowin")  # no window: counts for the median only
        b.turn("c", 0, 5_000, model="m-nowin")
        self.assertEqual(b.payload()["growth"]["peak"], dict(sessions=1, median=150_000, window_share=None))  # no known window
        for sid, peak in (("a", 50_000), ("b", 100_000)):  # 25% and 50% of 200,000
            b.session(sid, "foo", peak=peak)
            b.turn(sid, 0, 5_000)
        b.session("n", "foo", peak=None)  # no peak: not counted
        b.turn("n", 0, 5_000)
        peak = b.payload()["growth"]["peak"]
        self.assertEqual(peak["sessions"], 3)
        self.assertEqual(peak["median"], 100_000)
        self.assertAlmostEqual(peak["window_share"], 0.375)

    def test_grids_rank_and_measure_the_sessions_with_a_start_a_window_and_a_peak(self):
        b = Builder(self)
        # foo: three sessions with a start, a window and a peak (10%/40%, 20%/50%, 30%/60% of 200,000).
        for sid, start, peak in (("a", 20_000, 80_000), ("b", 40_000, 100_000), ("c", 60_000, 120_000)):
            b.session(sid, "foo", peak=peak)
            b.turn(sid, 0, start)
        # bar: five measured starts, but only one with a known window and a peak; the others take no part.
        b.session("w", "bar", peak=150_000)
        b.turn("w", 0, 100_000)
        for i in range(2):
            b.session(f"nw{i}", "bar", peak=10_000, peak_model="m-nowin")
            b.turn(f"nw{i}", 0, 9_000, model="m-nowin")
            b.session(f"np{i}", "bar", peak=None)
            b.turn(f"np{i}", 0, 9_000)
        rows = b.payload()["grids"]
        self.assertEqual([(r["project"], r["sessions"], r["window"]) for r in rows], [("foo", 3, 200_000), ("bar", 1, 200_000)])
        foo, bar = rows
        self.assertEqual((foo["start"], foo["peak"]), (40_000, 100_000))
        self.assertAlmostEqual(foo["start_share"], 0.2)
        self.assertAlmostEqual(foo["peak_share"], 0.5)
        self.assertEqual((bar["start"], bar["peak"]), (100_000, 150_000))  # the one eligible session's, not the median of all five starts

    def test_fill_bins_by_window(self):
        b = Builder(self)
        # 20%, 25%, 50%, 79%, 80%, 81%, 90%, 120%: 79% and 81% fall either side of the warning (the spec's scenario)
        for i, peak in enumerate((40_000, 50_000, 100_000, 158_000, 160_000, 162_000, 180_000, 240_000)):
            b.session(f"a{i}", "foo", peak=peak)
            b.turn(f"a{i}", 0, 5_000)
        b.session("c1", "cdx", source="codex", peak=100_000, peak_model="m-nowin", window=258_400)
        b.turn("c1", 0, 5_000, model="m-nowin")
        b.session("n1", "unknown", peak=100_000, peak_model="m-nowin")  # no window: not counted
        b.turn("n1", 0, 5_000, model="m-nowin")
        fill = b.payload()["growth"]["fill"]
        self.assertEqual([(f["window"], f["sessions"], f["bins"]) for f in fill], [(200_000, 8, [1, 1, 2, 2, 2]), (258_400, 1, [0, 1, 0, 0, 0])])
        for f in fill:
            self.assertEqual(sum(f["bins"]), f["sessions"])


class SessionsMapTest(unittest.TestCase):
    def test_eligible_sessions_only_with_their_title(self):
        b = Builder(self)
        b.session("ok", "foo", peak=100_000, compactions=2)
        b.turns("ok", [10_000, 20_000, 30_000])
        b.title("ok", "A title")
        b.session("nostart", "foo", peak=100_000)
        b.turn("nostart", 0, 300)  # no turn: no measured start
        b.session("nowin", "foo", peak=100_000, peak_model="m-nowin")
        b.turn("nowin", 0, 10_000, model="m-nowin")
        b.session("nopeak", "foo", peak=None)
        b.turn("nopeak", 0, 10_000)
        m = b.payload()["sessions_map"]
        self.assertEqual(m["total"], 1)
        self.assertEqual(m["points"], [dict(session_id="ok", project="foo", source="claude", first_ts="2026-11-04T09:00:00.000Z", start=10_000, peak=100_000,
                                            window=200_000, turns=3, compactions=2, title="A title")])
        self.assertEqual(Builder(self).payload()["sessions_map"], dict(total=0, points=[]))

    def test_the_newest_points_are_kept_and_total_counts_all(self):
        b = Builder(self)
        for i in range(3):
            b.session(f"s{i}", "foo", i, peak=100_000)
            b.turn(f"s{i}", i, 10_000)
        old, context.SESSION_POINTS = context.SESSION_POINTS, 2
        self.addCleanup(setattr, context, "SESSION_POINTS", old)
        m = b.payload()["sessions_map"]
        self.assertEqual(([p["session_id"] for p in m["points"]], m["total"]), (["s2", "s1"], 3))


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
        # p50 (3 + 1,000) / 2 and p95 3 + 0.95 * 997 (quantile_cont), rounded; quantile_disc or p90 would give 1,000 or 900
        self.assertEqual((f["tools"][0]["p50_bytes"], f["tools"][0]["p95_bytes"], f["tools"][0]["max_bytes"]), (502, 950, 1_000))
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
        b.session("a", "foo", peak=50_000, peak_model="m-unknown")
        b.turn("a", 0, 50_000, model="m-unknown", cache_read=50_000)
        b.turn("a", 1, 50_000, model="m-unknown")  # a break
        c = b.payload()["cost"]
        self.assertIsNone(c["cost"])
        self.assertIsNone(c["cache_read_cost"])
        self.assertIsNone(c["long_cost"])
        self.assertEqual(c["long_requests"], 0)
        self.assertIsNone(c["by_project"][0]["cost"])
        self.assertEqual(c["cache_hit_ratio"], 0.5)  # tokens, priced or not
        # The break's cost comes from another query than the view's: unknown too.
        self.assertEqual([(r["breaks"], r["uncached_tokens"], r["cost"]) for r in c["breaks"]], [(1, 50_000, None)])

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

    def test_series_by_day_adds_up_to_the_cache_hit_ratio(self):
        b = Builder(self)
        b.session("a", "foo", peak=90_000)
        b.turn("a", 0, 80_000, cache_read=80_000)
        b.turn("a", 0.3, 85_000, model="m-b")  # a model switch
        b.turn("a", 0.6, 85_000, model="m-a")  # another
        b.turn("a", 14, 90_000, model="m-a", cache_read=1_000)  # an expiry
        b.session("b", "foo", 0, peak=60_000, base=T0 + timedelta(days=1))
        b.turn("b", 0, 60_000, base=T0 + timedelta(days=1), cache_5m=60_000)
        b.turn("b", 1, 60_000, base=T0 + timedelta(days=1), cache_read=50_000, cache_5m=10_000)
        c = b.payload()["cost"]
        self.assertEqual(c["series"]["bucket"], "day")
        rows = c["series"]["rows"]
        self.assertEqual([r["day"] for r in rows], ["2026-11-04", "2026-11-05"])
        self.assertEqual((rows[0]["model_switch"], rows[0]["expired"], rows[0]["other"]), (2, 1, 0))
        self.assertEqual((rows[1]["model_switch"], rows[1]["expired"], rows[1]["other"]), (0, 0, 0))
        self.assertEqual((rows[1]["input"], rows[1]["cache_read"], rows[1]["cache_write"]), (0, 50_000, 70_000))
        reads, prompt = sum(r["cache_read"] for r in rows), sum(r["input"] + r["cache_read"] + r["cache_write"] for r in rows)
        self.assertAlmostEqual(reads / prompt, c["cache_hit_ratio"])
        self.assertEqual(sum(r["model_switch"] + r["expired"] + r["other"] for r in rows), sum(x["breaks"] for x in c["breaks"]))

    def test_series_is_weekly_for_an_old_view(self):
        b = Builder(self)
        for i, days in enumerate((-200, -199, -190)):
            base = T0 + timedelta(days=days)
            b.session(f"s{i}", "foo", base=base, peak=10_000)
            b.turn(f"s{i}", 0, 10_000, base=base)
        s = b.payload()["cost"]["series"]
        self.assertEqual(s["bucket"], "week")
        self.assertTrue(all(r["day"] == metrics_monday(r["day"]) for r in s["rows"]))
        self.assertEqual(sum(r["input"] for r in s["rows"]), 30_000)
        self.assertEqual(Builder(self).payload()["cost"]["series"], dict(bucket="day", rows=[]))

    def test_cache_lifetime_follows_the_source(self):
        # Codex's cache lives 30 minutes, Claude Code's 5: the same pause is an expiry for one and not the other
        # Grok's logs state no lifetime: a Grok break is never an expiry, even 2 hours on, but a model switch still is one
        b = Builder(self)
        for sid, source, pause in (("cx10", "codex", 10), ("cx40", "codex", 40), ("cc10", "claude", 10), ("cc40", "claude", 40),
                                   ("gk120", "grok", 120)):
            b.session(sid, "foo", peak=60_000, source=source)
            b.turn(sid, 0, 60_000, cache_read=60_000)
            b.turn(sid, pause, 60_000, cache_read=1_000)
        b.session("gksw", "foo", peak=60_000, source="grok")
        b.turn("gksw", 0, 60_000, cache_read=60_000)
        b.turn("gksw", 120, 60_000, cache_read=1_000, model="m-b")
        # A 1-hour write lives an hour: 12 minutes on, the cache was still there; 70 minutes on, it expired.
        for sid, pause in (("h12", 12), ("h70", 70)):
            b.session(sid, "foo", peak=60_000)
            b.turn(sid, 0, 60_000, cache_1h=60_000)
            b.turn(sid, pause, 60_000, cache_1h=60_000)
        got = {r["session_id"]: (r["model_switch"], r["expired"], r["other"]) for r in b.payload()["cost"]["breaks"]}
        self.assertEqual(got, {"cx10": (0, 0, 1), "cx40": (0, 1, 0), "cc10": (0, 1, 0), "cc40": (0, 1, 0), "gk120": (0, 0, 1), "gksw": (1, 0, 0),
                               "h12": (0, 0, 1), "h70": (0, 1, 0)})



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
        self.assertIn("Median turns before the first compaction (compacted sessions with a known first compaction)", ev)
        self.assertIn("`/clear`", t["advice"])
        b.session("c", "foo", peak=10_000, compactions=6)
        b.turn("c", 0, 10_000)
        self.assertEqual(self.tip(b.payload(), "frequent_compactions")["severity"], "critical")

    def test_advice_names_the_commands_of_the_matching_sessions_agents(self):
        b = Builder(self)
        b.session("x", "cdx", source="codex", peak=10_000, compactions=3, window=258_400)
        b.turn("x", 0, 40_000)
        b.session("n", "foo", peak=10_000)  # a Claude Code session that matches no tip
        b.turn("n", 0, 10_000)
        for advice in (self.tip(b.payload(), "frequent_compactions")["advice"], self.tip(b.payload(source="codex"), "frequent_compactions")["advice"]):
            self.assertIn("`/new`", advice)
            self.assertIn("`/compact`", advice)
            self.assertNotIn("`/clear`", advice)
            self.assertNotIn("subagent", advice)
        start = self.tip(b.payload(source="codex"), "large_start")["advice"]
        self.assertIn("`codex mcp list`", start)
        self.assertNotIn("claude mcp list", start)
        self.assertNotIn("CLAUDE.md", start)
        b.session("c", "foo", peak=10_000, compactions=4)  # a Claude Code session joins the matching ones
        b.turn("c", 0, 10_000)
        both = self.tip(b.payload(), "frequent_compactions")["advice"]
        self.assertIn("`/clear` in Claude Code, `/new` in Codex", both)
        self.assertEqual(self.tip(b.payload(source="claude"), "frequent_compactions")["advice"].count("`/new`"), 0)

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

    def test_near_limit_counts_a_stated_window(self):
        b = Builder(self)
        b.session("x", "cdx", source="codex", peak=232_560, peak_model="m-long", window=258_400)  # 90% of 258,400, 12% of the table's
        b.turn("x", 0, 10_000, model="m-long")
        b.session("g", "grk", source="grok", peak=230_400, peak_model="m-long", window=256_000)  # 90% of the window its notice stated
        b.turn("g", 0, 10_000, model="m-long")
        t = self.tip(b.payload(), "near_limit")
        self.assertEqual((t["matched"], {e["label"]: e["value"] for e in t["evidence"]}["Highest share of the window"]), (2, "90%"))

    def test_advice_for_grok_sessions_names_no_agent_s_file_or_command(self):
        b = Builder(self)
        b.session("g", "grk", source="grok", peak=10_000, compactions=3)
        b.turn("g", 0, 40_000)
        b.call("g", "run_terminal_command", 1, 250_000)
        p = b.payload()
        named = ("CLAUDE.md", "AGENTS.md", "claude mcp list", "codex mcp list", "/clear", "/new", "subagent")
        for id in ("large_start", "frequent_compactions", "large_results"):
            advice = self.tip(p, id)["advice"]
            for name in named:
                self.assertNotIn(name, advice, id)
        self.assertIn("Trim the instruction files and review the configured MCP servers", self.tip(p, "large_start")["advice"])
        compact = self.tip(p, "frequent_compactions")["advice"]
        self.assertIn("Start a new session between tasks", compact)
        self.assertIn("compact before the context fills", compact)
        self.assertEqual(self.tip(p, "large_results")["advice"], "Pipe shell output through `head`, `tail` or `grep`.")
        b.session("v", "grk", source="grok")  # a Grok tool with no remedy of its own
        b.turn("v", 0, 5_000)
        b.call("v", "view_image", 1, 250_000)
        self.assertIn("Ask for a smaller part", self.tip(b.payload(), "large_results")["advice"])

    def test_advice_for_claude_code_and_grok_sessions_names_claude_code_s_commands_for_it(self):
        b = Builder(self)
        for sid, source in (("c", "claude"), ("g", "grok")):
            b.session(sid, "foo", source=source, peak=10_000, compactions=3)
            b.turn(sid, 0, 40_000)
            b.call(sid, "Bash" if source == "claude" else "run_terminal_command", 1, 250_000)
        p = b.payload()
        self.assertEqual(self.tip(p, "frequent_compactions")["advice"],
                         "Start a new session between tasks (`/clear` in Claude Code); `/compact` before the context fills, while the summary "
                         "is still cheap; in Claude Code, hand bulk reading to a subagent, so it compacts there and not in the main thread.")
        self.assertTrue(self.tip(p, "large_start")["advice"].endswith("compare it with `.mcp.json` or `claude mcp list` for Claude Code."))
        self.assertIn("In Claude Code, hand bulk reading to a subagent", self.tip(p, "large_results")["advice"])
        b.session("x", "foo", source="codex", peak=10_000, compactions=3)  # all three agents
        b.turn("x", 0, 40_000)
        self.assertIn("(`/clear` in Claude Code, `/new` in Codex)", self.tip(b.payload(), "frequent_compactions")["advice"])

    def test_advice_for_codex_and_grok_sessions(self):
        b = Builder(self)
        for sid, source in (("x", "codex"), ("g", "grok")):
            b.session(sid, "foo", source=source, peak=10_000, compactions=3)
            b.turn(sid, 0, 40_000)
        p = b.payload()
        self.assertEqual(self.tip(p, "frequent_compactions")["advice"],
                         "Start a new session between tasks (`/new` in Codex); `/compact` before the context fills, while the summary is still cheap.")
        start = self.tip(p, "large_start")["advice"]
        self.assertTrue(start.startswith("Trim the instruction files"))
        self.assertTrue(start.endswith("`~/.codex/config.toml` or `codex mcp list` for Codex."))

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

    def test_large_results_advice_names_subagents_for_claude_code_only(self):
        b = Builder(self)
        b.session("x", "cdx", source="codex", window=258_400)
        b.turn("x", 0, 5_000)
        b.call("x", "exec_command", 1, 250_000)
        for p in (b.payload(), b.payload(source="codex")):
            advice = self.tip(p, "large_results")["advice"]
            self.assertIn("`head`, `tail` or `grep`", advice)
            self.assertNotIn("subagent", advice)
        only = Builder(self)  # a tool with no remedy of its own still gets advice
        only.session("y", "cdx", source="codex", window=258_400)
        only.turn("y", 0, 5_000)
        only.call("y", "view_image", 1, 250_000)
        self.assertEqual(self.tip(only.payload(), "large_results")["advice"], "Ask for a smaller part of a file or command output at a time.")
        b.session("a", "foo")  # a Claude Code session joins the matching ones
        b.turn("a", 0, 5_000)
        b.call("a", "Bash", 1, 250_000)
        both = self.tip(b.payload(), "large_results")["advice"]
        self.assertIn("In Claude Code, hand bulk reading to a subagent", both)
        self.assertIn("Hand bulk reading to a subagent", self.tip(b.payload(source="claude"), "large_results")["advice"])

    def test_large_results_advice_for_a_claude_read_and_a_codex_tool_with_no_remedy(self):
        b = Builder(self)
        b.session("a", "foo")
        b.turn("a", 0, 5_000)
        b.call("a", "Read", 1, 250_000)
        b.session("y", "cdx", source="codex", window=258_400)
        b.turn("y", 0, 5_000)
        b.call("y", "view_image", 1, 250_000)
        self.assertEqual(self.tip(b.payload(), "large_results")["advice"],
                         "Use `Read` with `offset` and `limit` to take only the part you need. "
                         "Ask for a smaller part of a file or command output at a time. "
                         "In Claude Code, hand bulk reading to a subagent, which returns a short report.")

    def test_large_results_advice_follows_the_results_sessions(self):
        # The Codex session's only request is on Nov 4, its large result on Nov 5: over one day it matches no session.
        b = Builder(self)
        b.session("x", "cdx", source="codex", window=258_400)
        b.turn("x", 0, 5_000)
        b.call("x", "exec_command", 27 * 60, 250_000)
        for p in (b.payload(range_days=1), b.payload(range_days=1, source="codex")):
            t = self.tip(p, "large_results")
            self.assertEqual(t["matched"], 0)
            self.assertIn("`head`, `tail` or `grep`", t["advice"])
            self.assertNotIn("subagent", t["advice"])

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


class OverheadTest(unittest.TestCase):
    def test_none_without_a_project_a_snapshot_or_for_codex(self):
        b = Builder(self)
        b.session("s1")
        b.snapshot("c1")
        b.session("s2", "bar")
        b.call("s2", "mcp__github__get_pr", 1, mcp="github")  # calls and no snapshot
        self.assertIsNone(b.payload()["overhead"])
        self.assertIsNone(b.payload(project="bar")["overhead"])
        self.assertIsNone(b.payload(project="foo", source="codex")["overhead"])
        self.assertIsNone(b.payload(project="foo", source="grok")["overhead"])
        self.assertEqual(b.payload(project="foo", source="claude")["overhead"]["session_id"], "m1")

    def test_latest_snapshot_of_the_project_whatever_the_range(self):
        b = Builder(self)
        b.session("s1")
        b.snapshot("c1", ts="2026-01-01 10:00:00", model="old")
        b.snapshot("c3", ts="2026-03-01 10:00:00", sid="m3", model="m-b", version="2.1.300", window=1_000_000)
        b.snapshot("c2", ts="2026-03-01 10:00:00", model="tie")  # same time: the larger uuid wins
        b.snapshot("c9", ts="2026-06-01 10:00:00", project="bar")
        b.snapshot("c8", ts=None, project="undated")
        o = b.payload(project="foo", range_days=7)["overhead"]  # every snapshot is months before the range
        self.assertEqual({k: o[k] for k in ("ts", "session_id", "model", "version", "window", "before_view", "items", "calls")},
                         dict(ts="2026-03-01T10:00:00.000Z", session_id="m3", model="m-b", version="2.1.300", window=1_000_000,
                              before_view=True, items=[], calls=dict(mcp=[], skill=[])))
        self.assertFalse(b.payload(project="foo")["overhead"]["before_view"])  # all time has no first day
        self.assertFalse(b.payload(project="undated", range_days=7)["overhead"]["before_view"])

    def test_categories_in_order_and_every_item(self):
        b = Builder(self)
        b.session("s1")
        cats = (("System prompt", 4107, "used"), ("MCP tools (deferred)", 81826, "deferred"), ("Autocompact buffer", 33000, "buffer"),
                ("Free space", 936088, "free"))
        parts = [("mcp_tool", f"mcp__s{i}__t{j}", f"s{i}", 10 * i + j) for i in range(7) for j in range(2)]
        parts += [("memory_file", f"/m/{i}.md", "Project", i) for i in range(6)]
        parts += [("skill", n, "userSettings", t) for n, t in (("b", 5), ("a", 5), ("c", 1), ("d", 9), ("e", 2), ("f", 3))]
        parts += [("agent", "explorer", "plugin", 999)]
        parts += [("skill", None, "userSettings", 5), ("skill", "neg", None, -7),  # seq 31, 32
                  ("mcp_tool", "mcp__plugin_gh_github__get_pr", "github", 4), ("mcp_tool", "search", "docs", 3),  # 33, 34
                  ("memory_file", "/a/CLAUDE.md", "Project", 0), ("memory_file", "/b/CLAUDE.md", "User", 0),  # 35, 36
                  ("plugin", "unknown kind", None, 50)]
        b.snapshot("c1", categories=cats, parts=parts)
        o = b.payload(project="foo")["overhead"]
        self.assertEqual(o["categories"], [dict(name=n, tokens=t, state=st) for n, t, st in cats])
        items = o["items"]
        self.assertEqual(len(items), len(parts) - 1)  # every part but the unknown kind's
        self.assertEqual([(x["kind"], x["name"], x["tokens"]) for x in items[:3]],
                         [("agent", "explorer", 999), ("mcp_tool", "mcp__s6__t1", 61), ("mcp_tool", "mcp__s6__t0", 60)])
        self.assertEqual([x["name"] for x in items if x["tokens"] == 5], ["/m/5.md", "a", "b", None])  # by name, none last
        self.assertEqual(items[-5:], [  # a negative count reads 0; one file name in two folders is two items
            dict(seq=35, kind="memory_file", name="/a/CLAUDE.md", detail="Project", server=None, tokens=0),
            dict(seq=36, kind="memory_file", name="/b/CLAUDE.md", detail="User", server=None, tokens=0),
            dict(seq=18, kind="memory_file", name="/m/0.md", detail="Project", server=None, tokens=0),
            dict(seq=4, kind="mcp_tool", name="mcp__s0__t0", detail="s0", server="s0", tokens=0),
            dict(seq=32, kind="skill", name="neg", detail=None, server=None, tokens=0)])
        server = {x["name"]: (x["detail"], x["server"]) for x in items if x["kind"] == "mcp_tool"}
        self.assertEqual(server["mcp__plugin_gh_github__get_pr"], ("github", "plugin_gh_github"))  # the stored calls' key, not detail
        self.assertEqual(server["search"], ("docs", "docs"))  # no prefix: detail
        self.assertEqual(o["calls"], dict(mcp=[], skill=[]))
        self.assertEqual(o["top"]["mcp_servers"], [dict(name=f"s{i}", tokens=20 * i + 1) for i in (6, 5, 4, 3, 2)])  # tools summed by server
        self.assertEqual([m["name"] for m in o["top"]["memory_files"]], [f"/m/{i}.md" for i in (5, 4, 3, 2, 1)])
        self.assertEqual(o["top"]["skills"], [dict(name=n, tokens=t) for n, t in (("d", 9), ("a", 5), ("b", 5), ("f", 3), ("e", 2))])
        self.assertEqual(sorted(o), ["before_view", "calls", "categories", "items", "model", "session_id", "top", "ts", "version", "window"])

    def test_calls_are_claude_codes_in_the_view(self):
        b = Builder(self)
        servers = ["github", "linear-x"] + [f"srv{i}" for i in range(4)]
        parts = [("mcp_tool", f"mcp__{s}__t{j}", s, 10) for s in servers for j in range(10)]  # 60 tools on 6 servers
        parts += [("skill", n, "userSettings", 40) for n in ("ship", "constructor", "__proto__", *(f"k{i:03d}" for i in range(297)))]
        b.snapshot("c1", parts=parts)
        b.session("c", "foo", 0)
        for sub in (False, False, True):  # main thread and subagent
            b.call("c", "mcp__github__get_pr", 1, mcp="github", subagent=sub)
        b.call("c", "mcp__linear-x__find", 2, mcp="linear-x", subagent=True)
        b.call("c", "mcp__slack__post", 2, mcp="slack")  # a server the snapshot does not hold
        for skill in ("ship", "ship", "constructor", "__proto__", "other"):
            b.call("c", "Skill", 3, skill=skill)
        b.call("c", "mcp__github__get_pr", -30 * 24 * 60, mcp="github")  # before the 7-day range
        for sid, source in (("x", "codex"), ("g", "grok")):  # other agents' calls to the same server
            b.session(sid, "foo", 0, source=source)
            b.call(sid, "mcp__github__get_pr", 1, mcp="github")
        b.session("h", "foo", 0, prompts=0)  # a helper session: automated
        b.call("h", "mcp__github__get_pr", 1, mcp="github")
        b.session("o", "bar", 0)  # another project
        b.call("o", "mcp__github__get_pr", 1, mcp="github")
        o = b.payload(project="foo", range_days=7)["overhead"]
        self.assertEqual(len(o["items"]), 360)  # never capped
        self.assertEqual(o["calls"], dict(mcp=[dict(server="github", calls=3), dict(server="linear-x", calls=1)],
                                          skill=[dict(name="__proto__", calls=1), dict(name="constructor", calls=1), dict(name="ship", calls=2)]))
        self.assertEqual(b.payload(project="foo", range_days=7, source="claude")["overhead"]["calls"], o["calls"])
        self.assertEqual(b.payload(project="foo")["overhead"]["calls"]["mcp"][0], dict(server="github", calls=4))  # all time
        self.assertEqual(b.payload(project="foo", range_days=7, automated=True)["overhead"]["calls"]["mcp"][0], dict(server="github", calls=4))

    def test_one_snapshot_for_the_whole_payload(self):
        # A call that another cursor commits after the payload's first query is not counted: the snapshot, its counts and
        # the page's other figures belong to one moment.
        b = Builder(self)
        b.snapshot("c1", parts=[("mcp_tool", "mcp__github__get_pr", "github", 10)])
        b.session("c", "foo", 0)
        b.call("c", "mcp__github__get_pr", 1, mcp="github")
        real, done = metrics.rows, []

        def rows(cur, *a, **k):
            out = real(cur, *a, **k)
            if not done:
                done.append(1)
                store.insert(cur.cursor(), "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "start_ts", "subagent"],
                             [("late", "c", "mcp__github__get_pr", "github", at(2), False)])
            return out

        with mock.patch.object(metrics, "rows", rows):
            o = b.payload(project="foo")["overhead"]
        self.assertTrue(done)
        self.assertEqual(o["calls"]["mcp"], [dict(server="github", calls=1)])


if __name__ == "__main__":
    unittest.main()
