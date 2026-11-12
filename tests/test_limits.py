import io
import json
import os
import subprocess
import threading
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

from ai_ledger import limits, store
from test_store import StoreCase

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
        self.assertEqual(limits.label("codex", "codex_43200", "", 43200), "30-day")


class CredentialTest(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("ai_ledger.limits.time.time", return_value=1_800_000_000)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_expired_token_skips_without_http(self):
        with mock.patch("ai_ledger.limits.subprocess.run", return_value=keychain(expires_in=-60)), \
                mock.patch("ai_ledger.limits.urllib.request.urlopen") as urlopen:
            with self.assertRaises(limits.PollSkipped):
                limits.claude_poll()
            urlopen.assert_not_called()

    def test_no_credential(self):
        with mock.patch("ai_ledger.limits.subprocess.run", return_value=subprocess.CompletedProcess([], 44, "", "not found")):
            with self.assertRaises(limits.PollFailed):
                limits.claude_poll()
        with mock.patch("ai_ledger.limits.subprocess.run", side_effect=FileNotFoundError("security")):
            with self.assertRaises(limits.PollFailed):
                limits.claude_poll()

    def test_sends_the_token_only_to_the_usage_endpoint(self):
        with mock.patch("ai_ledger.limits.subprocess.run", return_value=keychain()), \
                mock.patch("ai_ledger.limits.urllib.request.urlopen", return_value=Response(json.dumps(usage_body()).encode())) as urlopen:
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
        patcher = mock.patch("ai_ledger.limits.time.time", side_effect=lambda: self.now)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_poll(self, keychain_result=None, response=None, error=None):
        urlopen = mock.Mock(side_effect=error) if error else mock.Mock(return_value=Response(json.dumps(response).encode()))
        with mock.patch("ai_ledger.limits.subprocess.run", return_value=keychain_result or keychain()), \
                mock.patch("ai_ledger.limits.urllib.request.urlopen", urlopen):
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
        with mock.patch("ai_ledger.limits.subprocess.run", return_value=keychain()), \
                mock.patch("ai_ledger.limits.urllib.request.urlopen", side_effect=ValueError(TOKEN)):
            self.poller.run(self.con, self.lock)
        seen = json.dumps(self.poller.state) + self.stored_text()
        self.assertNotIn("SENTINEL", seen)
        self.assertEqual(self.poller.state["error"], "usage endpoint returned invalid JSON")


class AppPollTest(StoreCase):
    def test_polls_are_spaced_back_off_and_never_stop_ingest(self):
        from ai_ledger import app
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


PRICES = {m: dict(input=1, output=0, cache_read=0, cache_5m=0, cache_1h=0, context=None)
          for m in ("claude-opus-5-5", "claude-fable-5-1", "gpt-6-astra")}  # $1 per million input tokens
T0 = datetime(2026, 11, 1, 5, 0)  # a Claude weekly window from T0 to T0 + 7 days


def at(t):
    return t.replace(tzinfo=timezone.utc)


class AnalysisCase(StoreCase):
    def spend(self, source, model, *uses):
        """Requests costing the given dollars at the given times, one session per source."""
        cur = self.con.cursor()
        sid = f"s-{source}"
        cur.execute("INSERT INTO sessions (session_id, project, source) VALUES (?, 'foo', ?) ON CONFLICT DO NOTHING", [sid, source])
        cur.execute("INSERT INTO prompts (prompt_id, session_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [f"p-{sid}", sid])
        n = self.q("SELECT count(*) FROM requests")[0][0]
        store.insert(cur, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                       "cache_read", "cache_5m", "cache_1h"],
                     [(f"m{n + i}", sid, t, model, False, int(c * 1e6), 0, 0, 0, 0, 0) for i, (t, c) in enumerate(uses)])

    def snap(self, provider, limit_id, observed, pct, resets=T0 + timedelta(days=7), minutes=10080, plan="max", scope="", reached=False):
        store.write_snapshots(self.con.cursor(), [store.snapshot(provider, limit_id, scope, minutes, at(resets), observed, pct, plan, reached)])

    def windows(self, now):
        snaps = self.q(f"SELECT {', '.join(store.SNAPSHOT_COLS)} FROM limit_snapshots")
        by = limits.group_windows(snaps)
        for ws in by.values():
            limits.close_windows(ws, now)
        return by, snaps

    def usage(self):
        return limits.load_usage(self.con.cursor(), PRICES)

    def payload(self, now, **kw):
        cur = self.con.cursor()
        cur.execute("SET TimeZone = 'UTC'")  # the store's days in the same zone as tz
        return limits.payload(cur, now=now, today=now.date(), prices=PRICES, tz=timezone.utc, **kw)


class WindowTest(AnalysisCase):
    def test_plan_upgrade_closes_window_early(self):
        old, new = datetime(2026, 11, 11, 15, 22), datetime(2026, 11, 13, 4, 56)
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 3, 22), 22, resets=old, plan="plus")
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 4, 56, 45), 2, resets=new, plan="prolite")
        by, snaps = self.windows(datetime(2026, 11, 6, 8))
        first, second = by[("codex", "codex_10080", "")]
        self.assertEqual((first.final, first.early, first.reason, first.closed_at), (22, True, "plan change from plus to prolite",
                                                                                     datetime(2026, 11, 6, 4, 56, 45)))
        self.assertIsNone(second.closed_at)
        self.assertEqual(limits.plan_changes(snaps), [dict(kind="plan_change", provider="codex", at="2026-11-06T04:56:45.000Z",
                                                           plan_from="plus", plan_to="prolite")])

    def test_limit_hit_lasts_until_reset(self):
        reset = datetime(2026, 11, 6, 4, 7)
        for t, pct in ((datetime(2026, 11, 5, 22, 53), 49), (datetime(2026, 11, 5, 23, 52), 100), (datetime(2026, 11, 6, 0, 30), 100)):
            self.snap("codex", "codex_300", t, pct, resets=reset, minutes=300, plan="plus")
        now = datetime(2026, 11, 6, 9)
        by, _ = self.windows(now)
        row = limits.history_row(by[("codex", "codex_300", "")][0])
        self.assertEqual((row["hit"], row["hit_minutes"], row["final"]), (True, 255, 100))

    def test_reset_drift_is_one_window(self):
        self.snap("codex", "codex_10080", datetime(2026, 10, 21, 6, 0, 32), 0, resets=datetime(2026, 10, 28, 6, 0), plan="prolite")
        self.snap("codex", "codex_10080", datetime(2026, 10, 21, 6, 0, 41), 1, resets=datetime(2026, 10, 28, 6, 1), plan="prolite")
        by, _ = self.windows(datetime(2026, 10, 22))
        self.assertEqual(len(by[("codex", "codex_10080", "")]), 1)


class CalibrationTest(AnalysisCase):
    def test_dollars_per_point(self):
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=1), 320), (T0 + timedelta(days=3), 80))
        self.snap("claude", "weekly_all", T0 + timedelta(days=2), 40)
        self.snap("claude", "weekly_all", T0 + timedelta(days=4), 50)
        by, _ = self.windows(T0 + timedelta(days=4))
        cal = limits.calibrate(by[("claude", "weekly_all", "")], self.usage())
        self.assertEqual((cal["per_pct"], cal["points"], cal["windows"]), (8.0, 50.0, 1))

    def test_one_poll_calibrates_a_known_window(self):
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=2), 1140))
        self.snap("claude", "weekly_all", T0 + timedelta(days=5), 57)
        by, _ = self.windows(T0 + timedelta(days=5))
        self.assertEqual(limits.calibrate(by[("claude", "weekly_all", "")], self.usage())["per_pct"], 20.0)

    def test_small_move_adds_nothing(self):
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(hours=1), 30))
        self.snap("claude", "weekly_all", T0 + timedelta(hours=2), 3)
        by, _ = self.windows(T0 + timedelta(hours=2))
        self.assertIsNone(limits.calibrate(by[("claude", "weekly_all", "")], self.usage()))

    def test_plan_change_restarts_calibration(self):
        prev = T0 - timedelta(days=7)
        self.spend("claude", "claude-opus-5-5", (prev + timedelta(days=1), 100))
        self.snap("claude", "weekly_all", prev + timedelta(days=2), 50, resets=T0, plan="pro")
        self.snap("claude", "weekly_all", T0 + timedelta(hours=1), 1, plan="max")
        by, _ = self.windows(T0 + timedelta(hours=1))
        self.assertIsNone(limits.calibrate(by[("claude", "weekly_all", "")], self.usage()))

    def test_scoped_limit_counts_only_its_model(self):
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=1), 500))
        self.spend("claude", "claude-fable-5-1", (T0 + timedelta(days=1), 60))
        self.snap("claude", "weekly_scoped", T0 + timedelta(days=2), 10, scope="Fable")
        by, _ = self.windows(T0 + timedelta(days=2))
        self.assertEqual(limits.calibrate(by[("claude", "weekly_scoped", "Fable")], self.usage())["per_pct"], 6.0)


class EstimateTest(AnalysisCase):
    def test_between_polls(self):
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=1), 456), (T0 + timedelta(days=4, hours=1), 16))
        self.snap("claude", "weekly_all", T0 + timedelta(days=4), 57)
        by, _ = self.windows(T0 + timedelta(days=4, hours=2))
        ws = by[("claude", "weekly_all", "")]
        cal = limits.calibrate(ws, self.usage())
        self.assertEqual(cal["per_pct"], 8.0)
        self.assertEqual(limits.estimate(ws[0], T0 + timedelta(days=4, hours=2), self.usage(), cal), (59.0, False))

    def test_history_before_polling_started(self):
        self.spend("claude", "claude-opus-5-5", (T0 - timedelta(days=5), 40), (T0 - timedelta(days=12), 0.5), (T0 + timedelta(days=1), 200))
        self.snap("claude", "weekly_all", T0 + timedelta(days=5), 25)
        out = self.payload(T0 + timedelta(days=5))
        past = [h for h in out["history"] if h["provider"] == "claude"]
        self.assertEqual([(h["start"], h["final"], h["estimated"]) for h in past],
                         [("2026-10-25T05:00:00.000Z", 5.0, True), ("2026-10-18T05:00:00.000Z", 0.1, True)])
        self.assertFalse(any(h["hit"] for h in past))
        series = out["windows"][0]["series"]
        self.assertFalse(series[24]["measured"])
        self.assertEqual(series[-1], dict(t="2026-11-06T05:00:00.000Z", pct=25.0, measured=True))


def busy_days(case, source, model, days, end, per_hour, hours=range(8, 23)):
    """Usage on each of the last `days` days before end, only in the given UTC hours."""
    uses = []
    for d in range(1, days + 1):
        day = (end - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        uses += [(day + timedelta(hours=h, minutes=30), per_hour) for h in hours]
    case.spend(source, model, *uses)


class ForecastTest(AnalysisCase):
    def forecast_for(self, now, pct, resets):
        self.snap("claude", "weekly_all", now, pct, resets=resets)
        return self.payload(now)["windows"][0]

    def test_quiet_hours_add_almost_nothing(self):
        now = datetime(2026, 11, 6, 0, 0)
        busy_days(self, "claude", "claude-opus-5-5", 30, now, 1.0)
        w = self.forecast_for(now, 50, datetime(2026, 11, 9, 0, 0))
        curve = {p["t"][11:16]: p["mid"] for p in w["forecast"]["curve"][:10]}
        self.assertEqual(w["forecast"]["kind"], "shaped")
        self.assertLess(curve["07:00"] - curve["00:00"], 0.01)  # nights: no use in the profile
        self.assertGreater(curve["09:00"], curve["08:00"])  # the 08:00-09:00 hour is a busy one

    def test_runs_out_before_reset(self):
        now = datetime(2026, 11, 6, 0, 0)
        busy_days(self, "claude", "claude-opus-5-5", 30, now, 2.0)
        # $30 a day; the window has cost $X since its start, so a point is worth X / 57.
        w = self.forecast_for(now, 95, datetime(2026, 11, 8, 0, 0))
        f = w["forecast"]
        self.assertIsNotNone(f["hits_at"])
        self.assertLessEqual(f["hits_at_early"], f["hits_at"])
        self.assertTrue(f["hits_at"] < w["resets_at"])
        self.assertIsNone(f["at_reset"])
        self.assertEqual(f["pace"], "ahead")

    def test_resets_first_with_bounds(self):
        now = datetime(2026, 11, 6, 0, 0)
        busy_days(self, "claude", "claude-opus-5-5", 30, now, 0.1)
        w = self.forecast_for(now, 50, datetime(2026, 11, 6, 12, 0))
        f = w["forecast"]
        self.assertIsNone(f["hits_at"])
        self.assertTrue(f["at_reset_low"] <= f["at_reset"] <= f["at_reset_high"] < 100)
        self.assertEqual(f["pace"], "behind")

    def test_new_provider_is_flat(self):
        now = datetime(2026, 11, 6, 0, 0)
        busy_days(self, "claude", "claude-opus-5-5", 3, now, 1.0)
        w = self.forecast_for(now, 50, datetime(2026, 11, 9, 0, 0))
        self.assertEqual(w["forecast"]["kind"], "flat")

    def test_a_hot_window_runs_out(self):
        # A usual pace of $15 a day leaves room; the last day of this window used 30 points, which runs out first.
        now = datetime(2026, 11, 6, 0, 0)
        busy_days(self, "claude", "claude-opus-5-5", 30, now, 1.0)
        self.spend("claude", "claude-opus-5-5", (now - timedelta(days=3), 40))
        self.snap("claude", "weekly_all", now - timedelta(days=1), 20, resets=datetime(2026, 11, 9, 0, 0))
        w = self.forecast_for(now, 50, datetime(2026, 11, 9, 0, 0))
        f = w["forecast"]
        self.assertEqual((f["pace_window"], f["pace_window_hours"]), (30.0, 24.0))
        self.assertLess(f["pace_usual"], 10)
        self.assertEqual(f["pace_now"], round((f["pace_usual"] + 30) / 2, 2))  # halfway between the two
        self.assertIsNotNone(f["hits_at_early"])  # the range covers the window's own pace going on
        self.assertEqual(f["pace"], "ahead")

    def test_partial_first_day_is_a_day_rate(self):
        # First use 6 hours ago: $5 in a quarter of a day is $20 a day, not $5.
        now = datetime(2026, 11, 6, 0, 0)
        self.spend("claude", "claude-opus-5-5", (now - timedelta(hours=6), 5))
        mid, *_ = limits.Profile(self.usage(), now, timezone.utc).level("claude", "")
        self.assertAlmostEqual(mid, 20.0)

    def test_no_calibration_no_forecast(self):
        now = datetime(2026, 11, 6, 0, 0)
        w = self.forecast_for(now, 2, datetime(2026, 11, 9, 0, 0))
        self.assertIsNone(w["forecast"])
        self.assertIn("Not calibrated", w["no_forecast"])


class SteppingTest(unittest.TestCase):
    """The loop that steps every forecast line: a hit time inside its step, a day's use over the hour shape, the reset."""
    NOW = datetime(2026, 11, 6, 0, 0)

    class Profile(limits.Profile):
        """A profile with the paces set directly, in dollars a day (a point costs $1 in these tests)."""
        def __init__(self, now, pace, recent, shape=None, tz=timezone.utc):
            self.now, self.tz, self.pace, self.recent = now, tz, pace, recent
            self.shape = shape or [1 / 24] * 24

        def level(self, source, scope):
            return self.pace, self.pace, self.pace, bool(self.shape != [1 / 24] * 24)

        def days(self, source, scope, n):
            return [(self.recent, 1.0)]

    def fc(self, current, hours, pace, recent, minutes=10080, **kw):
        w = SimpleNamespace(provider="claude", scope="", minutes=minutes, resets_at=self.NOW + timedelta(hours=hours))
        return limits.forecast(w, current, dict(per_pct=1.0), self.Profile(self.NOW, pace, recent, **kw))

    def test_a_hit_is_found_inside_its_step(self):
        # One-hour steps rising 10 points each: from 95%, 100% comes half an hour in, not at the end of the step.
        f = self.fc(95, 5, 240, 240)
        self.assertEqual(f["hits_at"], "2026-11-06T00:30:00.000Z")
        self.assertEqual(f["hits_at_early"], "2026-11-06T00:30:00.000Z")
        self.assertEqual(f["recent_hits_at"], "2026-11-06T00:30:00.000Z")
        g = self.fc(92, 5, 240, 480)  # the scenario rises 20 points an hour, the usual line 10
        self.assertEqual((g["recent_hits_at"], g["hits_at"]), ("2026-11-06T00:24:00.000Z", "2026-11-06T00:48:00.000Z"))

    def test_reaching_100_exactly_at_the_reset_is_no_hit(self):
        f = self.fc(99, 1, 24, 24)  # 1 point in the one hour left
        self.assertIsNone(f["hits_at"])
        self.assertIsNone(f["recent_hits_at"])
        self.assertEqual((f["at_reset"], f["at_reset_low"], f["at_reset_high"], f["recent_at_reset"]), (100, 100, 100, 100))
        self.assertIsNotNone(self.fc(99, 1, 25, 25)["hits_at"])  # a hair more is a hit, an instant before the reset

    def test_a_near_hit_does_not_round_up_to_100(self):
        f = self.fc(99, 1, 23.904, 23.904)  # ends at 99.996
        self.assertIsNone(f["hits_at"])
        self.assertIsNone(f["recent_hits_at"])
        self.assertEqual((f["at_reset"], f["at_reset_low"], f["at_reset_high"], f["recent_at_reset"]), (99.9, 99.9, 99.9, 99.9))
        self.assertEqual(f["curve"][-1]["recent"], 100)  # the curve's rounding is its own

    def test_a_busy_hour_inside_a_long_step_counts(self):
        # A 30-day window steps 4h17m: all use in 08:00-09:00 falls in steps whose midpoints miss it. A day still adds a day's pace.
        busy = [0.0] * 24
        busy[8] = 1.0
        f = self.fc(10, 24, 24, 24, minutes=43200, shape=busy)
        self.assertAlmostEqual(f["curve"][-1]["mid"], 34, places=1)
        self.assertAlmostEqual(f["curve"][-1]["recent"], 34, places=1)
        self.assertEqual(f["curve"][1]["mid"], 10)  # the step to 04:17 holds no busy hour; the next, to 08:34, does
        self.assertGreater(f["curve"][2]["mid"], 10)

    def test_a_day_of_steps_adds_the_days_use_for_any_shape_and_zone(self):
        shape = [i + 1 for i in range(24)]
        shape = [v / sum(shape) for v in shape]
        for tz in (timezone.utc, timezone(timedelta(hours=5, minutes=30)), timezone(timedelta(hours=-3))):
            for minutes in (10080, 43200, 300):
                with self.subTest(tz=tz, minutes=minutes):
                    f = self.fc(10, 24, 36, 36, minutes=minutes, shape=shape, tz=tz)
                    self.assertAlmostEqual(f["curve"][-1]["mid"], 46, places=1)
                    self.assertAlmostEqual(f["curve"][-1]["recent"], 46, places=1)

    def test_day_share_crosses_hour_boundaries(self):
        shape = [0.0] * 24
        shape[8], shape[9] = 0.5, 0.25
        p = self.Profile(self.NOW, 1, 1, shape=shape, tz=timezone(timedelta(minutes=30)))  # local 08:00 is 07:30 UTC
        share = lambda h, m, minutes: limits.day_share(p, shape, self.NOW.replace(hour=h, minute=m), timedelta(minutes=minutes))
        self.assertAlmostEqual(share(7, 30, 60), 0.5)
        self.assertAlmostEqual(share(8, 0, 60), 0.375)  # half of local hour 8, then half of hour 9
        self.assertAlmostEqual(share(0, 0, 1440), 0.75)


class RecentScenarioTest(AnalysisCase):
    """The second line, "if the last 24 hours continue": it never moves the usual-pace forecast."""
    NOW = datetime(2026, 11, 6, 0, 0)
    RESETS = datetime(2026, 11, 9, 0, 0)

    def forecast_for(self, pct, scope=""):
        self.snap("claude", "weekly_scoped" if scope else "weekly_all", self.NOW, pct, resets=self.RESETS, scope=scope)
        return self.payload(self.NOW)["windows"][0]["forecast"]

    def hot_day(self):
        busy_days(self, "claude", "claude-opus-5-5", 30, self.NOW, 1.0)
        self.spend("claude", "claude-opus-5-5", *[(self.NOW - timedelta(hours=h), 4.0) for h in range(1, 13)])

    def test_a_hot_day_runs_out_before_the_usual_pace_does(self):
        self.hot_day()
        f = self.forecast_for(50)
        self.assertEqual(f["curve"][0]["recent"], 50)
        self.assertEqual(f["curve"][-1]["recent"], 100)
        self.assertIsNotNone(f["recent_hits_at"])
        self.assertIsNone(f["recent_at_reset"])
        self.assertTrue(f["hits_at"] is None or f["recent_hits_at"] < f["hits_at"])
        self.assertGreater(f["recent_pace"], f["pace_usual"])

    def test_a_quiet_day_is_a_flat_line(self):
        busy_days(self, "claude", "claude-opus-5-5", 30, self.NOW - timedelta(days=1), 1.0)  # nothing in the last 24 hours
        self.spend("claude", "claude-opus-5-5", (self.NOW - timedelta(hours=30), 1.0))
        f = self.forecast_for(50)
        self.assertEqual(f["recent_pace"], 0)
        self.assertEqual({p["recent"] for p in f["curve"]}, {50})
        self.assertEqual(f["recent_at_reset"], 50)
        self.assertIsNone(f["recent_hits_at"])
        self.assertGreater(f["curve"][-1]["mid"], 50)  # the usual pace still moves

    def test_no_last_day_no_scenario(self):
        busy_days(self, "claude", "claude-opus-5-5", 30, self.NOW, 1.0)
        days = limits.Profile.days
        with mock.patch.object(limits.Profile, "days", lambda p, source, scope, n: [] if n == 1 else days(p, source, scope, n)):
            f = self.forecast_for(50)
        self.assertEqual((f["recent_pace"], f["recent_hits_at"], f["recent_at_reset"]), (None, None, None))
        self.assertEqual({p["recent"] for p in f["curve"]}, {None})
        self.assertIsNotNone(f["hits_at"] or f["at_reset"])

    def test_no_forecast_no_scenario(self):
        self.assertIsNone(self.forecast_for(2))  # no counted use, so no calibration and no forecast

    def test_the_usual_forecast_is_the_same_with_or_without_it(self):
        self.hot_day()
        self.snap("claude", "weekly_all", self.NOW, 50, resets=self.RESETS)
        both = self.payload(self.NOW)["windows"][0]["forecast"]
        days = limits.Profile.days
        with mock.patch.object(limits.Profile, "days", lambda p, source, scope, n: [] if n == 1 else days(p, source, scope, n)):
            usual = self.payload(self.NOW)["windows"][0]["forecast"]
        keep = lambda f: {k: v for k, v in f.items() if not k.startswith("recent") and k != "curve"}
        self.assertEqual(keep(both), keep(usual))
        self.assertEqual([{k: v for k, v in p.items() if k != "recent"} for p in both["curve"]],
                         [{k: v for k, v in p.items() if k != "recent"} for p in usual["curve"]])

    def test_a_scoped_window_counts_only_its_model(self):
        busy_days(self, "claude", "claude-opus-5-5", 30, self.NOW, 5.0)  # a heavy model the limit does not cover
        busy_days(self, "claude", "claude-fable-5-1", 10, self.NOW, 1.0)  # $15 a day: 4 days in the window cost $60
        f = self.forecast_for(50, scope="Fable")
        self.assertEqual(f["recent_pace"], round(15 / (60 / 50), 2))
        self.assertEqual(f["recent_pace"], 12.5)


class PayloadTest(AnalysisCase):
    NOW = datetime(2026, 11, 6, 12, 0)

    def setUp(self):
        super().setUp()
        busy_days(self, "claude", "claude-opus-5-5", 30, self.NOW, 3.0)
        busy_days(self, "codex", "gpt-6-astra", 30, self.NOW, 0.01)
        # Claude weekly runs out; Codex weekly resets at about 30%.
        self.snap("claude", "weekly_all", self.NOW, 90, resets=datetime(2026, 11, 8, 5, 0))
        self.snap("codex", "codex_10080", self.NOW, 28, resets=datetime(2026, 11, 7, 0, 0), plan="plus")
        self.snap("codex", "codex_10080", datetime(2026, 10, 20), 40, resets=datetime(2026, 10, 25), plan="plus")

    def test_binding_and_suggestion(self):
        out = self.payload(self.NOW)
        self.assertEqual(out["binding"], dict(provider="claude", limit_id="weekly_all", scope="", runs_out=True))
        self.assertEqual(out["suggestion"]["provider"], "codex")
        self.assertGreater(out["suggestion"]["unused_at_reset"], 60)
        self.assertIsNone(self.payload(self.NOW, source="codex")["suggestion"])  # nothing to compare with

    def test_a_window_at_its_limit_binds_and_is_never_suggested(self):
        self.snap("codex", "codex_300", self.NOW - timedelta(minutes=30), 100, resets=self.NOW + timedelta(hours=3), minutes=300, plan="plus")
        out = self.payload(self.NOW)
        codex = next(w for w in out["windows"] if w["limit_id"] == "codex_300")
        self.assertTrue(codex["at_limit"])
        self.assertEqual(out["binding"], dict(provider="codex", limit_id="codex_300", scope="", runs_out=True))
        self.assertIsNone(out["suggestion"])  # Claude runs out too, and Codex is out now

    def test_unused_leaves_out_early_and_idle_windows(self):
        # A plan change cuts one weekly window short; a Fable window before Fable was ever used has nothing to say.
        self.snap("codex", "codex_10080", datetime(2026, 11, 2), 10, resets=datetime(2026, 11, 8), plan="free")
        self.snap("claude", "weekly_scoped", datetime(2026, 10, 30), 0, resets=datetime(2026, 11, 1, 5), scope="Fable")
        out = self.payload(self.NOW, range_days=30)
        codex = next(u for u in out["unused"] if u["provider"] == "codex")
        self.assertEqual((codex["windows"], codex["early"], codex["avg_unused"]), (1, 1, 60))
        self.assertFalse([u for u in out["unused"] if "Fable" in u["label"]])
        self.assertTrue([h for h in out["history"] if "Fable" in h["label"]])  # still in the history

    def test_open_windows_ignore_range(self):
        out = self.payload(self.NOW, range_days=7)
        self.assertEqual(len(out["windows"]), 2)
        self.assertEqual([h["final"] for h in out["history"] if h["provider"] == "codex"], [])
        out = self.payload(self.NOW, range_days=30)
        self.assertEqual([h["final"] for h in out["history"] if h["provider"] == "codex"], [40])
        self.assertEqual([u["avg_unused"] for u in out["unused"] if u["provider"] == "codex"], [60])

    def test_source_narrows(self):
        out = self.payload(self.NOW, source="codex")
        self.assertEqual({w["provider"] for w in out["windows"]}, {"codex"})
        self.assertEqual([f["provider"] for f in out["freshness"]], ["codex"])
        with self.assertRaises(ValueError):
            self.payload(self.NOW, source="grok")

    def test_freshness_flags_failing_polls(self):
        out = self.payload(self.NOW + timedelta(minutes=30), polls=dict(claude=dict(failures=3, last_ok="2026-11-06T12:00:00+00:00",
                                                                                     error="usage endpoint unreachable", stale=False)))
        claude = out["freshness"][0]
        self.assertEqual(claude["flags"], ["polling failing", "old"])
        self.assertFalse(claude["measured"])

    def test_an_old_codex_reading_no_longer_measures(self):
        codex = lambda t: next(f for f in self.payload(t)["freshness"] if f["provider"] == "codex")
        self.assertTrue(codex(self.NOW + timedelta(minutes=30))["measured"])
        self.assertFalse(codex(self.NOW + timedelta(hours=2))["measured"])


class ValueTest(AnalysisCase):
    def test_commits_per_point_by_project(self):
        now = datetime(2026, 11, 6, 12, 0)
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=1), 80))
        self.snap("claude", "weekly_all", now, 10)  # $8 a point
        cur = self.con.cursor()
        cur.execute("INSERT INTO sessions (session_id, project, source) VALUES ('s-bar', 'bar', 'claude')")
        cur.execute("INSERT INTO prompts (prompt_id, session_id) VALUES ('p-bar', 's-bar')")
        store.insert(cur, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking", "cache_read",
                                       "cache_5m", "cache_1h"], [("b1", "s-bar", T0 + timedelta(days=2), "claude-opus-5-5", False, 16_000_000, 0, 0, 0, 0, 0)])
        store.insert(cur, "tool_calls", ["tool_use_id", "session_id", "tool", "start_ts", "is_commit", "test_passed"],
                     [(f"c{i}", "s-claude", "Bash", T0 + timedelta(days=1), True, True) for i in range(5)])
        value = self.payload(now)["value"]
        self.assertEqual(value["limits"][0]["cost_per_point"], 9.6)  # $96 over 10 points
        self.assertEqual([(p["project"], p["commits"], p["points"], p["commits_per_point"]) for p in value["projects"]],
                         [("foo", 5, 8.3, 0.6), ("bar", 0, 1.7, None)])
        only = self.payload(now, project="bar")["value"]["projects"]
        self.assertEqual([p["project"] for p in only], ["bar"])
        self.assertEqual(len(self.payload(now, project="bar")["windows"]), 1)
        self.assertEqual(sorted(self.payload(now, project="bar")["projects"]), ["bar", "foo"])  # the picker keeps every project

    def test_points_used_count_only_the_limits_windows_on_its_plan(self):
        now = datetime(2026, 11, 6, 12, 0)
        prices = dict(PRICES)
        del prices["gpt-6-astra"]
        self.spend("codex", "gpt-6-astra", (datetime(2026, 11, 6, 9), 1))  # no price: tokens, but no points
        self.spend("codex", "gpt-6-nova", (datetime(2026, 10, 20), 50), (datetime(2026, 11, 6, 8), 20))
        prices["gpt-6-nova"] = PRICES["claude-opus-5-5"]
        self.snap("codex", "codex_300", datetime(2026, 10, 20, 1), 10, resets=datetime(2026, 10, 20, 4), minutes=300, plan="plus")
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 10), 10, resets=datetime(2026, 11, 13), plan="pro")  # $2 a point
        out = limits.payload(self.con.cursor(), now=now, today=now.date(), prices=prices, tz=timezone.utc)
        weekly, five = sorted(out["value"]["limits"], key=lambda lim: lim["label"], reverse=True)
        self.assertEqual([(m["model"], m["points"], m["priced"]) for m in weekly["models"]],
                         [("gpt-6-nova", 10.0, True), ("gpt-6-astra", None, False)])  # not October's $50 on another plan
        self.assertEqual((weekly["past_plan"], five["plan"], five["past_plan"]), (False, "plus", True))


class ApiTest(AnalysisCase):
    def test_endpoint_and_unknown_source(self):
        import http.client
        from http.server import ThreadingHTTPServer
        from ai_ledger import app
        a = app.App(self.con, self.roots, pollers=[])
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(a))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            def get(path):
                h = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1])
                h.request("GET", path, headers={"Host": f"{app.HOST}:{app.PORT}"})
                r = h.getresponse()
                return r.status, r.read()
            status, body = get("/api/limits?range=30&source=codex")
            self.assertEqual((status, json.loads(body)["windows"]), (200, []))
            self.assertEqual(get("/api/limits?source=grok")[0], 400)
            self.assertEqual(get("/limits")[0] in (200, 503), True)
        finally:
            httpd.shutdown()
            httpd.server_close()


FIXTURE_NOW = datetime(2026, 11, 6, 12, 0)


def page_fixture(case):
    """The Limits payload the web page tests render: Claude weekly runs out before its reset while its polls fail;
    Codex weekly leaves room and has a history with a limit hit and an early reset by a plan change."""
    now = FIXTURE_NOW
    busy_days(case, "claude", "claude-opus-5-5", 30, now, 3.0)
    busy_days(case, "claude", "claude-fable-5-1", 30, now, 0.2, hours=range(20, 22))
    busy_days(case, "codex", "gpt-6-astra", 30, now, 0.01)
    case.spend("codex", "gpt-6-astra", (datetime(2026, 11, 6, 5, 30), 0.45))  # one long task early in the new week
    case.snap("claude", "weekly_all", now - timedelta(hours=2), 88, resets=datetime(2026, 11, 8, 5, 0))
    case.snap("claude", "weekly_all", now - timedelta(minutes=40), 90, resets=datetime(2026, 11, 8, 5, 0))
    case.snap("claude", "weekly_scoped", now - timedelta(minutes=40), 4, resets=datetime(2026, 11, 8, 5, 0), scope="Fable")
    for t, pct in ((datetime(2026, 11, 5, 22, 53), 49), (datetime(2026, 11, 5, 23, 52), 100)):
        case.snap("codex", "codex_300", t, pct, resets=datetime(2026, 11, 6, 4, 7), minutes=300, plan="plus")
    case.snap("codex", "codex_10080", datetime(2026, 11, 5, 23, 52), 22, resets=datetime(2026, 11, 11, 15, 22), plan="plus")
    case.snap("codex", "codex_10080", datetime(2026, 11, 6, 4, 56, 45), 2, resets=datetime(2026, 11, 13, 4, 56), plan="prolite")
    case.snap("codex", "codex_10080", now - timedelta(hours=1), 9, resets=datetime(2026, 11, 13, 4, 56), plan="prolite")
    case.snap("codex", "codex_10080", datetime(2026, 10, 25, 9), 30, resets=datetime(2026, 10, 28, 6, 0), plan="plus")
    case.snap("codex", "codex_10080", datetime(2026, 10, 18, 9), 50, resets=datetime(2026, 10, 21, 6, 0), plan="plus")
    polls = dict(claude=dict(last_ok=limits.metrics.iso(now - timedelta(minutes=40)), last_attempt=limits.metrics.iso(now),
                             failures=3, error="usage endpoint unreachable", stale=False))
    return case.payload(now, range_days=30, polls=polls)


class PageFixtureTest(AnalysisCase):
    def test_fixture_shows_every_section(self):
        out = page_fixture(self)
        self.assertTrue(out["binding"]["runs_out"])
        self.assertEqual(out["suggestion"]["provider"], "codex")
        self.assertTrue(any(h["hit"] for h in out["history"]))
        self.assertTrue(any(h["early"] for h in out["history"]))
        self.assertTrue(out["events"])
        self.assertTrue(out["value"]["limits"])
        self.assertIn("polling failing", out["freshness"][0]["flags"])
        full = [h for h in out["history"] if h["estimated"] and h["final"] == 100]
        self.assertTrue(full and all(h["hit"] and h["hit_minutes"] > 0 for h in full))


if __name__ == "__main__":
    unittest.main()
