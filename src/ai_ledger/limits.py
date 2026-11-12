"""Plan limits: how much of each provider's rate-limit windows is used, and when each window will run out or reset.

Snapshots come from two places. Codex writes its limits into every rollout (codex.limit_rows, derived with the rest of
a thread). Claude Code writes none, so the app polls the account usage endpoint (Poller) and keeps each response in
limit_polls, the raw layer; rederive_polls turns them into snapshots again on a rebuild. Everything after that
(windows, calibration, estimates, the forecast) reads limit_snapshots and the counted requests, whatever the provider.
"""
import json
import subprocess
import time
import urllib.error
import urllib.request
from bisect import bisect_left, bisect_right
from datetime import datetime, timedelta, timezone
from typing import Callable, NamedTuple

from . import metrics, store

POLL_SECONDS = 5 * 60
MAX_BACKOFF = 60 * 60
READING_AGE = timedelta(hours=1)  # past this, a reading the app does not poll for (Codex) no longer measures now
WINDOW_NAMES = {300: "5-hour", 1440: "daily", 10080: "weekly", 43200: "30-day"}


# ---------- providers ----------

class Provider(NamedTuple):
    source: str  # sessions.source of the requests that use this provider's limits
    label: str
    poll: Callable | None = None  # () -> (plan, response); None when snapshots come from transcripts
    interval: int | None = None  # seconds between polls
    qualifier: Callable = lambda limit_id: None  # limit_id -> extra words for its label, when the window alone is ambiguous
    fixed: Callable = lambda minutes: False  # whether a window this long resets on a schedule, not on the first use after a reset


def claude_poll():
    return fetch_claude(read_claude_credential())


PROVIDERS = {
    "claude": Provider("claude", "Claude Code", claude_poll, POLL_SECONDS, fixed=lambda minutes: (minutes or 0) >= 1440),
    "codex": Provider("codex", "Codex", qualifier=lambda lid: None if lid.startswith("codex_") else lid.rsplit("_", 1)[0]),
}


def label(provider, limit_id, scope, minutes):
    """A limit's name on the page: its window ("weekly"), its scope ("weekly · Fable"), and the provider's qualifier.
    A limit the app has no window length for keeps the provider's own kind name."""
    name = WINDOW_NAMES.get(minutes) or (f"{minutes // 60}-hour" if minutes and minutes % 60 == 0 else None)
    name = name or limit_id.replace("_", " ")
    q = PROVIDERS[provider].qualifier(limit_id) if provider in PROVIDERS else None
    return " · ".join(x for x in (q, name, scope) if x)


# ---------- Claude Code: the account usage endpoint ----------

USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
KEYCHAIN_ITEM = "Claude Code-credentials"
GROUP_MINUTES = {"weekly": 10080, "five_hour": 300, "session": 300, "daily": 1440}
LEGACY_KEYS = {"five_hour": 300, "seven_day": 10080}


class PollSkipped(Exception):
    """No poll this time, and not a failure: the token expired and only Claude Code refreshes it."""


class PollFailed(Exception):
    """A poll that failed. Its message is fixed text: never anything that could hold the credential."""


def read_claude_credential():
    """Claude Code's OAuth credential from the macOS Keychain. Read on every poll and kept only in the caller's frame;
    the refresh token is never used, since refreshing rotates the token Claude Code relies on."""
    try:
        out = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_ITEM, "-w"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        raise PollFailed("cannot read the Claude credential: no macOS Keychain") from None
    if out.returncode != 0:
        raise PollFailed("no Claude credential in the Keychain")
    try:
        oauth = json.loads(out.stdout)["claudeAiOauth"]
        token, expires = oauth["accessToken"], oauth.get("expiresAt")
    except (ValueError, KeyError, TypeError):
        raise PollFailed("unreadable Claude credential") from None
    if isinstance(expires, (int, float)) and expires / 1000 <= time.time():
        raise PollSkipped("Claude token expired; it renews when Claude Code next runs")
    plan = "/".join(x for x in (oauth.get("subscriptionType"), oauth.get("rateLimitTier")) if x) or None
    return token, plan


def fetch_claude(cred):
    token, plan = cred
    req = urllib.request.Request(USAGE_URL, headers={"Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20",
                                                     "Content-Type": "application/json", "User-Agent": "ai-ledger"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        e.close()
        raise PollFailed(f"usage endpoint answered HTTP {e.code}") from None
    except (urllib.error.URLError, OSError):
        raise PollFailed("usage endpoint unreachable") from None
    except ValueError:
        raise PollFailed("usage endpoint returned invalid JSON") from None
    return plan, body


def parse_iso(s):
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def claude_limit(it):
    """(kind, scope, minutes, resets_at, percent) of one item of the response's limits list; None for an item that is no
    limit. Any truthy kind is one, used as it is: snapshots keep what they always did for any response."""
    if not isinstance(it, dict) or not isinstance(it.get("percent"), (int, float)) or not it.get("kind"):
        return None
    model = (it.get("scope") or {}).get("model") if isinstance(it.get("scope"), dict) else None
    model = model if isinstance(model, dict) else {}
    group, kind = it.get("group"), it["kind"]
    minutes = (GROUP_MINUTES.get(group) if isinstance(group, str) else None) or (GROUP_MINUTES.get(kind) if isinstance(kind, str) else None)
    return kind, model.get("display_name") or model.get("id") or "", minutes, it.get("resets_at"), it["percent"]


def claude_rows(poll, observed_at):
    """limit_snapshots rows from one stored poll ({plan, response}). Reads the generic limits list; a response without
    one falls back to the older five_hour / seven_day / seven_day_<model> keys."""
    body, plan = poll.get("response"), poll.get("plan")
    if not isinstance(body, dict):
        return []
    found = [x for x in map(claude_limit, body.get("limits") or []) if x]
    if not found:
        for key, v in body.items():
            if not isinstance(v, dict) or not isinstance(v.get("utilization"), (int, float)):
                continue
            base = next((k for k in LEGACY_KEYS if key == k or key.startswith(k + "_")), None)
            if base:
                found.append((key, key[len(base) + 1:].capitalize(), LEGACY_KEYS[base], v.get("resets_at"), v["utilization"]))
    rows = []
    for kind, scope, minutes, resets, pct in found:
        reset = parse_iso(resets)
        if reset:
            rows.append(store.snapshot("claude", kind, scope, minutes, reset, observed_at, pct, plan, pct >= 100))
    return rows


POLL_PARSERS = {"claude": claude_rows}


def percent_of(v):
    """v when it is a whole-or-decimal percent from 0 to 100, else None (a bool, a string, NaN and out-of-range values are not)."""
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 100 else None


def as_list(v):
    return v if isinstance(v, list) else []


def utc_naive(s):
    """A time as naive UTC, or None when it does not read (an offset that carries it past the year range included)."""
    d = parse_iso(s)
    try:
        return d.astimezone(timezone.utc).replace(tzinfo=None) if d else None
    except (OverflowError, ValueError):
        return None


def claude_extras(poll):
    """What a stored poll says beyond the limits' percents, or None: shares, how much of the weekly allowance each scoped
    limit may use and has used (keyed like the limit's snapshots: kind and scope, with the limit's reset), and surfaces, the
    week's use so far by surface (Claude Code, chat, cowork) with the reset of the unscoped weekly limit it describes.
    The endpoint is undocumented: every key may be missing or hold anything, and what does not read is left out."""
    body = poll.get("response") if isinstance(poll, dict) else None
    if not isinstance(body, dict):
        return None
    items = body.get("limits")
    # By index: shares name a limit by its place. A limit the extras can match to a window has a text kind and scope.
    listed = [lim if lim and isinstance(lim[0], str) and isinstance(lim[1], str) else None
              for lim in map(claude_limit, items)] if isinstance(items, list) else []
    shares = []
    for sh in as_list(body.get("weekly_scoped_shares")):
        i = sh.get("limit_index") if isinstance(sh, dict) else None
        lim = listed[i] if isinstance(i, int) and not isinstance(i, bool) and 0 <= i < len(listed) else None
        if not lim:
            continue
        used, allowance, reset = percent_of(sh.get("used_percent_of_weekly")), percent_of(sh.get("allowance_percent_of_weekly")), utc_naive(lim[3])
        if used is not None and allowance is not None and reset:
            shares.append(dict(kind=lim[0], scope=lim[1], resets_at=reset, used=used, allowance=allowance))
    br = body.get("seven_day_breakdown")
    br = br if isinstance(br, dict) else {}
    rows = [dict(key=r["key"], label=r["display_name"] if isinstance(r.get("display_name"), str) and r["display_name"] else r["key"], percent=r["percent"])
            for r in as_list(br.get("rows")) if isinstance(r, dict) and isinstance(r.get("key"), str) and percent_of(r.get("percent")) is not None]
    weekly = next((utc_naive(lim[3]) for lim in listed if lim and not lim[1] and lim[2] == 10080 and utc_naive(lim[3])), None)
    surfaces = dict(as_of=utc_naive(br.get("as_of")), window_started_at=utc_naive(br.get("window_started_at")), reset=weekly, rows=rows) \
        if rows and weekly else None
    return dict(shares=shares, surfaces=surfaces) if shares or surfaces else None


POLL_EXTRAS = {"claude": claude_extras}  # provider -> (stored poll) -> its extras; a provider without one has none


def store_poll(cur, provider, polled_at, poll):
    """Keep one successful poll and its snapshots. Returns the number of snapshots; a poll with none is not kept."""
    rows = POLL_PARSERS[provider](poll, polled_at)
    if rows:
        cur.execute("BEGIN")
        try:
            store.insert(cur, "limit_polls", ["provider", "polled_at", "json"], [(provider, polled_at, json.dumps(poll))])
            store.write_snapshots(cur, rows)
            cur.execute("COMMIT")
        except BaseException:
            cur.execute("ROLLBACK")
            raise
    return len(rows)


def rederive_polls(cur):
    """Snapshots of every stored poll, written again after a rebuild dropped them."""
    for provider, polled_at, text in cur.execute("SELECT provider, polled_at, json FROM limit_polls ORDER BY 1, 2").fetchall():
        if provider in POLL_PARSERS:
            store.write_snapshots(cur, POLL_PARSERS[provider](json.loads(text), polled_at))


class Poller:
    """Polls one provider from the ingest loop: every interval, doubling the wait after each failure up to MAX_BACKOFF.
    The HTTP call runs outside the store lock; only storing the result takes it."""

    def __init__(self, name, provider, clock=time.time):
        self.name, self.provider, self.clock = name, provider, clock
        self.next_at = 0.0
        self.state = dict(last_ok=None, last_attempt=None, failures=0, error=None, stale=False)

    def due(self):
        return self.clock() >= self.next_at

    def run(self, con, lock):
        now = self.clock()
        self.state["last_attempt"] = iso_utc(now)
        wait = self.provider.interval
        try:
            plan, body = self.provider.poll()
            polled_at = datetime.fromtimestamp(now, timezone.utc).replace(tzinfo=None)
            with lock:
                n = store_poll(con.cursor(), self.name, polled_at, dict(plan=plan, response=body))
            if not n:
                raise PollFailed("usage endpoint returned no recognizable limit")
            self.state.update(last_ok=iso_utc(now), failures=0, error=None, stale=False)
        except PollSkipped as e:
            self.state.update(error=str(e), stale=True)
        except PollFailed as e:
            self.state.update(failures=self.state["failures"] + 1, error=str(e))
            wait = min(MAX_BACKOFF, self.provider.interval * 2 ** self.state["failures"])
        except Exception as e:  # never the message: an unexpected error could carry anything
            self.state.update(failures=self.state["failures"] + 1, error=f"poll failed ({type(e).__name__})")
            wait = min(MAX_BACKOFF, self.provider.interval * 2 ** self.state["failures"])
        self.next_at = now + wait


def pollers(clock=time.time):
    return [Poller(name, p, clock) for name, p in PROVIDERS.items() if p.poll]


def iso_utc(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="seconds")


# ---------- windows, events and calibration ----------

SAME_RESET = timedelta(minutes=2)  # reset times this close are one window: providers drift by a few seconds
MIN_POINTS = 5  # a window calibrates only after moving this many points: percents are whole numbers
CAL_WINDOWS = 4
PROFILE_DAYS, HALF_LIFE, BAND_DAYS, SHAPED_DAYS = 56, 14, 28, 14
RECENT = timedelta(hours=24)  # a window's own pace: its last seventh, a day at most (a weekly window's last day)


class Usage:
    """Counted usage per minute, per provider source and model: estimated cost and tokens. cost() sums it between
    two times for the models a limit's scope covers ('' is every model)."""

    def __init__(self, rows):
        self.rows = sorted(rows, key=lambda r: r[2])  # (source, model, minute, cost, tokens)
        self.cache = {}

    def series(self, source, scope=""):
        key = (source, scope.lower())
        if key not in self.cache:
            ts, cum, total = [], [0.0], 0.0
            for src, model, t, cost, _ in self.rows:
                if src == source and (not key[1] or key[1] in (model or "").lower()):
                    total += cost
                    ts.append(t)
                    cum.append(total)
            self.cache[key] = (ts, cum)
        return self.cache[key]

    def cost(self, source, scope, t0, t1):
        ts, cum = self.series(source, scope)
        return cum[bisect_left(ts, t1)] - cum[bisect_left(ts, t0)] if t1 > t0 else 0.0


def load_usage(cur, prices=None):
    pcte, pparams = metrics.price_cte(metrics.load_prices() if prices is None else prices)
    rq = metrics.requests_cte(pcte, "TRUE")
    return Usage(cur.execute(f"""{rq} SELECT s.source, rq.model, date_trunc('minute', rq.ts), sum(coalesce(rq.cost, 0)), sum(rq.tokens)
        FROM rq JOIN sessions s USING (session_id) WHERE rq.ts IS NOT NULL GROUP BY ALL""", pparams).fetchall())


class Window:
    def __init__(self, key, minutes, resets_at, estimated=False):
        self.provider, self.limit_id, self.scope = key
        self.minutes, self.resets_at, self.estimated = minutes, resets_at, estimated
        self.points = []  # (observed_at, percent, plan, reached), oldest first
        self.closed_at = self.final = self.reason = self.hit_start = None
        self.early = False

    @property
    def key(self):
        return self.provider, self.limit_id, self.scope

    @property
    def start(self):
        return self.resets_at - timedelta(minutes=self.minutes) if self.minutes else self.points[0][0]

    @property
    def plan(self):
        return next((p[2] for p in reversed(self.points) if p[2]), None)


def group_windows(snaps):
    """Windows per limit from snapshots (provider, limit_id, scope, minutes, resets_at, observed_at, percent, plan, reached),
    each limit's windows ordered by their first snapshot."""
    by_limit = {}
    for s in sorted(snaps, key=lambda s: s[5]):
        ws = by_limit.setdefault(s[:3], [])
        w = next((w for w in ws if abs(w.resets_at - s[4]) <= SAME_RESET), None)
        if w is None:
            w = Window(s[:3], s[3], s[4])
            ws.append(w)
        w.points.append((s[5], s[6], s[7], s[8]))
    return by_limit


def close_windows(ws, now):
    """Mark which of one limit's windows have closed, how full they were, and whether they hit 100% or ended early.
    A window ends at its reset, or earlier when a newer window starts first (a plan change resets the limit)."""
    for i, w in enumerate(ws):
        nxt = ws[i + 1] if i + 1 < len(ws) else None
        if nxt and nxt.points[0][0] < w.resets_at - SAME_RESET:
            w.closed_at, w.early = nxt.points[0][0], True
            changed = w.plan and nxt.plan and nxt.plan != w.plan
            w.reason = f"plan change from {w.plan} to {nxt.plan}" if changed else "early reset"
        elif nxt or now >= w.resets_at:
            w.closed_at = w.resets_at
        if w.closed_at:
            w.final = w.points[-1][1]
        w.hit_start = next((p[0] for p in w.points if p[1] >= 100 or p[3]), None)


def plan_changes(snaps):
    """When each provider's reported plan changed, ignoring snapshots that report no plan."""
    out, last = [], {}
    for s in sorted(snaps, key=lambda s: s[5]):
        if s[7] and last.get(s[0], s[7]) != s[7]:
            out.append(dict(kind="plan_change", provider=s[0], at=metrics.iso(s[5]), plan_from=last[s[0]], plan_to=s[7]))
        if s[7]:
            last[s[0]] = s[7]
    return out


def calibrate(ws, usage):
    """Estimated dollars per 1% of one limit: the counted cost while each window moved, over the points it moved, from
    the last CAL_WINDOWS windows that moved MIN_POINTS or more on the limit's current plan. None when there are none.
    A window of known length starts at 0%, so its start counts as a first snapshot: one poll can calibrate."""
    source = PROVIDERS[ws[0].provider].source if ws[0].provider in PROVIDERS else ws[0].provider
    plan = next((w.plan for w in reversed(ws) if w.plan), None)
    used = []
    for w in reversed(ws):
        if plan and w.plan and w.plan != plan:
            break  # a plan change restarts calibration: the cap changed
        (t0, p0, *_), (t1, p1, *_) = (w.start, 0.0) if w.minutes else w.points[0], w.points[-1]
        cost = usage.cost(source, w.scope, t0, t1)
        if p1 - p0 >= MIN_POINTS and cost > 0:
            used.append((cost, p1 - p0))
        if len(used) == CAL_WINDOWS:
            break
    if not used:
        return None
    points = sum(p for _, p in used)
    return dict(per_pct=sum(c for c, _ in used) / points, points=points, windows=len(used), plan=plan)


def estimate(w, t, usage, cal):
    """The percent used at t: the last snapshot at or before t (or 0% at the window's start) plus the usage counted
    since, at cal dollars per 1%. Returns (percent, measured)."""
    base = next((p for p in reversed(w.points) if p[0] <= t), None)
    if base and base[0] == t:
        return base[1], True
    if cal is None:
        return (base[1], True) if base else (None, False)
    t0, p0 = (base[0], base[1]) if base else (w.start, 0.0)
    source = PROVIDERS[w.provider].source if w.provider in PROVIDERS else w.provider
    return min(100.0, p0 + usage.cost(source, w.scope, t0, t) / cal["per_pct"]), False


def step_of(w):
    return max(timedelta(minutes=5), timedelta(minutes=(w.minutes or 10080) / 168))


def series(w, usage, cal, end):
    """Chart points from the window's start to end: a measured point where a snapshot falls in the step, else an estimate."""
    step, out = step_of(w), []
    t = w.start
    while t <= end:
        near = [p for p in w.points if t - step < p[0] <= t]
        if near:
            out.append(dict(t=metrics.iso(t), pct=near[-1][1], measured=True))
        else:
            pct, _ = estimate(w, t, usage, cal)
            if pct is not None:
                out.append(dict(t=metrics.iso(t), pct=round(pct, 2), measured=False))
        t += step
    if end > t - step and (not out or out[-1]["t"] != metrics.iso(end)):  # the figure at end itself, not only the last step
        pct, _ = estimate(w, end, usage, cal)
        last = w.points[-1] if w.points else None
        if pct is not None:
            out.append(dict(t=metrics.iso(end), pct=round(pct, 2), measured=bool(last) and end - last[0] < step and abs(pct - last[1]) < 0.5))
    return out


def earlier_windows(ws, usage, cal, horizon):
    """Estimated windows before a limit's first snapshot, stepped back by its window length to horizon: the history of
    a limit from before the app saw it (Claude Code before polling started). Windows with no counted usage are left out."""
    first = ws[0]
    if not first.minutes or cal is None or not fixed(first.provider, first.minutes):
        return []
    out, end = [], first.start
    source = PROVIDERS[first.provider].source if first.provider in PROVIDERS else first.provider
    while end > horizon:
        w = Window(first.key, first.minutes, end, estimated=True)
        cost = usage.cost(source, w.scope, w.start, end)
        if cost > 0:
            w.closed_at, w.final = end, min(100.0, cost / cal["per_pct"])
            if w.final >= 100:  # when the estimate first reached the cap, to the step
                t, step = w.start, step_of(w)
                while t < end and usage.cost(source, w.scope, w.start, t) < 100 * cal["per_pct"]:
                    t += step
                w.hit_start = min(t, end)
            out.append(w)
        end = w.start
    return out[::-1]


# ---------- forecast ----------

class Profile:
    """The user's rhythm and pace: the share of a day's usage that falls in each local hour, pooled across providers,
    and each provider's recent daily usage. Days weigh less with age (HALF_LIFE days)."""

    def __init__(self, usage, now, tz=None):
        self.usage, self.now, self.tz = usage, now, tz
        since = now - timedelta(days=PROFILE_DAYS)
        hours = [0.0] * 24
        for _, _, t, cost, _ in usage.rows:
            if since <= t < now:
                hours[self.hour(t)] += cost * 0.5 ** ((now - t).total_seconds() / 86400 / HALF_LIFE)
        total = sum(hours)
        self.shape = [h / total for h in hours] if total else [1 / 24] * 24

    def hour(self, t):
        return t.replace(tzinfo=timezone.utc).astimezone(self.tz).hour

    def hour_end(self, t):
        """The first local hour boundary after t."""
        local = t.replace(tzinfo=timezone.utc).astimezone(self.tz)
        return t + timedelta(hours=1) - timedelta(minutes=local.minute, seconds=local.second, microseconds=local.microsecond)

    def days(self, source, scope, n):
        """(cost, share) per day for the last n days (newest first), from the provider's first counted use on. share is
        the part of the day after that first use: the oldest day can be partial, and counts for that much."""
        ts, _ = self.usage.series(source, scope)
        first = ts[0] if ts else self.now
        out = []
        for d in range(n):
            t1 = self.now - timedelta(days=d)
            if t1 <= first:
                break
            t0 = max(first, t1 - timedelta(days=1))
            out.append((self.usage.cost(source, scope, t0, t1), max(1 / 24, (t1 - t0) / timedelta(days=1))))
        return out

    def level(self, source, scope):
        """(mid, low, high) dollars per day and whether the hour shape applies: low and high are the 20th and 80th
        percentile days of the last BAND_DAYS. Fewer than SHAPED_DAYS active days in PROFILE_DAYS gives a flat rate."""
        days = self.days(source, scope, PROFILE_DAYS)
        if not days:
            return None
        weights = [0.5 ** (d / HALF_LIFE) for d in range(len(days))]
        mid = sum(c * w for (c, _), w in zip(days, weights)) / sum(share * w for (_, share), w in zip(days, weights))
        band = sorted(c / share for c, share in days[:BAND_DAYS])
        pick = lambda q: band[min(len(band) - 1, int(q * len(band)))]
        return mid, min(mid, pick(0.2)), max(mid, pick(0.8)), sum(1 for c, _ in days if c > 0) >= SHAPED_DAYS


def window_pace(w, now, usage, cal, current):
    """The window's own pace, (points a day, hours it covers): its use over its last seventh, RECENT at most (a 5-hour
    window's last 43 minutes, a weekly window's last day). None until the window has been open that long."""
    span = min(RECENT, timedelta(minutes=w.minutes) / 7) if w.minutes else RECENT
    if now - span < w.start:
        return None
    before, _ = estimate(w, now - span, usage, cal)
    if before is None:
        return None
    return max(0.0, current - before) / (span / timedelta(days=1)), span / timedelta(hours=1)


def day_share(profile, shape, t, dt):
    """The part of a day's use that falls in the span from t for dt: the hour shape, hour by hour across every local hour
    the span crosses. A flat shape gives dt as a part of a day."""
    end, share = t + dt, 0.0
    while t < end:
        nxt = min(end, profile.hour_end(t))
        share += shape[profile.hour(t)] * (nxt - t).total_seconds() / 3600
        t = nxt
    return share


def forecast(w, current, cal, profile, recent=None):
    """Percent used from now to the window's reset, following the hour shape. The pace is halfway between the
    provider's usual pace and the window's own recent one (window_pace), and the range covers both. Returns the curve
    with low and high bounds, when it reaches 100% (if before the reset), the percent at reset, and the paces."""
    source = PROVIDERS[w.provider].source if w.provider in PROVIDERS else w.provider
    lv = profile.level(source, w.scope)
    if lv is None:
        return None
    mid, lo, hi, shaped = lv
    usual = mid / cal["per_pct"]
    if recent:
        r = recent[0] * cal["per_pct"]
        mid, lo, hi = (mid + r) / 2, min(lo, r), max(hi, r)
    shape = profile.shape if shaped else [1 / 24] * 24
    step = step_of(w)
    last_day = profile.days(source, w.scope, 1)  # the second line: the last 24 hours go on, spread by the same shape
    paces = dict(mid=mid, lo=lo, hi=hi)
    if last_day:
        paces["recent"] = last_day[0][0] / last_day[0][1]
    point = lambda t: {"t": metrics.iso(t), "recent": None, **{k: round(v, 2) for k, v in vals.items()}}
    t, vals, curve = profile.now, dict.fromkeys(paces, current), []
    hits = dict.fromkeys(paces)
    curve.append(point(t))
    while t < w.resets_at:
        dt = min(step, w.resets_at - t)
        share = day_share(profile, shape, t, dt)
        for k, per_day in paces.items():
            before, raw = vals[k], vals[k] + per_day * share / cal["per_pct"]
            vals[k] = min(100.0, raw)
            # A hit is strictly before the reset, found inside the step by the uncapped rise.
            if hits[k] is None and raw >= 100 > before:
                hit = t + dt * ((100 - before) / (raw - before))
                if hit < w.resets_at:
                    hits[k] = hit
        t += dt
        curve.append(point(t))
    # A line shows 100 at the reset only when it reaches it: a rounded 99.96 reads 99.9, not a run-out.
    at_reset = lambda k: 100.0 if vals[k] >= 100 else min(99.9, round(vals[k], 1))
    left = (w.resets_at - profile.now).total_seconds() / 86400
    target = (100 - current) / left if left > 0 else None
    now_pace = mid / cal["per_pct"]
    return dict(kind="shaped" if shaped else "flat", curve=curve, pace_usual=round(usual, 2),
                pace_window=round(recent[0], 2) if recent else None, pace_window_hours=round(recent[1], 1) if recent else None,
                hits_at=metrics.iso(hits["mid"]), hits_at_early=metrics.iso(hits["hi"]), hits_at_late=metrics.iso(hits["lo"]),
                at_reset=None if hits["mid"] else at_reset("mid"), at_reset_low=at_reset("lo"),
                at_reset_high=at_reset("hi"), pace_target=None if target is None else round(target, 2),
                pace_now=round(now_pace, 2), pace=None if target is None else ("ahead" if now_pace > target else "behind"),
                recent_pace=round(paces["recent"] / cal["per_pct"], 2) if "recent" in paces else None,
                recent_hits_at=metrics.iso(hits.get("recent")),
                recent_at_reset=None if "recent" not in paces or hits["recent"] else at_reset("recent"))


# ---------- the Limits page payload ----------

def fixed(provider, minutes):
    return provider in PROVIDERS and PROVIDERS[provider].fixed(minutes)


def source_of(provider):
    return PROVIDERS[provider].source if provider in PROVIDERS else provider


def provider_label(provider):
    return PROVIDERS[provider].label if provider in PROVIDERS else provider


def open_window(ws, now, latest_plan):
    """The limit's window open at now. After a reset with no newer snapshot, the next window is assumed to be at 0%
    (a provider that reports only with use says nothing while idle): on schedule for a fixed window, else starting
    now, as if used now. None when the limit belongs to an earlier plan or has been silent for PROFILE_DAYS."""
    last = ws[-1]
    if (latest_plan and last.plan and last.plan != latest_plan) or now - last.points[-1][0] > timedelta(days=PROFILE_DAYS):
        return None
    if not last.closed_at:
        return last
    if last.early or not last.minutes:
        return None
    step = timedelta(minutes=last.minutes)
    if fixed(last.provider, last.minutes):
        reset = last.resets_at
        while reset <= now:
            reset += step
    else:
        reset = now + step
    return Window(last.key, last.minutes, reset, estimated=True)


USED_TOP = 3  # projects and models listed per window


def window_used(cur, prices, source, scope, t0, t1, per_pct):
    """What the counted, priced use from t0 to t1 was spent on, for the provider's source and the models the scope covers
    ('' is every model): its total dollars and the USED_TOP projects and models with the most cost, each with its share of
    the total (a listed row has cost, so its share is never 0: at least 0.0001) and its points (None when per_pct, the dollars a point costs, is not known). A request with no project counts
    in the total and the models, and is no project row. Minutes are counted as Usage counts them. Names and sums only.
    None when nothing was counted."""
    if t1 <= t0:
        return None
    pcte, pparams = metrics.price_cte(prices)
    rq = metrics.requests_cte(pcte, "date_trunc('minute', r.ts) >= ? AND date_trunc('minute', r.ts) < ?")
    rows = cur.execute(f"""{rq} SELECT rq.project, rq.model, sum(coalesce(rq.cost, 0)) FROM rq JOIN sessions s USING (session_id)
        WHERE s.source = ? AND (? = '' OR contains(lower(coalesce(rq.model, '')), ?)) GROUP BY ALL""",
                       pparams + [t0, t1, source, scope, scope.lower()]).fetchall()
    total = sum(c for _, _, c in rows)
    if total <= 0:
        return None
    top = {}
    for i, name in ((0, "project"), (1, "model")):
        costs = {}
        for row in rows:
            if row[i] and row[2] > 0:
                costs[row[i]] = costs.get(row[i], 0.0) + row[2]
        top[name] = [dict({name: k}, cost=round(c, 2), share=max(0.0001, round(c / total, 4)), points=round(c / per_pct, 1) if per_pct else None)
                     for k, c in sorted(costs.items(), key=lambda kv: (-kv[1], kv[0]))[:USED_TOP]]
    return dict(total=round(total, 2), projects=top["project"], models=top["model"])


def newest_extras(cur, provider):
    """The extras of the provider's newest stored poll, or None: no parser, no poll, or nothing in it. Older polls are not read."""
    if provider not in POLL_EXTRAS:
        return None
    row = cur.execute("SELECT json FROM limit_polls WHERE provider = ? ORDER BY polled_at DESC LIMIT 1", [provider]).fetchone()
    try:
        return POLL_EXTRAS[provider](json.loads(row[0])) if row else None
    except Exception:  # optional data: whatever a provider's reader fails on, the page still loads
        return None


def poll_extras(w, extras):
    """(weekly_share, surfaces) of an open window from its provider's newest poll, each None unless that poll describes this
    window: the same limit, its reset within SAME_RESET of the window's. An estimated window has no poll of its own."""
    if not extras or w.estimated:
        return None, None
    same = lambda reset: reset is not None and abs(reset - w.resets_at) <= SAME_RESET
    share = next((dict(used=x["used"], allowance=x["allowance"]) for x in extras["shares"]
                  if (x["kind"], x["scope"]) == (w.limit_id, w.scope) and same(x["resets_at"])), None)
    sf = extras["surfaces"]
    surfaces = dict(as_of=metrics.iso(sf["as_of"]), rows=sf["rows"]) if sf and not w.scope and w.minutes == 10080 and same(sf["reset"]) else None
    return share, surfaces


def window_row(w, now, usage, cal, profile):
    pts = w.points
    current, _ = estimate(w, now, usage, cal) if (pts or cal) else (None, False)
    current = 0.0 if current is None and w.estimated else current
    measured = bool(pts) and current is not None and abs(current - pts[-1][1]) < 0.5
    row = dict(provider=w.provider, provider_label=provider_label(w.provider), limit_id=w.limit_id, scope=w.scope,
               label=label(w.provider, w.limit_id, w.scope, w.minutes), window_minutes=w.minutes, plan=w.plan,
               start=metrics.iso(w.start), resets_at=metrics.iso(w.resets_at), current=None if current is None else round(current, 1),
               measured=measured, last_snapshot=metrics.iso(pts[-1][0]) if pts else None, series=series(w, usage, cal, now),
               calibration=cal and dict(per_pct=round(cal["per_pct"], 4), points=cal["points"], windows=cal["windows"]),
               forecast=None, no_forecast=None, hit_start=metrics.iso(w.hit_start),
               at_limit=w.hit_start is not None or (current is not None and current >= 100))
    if current is None or cal is None:
        row["no_forecast"] = "Not calibrated yet: a window has to reach 5% while its usage is counted"
    else:
        row["forecast"] = forecast(w, current, cal, profile, window_pace(w, now, usage, cal, current))
        if row["forecast"] is None:
            row["no_forecast"] = "No counted usage for this provider"
    return row


def history_row(w):
    """A closed window as the history lists it. Its identity (limit_id, scope, window_minutes, resets_at) and start let
    window_curve find it again; the row carries no curve, which the page asks for when a window is picked."""
    hit = w.hit_start is not None
    return dict(provider=w.provider, provider_label=provider_label(w.provider), limit_id=w.limit_id, scope=w.scope,
                label=label(w.provider, w.limit_id, w.scope, w.minutes), window_minutes=w.minutes, resets_at=metrics.iso(w.resets_at),
                plan=w.plan, start=metrics.iso(w.start), closed_at=metrics.iso(w.closed_at), final=round(w.final, 1),
                hit=hit, hit_minutes=round((w.closed_at - w.hit_start).total_seconds() / 60) if hit else None,
                early=w.early, reason=w.reason, estimated=w.estimated)


def last_to_reset(windows):
    """Of the windows already at their limit, the one that resets last; None when none is."""
    out = [w for w in windows if w["at_limit"]]
    return max(out, key=lambda w: w["resets_at"]) if out else None


def soonest_run_out(windows):
    """Of the windows forecast to reach 100% before they reset, the one that does so first; None when none is."""
    out = [w for w in windows if w["forecast"] and w["forecast"]["hits_at"]]
    return min(out, key=lambda w: w["forecast"]["hits_at"]) if out else None


def binding_of(windows):
    """The window that stops the user first: one already at its limit (the last to reset), else the soonest forecast to
    reach 100%, else the fullest (forecast at reset)."""
    w = last_to_reset(windows) or soonest_run_out(windows)
    if w:
        return dict(provider=w["provider"], limit_id=w["limit_id"], scope=w["scope"], runs_out=True)
    level = lambda w: (w["forecast"] or {}).get("at_reset") or w["current"] or 0
    if not windows:
        return None
    w = max(windows, key=level)
    return dict(provider=w["provider"], limit_id=w["limit_id"], scope=w["scope"], runs_out=False)


ALERT_PERCENT = 90  # a window at or above this many percent used is in alert, though no forecast says it runs out


def alert_of(windows):
    """The one alert the nav shows, from the open windows' rows, or None when no window is in alert. A window is in alert
    when it is at its limit, is forecast to reach 100% before it resets, or is at ALERT_PERCENT or more used. The alert is
    the worst state any window is in: at_limit (the window that resets last, as binding_of picks it), else runs_out (the
    soonest), else high (the fullest). count is every open window in any of the three states."""
    count = sum(1 for w in windows if w["at_limit"] or (w["forecast"] and w["forecast"]["hits_at"])
                or (w["current"] is not None and w["current"] >= ALERT_PERCENT))
    if (w := last_to_reset(windows)):
        kind, at = "at_limit", w["resets_at"]
    elif (w := soonest_run_out(windows)):
        kind, at = "runs_out", w["forecast"]["hits_at"]
    elif (high := [w for w in windows if w["current"] is not None and w["current"] >= ALERT_PERCENT]):
        w = max(high, key=lambda w: w["current"])
        kind, at = "high", w["resets_at"]
    else:
        return None
    return dict(kind=kind, provider=w["provider"], provider_label=w["provider_label"], label=w["label"], current=w["current"],
                at=at, resets_at=w["resets_at"], count=count)


def suggestion_of(windows):
    """The provider with the most room left at reset at the current pace. A provider with any window at its limit, or
    forecast to reach 100% before it resets, is never suggested; its room is that of its fullest window. None unless two
    providers have forecasts: a suggestion compares providers."""
    if len({w["provider"] for w in windows if w["forecast"]}) < 2:
        return None
    best = None
    for p in dict.fromkeys(w["provider"] for w in windows):
        fc = [w for w in windows if w["provider"] == p and w["forecast"]]
        if not fc or any(w["forecast"]["hits_at"] for w in fc) or any(w["at_limit"] for w in windows if w["provider"] == p):
            continue
        tightest = max(fc, key=lambda w: w["forecast"]["at_reset"])
        room = round(100 - tightest["forecast"]["at_reset"], 1)
        if best is None or room > best["unused_at_reset"]:
            best = dict(provider=p, provider_label=provider_label(p), label=tightest["label"], unused_at_reset=room,
                        resets_at=tightest["resets_at"])
    return best


def limit_windows(ws, usage, now, start=None):
    """(calibration, windows) of one limit from its measured windows ws (as group_windows returns them): ws closed as of
    now, and the estimated windows before the first snapshot back to start, or to the provider's first counted use when
    start is None. The Limits payload and window_curve both list a limit's windows through this, so they cannot disagree."""
    close_windows(ws, now)
    cal = calibrate(ws, usage)
    ts, _ = usage.series(source_of(ws[0].provider), ws[0].scope)
    horizon = max(start or datetime.min, ts[0] if ts else now)
    return cal, earlier_windows(ws, usage, cal, horizon) + ws


def closed_series(w, usage, cal):
    """The series of a closed window from its start to its close. Its final percent is its last reading, so after that reading
    the curve is flat at the final percent, not an estimate from use counted since (a window that stopped getting readings, as
    after a plan change, would otherwise climb past what its heading says). Between readings the estimates stay. An estimated
    window has no readings and no change."""
    out = series(w, usage, cal, w.closed_at)
    if w.points:
        last, final = metrics.iso(w.points[-1][0]), round(w.final, 1)
        out = [dict(p, pct=final) if p["t"] > last else p for p in out]
    return out


def window_curve(cur, provider, limit_id, scope, start, now=None, prices=None):
    """One closed window's curve, for the page to draw when a bar of its history is picked: {window, series, events} with
    the window as history_row gives it, its series from its start to its close (no forecast), and the plan changes of its
    provider inside it. The window is the limit's one nearest to start (an ISO time), when it is closed and its start is within
    SAME_RESET of start; None when it is not, and so always for the open window. A measured window's curve is flat at its final
    percent after its last reading (closed_series). Raises ValueError for an unknown provider or a start that is no time."""
    if provider not in PROVIDERS:
        raise ValueError(f"unknown provider: {provider}")
    at = utc_naive(start)
    if at is None:
        raise ValueError("start must be an ISO time")
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    snaps = cur.execute(f"SELECT {', '.join(store.SNAPSHOT_COLS)} FROM limit_snapshots WHERE provider = ?", [provider]).fetchall()
    ws = group_windows([s for s in snaps if s[1] == limit_id and s[2] == scope]).get((provider, limit_id, scope))
    if not ws:
        return None
    usage = load_usage(cur, metrics.load_prices() if prices is None else prices)
    cal, past = limit_windows(ws, usage, now)
    w = min(past, key=lambda w: abs(w.start - at))  # the nearest of all, so an open window's start is never taken for a closed one's
    if not w.closed_at or abs(w.start - at) > SAME_RESET:
        return None
    return dict(window=history_row(w), series=closed_series(w, usage, cal),
                events=[e for e in plan_changes(snaps) if metrics.iso(w.start) <= e["at"] <= metrics.iso(w.closed_at)])


def payload(cur, range_days=0, source="", project="", now=None, today=None, prices=None, tz=None, polls=None):
    """The JSON the Limits page reads. Open windows ignore range_days; history, unused capacity and value use it.
    project narrows only commits per point: limits are per account. projects lists every project for the picker, whatever
    the filters. polls is each poller's state, by provider."""
    if source and source not in metrics.SOURCES:
        raise ValueError(f"unknown source: {source}")
    if range_days < 0:
        raise ValueError("range must be >= 0")
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    today = today or metrics.local_today(cur)
    start = metrics.start_ts(cur, today - timedelta(days=range_days - 1)) if range_days else None
    names = [n for n, p in PROVIDERS.items() if not source or p.source == source]
    snaps = [s for s in cur.execute(f"SELECT {', '.join(store.SNAPSHOT_COLS)} FROM limit_snapshots").fetchall() if s[0] in names]
    prices = metrics.load_prices() if prices is None else prices
    usage = load_usage(cur, prices)
    profile = Profile(usage, now, tz)
    latest_plan = {}
    for s in sorted(snaps, key=lambda s: s[5]):
        if s[7]:
            latest_plan[s[0]] = s[7]
    extras = {n: newest_extras(cur, n) for n in names}
    windows, history, cals, spans, closed = [], [], {}, {}, []
    for key, ws in group_windows(snaps).items():
        cal, past = limit_windows(ws, usage, now, start)
        cals[key] = (ws[-1].minutes, cal)
        for w in past:
            if w.closed_at and (start is None or w.closed_at >= start):
                history.append(history_row(w))
                # A model-scoped window with nothing used, not even counted use of its model, says nothing of capacity.
                if not (w.scope and not w.final and not usage.cost(source_of(w.provider), w.scope, w.start, w.closed_at)):
                    closed.append(history[-1])
        w = open_window(ws, now, latest_plan.get(key[0]))
        if w:
            share, surfaces = poll_extras(w, extras.get(key[0]))
            windows.append(dict(window_row(w, now, usage, cal, profile),
                                used=window_used(cur, prices, source_of(w.provider), w.scope, w.start, now, cal and cal["per_pct"]),
                                weekly_share=share, surfaces=surfaces))
        # Where the limit counted use on its calibration's plan: its windows on that plan (an estimated one has no plan).
        spans[key] = sorted((v.start, v.closed_at or now) for v in past + [w] if v and cal and v.plan in (None, cal["plan"]))
    windows.sort(key=lambda w: (names.index(w["provider"]), -(w["window_minutes"] or 0), w["scope"]))
    history.sort(key=lambda h: h["closed_at"], reverse=True)
    events = [e for e in plan_changes(snaps) if start is None or e["at"] >= metrics.iso(start)]
    return dict(now=metrics.iso(now), projects=metrics.project_list(cur), windows=windows, binding=binding_of(windows), suggestion=suggestion_of(windows),
                history=history, events=events, unused=unused_of(closed), value=value(cur, usage, cals, spans, latest_plan, start, now, project, prices),
                freshness=freshness(names, snaps, windows, polls or {}, now))


def unused_of(history):
    """Per limit, the average percent left at reset over its windows that ran their full length. A window cut short by
    an early reset or a plan change never had its full capacity, so it is only counted (early); a limit with no full
    window has no average."""
    out = {}
    for h in history:
        u = out.setdefault((h["provider"], h["label"]), dict(provider=h["provider"], provider_label=h["provider_label"], label=h["label"],
                                                             windows=0, estimated=0, early=0, total=0.0))
        if h["early"]:
            u["early"] += 1
            continue
        u["windows"] += 1
        u["estimated"] += h["estimated"]
        u["total"] += 100 - h["final"]
    return [dict({k: v for k, v in u.items() if k != "total"}, avg_unused=round(u["total"] / u["windows"], 1) if u["windows"] else None)
            for u in out.values()]


def value(cur, usage, cals, spans, latest_plan, start, now, project, prices):
    """What a point of each calibrated limit buys over the range: tokens per point by model, and the points each model
    used inside the limit's windows on its calibration's plan (spans); a model without a price has neither. Per project,
    the commits per point of the provider's longest unscoped limit."""
    t0 = start or datetime.min
    limits_out, main = [], {}
    for key, (minutes, cal) in cals.items():
        provider, limit_id, scope = key
        if cal is None:
            continue
        starts, per_model = [s for s, _ in spans[key]], {}
        for src, model, t, cost, tokens in usage.rows:
            i = bisect_right(starts, t) - 1
            if src == source_of(provider) and t0 <= t < now and i >= 0 and t < spans[key][i][1] \
                    and (not scope or scope.lower() in (model or "").lower()):
                m = per_model.setdefault(model, [0.0, 0])
                m[0] += cost
                m[1] += tokens
        models = [dict(model=m, priced=c > 0, points=round(c / cal["per_pct"], 1) if c else None,
                       tokens_per_point=round(tk * cal["per_pct"] / c) if c else None)
                  for m, (c, tk) in sorted(per_model.items(), key=lambda kv: -kv[1][0]) if c or tk]
        limits_out.append(dict(provider=provider, provider_label=provider_label(provider), label=label(provider, limit_id, scope, minutes),
                               plan=cal["plan"], past_plan=bool(cal["plan"] and latest_plan.get(provider) not in (None, cal["plan"])),
                               cost_per_point=round(cal["per_pct"], 4), models=models))
        if not scope and (provider not in main or (minutes or 0) > (main[provider][0] or 0)):
            main[provider] = (minutes, cal, label(provider, limit_id, scope, minutes))
    projects = []
    if main:
        pcte, pparams = metrics.price_cte(prices)
        rq = metrics.requests_cte(pcte, "(CAST(? AS TIMESTAMP) IS NULL OR r.ts >= ?) AND (? = '' OR s.project = ?)")
        f = [start, start, project, project]
        cost = {(r[0], r[1]): r[2] for r in cur.execute(
            f"{rq} SELECT s.source, rq.project, sum(coalesce(rq.cost, 0)) FROM rq JOIN sessions s USING (session_id) GROUP BY ALL",
            pparams + f).fetchall()}
        commits = {(r[0], r[1]): r[2] for r in cur.execute(
            """SELECT s.source, s.project, count(*) FILTER (WHERE t.is_commit AND t.test_passed) FROM tool_calls t JOIN sessions s USING (session_id)
               WHERE (CAST(? AS TIMESTAMP) IS NULL OR coalesce(t.start_ts, t.end_ts) >= ?) AND (? = '' OR s.project = ?) GROUP BY ALL""", f).fetchall()}
        for provider, (_, cal, lbl) in main.items():
            for (src, proj), c in cost.items():
                if src != source_of(provider) or not proj or c <= 0:
                    continue
                points, n = c / cal["per_pct"], commits.get((src, proj), 0)
                projects.append(dict(provider=provider, provider_label=provider_label(provider), label=lbl, project=proj,
                                     commits=n, points=round(points, 1), commits_per_point=round(n / points, 2) if n and points >= 1 else None))
        projects.sort(key=lambda p: -p["points"])
    return dict(limits=limits_out, projects=projects)


def freshness(names, snaps, windows, polls, now):
    out = []
    for n in names:
        p = PROVIDERS[n]
        last = max((s[5] for s in snaps if s[0] == n), default=None)
        st = polls.get(n)
        flags = []
        if st and st.get("failures"):
            flags.append("polling failing")
        if st and st.get("stale"):
            flags.append("token expired")
        if p.interval and last and now - last > timedelta(seconds=2 * p.interval):
            flags.append("old")
        if last is None:
            flags.append("no snapshots")
        mine = [w for w in windows if w["provider"] == n]
        # An old poll is no measure of now; nor is an old reading, since use outside this machine never shows in it.
        if "polling failing" in flags or "old" in flags or (not p.interval and last and now - last > READING_AGE):
            for w in mine:
                w["measured"] = False
        out.append(dict(provider=n, provider_label=p.label, last_snapshot=metrics.iso(last), measured=bool(mine) and all(w["measured"] for w in mine),
                        polled=bool(p.poll), last_ok=st.get("last_ok") if st else None, error=st.get("error") if st else None, flags=flags))
    return out
