#!/usr/bin/env python3
"""Scan Claude Code transcripts for failed tool calls and build an error dashboard.

Usage: python3 build_dashboard.py [--projects ~/.claude/projects] [--out claude-errors.html]

Re-run any time; the dashboard is regenerated from scratch so trends stay current.
"""
import argparse
import collections
import glob
import json
import os
import re
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))

# First matching rule wins. Each rule: id, label, test(err, tool, cmd) -> bool, why, fix, snippet.
RULES = [
    dict(id="worktree", label="Path outside isolated worktree",
         test=lambda e, t, c: "isolated in the worktree" in e,
         why="Claude ran inside a worktree but touched a path in the main checkout (or another repo).",
         fix="Use paths relative to the worktree root, or the worktree's absolute path. Give subagents the worktree path in their brief, never the main checkout path.",
         snippet="- When working in a git worktree, only use paths inside that worktree. Never cd to or edit the main checkout."),
    dict(id="sleep_poll", label="Sleep-then-poll blocked",
         test=lambda e, t, c: e.startswith("Blocked: sleep"),
         why="Claude tried to wait with `sleep N; cat output` instead of letting background work notify it.",
         fix="Run long work with run_in_background and wait for the notification, or use Monitor with an until-condition.",
         snippet="- Never sleep-poll. Use run_in_background and wait for the completion notice."),
    dict(id="ls_alias", label="ls aliased to eza",
         test=lambda e, t, c: "--icons [<WHEN>]" in e,
         why="Your shell aliases ls to eza with --icons, which swallows the next argument as its value.",
         fix="Make the alias interactive-only in ~/.zshrc (`[[ -o interactive ]] && alias ls='eza --icons'`), or have Claude use `command ls`.",
         snippet="- `ls` is aliased to eza; use `command ls` in shell commands."),
    dict(id="cli_flags", label="Wrong CLI flags (BSD vs GNU, gh)",
         test=lambda e, t, c: any(s in e for s in ("specify only one of", "unknown flag", "illegal option", "invalid option", "unrecognized option", "bad flag in substitute", "extra characters at the end", "invalid command code")),
         why="Claude used GNU syntax on macOS BSD tools (sed -i, date, stat) or invalid gh flag combos.",
         fix="Note in CLAUDE.md that the machine is macOS with BSD tools (sed -i '' …), or install GNU coreutils/gnu-sed.",
         snippet="- macOS: BSD sed/date/stat. Use sed -i '' and check `gh <cmd> --help` for flag combos."),
    dict(id="zsh_glob", label="zsh glob had no matches",
         test=lambda e, t, c: "no matches found" in e,
         why="zsh aborts the whole command when an unquoted glob matches nothing (bash would pass it through).",
         fix="Quote glob patterns passed to find/grep/rg, or use `find`/Glob instead of shell globs. Optionally add `setopt nonomatch` to ~/.zshenv.",
         snippet="- The shell is zsh: quote glob patterns (e.g. find . -name '*.ts'); unmatched globs abort the command."),
    dict(id="cmd_not_found", label="Command not found",
         test=lambda e, t, c: "command not found" in e or "not found in PATH" in e,
         why="Claude assumed a CLI was installed or on PATH.",
         fix="List the project's available tooling in CLAUDE.md (e.g. pnpm vs npm, python3 vs python). Check with `command -v` before relying on a tool.",
         snippet="- Available CLIs: <list them>. Use python3 (not python). Check `command -v X` before using an unfamiliar tool."),
    dict(id="no_file", label="File or directory not found",
         test=lambda e, t, c: "No such file or directory" in e or "File does not exist" in e or "does not exist" in e[:200],
         why="Claude guessed a path instead of looking it up first.",
         fix="Locate files with Glob/ls before reading. Keep a short map of key directories in CLAUDE.md.",
         snippet="- Do not guess file paths: list or glob first. Key dirs: <src/…, tests/…>."),
    dict(id="edit_unread", label="Edit/Write before Read",
         test=lambda e, t, c: "has not been read yet" in e,
         why="The Edit/Write tool requires the file to have been read in this session.",
         fix="Read the file (or the relevant range) before editing. Usually self-corrects in one step; low cost.",
         snippet="- Always Read a file before Edit/Write on it."),
    dict(id="edit_stale", label="File changed since read",
         test=lambda e, t, c: "modified since read" in e,
         why="A formatter, hook, the user or another agent changed the file after Claude read it.",
         fix="Re-read before editing. If a format-on-save hook causes this, run the formatter after edits instead of on every write.",
         snippet=""),
    dict(id="edit_nomatch", label="Edit old_string mismatch",
         test=lambda e, t, c: "String to replace not found" in e or "matches of the string to replace" in e or "No changes to make" in e,
         why="Claude reconstructed old_string from memory (whitespace/indent drift) or it was not unique.",
         fix="Copy old_string exactly from a fresh Read; include more surrounding context for uniqueness.",
         snippet="- For Edit, copy old_string verbatim from a recent Read, with enough context to be unique."),
    dict(id="user_denied", label="User rejected the action",
         test=lambda e, t, c: "doesn't want to" in e or "Request interrupted by user" in e,
         why="You declined or interrupted a tool call.",
         fix="Look at the examples: recurring rejections point to a preference worth writing down (e.g. 'never push without asking').",
         snippet="- <Your preference that Claude kept missing>"),
    dict(id="perm_denied", label="Permission / safety check denied",
         test=lambda e, t, c: "Permission for this" in e or "Permission to use" in e or "requested permissions" in e or "denied by" in e or "Dangerous rm" in e,
         why="Auto-mode classifier, safety check or sandbox blocked the call.",
         fix="Allow recurring safe commands in settings.json permissions, or steer Claude away from the blocked pattern.",
         snippet=""),
    dict(id="hook_block", label="Blocked by hook or harness rule",
         test=lambda e, t, c: "hook error" in e or "Subagents should return" in e or "Worktree has" in e,
         why="A PreToolUse hook or harness guard refused the call (e.g. sleep-polling, subagent writing files).",
         fix="If the hook fires often for valid work, fix the hook; otherwise add the rule it enforces to CLAUDE.md so Claude avoids it up front.",
         snippet=""),
    dict(id="bad_call", label="Wrong tool name or parameters",
         test=lambda e, t, c: any(s in e for s in ("No such tool available", "InputValidationError", "Invalid parameters", "takes only", "Missing key", "also needs", "at most", "Pass either", "Pass the", "No task found", "haven't viewed", "Cannot enter worktree", "page tools can't")),
         why="Claude called a tool that is not loaded, or with a malformed input.",
         fix="Mostly harness/skill-doc issues. If one tool dominates, its instructions or skill are unclear; tighten them.",
         snippet=""),
    dict(id="infra", label="Harness / connection failure",
         test=lambda e, t, c: any(s in e for s in ("AbortError", "no active turn", "WebSocket is not defined", "session ended", "fetch failed", "snapshot timed out", "Stream closed")),
         why="Transient app or MCP connection issue, not Claude's reasoning.",
         fix="Not fixable by prompting. Update the app / MCP server if it spikes.",
         snippet=""),
    dict(id="timeout", label="Command timed out",
         test=lambda e, t, c: "timed out" in e.lower() or "Command timed out" in e,
         why="A long-running command hit the tool timeout.",
         fix="Run servers and watchers in the background; pass longer timeouts for slow test suites.",
         snippet="- Run dev servers and long test suites with run_in_background."),
    dict(id="search_empty", label="grep/rg found nothing (exit 1)",
         test=lambda e, t, c: re.match(r"\s*(cd [^&;]+(&&|;)\s*)?(grep|rg|egrep|git grep)\b", c or "") is not None and e.strip().startswith("Exit code 1"),
         why="grep/rg exit 1 means 'no match'; the harness reports it as an error.",
         fix="Harmless signal. Append `|| true` when an empty result is expected, or prefer the Grep tool.",
         snippet="- grep/rg exit 1 means no matches; use the Grep tool or append `|| true`."),
    dict(id="chained", label="Chained command: one step failed",
         test=lambda e, t, c: e.lstrip().startswith("Exit code") and len(e) > 80 and not re.search(r"(?i)error|fatal|fail|denied|not found|invalid|cannot|unable|traceback|panic|conflict|exception", e),
         why="A `a; b; c` or `&&` chain produced useful output but a trailing probe (often ls/grep on an optional path) exited non-zero, so the whole call is flagged.",
         fix="Append `|| true` to optional probes, or split exploratory commands. Often harmless noise.",
         snippet="- End optional probes in chained commands with `|| true` so the call does not report failure."),
    dict(id="tests", label="Tests / build / lint failed",
         test=lambda e, t, c: re.search(r"\b(npm|pnpm|yarn|bun|npx|vitest|jest|pytest|cargo|tsc|phpunit|pest|go test|go build|make|eslint|ruff|mypy|artisan test|composer)\b", c or "") is not None,
         why="Real failures in the project's checks; often expected while iterating.",
         fix="Track whether the same suite fails repeatedly. Flaky or slow suites deserve a CLAUDE.md note on how to run a single test.",
         snippet="- Run a single test with: <command>. Full suite: <command>."),
    dict(id="git", label="git / gh error",
         test=lambda e, t, c: "fatal:" in e or re.search(r"\b(git|gh)\b", c or "") is not None,
         why="git state was not what Claude assumed (branch, remote, dirty tree, auth).",
         fix="Check `git status` / current branch before branch-changing commands.",
         snippet="- Run git status before git operations that change branches or history."),
    dict(id="python", label="Script error (Python/Node)",
         test=lambda e, t, c: "Traceback" in e or "SyntaxError" in e or "TypeError" in e or "ReferenceError" in e,
         why="An ad-hoc inline script crashed (often bad assumptions about data shape).",
         fix="Inspect input shape before writing parsing scripts; write longer scripts to a file instead of heredocs.",
         snippet=""),
    dict(id="os_perm", label="OS permission / sandbox",
         test=lambda e, t, c: "Operation not permitted" in e or "Permission denied" in e or "sandbox" in e.lower() or "EPERM" in e,
         why="Sandbox or file permissions blocked the command.",
         fix="Use the scratchpad dir for temp files; add needed paths to sandbox allow-lists.",
         snippet=""),
    dict(id="exit_other", label="Other non-zero exit",
         test=lambda e, t, c: e.lstrip().startswith("Exit code"),
         why="Shell command failed for another reason. Open examples to spot new patterns.",
         fix="Review examples; promote recurring patterns to their own rule in build_dashboard.py.",
         snippet=""),
    dict(id="other", label="Other",
         test=lambda e, t, c: True,
         why="Uncategorized tool error.",
         fix="Review examples; add a rule in build_dashboard.py when a pattern repeats.",
         snippet=""),
]


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(x.get("text", "") for x in content if isinstance(x, dict))
    return str(content or "")


def summarize_input(tool, inp):
    if not isinstance(inp, dict):
        return ""
    for k in ("command", "file_path", "pattern", "url", "path", "query", "skill", "prompt"):
        if k in inp and isinstance(inp[k], str):
            return inp[k]
    return json.dumps(inp)[:300]


def project_name(dirname, cwd):
    if cwd:
        p = cwd.split("/.claude/worktrees/")[0]
        return os.path.basename(p.rstrip("/")) or p
    return dirname.split("-")[-1]


def day_of(ts):
    return ts[:10] if ts else None


def scan(root):
    errors, calls = [], collections.Counter()  # calls[(day, project)]
    files = glob.glob(os.path.join(root, "*", "*.jsonl")) + glob.glob(os.path.join(root, "*", "*", "subagents", "*.jsonl"))
    for f in files:
        dirname = os.path.relpath(f, root).split(os.sep)[0]
        rows = []
        with open(f, errors="ignore") as fh:
            for line in fh:
                if '"tool_' not in line and '"assistant"' not in line:
                    continue
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    pass
        uses, seen = {}, set()
        for i, d in enumerate(rows):
            msg = d.get("message") or {}
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            proj = project_name(dirname, d.get("cwd"))
            day = day_of(d.get("timestamp"))
            for x in content:
                if not isinstance(x, dict):
                    continue
                if x.get("type") == "tool_use":
                    if x.get("id") in uses:
                        continue
                    uses[x.get("id")] = (x.get("name"), x.get("input"))
                    if day:
                        calls[(day, proj)] += 1
                elif x.get("type") == "tool_result" and x.get("is_error") and x.get("tool_use_id") not in seen:
                    seen.add(x.get("tool_use_id"))
                    err = text_of(x.get("content")).replace("<tool_use_error>", "").replace("</tool_use_error>", "").strip()
                    tool, inp = uses.get(x.get("tool_use_id"), ("?", {}))
                    cmd = summarize_input(tool, inp)
                    cat = next(r["id"] for r in RULES if r["test"](err, tool, cmd))
                    errors.append(dict(
                        id=x.get("tool_use_id") or "", ts=d.get("timestamp"), d=day, p=proj, s=d.get("sessionId", "")[:8],
                        t=tool, c=cat, i=cmd[:400], e=err[:700], r=followup(rows, i),
                        sub=1 if "/subagents/" in f else 0,
                    ))
    return errors, calls


def followup(rows, i):
    """Claude's first words after the error: usually its diagnosis of what went wrong."""
    for d in rows[i + 1:i + 6]:
        if d.get("type") != "assistant":
            continue
        for x in (d.get("message") or {}).get("content") or []:
            if not isinstance(x, dict):
                continue
            s = (x.get("text") if x.get("type") == "text" else x.get("thinking") if x.get("type") == "thinking" else "") or ""
            s = s.strip()
            if s:
                return s[:500]
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--projects", default=os.path.expanduser("~/.claude/projects"))
    ap.add_argument("--out", default=os.path.join(HERE, "claude-errors.html"))
    a = ap.parse_args()

    errors, calls = scan(a.projects)
    errors = [e for e in errors if e["d"]]
    # Resumed or forked sessions copy earlier turns into a new file; keep each tool call once.
    errors = list({e["id"] or id(e): e for e in errors}.values())
    errors.sort(key=lambda e: e["ts"])
    data = dict(
        generated=datetime.now(timezone.utc).isoformat(timespec="minutes"),
        categories=[{k: r[k] for k in ("id", "label", "why", "fix", "snippet")} for r in RULES],
        errors=errors,
        calls=[[d, p, n] for (d, p), n in sorted(calls.items())],
    )
    with open(os.path.join(HERE, "dashboard_template.html")) as fh:
        html = fh.read()
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    with open(a.out, "w") as fh:
        fh.write(html.replace("/*__DATA__*/null", payload))
    print(f"{len(errors)} errors, {sum(calls.values())} tool calls -> {a.out}")
    for cid, n in collections.Counter(e["c"] for e in errors).most_common():
        print(f"  {n:5d}  {cid}")


if __name__ == "__main__":
    main()
