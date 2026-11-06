import io
import json
import os
import subprocess
import sys
import threading
import unittest
import urllib.error
from datetime import datetime
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import limits  # noqa: E402
from test_store import StoreCase  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "claude")
TOKEN = "sk-ant-oat01-SENTINEL-do-not-leak"
NOW = datetime(2026, 11, 6, 15, 0)


def usage_body():
    with open(os.path.join(FIXTURES, "usage.json")) as fh:
        return json.load(fh)


def keychain(expires_in=3600, token=TOKEN):
    cred = dict(claudeAiOauth=dict(accessToken=token, refreshToken="rt-SENTINEL", expiresAt=(1_800_000_000 + expires_in) * 1000,
                                   subscriptionType="max", rateLimitTier="default_claude_max_20x"))
    return subprocess.CompletedProcess([], 0, stdout=json.dumps(cred), stderr="")


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class ParseTest(unittest.TestCase):
    def rows(self, body, plan="max"):
        return [(r[1], r[2], r[3], r[4].isoformat(), r[6], r[7]) for r in limits.claude_rows(dict(plan=plan, response=body), NOW)]

    def test_generic_limits(self):
        self.assertEqual(self.rows(usage_body()), [("weekly_all", "", 10080, "2026-11-08T05:00:00", 57.0, "max"),
                                                   ("weekly_scoped", "Fable", 10080, "2026-11-08T05:00:00", 0.0, "max")])

    def test_legacy_keys_only(self):
        body = dict(five_hour=dict(utilization=12.0, resets_at="2026-11-06T18:00:00+00:00"),
                    seven_day=dict(utilization=57.0, resets_at="2026-11-08T05:00:00+00:00"),
                    seven_day_opus=dict(utilization=3.0, resets_at="2026-11-08T05:00:00+00:00"), seven_day_sonnet=None)
        self.assertEqual(self.rows(body), [("five_hour", "", 300, "2026-11-06T18:00:00", 12.0, "max"),
                                           ("seven_day", "", 10080, "2026-11-08T05:00:00", 57.0, "max"),
                                           ("seven_day_opus", "Opus", 10080, "2026-11-08T05:00:00", 3.0, "max")])

    def test_nothing_recognizable(self):
        self.assertEqual(self.rows(dict(limits=[dict(kind="x")], tangelo=None, pace="fast")), [])
        self.assertEqual(self.rows(["not", "an", "object"]), [])

    def test_unknown_kind_keeps_its_name(self):
        body = dict(limits=[dict(kind="monthly_extra", group="monthly", percent=4, resets_at="2026-12-01T00:00:00Z")])
        rows = limits.claude_rows(dict(plan=None, response=body), NOW)
        self.assertEqual(rows[0][3], None)
        self.assertEqual(limits.label("claude", "monthly_extra", "", None), "monthly extra")
        self.assertEqual(limits.label("claude", "weekly_scoped", "Fable", 10080), "weekly · Fable")
        self.assertEqual(limits.label("codex", "premium_10080", "", 10080), "premium · weekly")


class CredentialTest(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("limits.time.time", return_value=1_800_000_000)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_expired_token_skips_without_http(self):
        with mock.patch("limits.subprocess.run", return_value=keychain(expires_in=-60)), \
                mock.patch("limits.urllib.request.urlopen") as urlopen:
            with self.assertRaises(limits.PollSkipped):
                limits.claude_poll()
            urlopen.assert_not_called()

    def test_no_credential(self):
        with mock.patch("limits.subprocess.run", return_value=subprocess.CompletedProcess([], 44, "", "not found")):
            with self.assertRaises(limits.PollFailed):
                limits.claude_poll()
        with mock.patch("limits.subprocess.run", side_effect=FileNotFoundError("security")):
            with self.assertRaises(limits.PollFailed):
                limits.claude_poll()

    def test_sends_the_token_only_to_the_usage_endpoint(self):
        with mock.patch("limits.subprocess.run", return_value=keychain()), \
                mock.patch("limits.urllib.request.urlopen", return_value=Response(json.dumps(usage_body()).encode())) as urlopen:
            plan, body = limits.claude_poll()
        req = urlopen.call_args[0][0]
        self.assertEqual(req.full_url, limits.USAGE_URL)
        self.assertEqual(req.get_header("Authorization"), f"Bearer {TOKEN}")
        self.assertEqual(plan, "max/default_claude_max_20x")
        self.assertNotIn(TOKEN, json.dumps(body))


class PollerTest(StoreCase):
    def setUp(self):
        super().setUp()
        self.now = 1_800_000_000.0
        self.lock = threading.Lock()
        p = limits.PROVIDERS["claude"]
        self.poller = limits.Poller("claude", p, clock=lambda: self.now)
        patcher = mock.patch("limits.time.time", side_effect=lambda: self.now)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_poll(self, keychain_result=None, response=None, error=None):
        urlopen = mock.Mock(side_effect=error) if error else mock.Mock(return_value=Response(json.dumps(response).encode()))
        with mock.patch("limits.subprocess.run", return_value=keychain_result or keychain()), \
                mock.patch("limits.urllib.request.urlopen", urlopen):
            self.poller.run(self.con, self.lock)
        return urlopen

    def stored_text(self):
        polls = " ".join(r[0] for r in self.q("SELECT json FROM limit_polls"))
        return polls + json.dumps(self.q("SELECT * FROM limit_snapshots"), default=str)

    def test_success_stores_poll_and_snapshots(self):
        self.run_poll(response=usage_body())
        self.assertEqual(self.q("SELECT count(*) FROM limit_polls"), [(1,)])
        self.assertEqual(self.q("SELECT limit_id, scope, used_percent FROM limit_snapshots ORDER BY 1"),
                         [("weekly_all", "", 57.0), ("weekly_scoped", "Fable", 0.0)])
        self.assertEqual(self.poller.state["failures"], 0)
        self.assertEqual(self.poller.next_at, self.now + limits.POLL_SECONDS)

    def test_failures_back_off_and_store_nothing(self):
        waits = []
        for _ in range(6):
            self.run_poll(error=urllib.error.HTTPError(limits.USAGE_URL, 500, "boom", {}, io.BytesIO()))
            waits.append(self.poller.next_at - self.now)
        self.assertEqual(waits, [600, 1200, 2400, 3600, 3600, 3600])
        self.assertEqual(self.poller.state["error"], "usage endpoint answered HTTP 500")
        self.assertEqual(self.q("SELECT count(*) FROM limit_polls"), [(0,)])
        self.run_poll(response=usage_body())
        self.assertEqual((self.poller.state["failures"], self.poller.next_at - self.now), (0, limits.POLL_SECONDS))

    def test_unrecognizable_response_is_a_failure(self):
        self.run_poll(response=dict(limits=[], something="new"))
        self.assertEqual(self.poller.state["failures"], 1)
        self.assertEqual(self.q("SELECT count(*) FROM limit_polls"), [(0,)])

    def test_expired_token_is_stale_not_failing(self):
        urlopen = self.run_poll(keychain_result=keychain(expires_in=-1), response=usage_body())
        urlopen.assert_not_called()
        self.assertEqual((self.poller.state["stale"], self.poller.state["failures"]), (True, 0))

    def test_token_never_leaks(self):
        self.run_poll(response=usage_body())
        self.run_poll(error=urllib.error.URLError(f"bad {TOKEN}"))
        self.run_poll(error=RuntimeError(f"weird {TOKEN}"))
        with mock.patch("limits.subprocess.run", return_value=keychain()), \
                mock.patch("limits.urllib.request.urlopen", side_effect=ValueError(TOKEN)):
            self.poller.run(self.con, self.lock)
        seen = json.dumps(self.poller.state) + self.stored_text()
        self.assertNotIn("SENTINEL", seen)
        self.assertEqual(self.poller.state["error"], "usage endpoint returned invalid JSON")


class AppPollTest(StoreCase):
    def test_polls_are_spaced_back_off_and_never_stop_ingest(self):
        import app
        now, calls = [1_800_000_000.0], []

        def poll():
            calls.append(now[0])
            if len(calls) == 2:
                raise RuntimeError("endpoint broke")
            return "max", usage_body()

        fake = limits.Poller("claude", limits.Provider("claude", "Claude Code", poll, limits.POLL_SECONDS), clock=lambda: now[0])
        a = app.App(self.con, self.roots, pollers=[fake])
        for _ in range(40):  # one ingest-loop pass per minute, as App.loop runs them
            a.ingest()
            a.poll()
            now[0] += 60
        start = 1_800_000_000.0
        # Every 5 minutes; the failure at minute 5 waits 10 minutes, then the 5-minute rhythm resumes.
        self.assertEqual([int(c - start) // 60 for c in calls], [0, 5, 15, 20, 25, 30, 35])
        self.assertIsNone(a.state["error"])
        self.assertEqual(a.status()["limits"]["claude"]["failures"], 0)
        self.assertEqual(self.q("SELECT count(*) FROM limit_polls"), [(6,)])


if __name__ == "__main__":
    unittest.main()
