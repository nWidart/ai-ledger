import contextlib
import http.client
import io
import os
import shutil
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest import mock

from ai_ledger import app, live, metrics, prom, store, titles

PRICES = {"m-a": {"input": 1, "output": 10, "cache_read": 0.1, "cache_5m": 2, "cache_1h": 4, "context": 1000}}
REVIEW = '{"workloads": [{"name": "pr-review", "prompt_prefix": "You work on pull request #"}]}'
ODD = 'a"b\\c\nd'  # a project name the text format must escape


def build(con):
    """Project web: sess-review (a review agent: priced and unpriced requests, three Bash calls, two timed Reads and a running
    one, 90 s of model time, two compactions), sess-hand (started by hand), sess-helper (no prompt: automated) and sess-grok
    (a reported cost). Project ODD: sess-codex, an unpriced request and no model time."""
    c = con.cursor()
    store.insert(c, "sessions", ["session_id", "project", "first_ts", "last_ts", "source", "compactions"], [
        ("sess-review", "web", "2026-11-04 10:00:00", "2026-11-04 11:00:00", "claude", 2),
        ("sess-hand", "web", "2026-11-04 10:00:00", "2026-11-04 11:00:00", "claude", 0),
        ("sess-helper", "web", "2026-11-04 10:00:00", "2026-11-04 10:00:05", "claude", 0),
        ("sess-grok", "web", "2026-11-04 10:00:00", "2026-11-04 11:00:00", "grok", 0),
        ("sess-codex", ODD, "2026-11-04 10:00:00", "2026-11-04 11:00:00", "codex", 0)])
    store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [
        ("p-review", "sess-review", "2026-11-04 10:00:00", False), ("p-hand", "sess-hand", "2026-11-04 10:00:00", False),
        ("p-grok", "sess-grok", "2026-11-04 10:00:00", False), ("p-codex", "sess-codex", "2026-11-04 10:00:00", False)])
    store.insert(c, "raw_lines", ["key", "file", "line_no", "type", "session_id", "ts", "subagent", "json"], [
        ("k1", "f", 1, "user", "sess-review", "2026-11-04T10:00:00Z", False,
         '{"type":"user","promptId":"p-review","message":{"content":"You work on pull request #12 with PROMPT-SECRET"}}'),
        ("k2", "f", 2, "user", "sess-hand", "2026-11-04T10:00:00Z", False,
         '{"type":"user","promptId":"p-hand","message":{"content":"Fix the login page"}}')])
    cols = ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read", "cache_5m",
            "cache_1h", "reported_cost"]
    M = 1_000_000
    store.insert(c, "requests", cols, [
        ("r1", "sess-review", "2026-11-04 10:01:00", "m-a", False, M, M // 10, 5, 0, 0, 0, None),  # 1 + 1 USD
        ("r2", "sess-review", "2026-11-04 10:02:00", "m-unknown", False, 10, 10, 0, 0, 0, 0, None),
        ("r3", "sess-helper", "2026-11-04 10:00:01", "m-a", False, M, 0, 0, 0, 0, 0, None),
        ("r4", "sess-grok", "2026-11-04 10:01:00", "grok-x", False, 10, 10, 0, 0, 0, 0, 0.02),
        ("r5", "sess-codex", "2026-11-04 10:01:00", "gpt-x", False, 10, 10, 0, 0, 0, 0, None)])
    store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "input_summary", "start_ts", "end_ts", "is_error", "error",
                                   "category", "subagent", "is_commit", "is_test", "test_passed"], [
        ("t1", "sess-review", "Bash", "git commit -m CMD-SECRET", "2026-11-04 10:03:00", "2026-11-04 10:03:01", False, None, None,
         False, True, False, True),
        ("t2", "sess-review", "Bash", "npm test", "2026-11-04 10:04:00", "2026-11-04 10:04:20", False, None, None, False, False, True, True),
        ("t3", "sess-review", "Bash", "npm test", "2026-11-04 10:05:00", "2026-11-04 10:05:40", True, "token=ERROR-SECRET",
         "test-failure", False, False, True, False),
        ("t4", "sess-review", "Read", "/home/PATH-SECRET", "2026-11-04 10:06:00", "2026-11-04 10:06:00.300", False, None, None,
         False, False, False, True),
        ("t5", "sess-review", "Read", "x", "2026-11-04 10:07:00", "2026-11-04 10:07:07", False, None, None, False, False, False, True),
        ("t6", "sess-review", "Read", "x", "2026-11-04 10:08:00", None, None, None, None, False, False, False, None)])  # running
    store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms", "tool_ms", "lines_added", "lines_removed"],
                 [("sess-review", 1_793_000_000_000, 90_000, 1_000, 0, 0)])


class PromTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.con = store.open_store(os.path.join(cls.tmp, "x.duckdb"))
        build(cls.con)
        cls.path = os.path.join(cls.tmp, "workloads.json")
        with open(cls.path, "w") as fh:
            fh.write(REVIEW)
        wl = prom.Workloads(cls.path)
        cur = cls.con.cursor()
        cls.text = prom.counters(cur, wl.get(cur, [r[0] for r in cur.execute("SELECT session_id FROM sessions").fetchall()]),
                                 prices=PRICES, user_projects=[])
        cls.lines = cls.text.splitlines()

    @classmethod
    def tearDownClass(cls):
        cls.con.close()
        shutil.rmtree(cls.tmp)

    def has(self, *lines):
        for line in lines:
            self.assertIn(line, self.lines)

    def test_every_family_has_help_and_type(self):
        names = {ln.split()[2] for ln in self.lines if ln.startswith("# TYPE")}
        self.assertEqual(names, {ln.split()[2] for ln in self.lines if ln.startswith("# HELP")})
        self.assertTrue(all(n.startswith("ai_ledger_") for n in names))
        for ln in self.lines:
            if not ln.startswith("#"):
                self.assertTrue(any(ln.startswith(n) for n in names), ln)
                self.assertEqual(len(ln.rsplit(" ", 1)), 2)  # a value and no timestamp

    def test_requests_tokens_and_cost(self):
        review = 'source="claude",project="web",automated="false",workload="pr-review"'
        self.has(f'ai_ledger_requests_total{{{review},model="m-a"}} 1',
                 f'ai_ledger_cost_usd_total{{{review},model="m-a"}} 2.0',
                 f'ai_ledger_unpriced_requests_total{{{review},model="m-a"}} 0',
                 f'ai_ledger_requests_total{{{review},model="m-unknown"}} 1',
                 f'ai_ledger_unpriced_requests_total{{{review},model="m-unknown"}} 1',
                 f'ai_ledger_cost_usd_total{{{review},model="m-unknown"}} 0.0',
                 f'ai_ledger_tokens_total{{{review},model="m-a",kind="output"}} 100000',
                 f'ai_ledger_tokens_total{{{review},model="m-a",kind="thinking"}} 5',
                 'ai_ledger_cost_usd_total{source="grok",project="web",automated="false",workload="default",model="grok-x"} 0.02',
                 # no prompt: automated, as the pages' toggle hides it
                 'ai_ledger_requests_total{source="claude",project="web",automated="true",workload="default",model="m-a"} 1')
        self.assertFalse([ln for ln in self.lines if 'source="claude",project="web",automated="false",workload="default"' in ln
                          and ln.startswith("ai_ledger_requests_total")])  # sess-hand made no request: no sample

    def test_sessions_and_their_work(self):
        review = 'source="claude",project="web",automated="false",workload="pr-review"'
        codex = 'source="codex",project="a\\"b\\\\c\\nd",automated="false",workload="default"'
        self.has(f"ai_ledger_sessions_total{{{review}}} 1", f"ai_ledger_prompts_total{{{review}}} 1",
                 f"ai_ledger_compactions_total{{{review}}} 2", f"ai_ledger_commits_total{{{review}}} 1",
                 f"ai_ledger_model_seconds_total{{{review}}} 90.0",
                 f'ai_ledger_test_runs_total{{{review},result="passed"}} 1', f'ai_ledger_test_runs_total{{{review},result="failed"}} 1',
                 f"ai_ledger_sessions_total{{{codex}}} 1", f"ai_ledger_model_seconds_total{{{codex}}} 0.0",
                 'ai_ledger_sessions_total{source="claude",project="web",automated="false",workload="default"} 1')

    def test_tool_calls_errors_and_durations(self):
        review = 'source="claude",project="web",automated="false",workload="pr-review"'
        self.has(f'ai_ledger_tool_calls_total{{{review},tool="Bash",result="ok"}} 2',
                 f'ai_ledger_tool_calls_total{{{review},tool="Bash",result="error"}} 1',
                 f'ai_ledger_tool_calls_total{{{review},tool="Read",result="ok"}} 2',  # the running call is not counted yet
                 f'ai_ledger_tool_errors_total{{{review},category="test-failure"}} 1',
                 'ai_ledger_tool_call_duration_seconds_bucket{source="claude",workload="pr-review",tool="Read",le="0.1"} 0',
                 'ai_ledger_tool_call_duration_seconds_bucket{source="claude",workload="pr-review",tool="Read",le="0.5"} 1',
                 'ai_ledger_tool_call_duration_seconds_bucket{source="claude",workload="pr-review",tool="Read",le="5"} 1',
                 'ai_ledger_tool_call_duration_seconds_bucket{source="claude",workload="pr-review",tool="Read",le="10"} 2',
                 'ai_ledger_tool_call_duration_seconds_bucket{source="claude",workload="pr-review",tool="Read",le="+Inf"} 2',
                 'ai_ledger_tool_call_duration_seconds_sum{source="claude",workload="pr-review",tool="Read"} 7.3',
                 'ai_ledger_tool_call_duration_seconds_count{source="claude",workload="pr-review",tool="Read"} 2')

    def test_no_transcript_text(self):
        for secret in ("SECRET", "sess-", "p-review", "npm test", "pull request"):
            self.assertNotIn(secret, self.text)

    def test_gauges(self):
        active = [dict(session_id="a", project="web", source="claude", state="you"),
                  dict(session_id="b", project="web", source="codex", state="tool"),
                  dict(session_id="c", project="web", source="claude", state="you")]
        window = dict(provider="claude", limit_id="five_hour", scope="", label="5-hour", current=42.0, resets_at="2026-11-14T15:00:00.000Z")
        state = dict(last_ingest="2026-11-14T12:00:00+00:00", error="RuntimeError: x")
        lines = prom.gauges(active, {"c": "pr-review"}, [window], state, "1.2.3").splitlines()
        for line in ('ai_ledger_active_sessions{source="claude",project="web",workload="default",state="you"} 1',
                     'ai_ledger_active_sessions{source="claude",project="web",workload="pr-review",state="you"} 1',
                     'ai_ledger_active_sessions{source="codex",project="web",workload="default",state="tool"} 1',
                     'ai_ledger_limit_used_ratio{provider="claude",limit="five_hour",window="5-hour"} 0.42',
                     'ai_ledger_limit_resets_timestamp_seconds{provider="claude",limit="five_hour",window="5-hour"} 1794668400.0',
                     "ai_ledger_last_ingest_timestamp_seconds 1794657600.0", "ai_ledger_ingest_failed 1",
                     'ai_ledger_build_info{version="1.2.3"} 1'):
            self.assertIn(line, lines)
        empty = prom.gauges([], {}, [], dict(last_ingest=None, error=None), "1.2.3")
        self.assertFalse([ln for ln in empty.splitlines() if ln.startswith(("ai_ledger_limit", "ai_ledger_last_ingest", "ai_ledger_active"))])
        self.assertIn("ai_ledger_ingest_failed 0", empty.splitlines())


class WorkloadsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.con = store.open_store(os.path.join(self.tmp, "x.duckdb"))
        self.addCleanup(self.con.close)
        build(self.con)
        self.path = os.path.join(self.tmp, "workloads.json")
        self.wl = prom.Workloads(self.path)
        self.sids = ["sess-review", "sess-hand", "sess-helper"]

    def write(self, text):
        with open(self.path, "w") as fh:
            fh.write(text)
        os.utime(self.path, ns=(os.stat(self.path).st_mtime_ns + 1_000_000_000,) * 2)  # an edit within the clock's resolution

    def get(self):
        return self.wl.get(self.con.cursor(), self.sids)

    def test_a_prefix_names_the_sessions_it_starts_and_each_is_read_once(self):
        self.write(REVIEW)
        with mock.patch.object(titles, "first_prompts", wraps=titles.first_prompts) as read:
            self.assertEqual(self.get(), {"sess-review": "pr-review"})
            self.assertEqual(self.get(), {"sess-review": "pr-review"})
        self.assertEqual([sorted(c.args[1]) for c in read.call_args_list], [["sess-hand", "sess-review"]])  # once; no prompt, no read

    def test_no_file_reads_no_prompt(self):
        with mock.patch.object(titles, "first_prompts") as read:
            self.assertEqual(self.get(), {})
        read.assert_not_called()

    def test_a_malformed_file_is_default_and_reported_once(self):
        self.write("{not json")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.assertEqual((self.get(), self.get()), ({}, {}))
        self.assertEqual(err.getvalue().count("workloads file ignored"), 1)
        self.write('{"workloads": [{"name": "x"}]}')
        with contextlib.redirect_stderr(err):
            self.assertEqual(self.get(), {})
        self.assertEqual(err.getvalue().count("workloads file ignored"), 2)

    def test_an_edit_matches_every_session_again(self):
        self.write(REVIEW)
        self.assertEqual(self.get(), {"sess-review": "pr-review"})
        self.write('{"workloads": [{"name": "pr-review", "prompt_prefix": "You work on pull request #"},'
                   ' {"name": "login", "prompt_prefix": "Fix the login"}]}')
        self.assertEqual(self.get(), {"sess-review": "pr-review", "sess-hand": "login"})


class EndpointTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.con = store.open_store(os.path.join(self.tmp, "x.duckdb"))
        self.addCleanup(self.con.close)
        build(self.con)
        self.app = app.App(self.con, {}, pollers=[])
        self.app.workloads = prom.Workloads(os.path.join(self.tmp, "workloads.json"))
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(self.app))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)
        self.port = httpd.server_address[1]

    def get(self, host=f"{app.HOST}:{app.PORT}"):
        h = http.client.HTTPConnection("127.0.0.1", self.port)
        h.request("GET", "/metrics", headers={"Host": host})
        r = h.getresponse()
        return r.status, r.getheader("Content-Type"), r.read().decode()

    def requests(self, body):
        return next(ln for ln in body.splitlines() if ln.startswith('ai_ledger_requests_total{source="grok"'))

    def test_scrape_and_host_check(self):
        status, ctype, body = self.get()
        self.assertEqual((status, ctype), (200, "text/plain; version=0.0.4; charset=utf-8"))
        self.assertIn('ai_ledger_build_info{version="', body)
        self.assertEqual(self.get(host="example.com")[0], 403)

    def test_counters_are_rebuilt_only_after_a_change(self):
        automated = os.path.join(self.tmp, "automated.json")
        with mock.patch.object(prom, "counters", wraps=prom.counters) as built, \
                mock.patch.object(metrics, "USER_PRICES", os.path.join(self.tmp, "prices.json")), mock.patch.object(metrics, "USER_AUTOMATED", automated):
            first = self.get()[2]
            self.assertEqual(self.get()[2], first)
            self.assertEqual(built.call_count, 1)
            store.insert(self.con.cursor(), "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output",
                                                         "thinking", "cache_read", "cache_5m", "cache_1h", "reported_cost"],
                         [("r9", "sess-grok", "2026-11-04 10:09:00", "grok-x", False, 1, 1, 0, 0, 0, 0, 0.01)])
            self.assertEqual(self.get()[2], first)  # stored, but no ingest said so
            self.app.changed_at("2026-11-04T10:09:00+00:00")
            second = self.get()[2]
            self.assertEqual(built.call_count, 2)
            with open(automated, "w") as fh:  # a user file the counters read
                fh.write('{"projects": ["web"]}')
            self.assertIn('automated="true",workload="default",model="grok-x"', self.get()[2])
        self.assertEqual(built.call_count, 3)
        self.assertEqual((self.requests(first)[-2:], self.requests(second)[-2:]), (" 1", " 2"))

    def test_a_failure_answers_the_type_only_and_the_next_scrape_tries_again(self):
        err = io.StringIO()
        with mock.patch.object(prom, "counters", side_effect=[RuntimeError("ERROR-SECRET"), "x\n"]), contextlib.redirect_stderr(err):
            self.assertEqual(self.get()[::2], (500, "RuntimeError\n"))
            self.assertEqual(self.get()[0], 200)
        self.assertEqual(err.getvalue(), "metrics failed: RuntimeError\n")

    def test_active_sessions_include_automated_ones(self):
        with mock.patch.object(live, "states", return_value=[]) as states:
            self.get()
        self.assertEqual(states.call_args.kwargs, dict(automated=True, lines=self.app.lines))  # the lines the Live routes keep


if __name__ == "__main__":
    unittest.main()
