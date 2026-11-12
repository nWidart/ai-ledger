"""The Live page's payloads: the active sessions with their state, and one session's events and figures.

Events come from the stored transcript lines through each source's live_items, so a running tool shows before the
derived tool_calls know of it. Totals (cost, requests, tool calls, errors) come from the derived tables, as on the other
pages. Prompt, reply and tool-output text leave this module only when the caller asks for it, and so do a session title
made from the first prompt, a subagent's prompt and tool inputs and descriptions longer than INPUT_CAP."""
import json
import re
import shlex
from datetime import datetime, timedelta, timezone

from . import limits, metrics, store
from .categorize import SHELL_TOOLS

ACTIVE = timedelta(minutes=10)  # a session with a line this recent is listed
IDLE = timedelta(minutes=5)  # no line for this long: idle, whatever else the lines say
APPROVAL = timedelta(seconds=30)  # a shell call pending this long is likely waiting for approval
APPROVAL_TOOLS = SHELL_TOOLS | {"exec"}  # Codex's exec runs a script that calls the shell
LONG = timedelta(seconds=120)  # a call with a timeout above this runs long: pending past APPROVAL, it is no approval wait
FIRST_LOAD = 500  # events on a first load
FIRST_LINES = FIRST_LOAD * 6  # lines read for a first load: most lines show no event
OVERLAP = timedelta(seconds=60)  # a catch-up reads again this far before its cursor: some lines are written late
STATE_LINES = 200  # newest lines read per session for the active list
TEXT_CAP = 4096  # characters of one tool result sent with text
INPUT_CAP = 300  # characters of a tool input or description sent without text, as Codex's live summaries
PROMPT_TOOLS = {"Agent", "Task", "spawn_agent"}  # their input is a prompt: without text, their description stands in
ERROR_CAP = 700  # as tool_calls.error
SPARK_STEP = 5  # seconds per point of the tokens chart, over the last minute
QUIET_TOOLS = {"Read", "Grep", "Glob"}  # tools that only read: the page can hide their calls
# Shell commands that only read, search or print. Codex names no Read or Grep tool: its exec_command reads and searches
# through these. A command with no flag that writes or runs a program reads whatever its words. One with such a flag
# (sed -i, sort -o, find -delete, rg --pre) reads only when each word that starts with - is in full a flag listed here,
# among those agents read with: a shortened or unknown flag is not. A short flag that takes a value ends its cluster.
QUIET_COMMANDS = dict.fromkeys(("grep", "cat", "ls", "head", "tail", "wc", "nl", "cd", "pwd", "echo")) | {
    "rg": re.compile(r"-[cFHiIlLnNosSuUvwx.]*(?:[ABCegmtT].*)?|--(?:hidden|files|no-ignore|ignore-case|smart-case|case-sensitive"
                     r"|fixed-strings|line-number|no-line-number|no-heading|with-filename|no-filename|files-with-matches"
                     r"|files-without-match|count|only-matching|word-regexp|invert-match|multiline|glob|iglob|type|type-not"
                     r"|max-count|max-depth|context|after-context|before-context|sort|color)(?:=.*)?"),
    "sort": re.compile(r"-[bfhnruV]*(?:[kt].*)?|--(?:reverse|unique|numeric-sort|human-numeric-sort|version-sort|ignore-case"
                       r"|key|field-separator)(?:=.*)?"),
    "find": re.compile(r"-(?:name|iname|path|type|maxdepth|mindepth|mtime|mmin|newer|size|empty|not|o|a|print|print0|prune|\d+\w?)"),
    "sed": re.compile(r"-n")}
SED_PRINT = re.compile(r"\d+(?:,\d+)?p(?:;\d+(?:,\d+)?p)*")  # the one sed script that is quiet, with -n: lines to print
# What quiet reads of a shell line: words, quotes, SEPARATORS and the redirections of NO_WRITE. A line with more is not
# quiet. UNREAD is what shlex reads otherwise than the shell does, or what changes the words after they are read: an
# escape, a substitution or an expansion, and a character of MASK. shlex drops the quotes, so the operators and the
# expansion characters inside them are masked first: the ones it then gives are the shell's own.
OPERATORS, EXPANSIONS = "();<>|&", "*?[{^#"  # ^ and # are zsh's, with EXTENDED_GLOB; # also starts a comment
MASK = str.maketrans(OPERATORS + EXPANSIONS, "".join(map(chr, range(0xE000, 0xE000 + len(OPERATORS + EXPANSIONS)))))
UNMASK = {masked: char for char, masked in MASK.items()}
QUOTED = re.compile(r"""'[^']*'|"[^"]*\"""")  # exact on a line with nothing of UNREAD
UNREAD = re.compile(r"[\\`$%s]" % "".join(map(chr, UNMASK)))
SEPARATORS = {";", "&&", "||", "|"}
NO_WRITE = {">": {"/dev/null"}, ">&": {"1", "2"}}  # a redirection that writes no file, by the word after it
SHELLS = {"bash", "sh", "zsh"}  # `bash -lc '…'` runs its last word as a line of its own, when the word is whole in quotes

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


def aware(t):
    """A stored time (UTC, no zone) as an aware one, or None."""
    return t.replace(tzinfo=timezone.utc) if t else None


def lane_of(path, source):
    """The id of the subagent whose lines file path holds: Claude Code's agent-<id>.jsonl, a Codex thread."""
    if source == "codex":
        from . import codex
        return codex.ids(path)[1]
    name = path.rsplit("/", 1)[-1]
    return name[len("agent-"):-len(".jsonl")] if name.startswith("agent-") and name.endswith(".jsonl") else name


def quiet(tool, summary):
    """Whether a tool call only reads: a tool of QUIET_TOOLS, or a shell call whose every simple command reads, as reads
    tells. A call that cannot be read for certain is not quiet: a line simple_commands refuses, Codex's exec, which runs
    a script, and a summary Codex cut short."""
    if tool in QUIET_TOOLS:
        return True
    if tool not in SHELL_TOOLS:
        return False
    cmd = summary
    if tool == "exec_command":  # Codex's summary is the call's arguments as JSON, the command line under cmd, or a line it may have cut
        try:
            cmd = json.loads(summary)["cmd"]
        except (ValueError, KeyError, TypeError):
            return False
    return isinstance(cmd, str) and reads_only(cmd)


def reads_only(line):
    """Whether every simple command of a shell line reads, as reads tells. A shell of SHELLS with a script is read by its
    script, unless the script word holds an expansion character in clear: the outer shell then makes the script from
    file names, and a file can be named `cat a;rm -rf build`."""
    simple = simple_commands(line)
    if not simple:
        return False
    if len(simple) == 1 and len(simple[0]) == 3 and simple[0][0] in SHELLS and simple[0][1] in ("-c", "-lc"):
        script = simple[0][2]
        return not any(c in script for c in EXPANSIONS) and reads_only(script.translate(UNMASK))
    return all(reads(words) for words in simple)


def reads(words):
    """Whether one simple command's words, as simple_commands gives them, only read: a command of QUIET_COMMANDS by its
    exact name and, for one with flags that write, only the flags listed for it and no word the shell may expand, as a
    file can be named as a flag. sed reads with -n and a script of SED_PRINT, and nothing else."""
    name, args = words[0], words[1:]
    if name not in QUIET_COMMANDS:
        return False
    flags = QUIET_COMMANDS[name]
    if flags is None:
        return True
    if any(c in w for w in args for c in EXPANSIONS):
        return False
    args = [w.translate(UNMASK) for w in args]
    if not all(flags.fullmatch(w) for w in args if w.startswith("-")):
        return False
    plain = [w for w in args if not w.startswith("-")]
    return name != "sed" or "-n" in args and bool(plain) and SED_PRINT.fullmatch(plain[0]) is not None


def simple_commands(line):
    """The words of each simple command of a shell line, or None for a line that holds more than this reads exactly:
    UNREAD, a quote with no pair, or an operator that is no separator and no redirection of NO_WRITE (a lone &, a
    redirection into a file, a heredoc, a subshell). It refuses instead of parsing harder. A quoted operator or
    expansion character stays masked in the words: one in clear is the shell's to expand. A comment's words read as
    words: reads takes none of them for a flag, as it refuses a # on a command with flags that write."""
    if UNREAD.search(line):
        return None
    out = [[]]
    for text in line.split("\n"):  # no quote spans lines here: one that does has no pair in its line
        lex = shlex.shlex(QUOTED.sub(lambda m: m.group().translate(MASK), text), posix=True, punctuation_chars=OPERATORS)
        lex.whitespace, lex.whitespace_split, lex.commenters = " \t", True, ""
        try:
            for t in lex:
                if t in SEPARATORS:
                    out.append([])
                elif t in NO_WRITE:
                    if next(lex, None) not in NO_WRITE[t]:
                        return None
                elif t and not t.strip(OPERATORS):
                    return None
                else:
                    out[-1].append(t)
        except ValueError:
            return None
        out.append([])
    return [words for words in out if words]


def assemble(rows):
    """Events in line order from raw rows (key, file, ts, subagent, source, json). A tool use and its result become one
    tool event; requests are left out, as the page shows none. A tool event is long when its input sets a timeout above
    LONG; a background call is not, as it returns at once. Returns (events, results), where results maps a tool id to
    its result item when the use is not among the rows."""
    events, tools, results = [], {}, {}
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
                          description=it.get("description"), start=t, end=None, failed=False, error=None, output=None, agent=None,
                          long=(it.get("timeout") or 0) > LONG.total_seconds() * 1000)
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
            elif k != "request":
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


def state(events, now, source, last, closed=False):
    """One session's state from its events (in order), now, its source, its newest line's time and whether its
    transcript shows it closed. kind: ended, idle, wait (likely waiting for approval), tool, thinking or you (your turn).
    long: the running call is a long one, which never turns into a wait."""
    def st(kind, since, tool=None, inferred=False, long=False):
        return dict(kind=kind, tool=tool, since=iso(since), inferred=inferred, long=long)
    if closed:  # the close line has no time of its own
        return st("ended", last)
    if last is None or now - last > IDLE:
        return st("idle", last)
    pending = [e for e in events if e["k"] == "tool" and e["end"] is None]
    if pending:  # a likely approval wait, the oldest first, else the newest call: a newer call in a subagent hides no wait
        waits = [e for e in pending if e["tool"] in APPROVAL_TOOLS and not e["long"] and e["start"] is not None and now - e["start"] > APPROVAL]
        if waits:
            p = min(waits, key=lambda e: e["start"])
            return st("wait", p["start"], p["tool"], inferred=True)
        p = max(pending, key=lambda e: e["start"] or now)
        return st("tool", p["start"], p["tool"], long=p["long"])
    if source == "codex":  # the main thread's turns: a subagent's turn that ends leaves the session's open
        turns = [e for e in events if e["k"] in ("turn_start", "turn_end") and not e["lane"]]
        if turns and turns[-1]["k"] == "turn_start":
            return st("thinking", turns[-1]["ts"])
        return st("you", turns[-1]["ts"] if turns else last)
    # Claude Code: whatever happened last among the prompts, replies, interruptions and tool results.
    marks = [(e["ts"], e["k"]) for e in events if e["k"] in ("prompt", "reply", "interrupt") and e["ts"]]
    marks += [(e["end"], "result") for e in events if e["k"] == "tool" and e["end"]]
    if not marks:
        return st("you", last)
    t, k = max(marks, key=lambda m: m[0])
    return st("thinking", t, inferred=True) if k in ("prompt", "result") else st("you", t)


def closed(cur, sids):
    """The sessions among sids whose transcript shows they closed: their source's close line (Source.close_type) comes
    after the last timed line of the main file that wrote last. A source with no close line never has one."""
    kinds = [f"{name}:{src.close_type}" for name, src in store.SOURCES.items() if src.close_type]
    if not sids or not kinds:
        return set()
    return {r[0] for r in cur.execute("""SELECT session_id FROM (
            SELECT r.session_id, r.file, max(r.ts) AS ts, coalesce(
              max(r.line_no) FILTER (WHERE list_contains(?, coalesce(f.source, 'claude') || ':' || r.type))
              > max(r.line_no) FILTER (WHERE r.ts IS NOT NULL), false) AS closed
            FROM raw_lines r LEFT JOIN files f ON f.path = r.file
            WHERE list_contains(?, r.session_id) AND r.parsed AND NOT r.subagent GROUP BY 1, 2)
        GROUP BY 1 HAVING arg_max(closed, ts)""", [kinds, list(sids)]).fetchall()}


def latest_action(events, text):
    """The newest prompt, tool call or subagent call, for a wall tile."""
    for e in reversed(events):
        if e["k"] == "tool":
            return dict(kind="tool", tool=e["tool"], summary=tool_input(e, text)[:200], lane=e["lane"])
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


def sessions(cur, project="", source="", automated=False, now=None, prices=None, text=False):
    """/api/live: sessions with a line in the last ACTIVE, newest first, each with its title, start (first_ts), state,
    figures and latest action."""
    now = now or now_utc()
    prices = metrics.load_prices() if prices is None else prices
    where, params = metrics.scope(project, automated, source)
    since = (now - ACTIVE).astimezone(timezone.utc).replace(tzinfo=None)
    info = metrics.rows(cur, f"""SELECT s.session_id, s.project, s.source, s.git_branch, s.first_ts, s.last_ts FROM sessions s
        WHERE s.last_ts >= ? AND {where} ORDER BY s.last_ts DESC""", [since] + params)
    sids = [s["session_id"] for s in info]
    lines = recent(cur, sids)
    figs = figures(cur, sids, prices)
    found = metrics.titles(cur, sids, prompts=text)
    ended = closed(cur, sids)
    out = []
    for s in info:
        sid = s["session_id"]
        events, _ = assemble(lines.get(sid, []))
        last = aware(s["last_ts"])
        f = figs[sid]
        out.append(dict(session_id=sid, **title_of(found, sid), project=s["project"], source=s["source"], branch=s["git_branch"],
                        first_ts=iso(aware(s["first_ts"])), last_ts=iso(last), state=state(events, now, s["source"], last, sid in ended),
                        latest=latest_action(events, text), window=window_of(f["model"], events, prices), **f))
    return dict(now=iso(now), sessions=out, newest=None if out else newest_session(cur, where, params))


def title_of(found, sid):
    """The title and title_from fields of session sid, from metrics.titles."""
    title, origin = found.get(sid, (None, None))
    return dict(title=title, title_from=origin)


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
    its state, its figures and those of its subagent lanes. None for an unknown session. Raises ValueError for a
    malformed cursor.

    A catch-up reads the lines from OVERLAP before the cursor, as a line can be stored after a later-stamped one; the
    page keeps one copy of each event by its key. A subagent's events carry its lane id, and the call that started it
    names it in agent: the page groups them."""
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
            ORDER BY r.ts, r.file, r.line_no""", [sid, iso(parse_ts(after) - OVERLAP)]).fetchall()
        more = False
    else:
        rows = cur.execute(f"""SELECT * FROM (SELECT {ROW_COLS}, r.line_no FROM {ROW_FROM}
            WHERE r.session_id = ? AND r.ts IS NOT NULL AND r.parsed ORDER BY r.ts DESC, r.file, r.line_no DESC LIMIT ?)
            ORDER BY 3, 2, 7""", [sid, FIRST_LINES + 1]).fetchall()
        more = len(rows) > FIRST_LINES
        rows = [r[:6] for r in rows[-FIRST_LINES:]]
    events, results = assemble(rows)
    started = started_by(rows, events)
    missing = set(results) | (set(started) - {e["id"] for e in events if e["k"] == "tool"})
    if missing:  # calls that came before the rows: send them again, finished or naming the subagent they started
        uses, _ = assemble(earlier_uses(cur, sid, rows[0][2], list(missing)))
        for ev in uses:
            if ev["k"] == "tool" and ev["id"] in missing:
                if ev["id"] in results:
                    finish(ev, results[ev["id"]])
                events.append(ev)
        events.sort(key=lambda e: (e["ts"] or now))
    for ev in events:
        if ev["k"] == "tool" and ev["id"] in started:
            ev["agent"] = ev["agent"] or started[ev["id"]]
    if len(events) > FIRST_LOAD and not after:
        events, more = events[-FIRST_LOAD:], True
    last = aware(s["last_ts"])
    cursor = max((r[2] for r in rows if r[2]), default=after or None)
    f = figures(cur, [sid], prices)[sid]
    return dict(session_id=sid, **title_of(metrics.titles(cur, [sid], prompts=text), sid), project=s["project"], source=s["source"], branch=s["git_branch"], last_ts=iso(last),
                now=iso(now), cursor=cursor, truncated=more,
                state=state(assemble(recent(cur, [sid]).get(sid, []))[0], now, s["source"], last, sid in closed(cur, [sid])),
                events=[public(e, text) for e in events], lanes=lanes(cur, sid, prices),
                window=window_of(f["model"], events, prices), compactions=compactions(cur, sid),
                spark=spark(cur, sid, now), limits=plan_limits(cur, s["source"], now), **f)


def earlier_uses(cur, sid, before, ids):
    """The lines before `before` that hold the tool uses ids."""
    return cur.execute(f"""SELECT {ROW_COLS} FROM {ROW_FROM} WHERE r.session_id = ? AND r.ts < ? AND r.parsed
        AND list_bool_or(list_transform(?, lambda x: contains(r.json, x))) ORDER BY r.ts, r.file, r.line_no""", [sid, before, ids]).fetchall()


def public(e, text):
    """Event e as sent: times as ISO strings, and text only when asked for (counts otherwise). A tool event is quiet when
    it only reads: told here, as the active list sends no event."""
    out = {k: iso(v) if isinstance(v, datetime) else v for k, v in e.items()}
    if e["k"] in ("prompt", "reply"):
        out["words"] = len(e["text"].split())
        if not text:
            del out["text"]
    elif e["k"] == "tool":
        out["quiet"] = quiet(e["tool"], e["summary"])
        out["summary"] = tool_input(e, text)
        out["description"] = capped(e["description"], text)  # the label the agent gave the call: a shell call's row text
        output = e["output"] or ""
        out["chars"] = len(output)
        out["output"] = output[:TEXT_CAP] if text and e["end"] else None
        out["cut"] = bool(text and len(output) > TEXT_CAP)
    return out


def capped(s, text):
    """s as sent: whole with text, else cut to INPUT_CAP."""
    return s if text or s is None or len(s) <= INPUT_CAP else s[:INPUT_CAP] + "…"


def tool_input(e, text):
    """Tool event e's input as sent: whole with text; otherwise cut to INPUT_CAP, a subagent call's description standing
    in for its prompt."""
    return capped(e["description"] or "" if e["tool"] in PROMPT_TOOLS and not text else e["summary"], text)


def started_by(rows, events):
    """For Claude Code subagents among the rows that no call in events names yet: the id of the call that started each,
    mapped to the subagent's lane id. Its result names a subagent only when it ends; at its start Claude Code writes
    agent-<id>.meta.json beside its lines, with that call's toolUseId."""
    named = {e["agent"] for e in events if e["k"] == "tool" and e["agent"]}
    out, seen = {}, set()
    for _, path, _, sub, source, _ in rows:
        if not sub or source != "claude" or path in seen or not path.endswith(".jsonl"):
            continue
        seen.add(path)
        lane = lane_of(path, source)
        if lane in named:
            continue
        try:
            with open(path[:-len(".jsonl")] + ".meta.json") as fh:
                tid = json.load(fh).get("toolUseId")
        except (OSError, ValueError, AttributeError):
            continue
        if isinstance(tid, str) and tid:
            out[tid] = lane
    return out


def lanes(cur, sid, prices):
    """Per subagent lane of the session with a request: its cost (None when no request of its is priced) and its newest
    request's model, keyed by the events' lane id. requests names no subagent: a request belongs to the lane whose file
    holds a request line with the request's time (as store.ts_of reads it). No line's text is read for that, except
    where files of several lanes hold such a line: there the line that names the request decides."""
    pcte, pparams = metrics.price_cte(prices)
    held = cur.execute(f"""{metrics.requests_cte(pcte, "r.session_id = ? AND r.subagent")}
        SELECT rq.message_id, rq.model, rq.cost, l.file, coalesce(f.source, 'claude'), l.key
        FROM rq JOIN raw_lines l ON try_cast(left(rtrim(replace(l.ts, 'T', ' '), 'Z'), 26) AS TIMESTAMP) = rq.ts
        LEFT JOIN files f ON f.path = l.file
        WHERE l.session_id = ? AND l.parsed AND l.subagent AND l.type IN ('assistant', 'token_usage_record')
        ORDER BY rq.ts, rq.message_id, l.file, l.line_no""", pparams + [sid, sid]).fetchall()
    files = {}
    for mid, _, _, path, _, _ in held:
        files.setdefault(mid, set()).add(path)
    tied = [key for mid, *_, key in held if len(files[mid]) > 1]
    named = dict(cur.execute("""SELECT key, coalesce(json_extract_string(json, '$.message.id'), json_extract_string(json, '$.payload.response_id'))
        FROM raw_lines WHERE session_id = ? AND list_contains(?, key)""", [sid, tied]).fetchall()) if tied else {}
    out, owned = {}, set()
    for mid, model, cost, path, source, key in held:
        if mid in owned or len(files[mid]) > 1 and named[key] != mid:
            continue
        owned.add(mid)
        lane = out.setdefault(lane_of(path, source), dict(cost=None, model=None))
        lane["model"] = model
        if cost is not None:
            lane["cost"] = (lane["cost"] or 0) + cost
    return out


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
