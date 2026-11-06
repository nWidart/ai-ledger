"""Local DuckDB store of Claude Code transcripts.

Raw layer: every transcript line, verbatim and deduplicated, never deleted. Derived layer: sessions,
requests, tool calls, prompts and hooks, written during ingest and rebuildable from the raw lines.
"""
import glob
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

import duckdb

from categorize import GIT_COMMIT, TEST_CMD, categorize, error_text, summarize_input

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(HERE, "data", "ai-ledger.duckdb")
EARLIER_DB = os.path.join(HERE, "data", "claude.duckdb")  # default before the rename to AI Ledger
DEFAULT_ROOT = os.path.expanduser("~/.claude/projects")
BUSY = "the app is running and owns the store; use Refresh in the dashboard"

RAW_SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
  path VARCHAR PRIMARY KEY, size BIGINT, read_offset BIGINT, lines BIGINT, seq BIGINT,
  mtime DOUBLE, last_ingest TIMESTAMP, source VARCHAR DEFAULT 'claude');
CREATE TABLE IF NOT EXISTS raw_lines (
  key VARCHAR PRIMARY KEY, file VARCHAR, line_no BIGINT, byte_offset BIGINT, type VARCHAR,
  session_id VARCHAR, uuid VARCHAR, ts VARCHAR, subagent BOOLEAN, parsed BOOLEAN,
  json VARCHAR USING COMPRESSION zstd);
CREATE TABLE IF NOT EXISTS projects_by_cwd (cwd VARCHAR PRIMARY KEY, project VARCHAR);
"""

DERIVED = ["sessions", "requests", "tool_calls", "prompts", "hooks"]
DERIVED_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR PRIMARY KEY, project VARCHAR, cwd VARCHAR, git_branch VARCHAR,
  first_ts TIMESTAMP, last_ts TIMESTAMP, entrypoint VARCHAR, version VARCHAR,
  compactions INTEGER, peak_context BIGINT, peak_model VARCHAR, source VARCHAR DEFAULT 'claude');
CREATE TABLE IF NOT EXISTS requests (
  message_id VARCHAR PRIMARY KEY, session_id VARCHAR, ts TIMESTAMP, model VARCHAR, effort VARCHAR,
  subagent BOOLEAN, input BIGINT, output BIGINT, thinking BIGINT, cache_read BIGINT,
  cache_5m BIGINT, cache_1h BIGINT, thinking_ms BIGINT, stop_reason VARCHAR);
CREATE TABLE IF NOT EXISTS tool_calls (
  tool_use_id VARCHAR PRIMARY KEY, session_id VARCHAR, tool VARCHAR, mcp_server VARCHAR,
  skill VARCHAR, input_summary VARCHAR, start_ts TIMESTAMP, end_ts TIMESTAMP, is_error BOOLEAN,
  error VARCHAR, category VARCHAR, followup VARCHAR, subagent BOOLEAN, is_commit BOOLEAN,
  is_test BOOLEAN, test_passed BOOLEAN, result_file VARCHAR, result_seq BIGINT);
CREATE TABLE IF NOT EXISTS prompts (
  prompt_id VARCHAR PRIMARY KEY, session_id VARCHAR, ts TIMESTAMP, interrupted BOOLEAN);
CREATE TABLE IF NOT EXISTS hooks (
  session_id VARCHAR, ts TIMESTAMP, source VARCHAR, hook VARCHAR, command VARCHAR,
  duration_ms BIGINT, is_error BOOLEAN);
"""


class StoreBusy(Exception):
    pass


def move_earlier_store(new, old):
    """Move a store at its pre-rename path to the new one, write-ahead log included. Never replaces a store."""
    if os.path.exists(old):
        if os.path.exists(new):
            print(f"store: opened {new}; {old} also exists and was not moved", file=sys.stderr)
            return
        os.replace(old, new)
    # Also finishes a move that stopped between the file and its log.
    if os.path.exists(old + ".wal") and not os.path.exists(new + ".wal"):
        os.replace(old + ".wal", new + ".wal")


def open_store(path=None):
    """Open (or create) the database for writing. Raises StoreBusy when another process holds it.

    With no path, opens DEFAULT_DB, first moving a store found at EARLIER_DB there."""
    default = path is None
    path = DEFAULT_DB if default else path
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, mode=0o700, exist_ok=True)
    os.chmod(d, 0o700)
    if default:
        move_earlier_store(DEFAULT_DB, EARLIER_DB)
    # Kept for the whole process: DuckDB creates the WAL and temp files later, and they hold transcript text too.
    os.umask(0o077)
    try:
        con = duckdb.connect(path)
    except duckdb.IOException as e:
        if "lock" in str(e).lower():
            raise StoreBusy(BUSY) from e
        raise
    os.chmod(path, 0o600)
    con.execute(RAW_SCHEMA)
    con.execute(DERIVED_SCHEMA)
    for table in ("files", "sessions"):  # stores from before sources hold only Claude Code's
        con.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'claude'")
    for old, new in PROJECT_ALIASES.items():  # names stored before the alias existed
        for table in ("projects_by_cwd", "sessions"):
            con.execute(f"UPDATE {table} SET project = ? WHERE project = ?", [new, old])
    return con


def insert(cur, table, cols, rows, tail="ON CONFLICT DO NOTHING", returning=None):
    """Multi-row insert; executemany is too slow in DuckDB. Returns the RETURNING values, if asked."""
    out = []
    if not rows:
        return out
    ph = "(" + ",".join("?" * len(cols)) + ")"
    step = max(1, 2000 // len(cols))
    for i in range(0, len(rows), step):
        chunk = rows[i:i + step]
        sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES {','.join([ph] * len(chunk))} {tail}"
        if returning:
            sql += f" RETURNING {returning}"
        cur.execute(sql, [v for r in chunk for v in r])
        if returning:
            out += [r[0] for r in cur.fetchall()]
    return out


def update_from(cur, table, key, cols, rows, where=""):
    """UPDATE table SET cols FROM (VALUES rows) matched on key; rows are (key, *cols)."""
    if not rows:
        return
    ph = "(" + ",".join("?" * (len(cols) + 1)) + ")"
    sets = ", ".join(f"{c} = v.{c}" for c in cols)
    step = max(1, 2000 // (len(cols) + 1))
    for i in range(0, len(rows), step):
        chunk = rows[i:i + step]
        cur.execute(f"UPDATE {table} SET {sets} FROM (VALUES {','.join([ph] * len(chunk))}) v(k, {','.join(cols)}) "
                    f"WHERE {table}.{key} = v.k {where}", [x for r in chunk for x in r])


# ---------- project identity ----------

TEMP_PREFIXES = ("/private/var/folders/", "/var/folders/", "/private/tmp/", "/tmp/")
# Repositories whose folder was renamed: sessions from the old folder belong to the new project.
PROJECT_ALIASES = {"claude-errors-dashboard": "ai-ledger"}


def resolve_project(cwd):
    name = project_of(cwd)
    return PROJECT_ALIASES.get(name, name)


def project_of(cwd):
    if not cwd:
        return "(unknown)"
    if cwd.startswith(TEMP_PREFIXES) or cwd.rstrip("/") in ("/tmp", "/private/tmp"):
        return "(temp)"
    if os.path.isdir(cwd):
        try:
            r = subprocess.run(["git", "-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
                               capture_output=True, text=True, timeout=2)
            common = r.stdout.strip().rstrip("/")
            if r.returncode == 0 and common:
                name = os.path.basename(common)
                if name.endswith(".git") and name != ".git":
                    return name[:-4]
                return os.path.basename(os.path.dirname(common))
        except (OSError, subprocess.TimeoutExpired):
            pass
    # Worktree layouts: <repo>/.claude/worktrees/<name>, <repo>/worktrees/<name>, and a tool's own
    # hidden dir such as ~/.t3/worktrees/<repo>/<name>.
    head, sep, tail = cwd.rstrip("/").partition("/worktrees/")
    if sep and head.endswith("/.claude"):
        head = head[:-len("/.claude")]
    elif sep and os.path.basename(head).startswith(".") and tail:
        return tail.split("/")[0]
    p = head if sep else cwd.rstrip("/")
    return os.path.basename(p) or p


class Projects:
    """Project per cwd, resolved once and cached in projects_by_cwd so it stays stable."""

    def __init__(self, cur):
        self.cache = dict(cur.execute("SELECT cwd, project FROM projects_by_cwd").fetchall())

    def get(self, cur, cwd):
        if cwd not in self.cache:
            self.cache[cwd] = resolve_project(cwd)
            insert(cur, "projects_by_cwd", ["cwd", "project"], [(cwd, self.cache[cwd])])
        return self.cache[cwd]


# ---------- raw ingest ----------

def line_key(d, path, offset):
    if isinstance(d, dict):
        t = d.get("type")
        if d.get("uuid"):
            return d["uuid"]
        if t == "api-request-blob" and d.get("hash"):
            return "blob:" + d["hash"]
        if t == "api-request-shape" and d.get("shapeHash"):
            return "shape:" + d["shapeHash"]
        if t == "api-request" and d.get("id"):
            return "req:" + d["id"]
    return f"{path}:{offset}"


def transcript_files(root):
    return sorted(glob.glob(os.path.join(root, "*", "*.jsonl"))
                  + glob.glob(os.path.join(root, "*", "*", "subagents", "*.jsonl")))


def ingest(con, root=DEFAULT_ROOT, log=None):
    """Read new bytes of every transcript file. One transaction per file."""
    t0 = time.time()
    cur = con.cursor()
    known = {r[0]: r[1:] for r in cur.execute("SELECT path, size, read_offset, lines, seq, mtime FROM files").fetchall()}
    projects = Projects(cur)
    stats = dict(files=0, lines=0, inserted=0)
    for path in transcript_files(root):
        try:
            st = os.stat(path)
        except OSError:
            continue
        size, offset, lines, seq, mtime = known.get(path, (0, 0, 0, 0, 0))
        if path in known and st.st_size == offset:
            continue
        if st.st_size < offset:  # rewritten or truncated: read again from the start; dedup drops repeats
            offset, lines = 0, 0
        with open(path, "rb") as fh:
            fh.seek(offset)
            data = fh.read(st.st_size - offset)
        end = data.rfind(b"\n") + 1
        if not end:
            continue
        n, ins = ingest_chunk(cur, projects, path, data[:end], offset, lines, seq, st)
        stats["files"] += 1
        stats["lines"] += n
        stats["inserted"] += ins
        if log:
            log(f"{path}: {n} lines, {ins} new")
    stats["seconds"] = round(time.time() - t0, 2)
    return stats


def ingest_chunk(cur, projects, path, data, offset, lines, seq, st):
    sub = "/subagents/" in path
    rows, parsed, seen = [], {}, set()
    pos = offset
    for raw in data.split(b"\n")[:-1]:
        text = raw.decode("utf-8", errors="replace")
        try:
            d = json.loads(text)
            ok = isinstance(d, dict)
        except ValueError:
            d, ok = None, False
        key = line_key(d, path, pos)
        if key not in seen:
            seen.add(key)
            dd = d if ok else {}
            rows.append((key, path, lines, pos, dd.get("type"), dd.get("sessionId"), dd.get("uuid"),
                         dd.get("timestamp"), sub, ok, text))
            if ok:
                parsed[key] = d
        lines += 1
        pos += len(raw) + 1
    cur.execute("BEGIN")
    try:
        new = set(insert(cur, "raw_lines", ["key", "file", "line_no", "byte_offset", "type", "session_id", "uuid",
                                            "ts", "subagent", "parsed", "json"], rows, returning="key"))
        der = Deriver(cur, projects, path, sub, seq)
        for r in rows:
            if r[0] in new and r[0] in parsed:
                der.add(parsed[r[0]])
        der.flush()
        insert(cur, "files", ["path", "size", "read_offset", "lines", "seq", "mtime", "last_ingest"],
               [(path, st.st_size, pos, lines, der.seq, st.st_mtime, datetime.now(timezone.utc).replace(tzinfo=None))],
               tail="ON CONFLICT (path) DO UPDATE SET size = excluded.size, read_offset = excluded.read_offset, "
                    "lines = excluded.lines, seq = excluded.seq, mtime = excluded.mtime, last_ingest = excluded.last_ingest")
        cur.execute("COMMIT")
    except BaseException:
        cur.execute("ROLLBACK")
        raise
    return len(rows), len(new)


# ---------- derived layer ----------

def ts_of(s):
    """Transcript ISO timestamp ('...Z') to a naive UTC value DuckDB casts to TIMESTAMP."""
    return s.replace("T", " ").rstrip("Z")[:26] if isinstance(s, str) and s else None


INTERRUPT = "[Request interrupted by user"


class Deriver:
    """Turns new transcript lines of one file into derived rows, then writes them in bulk."""

    def __init__(self, cur, projects, path, sub, seq):
        self.cur, self.projects, self.path, self.sub, self.seq = cur, projects, path, sub, seq
        self.sessions, self.requests, self.uses, self.results = {}, {}, {}, {}
        self.prompts, self.interrupted, self.hooks, self.followups = {}, set(), [], {}
        # Errors from earlier ingests of this file still waiting for Claude's next words.
        self.pending = dict(cur.execute(
            "SELECT tool_use_id, result_seq FROM tool_calls WHERE result_file = ? AND is_error AND followup IS NULL "
            "AND result_seq >= ?", [path, seq - 5]).fetchall())

    def session(self, d):
        sid = d.get("sessionId")
        if not sid:
            return None
        s = self.sessions.get(sid)
        if s is None:
            s = self.sessions[sid] = dict(cwd=None, git_branch=None, first=None, last=None, entrypoint=None,
                                          version=None, compactions=0, peak=0, peak_model=None)
        ts = ts_of(d.get("timestamp"))
        if ts:
            s["first"] = min(s["first"] or ts, ts)
            s["last"] = max(s["last"] or ts, ts)
        for k, src in (("cwd", "cwd"), ("git_branch", "gitBranch"), ("entrypoint", "entrypoint"), ("version", "version")):
            if not s[k] and d.get(src):
                s[k] = d[src]
        return s

    def add(self, d):
        s = self.session(d)
        t = d.get("type")
        sid, ts = d.get("sessionId"), ts_of(d.get("timestamp"))
        msg = d.get("message") if isinstance(d.get("message"), dict) else {}
        content = msg.get("content")
        if t == "assistant":
            self.seq += 1
            self.assistant(d, s, sid, ts, msg, content)
        elif t == "user":
            if isinstance(content, list) and any(isinstance(x, dict) and x.get("type") == "tool_result" for x in content):
                self.seq += 1
            self.user(d, sid, ts, content)
        elif t == "system" and d.get("subtype") == "compact_boundary" and s:
            s["compactions"] += 1
        elif t == "system" and d.get("subtype") == "stop_hook_summary":
            errs = bool(d.get("hookErrors"))
            for h in d.get("hookInfos") or []:
                # Claude Code does not say which hook produced an error; one without a duration did not finish.
                self.hooks.append((sid, ts, "stop_summary", "Stop", h.get("command"), h.get("durationMs"),
                                   errs and h.get("durationMs") is None))
        elif t == "attachment" and isinstance(d.get("attachment"), dict):
            a = d["attachment"]
            at = a.get("type") or ""
            if at in ("hook_success", "hook_non_blocking_error", "hook_blocking_error", "hook_cancelled"):
                self.hooks.append((sid, ts, "attachment", a.get("hookName"), a.get("command"), a.get("durationMs"),
                                   at != "hook_success"))

    def assistant(self, d, s, sid, ts, msg, content):
        mid = msg.get("id")
        model = msg.get("model")
        if mid and mid not in self.requests and model and model != "<synthetic>":
            u = msg.get("usage") or {}
            cw = u.get("cache_creation_input_tokens") or 0
            cc = u.get("cache_creation") or {}
            c1h = cc.get("ephemeral_1h_input_tokens") or 0
            c5m = cc.get("ephemeral_5m_input_tokens") if "ephemeral_5m_input_tokens" in cc else cw - c1h
            inp, cr = u.get("input_tokens") or 0, u.get("cache_read_input_tokens") or 0
            sub = self.sub or bool(d.get("isSidechain"))
            self.requests[mid] = (mid, sid, ts, model, d.get("effort"), sub, inp, u.get("output_tokens") or 0,
                                  (u.get("output_tokens_details") or {}).get("thinking_tokens") or 0, cr, c5m or 0, c1h,
                                  d.get("thinkingDurationMs"), msg.get("stop_reason"))
            if s and not sub and inp + cr + cw > s["peak"]:
                s["peak"], s["peak_model"] = inp + cr + cw, model
        if not isinstance(content, list):
            return
        for x in content:
            if not isinstance(x, dict):
                continue
            if x.get("type") == "tool_use" and x.get("id") and x["id"] not in self.uses:
                name, inp = x.get("name") or "?", x.get("input")
                summary = summarize_input(name, inp)
                bash = name == "Bash"
                self.uses[x["id"]] = dict(
                    session_id=sid, tool=name, mcp_server=name[5:].rsplit("__", 1)[0] if name.startswith("mcp__") else None,
                    skill=inp.get("skill") if name == "Skill" and isinstance(inp, dict) else None,
                    input_summary=summary, start_ts=ts, subagent=self.sub or bool(d.get("isSidechain")),
                    is_commit=bash and GIT_COMMIT.search(summary) is not None,
                    is_test=bash and TEST_CMD.search(summary) is not None)
            elif x.get("type") in ("text", "thinking"):
                said = ((x.get("text") if x.get("type") == "text" else x.get("thinking")) or "").strip()
                if said:
                    self.followup(said[:500])

    def followup(self, said):
        """Claude's first words after an error, within the next five tool rows: usually its diagnosis."""
        for tid, rseq in list(self.pending.items()):
            if self.seq - rseq <= 5:
                self.followups[tid] = said
            del self.pending[tid]

    def user(self, d, sid, ts, content):
        pid = d.get("promptId")
        text = content if isinstance(content, str) else "\n".join(
            x.get("text") or "" for x in content if isinstance(x, dict) and x.get("type") == "text") if isinstance(content, list) else ""
        if INTERRUPT in text and pid:
            self.interrupted.add(pid)
        if isinstance(content, list):
            for x in content:
                if isinstance(x, dict) and x.get("type") == "tool_result" and x.get("tool_use_id") and x["tool_use_id"] not in self.results:
                    err = bool(x.get("is_error"))
                    self.results[x["tool_use_id"]] = dict(end_ts=ts, is_error=err,
                                                         error=error_text(x.get("content")) if err else None,
                                                         prompt_id=pid, session_id=sid, seq=self.seq,
                                                         sub=self.sub or bool(d.get("isSidechain")))
                    if err:
                        self.pending[x["tool_use_id"]] = self.seq
        origin = (d.get("origin") or {}).get("kind") if isinstance(d.get("origin"), dict) else None
        human = (pid and not d.get("isMeta") and not d.get("isSidechain") and origin in (None, "human")
                 and text.strip() and not text.lstrip().startswith(INTERRUPT)
                 and not any(isinstance(x, dict) and x.get("type") == "tool_result" for x in (content if isinstance(content, list) else [])))
        if human and pid not in self.prompts:
            self.prompts[pid] = (pid, sid, ts, False)

    def flush(self):
        cur = self.cur
        srows = []
        for sid, s in self.sessions.items():
            proj = self.projects.get(cur, s["cwd"]) if s["cwd"] else None
            srows.append((sid, proj, s["cwd"], s["git_branch"], s["first"], s["last"], s["entrypoint"], s["version"],
                          s["compactions"], s["peak"], s["peak_model"]))
        insert(cur, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint",
                                 "version", "compactions", "peak_context", "peak_model"], srows,
               tail="ON CONFLICT (session_id) DO UPDATE SET project = coalesce(sessions.project, excluded.project), "
                    "cwd = coalesce(sessions.cwd, excluded.cwd), git_branch = coalesce(sessions.git_branch, excluded.git_branch), "
                    "first_ts = least(sessions.first_ts, excluded.first_ts), last_ts = greatest(sessions.last_ts, excluded.last_ts), "
                    "entrypoint = coalesce(sessions.entrypoint, excluded.entrypoint), version = coalesce(sessions.version, excluded.version), "
                    "compactions = sessions.compactions + excluded.compactions, "
                    "peak_model = CASE WHEN excluded.peak_context > sessions.peak_context THEN excluded.peak_model ELSE sessions.peak_model END, "
                    "peak_context = greatest(sessions.peak_context, excluded.peak_context)")
        insert(cur, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output",
                                 "thinking", "cache_read", "cache_5m", "cache_1h", "thinking_ms", "stop_reason"],
               list(self.requests.values()))
        self.flush_tools()
        insert(cur, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], list(self.prompts.values()))
        if self.interrupted:
            update_from(cur, "prompts", "prompt_id", ["interrupted"], [(p, True) for p in self.interrupted])
        insert(cur, "hooks", ["session_id", "ts", "source", "hook", "command", "duration_ms", "is_error"], self.hooks, tail="")
        # Errors still open stay in self.pending; the next ingest reloads them from tool_calls.
        update_from(cur, "tool_calls", "tool_use_id", ["followup"], list(self.followups.items()), where="AND tool_calls.followup IS NULL")

    def flush_tools(self):
        cur = self.cur
        orphans = [tid for tid in self.results if tid not in self.uses]
        earlier = {}
        for i in range(0, len(orphans), 1000):
            ids = orphans[i:i + 1000]
            earlier.update({r[0]: r[1:] for r in cur.execute(
                f"SELECT tool_use_id, tool, input_summary, end_ts IS NOT NULL FROM tool_calls WHERE tool_use_id IN ({','.join('?' * len(ids))})", ids).fetchall()})
        cols = ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts", "is_error",
                "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed", "result_file", "result_seq"]
        new, done = [], []
        denied = set()
        for tid, u in self.uses.items():
            r = self.results.get(tid)
            new.append(self.tool_row(tid, u, r, u["tool"], u["input_summary"], denied))
        for tid in orphans:
            r = self.results[tid]
            if tid in earlier:
                tool, summary, has_result = earlier[tid]
                if not has_result:
                    row = self.tool_row(tid, None, r, tool, summary, denied)
                    done.append((tid,) + row[7:12] + row[15:])
            else:
                new.append(self.tool_row(tid, dict(session_id=r["session_id"], tool="?", mcp_server=None, skill=None,
                                                   input_summary="", start_ts=None, subagent=r["sub"], is_commit=False,
                                                   is_test=False), r, "?", "", denied))
        insert(cur, "tool_calls", cols, new)
        update_from(cur, "tool_calls", "tool_use_id", cols[7:12] + cols[15:], done, where="AND tool_calls.end_ts IS NULL")
        self.interrupted |= denied

    def tool_row(self, tid, u, r, tool, summary, denied):
        u = u or {}
        cat = categorize(r["error"], tool, summary) if r and r["is_error"] else None
        if cat == "user_denied" and r["prompt_id"]:
            denied.add(r["prompt_id"])
        return (tid, u.get("session_id"), u.get("tool"), u.get("mcp_server"), u.get("skill"), u.get("input_summary"),
                u.get("start_ts"), r and r["end_ts"], r and r["is_error"], r and r["error"] and r["error"][:700], cat,
                None, u.get("subagent"), u.get("is_commit"), u.get("is_test"),
                None if not r else not r["is_error"], self.path if r else None,
                r and r["seq"])


def rebuild(con, log=None):
    """Drop the derived tables and replay them from raw_lines, file by file in byte order."""
    t0 = time.time()
    cur = con.cursor()
    for t in DERIVED:
        cur.execute(f"DROP TABLE IF EXISTS {t}")
    cur.execute(DERIVED_SCHEMA)
    projects = Projects(cur)
    files = [r[0] for r in cur.execute("SELECT DISTINCT file FROM raw_lines ORDER BY file").fetchall()]
    for path in files:
        cur.execute("BEGIN")
        try:
            der = Deriver(cur, projects, path, "/subagents/" in path, 0)
            for (text,) in cur.execute("SELECT json FROM raw_lines WHERE file = ? AND parsed ORDER BY byte_offset", [path]).fetchall():
                der.add(json.loads(text))
            der.flush()
            cur.execute("UPDATE files SET seq = ? WHERE path = ?", [der.seq, path])
            cur.execute("COMMIT")
        except BaseException:
            cur.execute("ROLLBACK")
            raise
        if log:
            log(path)
    return dict(files=len(files), seconds=round(time.time() - t0, 2))
