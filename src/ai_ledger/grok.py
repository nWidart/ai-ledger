"""Grok CLI session logs (~/.grok): where they are, how their lines are keyed, and the parser that derives them.

Grok writes one folder per session: sessions/<url-encoded cwd>/<session uuid>/, whose updates.jsonl is append-only.
Session ids are UUIDv7, so a subagent's folder sorts after its parent's. Each line is {timestamp, timestamp_us, method,
params: {sessionId, update: {sessionUpdate, ...}, _meta: {eventId "<session>-<n>", agentTimestampMs, ...}}}; no line
has a top-level type. Each run of the CLI counts event ids from 1 again, so a resumed session repeats them, and lines
are not in event-id order. A hook_execution line names its hook in event_name; session_end is written as the CLI exits.
The other files of a session folder are rewritten in place or hold nothing the derived tables need, so only
updates.jsonl is read.
"""
import glob
import os
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import unquote

from . import store

LOG = "updates.jsonl"


def files(root):
    return sorted(glob.glob(os.path.join(root, "sessions", "*", "*", LOG)))


@lru_cache(maxsize=4096)
def ids(path):
    """(session, working folder) named by the path .../sessions/<url-encoded cwd>/<session>/updates.jsonl."""
    folder = os.path.dirname(path)
    return os.path.basename(folder), unquote(os.path.basename(os.path.dirname(folder)))


def params(d):
    p = d.get("params") if isinstance(d, dict) else None
    return p if isinstance(p, dict) else {}


def meta(d):
    m = params(d).get("_meta")
    return m if isinstance(m, dict) else {}


def update(d):
    u = params(d).get("update")
    return u if isinstance(u, dict) else {}


def key(d, path, offset):
    """grok:<eventId>:<agentTimestampMs>: a resumed run repeats event ids, so the time tells its lines apart."""
    m = meta(d)
    if m.get("eventId") and isinstance(m.get("agentTimestampMs"), int):
        return f"grok:{m['eventId']}:{m['agentTimestampMs']}"
    return f"{path}:{offset}"


def iso(ms):
    """Epoch milliseconds as the store's transcript time: UTC ISO with milliseconds and a Z."""
    if not isinstance(ms, int) or isinstance(ms, bool):
        return None
    return datetime.fromtimestamp(ms // 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{ms % 1000:03d}Z"


def fields(d, path):
    m = meta(d)
    return ids(path)[0], m.get("eventId"), iso(m.get("agentTimestampMs"))


def line_type(d):
    """The line's sessionUpdate, or its hook's event_name for a hook_execution line."""
    u = update(d)
    t = u.get("sessionUpdate")
    return u.get("event_name") or t if t == "hook_execution" else t


def parent_of(cur, session):
    """The session that spawned Grok session `session`, or None: the session of the stored subagent_spawned line that names
    it as its child. The child's own folder does not name its parent. Read from raw_lines, so a rebuild finds it too."""
    row = cur.execute("SELECT session_id FROM raw_lines WHERE type = 'subagent_spawned' AND parsed AND starts_with(key, 'grok:') "
                      "AND json_extract_string(json, '$.params.update.child_session_id') = ? LIMIT 1", [session]).fetchone()
    return row[0] if row and row[0] != session else None


def placement(cur, path, lines):
    """(session of the file's lines, subagent), as store.Source.placement: a spawned session's lines belong to its parent's
    session as subagent work. Ingest reads the parent's file first (files sorts, and a child's UUIDv7 follows its parent's)."""
    own = ids(path)[0]
    parent = parent_of(cur, own) if cur is not None else None
    return parent or own, parent is not None


CALL_TYPES = ("agent_thought_chunk", "agent_message_chunk", "tool_call", "tool_call_update")  # lines written during a model call
TOKEN_KINDS = ("input", "output", "thinking", "cache_read", "cache_5m")


def split(total, weights):
    """total (an integer) shared out in proportion to weights, as integers that add up to it exactly (largest remainder,
    the earlier share first on a tie). Equal shares when no weight is positive."""
    if not weights:
        return []
    if sum(weights) <= 0:
        weights = [1] * len(weights)
    whole = sum(weights)
    shares = [total * w // whole for w in weights]
    by_rest = sorted(range(len(weights)), key=lambda i: (-(total * weights[i] % whole), i))
    for i in by_rest[:total - sum(shares)]:
        shares[i] += 1
    return shares


def counts(u):
    """A turn_completed usage (the turn's or one model's) as the shared token columns, in TOKEN_KINDS order. inputTokens
    includes the cached input and the cache writes; outputTokens includes the reasoning."""
    n = lambda k: u.get(k) if isinstance(u.get(k), int) and not isinstance(u.get(k), bool) else 0
    cr, cw = n("cachedReadTokens"), n("cacheCreationTokens")
    return [max(n("inputTokens") - cr - cw, 0), n("outputTokens"), n("reasoningTokens"), cr, cw]


def cost_of(u):
    """The USD a usage reports (costUsdTicks: 1e10 ticks are one dollar), or None when it reports none."""
    ticks = u.get("costUsdTicks")
    return ticks / 1e10 if isinstance(ticks, (int, float)) and not isinstance(ticks, bool) else None


def prompt_text(d, pid):
    """The text of prompt pid if line d holds it. None until Grok prompts are derived."""
    return None


def live_items(d):
    """What the Live page shows of Grok line d. Nothing until Live reads Grok turns."""
    return []


class GrokDeriver(store.Deriver):
    """Turns new Grok lines of one file into derived rows. Deriver.flush writes them.

    Grok writes usage once per turn (turn_completed), and the start and context size of each model call on the lines the
    call wrote. A finished turn becomes one request per model call, the turn's usage split by the calls' context sizes:
    the requests add up to the turn's figures, and the share of each is an estimate. A subagent's file (self.sub) makes
    no request and no session row: its parent's turn already holds its usage."""

    def __init__(self, *args):
        super().__init__(*args)
        own, self.cwd = ids(self.path)
        self.sid = (parent_of(self.cur, own) or own) if self.sub else own

    def add(self, d):
        u, m = update(d), meta(d)
        ts = iso(m.get("agentTimestampMs"))
        if self.sub:
            return
        s = self.session(dict(sessionId=self.sid, timestamp=ts, cwd=self.cwd))
        t = u.get("sessionUpdate")
        if t == "turn_completed" and isinstance(u.get("usage"), dict):
            self.turn(d, u, s, store.ts_of(ts))
        elif t == "auto_compact_started" and isinstance(u.get("context_window"), int):
            s["window"] = u["context_window"]
        elif t == "auto_compact_completed":
            s["compactions"] += 1
            when = store.ts_of(ts)
            if when:
                s["first_compaction"] = min(s["first_compaction"] or when, when)

    def calls(self, d, pid):
        """[(streamStartMs, context size)] of the model calls of turn pid, oldest first: the distinct streamStartMs of the
        turn's stored lines, each with the largest totalTokens its lines state (a call's first value can be stale).
        Only lines between the file's previous turn_completed line and this one (d) count: the result is then the same
        however the file was cut into ingests, and a prompt id used again counts no call twice. raw_lines already holds
        the chunk being derived."""
        (end,) = self.cur.execute("SELECT byte_offset FROM raw_lines WHERE key = ?", [key(d, self.path, 0)]).fetchone() or (None,)
        if end is None:
            return []
        (start,) = self.cur.execute("SELECT coalesce(max(byte_offset), -1) FROM raw_lines WHERE file = ? AND type = 'turn_completed' "
                                    "AND byte_offset < ?", [self.path, end]).fetchone()
        rows = self.cur.execute(
            "SELECT stream, max(total) FROM (SELECT CAST(json_extract(json, '$.params._meta.streamStartMs') AS BIGINT) AS stream, "
            "CAST(json_extract(json, '$.params._meta.totalTokens') AS BIGINT) AS total FROM raw_lines "
            f"WHERE file = ? AND parsed AND type IN ({','.join('?' * len(CALL_TYPES))}) "
            "AND json_extract_string(json, '$.params._meta.promptId') = ? AND byte_offset > ? AND byte_offset < ?) "
            "WHERE stream IS NOT NULL GROUP BY 1 ORDER BY 1",
            [self.path, *CALL_TYPES, pid, start, end]).fetchall()
        return [(stream, total or 0) for stream, total in rows]

    def turn(self, d, u, s, ts):
        """The requests of a finished turn. Its calls cannot be told when no line states one or the turn names several
        models: it is then one request per model at the turn's end."""
        usage, pid = u["usage"], u.get("prompt_id")
        models = {k: v for k, v in (usage.get("modelUsage") or {}).items() if isinstance(v, dict)} or {None: usage}
        calls = self.calls(d, pid) if pid and len(models) == 1 else []
        if not calls:
            for model, mu in models.items():
                mid = f"grok:{self.sid}:{pid}:{model or ''}"
                self.request(mid, ts, model, counts(mu), cost_of(mu), u.get("stop_reason"))
            return
        (model, mu), = models.items()
        weights = [size for _, size in calls]
        if sum(weights) <= 0:  # no line stated a context size: equal shares
            weights = [1] * len(calls)
        shares = list(zip(*(split(n, weights) for n in counts(mu))))  # one tuple of TOKEN_KINDS per call
        cost = cost_of(mu)
        costs = [None] * len(calls) if cost is None else [cost * w / sum(weights) for w in weights[:-1]]
        if cost is not None:
            costs.append(cost - sum(costs))  # the last call takes the rest, so the calls add up to the turn's cost
        for i, (stream, size) in enumerate(calls):
            last = i == len(calls) - 1
            self.request(f"grok:{self.sid}:{pid}:{stream}", store.ts_of(iso(stream)), model, shares[i], costs[i],
                         u.get("stop_reason") if last else None)
            if s and size > s["peak"]:
                s["peak"], s["peak_model"] = size, model

    def request(self, mid, ts, model, kinds, cost, stop):
        if mid in self.requests:
            return
        inp, out, thinking, cr, cw = kinds
        self.requests[mid] = (mid, self.sid, ts, model, None, False, inp, out, thinking, cr, cw, 0, None, stop, None, cost)
