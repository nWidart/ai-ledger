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
from datetime import datetime, timezone
from typing import Callable, NamedTuple

import store

POLL_SECONDS = 5 * 60
MAX_BACKOFF = 60 * 60
WINDOW_NAMES = {300: "5-hour", 1440: "daily", 10080: "weekly"}


# ---------- providers ----------

class Provider(NamedTuple):
    source: str  # sessions.source of the requests that use this provider's limits
    label: str
    poll: Callable | None = None  # () -> (plan, response); None when snapshots come from transcripts
    interval: int | None = None  # seconds between polls
    qualifier: Callable = lambda limit_id: None  # limit_id -> extra words for its label, when the window alone is ambiguous


def claude_poll():
    return fetch_claude(read_claude_credential())


PROVIDERS = {
    "claude": Provider("claude", "Claude Code", claude_poll, POLL_SECONDS),
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


def claude_rows(poll, observed_at):
    """limit_snapshots rows from one stored poll ({plan, response}). Reads the generic limits list; a response without
    one falls back to the older five_hour / seven_day / seven_day_<model> keys."""
    body, plan = poll.get("response"), poll.get("plan")
    if not isinstance(body, dict):
        return []
    found = []
    for it in body.get("limits") or []:
        if not isinstance(it, dict) or not isinstance(it.get("percent"), (int, float)) or not it.get("kind"):
            continue
        model = ((it.get("scope") or {}).get("model") or {}) if isinstance(it.get("scope"), dict) else {}
        minutes = GROUP_MINUTES.get(it.get("group")) or GROUP_MINUTES.get(it["kind"])
        found.append((it["kind"], model.get("display_name") or model.get("id") or "", minutes, it.get("resets_at"), it["percent"]))
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
