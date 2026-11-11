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

from ai_ledger import app, metrics, store

PRICES = {
    "m-a": {"input": 1, "output": 10, "cache_read": 0.1, "cache_5m": 2, "cache_1h": 4, "context": 1000},
    "m-tier": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "context": 1000,
               "long_above": 100, "long": {"input": 2, "output": 2, "cache_read": 2, "cache_5m": 2, "cache_1h": 2}},
}
TODAY = date(2026, 11, 5)


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
        cls.all = metrics.usage(cls.con.cursor(), prices=PRICES, today=TODAY)
        cls.foo7 = metrics.usage(cls.con.cursor(), "foo", 7, "s1", prices=PRICES, today=TODAY)
        cls.auto = metrics.usage(cls.con.cursor(), prices=PRICES, today=TODAY, automated=True)

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
        # One day: foo's priced spend was all the day before; that day it ran only an unpriced model, so its cost and change are unknown.
        one = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=TODAY)["changes"]
        self.assertEqual([(r["project"], r["new"], r["cost"], r["delta"]) for r in one], [("foo", False, None, None)])
        self.assertAlmostEqual(one[0]["prev_cost"], 15.8)
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

    def test_titles(self):
        c = self.con.cursor()
        store.insert(c, "raw_lines", ["key", "file", "line_no", "type", "session_id", "ts", "subagent", "json"], [
            ("x4", "f", 4, "user", "s2", "2026-11-05T09:00:00Z", False,
             '{"type":"user","promptId":"p3","message":{"content":"Add a dark mode toggle to the settings page. It should persist."}}')])
        store.insert(c, "session_titles", ["session_id", "custom", "agent"], [
            ("s1", "auth  bug\n fix", "Fix login redirect"), ("s3", None, "y" * 140), ("gone", "never stored", None)])
        try:
            with mock.patch.object(metrics, "first_prompts", wraps=metrics.first_prompts) as fp:
                got = metrics.titles(c, ["s1", "s2", "s3", "o1", "s1"])
            self.assertEqual(got, {"s1": ("auth bug fix", "agent"), "s2": ("Add a dark mode toggle to the settings page.", "prompt"),
                                   "s3": ("y" * 79 + "…", "agent")})
            self.assertEqual(fp.call_args.args[1], ["s2", "o1"])  # only the sessions without an agent title
            self.assertEqual(metrics.titles(c, []), {})
            self.assertEqual(metrics.session(c, "s1", prices=PRICES)["title"], "auth bug fix")
            usage = metrics.usage(c, "foo", 7, prices=PRICES, today=TODAY)
            self.assertEqual(usage["error_loops"][0]["title"], "auth bug fix")
            search = lambda q: [x["session_id"] for x in metrics.session_list(c, q=q, prices=PRICES, today=TODAY)["sessions"]]
            self.assertEqual(search("dark MODE"), ["s2"])  # a title from the first prompt
            self.assertEqual(search("auth bug"), ["s1"])
        finally:
            c.execute("DELETE FROM raw_lines WHERE key = 'x4'")
            c.execute("DELETE FROM session_titles")

    def test_short_title(self):
        self.assertEqual(metrics.short_title("  a \t b\n"), "a b")
        self.assertEqual(metrics.short_title("z" * 80), "z" * 80)
        self.assertIsNone(metrics.short_title(" "))
        self.assertIsNone(metrics.short_title(None))

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
        self.assertEqual(calls, [["2026-11-04", "foo", 10, 0, "claude"]])

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
        # project_order never lists automated projects, whatever the view.
        self.assertEqual(self.auto["project_order"], ["foo", "bar"])
        self.assertEqual(metrics.project_order(self.con.cursor()), ["foo", "bar"])
        ids = lambda **k: [x["session_id"] for x in metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY, **k)["sessions"]]
        self.assertEqual(ids(), [x["session_id"] for x in self.all["sessions"]])
        self.assertEqual(ids(automated=True), [x["session_id"] for x in self.auto["sessions"]])
        self.assertIn("o1", ids(automated=True))
        self.assertEqual(ids(day="2026-11-05"), ["s2"])
        self.assertEqual(set(ids(day="2026-11-05", automated=True)), {"s2", "o1"})

    def test_daily_work(self):
        work = {d["day"]: d for d in self.all["daily_work"]}
        self.assertEqual(list(work), ["2026-10-01", "2026-11-04", "2026-11-05"])
        self.assertEqual(work["2026-11-04"], dict(day="2026-11-04", sessions=1, prompts=2, commits=1, failed_calls=6))
        self.assertEqual(work["2026-11-05"], dict(day="2026-11-05", sessions=1, prompts=1, commits=0, failed_calls=0))
        self.assertEqual([d["day"] for d in self.foo7["daily_work"]], ["2026-11-04", "2026-11-05"])
        for u in (self.all, self.foo7, self.auto):
            t, total = u["totals"], lambda k: sum(d[k] for d in u["daily_work"])
            self.assertEqual((total("prompts"), total("commits"), total("failed_calls")), (t["prompts"], t["commits"], t["errors"]))
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

    def test_api_reads_automated_param(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(self.con, dict(claude=self.tmp))))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            def get(path):
                h = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1])
                h.request("GET", path, headers={"Host": f"{app.HOST}:{app.PORT}"})
                r = h.getresponse()
                self.assertEqual(r.status, 200)
                return json.loads(r.read())
            self.assertEqual((get("/api/usage")["totals"]["sessions"], get("/api/usage?automated=1")["totals"]["sessions"]), (3, 4))
            self.assertEqual((get("/api/sessions")["total"], get("/api/sessions?automated=1")["total"]), (3, 4))
        finally:
            httpd.shutdown()
            httpd.server_close()

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
            pal(source="grok")

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

    def test_unlisted_codex_model_unpriced(self):
        m = self.codex_models(("gpt-5.5", None, False, 1_000, 10, 0, 0, 0, 0))  # seen in Codex sessions, not in prices.json
        self.assertIsNone(m["gpt-5.5"]["cost"])


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
        prev = metrics.usage(self.con.cursor(), "", 1, prices=PRICES, today=date(2026, 11, 6), source="codex")["previous"]
        self.assertEqual((prev["tokens"], prev["sessions"]), (200_000, 1))

    def test_unknown_source_is_refused(self):
        with self.assertRaises(ValueError):
            self.usage("grok")
        with self.assertRaises(ValueError):
            metrics.session_list(self.con.cursor(), prices=PRICES, today=TODAY, source="grok")

    def test_errors_payload_tags_sources(self):
        p = metrics.errors_payload(self.con.cursor(), today=TODAY)
        self.assertEqual({e["id"]: e["src"] for e in p["errors"]}, {"tc": "claude", "tx": "codex"})
        self.assertEqual(p["calls"], [["2026-11-05", "foo", 1, 0, "claude"], ["2026-11-05", "foo", 1, 0, "codex"]])
        self.assertEqual(p["error_days"], [["2026-11-05", "foo", "x", 1, 0, "claude"], ["2026-11-05", "foo", "x", 1, 0, "codex"]])

    def test_api_reads_source_param(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(self.con, dict(claude=self.tmp))))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            def get(path):
                h = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1])
                h.request("GET", path, headers={"Host": f"{app.HOST}:{app.PORT}"})
                r = h.getresponse()
                return r.status, json.loads(r.read())
            self.assertEqual(get("/api/usage?range=0")[1]["totals"]["tokens"], 1_200_000)
            self.assertEqual(get("/api/usage?range=0&source=codex")[1]["totals"]["tokens"], 200_000)
            self.assertEqual(get("/api/sessions?source=claude")[1]["total"], 1)
            for path in ("/api/usage?source=grok", "/api/sessions?source=grok"):
                status, body = get(path)
                self.assertEqual((status, body), (400, dict(error="unknown source: grok")), path)
        finally:
            httpd.shutdown()
            httpd.server_close()


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

    def test_session_list_by_local_day(self):
        for day, sid in (("2026-03-08", "z1"), ("2026-03-09", "z2")):
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


class SessionTimeTest(unittest.TestCase):
    """A session resumed the next day: main-thread requests and tool calls 10, 15 and 5 minutes apart, and a 22-hour
    pause between the first and second day. A subagent request in the pause doesn't end it."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "d", "x.duckdb"))
        c = cls.con.cursor()
        store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts"], [("a", "foo", "2026-11-04 10:00:00", "2026-11-05 09:05:00")])
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

    def test_patterns_keep_the_top_groups(self):
        c = self.con.cursor()
        store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error"],
                     [(f"many{i}", "f2", "Glob", f"p{i:02d}" if i < 17 else "", "2026-11-05 11:00:00", "2026-11-05 11:00:01", False)
                      for i in range(19)])
        try:
            got = [(r["pattern"], r["calls"]) for r in self.detail("tool", "Glob")["patterns"]]
            self.assertEqual(got, [(f"p{i:02d}", 1) for i in range(metrics.TOP_PATTERNS)] + [("other", 4)])
        finally:
            c.execute("DELETE FROM tool_calls WHERE tool_use_id LIKE 'many%'")

    def test_failures_by_category(self):
        cats = self.detail("tool", "Bash", "foo", 7)["categories"]
        self.assertEqual([(r["id"], r["label"], r["errors"]) for r in cats], [("tests", "Tests / build / lint failed", 4)])
        self.assertTrue(cats[0]["why"] and cats[0]["fix"])

    def test_recovery_matches_errors_page(self):
        r = self.detail("tool", "Grep")["recovery"]
        self.assertEqual(r, dict(incidents=3, recovered=1, failed_again=0, gave_up=2))
        on_page = metrics.errors_payload(self.con.cursor(), today=TODAY)["incidents"]
        self.assertEqual(r["gave_up"], sum(1 for i in on_page if i["t"] == "Grep" and i["outcome"] == "gave_up"))
        self.assertEqual(self.detail("tool", "Grep", "foo")["recovery"]["gave_up"], 1)
        self.assertEqual(self.detail("tool", "Bash", "foo", 7)["recovery"], dict(incidents=1, recovered=1, failed_again=0, gave_up=0))

    def test_error_loops(self):
        loops = self.detail("tool", "Bash", "foo", 7)["error_loops"]
        self.assertEqual([(lp["session_id"], lp["failures"], lp["first_id"]) for lp in loops], [("f1", 4, "f1-26")])
        self.assertEqual(self.detail("tool", "Read")["error_loops"], [])

    def test_titles_on_loops_and_recent_calls(self):
        c = self.con.cursor()
        store.insert(c, "session_titles", ["session_id", "custom", "agent"], [("f1", None, "Fix flaky upload test")])
        try:
            d = self.detail("tool", "Bash", "foo", 7)
            self.assertEqual([lp["title"] for lp in d["error_loops"]], ["Fix flaky upload test"])
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

    def test_unknown_kind_and_source(self):
        with self.assertRaises(ValueError):
            self.detail("hook", "Bash")
        with self.assertRaises(ValueError):
            self.detail("tool", "Bash", source="grok")


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

    def test_missing_file_adds_nothing(self):
        self.assertEqual(metrics.user_prices(), ({}, None))
        self.assertEqual(metrics.prices_file(), dict(path=self.path, error=None))

    def test_entries_add_and_override(self):
        known = next(iter(self.packaged))
        self.write(json.dumps({"models": {"m-new": {"input": 1, "output": 2, "cache_read": 0, "cache_5m": 0, "cache_1h": 0},
                                          known: dict(self.packaged[known], input=999)}}))
        got = metrics.load_prices()
        self.assertEqual(got["m-new"]["context"], None)  # optional, as in the packaged file
        self.assertEqual(got[known]["input"], 999)
        self.assertEqual(len(got), len(self.packaged) + 1)
        self.assertIsNone(metrics.prices_file()["error"])

    def test_bad_file_is_reported_and_ignored(self):
        for text, error in (("{not json", "Expecting property name"), ("[]", 'no "models" object'),
                            ('{"models": {"m-x": {"input": 1}}}', "m-x: output, cache_read, cache_5m, cache_1h must be a number"),
                            ('{"models": {"m-x": {"input": 1, "output": 1, "cache_read": 1, "cache_5m": 1, "cache_1h": 1, "long_above": 5}}}',
                             "m-x: input, output, cache_read, cache_5m, cache_1h must be a number")):
            self.write(text)
            self.assertEqual(metrics.load_prices(), self.packaged)
            self.assertIn(error, metrics.prices_file()["error"])


if __name__ == "__main__":
    unittest.main()
