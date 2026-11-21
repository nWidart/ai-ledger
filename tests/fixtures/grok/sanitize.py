"""Build the Grok fixtures from real Grok CLI 1.0.92 session logs.

Run from the repo root, naming each source log by role (never commit the paths):

    uv run python tests/fixtures/grok/sanitize.py \
        --src probe_parent=<sessions>/<cwd>/<id>/updates.jsonl \
        --src probe_child=... --src long=... --src compaction=... \
        --src cancelled=... --src mcp=... --src grep=...

Roles:
- probe_parent, probe_child: the task 2.1 probe (a turn that spawns a subagent, runs a
  failing `ls`, a `git commit` and a failing MCP call; then a resumed turn killed with SIGINT
  while `sleep 60` runs).
- long: a one-turn session with many model calls.
- compaction: a one-turn session with an automatic compaction.
- cancelled: a one-turn session whose turn ended with stop_reason `cancelled`.
- mcp: a session with `use_tool` calls that failed with `is_error`.
- grep: a session with a `grep` call marked `failed`.

The script keeps the JSON structure, every key, number and boolean, and enum-like strings.
It replaces every other string with a neutral value, consistently within a label: ids map
to neutral UUID-like ids (order kept, so a child still sorts after its parent), paths to
/work/app/..., commands to fixed harmless commands, MCP names to srv_a__tool_a, hook names
to hook-N, any other text to "text N". Byte arrays of shell and grep output are rebuilt from
the neutral text.

A turn cut to fewer model calls gets its `turn_completed` usage rewritten from the kept calls
(see `fit_usage`): inputTokens is the sum of each kept call's first totalTokens, the cached
share and the output per call follow the real turn's ratios, cost uses the flat rates
($2 input, $0.50 cached, $6 output per million: 20,000 / 5,000 / 60,000 ticks per token).
modelCalls and numTurns are the number of kept calls, minus one when the real turn wrote one
more streamStartMs than its count (the cancelled turn). The figures chosen for `long-turn`
are printed when the script runs and listed in README.md.
"""
import argparse
import json
import os
import re
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
CWD = "/work/app"

# label -> list of sessions -> list of segments (role, inclusive line ranges or "all", fit usage)
RECIPES = {
    "probe": [
        [dict(src="probe_parent", lines="all")],
        [dict(src="probe_child", lines="all")],
    ],
    "long-turn": [
        # calls 0-3 and the final answer call: five model calls
        [dict(src="long", lines=[(0, 29), (268, 273)], fit=True)],
    ],
    "compaction": [
        # first call, the call that reaches 204,942 tokens, the compaction, the next call, the last call
        [dict(src="compaction", lines=[(0, 10), (525, 556), (1016, 1021)], fit=True)],
    ],
    "cancelled": [
        [dict(src="cancelled", lines=[(0, 25), (474, 482)], fit=True)],
    ],
    "tools": [
        # one session of four turns, each moved in time after the previous one
        [
            dict(src="grep", lines=[(0, 3), (134, 149), (368, 373)], fit=True),
            dict(src="mcp", lines=[(0, 3), (369, 390), (580, 585)], fit=True),
            dict(src="probe_parent", lines=[(0, 1), (22, 36)], fit=True),
            dict(src="probe_parent", lines=[(39, 55)]),
        ],
    ],
}

KEEP = {
    "sessionUpdate", "method", "status", "stop_reason", "event_name", "kind", "type", "subagent_type",
    "updateType", "variant", "label", "namespace", "effective_context_source", "model", "modelId",
    "cancelTrigger", "cancellationCategory", "signal", "outcome", "failure", "mode", "task_type",
    "mimeType", "mime_type", "background_reason",
}
DIRS = {"current_dir", "cwd", "absolute_root_path", "directory", "target_directory"}
PATHS = {"absolute_path", "path", "file_path", "target_file", "output_file", "checkpoint_file"}
IDS = {"sessionId", "child_session_id", "parent_session_id", "owner_session_id", "subagent_id",
       "attempt_id", "resume_from_hint", "checkpoint_id", "promptId", "prompt_id", "parent_prompt_id"}
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
ENUM = re.compile(r"[A-Za-z0-9_.:@/ -]{1,30}")
SHELL_FAIL_TEXT = "ls: cannot access 'missing-dir': No such file or directory\n"


class Mapper:
    def __init__(self, label_no, session_ids):
        self.label_no = label_no
        self.maps = {}
        for sid in sorted(session_ids):
            self.uuid(sid)

    def get(self, kind, value, make):
        m = self.maps.setdefault(kind, {})
        if value not in m:
            m[value] = make(len(m) + 1)
        return m[value]

    def uuid(self, value):
        return self.get("uuid", value, lambda n: f"0a1f{self.label_no:04d}-0000-7000-8000-{n:012d}")

    def prompt_id(self, value):
        if UUID.fullmatch(value):
            return self.uuid(value)
        return self.get("prompt", value, lambda n: f"prompt-{self.label_no:02d}{n:06d}")

    def text(self, value):
        return self.get("text", value, lambda n: f"text {n}")

    def path(self, value):
        return self.get("path", value, lambda n: f"{CWD}/file-{n}.py")

    def hook(self, value):
        return self.get("hook", value, lambda n: f"hook-{n}")

    def server(self, value):
        return self.get("server", value, lambda n: "srv_" + "abcdefgh"[n - 1])

    def mcp_tool(self, value):
        return self.get("mcp_tool", value, lambda n: "tool_" + "abcdefgh"[n - 1])

    def tool_name(self, value):
        if "__" not in value:
            return value
        server, tool = value.split("__", 1)
        return f"{self.server(server)}__{self.mcp_tool(tool)}"

    def command(self, value, failing):
        if value in failing:
            return "ls missing-dir"
        if "git commit" in value:
            return "git commit -m x"
        if value.startswith("sleep "):
            return "sleep 60"
        return self.get("command", value, lambda n: f"echo step-{n}")

    def call_id(self, value):
        n = value.rsplit("-", 1)[1] if UUID.search(value) else "1"
        return self.get("call", value, lambda k: f"c0de-{self.uuid('call:' + value)}-{n}")


def sanitize(v, m, failing, key=None, parent=None):
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            out[k] = sanitize(x, m, failing, k, v)
        return out
    if isinstance(v, list):
        if key == "runs":
            return [dict(r, name=m.hook(r["name"])) | {"status": sanitize(r["status"], m, failing, "status")} for r in v]
        return [sanitize(x, m, failing, key, parent) for x in v]
    if not isinstance(v, str) or v == "":
        return v
    if key in KEEP and ENUM.fullmatch(v):
        return v
    if key == "name" and parent is not None and "namespace" in parent:
        return v
    if key == "tool_name":
        if parent is not None and "server_name" in parent:
            return m.mcp_tool(v)
        return m.tool_name(v)
    if key == "server_name":
        return m.server(v)
    if key in IDS:
        return m.prompt_id(v) if "rompt" in key else m.uuid(v)
    if key in ("toolCallId", "tool_call_id"):
        return m.call_id(v)
    if key == "command":
        return m.command(v, failing)
    if key in DIRS:
        return CWD
    if key in PATHS:
        return m.path(v)
    if key == "data":
        return "aW1hZ2U="
    if UUID.fullmatch(v):
        return m.uuid(v)
    return m.text(v)


def fix_outputs(update):
    """Rebuild byte arrays and failing shell text from the neutral strings."""
    ro = update.get("rawOutput")
    if not isinstance(ro, dict):
        return
    if ro.get("type") == "Bash":
        if ro.get("exit_code") not in (None, 0):
            ro["output_for_prompt"] = SHELL_FAIL_TEXT
            for c in update.get("content") or []:
                if c.get("type") == "content":
                    c["content"]["text"] = SHELL_FAIL_TEXT
        text = ro.get("output_for_prompt") or ""
        if isinstance(ro.get("output"), list):
            ro["output"] = list(text.encode())
            ro["total_bytes"] = len(ro["output"])
    if ro.get("type") == "GrepSearch":
        texts = [c["content"]["text"] for c in update.get("content") or [] if c.get("type") == "content"]
        for k in ("stdout", "stderr"):
            if ro.get(k):
                ro[k] = list(("\n".join(texts) or "text").encode())


def fit_usage(lines, turn, src_lines):
    """Rewrite a cut turn's usage from its kept calls."""
    u = turn["params"]["update"]
    pid = u["prompt_id"]

    def calls(ls):
        first = {}
        for d in sorted(ls, key=lambda d: d["params"]["_meta"]["agentTimestampMs"]):
            meta = d["params"]["_meta"]
            if meta.get("promptId") == pid and "streamStartMs" in meta:
                first.setdefault(meta["streamStartMs"], meta.get("totalTokens") or 0)
        return first

    kept, real = calls(lines), calls(src_lines)
    old = u["usage"]
    model_calls = len(kept) + min(0, old["modelCalls"] - len(real))
    f = model_calls / old["modelCalls"]
    inp = sum(kept.values())
    cached = round(inp * old["cachedReadTokens"] / old["inputTokens"])
    out = round(old["outputTokens"] * f)
    reasoning = min(out, round(old["reasoningTokens"] * f))
    new = dict(old, inputTokens=inp, cachedReadTokens=cached, cacheCreationTokens=0, outputTokens=out,
               reasoningTokens=reasoning, totalTokens=inp + out, modelCalls=model_calls,
               apiDurationMs=round(old["apiDurationMs"] * f),
               costUsdTicks=(inp - cached) * 20000 + cached * 5000 + out * 60000,
               numTurns=len(kept) + min(0, old["numTurns"] - len(real)))
    per_model = {k: v for k, v in new.items() if k not in ("modelUsage", "numTurns")}
    new["modelUsage"] = {model: dict(per_model) for model in old["modelUsage"]}
    u["usage"] = new
    return new


def pick(src_lines, ranges):
    if ranges == "all":
        return list(src_lines)
    return [src_lines[i] for a, b in ranges for i in range(a, b + 1)]


def shift(d, delta_ms):
    d["timestamp"] += delta_ms // 1000
    if "timestamp_us" in d:
        d["timestamp_us"] += delta_ms * 1000
    meta = d["params"]["_meta"]
    for k in ("agentTimestampMs", "streamStartMs", "turnStartMs"):
        if k in meta:
            meta[k] += delta_ms


def build(label_no, label, sessions, sources, out_root):
    # sessions of a label: the first segment's source decides the neutral id
    m = Mapper(label_no, [sources[segs[0]["src"]][0]["params"]["sessionId"] for segs in sessions])
    neutral_session = [m.uuid(sources[segs[0]["src"]][0]["params"]["sessionId"]) for segs in sessions]
    failing = set()
    for src in {seg["src"] for segs in sessions for seg in segs}:
        for d in sources[src]:
            ro = d["params"]["update"].get("rawOutput") or {}
            if ro.get("type") == "Bash" and ro.get("exit_code") not in (None, 0):
                failing.add(ro.get("command"))
    report = []
    for i, segs in enumerate(sessions):
        target = neutral_session[i]
        rows, last_ms = [], None
        for k, seg in enumerate(segs):
            src_lines = sources[seg["src"]]
            kept = json.loads(json.dumps(pick(src_lines, seg["lines"])))
            if seg.get("fit"):
                for d in kept:
                    if d["params"]["update"].get("sessionUpdate") == "turn_completed":
                        report.append(fit_usage(kept, d, src_lines))
            if last_ms is not None:
                first = min(d["params"]["_meta"]["agentTimestampMs"] for d in kept)
                delta = last_ms + 60000 - first
                for d in kept:
                    shift(d, delta)
            last_ms = max(d["params"]["_meta"]["agentTimestampMs"] for d in kept)
            for d in kept:
                p = d["params"]
                n = int(p["_meta"]["eventId"].rsplit("-", 1)[1]) + (100000 * k if len(segs) > 1 else 0)
                s = sanitize(d, m, failing)
                s["params"]["sessionId"] = target
                s["params"]["_meta"]["eventId"] = f"{target}-{n}"
                up = s["params"]["update"]
                if len(segs) > 1 and up.get("sessionUpdate") == "user_message_chunk":
                    up["_meta"]["promptIndex"] = k
                fix_outputs(up)
                rows.append(s)
        folder = os.path.join(out_root, label, "sessions", urllib.parse.quote(CWD, safe=""), target)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "updates.jsonl"), "w") as fh:
            for r in rows:
                fh.write(json.dumps(r, separators=(",", ":")) + "\n")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", action="append", required=True, help="role=path to updates.jsonl")
    ap.add_argument("--out", default=HERE)
    args = ap.parse_args()
    sources = {}
    for spec in args.src:
        role, path = spec.split("=", 1)
        with open(path) as fh:
            sources[role] = [json.loads(x) for x in fh]
    for no, (label, sessions) in enumerate(RECIPES.items(), 1):
        if all(seg["src"] in sources for segs in sessions for seg in segs):
            for usage in build(no, label, sessions, sources, args.out):
                print(label, {k: v for k, v in usage.items() if k != "modelUsage"})
        else:
            print(label, "skipped: missing source")


if __name__ == "__main__":
    main()
