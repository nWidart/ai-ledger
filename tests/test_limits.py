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


def extras_body(**over):
    """A hand-written usage response with a scoped limit's share of the weekly allowance and a breakdown by surface."""
    body = dict(
        limits=[dict(kind="weekly_all", group="weekly", percent=65, resets_at="2026-11-15T04:59:59.755590+00:00", scope=None),
                dict(kind="weekly_scoped", group="weekly", percent=42, resets_at="2026-11-15T04:59:59.755746+00:00",
                     scope=dict(model=dict(id=None, display_name="Fable"), surface=None))],
        weekly_scoped_shares=[dict(limit_index=1, used_percent_of_weekly=21, allowance_percent_of_weekly=50)],
        seven_day_breakdown=dict(as_of="2026-11-12T12:21:37.774782+00:00", window_started_at="2026-11-08T04:59:59.755590+00:00",
                                 rows=[dict(key="claude_code", display_name="Claude Code", percent=100), dict(key="chat", display_name="Chats", percent=0),
                                       dict(key="cowork", display_name="Cowork", percent=0), dict(key="other", display_name="Other", percent=0)]))
    return dict(body, **over)


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

    def test_any_truthy_kind_still_gives_its_snapshot(self):
        # Snapshots keep what they always did: a kind that is no string is a limit, and stays as it is.
        resets = "2026-11-08T05:00:00+00:00"
        mixed = dict(limits=[dict(kind="weekly_all", group="weekly", percent=57, resets_at=resets),
                             dict(kind=7, group="weekly", percent=30, resets_at=resets),
                             dict(kind=0, group="weekly", percent=1, resets_at=resets),  # falsy: never a limit
                             dict(kind="", group="weekly", percent=1, resets_at=resets),
                             dict(kind=7.5, percent=2, resets_at=resets),
                             dict(kind="weekly_scoped", group=["weekly"], percent=4, resets_at=resets, scope=dict(model="Fable"))])
        self.assertEqual(self.rows(mixed), [("weekly_all", "", 10080, "2026-11-08T05:00:00", 57.0, "max"),
                                            (7, "", 10080, "2026-11-08T05:00:00", 30.0, "max"),
                                            (7.5, "", None, "2026-11-08T05:00:00", 2.0, "max"),
                                            ("weekly_scoped", "", None, "2026-11-08T05:00:00", 4.0, "max")])
        only = dict(limits=[dict(kind=7, group="weekly", percent=30, resets_at=resets)], five_hour=dict(utilization=9.0, resets_at=resets))
        self.assertEqual(self.rows(only), [(7, "", 10080, "2026-11-08T05:00:00", 30.0, "max")])  # no legacy fallback

    def test_unknown_kind_keeps_its_name(self):
        body = dict(limits=[dict(kind="monthly_extra", group="monthly", percent=4, resets_at="2026-12-01T00:00:00Z")])
        rows = limits.claude_rows(dict(plan=None, response=body), NOW)
        self.assertEqual(rows[0][3], None)
        self.assertEqual(limits.label("claude", "monthly_extra", "", None), "monthly extra")
        self.assertEqual(limits.label("claude", "weekly_scoped", "Fable", 10080), "weekly · Fable")
        self.assertEqual(limits.label("codex", "premium_10080", "", 10080), "premium · weekly")
        self.assertEqual(limits.label("codex", "codex_43200", "", 43200), "30-day")


class ExtrasParseTest(unittest.TestCase):
    def extras(self, body):
        return limits.claude_extras(dict(plan="max", response=body))

    def test_the_scoped_share_and_the_surfaces(self):
        self.assertEqual(self.extras(extras_body()), dict(
            shares=[dict(kind="weekly_scoped", scope="Fable", resets_at=datetime(2026, 11, 15, 4, 59, 59, 755746), used=21, allowance=50)],
            surfaces=dict(as_of=datetime(2026, 11, 12, 12, 21, 37, 774782), reset=datetime(2026, 11, 15, 4, 59, 59, 755590),
                          window_started_at=datetime(2026, 11, 8, 4, 59, 59, 755590),
                          rows=[dict(key="claude_code", label="Claude Code", percent=100), dict(key="chat", label="Chats", percent=0),
                                dict(key="cowork", label="Cowork", percent=0), dict(key="other", label="Other", percent=0)])))

    def test_a_response_without_the_keys_has_none(self):
        body = extras_body()
        del body["weekly_scoped_shares"], body["seven_day_breakdown"]
        self.assertIsNone(self.extras(body))
        self.assertIsNone(self.extras(dict(five_hour=dict(utilization=12.0, resets_at="2026-11-06T18:00:00+00:00"))))
        for poll in ({}, dict(plan="max"), dict(response=None), dict(response=["x"]), dict(response="x")):
            self.assertIsNone(limits.claude_extras(poll))

    def test_only_one_of_them_is_kept_alone(self):
        shares = self.extras(extras_body(seven_day_breakdown=None))
        self.assertEqual((len(shares["shares"]), shares["surfaces"]), (1, None))
        surfaces = self.extras(extras_body(weekly_scoped_shares=None))
        self.assertEqual((surfaces["shares"], len(surfaces["surfaces"]["rows"])), ([], 4))

    def test_nulls_have_none(self):
        self.assertIsNone(self.extras(extras_body(weekly_scoped_shares=None, seven_day_breakdown=None)))
        self.assertIsNone(self.extras(extras_body(weekly_scoped_shares=[None, 3, "x", dict(), dict(limit_index=None)],
                                                  seven_day_breakdown=dict(as_of=None, rows=None))))
        self.assertIsNone(self.extras(extras_body(limits=None)))
        self.assertIsNone(self.extras(extras_body(limits=7)))

    def test_a_limit_index_must_name_a_limit(self):
        share = lambda i: dict(limit_index=i, used_percent_of_weekly=21, allowance_percent_of_weekly=50)
        for bad in (2, 99, -1, "1", 1.0, True, None, [1]):
            self.assertEqual(self.extras(extras_body(weekly_scoped_shares=[share(bad)], seven_day_breakdown=None)), None, bad)
        # An index that names an item the parser does not read as a limit.
        body = extras_body(weekly_scoped_shares=[share(2)])
        body["limits"].append(dict(kind="weekly_scoped", group="weekly", resets_at="2026-11-15T05:00:00Z"))
        self.assertEqual(self.extras(body)["shares"], [])

    def test_an_invalid_share_is_dropped_and_the_others_stay(self):
        shares = [dict(limit_index=1, used_percent_of_weekly=-3, allowance_percent_of_weekly=50),
                  dict(limit_index=0, used_percent_of_weekly=5, allowance_percent_of_weekly=100)]
        out = self.extras(extras_body(weekly_scoped_shares=shares))["shares"]
        self.assertEqual([(s["kind"], s["used"], s["allowance"]) for s in out], [("weekly_all", 5, 100)])

    def test_percents_out_of_range_or_not_numbers_are_dropped(self):
        shares = lambda used, allowance: [dict(limit_index=1, used_percent_of_weekly=used, allowance_percent_of_weekly=allowance)]
        for used, allowance in ((120, 50), (-1, 50), (21, 101), (21, -50), ("21", 50), (21, "50"), (None, 50), (21, None), (True, 50),
                                (float("nan"), 50), ([], 50), (21, {})):
            self.assertEqual(self.extras(extras_body(weekly_scoped_shares=shares(used, allowance), seven_day_breakdown=None)), None,
                             (used, allowance))
        for used, allowance in ((0, 0), (0, 100), (12.5, 50)):
            self.assertEqual(len(self.extras(extras_body(weekly_scoped_shares=shares(used, allowance)))["shares"]), 1)

    def test_surface_rows_are_the_valid_ones_in_order(self):
        rows = [dict(key="chat", percent=60), dict(key="claude_code", display_name="Claude Code", percent=40.5),
                dict(key="x", percent=101), dict(key="y", percent=-1), dict(key="z", percent="3"), dict(key="w", percent=None),
                dict(key=3, percent=1), dict(percent=1), None, "row", dict(key="b", display_name=7, percent=True)]
        got = self.extras(extras_body(seven_day_breakdown=dict(rows=rows)))["surfaces"]["rows"]
        self.assertEqual(got, [dict(key="chat", label="chat", percent=60), dict(key="claude_code", label="Claude Code", percent=40.5)])

    def test_unreadable_breakdowns_have_none(self):
        for breakdown in (dict(rows="chat"), dict(rows=dict(key="chat", percent=1)), dict(rows=[]), dict(rows=[None]), dict(), [], "x", 5):
            self.assertIsNone(self.extras(extras_body(weekly_scoped_shares=None, seven_day_breakdown=breakdown)), breakdown)

    def test_a_breakdown_needs_the_weekly_limit_it_describes(self):
        body = extras_body(weekly_scoped_shares=None)
        body["limits"] = [body["limits"][1]]  # only the scoped one
        self.assertIsNone(self.extras(body))
        body["limits"] = [dict(kind="five_hour", group="five_hour", percent=3, resets_at="2026-11-12T15:00:00Z", scope=None)]
        self.assertIsNone(self.extras(body))

    def test_unreadable_times_are_none(self):
        body = extras_body(seven_day_breakdown=dict(as_of=5, window_started_at="soon", rows=[dict(key="chat", percent=1)]))
        s = self.extras(body)["surfaces"]
        self.assertEqual((s["as_of"], s["window_started_at"], len(s["rows"])), (None, None, 1))
        body = extras_body()
        body["limits"][1]["resets_at"] = "tomorrow"
        self.assertEqual(self.extras(body)["shares"], [])

    def test_a_limit_with_no_text_kind_is_a_snapshot_but_no_share_target(self):
        body = extras_body()
        body["limits"].append(dict(kind=7, group="weekly", percent=3, resets_at="2026-11-15T05:00:00Z"))
        body["weekly_scoped_shares"].append(dict(limit_index=2, used_percent_of_weekly=1, allowance_percent_of_weekly=10))
        self.assertEqual([s["used"] for s in self.extras(body)["shares"]], [21])
        self.assertEqual(len(limits.claude_rows(dict(plan="max", response=body), NOW)), 3)

    def test_a_time_that_overflows_is_no_time(self):
        far = "0001-01-01T00:00:00+01:00"  # parses, but is before the first UTC instant
        self.assertIsNone(limits.utc_naive(far))
        # A bad as_of leaves the rows, a bad share reset only that share, a bad weekly reset only the surfaces.
        body = extras_body()
        body["seven_day_breakdown"]["as_of"] = far
        body["seven_day_breakdown"]["window_started_at"] = far
        got = self.extras(body)
        self.assertEqual((got["surfaces"]["as_of"], got["surfaces"]["window_started_at"], len(got["surfaces"]["rows"]), len(got["shares"])), (None, None, 4, 1))
        body = extras_body()
        body["limits"][1]["resets_at"] = far
        got = self.extras(body)
        self.assertEqual((got["shares"], len(got["surfaces"]["rows"])), ([], 4))
        body = extras_body()
        body["limits"][0]["resets_at"] = far
        got = self.extras(body)
        self.assertEqual((len(got["shares"]), got["surfaces"]), (1, None))

    def test_the_stored_poll_is_the_one_the_rows_parse(self):
        # A share is keyed like the snapshot of the limit it names, so the two can be matched.
        body = extras_body()
        rows = limits.claude_rows(dict(plan="max", response=body), NOW)
        share = self.extras(body)["shares"][0]
        self.assertIn((share["kind"], share["scope"]), [(r[1], r[2]) for r in rows])


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

    def test_a_history_row_names_the_window_it_describes(self):
        self.snap("claude", "weekly_scoped", T0 + timedelta(days=1), 10, scope="Fable")
        self.snap("codex", "codex_300", datetime(2026, 11, 5, 23, 52), 40, resets=datetime(2026, 11, 6, 4, 7), minutes=300, plan="plus")
        by, _ = self.windows(T0 + timedelta(days=9))
        row = limits.history_row(by[("claude", "weekly_scoped", "Fable")][0])
        self.assertEqual((row["limit_id"], row["scope"], row["window_minutes"], row["resets_at"], row["start"]),
                         ("weekly_scoped", "Fable", 10080, "2026-11-08T05:00:00.000Z", "2026-11-01T05:00:00.000Z"))
        row = limits.history_row(by[("codex", "codex_300", "")][0])
        self.assertEqual((row["limit_id"], row["scope"], row["window_minutes"], row["resets_at"]), ("codex_300", "", 300, "2026-11-06T04:07:00.000Z"))

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


class AlertPayloadTest(AnalysisCase):
    """The alert is taken from the payload's windows after freshness() has cleared `measured` for a stale provider."""
    NOW = datetime(2026, 11, 6, 12, 0)

    def setUp(self):
        super().setUp()
        busy_days(self, "codex", "gpt-6-astra", 30, self.NOW, 0.01)
        self.snap("codex", "codex_300", self.NOW - timedelta(minutes=30), 100, resets=self.NOW + timedelta(hours=3), minutes=300, plan="plus")

    def test_a_fresh_reading_is_measured(self):
        alert = limits.alert_of(self.payload(self.NOW)["windows"])
        self.assertEqual((alert["kind"], alert["provider"], alert["measured"]), ("at_limit", "codex", True))

    def test_an_old_reading_is_not(self):
        alert = limits.alert_of(self.payload(self.NOW + timedelta(hours=2))["windows"])  # Codex is not polled: an hour-old reading no longer measures now
        self.assertEqual((alert["kind"], alert["provider"], alert["measured"]), ("at_limit", "codex", False))


class UsageExtrasPayloadTest(AnalysisCase):
    """The scoped limit's share of the weekly allowance and the breakdown by surface, from the newest stored poll."""
    NOW = datetime(2026, 11, 6, 12, 0)
    RESET = "2026-11-08T05:00:00+00:00"

    def setUp(self):
        super().setUp()
        self.snap("claude", "weekly_all", self.NOW, 65, resets=datetime(2026, 11, 8, 5, 0))
        self.snap("claude", "weekly_scoped", self.NOW, 42, resets=datetime(2026, 11, 8, 5, 0), scope="Fable")
        self.snap("codex", "codex_10080", self.NOW, 28, resets=datetime(2026, 11, 7, 0, 0), plan="plus")

    def poll(self, polled_at, reset=RESET, shares=(21, 50), provider="claude", **over):
        body = extras_body(weekly_scoped_shares=[dict(limit_index=1, used_percent_of_weekly=shares[0], allowance_percent_of_weekly=shares[1])], **over)
        for it in body["limits"]:
            it["resets_at"] = reset
        poll = dict(plan="max", response=body)
        store.insert(self.con.cursor(), "limit_polls", ["provider", "polled_at", "json"], [(provider, polled_at, json.dumps(poll))])

    def windows(self, now=None, **kw):
        return {(w["provider"], w["limit_id"]): w for w in self.payload(now or self.NOW, **kw)["windows"]}

    def test_a_scoped_window_has_its_share_and_the_unscoped_weekly_its_surfaces(self):
        self.poll(self.NOW)
        ws = self.windows()
        scoped, weekly = ws["claude", "weekly_scoped"], ws["claude", "weekly_all"]
        self.assertEqual(scoped["weekly_share"], dict(used=21, allowance=50))
        self.assertIsNone(scoped["surfaces"])
        self.assertIsNone(weekly["weekly_share"])
        self.assertEqual(weekly["surfaces"], dict(as_of="2026-11-12T12:21:37.774Z", rows=[
            dict(key="claude_code", label="Claude Code", percent=100), dict(key="chat", label="Chats", percent=0),
            dict(key="cowork", label="Cowork", percent=0), dict(key="other", label="Other", percent=0)]))

    def test_only_the_extras_and_labels_leave_the_store(self):
        self.poll(self.NOW)
        self.assertEqual(sorted(self.windows()["claude", "weekly_all"]["surfaces"]), ["as_of", "rows"])
        self.assertEqual(sorted(self.windows()["claude", "weekly_scoped"]["weekly_share"]), ["allowance", "used"])

    def test_a_codex_window_has_neither(self):
        self.poll(self.NOW)
        codex = self.windows()["codex", "codex_10080"]
        self.assertEqual((codex["weekly_share"], codex["surfaces"]), (None, None))
        self.poll(self.NOW, provider="codex")  # a poll stored under Codex has no parser either
        codex = self.windows()["codex", "codex_10080"]
        self.assertEqual((codex["weekly_share"], codex["surfaces"]), (None, None))

    def test_no_stored_poll_has_none(self):
        for w in self.windows().values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_poll_of_an_older_window_has_none(self):
        self.poll(self.NOW, reset="2026-11-01T05:00:00+00:00")
        for w in self.windows().values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_reset_that_drifts_a_few_seconds_is_the_same_window(self):
        self.poll(self.NOW, reset="2026-11-08T05:00:40+00:00")
        ws = self.windows()
        self.assertEqual(ws["claude", "weekly_scoped"]["weekly_share"], dict(used=21, allowance=50))
        self.assertIsNotNone(ws["claude", "weekly_all"]["surfaces"])

    def test_only_the_newest_poll_is_read(self):
        self.poll(self.NOW - timedelta(minutes=10), shares=(10, 50))
        self.poll(self.NOW, shares=(21, 50))
        self.assertEqual(self.windows()["claude", "weekly_scoped"]["weekly_share"], dict(used=21, allowance=50))
        # An older poll that matches does not stand in for a newest one that does not.
        self.poll(self.NOW + timedelta(minutes=10), reset="2026-11-01T05:00:00+00:00")
        for w in self.windows(self.NOW + timedelta(minutes=20)).values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_window_after_its_reset_with_no_newer_poll_has_none(self):
        self.poll(self.NOW)
        ws = self.windows(datetime(2026, 11, 9, 12, 0))  # the open window is the next, estimated one
        self.assertTrue(ws["claude", "weekly_all"]["resets_at"] > self.RESET)
        for w in ws.values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_poll_without_the_keys_has_none(self):
        body = extras_body()
        del body["weekly_scoped_shares"], body["seven_day_breakdown"]
        store.insert(self.con.cursor(), "limit_polls", ["provider", "polled_at", "json"], [("claude", self.NOW, json.dumps(dict(plan="max", response=body)))])
        for w in self.windows().values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_bad_time_in_the_breakdown_does_not_break_the_payload(self):
        self.poll(self.NOW, seven_day_breakdown=dict(as_of="0001-01-01T00:00:00+01:00", rows=[dict(key="chat", percent=100)]))
        ws = self.windows()
        self.assertEqual(ws["claude", "weekly_all"]["surfaces"], dict(as_of=None, rows=[dict(key="chat", label="chat", percent=100)]))
        self.assertEqual(ws["claude", "weekly_scoped"]["weekly_share"], dict(used=21, allowance=50))

    def test_a_reader_that_raises_never_breaks_the_payload(self):
        self.poll(self.NOW)
        with mock.patch.dict(limits.POLL_EXTRAS, claude=mock.Mock(side_effect=OverflowError("boom"))):
            ws = self.windows()
        self.assertEqual(sorted(k for k in ws), [("claude", "weekly_all"), ("claude", "weekly_scoped"), ("codex", "codex_10080")])
        for w in ws.values():
            self.assertEqual((w["weekly_share"], w["surfaces"]), (None, None))

    def test_a_stored_poll_that_is_not_json_never_breaks_the_payload(self):
        store.insert(self.con.cursor(), "limit_polls", ["provider", "polled_at", "json"], [("claude", self.NOW, "{not json")])
        self.assertEqual(self.windows()["claude", "weekly_all"]["surfaces"], None)

    def test_a_scoped_share_never_lands_on_another_scope(self):
        self.snap("claude", "weekly_scoped", self.NOW, 10, resets=datetime(2026, 11, 8, 5, 0), scope="Opus")
        self.poll(self.NOW)
        opus = next(w for w in self.payload(self.NOW)["windows"] if w["scope"] == "Opus")
        self.assertEqual((opus["weekly_share"], opus["surfaces"]), (None, None))

    def test_the_source_filter_leaves_it_off_codex_only(self):
        self.poll(self.NOW)
        self.assertEqual({w["provider"] for w in self.payload(self.NOW, source="codex")["windows"]}, {"codex"})
        self.assertEqual(self.windows(source="claude")["claude", "weekly_scoped"]["weekly_share"], dict(used=21, allowance=50))


class WindowUsedTest(AnalysisCase):
    """What used an open window: the counted, priced use from its start to now, by project and by model."""
    NOW = datetime(2026, 11, 6, 12, 0)
    RESETS = datetime(2026, 11, 9, 0, 0)  # a weekly window from Nov 2, 00:00

    def use(self, project, source, model, *uses):
        """Requests of a session of the given project (None: no project), costing the given dollars at the given times."""
        cur = self.con.cursor()
        sid = f"s-{source}-{project}"
        cur.execute("INSERT INTO sessions (session_id, project, source) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [sid, project, source])
        cur.execute("INSERT INTO prompts (prompt_id, session_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [f"p-{sid}", sid])
        n = self.q("SELECT count(*) FROM requests")[0][0]
        store.insert(cur, "requests", ["message_id", "session_id", "ts", "model", "subagent", "input", "output", "thinking",
                                       "cache_read", "cache_5m", "cache_1h"],
                     [(f"m{n + i}", sid, t, model, False, int(c * 1e6), 0, 0, 0, 0, 0) for i, (t, c) in enumerate(uses)])

    def used(self, pct=50, scope="", prices=None, **kw):
        self.snap("claude", "weekly_scoped" if scope else "weekly_all", self.NOW, pct, resets=self.RESETS, scope=scope)
        cur = self.con.cursor()
        cur.execute("SET TimeZone = 'UTC'")
        d = limits.payload(cur, now=self.NOW, today=self.NOW.date(), prices=prices or PRICES, tz=timezone.utc, **kw)
        return d["windows"][0]["used"]

    def ago(self, hours):
        return self.NOW - timedelta(hours=hours)

    def test_sums_only_use_inside_the_window_of_the_providers_source(self):
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(1), 10.0), (self.ago(2), 5.0))
        self.use("foo", "claude", "claude-opus-5-5", (datetime(2026, 11, 1, 23, 0), 40.0))  # before the window starts
        self.use("foo", "claude", "claude-opus-5-5", (self.NOW + timedelta(hours=1), 40.0))  # after now
        self.use("foo", "codex", "gpt-6-astra", (self.ago(1), 7.0))  # another provider
        u = self.used()
        self.assertEqual(u["total"], 15.0)
        self.assertEqual(u["projects"], [dict(project="foo", cost=15.0, share=1.0, points=50.0)])
        self.assertEqual(u["models"], [dict(model="claude-opus-5-5", cost=15.0, share=1.0, points=50.0)])
        self.assertEqual(u["total"], round(self.usage().cost("claude", "", datetime(2026, 11, 2), self.NOW), 2))

    def test_a_scoped_window_counts_only_its_models(self):
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(1), 30.0))
        self.use("foo", "claude", "claude-fable-5-1", (self.ago(2), 6.0))
        self.use("bar", "claude", "claude-opus-5-5", (self.ago(3), 30.0))
        u = self.used(scope="Fable")
        self.assertEqual(u["total"], 6.0)
        self.assertEqual([p["project"] for p in u["projects"]], ["foo"])
        self.assertEqual([m["model"] for m in u["models"]], ["claude-fable-5-1"])

    def test_top_three_most_first_and_ties_by_name(self):
        for project, cost in (("e", 1.0), ("d", 1.0), ("c", 4.0), ("b", 3.0), ("a", 1.0)):
            self.use(project, "claude", "claude-opus-5-5", (self.ago(1), cost))
        u = self.used()
        self.assertEqual(u["total"], 10.0)
        self.assertEqual([(p["project"], p["cost"], p["share"]) for p in u["projects"]], [("c", 4.0, 0.4), ("b", 3.0, 0.3), ("a", 1.0, 0.1)])
        self.assertLessEqual(sum(p["share"] for p in u["projects"]), 1)

    def test_a_tiny_share_is_never_rounded_to_zero(self):
        for project, cost in (("big", 100.0), ("small", 0.01), ("tiny", 0.001)):
            self.use(project, "claude", "claude-opus-5-5", (self.ago(1), cost))
        u = self.used()
        self.assertEqual([(p["project"], p["share"]) for p in u["projects"]], [("big", 0.9999), ("small", 0.0001), ("tiny", 0.0001)])
        self.assertTrue(all(p["share"] > 0 for p in u["projects"] + u["models"]))

    def test_models_take_the_top_three_too(self):
        prices = {**PRICES, "claude-sonnet-5": PRICES["claude-opus-5-5"]}
        for model, cost in (("claude-opus-5-5", 5.0), ("claude-fable-5-1", 2.0), ("claude-sonnet-5", 2.0), ("gpt-6-astra", 1.0)):
            self.use("foo", "claude", model, (self.ago(1), cost))
        u = self.used(prices=prices)
        self.assertEqual([(m["model"], m["share"]) for m in u["models"]],
                         [("claude-opus-5-5", 0.5), ("claude-fable-5-1", 0.2), ("claude-sonnet-5", 0.2)])
        self.assertLessEqual(sum(m["share"] for m in u["models"]), 1)

    def test_points_only_when_the_window_is_calibrated(self):
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(1), 9.0))
        self.use("bar", "claude", "claude-opus-5-5", (self.ago(2), 1.0))
        u = self.used(pct=50)  # $10 moved 50 points: $0.20 a point
        self.assertEqual([p["points"] for p in u["projects"]], [45.0, 5.0])
        self.assertEqual(u["models"][0]["points"], 50.0)

    def test_no_points_without_a_calibration(self):
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(1), 9.0))
        u = self.used(pct=2)  # under MIN_POINTS: not calibrated
        self.assertEqual(u["total"], 9.0)
        self.assertEqual((u["projects"][0]["points"], u["models"][0]["points"]), (None, None))
        self.assertEqual(u["projects"][0]["share"], 1.0)

    def test_none_when_nothing_was_counted(self):
        self.use("foo", "claude", "claude-opus-5-5", (datetime(2026, 11, 1, 23, 0), 40.0), (self.NOW + timedelta(hours=1), 40.0))
        self.assertIsNone(self.used(pct=2))

    def test_a_request_without_a_project_counts_but_is_no_project_row(self):
        self.use(None, "claude", "claude-opus-5-5", (self.ago(1), 6.0))
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(2), 4.0))
        u = self.used()
        self.assertEqual(u["total"], 10.0)
        self.assertEqual([(p["project"], p["share"]) for p in u["projects"]], [("foo", 0.4)])
        self.assertEqual(u["models"][0]["cost"], 10.0)

    def test_the_filters_do_not_apply(self):
        self.use("foo", "claude", "claude-opus-5-5", (self.ago(1), 4.0))
        self.use("bar", "claude", "claude-opus-5-5", (self.ago(2), 6.0))
        self.assertEqual(self.used(range_days=1, project="foo")["total"], 10.0)


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


class WindowCurveTest(AnalysisCase):
    """One closed window's curve, asked for when a bar of the history is picked."""
    ID = ("claude", "weekly_all", "")

    def curve(self, start, now, **kw):
        cur = self.con.cursor()
        return limits.window_curve(cur, kw.pop("provider", "claude"), kw.pop("limit_id", "weekly_all"), kw.pop("scope", ""), start,
                                   now=now, prices=PRICES)

    def measured_week(self):
        """A weekly window at 8 dollars a point, read at 40%, 50% and 70%."""
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=1), 320), (T0 + timedelta(days=3), 80))
        self.snap("claude", "weekly_all", T0 + timedelta(days=2), 40)
        self.snap("claude", "weekly_all", T0 + timedelta(days=4), 50)

    def test_a_measured_window_runs_from_its_start_to_its_close(self):
        self.measured_week()
        open_at = T0 + timedelta(days=4)
        open_series = self.payload(open_at)["windows"][0]["series"]  # what the open card drew
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=5), 160))
        self.snap("claude", "weekly_all", T0 + timedelta(days=6), 70)
        got = self.curve("2026-11-01T05:00:00.000Z", T0 + timedelta(days=10))
        w, series = got["window"], got["series"]
        self.assertEqual((w["start"], w["closed_at"], w["final"], w["estimated"], w["early"], w["hit"]),
                         ("2026-11-01T05:00:00.000Z", "2026-11-08T05:00:00.000Z", 70.0, False, False, False))
        self.assertEqual((w["limit_id"], w["scope"], w["window_minutes"], w["resets_at"]), ("weekly_all", "", 10080, "2026-11-08T05:00:00.000Z"))
        self.assertEqual((series[0]["t"], series[-1]["t"]), (w["start"], w["closed_at"]))
        self.assertEqual([(p["t"], p["pct"]) for p in series if p["measured"]],
                         [("2026-11-03T05:00:00.000Z", 40), ("2026-11-05T05:00:00.000Z", 50), ("2026-11-07T05:00:00.000Z", 70)])
        self.assertEqual(series[:len(open_series)], open_series)  # the points that were drawn while it was open are the same
        self.assertEqual(got["events"], [])

    def test_the_curve_ends_at_the_final_percent_whatever_was_counted_after_the_last_reading(self):
        self.measured_week()
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=5), 160))
        self.snap("claude", "weekly_all", T0 + timedelta(days=6), 70)
        self.spend("claude", "claude-opus-5-5", (T0 + timedelta(days=6, hours=12), 160))  # $20 of points no reading ever saw
        got = self.curve("2026-11-01T05:00:00.000Z", T0 + timedelta(days=10))
        after = [p for p in got["series"] if p["t"] > "2026-11-07T05:00:00.000Z"]
        self.assertTrue(after)
        self.assertEqual({p["pct"] for p in after}, {70.0})  # not 90
        self.assertFalse(any(p["measured"] for p in after))
        self.assertEqual(got["series"][-1], dict(t=got["window"]["closed_at"], pct=got["window"]["final"], measured=False))
        # between readings the estimates stay: the 50% reading at day 4 and the use before it keep their line
        self.assertIn(dict(t="2026-11-05T05:00:00.000Z", pct=50, measured=True), got["series"])

    def test_a_start_nearest_an_open_window_is_not_a_closed_one(self):
        # Unknown window length: a window starts at its first reading, so two can start a minute apart and reset a day apart.
        self.snap("codex", "codex_x", datetime(2026, 11, 6, 10, 0), 10, resets=datetime(2026, 11, 6, 15, 0), minutes=None, plan="plus")
        self.snap("codex", "codex_x", datetime(2026, 11, 6, 10, 1), 3, resets=datetime(2026, 11, 7, 15, 0), minutes=None, plan="plus")
        now = datetime(2026, 11, 6, 12)
        ask = lambda start: self.curve(start, now, provider="codex", limit_id="codex_x")
        self.assertEqual(ask("2026-11-06T10:00:00.000Z")["window"]["final"], 10.0)  # the closed one
        self.assertIsNone(ask("2026-11-06T10:01:00.000Z"))  # the open one: not the closed one a minute away
        self.assertEqual(ask("2026-11-06T10:00:30.000Z")["window"]["final"], 10.0)  # nearer the closed one

    def test_a_start_a_little_off_finds_the_window_and_a_far_one_does_not(self):
        self.measured_week()
        now = T0 + timedelta(days=10)
        self.assertEqual(self.curve("2026-11-01T05:01:00Z", now)["window"]["start"], "2026-11-01T05:00:00.000Z")
        self.assertIsNone(self.curve("2026-11-01T05:10:00.000Z", now))
        self.assertIsNone(self.curve("2026-11-08T05:00:00.000Z", now))
        self.assertIsNone(self.curve("2026-11-01T05:00:00.000Z", now, limit_id="weekly_scoped"))
        self.assertIsNone(self.curve("2026-11-01T05:00:00.000Z", now, scope="Fable"))
        self.assertIsNone(self.curve("2026-11-01T05:00:00.000Z", now, provider="codex"))

    def test_the_open_window_is_not_served(self):
        self.measured_week()
        self.assertIsNone(self.curve("2026-11-01T05:00:00.000Z", T0 + timedelta(days=5)))  # resets at T0 + 7 days
        self.assertIsNotNone(self.curve("2026-11-01T05:00:00.000Z", T0 + timedelta(days=7)))

    def test_an_estimated_window_before_the_first_snapshot_has_a_curve(self):
        self.spend("claude", "claude-opus-5-5", (T0 - timedelta(days=5), 40), (T0 - timedelta(days=12), 0.5), (T0 + timedelta(days=1), 200))
        self.snap("claude", "weekly_all", T0 + timedelta(days=5), 25)
        now = T0 + timedelta(days=5)
        listed = [h for h in self.payload(now)["history"] if h["estimated"]]
        self.assertEqual([h["start"] for h in listed], ["2026-10-25T05:00:00.000Z", "2026-10-18T05:00:00.000Z"])
        for h in listed:  # every estimated window of the history can be asked for, from the row's own start
            got = self.curve(h["start"], now)
            self.assertEqual(got["window"], h)
            self.assertEqual((got["series"][0]["t"], got["series"][-1]["t"]), (h["start"], h["closed_at"]))
            self.assertFalse(any(p["measured"] for p in got["series"]))
            self.assertAlmostEqual(got["series"][-1]["pct"], h["final"], delta=0.05)  # the series keeps 2 decimals, the row 1

    def test_every_window_the_payload_lists_can_be_asked_for_at_any_range(self):
        self.spend("claude", "claude-opus-5-5", (T0 - timedelta(days=5), 40), (T0 - timedelta(days=12), 0.5), (T0 + timedelta(days=1), 200))
        self.snap("claude", "weekly_all", T0 + timedelta(days=5), 25)
        now = T0 + timedelta(days=9)
        for days in (7, 14, 30):
            for h in self.payload(now, range_days=days)["history"]:
                self.assertEqual(self.curve(h["start"], now, limit_id=h["limit_id"], scope=h["scope"])["window"], h, days)

    def test_a_window_ended_early_has_its_plan_change(self):
        old, new = datetime(2026, 11, 11, 15, 22), datetime(2026, 11, 13, 4, 56)
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 3, 22), 22, resets=old, plan="plus")
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 4, 56, 45), 2, resets=new, plan="prolite")
        self.snap("codex", "codex_10080", datetime(2026, 11, 6, 6), 5, resets=new, plan="prolite")
        now = datetime(2026, 11, 6, 8)
        got = self.curve("2026-11-04T15:22:00.000Z", now, provider="codex", limit_id="codex_10080")
        self.assertEqual((got["window"]["early"], got["window"]["reason"], got["window"]["closed_at"], got["window"]["final"]),
                         (True, "plan change from plus to prolite", "2026-11-06T04:56:45.000Z", 22.0))
        self.assertEqual(got["series"][-1], dict(t="2026-11-06T04:56:45.000Z", pct=22.0, measured=False))
        self.assertEqual(got["events"], [dict(kind="plan_change", provider="codex", at="2026-11-06T04:56:45.000Z", plan_from="plus", plan_to="prolite")])
        self.assertIsNone(self.curve("2026-11-06T04:56:45.000Z", now, provider="codex", limit_id="codex_10080"))  # the window now open

    def test_a_window_that_hit_its_limit_says_so(self):
        reset = datetime(2026, 11, 6, 4, 7)
        for t, pct in ((datetime(2026, 11, 5, 22, 53), 49), (datetime(2026, 11, 5, 23, 52), 100)):
            self.snap("codex", "codex_300", t, pct, resets=reset, minutes=300, plan="plus")
        w = self.curve("2026-11-05T23:07:00.000Z", datetime(2026, 11, 6, 9), provider="codex", limit_id="codex_300")["window"]
        self.assertEqual((w["hit"], w["hit_minutes"], w["final"], w["window_minutes"]), (True, 255, 100.0, 300))

    def test_bad_input(self):
        self.measured_week()
        now = T0 + timedelta(days=10)
        for kw in (dict(provider="grok"), dict(provider=""), dict(start="")):
            with self.assertRaises(ValueError, msg=kw):
                self.curve(kw.pop("start", "2026-11-01T05:00:00.000Z"), now, **kw)
        for start in ("yesterday", "2026-13-45", "11/01/2026"):
            with self.assertRaises(ValueError, msg=start):
                self.curve(start, now)

    def test_the_payload_history_carries_no_curve(self):
        self.measured_week()
        history = self.payload(T0 + timedelta(days=10))["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(sorted(history[0]), sorted(["provider", "provider_label", "limit_id", "scope", "label", "window_minutes", "resets_at", "plan",
                                                     "start", "closed_at", "final", "hit", "hit_minutes", "early", "reason", "estimated"]))


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

    def test_window_route(self):
        import http.client
        from http.server import ThreadingHTTPServer
        from ai_ledger import app
        # Long past, so it is closed whenever the test runs; no usage, so no prices are needed: every point is a reading.
        for t, pct in ((datetime(2026, 1, 5, 6), 20), (datetime(2026, 1, 7, 6), 35)):
            self.snap("codex", "codex_10080", t, pct, resets=datetime(2026, 1, 10, 6), plan="plus")
        self.snap("codex", "codex_10080", datetime(2026, 1, 12, 6), 5, resets=datetime(2026, 1, 17, 6), plan="plus")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), app.handler(app.App(self.con, self.roots, pollers=[])))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            def get(path):
                h = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1])
                h.request("GET", path, headers={"Host": f"{app.HOST}:{app.PORT}"})
                r = h.getresponse()
                return r.status, json.loads(r.read())
            q = "/api/limits/window?provider=codex&limit_id=codex_10080&scope=&start="
            history = get("/api/limits")[1]["history"]
            self.assertEqual(len(history), 2)
            row = next(h for h in history if h["final"] == 35)
            status, body = get(q + row["start"])
            self.assertEqual((status, body["window"], body["events"]), (200, row, []))
            self.assertEqual(body["series"][-1]["t"], row["closed_at"])  # it starts at the first reading: nothing is calibrated
            self.assertIn(dict(t="2026-01-07T06:00:00.000Z", pct=35, measured=True), body["series"])
            self.assertEqual(get(q + "2026-01-01T00:00:00Z")[0], 404)  # no window starts there
            self.assertEqual(get(q + "2026-01-12T00:00:00Z")[0], 404)  # that one is open or was never there
            self.assertEqual(get("/api/limits/window?provider=codex&limit_id=nope&scope=&start=" + row["start"])[0], 404)
            for bad in (q + "soon", q, "/api/limits/window?provider=grok&limit_id=codex_10080&start=" + row["start"],
                        "/api/limits/window?limit_id=codex_10080&start=" + row["start"]):
                status, body = get(bad)
                self.assertEqual((status, bool(body["error"])), (400, True), bad)
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
    # The newest Claude poll holds the scoped limit's share of the weekly allowance and the week's use by surface.
    body = extras_body(weekly_scoped_shares=[dict(limit_index=1, used_percent_of_weekly=2, allowance_percent_of_weekly=50)],
                       seven_day_breakdown=dict(as_of="2026-11-06T11:20:00+00:00", window_started_at="2026-11-01T05:00:00+00:00", rows=[
                           dict(key="claude_code", display_name="Claude Code", percent=80), dict(key="chat", display_name="Chats", percent=15),
                           dict(key="cowork", display_name="Cowork", percent=5), dict(key="other", display_name="Other", percent=0)]))
    for it in body["limits"]:
        it["resets_at"] = "2026-11-08T05:00:00+00:00"
    store.insert(case.con.cursor(), "limit_polls", ["provider", "polled_at", "json"],
                 [("claude", now - timedelta(minutes=40), json.dumps(dict(plan="max", response=body)))])
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
        claude = {w["scope"]: w for w in out["windows"] if w["provider"] == "claude"}
        self.assertEqual(claude["Fable"]["weekly_share"], dict(used=2, allowance=50))
        self.assertEqual([r["percent"] for r in claude[""]["surfaces"]["rows"]], [80, 15, 5, 0])
        full = [h for h in out["history"] if h["estimated"] and h["final"] == 100]
        self.assertTrue(full and all(h["hit"] and h["hit_minutes"] > 0 for h in full))


class AlertTest(unittest.TestCase):
    """alert_of: the one alert the nav shows, from the open windows' rows."""

    def win(self, provider="claude", label="weekly", current=10.0, at_limit=False, hits=None, resets="2026-11-14T12:00:00", measured=True):
        fc = dict(hits_at=hits) if hits is not None else None
        return dict(provider=provider, provider_label=limits.provider_label(provider), limit_id=label, scope="",
                    label=label, current=current, at_limit=at_limit, forecast=fc, resets_at=resets, measured=measured)

    def test_nothing_in_alert(self):
        self.assertIsNone(limits.alert_of([]))
        self.assertIsNone(limits.alert_of([self.win(current=89.9), self.win(provider="codex", current=0)]))
        self.assertIsNone(limits.alert_of([self.win(current=None)]))  # a window with no reading says nothing

    def test_at_limit(self):
        got = limits.alert_of([self.win(current=100, at_limit=True)])
        self.assertEqual(got, dict(kind="at_limit", provider="claude", provider_label="Claude Code", label="weekly", current=100,
                                   at="2026-11-14T12:00:00", resets_at="2026-11-14T12:00:00", measured=True, count=1))

    def test_the_alert_carries_the_chosen_windows_measured_flag(self):
        self.assertFalse(limits.alert_of([self.win(current=100, at_limit=True, measured=False)])["measured"])
        self.assertFalse(limits.alert_of([self.win(current=95, measured=False)])["measured"])
        self.assertTrue(limits.alert_of([self.win(current=95, measured=True)])["measured"])
        # the flag of the window the alert names, not of another one in alert
        ws = [self.win(label="est", current=100, at_limit=True, measured=False, resets="2026-11-15T00:00:00"),
              self.win(label="read", current=100, at_limit=True, measured=True, resets="2026-11-14T00:00:00")]
        self.assertEqual(limits.alert_of(ws)["measured"], False)

    def test_at_limit_without_a_reading_still_counts(self):
        self.assertEqual(limits.alert_of([self.win(current=None, at_limit=True)])["kind"], "at_limit")

    def test_runs_out_is_at_the_hit(self):
        got = limits.alert_of([self.win(current=50, hits="2026-11-13T08:00:00")])
        self.assertEqual((got["kind"], got["at"], got["resets_at"], got["count"]), ("runs_out", "2026-11-13T08:00:00", "2026-11-14T12:00:00", 1))

    def test_high_is_at_the_threshold_and_up(self):
        self.assertEqual(limits.ALERT_PERCENT, 90)
        got = limits.alert_of([self.win(current=90.0)])
        self.assertEqual((got["kind"], got["current"], got["at"]), ("high", 90.0, "2026-11-14T12:00:00"))

    def test_precedence_across_windows(self):
        high, runs, capped = self.win(label="a", current=95), self.win(label="b", current=50, hits="2026-11-13T08:00:00"), \
            self.win(label="c", current=100, at_limit=True)
        self.assertEqual(limits.alert_of([high, runs, capped])["label"], "c")
        self.assertEqual(limits.alert_of([high, runs])["label"], "b")
        self.assertEqual(limits.alert_of([high])["label"], "a")

    def test_choice_among_windows_of_a_kind(self):
        late, soon = self.win(label="late", at_limit=True, resets="2026-11-15T00:00:00"), self.win(label="soon", at_limit=True, resets="2026-11-14T00:00:00")
        self.assertEqual(limits.alert_of([soon, late])["label"], "late")  # the one that resets last, as binding_of picks it
        first, second = self.win(label="first", hits="2026-11-13T01:00:00"), self.win(label="second", hits="2026-11-13T09:00:00")
        self.assertEqual(limits.alert_of([second, first])["label"], "first")
        full, fuller = self.win(label="full", current=91), self.win(label="fuller", current=97.5)
        self.assertEqual(limits.alert_of([full, fuller])["label"], "fuller")

    def test_count_is_every_window_in_any_state(self):
        ws = [self.win(label="a", current=100, at_limit=True), self.win(label="b", hits="2026-11-13T08:00:00"), self.win(label="c", current=92),
              self.win(label="d", current=40), self.win(label="e", current=None)]
        self.assertEqual(limits.alert_of(ws)["count"], 3)

    def test_a_window_counts_once(self):
        both = self.win(current=100, at_limit=True, hits="2026-11-13T08:00:00")
        got = limits.alert_of([both, self.win(current=95)])
        self.assertEqual((got["kind"], got["count"]), ("at_limit", 2))

    def test_binding_and_alert_pick_the_same_window(self):
        ws = [self.win(provider="claude", label="x", at_limit=True, resets="2026-11-14T00:00:00"),
              self.win(provider="codex", label="y", at_limit=True, resets="2026-11-16T00:00:00")]
        self.assertEqual((limits.binding_of(ws)["provider"], limits.alert_of(ws)["provider"]), ("codex", "codex"))
        ws = [self.win(provider="claude", hits="2026-11-13T09:00:00"), self.win(provider="codex", hits="2026-11-13T01:00:00")]
        self.assertEqual((limits.binding_of(ws)["provider"], limits.alert_of(ws)["provider"]), ("codex", "codex"))


if __name__ == "__main__":
    unittest.main()
