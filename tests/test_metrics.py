import http.client
import json
import os
import shutil
import tempfile
import threading
import unittest
from datetime import date, datetime, timedelta
from http.server import ThreadingHTTPServer
from unittest import mock
from zoneinfo import ZoneInfo

from ai_ledger import app, metrics, store, titles

PRICES = {
    "m-a": {"input": 1, "output": 10, "cache_read": 0.1, "cache_5m": 2, "cache_1h": 4, "context": 1000},
    "m-fast": {"input": 1, "output": 10, "cache_read": 0.1, "cache_5m": 2, "cache_1h": 4, "context": 1000,
               "fast": {"input": 2, "output": 20, "cache_read": 0.2, "cache_5m": 4, "cache_1h": 8}},
    "m-both": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "context": 1000,
               "long_above": 100, "long": {"input": 3, "output": 3, "cache_read": 3, "cache_5m": 3, "cache_1h": 3},
               "fast": {"input": 2, "output": 2, "cache_read": 2, "cache_5m": 2, "cache_1h": 2}},
    "m-tier": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "context": 1000,
               "long_above": 100, "long": {"input": 2, "output": 2, "cache_read": 2, "cache_5m": 2, "cache_1h": 2}},
}
TODAY = date(2026, 11, 5)


def serve(test, con, tmp):
    """Serves con until the test ends; returns get(path, status=None) giving (status, JSON body), checking status when given."""
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(con, dict(claude=tmp))))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    test.addCleanup(httpd.server_close)
    test.addCleanup(httpd.shutdown)

    def get(path, status=None):
        h = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1])
        h.request("GET", path, headers={"Host": f"{app.HOST}:{app.PORT}"})
        r = h.getresponse()
        if status is not None:
            test.assertEqual(r.status, status, path)
        return r.status, json.loads(r.read())
    return get


class FastPricingTest(unittest.TestCase):
    """A request costs the fast rates when its speed is 'fast' and its model has them; fast replaces the long-prompt tier."""

    def cost(self, model, speed, inp=60, cr=60):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        con = store.open_store(os.path.join(tmp, "x.duckdb"))
        self.addCleanup(con.close)
        c = con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("s", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("p", "s", "2026-11-05 09:00:00", False)])  # not a helper session
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read",
                                     "cache_5m", "cache_1h", "thinking_ms", "speed"],
                     [("r", "s", "2026-11-05 09:01:00", model, False, inp, 10, 0, cr, 0, 0, 0, speed)])
        return metrics.usage(con.cursor(), prices=PRICES, today=TODAY)

    def test_a_request_costs_the_rates_of_its_speed_and_tier(self):
        standard = (60 * 1 + 10 * 10 + 60 * 0.1) / 1e6
        for model, speed, tokens, want in (("m-fast", "fast", {}, (60 * 2 + 10 * 20 + 60 * 0.2) / 1e6),
                                           ("m-fast", "standard", {}, standard), ("m-fast", None, {}, standard),
                                           ("m-a", "fast", {}, standard),  # no fast rates: the standard price, not unpriced
                                           ("m-both", "fast", {}, 130 * 2 / 1e6),  # 120 > long_above, still fast: fast replaces the long tier
                                           ("m-both", "standard", {}, 130 * 3 / 1e6),
                                           ("m-both", "standard", dict(inp=10, cr=10), 30 / 1e6)):
            got = self.cost(model, speed, **tokens)
            self.assertAlmostEqual(got["totals"]["cost"], want, msg=(model, speed, tokens))
            self.assertEqual(got["unpriced"], [], (model, speed))

    def test_models_ledger_separates_fast_requests(self):
        m = self.cost("m-fast", "fast")["models"]
        self.assertEqual([(r["model"], r["fast"], r["requests"]) for r in m], [("m-fast", True, 1)])
        self.assertEqual([r["fast"] for r in self.cost("m-fast", None)["models"]], [False])


class UnpricedRatiosTest(unittest.TestCase):
    """Cost per prompt and per commit are unknown (null), not $0, when every request is on an unpriced model."""

    def test_unknown_cost_gives_null_per_prompt_and_per_commit(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        con = store.open_store(os.path.join(tmp, "x.duckdb"))
        self.addCleanup(con.close)
        c = con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("s", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("p", "s", "2026-11-05 09:00:00", False)])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read",
                                     "cache_5m", "cache_1h", "thinking_ms"], [("r", "s", "2026-11-05 09:01:00", "m-unknown", False, 60, 10, 0, 0, 0, 0, 0)])
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error", "subagent", "is_commit", "is_test", "test_passed"],
                     [("t", "s", "Bash", "", "2026-11-05 09:02:00", "2026-11-05 09:02:01", False, False, True, False, True)])
        u = metrics.usage(con.cursor(), prices=PRICES, today=TODAY)
        self.assertIsNone(u["totals"]["cost"])
        self.assertEqual(u["totals"]["commits"], 1)
        self.assertIsNone(u["totals"]["cost_per_prompt"])
        self.assertIsNone(u["totals"]["cost_per_commit"])
        self.assertIsNone(u["by_project"][0]["cost_per_commit"])


class ReportedCostTest(unittest.TestCase):
    """A request whose source reported its cost costs that amount; only a request with neither a price nor a reported cost is unpriced."""

    def usage(self, rows, prices=PRICES):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        con = store.open_store(os.path.join(tmp, "x.duckdb"))
        self.addCleanup(con.close)
        c = con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("s", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("p", "s", "2026-11-05 09:00:00", False)])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read",
                                     "cache_5m", "cache_1h", "thinking_ms", "reported_cost"],
                     [(f"r{i}", "s", f"2026-11-05 09:0{i}:00", model, False, 60, 10, 0, 0, 0, 0, 0, cost) for i, (model, cost) in enumerate(rows)])
        return metrics.usage(con.cursor(), prices=prices, today=TODAY)

    def test_unpriced_model_with_reported_costs_adds_them(self):
        u = self.usage([("m-unknown", 0.1), ("m-unknown", 0.034844)])
        t = u["totals"]
        self.assertAlmostEqual(t["cost"], 0.134844)
        self.assertEqual(u["unpriced"], [])
        self.assertAlmostEqual(u["daily"][0]["cost"], 0.134844)
        self.assertEqual(u["daily"][0]["unpriced"], 0)
        self.assertAlmostEqual(sum(r["cost"] for r in u["daily_models"]), 0.134844)
        self.assertAlmostEqual(u["sessions"][0]["cost"], 0.134844)
        self.assertEqual(u["sessions"][0]["unpriced"], 0)
        # Its token kinds have no estimate: the cost-by-token-kind chart treats the request as it treats an unpriced one.
        self.assertEqual([t[f"cost_{k}"] for k in metrics.PRICE_KINDS], [None] * 5)

    def test_reported_cost_beside_an_estimate_and_an_unpriced_request(self):
        u = self.usage([("m-unknown", 0.134844), ("m-a", None), ("m-other", None)])
        est = (60 * 1 + 10 * 10) / 1e6
        self.assertAlmostEqual(u["totals"]["cost"], 0.134844 + est)
        self.assertAlmostEqual(u["totals"]["cost_input"], 60 / 1e6)  # the priced request's kinds only
        self.assertEqual([r["model"] for r in u["unpriced"]], ["m-other"])

    def test_kind_costs_leave_out_a_reported_cost(self):
        # The reported cost wins over the estimate. Rates for its model (a user can add some for a Grok model) give the request
        # no kind costs: the web reads the kinds as the estimated part of cost and the rest as the reported part.
        t = self.usage([("m-a", 0.5)])["totals"]
        self.assertAlmostEqual(t["cost"], 0.5)
        self.assertEqual([t[f"cost_{k}"] for k in metrics.PRICE_KINDS], [None] * 5)
        t = self.usage([("m-a", 0.5), ("m-a", None)])["totals"]
        est = (60 * 1 + 10 * 10) / 1e6
        self.assertAlmostEqual(t["cost"], 0.5 + est)
        self.assertAlmostEqual(t["cost_input"], 60 / 1e6)
        self.assertAlmostEqual(t["cost_output"], 100 / 1e6)
        self.assertAlmostEqual(sum(t[f"cost_{k}"] or 0 for k in metrics.PRICE_KINDS), est)

    def test_a_price_entry_without_rates_gives_a_window_and_prices_nothing(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        prices = metrics.load_prices(user=os.path.join(tmp, "prices.json"))  # the packaged file alone
        self.assertEqual(prices["grok-4.7-build"], {"context": 256000})
        u = self.usage([("grok-4.7-build", None), ("grok-4.7-build", 0.134844)], prices)
        self.assertAlmostEqual(u["totals"]["cost"], 0.134844)
        self.assertEqual([(r["model"], r["requests"]) for r in u["unpriced"]], [("grok-4.7-build", 1)])
        self.assertEqual([u["totals"][f"cost_{k}"] for k in metrics.PRICE_KINDS], [None] * 5)


def add_grok_session(con):
    """A Grok session (g1, project foo, Nov 5) for the web fixtures, beside SourceFilterTest's Claude and Codex sessions: three
    model calls of a model with no rates that carry the cost Grok reported ($0.75 in all) and no effort, one turn's run with
    model time and no tool time or lines, a prompt, a failing run_terminal_command and a read_file. The test classes here
    leave it out, so their figures stay those of Claude Code and Codex."""
    c = con.cursor()
    store.insert(c, "sessions", ["session_id", "project", "cwd", "first_ts", "last_ts", "compactions", "peak_context", "peak_model",
                                 "source", "context_window"],
                 [("g1", "foo", "/Users/example/foo", "2026-11-05 14:00:00", "2026-11-05 14:20:00", 0, 120_000, "grok-4.7-build",
                   "grok", 256_000)])
    # Each call's stated context (context_tokens) differs from its share of the turn's input: pages show the stated one.
    store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                                 "cache_read", "cache_5m", "cache_1h", "thinking_ms", "reported_cost", "context_tokens"],
                 [("g1-1", "g1", "2026-11-05 14:01:00", "grok-4.7-build", None, False, 40_000, 2_000, 0, 30_000, 0, 0, 0, 0.2, 68_000),
                  ("g1-2", "g1", "2026-11-05 14:05:00", "grok-4.7-build", None, False, 20_000, 3_000, 0, 80_000, 0, 0, 0, 0.25, 97_000),
                  ("g1-3", "g1", "2026-11-05 14:12:00", "grok-4.7-build", None, False, 10_000, 1_000, 0, 110_000, 0, 0, 0, 0.3, 120_000)])
    store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error",
                                   "category", "subagent", "is_commit", "is_test", "test_passed"],
                 [("g1-t1", "g1", "run_terminal_command", "npm test", "2026-11-05 14:02:00", "2026-11-05 14:02:09", True, "x", False,
                   False, True, False),
                  ("g1-t2", "g1", "read_file", "src/app.ts", "2026-11-05 14:03:00", "2026-11-05 14:03:01", False, None, False,
                   False, False, None)])
    store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("g1-p1", "g1", "2026-11-05 14:00:00", False)])
    # one turn: 60 s of model time over its 6,000 output tokens (100 per second); Grok states no tool time or lines
    store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"],
                 [("g1", 1_793_800_000_000, 60_000, None, None, None)])


class MetricsTest(unittest.TestCase):
    """Fixture: project foo (sessions s1, s2), project bar (s3, outside a 7-day range), and the automated project
    observer-sessions (o1, with a request and a prompt on each of Nov 4 and 5), which every view leaves out by default."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "compactions", "peak_context", "peak_model"], [
            ("s1", "foo", "2026-11-04 10:00:00", "2026-11-04 11:00:00", 2, 900, "m-a"),
            ("s2", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00", 0, 100, "m-a"),
            ("s3", "bar", "2026-10-01 09:00:00", "2026-10-01 09:10:00", 0, 50, "m-a"),
            ("o1", "observer-sessions", "2026-11-04 12:00:00", "2026-11-05 12:00:00", 0, 100, "m-a")])
        cols = ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                "cache_read", "cache_5m", "cache_1h", "thinking_ms"]
        M = 1_000_000
        store.insert(c, "requests", cols, [
            # s1: one main request (cost 1 + 10 + 0.1*8 + 2*0.5 + 4*0.5 = 14.8) and one subagent request (cost 1)
            ("r1", "s1", "2026-11-04 10:01:00", "m-a", "high", False, M, M, M // 2, 8 * M, M // 2, M // 2, 1000),
            ("r2", "s1", "2026-11-04 10:02:00", "m-a", "high", True, M, 0, 0, 0, 0, 0, 0),
            # s2: an unpriced model
            ("r3", "s2", "2026-11-05 09:01:00", "m-unknown", "medium", False, 100, 100, 0, 0, 0, 0, 500),
            # s3: long-tier prompt (60 + 60 > 100): every kind at 2 per MTok
            ("r4", "s3", "2026-10-01 09:01:00", "m-tier", None, False, 60, 10, 0, 60, 0, 0, 0),
            # o1: more tokens than bar, so it would rank above bar in project_order if it were counted
            ("r5", "o1", "2026-11-04 12:00:00", "m-a", None, False, 100, 10, 0, 0, 0, 0, 0),
            ("r6", "o1", "2026-11-05 12:00:00", "m-a", None, False, 100, 10, 0, 0, 0, 0, 0)])
        tcols = ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                 "is_error", "category", "subagent", "is_commit", "is_test", "test_passed"]
        t = lambda i, s, tool, sec, err, **k: (i, s, tool, k.get("mcp"), k.get("skill"), "", f"2026-11-04 10:{i[-2:]}:00",
                                                f"2026-11-04 10:{i[-2:]}:{sec:02d}", err, "x" if err else None, False,
                                                k.get("commit", False), k.get("test", False), not err)
        store.insert(c, "tool_calls", tcols, [
            t("t01", "s1", "Edit", 1, True), t("t02", "s1", "Edit", 1, True), t("t03", "s1", "Edit", 1, True),
            t("t04", "s1", "Edit", 1, True),  # four failures in a row: one loop
            t("t05", "s1", "Bash", 4, False, commit=True), t("t06", "s1", "Bash", 10, False, test=True),
            t("t07", "s1", "Bash", 2, True, test=True), t("t08", "s1", "mcp__srv__q", 3, True, mcp="srv"),
            t("t09", "s1", "mcp__srv__q", 3, False, mcp="srv"), t("t10", "s1", "Skill", 1, False, skill="review")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [
            ("p1", "s1", "2026-11-04 10:00:00", True), ("p2", "s1", "2026-11-04 10:30:00", False),
            ("p3", "s2", "2026-11-05 09:00:00", False), ("p4", "s3", "2026-10-01 09:00:00", False),
            ("p5", "o1", "2026-11-04 12:00:00", False), ("p6", "o1", "2026-11-05 12:00:00", False)])
        store.insert(c, "hooks", ["session_id", "ts", "source", "hook", "command", "duration_ms", "is_error"], [
            ("s1", "2026-11-04 10:00:00", "stop_summary", "Stop", "a", 100, False),
            ("s1", "2026-11-04 10:05:00", "stop_summary", "Stop", "a", 300, True)], tail="")
        # s1 ran twice: 10,000 s of model time and 3,000 s of tools in all, over its 1,000,000 output tokens (100 per second)
        store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"], [
            ("s1", 1_793_000_000_000, 9_000_000, 2_400_000, 120, 30), ("s1", 1_793_090_000_000, 1_000_000, 600_000, 10, 2)])
        cls.all =metrics.usage(cls.con.cursor(), prices=PRICES, today=TODAY)
        cls.foo7 = metrics.usage(cls.con.cursor(), "foo", 7, "s1", prices=PRICES, today=TODAY)
        cls.auto = metrics.usage(cls.con.cursor(), prices=PRICES, today=TODAY, automated=True)

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def test_session_alone_matches_drill_in(self):
        self.assertEqual(metrics.session(self.con.cursor(), "s1", prices=PRICES), self.foo7["session"])
        self.assertIsNone(metrics.session(self.con.cursor(), "nope", prices=PRICES))

    def test_session_list(self):
        all_ = metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY)
        self.assertEqual(all_["total"], len(self.all["sessions"]))
        self.assertEqual([x["session_id"] for x in all_["sessions"]], [x["session_id"] for x in self.all["sessions"]])
        one = metrics.session_list(self.con.cursor(), q="S1", prices=PRICES, today=TODAY)
        self.assertEqual([x["session_id"] for x in one["sessions"]], ["s1"])
        page = metrics.session_list(self.con.cursor(), offset=1, limit=1, prices=PRICES, today=TODAY)
        self.assertEqual((page["total"], len(page["sessions"])), (all_["total"], 1))

    def test_tokens_and_cost_per_day_and_project(self):
        days = {d["day"]: d for d in self.foo7["daily"]}
        self.assertEqual(days["2026-11-04"]["input"], 2_000_000)
        self.assertEqual(days["2026-11-04"]["cache_read"], 8_000_000)
        self.assertEqual(days["2026-11-04"]["thinking"], 500_000)
        self.assertEqual(days["2026-11-05"]["unpriced"], 1)
        by = {(d["day"], d["project"]): d for d in self.all["daily_projects"]}
        self.assertAlmostEqual(by[("2026-11-04", "foo")]["cost"], 15.8)
        self.assertIsNone(by[("2026-11-05", "foo")]["cost"])  # only an unpriced model that day
        self.assertAlmostEqual(by[("2026-10-01", "bar")]["cost"], 130 * 2 / 1e6)
        self.assertEqual({d["project"] for d in self.foo7["daily_projects"]}, {"foo"})
        # The headline cost: the priced requests', with the unpriced model listed.
        self.assertAlmostEqual(self.foo7["totals"]["cost"], 15.8)
        self.assertEqual([u["model"] for u in self.foo7["unpriced"]], ["m-unknown"])
        self.assertAlmostEqual(self.all["totals"]["cost"], 15.8 + 130 * 2 / 1e6)

    def test_cost_per_day_and_model(self):
        for u in (self.all, self.foo7, self.auto):
            by = {}
            for r in u["daily_models"]:
                by[r["day"]] = by.get(r["day"], 0) + r["cost"]
            self.assertEqual(set(by), {d["day"] for d in u["daily"] if d["cost"] is not None})  # an unpriced day has no row
            for d in u["daily"]:
                if d["cost"] is not None:
                    self.assertAlmostEqual(by[d["day"]], d["cost"])
        self.assertEqual({(r["day"], r["model"]) for r in self.foo7["daily_models"]}, {("2026-11-04", "m-a")})  # m-unknown adds none
        self.assertEqual({(r["day"], r["source"]) for r in self.all["daily_sources"]}, {("2026-11-04", "claude"), ("2026-10-01", "claude")})

    def test_cost_by_kind(self):
        # The five kinds add up to the cost, on the base tier (r1, r2), the long tier (r4) and with an unpriced request (r3).
        for v in (self.foo7, self.all):
            t = v["totals"]
            self.assertAlmostEqual(sum(t[f"cost_{k}"] for k in metrics.PRICE_KINDS), t["cost"])
        t = self.foo7["totals"]
        self.assertEqual({k: round(t[f"cost_{k}"], 6) for k in metrics.PRICE_KINDS},
                         dict(input=2.0, output=10.0, cache_read=0.8, cache_5m=1.0, cache_1h=2.0))
        a = self.all["totals"]  # r4 on the long tier adds 60 input, 10 output, 60 cache read at 2 per MTok
        self.assertAlmostEqual(a["cost_input"], 2.0 + 120 / 1e6)
        self.assertAlmostEqual(a["cost_output"], 10.0 + 20 / 1e6)
        self.assertAlmostEqual(a["cost_cache_read"], 0.8 + 120 / 1e6)
        none = metrics.usage(self.con.cursor(), "foo", 1, prices=PRICES, today=TODAY)  # Nov 5 only: the unpriced request
        self.assertEqual([none["totals"][f"cost_{k}"] for k in metrics.PRICE_KINDS], [None] * 5)

    def test_previous_period(self):
        # One day ending today (s2) against the day before it (s1); same project filter, nothing before all time.
        u = metrics.usage(self.con.cursor(), "foo", 1, prices=PRICES, today=TODAY)
        prev = u["previous"]
        self.assertEqual((prev["start"], prev["end"], prev["requests"], prev["sessions"]), ("2026-11-04", "2026-11-04", 2, 1))
        self.assertAlmostEqual(prev["cost"], 15.8)
        self.assertEqual([d["day"] for d in prev["daily"]], ["2026-11-04"])
        # The project sheet reads a one-project payload: its previous daily costs add up to the previous cost, and its change too.
        self.assertAlmostEqual(sum(d["cost"] for d in prev["daily"]), prev["cost"])
        self.assertEqual([(c["project"], c["new"]) for c in u["changes"]], [("foo", False)])
        self.assertAlmostEqual(u["changes"][0]["prev_cost"], prev["cost"])
        self.assertEqual(metrics.usage(self.con.cursor(), "bar", 1, prices=PRICES, today=TODAY)["previous"]["requests"], 0)
        self.assertIsNone(self.all["previous"])
        self.assertEqual(self.foo7["previous"]["start"], "2026-10-23")
        self.assertEqual((prev["active_days"], self.foo7["totals"]["active_days"]), (1, 2))
        self.assertEqual([(r["project"], r["requests"]) for r in prev["by_project"]], [("foo", 2)])

    def test_project_changes(self):
        # 35 days to Nov 5 holds foo (new: nothing of it in the 35 days before); bar's only day (Oct 1) is in the previous window.
        ch = metrics.usage(self.con.cursor(), "", 35, prices=PRICES, today=TODAY)["changes"]
        self.assertEqual([(r["project"], r["new"]) for r in ch], [("foo", True), ("bar", False)])
        self.assertAlmostEqual(ch[0]["delta"], 15.8)
        self.assertEqual(ch[1]["cost"], 0)
        self.assertAlmostEqual(ch[1]["prev_cost"], 130 * 2 / 1e6)
        self.assertAlmostEqual(ch[1]["delta"], -130 * 2 / 1e6)
        # One day: foo's priced spend was all the day before; that day it ran only an unpriced model, so its cost and change are unknown.
        one = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY)["changes"]
        self.assertEqual([(r["project"], r["new"], r["cost"], r["delta"]) for r in one], [("foo", False, None, None)])
        self.assertAlmostEqual(one[0]["prev_cost"], 15.8)
        self.assertIsNone(self.all["changes"])

    def test_prompt_title(self):
        t = titles.prompt_title
        self.assertEqual(t("<command-message>ship</command-message>\n<command-name>/ship</command-name>\n<command-args>add  the tests</command-args>"),
                         "/ship add the tests")
        self.assertEqual(t("<command-message>ship is running…</command-message>"), "/ship")
        self.assertEqual(t("<system-reminder>ignore me</system-reminder>\n\n# Fix the build. Then run the tests.\nMore"), "Fix the build.")
        self.assertEqual(t("x" * 100), "x" * 79 + "…")
        self.assertIsNone(t("<system-reminder>only this</system-reminder>"))
        self.assertIsNone(t(None))
        self.assertEqual(titles.short_title("z" * 80), "z" * 80)  # at the cap: not cut
        self.assertIsNone(titles.short_title(" "))
        self.assertIsNone(titles.short_title(None))

    def test_titles(self):
        c = self.con.cursor()
        store.insert(c, "raw_lines", ["key", "file", "line_no", "type", "session_id", "ts", "subagent", "json"], [
            ("x4", "f", 4, "user", "s2", "2026-11-05T09:00:00Z", False,
             '{"type":"user","promptId":"p3","message":{"content":"Add a dark mode toggle to the settings page. It should persist."}}')])
        store.insert(c, "session_titles", ["session_id", "custom", "agent"], [
            ("s1", "auth  bug\n fix", "Fix login redirect"), ("s3", None, "y" * 140), ("gone", "never stored", None)])
        try:
            with mock.patch.object(titles, "first_prompts", wraps=titles.first_prompts) as fp:
                got = titles.titles(c, ["s1", "s2", "s3", "o1", "s1"])
            self.assertEqual(got, {"s1": ("auth bug fix", "agent"), "s2": ("Add a dark mode toggle to the settings page.", "prompt"),
                                   "s3": ("y" * 79 + "…", "agent")})
            self.assertEqual(fp.call_args.args[1], ["s2", "o1"])  # only the sessions without an agent title
            self.assertEqual(titles.titles(c, []), {})
            self.assertEqual(metrics.session(c, "s1", prices=PRICES)["title"], "auth bug fix")
            usage = metrics.usage(c, "foo", 7, prices=PRICES, today=TODAY)
            self.assertEqual(usage["error_loops"][0]["title"], "auth bug fix")
            search = lambda q: [x["session_id"] for x in metrics.session_list(c, q=q, prices=PRICES, today=TODAY)["sessions"]]
            self.assertEqual(search("dark MODE"), ["s2"])  # a title from the first prompt
            self.assertEqual(search("auth bug"), ["s1"])
        finally:
            c.execute("DELETE FROM raw_lines WHERE key = 'x4'")
            c.execute("DELETE FROM session_titles")

    def test_session_list_by_day(self):
        day = metrics.session_list(self.con.cursor(), day="2026-11-04", prices=PRICES, today=TODAY)
        self.assertEqual([x["session_id"] for x in day["sessions"]], ["s1"])
        # o1 has requests on Nov 4 and 5: the day's list counts only Nov 4's, costliest first, so the rows add up to the bar.
        c = self.con.cursor()
        bar = {d["day"]: d["cost"] for d in metrics.usage(c, prices=PRICES, today=TODAY, automated=True)["daily"]}["2026-11-04"]
        day = metrics.session_list(c, day="2026-11-04", prices=PRICES, today=TODAY, automated=True, limit=1)
        self.assertEqual([x["session_id"] for x in day["sessions"]], ["s1", "o1"])
        self.assertEqual([x["requests"] for x in day["sessions"]], [2, 1])
        self.assertEqual(day["total"], 2)
        self.assertAlmostEqual(sum(x["cost"] for x in day["sessions"]), bar)
        with self.assertRaises(ValueError):
            metrics.session_list(self.con.cursor(), day="nope", prices=PRICES, today=TODAY)

    def test_session_timeline(self):
        c = self.con.cursor()
        raw = ["key", "file", "line_no", "type", "session_id", "ts", "subagent", "json"]
        store.insert(c, "raw_lines", raw, [
            ("x1", "f", 1, "user", "s1", "2026-11-04T10:00:00Z", False,
             '{"type":"user","promptId":"p1","message":{"content":[{"type":"text","text":"  fix the build  "}]}}'),
            ("x2", "f", 2, "system", "s1", "2026-11-04T10:20:00Z", False, '{"type":"system","subtype":"compact_boundary"}')])
        try:
            s = metrics.session(c, "s1", prices=PRICES)
            self.assertEqual(s["first_prompt"], "fix the build")
            self.assertEqual(s["compaction_ts"], ["2026-11-04T10:20:00Z"])
            self.assertEqual([(r["ts"], r["context"], r["subagent"]) for r in s["requests"]],
                             [("2026-11-04T10:01:00.000Z", 10_000_000, False), ("2026-11-04T10:02:00.000Z", 1_000_000, True)])
            self.assertEqual(len(s["calls"]), 10)
            self.assertEqual([c_["id"] for c_ in s["calls"] if c_["is_error"]], ["t01", "t02", "t03", "t04", "t07", "t08"])
            self.assertEqual([c_["id"] for c_ in s["calls"] if c_["is_commit"]], ["t05"])
            self.assertFalse(s["truncated"])
            self.assertIsNone(metrics.session(c, "s3", prices=PRICES)["first_prompt"])  # no stored line for its prompt
            self.assertEqual((s["title"], s["first_prompt_cut"]), ("fix the build", False))
            listed = metrics.session_list(c, prices=PRICES, today=TODAY)["sessions"]
            self.assertEqual({x["session_id"]: x["title"] for x in listed}, {"s1": "fix the build", "s2": None, "s3": None})
        finally:
            c.execute("DELETE FROM raw_lines WHERE key IN ('x1', 'x2')")

    def test_first_prompt_cap(self):
        c = self.con.cursor()
        long = "word " * 200
        store.insert(c, "raw_lines", ["key", "file", "line_no", "type", "session_id", "ts", "subagent", "json"], [
            ("x3", "f", 3, "user", "s2", "2026-11-05T09:00:00Z", False, '{"type":"user","promptId":"p3","message":{"content":"%s"}}' % long)])
        try:
            s = metrics.session(c, "s2", prices=PRICES)
            self.assertTrue(s["first_prompt_cut"])
            self.assertEqual(len(s["first_prompt"]), titles.FIRST_PROMPT_CAP + 1)
            self.assertEqual(titles.first_prompt(c, "s2", cap=None), long.strip())
        finally:
            c.execute("DELETE FROM raw_lines WHERE key = 'x3'")

    def test_cache_and_subagents(self):
        t = self.foo7["totals"]
        self.assertAlmostEqual(t["cache_hit_ratio"], 8 / (2 + 8 + 1 + 1e-4))
        self.assertAlmostEqual(t["write_1h_share"], 0.5)
        self.assertAlmostEqual(t["subagent_token_share"], 1 / (11 + 1 + 0.0002))
        self.assertAlmostEqual(t["subagent_cost_share"], 1 / 15.8)
        foo = next(p for p in self.foo7["by_project"] if p["project"] == "foo")
        self.assertAlmostEqual(foo["subagent_cost_share"], t["subagent_cost_share"])

    def test_context_and_prompts(self):
        s1 = next(s for s in self.foo7["sessions"] if s["session_id"] == "s1")
        self.assertEqual((s1["peak_context"], s1["compactions"], s1["near_limit"]), (900, 2, True))
        self.assertEqual([s["session_id"] for s in self.foo7["near_limit"]], ["s1"])
        t = self.foo7["totals"]
        self.assertEqual(t["prompts"], 3)
        self.assertAlmostEqual(t["tokens_per_prompt"], (12_000_000 + 200) / 3)
        self.assertAlmostEqual(t["turns_per_prompt"], 2 / 3)
        self.assertAlmostEqual(t["tool_calls_per_prompt"], 10 / 3)
        self.assertAlmostEqual(t["interruption_rate"], 1 / 3)

    def test_error_loops(self):
        self.assertEqual(self.foo7["totals"]["error_loops"], 1)
        loop = self.foo7["error_loops"][0]
        self.assertEqual((loop["tool"], loop["failures"], loop["first_id"]), ("Edit", 4, "t01"))
        self.assertEqual(self.foo7["session"]["error_loops"][0]["first_id"], "t01")

    def test_time(self):
        t = self.foo7["totals"]
        # Active time: s1's request and tool calls span 10:01 to 10:10; s2 has one request.
        self.assertEqual(t["session_seconds"], 540)
        self.assertEqual(t["median_session_seconds"], 270)
        self.assertEqual(t["thinking_ms"], 1500)
        bash = next(x for x in self.foo7["tools"] if x["tool"] == "Bash")
        self.assertAlmostEqual(bash["p50_ms"], 4000)
        self.assertAlmostEqual(bash["p95_ms"], 9400)
        # s1's two runs; s2 records none and counts in neither figure.
        self.assertEqual({k: t[k] for k in ("model_ms", "tool_ms", "timed_sessions", "output_per_s")},
                         dict(model_ms=10_000_000, tool_ms=3_000_000, timed_sessions=1, output_per_s=100.0))
        self.assertNotIn("timed_output", t)
        self.assertEqual(self.foo7["session"]["info"]["runs"],
                         dict(model_ms=10_000_000, tool_ms=3_000_000, lines_added=130, lines_removed=32, output_per_s=100.0))
        # The run figures stay off the session rows: only the totals and the session sheet carry them.
        for key in ("sessions", "top_sessions", "near_limit"):
            for x in self.foo7[key]:
                self.assertFalse({"model_ms", "tool_ms", "timed_output"} & x.keys(), (key, x["session_id"]))

    def test_outcomes(self):
        t = self.foo7["totals"]
        self.assertEqual((t["commits"], t["test_runs"], t["tests_passed"], t["tests_failed"]), (1, 2, 1, 1))
        self.assertAlmostEqual(t["cost_per_commit"], 15.8)
        self.assertEqual(t["tokens_per_commit"], 12_000_200)
        self.assertAlmostEqual(t["errors_per_100_calls"], 60)
        bar = metrics.usage(self.con.cursor(), "bar", 0, prices=PRICES, today=TODAY)  # no commit: no per-commit ratio
        self.assertIsNone(bar["totals"]["cost_per_commit"])
        self.assertIsNone(bar["totals"]["tokens_per_commit"])
        self.assertIsNone(bar["by_project"][0]["cost_per_commit"])

    def test_mix_and_failure_rates(self):
        mix = {(m["model"], m["effort"]): m["requests"] for m in self.foo7["models"]}
        self.assertEqual(mix, {("m-a", "high"): 2, ("m-unknown", "medium"): 1})
        self.assertEqual(self.foo7["mcp"], [dict(name="srv", calls=2, errors=1, failure_rate=0.5)])
        self.assertEqual(self.foo7["skills"][0]["name"], "review")
        self.assertEqual(self.foo7["skills"][0]["failure_rate"], 0)
        hook = self.foo7["hooks"][0]
        self.assertEqual((hook["name"], hook["runs"], hook["failure_rate"], hook["avg_ms"]), ("a", 2, 0.5, 200))
        edit = next(x for x in self.foo7["tools"] if x["tool"] == "Edit")
        self.assertEqual(edit["failure_rate"], 1)


    def test_error_days_counts_per_day_project_and_category(self):
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            ("k1", "s2", "Bash", "2026-11-05 09:01:00", "2026-11-05 09:01:05", True, "y", True),
            ("k2", "s2", "Bash", "2026-11-05 09:02:00", "2026-11-05 09:02:05", True, "y", False),
            ("k3", "s2", "Bash", "2026-11-05 09:03:00", "2026-11-05 09:03:05", False, None, False)])
        try:
            p = metrics.errors_payload(c)
            self.assertEqual(p["error_days"], [["2026-11-04", "foo", "x", 6, 0, "claude"], ["2026-11-05", "foo", "y", 2, 1, "claude"]])
            # The counts agree with the error list they summarize.
            self.assertEqual(sum(r[3] for r in p["error_days"]), len(p["errors"]))
            # Calls per day and project: all of them, then the subagent ones among them.
            self.assertEqual(p["calls"], [["2026-11-04", "foo", 10, 0, "claude"], ["2026-11-05", "foo", 3, 1, "claude"]])
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id IN ('k1', 'k2', 'k3')")

    def test_error_detail_returns_full_text(self):
        c = self.con.cursor()
        long_cmd, json_in = "echo " + "x" * 600, "{" + "a" * 299
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "is_error", "error", "followup"], [
            ("d1", "s9", "Bash", long_cmd, True, "e" * 700, None), ("d2", "s9", "Edit", json_in, True, "short", "ok")])
        try:
            d1 = metrics.error_detail(c, "d1")
            self.assertEqual((d1["i"], d1["r"], d1["cut"]), (long_cmd, "", ["e"]))
            self.assertEqual(metrics.error_detail(c, "d2")["cut"], ["i"])
            self.assertIsNone(metrics.error_detail(c, "missing"))
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id IN ('d1', 'd2')")

    def test_incidents_group_failures_and_record_recovery(self):
        c = self.con.cursor()
        row = lambda i, m0, err, cat=None, sub=False, inp="": (i, "s2", "Bash", inp, f"2026-11-05 09:{m0}:00", f"2026-11-05 09:{m0}:05", err, cat, sub)
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            row("a1", "00", True, "y"), row("a2", "01", False),  # a success between two failures doesn't end the incident
            row("a3", "02", True, "y"), row("a4", "03", True, "z"),  # another category: its own incident
            row("a5", "30", True, "y"),  # more than the gap after a3: a new incident
            row("a6", "31", False, inp="ls -la"), row("a7", "02", True, "y", sub=True)])  # subagent calls apart
        try:
            p = metrics.errors_payload(c)
            inc, n = p["incidents"], {e["id"]: e["n"] for e in p["errors"]}
            members = {}
            for k, i in n.items():
                members.setdefault(i, []).append(k)
            by = {tuple(sorted(v)): inc[i] for i, v in members.items()}
            self.assertEqual(sorted(by), [("a1", "a3"), ("a4",), ("a5",), ("a7",), ("t01", "t02", "t03", "t04"), ("t07",), ("t08",)])
            a = by[("a1", "a3")]
            self.assertEqual((a["outcome"], a["ok"], a["c"], a["p"], a["first"], a["last"]),
                             ("failed_again", 1, "y", "foo", "2026-11-05T09:00:00.000Z", "2026-11-05T09:02:05.000Z"))
            self.assertEqual(by[("a4",)]["outcome"], "failed_again")
            self.assertEqual((by[("a5",)]["outcome"], by[("a5",)]["rid"], by[("a5",)]["ri"]), ("recovered", "a6", "ls -la"))
            self.assertEqual((by[("a7",)]["outcome"], by[("a7",)]["sub"]), ("gave_up", 1))
            self.assertEqual(by[("t01", "t02", "t03", "t04")]["outcome"], "gave_up")
            self.assertEqual((by[("t08",)]["outcome"], by[("t08",)]["rid"]), ("recovered", "t09"))
            self.assertEqual((p["incident_gap_minutes"], p["incident_max_ok"]), (metrics.INCIDENT_GAP_MINUTES, metrics.INCIDENT_MAX_OK))
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id LIKE 'a_'")

    def test_incidents_are_retry_loops_of_one_agent(self):
        c = self.con.cursor()
        row = lambda i, s0, e0, err, cat=None, f="main": (i, "s3", "Bash", f"2026-11-05 11:{s0}", f"2026-11-05 11:{e0}", err, cat, f != "main", f)
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent", "result_file"], [
            row("b1", "00:00", "00:05", True, "y"), row("b2", "01:00", "01:05", False), row("b3", "02:00", "02:05", False),
            row("b4", "03:00", "03:05", True, "y"),  # two successes between: still the same retry loop
            *[row(f"b{5 + k}", f"0{4 + k}:00", f"0{4 + k}:05", False) for k in range(metrics.INCIDENT_MAX_OK + 1)],
            row("b9", "09:00", "09:30", True, "y"),  # more successes than INCIDENT_MAX_OK between: a new attempt
            row("c1", "09:10", "09:12", False),  # started before b9 ended: a parallel call, not b9's next call
            row("c2", "10:00", "10:05", False),
            row("d1", "00:30", "00:35", True, "y", "agent-1"), row("d2", "01:30", "01:35", True, "y", "agent-2")])  # two subagents
        try:
            inc, of = metrics.incidents(c)
            members = {}
            for k, i in of.items():
                members.setdefault(i, []).append(k)
            by = {tuple(sorted(v)): inc[i] for i, v in members.items() if inc[i]["s"] == "s3"}
            self.assertEqual(sorted(by), [("b1", "b4"), ("b9",), ("d1",), ("d2",)])
            self.assertEqual((by[("b1", "b4")]["ok"], by[("b1", "b4")]["outcome"], by[("b1", "b4")]["rid"]), (2, "recovered", "b5"))
            self.assertEqual((by[("b9",)]["outcome"], by[("b9",)]["rid"]), ("recovered", "c2"))
            self.assertEqual([by[k]["outcome"] for k in [("d1",), ("d2",)]], ["gave_up", "gave_up"])
        finally:
            c.execute("DELETE FROM tool_calls WHERE session_id = 's3'")

    def test_automated_sessions_left_out_by_default(self):
        ids = lambda u: {x["session_id"] for x in u["sessions"]}
        self.assertEqual((self.all["totals"]["sessions"], self.all["totals"]["requests"], self.all["totals"]["prompts"]), (3, 4, 4))
        self.assertEqual((self.auto["totals"]["sessions"], self.auto["totals"]["requests"], self.auto["totals"]["prompts"]), (4, 6, 6))
        self.assertEqual((ids(self.all), ids(self.auto)), ({"s1", "s2", "s3"}, {"s1", "s2", "s3", "o1"}))
        self.assertNotIn("observer-sessions", [p["project"] for p in self.all["by_project"]])
        self.assertIn("observer-sessions", [p["project"] for p in self.auto["by_project"]])
        self.assertEqual((self.all["automated"], self.auto["automated"]), (False, True))
        # One day ending Nov 5: o1 is in both the view and the previous period (Nov 4), and in the changes, only when asked.
        one = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY)
        one_auto = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY, automated=True)
        self.assertEqual((one["previous"]["sessions"], one["previous"]["requests"]), (1, 2))
        self.assertEqual((one_auto["previous"]["sessions"], one_auto["previous"]["requests"]), (2, 3))
        self.assertEqual([r["project"] for r in one["previous"]["by_project"]], ["foo"])
        self.assertEqual({r["project"] for r in one_auto["previous"]["by_project"]}, {"foo", "observer-sessions"})
        self.assertEqual([r["project"] for r in one["changes"]], ["foo"])
        self.assertEqual({r["project"] for r in one_auto["changes"]}, {"foo", "observer-sessions"})
        self.assertEqual(one_auto["totals"]["sessions"] - one["totals"]["sessions"], 1)
        # Naming an automated project in the filter includes it, flag or not; other projects stay out of that view anyway.
        named = metrics.usage(self.con.cursor(), "observer-sessions", prices=PRICES, today=TODAY)
        self.assertEqual(({x["session_id"] for x in named["sessions"]}, named["totals"]["requests"]), ({"o1"}, 2))

    def test_automated_project_and_session_lists(self):
        self.assertEqual(self.all["projects"], ["foo", "bar"])
        self.assertEqual(set(self.auto["projects"]), {"foo", "bar", "observer-sessions"})
        self.assertEqual(metrics.project_list(self.con.cursor()), self.all["projects"])
        # project_order never lists automated projects and ignores the filters, whatever the view.
        for order in (self.auto["project_order"], self.foo7["project_order"], metrics.project_order(self.con.cursor()),
                      metrics.errors_payload(self.con.cursor())["project_order"]):
            self.assertEqual(order, ["foo", "bar"])
        ids = lambda **k: [x["session_id"] for x in metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY, **k)["sessions"]]
        self.assertEqual(ids(), [x["session_id"] for x in self.all["sessions"]])
        self.assertEqual(ids(automated=True), [x["session_id"] for x in self.auto["sessions"]])
        self.assertIn("o1", ids(automated=True))
        self.assertEqual(ids(day="2026-11-05"), ["s2"])
        self.assertEqual(set(ids(day="2026-11-05", automated=True)), {"s2", "o1"})

    def test_daily_work(self):
        work = {d["day"]: d for d in self.all["daily_work"]}
        self.assertEqual(list(work), ["2026-10-01", "2026-11-04", "2026-11-05"])
        self.assertEqual(work["2026-11-04"], dict(day="2026-11-04", sessions=1, prompts=2, commits=1, calls=10, failed_calls=6))
        self.assertEqual(work["2026-11-05"], dict(day="2026-11-05", sessions=1, prompts=1, commits=0, calls=0, failed_calls=0))
        self.assertEqual([d["day"] for d in self.foo7["daily_work"]], ["2026-11-04", "2026-11-05"])
        for u in (self.all, self.foo7, self.auto):
            t, total = u["totals"], lambda k: sum(d[k] for d in u["daily_work"])
            self.assertEqual((total("prompts"), total("commits"), total("calls"), total("failed_calls")),
                             (t["prompts"], t["commits"], t["calls"], t["errors"]))
        # Sessions sum to totals only when no session spans days: o1 is active on Nov 4 and 5, so it counts on both.
        self.assertEqual(sum(d["sessions"] for d in self.all["daily_work"]), self.all["totals"]["sessions"])
        self.assertEqual(sum(d["sessions"] for d in self.auto["daily_work"]), self.auto["totals"]["sessions"] + 1)
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            ("w1", "o1", "Bash", "2026-11-05 12:00:30", "2026-11-05 12:00:31", True, "x", False)])
        try:
            day = lambda **k: {d["day"]: d for d in metrics.usage(c, prices=PRICES, today=TODAY, **k)["daily_work"]}["2026-11-05"]
            self.assertEqual((day()["sessions"], day()["failed_calls"]), (1, 0))
            self.assertEqual((day(automated=True)["sessions"], day(automated=True)["prompts"], day(automated=True)["failed_calls"]), (2, 2, 1))
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id = 'w1'")

    def test_work_buckets(self):
        c = self.con.cursor()
        # 35 days from the first work day (Oct 1) to Nov 5: by day, the same rows as daily_work.
        for u in (self.all, self.foo7, self.auto):
            self.assertEqual((u["work_bucket"], u["work"]), ("day", u["daily_work"]))
        usage = lambda today, **k: metrics.usage(c, "", 0, prices=PRICES, today=today, **k)
        self.assertEqual(usage(date(2026, 11, 30))["work_bucket"], "day")  # 60 days
        for auto in (False, True):
            u = usage(date(2026, 12, 1), automated=auto)  # 61 days: by week, each named by its Monday
            self.assertEqual(u["work_bucket"], "week")
            self.assertEqual([r["day"] for r in u["work"]], ["2026-09-28", "2026-11-02"])
            self.assertEqual(u["daily_work"], (self.auto if auto else self.all)["daily_work"])
            t, total = u["totals"], lambda k: sum(r[k] for r in u["work"])
            self.assertEqual((total("prompts"), total("commits"), total("calls"), total("failed_calls")),
                             (t["prompts"], t["commits"], t["calls"], t["errors"]))
            # o1 works on Nov 4 and 5: on both days, but once in their week.
            self.assertEqual(u["work"][1]["sessions"], 3 if auto else 2)
            self.assertEqual(sum(r["sessions"] for r in u["daily_work"] if r["day"] >= "2026-11-02"), 4 if auto else 2)
        # work_projects splits each work row by project, by day or by week.
        weekly = usage(date(2026, 12, 1), automated=True)
        keys = ("sessions", "prompts", "commits", "calls", "failed_calls")
        for u in (self.all, self.foo7, self.auto, weekly):
            by = {}
            for r in u["work_projects"]:
                b = by.setdefault(r["day"], dict.fromkeys(keys, 0))
                for k in keys:
                    b[k] += r[k]
            self.assertEqual(by, {r["day"]: {k: r[k] for k in keys} for r in u["work"]})
        self.assertEqual([(r["day"], r["project"], r["sessions"], r["prompts"]) for r in weekly["work_projects"]],
                         [("2026-09-28", "bar", 1, 1), ("2026-11-02", "foo", 2, 3), ("2026-11-02", "observer-sessions", 1, 2)])

    def test_failed_tests(self):
        got = self.foo7["failed_tests"]
        self.assertEqual(got, [dict(id="t07", session_id="s1", title=None, project="foo", source="claude", command="",
                                    ts="2026-11-04T10:07:00.000Z")])
        # The id is the one the Errors page lists the failure under.
        self.assertIn("t07", {e["id"] for e in metrics.errors_payload(self.con.cursor())["errors"]})
        self.assertEqual(metrics.usage(self.con.cursor(), "bar", 0, prices=PRICES, today=TODAY)["failed_tests"], [])
        # The newest FAILED_TESTS, newest first: two more than that on Nov 5 push out t07 and the two oldest.
        c = self.con.cursor()
        n = metrics.FAILED_TESTS + 2
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent",
                                       "is_test", "test_passed"],
                     [(f"ft{i:02d}", "s2", "Bash", f"2026-11-05 11:{i:02d}:00", f"2026-11-05 11:{i:02d}:01", True, "tests", False, True, False)
                      for i in range(n)])
        try:
            got = metrics.usage(c, "foo", 7, prices=PRICES, today=TODAY)["failed_tests"]
            self.assertEqual([r["id"] for r in got], [f"ft{i:02d}" for i in range(n - 1, 1, -1)])
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id LIKE 'ft%'")

    def test_previous_matches_usage_over_previous_window(self):
        keys = ("prompts", "commits", "calls", "errors", "test_runs", "tests_passed", "interrupted", "sub_tokens",
                "median_session_seconds", "sessions", "requests", "tokens", "active_days", "output_per_s")
        c = self.con.cursor()
        # Nothing lies after these previous windows, so a usage() call ending on their last day covers exactly them.
        for today, days, auto in ((date(2026, 11, 7), 2, False), (date(2026, 11, 7), 2, True), (date(2026, 11, 6), 1, False),
                                  (date(2026, 12, 5), 30, False)):
            prev = metrics.usage(c, "", days, prices=PRICES, today=today, automated=auto)["previous"]
            then = metrics.usage(c, "", days, prices=PRICES, today=date.fromisoformat(prev["end"]), automated=auto)["totals"]
            self.assertEqual({k: prev[k] for k in keys}, {k: then[k] for k in keys}, (today, days, auto))
        # One day ending Nov 5: the day before holds s1 alone.
        prev = metrics.usage(c, "foo", 1, prices=PRICES, today=TODAY)["previous"]
        self.assertEqual({k: prev[k] for k in keys}, dict(
            prompts=2, commits=1, calls=10, errors=6, test_runs=2, tests_passed=1, interrupted=1, sub_tokens=1_000_000,
            median_session_seconds=540, sessions=1, requests=2, tokens=12_000_000, active_days=1, output_per_s=100.0))
        self.assertFalse({"model_ms", "tool_ms", "timed_sessions", "timed_output"} & prev.keys())

    def test_unknown_sort_never_reaches_sql(self):
        with mock.patch.object(metrics, "rows") as rows, self.assertRaises(ValueError):
            metrics.session_list(self.con.cursor(), sort="cost; DROP TABLE sessions", prices=PRICES, today=TODAY)
        rows.assert_not_called()

    def test_day_view(self):
        c = self.con.cursor()
        d = metrics.day_view(c, "foo", 7, "2026-11-04", today=TODAY)
        # Every call of foo's 7 days falls on Nov 4.
        self.assertEqual((d["day"], d["days"]), ("2026-11-04", 1))
        for k in ("tools", "mcp", "skills", "hooks", "error_loops", "failed_tests"):
            self.assertEqual(d[k], self.foo7[k], k)
        self.assertEqual((d["error_loops_total"], d["tests_failed"]), (1, self.foo7["totals"]["tests_failed"]))
        proj = lambda rs: [(p["project"], p["sessions"], p["commits"], p["error_loops"]) for p in rs]
        self.assertEqual(proj(d["by_project"]), [("foo", 1, 1, 1)])  # the view's other session works on Nov 5 only
        other = metrics.day_view(c, "foo", 7, "2026-11-05", today=TODAY)
        self.assertEqual([other[k] for k in ("tools", "mcp", "skills", "hooks", "error_loops", "error_loops_total", "failed_tests", "tests_failed")],
                         [[], [], [], [], [], 0, [], 0])
        # The week from Monday Nov 2 holds every day of foo's 7-day view that has work: the view's rows.
        week = metrics.day_view(c, "foo", 7, "2026-11-02", today=TODAY, days=7, prices=PRICES)
        self.assertEqual(week["days"], 7)
        for k in ("tools", "error_loops", "failed_tests"):
            self.assertEqual(week[k], self.foo7[k], k)
        self.assertEqual(proj(week["by_project"]), proj(self.foo7["by_project"]))
        for bad in ("", "nope"):
            with self.assertRaises(ValueError):
                metrics.day_view(c, day=bad, today=TODAY)
        with self.assertRaises(ValueError):
            metrics.day_view(c, day="2026-11-02", today=TODAY, days=3)

    def test_calendar(self):
        c = self.con.cursor()
        # From the Monday 52 weeks before the week of today, whichever day of the week today is, to today.
        for today, start in ((date(2026, 11, 2), "2025-11-03"), (TODAY, "2025-11-03"), (date(2026, 11, 8), "2025-11-03"),
                             (date(2026, 11, 9), "2025-11-10")):
            cal = metrics.calendar(c, today=today)
            self.assertEqual((cal["start"], cal["end"]), (start, today.isoformat()), today)
        # Every work day of the store is inside the 53 weeks: the rows are usage()'s, with and without automated sessions.
        for u, auto in ((self.all, False), (self.auto, True)):
            cal = metrics.calendar(c, today=TODAY, automated=auto)
            self.assertEqual((cal["days"], cal["first"], cal["automated"]), (u["daily_work"], "2026-10-01", auto))
        foo, bar = (metrics.calendar(c, p, today=TODAY) for p in ("foo", "bar"))
        self.assertEqual(([r["day"] for r in foo["days"]], foo["first"], foo["project"]), (["2026-11-04", "2026-11-05"], "2026-11-04", "foo"))
        self.assertEqual(([r["day"] for r in bar["days"]], bar["first"]), (["2026-10-01"], "2026-10-01"))
        # A prompt the day before bar's first request: its day is a row, and so the first day.
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("p7", "s3", "2026-09-30 12:00:00", False)])
        self.addCleanup(c.execute, "DELETE FROM prompts WHERE prompt_id = 'p7'")
        bar = metrics.calendar(c, "bar", today=TODAY)
        self.assertEqual(([r["day"] for r in bar["days"]], bar["first"]), (["2026-09-30", "2026-10-01"], "2026-09-30"))
        # A year later bar's day is out of the rows, but still the first day.
        later = metrics.calendar(c, today=date(2027, 11, 5))
        self.assertEqual((later["start"], [r["day"] for r in later["days"]], later["first"]),
                         ("2026-11-02", ["2026-11-04", "2026-11-05"], "2026-10-01"))
        with self.assertRaises(ValueError):
            metrics.calendar(c, today=TODAY, source="gemini")

    def test_automated_file(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        path = os.path.join(tmp, "automated.json")
        patch = mock.patch.object(metrics, "USER_AUTOMATED", path)
        patch.start()
        self.addCleanup(patch.stop)
        c = self.con.cursor()
        usage = lambda project="", **k: metrics.usage(c, project, 0, prices=PRICES, today=TODAY, **k)
        ids = lambda u: {x["session_id"] for x in u["sessions"]}
        self.assertEqual(usage()["automated_file"], dict(path=path, error=None, projects=[]))  # no file is no error
        with open(path, "w") as fh:
            json.dump({"projects": ["bar"]}, fh)
        u = usage()
        self.assertEqual(u["automated_file"], dict(path=path, error=None, projects=["bar"]))
        self.assertEqual((ids(u), u["projects"], [p["project"] for p in u["by_project"]]), ({"s1", "s2"}, ["foo"], ["foo"]))
        self.assertEqual(ids(usage(automated=True)), {"s1", "s2", "s3", "o1"})
        self.assertEqual(ids(usage("bar")), {"s3"})  # naming it lets it in, as for observer-sessions
        self.assertEqual(metrics.session_list(c, prices=PRICES, today=TODAY)["total"], 2)
        for text, error in (("{bad", "Expecting property name"), ("[]", 'no "projects" list'),
                            ('{"projects": "bar"}', 'no "projects" list'), ('{"projects": [1]}', "projects must be strings")):
            with open(path, "w") as fh:
                fh.write(text)
            u = usage()
            self.assertIn(error, u["automated_file"]["error"])
            self.assertEqual((u["automated_file"]["projects"], ids(u)), ([], {"s1", "s2", "s3"}))
        os.remove(path)
        os.mkdir(path)  # unreadable: an OSError
        u = usage()
        self.assertIn("Is a directory", u["automated_file"]["error"])
        self.assertEqual((u["automated_file"]["projects"], ids(u)), ([], {"s1", "s2", "s3"}))

    def test_one_automated_list_per_payload(self):
        # The file changes while a request runs: bar is listed at the first read, gone after. The whole payload, previous
        # period included, uses the list it read first.
        reads = iter([(["bar"], None)])
        with mock.patch.object(metrics, "user_automated", side_effect=lambda path=None: next(reads, ([], None))) as read:
            u = metrics.usage(self.con.cursor(), "", 30, prices=PRICES, today=TODAY)
        self.assertEqual(read.call_count, 1)
        self.assertEqual(u["automated_file"]["projects"], ["bar"])
        self.assertNotIn("bar", u["projects"] + u["project_order"])
        self.assertEqual([r["project"] for r in u["previous"]["by_project"]], [])  # bar's only day is in the previous period

    def test_api_reads_session_params(self):
        get = serve(self, self.con, self.tmp)
        body = lambda path: get(path, 200)[1]
        self.assertEqual((body("/api/usage")["totals"]["sessions"], body("/api/usage?automated=1")["totals"]["sessions"]), (3, 4))
        self.assertEqual((body("/api/sessions")["total"], body("/api/sessions?automated=1")["total"]), (3, 4))
        self.assertEqual(len(body("/api/sessions?limit=2")["sessions"]), 2)  # a refresh refetches as many rows as are shown
        self.assertEqual(body("/api/day?day=2026-11-04&range=0")["error_loops_total"], 1)
        ids = lambda path: [x["session_id"] for x in body(path)["sessions"]]
        self.assertEqual(ids("/api/sessions?sort=-tokens,cost"), ["s1", "s2", "s3"])
        # s2 and s3 tie on failed calls: the second key puts s3 (130 tokens) before s2 (200), against the list's order.
        self.assertEqual(ids("/api/sessions?sort=-errors,tokens"), ["s1", "s3", "s2"])
        self.assertEqual(ids("/api/sessions?sort=cost&desc=1"), ids("/api/sessions?sort=-cost"))
        # No sort key keeps the default order (newest first); a blank one is refused.
        self.assertEqual(ids("/api/sessions"), ["s2", "s1", "s3"])
        self.assertEqual(get("/api/sessions?sort="), (400, dict(error="empty sort key")))
        self.assertEqual(get("/api/sessions?sort=&desc=1"), (400, dict(error="empty sort key")))
        # A blank among several sort values is refused wherever it stands; otherwise the first value counts.
        for path in ("sort=cost&sort=", "sort=&sort=cost"):
            self.assertEqual(get(f"/api/sessions?{path}"), (400, dict(error="empty sort key")), path)
        self.assertEqual(ids("/api/sessions?sort=-tokens&sort=cost"), ["s1", "s2", "s3"])
        # The list's own refusals (SessionSortKeysTest.test_refusals) answer 400, desc included.
        for path, error in (("sort=cost,", "empty sort key"), ("sort=-cost&desc=1", "desc cannot go with a sort list or a - key")):
            self.assertEqual(get(f"/api/sessions?{path}"), (400, dict(error=error)), path)

    def test_palette(self):
        c = self.con.cursor()
        pal = lambda *a, **k: metrics.palette(c, *a, today=TODAY, **k)
        rate = lambda rs, key="name": [(r[key], r["calls"], r["errors"], r["failure_rate"]) for r in rs]
        for project, days, auto in (("", 0, False), ("foo", 7, False), ("", 30, True)):
            p, u = pal(project, days, automated=auto), metrics.usage(c, project, days, prices=PRICES, today=TODAY, automated=auto)
            self.assertEqual(rate(p["tools"]), rate(u["tools"], "tool"))
            self.assertEqual((rate(p["mcp"]), rate(p["skills"])), (rate(u["mcp"]), rate(u["skills"])))
        self.assertEqual(pal()["projects"], [dict(name="foo", sessions=2), dict(name="bar", sessions=1)])
        self.assertEqual(pal(automated=True)["projects"][-1], dict(name="observer-sessions", sessions=1))
        self.assertEqual(pal("", 30)["projects"], [dict(name="foo", sessions=2)])
        # A project filter leaves the project counts as they are and narrows the rest.
        self.assertEqual(pal("bar")["projects"], pal()["projects"])
        self.assertEqual((pal("bar")["tools"], pal("bar")["sources"]), ([], [dict(source="claude", sessions=1)]))
        self.assertEqual(pal()["sources"], [dict(source="claude", sessions=3)])
        self.assertEqual(pal()["categories"], [dict(id="x", label="x", errors=6)])
        # bar has nothing in the last 7 days; the project list still counts foo there.
        empty = pal("bar", 7)
        self.assertEqual([empty[k] for k in ("sources", "tools", "mcp", "skills", "categories")], [[], [], [], [], []])
        self.assertEqual(empty["projects"], [dict(name="foo", sessions=2)])
        with self.assertRaises(ValueError):
            pal(source="gemini")
        pal(source="grok")  # a known source: no error

    def codex_models(self, *requests):
        """The model rows of a Codex session holding requests, priced by prices.json. The rows are removed after."""
        c = self.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "compactions", "peak_context", "source"],
                     [("cx1", "foo", "2026-11-05 10:00:00", "2026-11-05 10:05:00", 0, 0, "codex")])
        cols = ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                "cache_read", "cache_5m", "cache_1h"]
        store.insert(c, "requests", cols, [(f"cx{i}", "cx1", "2026-11-05 10:01:00", *r) for i, r in enumerate(requests)])
        try:
            return {m["model"]: m for m in metrics.session(c, "cx1", prices=metrics.load_prices())["models"]}
        finally:
            c.execute("DELETE FROM requests WHERE session_id = 'cx1'")
            c.execute("DELETE FROM sessions WHERE session_id = 'cx1'")

    def test_codex_request_priced(self):
        # input_tokens 25,707 with 13,440 cached and 182 out; then a 300K prompt, above the 272K long-context threshold.
        m = self.codex_models(("gpt-6.1-sol", "high", False, 12_267, 182, 0, 13_440, 0, 0),
                              ("gpt-6-astra", "medium", False, 100_000, 1_000, 10, 150_000, 50_000, 0))
        self.assertAlmostEqual(m["gpt-6.1-sol"]["cost"], (12_267 * 2 + 182 * 10 + 13_440 * 0.1) / 1e6)
        self.assertAlmostEqual(m["gpt-6-astra"]["cost"], (100_000 * 20 + 1_000 * 75 + 150_000 * 2 + 50_000 * 25) / 1e6)


class SessionSortKeysTest(unittest.TestCase):
    """Sessions sorted by one to three keys. Fixture rows are (id, first_ts, compactions, prompts, model, output in millions):
    a request costs its output in millions times $10, and m-x has no price. The list's own order is newest first, e before f."""

    ROWS = [("f", "2026-11-05 09:00:00", 0, 2, "m-a", 1), ("e", "2026-11-05 09:00:00", 0, 2, "m-a", 1),
            ("d", "2026-11-04 09:00:00", 1, 2, "m-x", 3), ("c", "2026-11-03 09:00:00", 2, 3, "m-a", 5),
            ("b", "2026-11-02 09:00:00", 1, 1, "m-a", 2), ("a", "2026-11-01 09:00:00", 1, 2, "m-a", 1)]

    def store(self, rows):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        con = store.open_store(os.path.join(tmp, "x.duckdb"))
        self.addCleanup(con.close)
        c = con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "compactions", "peak_context", "peak_model"],
                     [(i, "p", ts, ts, comp, 10, "m-a") for i, ts, comp, _, _, _ in rows])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h", "thinking_ms"],
                     [(f"r-{i}", i, ts, model, None, False, 0, out * 1_000_000, 0, 0, 0, 0, 0) for i, ts, _, _, model, out in rows])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"],
                     [(f"p-{i}-{n}", i, ts, False) for i, ts, _, prompts, _, _ in rows for n in range(prompts)])
        return con

    def ids(self, con, **k):
        return [x["session_id"] for x in metrics.session_list(con.cursor(), prices=PRICES, today=TODAY, **k)["sessions"]]

    def test_two_and_three_keys_in_both_directions(self):
        con = self.store(self.ROWS)
        self.assertEqual(self.ids(con), list("efdcba"))
        # Ties after the last key keep the list's order (d is newer than a).
        self.assertEqual(self.ids(con, sort="-compactions,prompts"), list("cbdaef"))
        self.assertEqual(self.ids(con, sort="-compactions,-prompts"), list("cdabef"))
        self.assertEqual(self.ids(con, sort="compactions,prompts"), list("efbdac"))
        self.assertEqual(self.ids(con, sort="compactions,-prompts"), list("efdabc"))
        self.assertEqual(self.ids(con, sort="first_ts"), list("abcdef"))
        # The sort comes before the page.
        page = metrics.session_list(con.cursor(), sort="-compactions,prompts", offset=1, limit=2, prices=PRICES, today=TODAY)
        self.assertEqual((page["total"], [x["session_id"] for x in page["sessions"]]), (6, ["b", "d"]))
        self.assertEqual(self.ids(con, sort="-compactions,-prompts,tokens"), list("cadbef"))
        self.assertEqual(self.ids(con, sort="-compactions,-prompts,-tokens"), list("cdabef"))
        self.assertEqual(self.ids(con, sort="prompts,-tokens,compactions"), list("bdefac"))
        self.assertEqual(self.ids(con, sort="-prompts,tokens,-compactions"), list("caefdb"))

    def test_no_value_comes_last_for_each_key(self):
        con = self.store(self.ROWS)
        # d is unpriced: last under the second key and under the first, in either direction.
        self.assertEqual(self.ids(con, sort="-compactions,cost"), list("cabdef"))
        self.assertEqual(self.ids(con, sort="-compactions,-cost"), list("cbadef"))
        self.assertEqual(self.ids(con, sort="cost"), list("efabcd"))
        self.assertEqual(self.ids(con, sort="-cost"), list("cbefad"))
        self.assertEqual(self.ids(con, sort="-cost,-compactions"), list("cbaefd"))

    def test_earlier_form_equals_list_form(self):
        con = self.store(self.ROWS)
        for key in metrics.SESSION_SORTS:
            self.assertEqual(self.ids(con, sort=key, desc=True), self.ids(con, sort=f"-{key}"), key)
            self.assertEqual(self.ids(con, sort=key), self.ids(con, sort=key, desc=False), key)
        self.assertEqual(self.ids(con, sort="cost", desc=True), list("cbefad"))

    def test_ties_keep_the_lists_order_then_session_id(self):
        con = self.store(self.ROWS)
        # Nobody has a failed call: the list's own order stands, and e before f though f was stored first.
        self.assertEqual(self.ids(con, sort="-errors"), list("efdcba"))
        self.assertEqual(self.ids(con, sort="errors,-commits"), list("efdcba"))
        # On a selected day the list's order is costliest first; e and f cost the same, so the session id decides.
        self.assertEqual(self.ids(con, day="2026-11-05"), ["e", "f"])
        self.assertEqual(self.ids(con, day="2026-11-05", sort="-errors"), ["e", "f"])

    def test_session_id_never_reorders_sessions_that_start_apart(self):
        # Half a second is no tie: z started later than a, so it comes first, though a's id sorts first.
        con = self.store([("a", "2026-11-05 09:00:00.000", 0, 1, "m-a", 1), ("z", "2026-11-05 09:00:00.500", 0, 1, "m-a", 1),
                          ("m", "2026-11-05 09:00:00.000", 0, 1, "m-a", 1)])
        for sort in ("", "-errors", "-compactions,-cost"):
            self.assertEqual(self.ids(con, sort=sort), ["z", "a", "m"], sort)

    def test_a_fully_tied_list_pages_without_repeats(self):
        ids = [f"t{n:02d}" for n in reversed(range(25))]
        con = self.store([(i, "2026-11-05 09:00:00", 0, 1, "m-a", 1) for i in ids])
        for sort in ("-errors", "errors,-compactions", "-prompts,-cost,tokens", ""):
            pages = [self.ids(con, sort=sort, offset=o, limit=10) for o in (0, 10, 20)]
            self.assertEqual([len(p) for p in pages], [10, 10, 5], sort)
            self.assertEqual(sum(pages, []), sorted(ids), sort)

    def test_refusals(self):
        con = self.store(self.ROWS)
        for sort, desc, error in (("title", False, "unknown sort: title"), ("-title", False, "unknown sort: title"),
                                  ("cost,cost", False, "repeated sort key: cost"), ("cost,-cost", False, "repeated sort key: cost"),
                                  ("cost,", False, "empty sort key"), (",cost", False, "empty sort key"), ("-", False, "empty sort key"),
                                  (",", False, "empty sort key"),
                                  ("cost,tokens,prompts,errors", False, "too many sort keys: at most 3"),
                                  ("-cost,prompts", True, "desc cannot go with a sort list or a - key"),
                                  ("cost,prompts", True, "desc cannot go with a sort list or a - key"),
                                  ("-cost", True, "desc cannot go with a sort list or a - key")):
            with self.assertRaisesRegex(ValueError, error, msg=sort):
                metrics.session_list(con.cursor(), sort=sort, desc=desc, prices=PRICES, today=TODAY)


class RunRateTest(unittest.TestCase):
    """Project foo (Claude) costs $1 a day on Nov 1-19 and $100 today (Nov 20), and $5 on Oct 25; project bar (Codex) costs $2
    a day on Nov 10-19; project u has only an unpriced model. A request costs its input tokens in millions at $1."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source"], [
            ("f", "foo", "2026-10-25 09:00:00", "2026-11-20 09:30:00", "claude"),
            ("b", "bar", "2026-11-10 09:00:00", "2026-11-19 09:30:00", "codex"),
            ("u", "u", "2026-10-01 09:00:00", "2026-11-19 09:30:00", "claude")])
        M = 1_000_000
        req = lambda i, sid, ts, model, cost: (i, sid, ts, model, False, int(cost * M), 0, 0, 0, 0, 0)
        reqs = [req("o", "f", "2026-10-25 12:00:00", "m-a", 5), req("t", "f", "2026-11-20 12:00:00", "m-a", 100)]
        reqs += [req(f"f{n}", "f", f"2026-11-{n:02d} 12:00:00", "m-a", 1) for n in range(1, 20)]
        reqs += [req(f"b{n}", "b", f"2026-11-{n:02d} 12:00:00", "m-a", 2) for n in range(10, 20)]
        reqs += [req(f"u{n}", "u", f"2026-11-{n:02d} 12:00:00", "m-unknown", 1) for n in range(1, 20)]
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], reqs)
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"],
                     [(f"p{s}", s, "2026-10-25 09:00:00", False) for s in "fbu"])  # a session with no prompt is a helper

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def rate(self, today=date(2026, 11, 20), **k):
        return metrics.run_rate(self.con.cursor(), k.pop("project", ""), PRICES, today, **k)

    def test_month_so_far_plus_recent_mean_over_days_left(self):
        r = self.rate()  # today's $100 is left out; Nov 13-19 average $3; Nov 1-19 cost 19 + 20; Nov 20-30 is 11 days
        self.assertEqual((r["month_cost"], r["daily_avg"], r["days_left"], r["projected"]), (39, 3, 11, 72))

    def test_splits_by_agent_over_the_same_days(self):
        r = self.rate()  # foo (Claude): Nov 1-19 $19, Nov 13-19 $1 a day; bar (Codex): Nov 10-19 $20, $2 a day
        by = {s["source"]: s for s in r["by_source"]}
        self.assertEqual((by["claude"]["month_cost"], by["claude"]["projected"]), (19, 19 + 11))
        self.assertEqual((by["codex"]["month_cost"], by["codex"]["projected"]), (20, 20 + 2 * 11))
        self.assertAlmostEqual(sum(s["projected"] for s in r["by_source"]), r["projected"])
        self.assertEqual([s["source"] for s in self.rate(source="codex")["by_source"]], ["codex"])

    def test_project_and_source_filters_apply_and_the_range_does_not(self):
        self.assertEqual(self.rate(project="foo")["projected"], 19 + 11)
        self.assertEqual(self.rate(source="codex")["projected"], 20 + 2 * 11)
        self.assertEqual(self.rate(project="foo", source="codex"), None)
        u = metrics.usage(self.con.cursor(), "foo", 7, prices=PRICES, today=date(2026, 11, 20))
        self.assertEqual(u["run_rate"], self.rate(project="foo"))

    def test_first_of_the_month_projects_from_the_average_alone(self):
        r = self.rate(date(2026, 11, 1), project="foo")  # Oct 25-31 holds one $5 day
        self.assertEqual((r["month_cost"], r["days_left"]), (0, 30))
        self.assertAlmostEqual(r["projected"], 5 / 7 * 30)

    def test_needs_seven_days_of_priced_history(self):
        self.assertIsNone(self.rate(date(2026, 10, 28), project="foo"))
        self.assertIsNone(self.rate(project="nope"))
        self.assertIsNone(self.rate(project="u"))  # unpriced history: no projection


class SourceFilterTest(unittest.TestCase):
    """One day (Nov 5) with a Claude session (c1, 1,000,000 tokens) and a Codex session (x1, 200,000 tokens) in project foo,
    each with one failed tool call."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source"], [
            ("c1", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00", "claude"),
            ("x1", "foo", "2026-11-05 10:00:00", "2026-11-05 10:30:00", "codex")])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [
            ("rc", "c1", "2026-11-05 09:01:00", "m-a", False, 400_000, 100_000, 0, 500_000, 0, 0),
            ("rx", "x1", "2026-11-05 10:01:00", "m-a", False, 50_000, 30_000, 10_000, 120_000, 0, 0)])
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            ("tc", "c1", "Bash", "2026-11-05 09:02:00", "2026-11-05 09:02:01", True, "x", False),
            ("tx", "x1", "exec_command", "2026-11-05 10:02:00", "2026-11-05 10:02:01", True, "x", False)])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [
            ("pc", "c1", "2026-11-05 09:00:00", False), ("px", "x1", "2026-11-05 10:00:00", False)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def usage(self, source=""):
        return metrics.usage(self.con.cursor(), "", 7, prices=PRICES, today=TODAY, source=source)

    def test_all_sources_add_up(self):
        u = self.usage()
        self.assertEqual(u["source"], "")
        self.assertEqual({d["day"]: d["input"] + d["output"] + d["cache_read"] for d in u["daily"]}, {"2026-11-05": 1_200_000})
        self.assertEqual((u["totals"]["tokens"], u["totals"]["sessions"], u["totals"]["prompts"], u["totals"]["errors"]), (1_200_000, 2, 2, 2))
        cost = {d["day"]: d["cost"] for d in u["daily"]}
        for rows in (u["daily_models"], u["daily_sources"]):
            self.assertAlmostEqual(sum(r["cost"] for r in rows), cost["2026-11-05"])
        self.assertEqual({r["source"] for r in u["daily_sources"]}, {"claude", "codex"})  # the Codex session lands under codex
        self.assertEqual([r["model"] for r in u["daily_models"]], ["m-a"])
        self.assertEqual({r["source"] for r in self.usage("codex")["daily_sources"]}, {"codex"})

    def test_each_source_alone(self):
        for source, sid, tokens, tool in (("claude", "c1", 1_000_000, "Bash"), ("codex", "x1", 200_000, "exec_command")):
            u = self.usage(source)
            self.assertEqual(u["source"], source)
            self.assertEqual((u["totals"]["tokens"], u["totals"]["sessions"], u["totals"]["prompts"], u["totals"]["errors"]), (tokens, 1, 1, 1))
            self.assertEqual([x["session_id"] for x in u["sessions"]], [sid])
            self.assertEqual([t["tool"] for t in u["tools"]], [tool])
            self.assertEqual([(r["project"], r["tokens"]) for r in u["by_project"]], [("foo", tokens)])
            listed = metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY, source=source)
            self.assertEqual([x["session_id"] for x in listed["sessions"]], [sid])
            cal = metrics.calendar(self.con.cursor(), today=TODAY, source=source)
            self.assertEqual((cal["source"], cal["days"], cal["first"]), (source, u["daily_work"], "2026-11-05"))
        grok = metrics.calendar(self.con.cursor(), today=TODAY, source="grok")  # no Grok session here
        self.assertEqual((grok["days"], grok["first"]), ([], None))
        prev = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=date(2026, 11, 6), source="codex")["previous"]
        self.assertEqual((prev["tokens"], prev["sessions"]), (200_000, 1))

    def test_new_fields_for_each_source(self):
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error", "category",
                                       "subagent", "is_test", "test_passed"], [
            ("tt", "x1", "exec_command", "npm test", "2026-11-05 10:03:00", "2026-11-05 10:03:05", True, "tests", False, True, False)])
        try:
            for source, sid, calls, failed in (("claude", "c1", 1, []), ("codex", "x1", 2, ["tt"])):
                u = self.usage(source)
                self.assertEqual(u["work_bucket"], "day")
                self.assertEqual(u["work"], [dict(day="2026-11-05", sessions=1, prompts=1, commits=0, calls=calls, failed_calls=calls)])
                self.assertEqual(u["work_projects"], [dict(u["work"][0], project="foo")])
                self.assertEqual([(r["id"], r["session_id"], r["source"]) for r in u["failed_tests"]], [(x, sid, source) for x in failed])
                self.assertIsNone(u["automated_file"]["error"])
                prev = metrics.usage(c, "", 1, prices=PRICES, today=date(2026, 11, 6), source=source)["previous"]
                self.assertEqual((prev["prompts"], prev["calls"], prev["errors"], prev["tests_passed"]), (1, calls, calls, 0))
                day = metrics.day_view(c, "", 7, "2026-11-05", today=TODAY, source=source)
                self.assertEqual(sum(t["calls"] for t in day["tools"]), calls)
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id = 'tt'")

    def test_errors_payload_tags_sources(self):
        p = metrics.errors_payload(self.con.cursor(), today=TODAY)
        self.assertEqual(p["today"], "2026-11-05")  # the page's ranges end on it
        self.assertEqual({e["id"]: e["src"] for e in p["errors"]}, {"tc": "claude", "tx": "codex"})
        self.assertEqual(p["calls"], [["2026-11-05", "foo", 1, 0, "claude"], ["2026-11-05", "foo", 1, 0, "codex"]])
        self.assertEqual(p["error_days"], [["2026-11-05", "foo", "x", 1, 0, "claude"], ["2026-11-05", "foo", "x", 1, 0, "codex"]])

    def test_api_reads_source_param(self):
        get = serve(self, self.con, self.tmp)
        self.assertEqual(get("/api/usage?range=0")[1]["totals"]["tokens"], 1_200_000)
        self.assertEqual(get("/api/usage?range=0&source=codex")[1]["totals"]["tokens"], 200_000)
        self.assertEqual(get("/api/sessions?source=claude")[1]["total"], 1)
        for path, error in (("/api/sessions?sort=title", "unknown sort: title"), ("/api/day", "Invalid isoformat string: ''"),
                            ("/api/day?day=nope", "Invalid isoformat string: 'nope'"), ("/api/day?day=2026-11-05&source=gemini", "unknown source: gemini"),
                            ("/api/usage?source=gemini", "unknown source: gemini"), ("/api/sessions?source=gemini", "unknown source: gemini")):
            self.assertEqual(get(path), (400, dict(error=error)), path)
        for path in ("/api/usage?source=grok", "/api/sessions?source=grok"):
            self.assertEqual(get(path)[0], 200, path)


class SpeedTrendByWeekTest(unittest.TestCase):
    """Output speed per week over all time (work from Sep 1 to Nov 17, 2026: by week). Each week sums its sessions' output
    and model time before dividing: the week of Oct 5 is 120,000 tokens over 1,800 s, not the mean of 50 and 75 per second."""

    def test_three_timed_weeks(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        con = store.open_store(os.path.join(tmp, "x.duckdb"))
        self.addCleanup(con.close)
        con.execute("SET GLOBAL TimeZone = 'UTC'")
        c = con.cursor()
        runs = [("s1", "2026-09-01 10:00:00", 60_000, 10), ("s2", "2026-10-06 10:00:00", 30_000, 10),
                ("s3", "2026-10-08 10:00:00", 90_000, 20), ("s4", "2026-11-17 10:00:00", 40_000, 5)]
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [(s, "foo", ts, ts) for s, ts, _, _ in runs])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("p" + s, s, ts, False) for s, ts, _, _ in runs])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [("r" + s, s, ts, "m-a", False, 1, out, 0, 0, 0, 0) for s, ts, out, _ in runs])
        store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"],
                     [(s, 1, mins * 60_000, 0, 0, 0) for s, _, _, mins in runs])
        u = metrics.usage(con.cursor(), "", 0, prices=PRICES, today=date(2026, 11, 19))
        self.assertEqual(u["work_bucket"], "week")
        self.assertEqual([(r["day"], round(r["output_per_s"], 1), r["sessions"]) for r in u["speed_trend"]],
                         [("2026-08-31", 100.0, 1), ("2026-10-05", 66.7, 2), ("2026-11-16", 133.3, 1)])


class WeekClipTest(unittest.TestCase):
    """A week the range cuts: a 2-day view ending Thursday Nov 19, 2026 starts on Wednesday Nov 18, inside the week of
    Monday Nov 16. s works 15 minutes on Tuesday (before the range), 5 on Wednesday and, future-dated, on Friday."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "x.duckdb"))
        cls.con.execute("SET GLOBAL TimeZone = 'UTC'")
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("s", "foo", "2026-11-17 10:00:00", "2026-11-20 10:05:00")])
        times = ["2026-11-17 10:00:00", "2026-11-17 10:05:00", "2026-11-17 10:10:00", "2026-11-17 10:15:00",
                 "2026-11-18 10:00:00", "2026-11-18 10:05:00", "2026-11-20 10:00:00", "2026-11-20 10:05:00"]
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [(f"r{i}", "s", t, "m-a", False, 10, 0, 0, 0, 0, 0) for i, t in enumerate(times)])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [(f"p{i}", "s", t, False) for i, t in enumerate(times[::2])])
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent",
                                       "is_test", "test_passed"], [
            ("t0", "s", "Bash", "2026-11-17 10:01:00", "2026-11-17 10:01:01", True, "x", False, True, False),
            ("t1", "s", "Bash", "2026-11-18 10:01:00", "2026-11-18 10:01:01", False, None, False, False, None),
            ("t2", "s", "Bash", "2026-11-20 10:01:00", "2026-11-20 10:01:01", True, "x", False, True, False)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def test_a_week_counts_only_its_days_in_the_range(self):
        today = date(2026, 11, 19)
        got = metrics.session_list(self.con.cursor(), "", 2, day="2026-11-16", days=7, prices=PRICES, today=today)["sessions"]
        self.assertEqual([(x["duration_s"], x["requests"], x["prompts"], x["tool_calls"], x["tests_failed"]) for x in got], [(300, 2, 1, 1, 0)])
        week = metrics.day_view(self.con.cursor(), "", 2, "2026-11-16", today=today, days=7, prices=PRICES)
        self.assertEqual((week["start"], week["end"], week["tests_failed"], week["failed_tests"]), ("2026-11-18", "2026-11-19", 0, []))
        self.assertEqual([(t["tool"], t["calls"]) for t in week["tools"]], [("Bash", 1)])
        self.assertEqual([(p["sessions"], p["calls"], p["prompts"]) for p in week["by_project"]], [(1, 1, 1)])
        # All time still ends today: Friday's future-dated work stays out of the week.
        got = metrics.session_list(self.con.cursor(), "", 0, day="2026-11-16", days=7, prices=PRICES, today=today)["sessions"]
        self.assertEqual([(x["duration_s"], x["requests"], x["tests_failed"]) for x in got], [(1200, 6, 1)])
        one = metrics.day_view(self.con.cursor(), "", 2, "2026-11-18", today=today, prices=PRICES)
        self.assertEqual((one["start"], one["end"]), ("2026-11-18", "2026-11-18"))
        with self.assertRaises(ValueError):  # a span needs a day
            metrics.session_list(self.con.cursor(), days=7, prices=PRICES, today=today)


class LocalDayTest(unittest.TestCase):
    """Days on the server's clock, here America/Los_Angeles, the day after US daylight saving starts (Mar 8, 2026).
    z1 works at 06:30 UTC on Mar 9 (23:30 on Mar 8, local), z2 at 07:30 UTC (00:30 on Mar 9, local; 23:30 at a fixed -8)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        cls.con.execute("SET GLOBAL TimeZone = 'America/Los_Angeles'")
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [
            ("z1", "foo", "2026-03-09 06:30:00", "2026-03-09 06:30:01"), ("z2", "foo", "2026-03-09 07:30:00", "2026-03-09 07:30:01")])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [
            ("ra", "z1", "2026-03-09 06:30:00", "m-a", False, 100, 0, 0, 0, 0, 0),
            ("rb", "z2", "2026-03-09 07:30:00", "m-a", False, 200, 0, 0, 0, 0, 0)])
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            ("ta", "z1", "Bash", "2026-03-09 06:30:00", "2026-03-09 06:30:01", True, "x", False),
            ("tb", "z2", "Bash", "2026-03-09 07:30:00", "2026-03-09 07:30:01", True, "x", False)])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [
            ("pa", "z1", "2026-03-09 06:30:00", False), ("pb", "z2", "2026-03-09 07:30:00", False)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def test_usage_buckets_and_bounds_local_days(self):
        u = metrics.usage(self.con.cursor(), "", 0, prices=PRICES, today=date(2026, 3, 9))
        self.assertEqual([(d["day"], d["input"]) for d in u["daily"]], [("2026-03-08", 100), ("2026-03-09", 200)])
        self.assertEqual([(d["day"], d["prompts"], d["failed_calls"]) for d in u["daily_work"]], [("2026-03-08", 1, 1), ("2026-03-09", 1, 1)])
        self.assertEqual(u["totals"]["active_days"], 2)
        u = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=date(2026, 3, 9))
        self.assertEqual((u["start"], u["totals"]["tokens"], u["totals"]["prompts"], u["totals"]["errors"]), ("2026-03-09", 200, 1, 1))
        self.assertEqual((u["previous"]["start"], u["previous"]["tokens"]), ("2026-03-08", 100))
        self.assertEqual([d["day"] for d in u["previous"]["daily"]], ["2026-03-08"])

    def test_weeks_and_hours_are_local(self):
        # 68 days from Mar 8 to May 15: by week. z1 works late on Sunday Mar 8 (Monday in UTC), so in the week of Mar 2;
        # z2 just after midnight on Monday Mar 9.
        u = metrics.usage(self.con.cursor(), "", 0, prices=PRICES, today=date(2026, 5, 15))
        self.assertEqual(u["work_bucket"], "week")
        self.assertEqual([(r["day"], r["sessions"], r["prompts"]) for r in u["work"]], [("2026-03-02", 1, 1), ("2026-03-09", 1, 1)])
        self.assertEqual([(r["day"], r["project"]) for r in u["work_projects"]], [("2026-03-02", "foo"), ("2026-03-09", "foo")])
        # The week of Mar 2 as a span: Sunday's late session only, by its local day.
        week = metrics.session_list(self.con.cursor(), day="2026-03-02", days=7, prices=PRICES, today=date(2026, 5, 15))
        self.assertEqual([x["session_id"] for x in week["sessions"]], ["z1"])

    def test_day_lists_by_local_day(self):
        for day, sid in (("2026-03-08", "z1"), ("2026-03-09", "z2")):
            got = metrics.day_view(self.con.cursor(), day=day, today=date(2026, 3, 9))
            self.assertEqual([(t["tool"], t["calls"]) for t in got["tools"]], [("Bash", 1)], day)
            got = metrics.session_list(self.con.cursor(), day=day, prices=PRICES, today=date(2026, 3, 9))
            self.assertEqual([x["session_id"] for x in got["sessions"]], [sid], day)

    def test_errors_payload_dates_local_days(self):
        p = metrics.errors_payload(self.con.cursor(), today=date(2026, 3, 9))
        self.assertEqual({e["id"]: e["d"] for e in p["errors"]}, {"ta": "2026-03-08", "tb": "2026-03-09"})
        self.assertEqual([r[0] for r in p["calls"]], ["2026-03-08", "2026-03-09"])
        self.assertEqual([r[0] for r in p["error_days"]], ["2026-03-08", "2026-03-09"])

    def test_day_starts_follow_daylight_saving(self):
        cur = self.con.cursor()
        self.assertEqual(metrics.start_ts(cur, date(2026, 3, 8)), datetime(2026, 3, 8, 8))  # PST, UTC-8
        self.assertEqual(metrics.start_ts(cur, date(2026, 3, 9)), datetime(2026, 3, 9, 7))  # PDT, UTC-7
        self.assertEqual(metrics.local_today(cur), datetime.now(ZoneInfo("America/Los_Angeles")).date())


class HelperSessionTest(unittest.TestCase):
    """Automated sessions outside AUTOMATED_PROJECTS. foo: w1 (two prompts on Nov 4, a request alone on Nov 5) and n1 (no
    prompt, a request on Nov 3). (temp): h1 (one prompt, an app's helper) and t2 (two prompts, a person's)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [
            ("w1", "foo", "2026-11-04 10:00:00", "2026-11-05 10:00:00"), ("n1", "foo", "2026-11-03 10:00:00", "2026-11-03 10:00:00"),
            ("h1", "(temp)", "2026-11-04 11:00:00", "2026-11-04 11:00:03"), ("t2", "(temp)", "2026-11-04 12:00:00", "2026-11-04 12:10:00")])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [
            (f"r{i}", sid, ts, "m-a", False, 1, 0, 0, 0, 0, 0) for i, (sid, ts) in enumerate([
                ("w1", "2026-11-04 10:00:00"), ("w1", "2026-11-05 10:00:00"), ("n1", "2026-11-03 10:00:00"),
                ("h1", "2026-11-04 11:00:00"), ("t2", "2026-11-04 12:00:00")])])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [
            ("p1", "w1", "2026-11-04 10:00:00", False), ("p2", "w1", "2026-11-04 10:30:00", False),
            ("p3", "h1", "2026-11-04 11:00:00", False),
            ("p4", "t2", "2026-11-04 12:00:00", False), ("p5", "t2", "2026-11-04 12:05:00", False)])
        # Bash ran 2 s; exec_command has no usable timing (start equals end).
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "subagent"], [
            ("c1", "w1", "Bash", "2026-11-04 10:01:00", "2026-11-04 10:01:02", False, False),
            ("c2", "w1", "exec_command", "2026-11-04 10:02:00", "2026-11-04 10:02:00", False, False)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def usage(self, **k):
        return metrics.usage(self.con.cursor(), **dict(prices=PRICES, today=TODAY) | k)

    def test_helpers_and_promptless_sessions_are_automated(self):
        u, auto = self.usage(), self.usage(automated=True)
        self.assertEqual(sorted(x["session_id"] for x in u["sessions"]), ["t2", "w1"])
        self.assertEqual(sorted(x["session_id"] for x in auto["sessions"]), ["h1", "n1", "t2", "w1"])
        # Naming (temp) keeps its helpers out: only a whole automated project is let in by name.
        self.assertEqual([x["session_id"] for x in self.usage(project="(temp)")["sessions"]], ["t2"])
        listed = lambda **k: metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY, **k)["total"]
        self.assertEqual((listed(), listed(automated=True)), (2, 4))
        pal = metrics.palette(self.con.cursor(), today=TODAY)
        self.assertEqual({p["name"]: p["sessions"] for p in pal["projects"]}, {"foo": 1, "(temp)": 1})

    def test_active_days_count_days_with_a_prompt(self):
        self.assertEqual(self.usage()["totals"]["active_days"], 1)  # Nov 5 has a request but no prompt
        self.assertEqual(self.usage(range_days=1, today=date(2026, 11, 6))["previous"]["active_days"], 0)

    def test_no_latency_without_timing(self):
        self.assertEqual({t["tool"]: t["p50_ms"] for t in self.usage()["tools"]}, {"Bash": 2000, "exec_command": None})


class SessionRunsTest(unittest.TestCase):
    """Project foo on Nov 4: Claude sessions a (30 min of model time, 20 of tools; also an earlier request outside a 7-day
    view) and b (10 and 5 min), c recording none, and Codex session x. Project bar: d, the session sheet's spec scenario."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source"], [
            (s, "bar" if s == "d" else "foo", "2026-10-20 09:00:00", "2026-11-04 11:00:00", "codex" if s == "x" else "claude") for s in "abcdx"])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"],
                     [("p" + s, s, "2026-11-04 09:00:00", False) for s in "abcdx"])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [
            ("qa0", "a", "2026-10-20 09:01:00", "m-a", False, 1, 50_000, 0, 0, 0, 0),  # outside a 7-day view
            ("qa1", "a", "2026-11-04 09:01:00", "m-a", True, 1, 100_000, 0, 0, 0, 0),  # a subagent's
            ("qb", "b", "2026-11-04 09:01:00", "m-a", False, 1, 85_200, 0, 0, 0, 0),
            ("qc", "c", "2026-11-04 09:01:00", "m-a", False, 1, 500_000, 0, 0, 0, 0),
            ("qd", "d", "2026-11-04 09:01:00", "m-a", False, 1, 81_000, 0, 0, 0, 0),
            ("qx", "x", "2026-11-04 09:01:00", "m-a", False, 1, 7_000, 0, 0, 0, 0)])
        mn = 60_000
        store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"], [
            ("a", 1, 20 * mn, 15 * mn, 100, 20), ("a", 2, 10 * mn, 5 * mn, 20, 10),  # two runs, summed
            ("b", 1, 10 * mn, 5 * mn, 0, 0), ("d", 1, 15 * mn, 6 * mn, 120, 30)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def totals(self, source="", today=TODAY, prev=False):
        u = metrics.usage(self.con.cursor(), "foo", 7, prices=PRICES, today=today, source=source)
        t = u["previous"] if prev else u["totals"]
        return {k: t[k] for k in (("output_per_s",) if prev else ("model_ms", "tool_ms", "timed_sessions", "output_per_s"))}

    def test_model_and_tool_time_and_output_speed(self):
        # 40 minutes waiting on the model and 25 running tools; c counts in neither. 235,200 tokens over 2,400 s is 98 per second.
        self.assertEqual(self.totals(), dict(model_ms=40 * 60_000, tool_ms=25 * 60_000, timed_sessions=2, output_per_s=98.0))
        self.assertEqual(self.totals(today=date(2026, 11, 11), prev=True), dict(output_per_s=98.0))  # the previous period counts the same way
        # Nothing recorded (x, the Codex session): zero time and no speed. The view's sessions' sources say why: priced or not, each counts.
        self.assertEqual(self.totals(source="codex"), dict(model_ms=0, tool_ms=0, timed_sessions=0, output_per_s=None))
        self.assertEqual(self.totals(source="codex", today=date(2026, 11, 11), prev=True)["output_per_s"], None)
        u = lambda source: metrics.usage(self.con.cursor(), "foo", 7, prices=PRICES, today=TODAY, source=source)["totals"]["session_sources"]
        self.assertEqual((u(""), u("codex")), (["claude", "codex"], ["codex"]))

    def test_a_session_cut_by_the_range_counts_its_whole_output(self):
        runs = {r["session_id"]: r for r in metrics.rows(self.con.cursor(), f"WITH {metrics.runs_cte('SELECT session_id FROM sessions')} SELECT * FROM runs")}
        self.assertEqual((runs["a"]["model_ms"], runs["a"]["tool_ms"], runs["a"]["output"]), (30 * 60_000, 20 * 60_000, 150_000))
        self.assertEqual({sid: r["output"] for sid, r in runs.items()}, dict(a=150_000, b=85_200, d=81_000))  # c and x record no run
        listed = metrics.session_list(self.con.cursor(), "foo", 7, prices=PRICES, today=TODAY)["sessions"]
        self.assertEqual({x["session_id"] for x in listed}, set("abcx"))
        # The sessions list carries each session's whole model time and speed; c and x record none.
        self.assertEqual({x["session_id"]: (x["model_ms"], x["output_per_s"]) for x in listed},
                         dict(a=(30 * 60_000, 150_000 / 1800), b=(10 * 60_000, 142.0), c=(None, None), x=(None, None)))
        for x in listed:
            self.assertFalse({"tool_ms", "timed_output"} & x.keys(), x["session_id"])

    def test_sort_by_model_time_and_output_speed(self):
        ids = lambda **k: [x["session_id"] for x in metrics.session_list(self.con.cursor(), "foo", 7, prices=PRICES, today=TODAY, **k)["sessions"]]
        # a: 30 min at 83.3 tok/s; b: 10 min at 142; c and x record no model time and come last both ways, newest first.
        self.assertEqual(ids(sort="output_per_s", desc=True)[:2], ["b", "a"])
        self.assertEqual(ids(sort="output_per_s")[:2], ["a", "b"])
        self.assertEqual(ids(sort="model_ms", desc=True)[:2], ["a", "b"])
        self.assertEqual(ids(sort="model_ms")[:2], ["b", "a"])
        for key in ("output_per_s", "model_ms"):
            for desc in (False, True):
                self.assertEqual(set(ids(sort=key, desc=desc)[2:]), {"c", "x"}, (key, desc))
        self.assertEqual(ids(sort="output_per_s", source="codex"), ["x"])
        # A session with a run but no model time sorts with those that record none.
        c = self.con.cursor()
        store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"], [("c", 9, 0, 0, 0, 0)])
        try:
            self.assertEqual(set(ids(sort="output_per_s", desc=True)[2:]), {"c", "x"})
            self.assertEqual(set(ids(sort="model_ms")[2:]), {"c", "x"})
            # Its output stays out of the vital and the trend too: they read 98 tok/s from a and b alone, as the rows do.
            self.assertEqual(self.totals()["output_per_s"], 98.0)
            self.assertEqual(metrics.usage(c, "foo", 7, prices=PRICES, today=TODAY)["speed_trend"][0]["output_per_s"], 98.0)
        finally:
            c.execute("DELETE FROM session_runs WHERE session_id = 'c'")

    def test_speed_trend(self):
        trend = lambda r, source="": metrics.usage(self.con.cursor(), "foo", r, prices=PRICES, today=TODAY, source=source)["speed_trend"]
        # Over 7 days, a and b both start on Nov 4: one bucket at the total's 98 per second.
        self.assertEqual(trend(7), [dict(day="2026-11-04", output_per_s=98.0, sessions=2)])
        # Over all time, a's first request in the view is on Oct 20, so its whole output and model time count there.
        self.assertEqual([(r["day"], round(r["output_per_s"], 1), r["sessions"]) for r in trend(0)],
                         [("2026-10-20", 83.3, 1), ("2026-11-04", 142.0, 1)])
        self.assertEqual(trend(7, "codex"), [])

    def test_session_sheet(self):
        info = metrics.session(self.con.cursor(), "d", prices=PRICES)["info"]
        self.assertEqual(info["runs"], dict(model_ms=15 * 60_000, tool_ms=6 * 60_000, lines_added=120, lines_removed=30, output_per_s=90.0))
        self.assertFalse({"output", "model_ms", "tool_ms", "output_per_s"} & info.keys())
        self.assertIsNone(metrics.session(self.con.cursor(), "x", prices=PRICES)["info"]["runs"])  # a Codex session records no run


class RunsWithoutToolTimeTest(unittest.TestCase):
    """A session whose runs state API time only, as Grok's do: tool time and lines stay None, never 0."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.con = store.open_store(os.path.join(self.tmp, "d", "x.duckdb"))
        c = self.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source"],
                     [("g", "foo", "2026-11-04 09:00:00", "2026-11-04 11:00:00", "claude")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [("pg", "g", "2026-11-04 09:00:00", False)])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"],
                     [("qg", "g", "2026-11-04 09:01:00", "m-a", False, 1, 100_000, 0, 0, 0, 0)])
        store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"],
                     [("g", 1, 1_000_000, None, None, None)])

    def tearDown(self):
        self.con.close()
        shutil.rmtree(self.tmp)

    # The session sheet's runs: test_grok.RunTest.test_output_speed, through the parser.
    def test_totals_and_list(self):
        u = metrics.usage(self.con.cursor(), "foo", 7, prices=PRICES, today=TODAY)
        t = u["totals"]
        self.assertEqual((t["model_ms"], t["tool_ms"], t["timed_sessions"], t["output_per_s"]), (1_000_000, None, 1, 100.0))
        self.assertEqual([(r["day"], r["output_per_s"]) for r in u["speed_trend"]], [("2026-11-04", 100.0)])
        rows = metrics.session_list(self.con.cursor(), today=TODAY)["sessions"]
        self.assertEqual([(r["model_ms"], r["output_per_s"]) for r in rows], [(1_000_000, 100.0)])


class SessionTimeTest(unittest.TestCase):
    """A session resumed the next day: main-thread requests and tool calls 10, 15 and 5 minutes apart, and a 22-hour
    pause between the first and second day. A subagent request in the pause doesn't end it."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("a", "foo", "2026-11-04 10:00:00", "2026-11-05 09:05:00")])
        store.insert(c, "prompts", ["prompt_id", "session_id", "ts"], [("p", "a", "2026-11-04 10:00:00")])
        store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                     "cache_read", "cache_5m", "cache_1h"], [
            ("q1", "a", "2026-11-04 10:00:00", "m-a", False, 1, 0, 0, 0, 0, 0),
            ("q2", "a", "2026-11-04 10:10:00", "m-a", False, 1, 0, 0, 0, 0, 0),
            ("q3", "a", "2026-11-04 12:00:00", "m-a", True, 1, 0, 0, 0, 0, 0),
            ("q4", "a", "2026-11-05 09:00:00", "m-a", False, 1, 0, 0, 0, 0, 0)])
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "subagent"], [
            ("c1", "a", "Bash", "2026-11-04 10:25:00", "2026-11-04 10:25:01", False, False),
            ("c2", "a", "Bash", "2026-11-05 09:05:00", "2026-11-05 09:05:01", False, False)])

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def test_duration_is_active_time(self):
        u = metrics.usage(self.con.cursor(), "", 0, prices=PRICES, today=TODAY)
        self.assertEqual(u["sessions"][0]["duration_s"], 600 + 900 + 300)
        self.assertEqual(u["totals"]["session_seconds"], 1800)
        # A 1-day view still measures the whole session.
        u = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY)
        self.assertEqual(u["sessions"][0]["duration_s"], 1800)
        # A day's list measures that day alone: Nov 4 holds 10 and 15 minutes, Nov 5 five.
        for day, active in (("2026-11-04", 600 + 900), ("2026-11-05", 300)):
            got = metrics.session_list(self.con.cursor(), day=day, prices=PRICES, today=TODAY)["sessions"]
            self.assertEqual([x["duration_s"] for x in got], [active], day)
        # The session sheet shows the same active time, not first to last.
        self.assertEqual(metrics.session(self.con.cursor(), "a", prices=PRICES)["info"]["active_s"], 1800)


class ToolDetailTest(unittest.TestCase):
    """The tool inspector's fixture. Project foo: f1 (Nov 4) runs Bash (git 20 times, npm test 10 times with four failures
    in a row at the end, then ls), Edit, Read, Grep (failed, then recovered), WebFetch from subagents, the github MCP server
    and the ship and review skills; f2 (Nov 5) has a failed WebFetch and a Grep failure it gives up on; old (Oct 20) runs
    make; p1 (Sep 20, the previous 30 days) runs ls 20 times with one failure; x1 is a Codex session. Project bar: b1 (Nov 4)
    runs git and gives up on a failed Grep."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source"], [
            ("f1", "foo", "2026-11-04 10:00:00", "2026-11-04 12:00:00", "claude"),
            ("f2", "foo", "2026-11-05 09:00:00", "2026-11-05 10:00:00", "claude"),
            ("old", "foo", "2026-10-20 09:00:00", "2026-10-20 10:00:00", "claude"),
            ("p1", "foo", "2026-09-20 09:00:00", "2026-09-20 10:00:00", "claude"),
            ("x1", "foo", "2026-11-04 09:00:00", "2026-11-04 10:00:00", "codex"),
            ("b1", "bar", "2026-11-04 09:00:00", "2026-11-04 10:00:00", "claude")])
        store.insert(c, "prompts", ["prompt_id", "session_id"], [(f"p-{sid}", sid) for sid in ("f1", "f2", "old", "p1", "x1", "b1")])
        clock, out = {}, []

        def call(sid, day, tool, inp="", cat=None, sub=False, mcp=None, skill=None, test=False, commit=False, ms=1000):
            """One call, a minute after the session's previous one (from 10:00 on day). cat: failed with that category."""
            n = clock[sid] = clock.get(sid, -1) + 1
            start = f"{day} {10 + n // 60:02d}:{n % 60:02d}:00"
            out.append((f"{sid}-{n:02d}", sid, tool, mcp, skill, inp, start, f"{day} {10 + n // 60:02d}:{n % 60:02d}:{ms // 1000:02d}",
                        cat is not None, cat, sub, commit, test, cat is None))

        for _ in range(19):
            call("f1", "2026-11-04", "Bash", "git status")
        call("f1", "2026-11-04", "Bash", "git commit -m x", commit=True)
        for i in range(10):
            call("f1", "2026-11-04", "Bash", "npm test", cat="tests" if i >= 6 else None, test=True, ms=10_000)
        call("f1", "2026-11-04", "Bash", "ls")
        for path in ("/r/a.py", "/r/b.py", "/r/c.tsx"):
            call("f1", "2026-11-04", "Edit", path)
        call("f1", "2026-11-04", "Read", "/r/Makefile")
        call("f1", "2026-11-04", "Grep", "def foo", cat="search_empty")
        call("f1", "2026-11-04", "Grep", "def foo")
        call("f1", "2026-11-04", "WebFetch", "https://docs.python.org/3/", sub=True)
        call("f1", "2026-11-04", "WebFetch", "https://docs.python.org/3/library/", sub=True)
        call("f1", "2026-11-04", "mcp__github__search_issues", '{"q": "bug"}', mcp="github", cat="infra")
        call("f1", "2026-11-04", "mcp__github__search_issues", '{"q": "bug"}', mcp="github")
        call("f1", "2026-11-04", "mcp__github__get_pr", '{"n": 1}', mcp="github")
        call("f1", "2026-11-04", "Skill", "ship", skill="ship", cat="bad_call")
        call("f1", "2026-11-04", "Skill", "ship", skill="ship")
        call("f1", "2026-11-04", "Skill", "review", skill="review")
        call("f2", "2026-11-05", "WebFetch", "https://docs.python.org/3/library/re.html", cat="infra")
        call("f2", "2026-11-05", "Grep", "class Bar", cat="search_empty")
        call("old", "2026-10-20", "Bash", "make")
        for i in range(20):
            call("p1", "2026-09-20", "Bash", "ls", cat="no_file" if i == 0 else None)
        call("x1", "2026-11-04", "exec_command", "npm test", test=True)
        call("b1", "2026-11-04", "Bash", "git status")
        call("b1", "2026-11-04", "Grep", "x", cat="search_empty")
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                                       "is_error", "category", "subagent", "is_commit", "is_test", "test_passed"], out)

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def detail(self, kind, name, project="", range_days=0, **k):
        return metrics.tool_detail(self.con.cursor(), kind, name, project, range_days, TODAY, **k)

    def test_filtered_view(self):
        d = self.detail("tool", "Bash", "foo", 7)
        self.assertEqual((d["kind"], d["name"], d["start"], d["end"]), ("tool", "Bash", "2026-10-30", "2026-11-05"))
        self.assertEqual((d["totals"]["calls"], d["totals"]["errors"]), (31, 4))
        self.assertEqual([(r["project"], r["calls"]) for r in d["projects"]], [("foo", 31)])
        self.assertEqual({r["session_id"] for r in d["recent"]}, {"f1"})
        self.assertEqual(self.detail("tool", "Bash")["totals"]["calls"], 53)
        self.assertEqual([(r["project"], r["calls"]) for r in self.detail("tool", "Bash", "", 30)["projects"]], [("foo", 32), ("bar", 1)])
        self.assertEqual(self.detail("tool", "Bash", source="codex")["totals"]["calls"], 0)

    def test_empty_subject(self):
        d = self.detail("tool", "Glob", "", 30)
        self.assertEqual((d["totals"]["calls"], d["totals"]["errors"], d["totals"]["failure_rate"]), (0, 0, None))
        for k in ("daily", "projects", "sources", "threads", "patterns", "categories", "error_loops", "recent"):
            self.assertEqual(d[k], [], k)
        self.assertEqual(d["recovery"], dict(incidents=0, recovered=0, failed_again=0, gave_up=0))
        self.assertEqual((d["previous"]["calls"], d["previous"]["failure_rate"]), (0, None))
        self.assertIsNone(d["tools"])

    def test_failure_rate_against_previous_period(self):
        d = self.detail("tool", "Bash", "foo", 30)
        self.assertAlmostEqual(d["totals"]["failure_rate"], 4 / 32)
        p = d["previous"]
        self.assertEqual((p["start"], p["end"], p["calls"], p["errors"]), ("2026-09-07", "2026-10-06", 20, 1))
        self.assertAlmostEqual(p["failure_rate"], 0.05)
        self.assertIsNone(self.detail("tool", "Bash")["previous"])

    def test_latency_and_calls_per_day(self):
        t = self.detail("tool", "Bash", "foo", 7)["totals"]
        self.assertEqual((t["p50_ms"], t["p95_ms"]), (1000, 10_000))
        self.assertEqual(self.detail("tool", "WebFetch")["daily"],
                         [dict(day="2026-11-04", ok=2, failed=0), dict(day="2026-11-05", ok=0, failed=1)])

    def test_where_used(self):
        d = self.detail("tool", "WebFetch")
        self.assertEqual(d["totals"]["subagent_calls"], 2)
        self.assertAlmostEqual(d["totals"]["subagent_share"], 2 / 3)
        self.assertEqual([(r["subagent"], r["calls"], r["errors"]) for r in d["threads"]], [(True, 2, 0), (False, 1, 1)])
        self.assertEqual([(r["source"], r["calls"]) for r in self.detail("tool", "Bash")["sources"]], [("claude", 53)])
        self.assertEqual([(r["source"], r["calls"]) for r in self.detail("tool", "exec_command")["sources"]], [("codex", 1)])

    def test_input_patterns(self):
        rate = lambda d: [(r["pattern"], r["calls"], r["failure_rate"]) for r in d["patterns"]]
        self.assertEqual(rate(self.detail("tool", "Bash", "foo", 7)), [("git", 20, 0), ("npm", 10, 0.4), ("ls", 1, 0)])
        self.assertEqual(rate(self.detail("tool", "Edit")), [(".py", 2, 0), (".tsx", 1, 0)])
        self.assertEqual(rate(self.detail("tool", "WebFetch")), [("docs.python.org", 3, 1 / 3)])
        # The top TOP_PATTERNS groups, then the rest as other.
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error"],
                     [(f"many{i}", "f2", "Glob", f"p{i:02d}" if i < 17 else "", "2026-11-05 11:00:00", "2026-11-05 11:00:01", False)
                      for i in range(19)])
        try:
            got = [(r["pattern"], r["calls"]) for r in self.detail("tool", "Glob")["patterns"]]
            self.assertEqual(got, [(f"p{i:02d}", 1) for i in range(metrics.TOP_PATTERNS)] + [("other", 4)])
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id LIKE 'many%'")

    def test_failures_by_category_and_their_recovery(self):
        d = self.detail("tool", "Bash", "foo", 7)
        self.assertEqual([(r["id"], r["label"], r["errors"]) for r in d["categories"]], [("tests", "Tests / build / lint failed", 4)])
        self.assertTrue(d["categories"][0]["why"] and d["categories"][0]["fix"])
        self.assertEqual(d["recovery"], dict(incidents=1, recovered=1, failed_again=0, gave_up=0))
        # The recovery agrees with the Errors page's incidents.
        r = self.detail("tool", "Grep")["recovery"]
        self.assertEqual(r, dict(incidents=3, recovered=1, failed_again=0, gave_up=2))
        on_page = metrics.errors_payload(self.con.cursor(), today=TODAY)["incidents"]
        self.assertEqual(r["gave_up"], sum(1 for i in on_page if i["t"] == "Grep" and i["outcome"] == "gave_up"))
        self.assertEqual(self.detail("tool", "Grep", "foo")["recovery"]["gave_up"], 1)

    def test_error_loops_carry_titles_as_recent_calls_do(self):
        self.assertEqual(self.detail("tool", "Read")["error_loops"], [])
        c = self.con.cursor()
        store.insert(c, "session_titles", ["session_id", "custom", "agent"], [("f1", None, "Fix flaky upload test")])
        try:
            d = self.detail("tool", "Bash", "foo", 7)
            self.assertEqual([(lp["session_id"], lp["failures"], lp["first_id"], lp["title"]) for lp in d["error_loops"]],
                             [("f1", 4, "f1-26", "Fix flaky upload test")])
            self.assertEqual({r["title"] for r in d["recent"]}, {"Fix flaky upload test"})
        finally:
            c.execute("DELETE FROM session_titles")

    def test_shell_tests_and_commits(self):
        self.assertEqual(self.detail("tool", "Bash", "foo", 7)["shell"],
                         dict(test_runs=10, tests_passed=6, tests_failed=4, pass_rate=0.6, commits=1))
        self.assertEqual(self.detail("tool", "exec_command")["shell"]["test_runs"], 1)
        self.assertIsNone(self.detail("tool", "Read")["shell"])

    def test_recent_calls(self):
        recent = self.detail("tool", "Bash")["recent"]
        self.assertEqual(len(recent), metrics.RECENT_CALLS)
        self.assertEqual(recent[0]["id"], "f1-30")  # the latest: ls, after the npm failures
        self.assertEqual([r["ts"] for r in recent], sorted((r["ts"] for r in recent), reverse=True))
        self.assertEqual({r["title"] for r in recent}, {None})  # no session of these calls has a title
        failed = next(r for r in recent if r["is_error"])
        self.assertEqual({k: failed[k] for k in ("id", "session_id", "project", "source", "tool", "input", "category", "subagent", "duration_ms")},
                         dict(id="f1-29", session_id="f1", project="foo", source="claude", tool="Bash", input="npm test", category="tests",
                              subagent=False, duration_ms=10_000))

    def test_mcp_server(self):
        d = self.detail("mcp", "github")
        self.assertEqual((d["totals"]["calls"], d["totals"]["errors"]), (3, 1))
        self.assertEqual([(r["tool"], r["calls"], r["failure_rate"]) for r in d["tools"]],
                         [("mcp__github__search_issues", 2, 0.5), ("mcp__github__get_pr", 1, 0)])
        self.assertEqual(d["recovery"]["recovered"], 1)

    def test_skill(self):
        d = self.detail("skill", "ship")
        self.assertEqual((d["totals"]["calls"], d["totals"]["errors"], len(d["recent"])), (2, 1, 2))
        self.assertEqual([(r["project"], r["calls"]) for r in d["projects"]], [("foo", 2)])
        self.assertIsNone(d["patterns"])
        self.assertIsNone(d["shell"])
        self.assertIsNone(d["tools"])

    def test_palette_categories_match_errors_page(self):
        errs = metrics.errors_payload(self.con.cursor(), today=TODAY)["errors"]
        for project, days, source in (("", 0, ""), ("foo", 7, ""), ("bar", 30, ""), ("", 30, "codex")):
            start = (TODAY - timedelta(days=days - 1)).isoformat() if days else ""
            want = {}
            for e in errs:
                if (not project or e["p"] == project) and (not source or e["src"] == source) and e["d"] >= start:
                    want[e["c"]] = want.get(e["c"], 0) + 1
            got = metrics.palette(self.con.cursor(), project, days, TODAY, source=source)["categories"]
            self.assertEqual({r["id"]: r["errors"] for r in got}, want, (project, days, source))
        cats = metrics.palette(self.con.cursor(), "foo", 7, TODAY)["categories"]
        self.assertEqual(cats[0], dict(id="tests", label="Tests / build / lint failed", errors=4))
        tools = {r["name"]: r for r in metrics.palette(self.con.cursor(), "foo", 7, TODAY)["tools"]}
        self.assertEqual((tools["Bash"]["calls"], tools["Bash"]["errors"]), (31, 4))
        self.assertNotIn("Bash", {r["name"] for r in metrics.palette(self.con.cursor(), source="codex")["tools"]})


class UserPricesTest(unittest.TestCase):
    """The user prices file next to the store: its models add to or replace the packaged ones; a bad file is reported and ignored."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.path = os.path.join(self.tmp, "prices.json")
        patch = mock.patch.object(metrics, "USER_PRICES", self.path)
        patch.start()
        self.addCleanup(patch.stop)
        self.addCleanup(shutil.rmtree, self.tmp)
        self.packaged = metrics.load_prices()

    def write(self, text):
        with open(self.path, "w") as fh:
            fh.write(text)

    def test_entries_add_and_override(self):
        self.assertEqual(metrics.user_prices(), ({}, None))  # no file is no error
        self.assertEqual(metrics.prices_file(), dict(path=self.path, error=None))
        known = next(iter(self.packaged))
        fast = {"input": 2, "output": 2, "cache_read": 2, "cache_5m": 2, "cache_1h": 2}
        self.write(json.dumps({"models": {"m-new": {"input": 1, "output": 2, "cache_read": 0, "cache_5m": 0, "cache_1h": 0, "fast": fast},
                                          known: dict(self.packaged[known], input=999)}}))
        got = metrics.load_prices()
        self.assertEqual(got["m-new"]["context"], None)  # optional, as in the packaged file
        self.assertEqual(got["m-new"]["fast"], fast)
        self.assertEqual(got[known]["input"], 999)
        self.assertEqual(len(got), len(self.packaged) + 1)
        self.assertIsNone(metrics.prices_file()["error"])

    def test_bad_file_is_reported_and_ignored(self):
        for text, error in (("{not json", "Expecting property name"), ("[]", 'no "models" object'),
                            ('{"models": {"m-x": {"input": 1}}}', "m-x: output, cache_read, cache_5m, cache_1h must be a number"),
                            ('{"models": {"m-x": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "long_above": 5}}}',
                             "m-x: input, output, cache_read, cache_5m, cache_1h must be a number"),
                            ('{"models": {"m-x": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "fast": {"input": 2}}}}',
                             "m-x: fast.output, fast.cache_read, fast.cache_5m, fast.cache_1h must be a number"),
                            ('{"models": {"m-x": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "fast": 5}}}',
                             "m-x: fast.input, fast.output, fast.cache_read, fast.cache_5m, fast.cache_1h must be a number")):
            self.write(text)
            self.assertEqual(metrics.load_prices(), self.packaged)
            self.assertIn(error, metrics.prices_file()["error"])


class PlansTest(unittest.TestCase):
    """The plans a view shows come from the newest limit snapshot with a plan per provider, priced by the plans table."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.path = os.path.join(self.tmp, "prices.json")
        patch = mock.patch.object(metrics, "USER_PRICES", self.path)
        patch.start()
        self.addCleanup(patch.stop)
        self.addCleanup(shutil.rmtree, self.tmp)
        self.cur = store.open_store(os.path.join(self.tmp, "d", "x.duckdb")).cursor()

    def snap(self, provider, plan, observed, limit_id="weekly"):
        store.write_snapshots(self.cur, [store.snapshot(provider, limit_id, "", 10080, datetime(2026, 11, 9), observed, 5, plan, False)])

    def plans(self, source=""):
        return metrics.usage(self.cur, prices=PRICES, today=TODAY, source=source)["plans"]

    def test_newest_plan_wins_per_provider(self):
        self.snap("claude", "pro", datetime(2026, 10, 1))
        self.snap("claude", "max/default_claude_max_20x", datetime(2026, 11, 1))
        self.snap("claude", None, datetime(2026, 11, 2), "other")  # a snapshot without a plan does not count
        self.snap("codex", "plus", datetime(2026, 10, 20))
        self.assertEqual(self.plans(), [dict(provider="claude", label="Claude Max 20x", monthly=200),
                                        dict(provider="codex", label="ChatGPT Plus", monthly=20)])

    def test_source_filter_keeps_that_providers_plan(self):
        self.snap("claude", "pro", datetime(2026, 11, 1))
        self.snap("codex", "prolite", datetime(2026, 11, 1))
        self.assertEqual(self.plans("codex"), [dict(provider="codex", label="ChatGPT Pro 5x", monthly=100)])
        self.assertEqual(self.plans("claude"), [dict(provider="claude", label="Claude Pro", monthly=20)])

    def test_unknown_plan_or_no_snapshot_gives_nothing(self):
        self.assertEqual(self.plans(), [])
        self.snap("claude", "enterprise/custom", datetime(2026, 11, 1))
        self.snap("codex", "free", datetime(2026, 11, 1))
        self.assertEqual(self.plans(), [])

    def test_user_file_adds_and_overrides_plans(self):
        self.snap("claude", "pro", datetime(2026, 11, 1))
        self.snap("codex", "team", datetime(2026, 11, 1))
        with open(self.path, "w") as fh:
            json.dump({"plans": {"claude": {"pro": {"label": "Claude Pro (annual)", "monthly": 17}},
                                 "codex": {"team": {"label": "ChatGPT Team", "monthly": 30}}}}, fh)
        self.assertEqual(self.plans(), [dict(provider="claude", label="Claude Pro (annual)", monthly=17),
                                        dict(provider="codex", label="ChatGPT Team", monthly=30)])
        self.assertIsNone(metrics.prices_file()["error"])

    def test_bad_user_file_is_reported_and_ignored(self):
        self.snap("claude", "pro", datetime(2026, 11, 1))
        for text, error in (('{"plans": {"claude": {"pro": {"label": "x"}}}}', "plans.claude.pro: needs a label"),
                            ('{"plans": {"claude": []}}', "plans.claude must be an object"),
                            ('{"plans": {"claude": {"pro": {"label": "x", "monthly": "5"}}}}', "plans.claude.pro"),
                            ('{"plans": {"claude": {"pro": {"label": "x", "monthly": 1e309}}}}', "plans.claude.pro")):
            with open(self.path, "w") as fh:
                fh.write(text)
            self.assertEqual(self.plans(), [dict(provider="claude", label="Claude Pro", monthly=20)])
            self.assertIn(error, metrics.prices_file()["error"])


if __name__ == "__main__":
    unittest.main()
