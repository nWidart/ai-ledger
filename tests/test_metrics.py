import os
import shutil
import sys
import tempfile
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import metrics  # noqa: E402
import store  # noqa: E402

PRICES = {
    "m-a": {"input": 1, "output": 10, "cache_read": 0.1, "cache_5m": 2, "cache_1h": 4, "context": 1000},
    "m-tier": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "context": 1000,
               "long_above": 100, "long": {"input": 2, "output": 2, "cache_read": 2, "cache_5m": 2, "cache_1h": 2}},
}
TODAY = date(2026, 11, 5)


class MetricsTest(unittest.TestCase):
    """Fixture: project foo (sessions s1, s2), project bar (s3, outside a 7-day range)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "compactions", "peak_context", "peak_model"], [
            ("s1", "foo", "2026-11-04 10:00:00", "2026-11-04 11:00:00", 2, 900, "m-a"),
            ("s2", "foo", "2026-11-05 09:00:00", "2026-11-05 09:30:00", 0, 100, "m-a"),
            ("s3", "bar", "2026-10-01 09:00:00", "2026-10-01 09:10:00", 0, 50, "m-a")])
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
            ("r4", "s3", "2026-10-01 09:01:00", "m-tier", None, False, 60, 10, 0, 60, 0, 0, 0)])
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
            ("p3", "s2", "2026-11-05 09:00:00", False), ("p4", "s3", "2026-10-01 09:00:00", False)])
        store.insert(c, "hooks", ["session_id", "ts", "source", "hook", "command", "duration_ms", "is_error"], [
            ("s1", "2026-11-04 10:00:00", "stop_summary", "Stop", "a", 100, False),
            ("s1", "2026-11-04 10:05:00", "stop_summary", "Stop", "a", 300, True)], tail="")
        cls.all = metrics.usage(cls.con.cursor(), prices=PRICES, today=TODAY)
        cls.foo7 = metrics.usage(cls.con.cursor(), "foo", 7, "s1", prices=PRICES, today=TODAY)

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def test_filters(self):
        self.assertEqual(self.foo7["start"], "2026-10-30")
        self.assertEqual(self.foo7["totals"]["requests"], 3)
        self.assertEqual(self.all["totals"]["requests"], 4)
        self.assertEqual([p["project"] for p in self.foo7["by_project"]], ["foo"])

    def test_tokens_per_day(self):
        days = {d["day"]: d for d in self.foo7["daily"]}
        self.assertEqual(days["2026-11-04"]["input"], 2_000_000)
        self.assertEqual(days["2026-11-04"]["cache_read"], 8_000_000)
        self.assertEqual(days["2026-11-04"]["thinking"], 500_000)
        self.assertEqual(days["2026-11-05"]["unpriced"], 1)

    def test_cost_and_unpriced(self):
        t = self.foo7["totals"]
        self.assertAlmostEqual(t["cost"], 15.8)
        self.assertEqual([u["model"] for u in self.foo7["unpriced"]], ["m-unknown"])
        self.assertAlmostEqual(self.all["totals"]["cost"], 15.8 + 130 * 2 / 1e6)

    def test_cache_and_subagents(self):
        t = self.foo7["totals"]
        self.assertAlmostEqual(t["cache_hit_ratio"], 8 / (2 + 8 + 1 + 1e-4))
        self.assertAlmostEqual(t["write_1h_share"], 0.5)
        self.assertAlmostEqual(t["subagent_token_share"], 1 / (11 + 1 + 0.0002))
        self.assertAlmostEqual(t["subagent_cost_share"], 1 / 15.8)

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
        self.assertEqual(t["session_seconds"], 3600 + 1800)
        self.assertEqual(t["median_session_seconds"], 2700)
        self.assertEqual(t["thinking_ms"], 1500)
        bash = next(x for x in self.foo7["tools"] if x["tool"] == "Bash")
        self.assertAlmostEqual(bash["p50_ms"], 4000)
        self.assertAlmostEqual(bash["p95_ms"], 9400)

    def test_outcomes(self):
        t = self.foo7["totals"]
        self.assertEqual((t["commits"], t["test_runs"], t["tests_passed"], t["tests_failed"]), (1, 2, 1, 1))
        self.assertAlmostEqual(t["cost_per_commit"], 15.8)
        self.assertEqual(t["tokens_per_commit"], 12_000_200)
        self.assertAlmostEqual(t["errors_per_100_calls"], 60)

    def test_no_commits_gives_null_ratios(self):
        bar = metrics.usage(self.con.cursor(), "bar", 0, prices=PRICES, today=TODAY)
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


if __name__ == "__main__":
    unittest.main()
