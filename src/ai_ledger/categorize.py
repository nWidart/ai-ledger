"""Error categories for failed tool calls, and the helpers that read tool inputs and results.

Ingest uses this to categorize errors. Add a rule to RULES when a new error pattern shows up in "Other".
"""
import json
import os
import re
from urllib.parse import urlsplit

# A shell command line's simple commands: the text between `&&`, `||`, `;`, `|`, newlines, subshell parentheses and
# command substitutions.
SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|\n()`]|\$\(")
ASSIGN = re.compile(r"[A-Za-z_]\w*=")
# Words that run the rest of the command, and shell keywords: they, their flags and timeout's duration come before the
# command word.
WRAPPERS = {"sudo", "env", "time", "exec", "command", "nice", "nohup", "timeout",
            "if", "then", "else", "elif", "do", "while", "until", "!", "{"}
# Tools that are a test, build or lint run whatever their arguments.
TEST_TOOLS = {"vitest", "jest", "pytest", "py.test", "unittest", "tsc", "phpunit", "pest", "eslint", "ruff", "mypy"}
# Package managers and task runners, which run tests only through a test, build or lint script or subcommand, or a
# formatter in check mode (`cargo fmt --check`).
TEST_RUNNERS = {"npm", "pnpm", "yarn", "bun", "composer", "make", "just", "cargo", "go", "artisan", "playwright"}
TEST_SCRIPT = re.compile(r"(test|tests|build|lint|check|typecheck|type-check|analyse|analyze|clippy|nextest|llvm-cov|vet|e2e)([:_-]\S*)?")
# Words that run the tool named after them: `npx vitest`, `uv run pytest`, `pnpm exec tsc`.
LAUNCHERS = {"npx", "pnpx", "bunx", "uvx"}
LAUNCH_SUBCOMMANDS = {"run", "exec", "dlx", "x"}
# A shell command that runs `git commit`, allowing global options such as `-C <dir>`.
GIT_COMMIT = re.compile(r"\bgit\b(\s+-\S+(\s+\S+)?)*\s+commit\b")
# Tool names that run a shell command, per source: Claude Code's and Codex's. runs_tests and GIT_COMMIT apply to these.
SHELL_TOOLS = {"Bash", "exec_command"}


def commands(cmd):
    """The words of each simple command in a shell command line, unwrapped from `bash -lc '…'`, without env assignments
    or wrappers such as sudo, and with the command word reduced to its basename (`./vendor/bin/pest` is `pest`)."""
    cmd = cmd or ""
    while m := SHELL_WRAP.match(cmd):
        cmd = m.group(2)
    for seg in SEGMENT_SPLIT.split(cmd):
        words = seg.split()
        while words and (ASSIGN.match(words[0]) or words[0] in WRAPPERS):
            w = words.pop(0)
            while words and words[0].startswith("-"):
                words.pop(0)
            if w == "timeout" and words:
                words.pop(0)
        if words:
            yield [os.path.basename(words[0])] + words[1:]


def is_test_run(words):
    """Whether one simple command's words run tests, a build or a linter."""
    while words and words[0].startswith("-"):
        words = words[1:]
    if not words:
        return False
    word, args = words[0], [a for a in words[1:] if not a.startswith("-")]
    after = lambda arg: words[words.index(arg) + 1:]  # the words after one of the arguments
    if word in TEST_TOOLS or (word.endswith(".sh") and TEST_SCRIPT.fullmatch(word[:-3])):  # ./test.sh, scripts/check.sh
        return True
    if word in TEST_RUNNERS and (any(TEST_SCRIPT.fullmatch(a) for a in args[:3]) or (word == "make" and not args)
                                 or (args[:1] in (["fmt"], ["format"]) and "--check" in words)):
        return True
    if re.fullmatch(r"python[\d.]*", word) and "-m" in words:
        return is_test_run(after("-m"))
    if word == "php" and args and os.path.basename(args[0]) == "artisan":
        return is_test_run(["artisan"] + after(args[0]))
    if word in LAUNCHERS:
        return is_test_run(words[1:])
    if args and args[0] in LAUNCH_SUBCOMMANDS:  # uv run, poetry run, pnpm exec, yarn dlx
        return is_test_run(after(args[0]))
    return False


def runs_tests(cmd):
    """Whether a shell command runs tests, a build or a linter. Such a call is a test run; it passed when it did not fail."""
    return any(is_test_run(words) for words in commands(cmd))


def runs_git(cmd):
    """Whether a shell command runs git or gh."""
    return any(words[0] in ("git", "gh") for words in commands(cmd))


# Tools that drive a browser or an app's UI: an in-app preview, Chrome, Playwright or a computer-use agent.
BROWSER_TOOL = re.compile(r"(?i)^mcp__.*(preview|browser|chrome|playwright|puppeteer|cua_|computer)")
# A host name that did not resolve, or a network that is not there.
NETWORK = re.compile(r"(?i:could not resolve host|name or service not known|nodename nor servname|temporary failure in name "
                     r"resolution|failed to lookup address|network is unreachable)|\b(ENOTFOUND|EAI_AGAIN)\b")

# First matching rule wins. Each rule: id, label, test(err, tool, cmd) -> bool, why, fix, snippet.
RULES = [
    dict(id="worktree", label="Path outside isolated worktree",
         test=lambda e, t, c: "isolated in the worktree" in e and re.search(r"shared[ -]checkout|outside that worktree", e) is not None,
         why="The agent ran inside a worktree but touched a path in the main checkout (or another repo).",
         fix="Use paths relative to the worktree root, or the worktree's absolute path. Give subagents the worktree path in their brief, never the main checkout path.",
         snippet="- When working in a git worktree, only use paths inside that worktree. Never cd to or edit the main checkout."),
    dict(id="worktree_verify", label="Command too complex for worktree check",
         # The harness refuses any command it cannot prove stays inside the worktree: compound commands, heredocs,
         # values computed at runtime. Only the cases above name a path outside it.
         test=lambda e, t, c: "isolated in the worktree" in e,
         why="The agent ran inside an isolated worktree, and the harness could not verify that a command stays inside it: compound commands, heredocs, scripts fed to an interpreter, or values computed at runtime.",
         fix="Run single, simple commands with literal arguments from the worktree root: no heredocs, no `$(…)` or variables, no long `&&` or `;` chains. Write longer scripts to a file and run the file.",
         snippet="- In a worktree, run one simple command per call with literal arguments: no heredocs, `$(…)`, variables or chained commands."),
    dict(id="sleep_poll", label="Sleep-then-poll blocked",
         test=lambda e, t, c: e.startswith("Blocked: sleep"),
         why="The agent tried to wait with `sleep N; cat output` instead of letting background work notify it.",
         fix="Run long work with run_in_background and wait for the notification, or use Monitor with an until-condition.",
         snippet="- Never sleep-poll. Use run_in_background and wait for the completion notice."),
    dict(id="ls_alias", label="ls aliased to eza",
         test=lambda e, t, c: "--icons [<WHEN>]" in e,
         why="Your shell aliases ls to eza with --icons, which swallows the next argument as its value.",
         fix="Make the alias interactive-only in ~/.zshrc (`[[ -o interactive ]] && alias ls='eza --icons'`), or have the agent use `command ls`.",
         snippet="- `ls` is aliased to eza; use `command ls` in shell commands."),
    dict(id="cli_flags", label="Wrong CLI flags (BSD vs GNU, gh)",
         test=lambda e, t, c: any(s in e for s in ("specify only one of", "unknown flag", "illegal option", "invalid option", "unrecognized option", "bad flag in substitute", "extra characters at the end", "invalid command code")),
         why="The agent used GNU syntax on macOS BSD tools (sed -i, date, stat) or invalid gh flag combos.",
         fix="Note in CLAUDE.md or AGENTS.md that the machine is macOS with BSD tools (sed -i '' …), or install GNU coreutils/gnu-sed.",
         snippet="- macOS: BSD sed/date/stat. Use sed -i '' and check `gh <cmd> --help` for flag combos."),
    dict(id="zsh_glob", label="zsh glob had no matches",
         test=lambda e, t, c: "no matches found" in e,
         why="zsh aborts the whole command when an unquoted glob matches nothing (bash would pass it through).",
         fix="Quote glob patterns passed to find/grep/rg, or use `find`/Glob instead of shell globs. Optionally add `setopt nonomatch` to ~/.zshenv.",
         snippet="- The shell is zsh: quote glob patterns (e.g. find . -name '*.ts'); unmatched globs abort the command."),
    dict(id="cmd_not_found", label="Command not found",
         test=lambda e, t, c: "command not found" in e or "not found in PATH" in e,
         why="The agent assumed a CLI was installed or on PATH.",
         fix="List the project's available tooling in CLAUDE.md or AGENTS.md (e.g. pnpm vs npm, python3 vs python). Check with `command -v` before relying on a tool.",
         snippet="- Available CLIs: <list them>. Use python3 (not python). Check `command -v X` before using an unfamiliar tool."),
    dict(id="no_file", label="File or directory not found",
         test=lambda e, t, c: "no such file or directory" in e.lower() or "File does not exist" in e or "does not exist" in e[:200],
         why="The agent guessed a path instead of looking it up first.",
         fix="Locate files with Glob/ls before reading. Keep a short map of key directories in CLAUDE.md or AGENTS.md.",
         snippet="- Do not guess file paths: list or glob first. Key dirs: <src/…, tests/…>."),
    dict(id="edit_unread", label="Edit/Write before Read",
         test=lambda e, t, c: "has not been read yet" in e,
         why="The Edit/Write tool requires the file to have been read in this session.",
         fix="Read the file (or the relevant range) before editing. Usually self-corrects in one step; low cost.",
         snippet="- Always Read a file before Edit/Write on it."),
    dict(id="edit_stale", label="File changed since read",
         test=lambda e, t, c: "modified since read" in e,
         why="A formatter, hook, the user or another agent changed the file after the agent read it.",
         fix="Re-read before editing. If a format-on-save hook causes this, run the formatter after edits instead of on every write.",
         snippet=""),
    dict(id="edit_nomatch", label="Edit old_string mismatch",
         test=lambda e, t, c: "String to replace not found" in e or "matches of the string to replace" in e or "No changes to make" in e,
         why="The agent reconstructed old_string from memory (whitespace/indent drift) or it was not unique.",
         fix="Copy old_string exactly from a fresh Read; include more surrounding context for uniqueness.",
         snippet="- For Edit, copy old_string verbatim from a recent Read, with enough context to be unique."),
    dict(id="user_denied", label="User rejected the action",
         test=lambda e, t, c: "doesn't want to" in e or "Request interrupted by user" in e,
         why="You declined or interrupted a tool call.",
         fix="Look at the examples: recurring rejections point to a preference worth writing down (e.g. 'never push without asking').",
         snippet="- <Your preference that the agent kept missing>"),
    dict(id="perm_denied", label="Permission / safety check denied",
         test=lambda e, t, c: "Permission for this" in e or "Permission to use" in e or "requested permissions" in e or "denied by" in e or "Dangerous rm" in e,
         why="Auto-mode classifier, safety check or sandbox blocked the call.",
         fix="Allow recurring safe commands in settings.json permissions, or steer the agent away from the blocked pattern.",
         snippet=""),
    dict(id="hook_block", label="Blocked by hook or harness rule",
         test=lambda e, t, c: "hook error" in e or "Subagents should return" in e or "Worktree has" in e,
         why="A PreToolUse hook or harness guard refused the call (e.g. sleep-polling, subagent writing files).",
         fix="If the hook fires often for valid work, fix the hook; otherwise add the rule it enforces to CLAUDE.md or AGENTS.md so the agent avoids it up front.",
         snippet=""),
    dict(id="bad_call", label="Wrong tool name or parameters",
         # Harness and tool-validation messages only: a shell call's error is "Exit code N" then the command's output,
         # which can hold any of these phrases (a printed doc saying "at most"), so it never counts here.
         test=lambda e, t, c: not e.lstrip().startswith("Exit code") and any(s in e for s in ("No such tool available", "InputValidationError", "Invalid parameters", "takes only", "Missing key", "also needs", "at most", "Pass either", "Pass the", "No task found", "haven't viewed", "Cannot enter worktree", "page tools can't")),
         why="The agent called a tool that is not loaded, or with a malformed input.",
         fix="Mostly harness/skill-doc issues. If one tool dominates, its instructions or skill are unclear; tighten them.",
         snippet=""),
    dict(id="infra", label="Harness / connection failure",
         test=lambda e, t, c: any(s in e for s in ("AbortError", "no active turn", "WebSocket is not defined", "session ended", "fetch failed", "snapshot timed out", "Stream closed")),
         why="Transient app or MCP connection issue, not the agent's reasoning.",
         fix="Not fixable by prompting. Update the app / MCP server if it spikes.",
         snippet=""),
    dict(id="network", label="Network / DNS unreachable",
         test=lambda e, t, c: NETWORK.search(e) is not None,
         why="A command needed the network, but a host name did not resolve: the sandbox blocks network access (Codex's default), or the machine was offline.",
         fix="Allow network access for sessions that need it (in Codex, the sandbox's network setting), or have the agent ask before commands that download or call remote services.",
         snippet="- The sandbox has no network access. Ask before running commands that download or call remote services."),
    dict(id="browser", label="Browser automation failed",
         test=lambda e, t, c: BROWSER_TOOL.match(t or "") is not None,
         why="A browser or UI automation tool (preview, Chrome, Playwright, computer use) failed: a stale element ref, a bad selector, a wait that timed out, or no browser available.",
         fix="Take a fresh snapshot before each action and act on its refs; wait for a specific element rather than a fixed delay; check the page's server is running before driving it.",
         snippet="- Browser automation: snapshot before acting, use fresh element refs, and wait for an element instead of a fixed delay."),
    dict(id="timeout", label="Command timed out",
         test=lambda e, t, c: "timed out" in e.lower(),
         why="A long-running command or script hit the tool's timeout.",
         fix="Run servers and watchers in the background; pass longer timeouts for slow test suites or scripts.",
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
         test=lambda e, t, c: runs_tests(c),
         why="Real failures in the project's checks; often expected while iterating.",
         fix="Track whether the same suite fails repeatedly. Flaky or slow suites deserve a CLAUDE.md note on how to run a single test.",
         snippet="- Run a single test with: <command>. Full suite: <command>."),
    dict(id="git", label="git / gh error",
         test=lambda e, t, c: "fatal:" in e or runs_git(c),
         why="git state was not what the agent assumed (branch, remote, dirty tree, auth).",
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
         why="A shell command failed for a reason no other type covers.",
         fix="Open the examples to spot a repeated cause. If one recurs, write it down in CLAUDE.md or AGENTS.md so the agent avoids it.",
         snippet=""),
    dict(id="mcp", label="MCP tool error",
         test=lambda e, t, c: (t or "").startswith("mcp__"),
         why="A tool from an MCP server or app connector returned an error: the server was unavailable or unauthorized, or rejected its input.",
         fix="Open the examples by tool. If one server dominates, check that it is connected and authorized, or update it.",
         snippet=""),
    dict(id="other", label="Other",
         test=lambda e, t, c: True,
         why="A tool error no other type covers.",
         fix="Open the examples to spot a repeated cause. If one recurs, write it down in CLAUDE.md or AGENTS.md so the agent avoids it.",
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


# input_pattern: a shell script wrapped as `bash -lc '…'`, and what may come before the command itself: a subshell's
# "(", `cd … &&` or `cd …;`, env assignments and sudo with its flags.
SHELL_WRAP = re.compile(r"""\s*(?:\S*/)?(?:ba|z)?sh\s+-l?c\s+(['"])(.*)\1\s*$""", re.S)
SHELL_LEAD = re.compile(r"\s*(?:\(\s*|cd\s+[^&;|]*(?:&&|;)\s*|[A-Za-z_]\w*=\S*\s+|sudo\s+(?:-\S+\s+)*)")
FILE_TOOLS = {"Read", "Edit", "Write", "NotebookEdit", "apply_patch"}
SEARCH_TOOLS = {"Grep", "Glob"}
SEARCH_CUT = 40


def input_pattern(tool, summary):
    """The group a call's input_summary falls in on the tool inspector: a shell command's first word, a file's extension
    (its name when it has none), a search pattern cut to SEARCH_CUT, a URL's host, "search" for a web search, else "other"."""
    summary = (summary or "").strip()
    if tool in SHELL_TOOLS:
        cmd = summary
        while m := SHELL_WRAP.match(cmd) or SHELL_LEAD.match(cmd):
            cmd = m.group(2) if m.re is SHELL_WRAP else cmd[m.end():]
        word = re.match(r"[^\s;&|()<>]+", cmd)
        return word.group(0) if word else "other"
    if tool in FILE_TOOLS:
        name = os.path.basename(summary.split(", ")[0])  # apply_patch lists every changed file
        return (os.path.splitext(name)[1] or name) if name else "other"
    if tool in SEARCH_TOOLS:
        return summary[:SEARCH_CUT] or "other"
    if tool == "WebFetch":
        try:
            return urlsplit(summary).hostname or "other"
        except ValueError:  # such as an unclosed IPv6 bracket
            return "other"
    if tool in ("WebSearch", "web_search"):
        return "search"
    return "other"


def categorize(err, tool, cmd):
    return next(r["id"] for r in RULES if r["test"](err, tool, cmd))


def error_text(content):
    return text_of(content).replace("<tool_use_error>", "").replace("</tool_use_error>", "").strip()
