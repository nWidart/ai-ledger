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


def placement(cur, path, lines):
    """(session of the file's lines, subagent), as store.Source.placement. Subagent placement comes with task 3.3."""
    return ids(path)[0], False


def prompt_text(d, pid):
    """The text of prompt pid if line d holds it. None until Grok prompts are derived."""
    return None


def live_items(d):
    """What the Live page shows of Grok line d. Nothing until Live reads Grok turns."""
    return []


class GrokDeriver(store.Deriver):
    """Turns new Grok lines of one file into derived rows: for now the session row only."""

    def add(self, d):
        sid, cwd = ids(self.path)
        if not self.sub:
            self.session(dict(sessionId=sid, timestamp=iso(meta(d).get("agentTimestampMs")), cwd=cwd))
