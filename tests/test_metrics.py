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

    def test_tokens_per_day(self):
        days = {d["day"]: d for d in self.foo7["daily"]}
        self.assertEqual(days["2026-11-04"]["input"], 2_000_000)
        self.assertEqual(days["2026-11-04"]["cache_read"], 8_000_000)
        self.assertEqual(days["2026-11-04"]["thinking"], 500_000)
        self.assertEqual(days["2026-11-05"]["unpriced"], 1)

    def test_cost_per_day_and_project(self):
        by = {(d["day"], d["project"]): d for d in self.all["daily_projects"]}
        self.assertAlmostEqual(by[("2026-11-04", "foo")]["cost"], 15.8)
        self.assertIsNone(by[("2026-11-05", "foo")]["cost"])  # only an unpriced model that day
        self.assertAlmostEqual(by[("2026-10-01", "bar")]["cost"], 130 * 2 / 1e6)
        self.assertEqual({d["project"] for d in self.foo7["daily_projects"]}, {"foo"})

    def test_project_order_ignores_filters(self):
        self.assertEqual(self.foo7["project_order"], ["foo", "bar"])
        self.assertEqual(metrics.errors_payload(self.con.cursor())["project_order"], ["foo", "bar"])

    def test_cost_and_unpriced(self):
        t = self.foo7["totals"]
        self.assertAlmostEqual(t["cost"], 15.8)
        self.assertEqual([u["model"] for u in self.foo7["unpriced"]], ["m-unknown"])
        self.assertAlmostEqual(self.all["totals"]["cost"], 15.8 + 130 * 2 / 1e6)

    def test_previous_period(self):
        # One day ending today (s2) against the day before it (s1); same project filter, nothing before all time.
        prev = metrics.usage(self.con.cursor(), "foo", 1, prices=PRICES, today=TODAY)["previous"]
        self.assertEqual((prev["start"], prev["end"], prev["requests"], prev["sessions"]), ("2026-11-04", "2026-11-04", 2, 1))
        self.assertAlmostEqual(prev["cost"], 15.8)
        self.assertEqual([d["day"] for d in prev["daily"]], ["2026-11-04"])
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
        self.assertEqual((ch[1]["cost"], ch[1]["prev_cost"]), (0, 130 * 2 / 1e6))
        self.assertAlmostEqual(ch[1]["delta"], -130 * 2 / 1e6)
        # One day: foo's priced spend was all the day before.
        one = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY)["changes"]
        self.assertEqual([(r["project"], r["new"], r["cost"]) for r in one], [("foo", False, 0)])
        self.assertIsNone(self.all["changes"])

    def test_prompt_title(self):
        t = metrics.prompt_title
        self.assertEqual(t("<command-message>ship</command-message>\n<command-name>/ship</command-name>\n<command-args>add  the tests</command-args>"),
                         "/ship add the tests")
        self.assertEqual(t("<command-message>ship is running…</command-message>"), "/ship")
        self.assertEqual(t("<system-reminder>ignore me</system-reminder>\n\n# Fix the build. Then run the tests.\nMore"), "Fix the build.")
        self.assertEqual(t("x" * 100), "x" * 79 + "…")
        self.assertIsNone(t("<system-reminder>only this</system-reminder>"))
        self.assertIsNone(t(None))

    def test_session_list_by_day(self):
        day = metrics.session_list(self.con.cursor(), day="2026-11-04", prices=PRICES, today=TODAY)
        self.assertEqual([x["session_id"] for x in day["sessions"]], ["s1"])
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
            self.assertEqual(len(s["first_prompt"]), metrics.FIRST_PROMPT_CAP + 1)
            self.assertEqual(metrics.first_prompt(c, "s2", cap=None), long.strip())
        finally:
            c.execute("DELETE FROM raw_lines WHERE key = 'x3'")

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


    def test_errors_payload_splits_subagent_calls(self):
        calls = metrics.errors_payload(self.con.cursor())["calls"]
        self.assertEqual(calls, [["2026-11-04", "foo", 10, 0]])

    def test_error_days_counts_per_day_project_and_category(self):
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "end_ts", "is_error", "category", "subagent"], [
            ("k1", "s2", "Bash", "2026-11-05 09:01:00", "2026-11-05 09:01:05", True, "y", True),
            ("k2", "s2", "Bash", "2026-11-05 09:02:00", "2026-11-05 09:02:05", True, "y", False),
            ("k3", "s2", "Bash", "2026-11-05 09:03:00", "2026-11-05 09:03:05", False, None, False)])
        try:
            p = metrics.errors_payload(c)
            self.assertEqual(p["error_days"], [["2026-11-04", "foo", "x", 6, 0], ["2026-11-05", "foo", "y", 2, 1]])
            # The counts agree with the error list they summarize.
            self.assertEqual(sum(r[3] for r in p["error_days"]), len(p["errors"]))
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id IN ('k1', 'k2', 'k3')")

    def test_errors_payload_anchors_on_today(self):
        self.assertEqual(metrics.errors_payload(self.con.cursor(), today=TODAY)["today"], "2026-11-05")

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
            self.assertEqual(p["incident_gap_minutes"], metrics.INCIDENT_GAP_MINUTES)
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id LIKE 'a_'")


if __name__ == "__main__":
    unittest.main()
