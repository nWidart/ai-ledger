"""The Live page's payloads: the active sessions with their state, and one session's events and figures.

Events come from the stored transcript lines through each source's live_items, so a running tool shows before the
derived tool_calls know of it. Totals (cost, requests, tool calls, errors) come from the derived tables, as on the other
pages. Prompt, reply and tool-output text leave this module only when the caller asks for it."""
import json
from datetime import datetime, timedelta, timezone

import limits
import metrics
import store
from categorize import SHELL_TOOLS

ACTIVE = timedelta(minutes=10)  # a session with a line this recent is listed
IDLE = timedelta(minutes=5)  # no line for this long: idle, whatever else the lines say
APPROVAL = timedelta(seconds=30)  # a shell call pending this long is likely waiting for approval
APPROVAL_TOOLS = SHELL_TOOLS | {"exec"}  # Codex's exec runs a script that calls the shell
FIRST_LOAD = 500  # events on a first load
STATE_LINES = 200  # newest lines read per session for the active list
TEXT_CAP = 4096  # characters of one tool result sent with text
ERROR_CAP = 700  # as tool_calls.error
SPARK_STEP = 5  # seconds per point of the tokens chart, over the last minute


def now_utc():
    return datetime.now(timezone.utc)


def parse_ts(s):
    """A transcript timestamp ('...Z') as an aware UTC datetime, or None."""
    if not isinstance(s, str) or not s:
        return None
    try:
        t = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def iso(t):
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z" if t else None


def lane_of(path, source):
    """The id of the subagent whose lines file path holds: Claude Code's agent-<id>.jsonl, a Codex thread."""
    if source == "codex":
        import codex
        return codex.ids(path)[1]
    name = path.rsplit("/", 1)[-1]
    return name[len("agent-"):-len(".jsonl")] if name.startswith("agent-") and name.endswith(".jsonl") else name


def assemble(rows):
    """Events in line order from raw rows (key, file, ts, subagent, source, json). A tool use and its result become one
    tool event; a request split over several lines counts once. Returns (events, results), where results maps a tool id
    to its result item when the use is not among the rows."""
    events, tools, requests, results = [], {}, set(), {}
    for key, path, ts, sub, source, text in rows:
        src = store.SOURCES.get(source or "claude")
        try:
            d = json.loads(text)
        except ValueError:
            continue
        if src is None or not isinstance(d, dict):
            continue
        t = parse_ts(ts)
        lane = lane_of(path, source) if sub else None
        for i, it in enumerate(src.live_items(d)):
            k = it["k"]
            if k == "tool_use":
                ev = dict(key=f"{key}#{i}", k="tool", ts=t, lane=lane, id=it["id"], tool=it["tool"], summary=it["summary"],
                          description=it.get("description"), start=t, end=None, failed=False, error=None, output=None, agent=None)
                if it["id"] in results:
                    finish(ev, results.pop(it["id"]))
                tools[it["id"]] = ev
                events.append(ev)
            elif k == "tool_result":
                r = dict(it, ts=t)
                if it["id"] in tools:
                    finish(tools[it["id"]], r)
                else:
                    results[it["id"]] = r
            elif k == "request":
                if it["id"] not in requests:
                    requests.add(it["id"])
                    events.append(dict(it, key=f"{key}#{i}", ts=t, lane=lane))
            else:
                events.append(dict(it, key=f"{key}#{i}", ts=t, lane=lane))
    return events, results


def finish(ev, r):
    """Give tool event ev its result r. A failure wins over an earlier plain result: Codex marks failures separately."""
    ev["end"] = ev["end"] or r["ts"]
    if r.get("error") is not None:
        ev["failed"], ev["error"] = True, r["error"][:ERROR_CAP]
    if r.get("output"):
        ev["output"] = r["output"]
    ev["agent"] = ev["agent"] or r.get("agent")


def state(events, now, source, last):
    """One session's state from its events (in order), now, its source and its newest line's time.
    kind: idle, wait (likely waiting for approval), tool, thinking or you (your turn)."""
    if last is None or now - last > IDLE:
        return dict(kind="idle", tool=None, since=iso(last), inferred=False)
    pending = [e for e in events if e["k"] == "tool" and e["end"] is None]
    if pending:
        p = max(pending, key=lambda e: e["start"] or now)
        waiting = p["tool"] in APPROVAL_TOOLS and p["start"] is not None and now - p["start"] > APPROVAL
        return dict(kind="wait" if waiting else "tool", tool=p["tool"], since=iso(p["start"]), inferred=waiting)
    if source == "codex":
        turns = [e for e in events if e["k"] in ("turn_start", "turn_end")]
        if turns and turns[-1]["k"] == "turn_start":
            return dict(kind="thinking", tool=None, since=iso(turns[-1]["ts"]), inferred=False)
        return dict(kind="you", tool=None, since=iso(turns[-1]["ts"] if turns else last), inferred=False)
    # Claude Code: whatever happened last among the prompts, replies, interruptions and tool results.
    marks = [(e["ts"], e["k"]) for e in events if e["k"] in ("prompt", "reply", "interrupt") and e["ts"]]
    marks += [(e["end"], "result") for e in events if e["k"] == "tool" and e["end"]]
    if not marks:
        return dict(kind="you", tool=None, since=iso(last), inferred=False)
    t, k = max(marks, key=lambda m: m[0])
    if k in ("prompt", "result"):
        return dict(kind="thinking", tool=None, since=iso(t), inferred=True)
    return dict(kind="you", tool=None, since=iso(t), inferred=False)


def latest_action(events):
    """The newest prompt, tool call or subagent call, for a wall tile."""
    for e in reversed(events):
        if e["k"] == "tool":
            return dict(kind="tool", tool=e["tool"], summary=e["summary"][:200], lane=e["lane"])
        if e["k"] == "prompt":
            return dict(kind="prompt", tool=None, summary=None, lane=None)
    return None


ROW_COLS = "r.key, r.file, r.ts, r.subagent, coalesce(f.source, 'claude'), r.json"
ROW_FROM = "raw_lines r LEFT JOIN files f ON f.path = r.file"


def window_of(model, events, prices):
    """The context window: what Codex states at the turn's start, else prices.json for the model."""
    for e in reversed(events):
        if e["k"] == "turn_start" and e.get("window"):
            return e["window"]
    return (prices.get(model) or {}).get("context")


def figures(cur, sids, prices):
    """Per session: cost, requests, the newest main-thread request (model and context), tool calls and errors."""
    if not sids:
        return {}
    pcte, pparams = metrics.price_cte(prices)
    out = {sid: dict(cost=None, requests=0, model=None, context=None, cache_read=None, tools=0, errors=0) for sid in sids}
    for r in metrics.rows(cur, f"""{metrics.requests_cte(pcte, "list_contains(?, r.session_id)")}
            SELECT session_id, sum(cost) AS cost, count(*) AS requests,
              sum(cache_read) / nullif(sum(input + cache_read + cache_5m + cache_1h), 0) AS cache_read,
              arg_max(model, ts) FILTER (WHERE NOT subagent) AS model,
              arg_max(input + cache_read + cache_5m + cache_1h, ts) FILTER (WHERE NOT subagent) AS context
            FROM rq GROUP BY 1""", pparams + [list(sids)]):
        out[r.pop("session_id")].update(r)
    for sid, n, err in cur.execute("""SELECT session_id, count(*), count(*) FILTER (WHERE is_error) FROM tool_calls
            WHERE list_contains(?, session_id) GROUP BY 1""", [list(sids)]).fetchall():
        out[sid].update(tools=n, errors=err)
    return out


def sessions(cur, project="", source="", automated=False, now=None, prices=None):
    """/api/live: sessions with a line in the last ACTIVE, newest first, each with its state, figures and latest action."""
    now = now or now_utc()
    prices = metrics.load_prices() if prices is None else prices
    where, params = metrics.scope(project, automated, source)
    since = (now - ACTIVE).astimezone(timezone.utc).replace(tzinfo=None)
    info = metrics.rows(cur, f"""SELECT s.session_id, s.project, s.source, s.git_branch, s.last_ts FROM sessions s
        WHERE s.last_ts >= ? AND {where} ORDER BY s.last_ts DESC""", [since] + params)
    sids = [s["session_id"] for s in info]
    lines = recent(cur, sids)
    figs = figures(cur, sids, prices)
    out = []
    for s in info:
        events, _ = assemble(lines.get(s["session_id"], []))
        last = s["last_ts"].replace(tzinfo=timezone.utc) if s["last_ts"] else None
        f = figs[s["session_id"]]
        out.append(dict(session_id=s["session_id"], project=s["project"], source=s["source"], branch=s["git_branch"],
                        last_ts=iso(last), state=state(events, now, s["source"], last), latest=latest_action(events),
                        window=window_of(f["model"], events, prices), **f))
    return dict(now=iso(now), sessions=out, newest=None if out else newest_session(cur, where, params))


def recent(cur, sids):
    """The newest STATE_LINES lines of each session, in line order: enough to tell what it is doing now."""
    lines = {}
    if sids:
        for row in cur.execute(f"""SELECT r.session_id, {ROW_COLS} FROM {ROW_FROM}
                WHERE list_contains(?, r.session_id) AND r.ts IS NOT NULL AND r.parsed
                QUALIFY row_number() OVER (PARTITION BY r.session_id ORDER BY r.ts DESC, r.file, r.line_no DESC) <= {STATE_LINES}
                ORDER BY r.session_id, r.ts, r.file, r.line_no""", [sids]).fetchall():
            lines.setdefault(row[0], []).append(row[1:])
    return lines


def newest_session(cur, where, params):
    """For the empty state: the session in scope that wrote last, or None."""
    r = metrics.rows(cur, f"SELECT s.session_id, s.project, s.last_ts FROM sessions s WHERE {where} AND s.last_ts IS NOT NULL "
                          "ORDER BY s.last_ts DESC LIMIT 1", params)
    return dict(r[0], last_ts=metrics.iso(r[0]["last_ts"])) if r else None


def session(cur, sid, after="", text=False, now=None, prices=None):
    """/api/live/session: one session's events after cursor `after` (a line timestamp; '' for the newest FIRST_LOAD),
    its lanes, state and figures. None for an unknown session. Raises ValueError for a malformed cursor."""
    now = now or now_utc()
    prices = metrics.load_prices() if prices is None else prices
    if after and parse_ts(after) is None:
        raise ValueError(f"bad cursor: {after}")
    info = metrics.rows(cur, "SELECT session_id, project, source, git_branch, last_ts FROM sessions WHERE session_id = ?", [sid])
    if not info:
        return None
    s = info[0]
    if after:
        rows = cur.execute(f"""SELECT {ROW_COLS} FROM {ROW_FROM} WHERE r.session_id = ? AND r.ts >= ? AND r.parsed
            ORDER BY r.ts, r.file, r.line_no""", [sid, after]).fetchall()
        more = False
    else:
        rows = cur.execute(f"""SELECT * FROM (SELECT {ROW_COLS}, r.line_no FROM {ROW_FROM}
            WHERE r.session_id = ? AND r.ts IS NOT NULL AND r.parsed ORDER BY r.ts DESC, r.file, r.line_no DESC LIMIT ?)
            ORDER BY 3, 2, 7""", [sid, FIRST_LOAD * 3 + 1]).fetchall()
        more = len(rows) > FIRST_LOAD * 3
        rows = [r[:6] for r in rows[-FIRST_LOAD * 3:]]
    events, results = assemble(rows)
    if results:  # results whose use came before the rows: send those calls again, finished
        uses, _ = assemble(earlier_uses(cur, sid, rows[0][2] if rows else after, list(results)))
        for ev in uses:
            if ev["k"] == "tool" and ev["id"] in results:
                finish(ev, results[ev["id"]])
                events.append(ev)
        events.sort(key=lambda e: (e["ts"] or now))
    if len(events) > FIRST_LOAD and not after:
        events, more = events[-FIRST_LOAD:], True
    last = s["last_ts"].replace(tzinfo=timezone.utc) if s["last_ts"] else None
    cursor = max((r[2] for r in rows if r[2]), default=after or None)
    f = figures(cur, [sid], prices)[sid]
    return dict(session_id=sid, project=s["project"], source=s["source"], branch=s["git_branch"], last_ts=iso(last),
                now=iso(now), cursor=cursor, truncated=more,
                state=state(assemble(recent(cur, [sid]).get(sid, []))[0], now, s["source"], last),
                events=[public(e, text) for e in events], lanes=lanes(events),
                window=window_of(f["model"], events, prices), compactions=compactions(cur, sid),
                spark=spark(cur, sid, now), limits=plan_limits(cur, s["source"], now), **f)


def earlier_uses(cur, sid, before, ids):
    """The lines before `before` that hold the tool uses ids."""
    return cur.execute(f"""SELECT {ROW_COLS} FROM {ROW_FROM} WHERE r.session_id = ? AND r.ts < ? AND r.parsed
        AND list_bool_or(list_transform(?, x -> contains(r.json, x))) ORDER BY r.ts, r.file, r.line_no""", [sid, before, ids]).fetchall()


def public(e, text):
    """Event e as sent: times as ISO strings, and text only when asked for (counts otherwise)."""
    out = {k: iso(v) if isinstance(v, datetime) else v for k, v in e.items()}
    if e["k"] in ("prompt", "reply"):
        out["words"] = len(e["text"].split())
        if not text:
            del out["text"]
    elif e["k"] == "tool":
        output = e["output"] or ""
        out["chars"] = len(output)
        out["output"] = output[:TEXT_CAP] if text and e["end"] else None
        out["cut"] = bool(text and len(output) > TEXT_CAP)
    return out


def lanes(events):
    """Subagent lanes: each lane's events are those with its lane id. A lane is tied to the main-thread call whose
    result names it (Claude Code's agentId); otherwise it stands on its own at its first event."""
    parents = {e["agent"]: e for e in events if e["k"] == "tool" and e.get("agent") and not e["lane"]}
    out = {}
    for e in events:
        if not e["lane"]:
            continue
        lane = out.setdefault(e["lane"], dict(id=e["lane"], start=e["ts"], end=e["ts"], tools=0, running=False))
        lane["end"] = max(x for x in (lane["end"], e["ts"]) if x) if e["ts"] else lane["end"]
        if e["k"] == "tool":
            lane["tools"] += 1
            lane["running"] = lane["running"] or e["end"] is None
    for lid, lane in out.items():
        p = parents.get(lid)
        lane.update(parent=p["id"] if p else None, name=p["tool"] if p else "Subagent",
                    description=p["description"] if p else None, done=bool(p and p["end"]))
        lane["start"], lane["end"] = iso(lane["start"]), iso(lane["end"]) if lane["done"] else None
    return list(out.values())


def compactions(cur, sid):
    """Every compaction of the session: when, and the context before it when the source says."""
    out = []
    for path, ts, source, text in cur.execute("""SELECT r.file, r.ts, coalesce(f.source, 'claude'), r.json FROM raw_lines r
            LEFT JOIN files f ON f.path = r.file WHERE r.session_id = ? AND r.parsed AND NOT r.subagent
            AND (r.type = 'compacted' OR r.type = 'system' AND contains(r.json, '"compact_boundary"')) ORDER BY r.ts""", [sid]).fetchall():
        for it in store.SOURCES[source].live_items(json.loads(text)):
            if it["k"] == "compaction":
                out.append(dict(ts=iso(parse_ts(ts)), pre=it["pre"]))
    return out


def spark(cur, sid, now):
    """Tokens over the last minute, in SPARK_STEP-second buckets, oldest first, and their sum."""
    n = 60 // SPARK_STEP
    start = (now - timedelta(seconds=60)).astimezone(timezone.utc).replace(tzinfo=None)
    points = [0] * n
    for ts, tokens in cur.execute("""SELECT ts, input + output + cache_read + cache_5m + cache_1h FROM requests
            WHERE session_id = ? AND ts > ?""", [sid, start]).fetchall():
        i = int((ts - start).total_seconds() // SPARK_STEP)
        points[min(max(i, 0), n - 1)] += tokens or 0
    return dict(points=points, per_minute=sum(points), step=SPARK_STEP)


def plan_limits(cur, source, now):
    """The newest use of each open plan limit of the session's source."""
    naive = now.astimezone(timezone.utc).replace(tzinfo=None)
    rows = cur.execute("""SELECT provider, limit_id, scope, window_minutes, arg_max(used_percent, observed_at), max(observed_at),
            arg_max(resets_at, observed_at) FROM limit_snapshots WHERE resets_at > ? GROUP BY 1, 2, 3, 4 ORDER BY 4, 2, 3""",
                       [naive]).fetchall()
    return [dict(label=limits.label(p, lid, sc, m), used_percent=used, observed_at=metrics.iso(seen), resets_at=metrics.iso(reset))
            for p, lid, sc, m, used, seen, reset in rows if limits.source_of(p) == source]
