"""Codex CLI transcripts (~/.codex): where they are, how their lines are keyed, and the parser that derives them.

Codex writes one rollout file per thread: sessions/YYYY/MM/DD/rollout-<time>-<thread>.jsonl, compressed to .jsonl.zst
once the thread is old, and moved to archived_sessions/ when archived. A file named <session>_<thread> continues
session <session> in another thread. Every line has timestamp, ordinal, type and payload. A thread's usage is in its
token_usage_record lines, its tools and prompts in event_msg / item_completed lines. CLIs before 0.153 write no
token_usage_record; their usage comes from the token_count events instead.
"""
import glob
import json
import os
import re
from datetime import datetime, timedelta
from functools import lru_cache

from compression import zstd

import store
from categorize import GIT_COMMIT, SHELL_TOOLS, TEST_CMD, summarize_input, text_of

UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
FILE_NAME = re.compile(rf"({UUID})(?:_({UUID}))?\.jsonl(?:\.zst)?$")
# User messages the CLI writes itself: <environment_context>, <heartbeat>, <realtime_delegation>, AGENTS.md, ...
INJECTED = ("<", "# AGENTS.md")


@lru_cache(maxsize=4096)
def ids(path):
    """(session, thread) named by a rollout file, or (None, None)."""
    m = FILE_NAME.search(os.path.basename(path))
    return (m.group(1), m.group(2) or m.group(1)) if m else (None, None)


def files(root):
    return sorted(p for pattern in ("sessions/**/rollout-*.jsonl", "sessions/**/rollout-*.jsonl.zst",
                                    "archived_sessions/rollout-*.jsonl", "archived_sessions/rollout-*.jsonl.zst")
                  for p in glob.glob(os.path.join(root, pattern), recursive=True))


def key(d, path, offset):
    """codex:<thread>:<ordinal>: the same for a live file and its compressed or archived copy."""
    thread = ids(path)[1]
    if thread and isinstance(d, dict) and isinstance(d.get("ordinal"), int):
        return f"codex:{thread}:{d['ordinal']}"
    return f"{path}:{offset}"


def subagent(path):
    session, thread = ids(path)
    return session != thread


def fields(d, path):
    return ids(path)[0], None, d.get("timestamp")


def read(path, offset, size):
    """A .zst file whole and decompressed (it is written once), a plain file from offset."""
    if not path.endswith(".zst"):
        return store.read_from(path, offset, size)
    with open(path, "rb") as fh:
        return zstd.decompress(fh.read()), True


def typed(it):
    """The text of a UserMessage item the person typed, or None for one the CLI injected."""
    text = text_of(it.get("content")).strip() if isinstance(it, dict) and it.get("type") == "UserMessage" else ""
    return text if text and not text.startswith(INJECTED) else None


def prompt_text(d, pid):
    """The text of prompt pid (a turn id) if line d is that turn's typed UserMessage, else None."""
    p = d.get("payload") if isinstance(d.get("payload"), dict) else {}
    return typed(p.get("item")) if p.get("type") == "item_completed" and p.get("turn_id") == pid else None


def before(ts, seconds):
    """ts (as ts_of returns it) minus seconds."""
    if not ts or not seconds:
        return ts
    return (datetime.fromisoformat(ts) - timedelta(seconds=seconds)).isoformat(" ")


def seconds_of(d):
    return (d.get("secs") or 0) + (d.get("nanos") or 0) / 1e9 if isinstance(d, dict) else 0


def tool_of(item):
    """(tool name, input summary) of a completed item, or None when the item is not a tool call."""
    t = item.get("type")
    if t == "McpToolCall":
        name = f"mcp__{item.get('server')}__{item.get('tool')}"
        return name, summarize_input(name, item.get("arguments"))
    if t == "CommandExecution":
        cmd = item.get("command")
        if isinstance(cmd, list):  # [shell, "-lc", script] runs the script
            cmd = cmd[-1] if len(cmd) == 3 and cmd[1] in ("-c", "-lc") else " ".join(map(str, cmd))
        return "exec_command", cmd if isinstance(cmd, str) else ""
    if t == "FileChange":
        return "apply_patch", ", ".join(item.get("changes") or {})
    if t == "WebSearch" or (t == "Extension" and item.get("kind") == "web.search"):
        action = item.get("action") if isinstance(item.get("action"), dict) else {}
        return "web_search", item.get("query") or " | ".join(action.get("queries") or [])
    return None


def error_of(item):
    """The error text of a failed item, in Claude Code's shape for shell commands: Exit code N, then the output."""
    if item.get("type") == "CommandExecution":
        out = (item.get("aggregated_output") or item.get("stderr") or "").rstrip()
        code = item.get("exit_code")
        return "\n".join(x for x in (f"Exit code {code}" if code is not None else "", out) if x)
    result = item.get("result") if isinstance(item.get("result"), dict) else {}
    err = item.get("error")
    text = text_of(result.get("content")) or (err.get("message") if isinstance(err, dict) else err) or item.get("stderr")
    return (text if isinstance(text, str) else json.dumps(text)).strip()


class CodexDeriver(store.Deriver):
    """Turns new lines of one Codex rollout file into derived rows. Deriver.flush writes them.

    An incremental chunk can start after its thread's session_meta or a turn's turn_context; those are then read back
    from raw_lines, which already holds the chunk."""

    def __init__(self, *args):
        super().__init__(*args)
        self.sid, self.thread = ids(self.path)
        self.started = False  # the thread's own (first) session_meta was read
        self.turns, self.turn, self.turns_loaded = {}, None, False  # turn_id -> (model, effort); the latest turn
        self.records = None  # whether the thread has token_usage_record lines; None until asked

    def thread_lines(self, t, limit=None):
        """This thread's stored lines of type t, from any of its files, in ordinal order."""
        return sorted((json.loads(r[0]) for r in self.cur.execute(
            "SELECT json FROM raw_lines WHERE starts_with(key, ?) AND type = ? AND parsed LIMIT ?",
            [f"codex:{self.thread}:", t, limit]).fetchall()), key=lambda d: d.get("ordinal") or 0)

    def start(self, d):
        """The thread's session from its own session_meta. A thread another thread spawned is subagent work."""
        self.started = True
        p = d["payload"]
        self.sid = p.get("session_id") or p.get("id") or self.sid
        self.sub = self.sub or self.sid != self.thread
        self.session(dict(sessionId=self.sid, timestamp=d.get("timestamp"), cwd=p.get("cwd"),
                          gitBranch=(p.get("git") or {}).get("branch"), entrypoint=p.get("originator"),
                          version=p.get("cli_version")))

    def turn_of(self, turn):
        if turn not in self.turns and not self.turns_loaded:
            self.turns_loaded = True
            for d in self.thread_lines("turn_context"):
                self.context(d["payload"], latest=False)
        return self.turns.get(turn) or self.turns.get(self.turn) or (None, None)

    def context(self, p, latest=True):
        settings = (p.get("collaboration_mode") or {}).get("settings") or {}
        if p.get("turn_id") not in self.turns or latest:
            self.turns[p.get("turn_id")] = (p.get("model") or settings.get("model"),
                                            settings.get("reasoning_effort") or p.get("effort"))
        if latest:
            self.turn = p.get("turn_id")

    def add(self, d):
        t, p = d.get("type"), d.get("payload")
        if not isinstance(p, dict):
            return
        if t == "session_meta":
            if not self.started:
                self.start(d)
            return
        if not self.started:
            metas = self.thread_lines("session_meta")
            if metas:
                self.start(metas[0])
            self.started = True
        s = self.session(dict(sessionId=self.sid, timestamp=d.get("timestamp")))
        ts = store.ts_of(d.get("timestamp"))
        if t == "turn_context":
            self.context(p)
        elif t == "token_usage_record":
            self.records = True
            self.request(p.get("response_id"), p.get("turn_id"), p.get("usage"), s, ts)
        elif t == "compacted" and s:
            s["compactions"] += 1
        elif t == "event_msg" and p.get("type") == "token_count":
            self.token_count(p, s, ts)
        elif t == "event_msg" and p.get("type") == "item_completed" and isinstance(p.get("item"), dict):
            self.item(p, p["item"], ts)
        elif t == "event_msg" and p.get("type") == "turn_aborted" and p.get("reason") == "interrupted" and p.get("turn_id"):
            self.interrupted.add(p["turn_id"])

    def request(self, mid, turn, u, s, ts):
        """One response's usage. input_tokens includes the cached input and the cache writes."""
        if not mid or mid in self.requests or not isinstance(u, dict):
            return
        model, effort = self.turn_of(turn)
        inp, cr, cw = u.get("input_tokens") or 0, u.get("cached_input_tokens") or 0, u.get("cache_write_input_tokens") or 0
        self.requests[mid] = (mid, self.sid, ts, model, effort, self.sub, inp - cr - cw, u.get("output_tokens") or 0,
                              u.get("reasoning_output_tokens") or 0, cr, cw, 0, None, None)
        if s and not self.sub and inp > s["peak"]:
            s["peak"], s["peak_model"] = inp, model

    def token_count(self, p, s, ts):
        """A running total. It repeats a token_usage_record, so it counts only in a thread that has none (CLI < 0.153).
        Its last_token_usage is then the response's usage; a repeated total is the same response again."""
        info = p.get("info") if isinstance(p.get("info"), dict) else {}
        total = (info.get("total_token_usage") or {}).get("total_tokens")
        if total is None or not isinstance(info.get("last_token_usage"), dict):
            return
        if self.records is None:
            self.records = bool(self.thread_lines("token_usage_record", 1))
        if not self.records:
            self.request(f"codex:{self.thread}:total:{total}", self.turn, info["last_token_usage"], s, ts)

    def item(self, p, it, ts):
        t = it.get("type")
        if t == "UserMessage":
            turn = p.get("turn_id")
            if turn and typed(it) and turn not in self.prompts:
                self.prompts[turn] = (turn, self.sid, ts, False)
        elif t == "AgentMessage":
            said = text_of(it.get("content")).strip()
            if said:
                self.seq += 1
                self.followup(said[:500])
        elif it.get("id") and it["id"] not in self.uses and tool_of(it):
            tid, (name, summary) = it["id"], tool_of(it)
            failed = it.get("status") == "failed"
            shell = name in SHELL_TOOLS
            self.seq += 1
            self.uses[tid] = dict(session_id=self.sid, tool=name, mcp_server=it.get("server") if t == "McpToolCall" else None,
                                  skill=None, input_summary=summary, start_ts=before(ts, seconds_of(it.get("duration"))),
                                  subagent=self.sub, is_commit=shell and GIT_COMMIT.search(summary) is not None,
                                  is_test=shell and TEST_CMD.search(summary) is not None)
            self.results[tid] = dict(end_ts=ts, is_error=failed, error=error_of(it) if failed else None,
                                     prompt_id=p.get("turn_id"), session_id=self.sid, seq=self.seq, sub=self.sub)
            if failed:
                self.pending[tid] = self.seq
