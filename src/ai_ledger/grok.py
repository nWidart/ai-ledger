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
import json
import os
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import unquote

from . import store
from .categorize import GIT_COMMIT, SHELL_TOOLS, runs_tests, summarize_input

LOG = "updates.jsonl"


def files(root):
    """The session logs under root, by session id and then path: ids are UUIDv7, so a parent comes before the subagents
    it spawned, whatever their working folders. A child read first would be a session of its own until its parent's
    subagent_spawned line is stored (GrokDeriver.adopt then moves it)."""
    return sorted(glob.glob(os.path.join(root, "sessions", "*", "*", LOG)), key=lambda p: (ids(p)[0], p))


@lru_cache(maxsize=4096)
def ids(path):
    """(session, working folder) named by the path .../sessions/<url-encoded cwd>/<session>/updates.jsonl."""
    folder = os.path.dirname(path)
    return os.path.basename(folder), unquote(os.path.basename(os.path.dirname(folder)))


def grok_home(path):
    """The Grok home of session log path: the folder that holds sessions/."""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(path))))


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
    if string(m.get("eventId")) and store.is_int(m.get("agentTimestampMs")):
        return f"grok:{m['eventId']}:{m['agentTimestampMs']}"
    return f"{path}:{offset}"


def string(v):
    """v when it is a non-empty string, else None: a field of the wrong type is read as absent."""
    return v if isinstance(v, str) and v else None


def iso(ms):
    """Epoch milliseconds as the store's transcript time: UTC ISO with milliseconds and a Z. None for no time or one
    out of range."""
    if not store.is_int(ms):
        return None
    try:
        return datetime.fromtimestamp(ms // 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{ms % 1000:03d}Z"
    except (OverflowError, OSError, ValueError):
        return None


def fields(d, path):
    m = meta(d)
    return ids(path)[0], string(m.get("eventId")), iso(m.get("agentTimestampMs"))


def line_type(d):
    """The line's sessionUpdate, or its hook's event_name for a hook_execution line."""
    u = update(d)
    t = string(u.get("sessionUpdate"))
    return string(u.get("event_name")) or t if t == "hook_execution" else t


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


INT64 = 2 ** 63 - 1


def amount(v):
    """v when it is a finite number from 0 to the largest signed 64-bit integer, else None: the only figures stored or
    summed. JSON can say 1e309 (infinity), NaN, -1 or 2**80; storing one would break the API's JSON or overflow a BIGINT,
    which rolls back the file's ingest."""
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or not 0 <= v <= INT64:
        return None
    return v


def whole(v):
    """amount(v), for a figure that must be an integer (a token count, a duration in ms, a window)."""
    return amount(v) if store.is_int(v) else None


def counts(u):
    """A turn_completed usage (the turn's or one model's) as the shared token columns, in TOKEN_KINDS order. inputTokens
    includes the cached input and the cache writes; outputTokens includes the reasoning."""
    n = lambda k: whole(u.get(k)) or 0
    cr, cw = n("cachedReadTokens"), n("cacheCreationTokens")
    return [max(n("inputTokens") - cr - cw, 0), n("outputTokens"), n("reasoningTokens"), cr, cw]


def cost_of(u):
    """The USD a usage reports (costUsdTicks: 1e10 ticks are one dollar), or None when it reports none."""
    ticks = amount(u.get("costUsdTicks"))
    return None if ticks is None else ticks / 1e10


def model_costs(usage, models):
    """{model: USD} of a turn whose usage is usage and whose per-model usages are models. The turn's cost is the bill:
    a model's own cost stands when it states one, and the turn's cost less those is shared over the models that state
    none, by their tokens (equally when none has any), so the models add up to the turn's cost whenever it states one."""
    costs = {m: cost_of(mu) for m, mu in models.items()}
    total, missing = cost_of(usage), [m for m, c in costs.items() if c is None]
    if total is None or not missing:
        return costs
    rest = total - sum(c for c in costs.values() if c is not None)
    weights = [sum(counts(models[m])[i] for i in (0, 1, 3, 4)) for m in missing]  # input, output, cache read and write
    weights = weights if sum(weights) > 0 else [1] * len(missing)
    shares = [rest * w / sum(weights) for w in weights[:-1]]
    return costs | dict(zip(missing, shares + [rest - sum(shares)]))


def chunk_text(u):
    """The text of a user, agent message or thought chunk update ({content: {type: text, text}}), else ""."""
    c = u.get("content")
    return c["text"] if isinstance(c, dict) and isinstance(c.get("text"), str) else ""


def prompt_text(d, pid):
    """The text of user_message_chunk line d, untrimmed (the whole prompt is trimmed once joined), or None. The line
    names no prompt (pid is not on it): prompt_texts picks the chunks of a prompt by the user_prompt_submit hook line
    before them."""
    u = update(d)
    return (chunk_text(u) or None) if u.get("sessionUpdate") == "user_message_chunk" else None


def stored_prompt(opened):
    """The prompt id stored for a Grok prompt (prompts, interrupted, tool results), from opened, the (raw_lines key,
    prompt id) of the user_prompt_submit hook line that opens it: that line's key. Prompt ids repeat, within a session
    and across sessions (a wrapper app can supply them); a line's key is unique. None with no such line."""
    return opened[0] if opened else None


def prompt_texts(cur, pids):
    """{session: text} of each prompt in pids ({session: stored prompt id}): the user_message_chunk lines between the
    user_prompt_submit hook line the stored id is the key of and the file's next such line, in file order, one chunk a
    line. A subagent's lines (the task its parent gave it) are not read."""
    if not pids:
        return {}
    got = cur.execute("""
        WITH want AS (SELECT unnest(?::VARCHAR[]) AS session_id, unnest(?::VARCHAR[]) AS hook),
        first AS (SELECT w.session_id, h.file, h.byte_offset AS start FROM want w JOIN raw_lines h ON h.key = w.hook
                  AND h.session_id = w.session_id AND h.type = 'user_prompt_submit' AND h.parsed AND NOT h.subagent),
        span AS (SELECT f.session_id, f.file, f.start, (SELECT min(h.byte_offset) FROM raw_lines h WHERE h.file = f.file
                 AND h.type = 'user_prompt_submit' AND h.byte_offset > f.start) AS stop FROM first f)
        SELECT s.session_id, r.json FROM span s JOIN raw_lines r ON r.file = s.file AND r.type = 'user_message_chunk'
        AND r.parsed AND r.byte_offset > s.start AND (s.stop IS NULL OR r.byte_offset < s.stop)
        ORDER BY s.session_id, r.byte_offset""", [list(pids), list(pids.values())]).fetchall()
    texts = {}
    for sid, text in got:
        try:
            t = prompt_text(json.loads(text), pids[sid])
        except ValueError:
            continue
        if t:
            texts.setdefault(sid, []).append(t)
    joined = {sid: "\n".join(ts).strip() for sid, ts in texts.items()}
    return {sid: t for sid, t in joined.items() if t}


def content_text(u):
    """The text of a tool_call_update's content: its items {type: content, content: {type: text, text}}, a line each."""
    items = u.get("content") if isinstance(u.get("content"), list) else []
    return "\n".join(x["content"]["text"] for x in items if isinstance(x, dict) and isinstance(x.get("content"), dict)
                     and isinstance(x["content"].get("text"), str))


def mcp_text(out):
    """The text of an MCP rawOutput's output: {OkayOutput: text} or {Error: text}, else ""."""
    o = out.get("output") if isinstance(out, dict) else None
    if isinstance(o, dict):
        o = o.get("Error", o.get("OkayOutput"))
    return o if isinstance(o, str) else ""


def tool_of(u):
    """(tool name, MCP server or None, input summary) of a tool_call update. A use_tool call is the MCP tool it calls:
    rawInput.tool_name is "<server>__<tool>"."""
    tool = (u.get("_meta") or {}).get("x.ai/tool") if isinstance(u.get("_meta"), dict) else None
    name = tool.get("name") if isinstance(tool, dict) and isinstance(tool.get("name"), str) else "?"
    raw = u.get("rawInput") if isinstance(u.get("rawInput"), dict) else {}
    if name == "use_tool" and isinstance(raw.get("tool_name"), str) and "__" in raw["tool_name"]:
        server, tool_name = raw["tool_name"].split("__", 1)
        name = f"mcp__{server}__{tool_name}"
        return name, server, summarize_input(name, raw.get("tool_input"))
    return name, None, summarize_input(name, raw)


def exit_code(out):
    code = out.get("exit_code") if isinstance(out, dict) else None
    return code if isinstance(code, int) and not isinstance(code, bool) else None


def error_of(tool, u):
    """The error text of a final tool_call_update, or None when the call did not fail. A shell command fails when its exit
    code is not 0, even when Grok marks it completed; its text is Claude Code's shape: Exit code N, then the output. An MCP
    call fails when its output says is_error; its text is the output's Error. Other tools fail only when marked failed."""
    out = u.get("rawOutput") if isinstance(u.get("rawOutput"), dict) else {}
    code = exit_code(out)
    if tool in SHELL_TOOLS and (u.get("status") == "failed" or code not in (None, 0)):
        said = out.get("output_for_prompt") if isinstance(out.get("output_for_prompt"), str) else content_text(u)
        return "\n".join(x for x in (f"Exit code {code}" if code is not None else "", said.rstrip()) if x)
    if out.get("is_error") is True or (u.get("status") == "failed" and out.get("type") == "MCP"):
        return mcp_text(out).strip() or content_text(u).strip()
    if u.get("status") != "failed":
        return None
    for k in ("FileNotFound", "failure", "error", "stderr"):
        v = out.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return content_text(u).strip() or json.dumps(out)[:700]


def number(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def live_items(d):
    """What the Live page shows of Grok line d, in store.live_items' shape, plus turn_start and turn_end.

    A turn starts at its prompt line (user_message_chunk) and ends at turn_completed, which a cancelled turn writes too.
    A prompt can come as several chunk lines, and a reply as many: each chunk is an item with join, the text that goes
    between it and the chunk before, so live.assemble makes one event of a run of them. A chunk's group names the
    event it belongs to whatever lines a query reads (a reply's model call, a prompt's time), and since the time of
    the group's earliest possible chunk, so that Live reads a reply's head again. Grok states its window only in
    a compaction notice, so turn_start has none. The spawn_subagent call names its subagent (the child session) from
    its result, as no line ties the call to the child while it runs. A background shell call has no timeout: it
    returns at once. Thought chunks give nothing, and no request: Grok's usage comes once a turn ends."""
    u, m = update(d), meta(d)
    t, tid = u.get("sessionUpdate"), string(u.get("toolCallId"))
    if t == "user_message_chunk":  # a prompt's chunks share their line's time, which no catch-up window parts
        text = chunk_text(u)
        group = f"prompt:{m['agentTimestampMs']}" if store.is_int(m.get("agentTimestampMs")) else None
        return [dict(k="turn_start", window=None)] + ([dict(k="prompt", text=text, join="\n", group=group, since=None)] if text else [])
    if t == "agent_message_chunk":  # a chunk of only a space still parts two words: live.assemble trims the whole
        text, stream = chunk_text(u), m.get("streamStartMs")
        group, since = (f"reply:{stream}", iso(stream)) if store.is_int(stream) else (None, None)  # one reply per model call
        return [dict(k="reply", text=text, join="", group=group, since=since)] if text else []
    if t == "turn_completed":
        return ([dict(k="interrupt")] if u.get("stop_reason") == "cancelled" else []) + [dict(k="turn_end")]
    if t == "auto_compact_completed":
        return [dict(k="compaction", pre=whole(u.get("tokens_before")))]
    if t == "tool_call" and tid:
        name, _, summary = tool_of(u)
        raw = u.get("rawInput") if isinstance(u.get("rawInput"), dict) else {}
        background = raw.get("is_background") is True or raw.get("background") is True
        return [dict(k="tool_use", id=tid, tool=name, summary=summary,
                     description=raw.get("description") if isinstance(raw.get("description"), str) else None,
                     timeout=None if background else number(raw.get("timeout_ms")))]
    if t == "tool_call_update" and tid and string(u.get("status")):
        out = u.get("rawOutput") if isinstance(u.get("rawOutput"), dict) else {}
        agent = out.get("subagent_id") if out.get("type") == "SubagentCompleted" and isinstance(out.get("subagent_id"), str) else None
        shell = "run_terminal_command" if out.get("type") == "Bash" else None  # the update does not name its tool; its output's type does
        return [dict(k="tool_result", id=tid, error=error_of(shell, u), output=content_text(u) or mcp_text(out), agent=agent)]
    return []


class GrokDeriver(store.Deriver):
    """Turns new Grok lines of one file into derived rows. Deriver.flush writes them.

    Grok writes usage once per turn (turn_completed), and the start and context size of each model call on the lines the
    call wrote. A finished turn becomes one request per model call, the turn's usage split by the calls' context sizes:
    the requests add up to the turn's figures, and the share of each is an estimate. Each finished turn is also a run
    (session_runs) with its API time and no tool time or lines: Grok reports neither.

    A subagent's file (self.sub) makes no request, run or session row (its parent's turn already holds its usage) and no
    prompt (its prompt is the task its parent gave it). Its tool calls and hooks go to the parent's session.

    self.seq counts tool results, so an error's follow-up is the next agent text within five results."""

    def __init__(self, *args):
        super().__init__(*args)
        own, self.cwd = ids(self.path)
        self.sid = (parent_of(self.cur, own) or own) if self.sub else own
        self.prompt = None  # (key, prompt id) of the newest user_prompt_submit line read: the current prompt
        self.prompt_known = False  # self.prompt is set by a line of this pass, or read back from raw_lines

    def add(self, d, line=None):
        """Derive line d, stored under raw_lines key line: a line with no event id is keyed by its offset, which the
        line does not hold, so its turn and prompt find it by that key."""
        self.line = line or key(d, self.path, 0)
        u, m = update(d), meta(d)
        ts = iso(m.get("agentTimestampMs"))
        when = store.ts_of(ts)
        t = u.get("sessionUpdate")
        if t == "tool_call" and string(u.get("toolCallId")):
            self.tool_call(u, when)
        elif t == "tool_call_update" and string(u.get("toolCallId")) and string(u.get("status")):
            self.tool_result(u, m, when)
        elif t in ("agent_message_chunk", "agent_thought_chunk"):
            said = chunk_text(u).strip()
            if said:
                self.followup(said[:500])
        elif t == "hook_execution":
            self.hook(u, when)
        elif t == "subagent_spawned":
            self.adopt(string(u.get("child_session_id")))
        elif t == "user_message_chunk" and not self.sub:
            pid = stored_prompt(self.prompt_of())
            if pid and pid not in self.prompts:
                self.prompts[pid] = (pid, self.sid, when, False)
        if self.sub:
            return
        s = self.session(dict(sessionId=self.sid, timestamp=ts, cwd=self.cwd))
        if t == "turn_completed" and isinstance(u.get("usage"), dict):
            self.turn(d, u, s, when)
            self.run(u, m)
            cancelled = self.prompt_named(string(u.get("prompt_id"))) if u.get("stop_reason") == "cancelled" else None
            if cancelled:
                self.interrupted.add(cancelled)
        elif t == "auto_compact_started" and whole(u.get("context_window")):
            s["window"] = u["context_window"]
        elif t == "auto_compact_completed":
            s["compactions"] += 1
            if when:
                s["first_compaction"] = min(s["first_compaction"] or when, when)

    def adopt(self, child):
        """Make spawned session child this session's subagent work when its lines were stored as a session of their own,
        as happens when its log was read before this one: its lines move here as a rebuild places them, its tool calls
        and hooks move here as subagent work, and its session, requests, runs, prompts and titles go (this session's
        turns already hold its usage). Nothing to do for a child placed already or not read yet.

        The id comes from a transcript line, so only a Grok session is adopted: its session row's source is grok and its
        own log is a Grok file of the same Grok home as this file. Only the Grok files of that home whose lines are the
        child's (its log, and those of subagents placed under it) move. A child that is this session or one of its
        spawners is refused: no cycle."""
        cur = self.cur
        if not child or child in self.ancestors():
            return
        row = cur.execute("SELECT source FROM sessions WHERE session_id = ?", [child]).fetchone()
        if not row or row[0] != "grok":
            return
        home = grok_home(self.path)
        files = [f for (f,) in cur.execute("SELECT DISTINCT r.file FROM raw_lines r JOIN files f ON f.path = r.file "
                                           "WHERE r.session_id = ? AND f.source = 'grok'", [child]).fetchall()
                 if grok_home(f) == home]
        if not any(ids(f)[0] == child for f in files):
            return
        cur.execute("UPDATE raw_lines SET session_id = ?, subagent = true WHERE session_id = ? AND list_contains(?, file)",
                    [self.sid, child, files])
        for table in ("sessions", "requests", "session_runs", "prompts", "session_titles"):
            cur.execute(f"DELETE FROM {table} WHERE session_id = ?", [child])
        cur.execute("UPDATE tool_calls SET session_id = ?, subagent = true WHERE session_id = ?", [self.sid, child])
        cur.execute("UPDATE hooks SET session_id = ? WHERE session_id = ?", [self.sid, child])

    def ancestors(self):
        """This file's session, the session its lines belong to, and every Grok session that spawned one of them, as the
        stored subagent_spawned lines tell."""
        seen, todo = {ids(self.path)[0], self.sid}, [ids(self.path)[0], self.sid]
        while todo:
            for sid, f in self.cur.execute(
                    "SELECT r.session_id, r.file FROM raw_lines r JOIN files f ON f.path = r.file AND f.source = 'grok' "
                    "WHERE r.type = 'subagent_spawned' AND r.parsed "
                    "AND json_extract_string(r.json, '$.params.update.child_session_id') = ?", [todo.pop()]).fetchall():
                for a in (sid, ids(f)[0]):
                    if a not in seen:
                        seen.add(a)
                        todo.append(a)
        return seen

    def tool_call(self, u, ts):
        tid = u["toolCallId"]
        if tid in self.uses:
            return
        name, server, summary = tool_of(u)
        shell = name in SHELL_TOOLS
        self.uses[tid] = dict(session_id=self.sid, tool=name, mcp_server=server, skill=None, input_summary=summary,
                              start_ts=ts, subagent=self.sub, is_commit=shell and GIT_COMMIT.search(summary) is not None,
                              is_test=shell and runs_tests(summary))

    def tool_result(self, u, m, ts):
        """The final tool_call_update of a call: the one that states a status. The tool's name is on its tool_call line."""
        tid = u["toolCallId"]
        if tid in self.results:
            return
        tool = self.uses[tid]["tool"] if tid in self.uses else self.stored_tool(tid)
        err = error_of(tool, u)
        text = content_text(u) or mcp_text(u.get("rawOutput"))
        self.seq += 1
        self.results[tid] = dict(end_ts=ts, is_error=err is not None, error=err, prompt_id=self.prompt_named(string(m.get("promptId"))),
                                 session_id=self.sid, seq=self.seq, sub=self.sub, bytes=len(text.encode("utf-8")))
        if err is not None:
            self.pending[tid] = self.seq

    def stored_tool(self, tid):
        """The tool of a call whose tool_call line came in an earlier ingest: from tool_calls."""
        row = self.cur.execute("SELECT tool FROM tool_calls WHERE tool_use_id = ?", [tid]).fetchone()
        return row[0] if row else None

    def hook(self, u, ts):
        """One hooks row per run: source hook_execution, the hook event and the run's name (Grok's hook, as a command is
        Claude Code's). A user_prompt_submit line names the prompt the chunks after it belong to."""
        event = string(u.get("event_name"))
        if event is None:
            return
        if event == "user_prompt_submit":
            self.prompt, self.prompt_known = (self.line, string(u.get("prompt_id"))), True
        for r in u.get("runs") if isinstance(u.get("runs"), list) else []:
            if not isinstance(r, dict) or not string(r.get("name")):
                continue
            st = r.get("status") if isinstance(r.get("status"), dict) else {}
            self.hooks.append((self.sid, ts, "hook_execution", event, r.get("name"),
                               whole(st.get("elapsed_ms")), st.get("status") != "success"))

    def prompt_of(self):
        """(key, prompt id) of the prompt the line being derived belongs to: the newest user_prompt_submit line before it
        in the file, read back from raw_lines when this pass started after it. None before the file's first."""
        if not self.prompt_known:
            self.prompt_known = True
            row = self.cur.execute(
                "SELECT h.key, json_extract_string(h.json, '$.params.update.prompt_id') FROM raw_lines c JOIN raw_lines h "
                "ON h.file = c.file AND h.type = 'user_prompt_submit' AND h.parsed AND h.byte_offset < c.byte_offset "
                "WHERE c.key = ? ORDER BY h.byte_offset DESC LIMIT 1", [self.line]).fetchone()
            self.prompt = (row[0], row[1]) if row else None
        return self.prompt

    def prompt_named(self, pid):
        """The stored id of the prompt a line naming prompt id pid belongs to (a turn's end, a tool result): the current
        prompt (prompt_of), when it has that prompt id; else None."""
        opened = self.prompt_of() if pid else None
        return stored_prompt(opened) if opened and opened[1] == pid else None

    def run(self, u, m):
        """The run of a finished turn: it started elapsed_ms before the line's time, and states only its API time."""
        usage, end, took = u["usage"], whole(m.get("agentTimestampMs")), whole(u.get("elapsed_ms"))
        api = whole(usage.get("apiDurationMs"))
        if end is not None and took is not None and api is not None:
            self.runs.setdefault((self.sid, end - took), [api, None, None, None])  # RUN_FIGURES order

    def calls(self, d, pid):
        """[(streamStartMs, context size)] of the model calls of turn pid, oldest first: the distinct streamStartMs of the
        turn's stored lines, each with the largest totalTokens its lines state (a call's first value can be stale).
        Only lines between the file's previous turn_completed line and this one (d) count: the result is then the same
        however the file was cut into ingests, and a prompt id used again counts no call twice. raw_lines already holds
        the chunk being derived."""
        (end,) = self.cur.execute("SELECT byte_offset FROM raw_lines WHERE key = ?", [self.line]).fetchone() or (None,)
        if end is None:
            return []
        (start,) = self.cur.execute("SELECT coalesce(max(byte_offset), -1) FROM raw_lines WHERE file = ? AND type = 'turn_completed' "
                                    "AND byte_offset < ?", [self.path, end]).fetchone()
        # Only a JSON integer is a call figure, as store.is_int reads it in live_items: TRY_CAST would take "12".
        whole = lambda f: (f"CASE WHEN json_type(json, '$.params._meta.{f}') IN ('BIGINT', 'UBIGINT') "
                           f"THEN TRY_CAST(json_extract(json, '$.params._meta.{f}') AS BIGINT) END")
        rows = self.cur.execute(
            f"SELECT stream, max(total) FROM (SELECT {whole('streamStartMs')} AS stream, {whole('totalTokens')} AS total FROM raw_lines "
            f"WHERE file = ? AND parsed AND type IN ({','.join('?' * len(CALL_TYPES))}) "
            "AND json_extract_string(json, '$.params._meta.promptId') = ? AND byte_offset > ? AND byte_offset < ?) "
            "WHERE stream IS NOT NULL GROUP BY 1 ORDER BY 1",
            [self.path, *CALL_TYPES, pid, start, end]).fetchall()
        return [(stream, total or 0) for stream, total in rows]

    def turn(self, d, u, s, ts):
        """The requests of a finished turn. Its calls cannot be told when no line states one or the turn names several
        models: it is then one request per model at the turn's end, keyed by the turn_completed line's key (prompt ids
        repeat, so two turns of one prompt id stay two). A modelUsage that is no breakdown by model counts as none: the
        turn is then one request with the turn's totals and no model."""
        usage, pid, stop = u["usage"], string(u.get("prompt_id")), string(u.get("stop_reason"))
        by_model = usage.get("modelUsage") if isinstance(usage.get("modelUsage"), dict) else {}
        models = {k: v for k, v in by_model.items() if isinstance(v, dict)} or {None: usage}
        calls = self.calls(d, pid) if pid and len(models) == 1 else []
        billed = model_costs(usage, models)
        if not calls:
            for model, mu in models.items():
                mid = f"{self.line}:{model or ''}"
                self.request(mid, ts, model, counts(mu), billed[model], stop)
            return
        (model, mu), = models.items()
        weights = [max(size, 0) for _, size in calls]
        if sum(weights) <= 0:  # no line stated a context size: equal shares
            weights = [1] * len(calls)
        shares = list(zip(*(split(n, weights) for n in counts(mu))))  # one tuple of TOKEN_KINDS per call
        cost = billed[model]
        costs = [None] * len(calls) if cost is None else [cost * w / sum(weights) for w in weights[:-1]]
        if cost is not None:
            costs.append(cost - sum(costs))  # the last call takes the rest, so the calls add up to the turn's cost
        for i, (stream, size) in enumerate(calls):
            last = i == len(calls) - 1
            self.request(f"grok:{self.sid}:{pid}:{stream}", store.ts_of(iso(stream)), model, shares[i], costs[i],
                         stop if last else None, max(size, 0))
            if s and size > s["peak"]:
                s["peak"], s["peak_model"] = size, model

    def request(self, mid, ts, model, kinds, cost, stop, context=0):
        """A request row. context: the context size its model call stated (context_tokens), which pages read as its
        context; its token columns are its share of the turn's usage. 0 when no call stated one, as for a turn whose
        calls cannot be told: its tokens are not one call's, so its context is unknown (metrics.context_of)."""
        if mid in self.requests:
            return
        inp, out, thinking, cr, cw = kinds
        self.requests[mid] = (mid, self.sid, ts, model, None, False, inp, out, thinking, cr, cw, 0, None, stop, None, cost, context)
