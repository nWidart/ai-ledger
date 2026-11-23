"""Seed a synthetic AI Ledger store for demo recordings. Every name, prompt and error here is made up.

uv run tools/demo/seed.py    writes tools/demo/demo.duckdb, replacing an earlier one
"""
import json
import os
import random
from datetime import datetime, timedelta, timezone

from ai_ledger import categorize, insights, store

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "demo.duckdb")

rnd = random.Random(7)
NOW = datetime.now(timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
TODAY = NOW.date()
DAYS = 75

PROJECTS = {  # name: (weight, source mix: share of Codex)
    "atlas-api": (5, 0.2), "pixel-studio": (4, 0.1), "ledger-web": (3, 0.5), "docs-site": (1.5, 0.0), "infra-scripts": (1, 0.6),
}
PROMPTS = {
    "atlas-api": ["Add rate limiting to the /orders endpoint", "Fix the flaky invoice export test", "Migrate the auth middleware to JWT rotation",
                  "Add pagination to the customers list", "Why does the webhook retry twice?", "Refactor the billing service into modules"],
    "pixel-studio": ["Build the layer panel drag and drop", "Make the canvas zoom smooth on trackpads", "Add an export to PNG button",
                     "Fix the undo stack after a crop", "Add dark mode to the toolbar"],
    "ledger-web": ["Add a cost per day chart", "Make the sessions table sortable", "Fix the hydration warning on the home page",
                   "Add a project filter to the top bar", "Write tests for the date range picker"],
    "docs-site": ["Write the getting started guide", "Fix broken links in the API reference", "Add a search box to the sidebar"],
    "infra-scripts": ["Write a backup script for the Postgres volume", "Add a health check to the deploy script", "Rotate the staging certificates"],
}
CLAUDE_MODELS = [("claude-opus-5-5", "high", 0.55), ("claude-sonnet-5-5", "medium", 0.35), ("claude-fable-5-1", "high", 0.10)]
CODEX_MODELS = [("gpt-6.1-sol", "high", 0.5), ("gpt-6.2-sol", "high", 0.2), ("gpt-6-astra", "medium", 0.3)]  # gpt-6.2-sol has no price

# (tool, input, error text or None) templates; errors are categorized with the app's own rules
OK = [("Read", "src/{f}.ts"), ("Read", "src/{f}.py"), ("Edit", "src/{f}.ts"), ("Edit", "src/{f}.py"), ("Grep", "TODO|FIXME"),
      ("Glob", "src/**/*.ts"), ("Bash", "npm test"), ("Bash", "git status"), ("Bash", "uv run pytest"), ("Bash", "git diff"),
      ("Write", "src/{f}.test.ts"), ("WebFetch", "https://developer.mozilla.org/en-US/docs/Web/API"), ("Task", "Explore the codebase"),
      ("mcp__github__get_pull_request", "{\"number\": 42}"), ("mcp__linear__list_issues", "{\"team\": \"API\"}"), ("mcp__playwright__browser_snapshot", "{}"),
      ("mcp__context7__get-library-docs", "{\"library\": \"react\"}")]
FAIL = [
    ("Edit", "src/{f}.ts", "String to replace not found in file.\nString: const total = items.reduce("),
    ("Edit", "src/{f}.py", "File has not been read yet. Read it first before writing to it."),
    ("Bash", "npm test", "Exit code 1\nFAIL src/cart.test.ts\n  ● cart › applies discount\n    expected 90, received 100\nTests: 1 failed, 41 passed"),
    ("Bash", "uv run pytest", "Exit code 1\nFAILED tests/test_orders.py::test_rate_limit - AssertionError: 429 != 200\n1 failed, 88 passed"),
    ("Bash", "sed -i 's/foo/bar/' src/app.ts", "Exit code 1\nsed: 1: \"src/app.ts\": extra characters at the end of a command"),
    ("Bash", "git push", "Exit code 1\nfatal: The current branch feat/rate-limit has no upstream branch."),
    ("Read", "src/{f}.tsx", "File does not exist."),
    ("Bash", "pnpm build", "Exit code 127\nzsh: command not found: pnpm"),
    ("Bash", "sleep 30 && cat out.log", "Blocked: sleep 30 followed by cat. Run blocking commands in the background."),
    ("Grep", "useLayerStore", "No matches found"),
    ("mcp__github__create_pull_request", "{\"title\": \"Add rate limiting\"}", "MCP error -32603: Validation Failed: head branch not pushed"),
    ("Bash", "npm run lint", "Exit code 1\n/src/canvas.ts\n  12:5  error  'ctx' is assigned a value but never used  no-unused-vars\n✖ 1 problem"),
]
FILES = ["orders", "auth", "canvas", "layers", "billing", "cart", "router", "export", "toolbar", "webhook"]
START = {"atlas-api": 48_000, "pixel-studio": 32_000, "ledger-web": 38_000, "docs-site": 22_000, "infra-scripts": 26_000}  # median starting context
WINDOW = {"claude": 1_000_000, "codex": 272_000}  # the context window of each source's models
RESULT = {"Read": 9_000, "Edit": 300, "Write": 250, "Grep": 2_500, "Glob": 900, "Bash": 4_000, "exec_command": 4_000, "WebFetch": 30_000,
          "Task": 3_000, "Skill": 6_000, "github": 12_000, "linear": 6_000, "playwright": 45_000, "context7": 22_000}  # median result bytes

for f in (DB, DB + ".wal"):
    if os.path.exists(f):
        os.remove(f)
c = store.open_store(DB).cursor()
sessions, reqs, tools, prompts, hooks, raw = [], [], [], [], [], []
n = 0


def pick(options):
    r, acc = rnd.random(), 0
    for *v, w in options:
        acc += w
        if r <= acc:
            return v
    return options[0][:-1]


for d in range(DAYS, -1, -1):
    day = TODAY - timedelta(days=d)
    ramp = 0.5 + 0.8 * (DAYS - d) / DAYS  # usage grows over time
    weekend = day.weekday() >= 5
    for project, (weight, codex_share) in PROJECTS.items():
        count = max(0, round(rnd.gauss(weight * ramp * (0.3 if weekend else 1) * 0.6, 0.8)))
        for _ in range(count):
            n += 1
            sid = f"demo-{n:05d}"
            source = "codex" if rnd.random() < codex_share else "claude"
            start = datetime.combine(day, datetime.min.time()) + timedelta(hours=rnd.choice([8, 9, 10, 11, 13, 14, 15, 16, 17, 20, 21]),
                                                                       minutes=rnd.randrange(60))
            if start > NOW - timedelta(minutes=30):
                continue
            model, effort = pick(CODEX_MODELS if source == "codex" else CLAUDE_MODELS)
            n_prompts = rnd.randint(1, 6)
            win = WINDOW[source]
            grow = rnd.choice([1, 1, 1, 2, 3]) if source == "claude" else rnd.choice([1, 1, 2])
            one_hour = source == "claude" and rnd.random() < 0.2  # sessions that write 1-hour cache entries
            t, ctx, peak, compactions, first_compaction = start, int(rnd.gauss(START[project], START[project] * 0.2)), 0, 0, None
            commits = 0
            for p in range(n_prompts):
                pid = f"{sid}-p{p}"
                interrupted = rnd.random() < 0.08
                prompts.append((pid, sid, t, interrupted))
                if p == 0:
                    text = rnd.choice(PROMPTS[project])
                    raw.append((f"{sid}-raw", None, 0, 0, "user", sid, pid, t.isoformat(), False, True,
                                json.dumps({"promptId": pid, "message": {"content": text}})))
                switched = p > 0 and source == "claude" and rnd.random() < 0.04
                if switched:
                    model = rnd.choice([m for m, *_ in CLAUDE_MODELS if m != model])
                for r in range(rnd.randint(2, 9)):
                    gap = rnd.randint(8, 90)
                    t += timedelta(seconds=gap)
                    sub = source == "claude" and rnd.random() < 0.15
                    m = "claude-haiku-5-5" if sub else model
                    inp, c5, c1 = rnd.randint(50, 3_000), rnd.randint(500, 8_000), rnd.randint(500, 6_000) if one_hour else 0
                    if sub:  # a subagent carries its own context, not the session's
                        read = rnd.randint(8_000, 30_000)
                    else:
                        ctx = min(ctx + rnd.randint(3_000, 18_000) * grow, int(win * 0.95))
                        if ctx > 0.8 * win and rnd.random() < 0.4:
                            ctx, compactions = START[project] + 20_000, compactions + 1
                            first_compaction = first_compaction or t
                        peak = max(peak, ctx)
                        read = ctx
                        if r == 0 and (switched or (p > 0 and not one_hour and rnd.random() < 0.25)):  # a model switch, or the cache expired in the pause
                            read, c5 = 0, ctx
                        elif r > 0 and rnd.random() < 0.004:  # a break of no known cause
                            read, inp = ctx // 5, ctx * 4 // 5
                    out = rnd.randint(300, 4_000)
                    reqs.append((f"{sid}-r{p}-{r}", sid, t, m, effort, sub, inp, out, out // 3,
                                 read, c5, c1, rnd.randint(0, 9_000), "end_turn"))
                    for k in range(rnd.randint(0, 3)):
                        tid = f"{sid}-t{p}-{r}-{k}"
                        end = t + timedelta(milliseconds=rnd.randint(40, 9_000))
                        fail_rate = 0.11 if project != "pixel-studio" else 0.16
                        if rnd.random() < fail_rate:
                            tool, inp, err = rnd.choice(FAIL)
                        else:
                            (tool, inp), err = rnd.choice(OK), None
                        inp = inp.replace("{f}", rnd.choice(FILES))
                        if source == "codex" and tool == "Bash":
                            tool = "exec_command"
                        commit = tool in categorize.SHELL_TOOLS and err is None and rnd.random() < 0.12
                        if commit:
                            inp, commits = "git commit -m \"wip\"", commits + 1
                        test = tool in categorize.SHELL_TOOLS and categorize.runs_tests(inp)
                        mcp = tool.split("__")[1] if tool.startswith("mcp__") else None
                        skill = rnd.choice(["review-change", "ship", "frontend-design"]) if tool == "Read" and rnd.random() < 0.05 else None
                        if skill:
                            tool, inp = "Skill", skill
                        cat = categorize.categorize(err, tool, inp) if err else None
                        follow = "Fixed the old_string and retried." if err else None
                        size = len(err) if err else min(int(RESULT[mcp or tool] * rnd.lognormvariate(0, 0.7) * (12 if rnd.random() < 0.004 else 1)), 600_000)
                        tools.append((tid, sid, tool, mcp, skill, inp, t, end, err is not None, err, cat, follow, sub,
                                      commit, test, (test and err is None) or commit, None, None, size))
                if rnd.random() < 0.5:
                    hooks.append((sid, t, "stop_summary", "Stop", "notify.sh", rnd.randint(40, 400), rnd.random() < 0.04))
                t += timedelta(minutes=rnd.randint(2, 25))
            sessions.append((sid, project, f"/home/demo/code/{project}", rnd.choice(["main", "feat/rate-limit", "fix/undo", "feat/export"]),
                             start, t, "cli", "2.4.0", compactions, peak, model, source, win if source == "codex" else None, first_compaction))

# Shapes real sessions have, drawn from their own random stream so the rows above stay as they are: a title of 60 to 80
# characters on every Claude Code and Codex session, a 30-character branch, shell commands past 200 characters with
# absolute paths, and t3-code MCP calls whose JSON input runs to about 300 characters.
TITLES = {
    "atlas-api": ["Add sliding-window rate limiting to the orders endpoint and document the headers",
                  "Fix the flaky invoice export test that fails when the run crosses midnight UTC",
                  "Rotate the JWT signing keys without logging out every active customer session"],
    "pixel-studio": ["Make the layer panel drag and drop keep its selection while the canvas redraws",
                     "Smooth the canvas zoom on trackpads and stop it jumping at the 400 percent step",
                     "Fix the undo stack so a crop followed by a resize can be undone in one step"],
    "ledger-web": ["Add a cost per day chart with a previous-period line under the sessions table",
                   "Fix the hydration warning on the home page caused by the relative timestamps",
                   "Make the sessions table sortable by cost, duration and errors from its header"],
    "docs-site": ["Write the getting started guide for a fresh clone, from install to a first page",
                  "Fix every broken link the API reference build reports and add a check to CI"],
    "infra-scripts": ["Write a nightly backup script for the Postgres volume with a seven-day retention",
                      "Rotate the staging certificates and add an expiry alert two weeks ahead of it"],
}
LONG_BRANCH = "feat/rate-limit-sliding-window"  # 30 characters
LONG_BASH = [
    "cd /home/demo/code/{p} && uv run pytest tests/test_orders.py tests/test_rate_limit.py tests/test_webhooks.py -q -x --no-header -p no:cacheprovider 2>&1 | tee /home/demo/.cache/{p}/pytest-orders.log",
    "/home/demo/code/{p}/node_modules/.bin/vitest run --reporter=verbose --coverage.enabled --coverage.reportsDirectory=/home/demo/code/{p}/coverage --outputFile=/home/demo/.cache/{p}/vitest.json /home/demo/code/{p}/src/{f}.test.ts",
    "rg --json -n 'rateLimit|throttle|retryAfter' /home/demo/code/{p}/src /home/demo/code/{p}/tests --glob '!**/*.snap' --glob '!**/fixtures/**' | jq -r 'select(.type == \"match\") | .data.path.text' | sort -u",
]
DELEGATE = json.dumps(dict(target=dict(provider="codex", model="gpt-6.2-sol", options=dict(reasoningEffort="high")), isolation="worktree",
                           task="Review the {p} change on this branch against its spec: list each missing test, each unhandled error path and each changed public name, with its file and line."))
srnd = random.Random(13)
titles = [(s[0], None, TITLES[s[1]][i % len(TITLES[s[1]])]) for i, s in enumerate(sessions)]
for i, s in enumerate(sessions):
    sid, project, start, end = s[0], s[1], s[4], s[5]
    if project == "atlas-api" and srnd.random() < 0.3:
        sessions[i] = s[:3] + (LONG_BRANCH,) + s[4:]
    if s[11] != "claude" or srnd.random() >= 0.3:
        continue
    for k, (tool, inp) in enumerate([("Bash", srnd.choice(LONG_BASH).replace("{f}", srnd.choice(FILES))), ("mcp__t3-code__delegate_task", DELEGATE)]):
        t = start + (end - start) * srnd.random()
        inp = inp.replace("{p}", project)
        test = tool in categorize.SHELL_TOOLS and categorize.runs_tests(inp)
        tools.append((f"{sid}-long{k}", sid, tool, "t3-code" if tool.startswith("mcp__") else None, None, inp, t,
                      min(t + timedelta(milliseconds=srnd.randint(400, 20_000)), end), False, None, None, None, False, False, test, test, None, None,
                      srnd.randint(200, 6_000)))

store.insert(c, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint", "version",
                             "compactions", "peak_context", "peak_model", "source", "context_window", "first_compaction_ts"], sessions)
store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                             "cache_read", "cache_5m", "cache_1h", "thinking_ms", "stop_reason"], reqs)
store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                               "is_error", "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed",
                               "result_file", "result_seq", "result_bytes"], tools)
store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], prompts)
store.insert(c, "session_titles", ["session_id", "custom", "agent"], titles)
store.insert(c, "hooks", ["session_id", "ts", "source", "hook", "command", "duration_ms", "is_error"], hooks, tail="")
store.insert(c, "raw_lines", ["key", "file", "line_no", "byte_offset", "type", "session_id", "uuid", "ts", "subagent", "parsed", "json"], raw)

# /context snapshots in three projects, so the Project page can split their starting context
OVERHEAD = {"atlas-api": ["github", "linear", "playwright"], "pixel-studio": ["playwright", "context7"], "ledger-web": ["github", "context7"]}
SKILLS = [("review-change", "userSettings"), ("ship", "userSettings"), ("frontend-design", "plugin")]
snap_rows, part_rows = [], []
for i, (project, servers) in enumerate(OVERHEAD.items()):
    s = next(s for s in reversed(sessions) if s[1] == project and s[11] == "claude")
    uuid = f"demo-context-{i}"
    mcp = [("mcp_tool", f"mcp__{srv}__{name}", srv, rnd.randint(300, 1_800)) for srv in servers for name in ("list", "get", "create", "search")]
    mem = [("memory_file", "/home/demo/.claude/CLAUDE.md", "User", 900),
           ("memory_file", f"/home/demo/code/{project}/CLAUDE.md", "Project", rnd.randint(1_500, 4_000))]
    agents = [("agent", "code-reviewer", "projectSettings", 480)]
    skills = [("skill", name, src, rnd.randint(1_500, 4_500)) for name, src in SKILLS]
    total = lambda parts: sum(p[3] for p in parts)
    used = [("System prompt", 4_107), ("System tools", 12_790), ("MCP tools", total(mcp)), ("MCP server instructions", 300 * len(servers)),
            ("Custom agents", total(agents)), ("Memory files", total(mem)), ("Skills", total(skills)), ("Messages", 2_500)]
    in_use = sum(n for _, n in used)
    cats = [("category", name, None, "used", n) for name, n in used] + [("category", "Autocompact buffer", None, "buffer", 33_000),
                                                                       ("category", "Free space", None, "free", WINDOW["claude"] - in_use - 33_000)]
    snap_rows.append((uuid, s[0], s[5], project, s[2], "2.4.0", s[10], WINDOW["claude"], in_use))
    part_rows += [(uuid, seq, *row) for seq, row in enumerate(cats + [(k, n, d, None, tk) for k, n, d, tk in mcp + mem + agents + skills])]
store.insert(c, "context_snapshots", ["uuid", "session_id", "ts", "project", "cwd", "version", "model", "context_window", "total"], snap_rows)
store.insert(c, "context_parts", ["uuid", "seq", "kind", "name", "detail", "state", "tokens"], part_rows)

# limits: weekly and 5-hour windows, one reading per hour that follows the requests in each window
snaps = []
for provider, lid5, lidw, plan in [("claude", "five_hour", "weekly_all", "max"), ("codex", "codex_primary", "codex_secondary", "pro")]:
    rows = [r for r in reqs if (r[3].startswith("gpt") == (provider == "codex"))]
    for lid, minutes, scale in [(lidw, 10080, 0.03), (lid5, 300, 0.2)]:
        reset = datetime.combine(TODAY - timedelta(days=DAYS), datetime.min.time()) + timedelta(hours=5)
        while reset - timedelta(minutes=minutes) < NOW:
            start = reset - timedelta(minutes=minutes)
            t = start
            while t < min(reset, NOW):
                used = sum(r[7] for r in rows if start <= r[2] < t) * scale / 1000
                if used > 0 or t == start:
                    snaps.append(store.snapshot(provider, lid, "", minutes, reset.replace(tzinfo=timezone.utc), t, min(used, 100), plan, used >= 100))
                t += timedelta(hours=1)
            reset += timedelta(minutes=minutes)
store.write_snapshots(c, snaps)

# /insights facets and session meta for most Claude Code sessions; the newest days and a share of the rest stay unanalysed.
# Three facets belong to worktree sessions whose transcripts are not in the store.
OUTCOMES = [("fully_achieved", 0.66), ("mostly_achieved", 0.17), ("partially_achieved", 0.11), ("not_achieved", 0.04), ("unclear_from_transcript", 0.02)]
HELPFUL = [("essential", 0.2), ("very_helpful", 0.55), ("moderately_helpful", 0.17), ("slightly_helpful", 0.06), ("unhelpful", 0.02)]
TYPES = [("multi_task", 0.4), ("iterative_refinement", 0.3), ("single_task", 0.2), ("quick_question", 0.1)]
GOALS = ["implement_feature", "fix_bug", "write_tests", "refactor_code", "update_docs", "investigate_issue"]
FRICTION = {  # category: made-up details
    "wrong_approach": ["Started with a regex parser before the user pointed at the existing tokenizer.",
                       "Patched the symptom in the view instead of the stale cache underneath."],
    "buggy_code": ["The first patch broke two snapshot tests that it had not run.",
                   "An off-by-one in the pagination cursor skipped the last page."],
    "misunderstood_request": ["Rewrote the whole settings form when only the label text was asked for.",
                              "Opened the pull request against main instead of the release branch the user named."],
    "excessive_changes": ["Reformatted three unrelated files along with the one-line fix.",
                          "Added an unrequested migration guide section to the README."],
    "environment": ["The test runner needed a newer Node than the shell had.", "A missing env var made the dev server fail on start."],
}
facet_rows = []
claude = [s for s in sessions if s[11] == "claude"]
orphans = [(f"demo-wt-{i}", project, NOW - timedelta(days=2 + 3 * i)) for i, project in enumerate(["atlas-api", "ledger-web", "atlas-api"])]
for sid, project, start in [(s[0], s[1], s[4]) for s in claude] + orphans:
    if not sid.startswith("demo-wt") and (start > NOW - timedelta(days=4) or rnd.random() < 0.25):
        continue
    outcome, = pick(OUTCOMES)
    bad = outcome in ("partially_achieved", "not_achieved")
    friction = {}
    for _ in range(rnd.choice([0, 0, 1, 1, 2]) + (1 if bad else 0)):
        k = rnd.choice(list(FRICTION))
        friction[k] = friction.get(k, 0) + rnd.randint(1, 3)
    sat = {"likely_satisfied" if rnd.random() < 0.6 else "satisfied": rnd.randint(1, 3)}
    if bad and rnd.random() < 0.6:
        sat["dissatisfied"] = 1
    goal = rnd.choice(GOALS)
    detail = " ".join(rnd.choice(FRICTION[k]) for k in friction)
    what = rnd.choice(PROMPTS[project]).rstrip("?")
    facet = dict(session_id=sid, underlying_goal=what, goal_categories={goal: 1, **({"write_tests": 1} if rnd.random() < 0.3 else {})},
                 outcome=outcome, user_satisfaction_counts=sat, claude_helpfulness=pick(HELPFUL)[0], session_type=pick(TYPES)[0],
                 friction_counts=friction, friction_detail=detail, primary_success="", brief_summary=f"Asked to {what[0].lower() + what[1:]} in {project}; {'done' if outcome == 'fully_achieved' else 'partly done' if bad else 'mostly done'}.")
    cwd = f"/home/demo/code/{project}" + ("/.claude/worktrees/" + sid if sid.startswith("demo-wt") else "")
    meta = dict(session_id=sid, project_path=cwd, start_time=start.isoformat() + "Z", duration_minutes=rnd.randint(5, 120),
                lines_added=rnd.randint(0, 400), lines_removed=rnd.randint(0, 150), files_modified=rnd.randint(0, 12), git_pushes=rnd.randint(0, 2),
                languages={"TypeScript": rnd.randint(1, 20)}, user_response_times=[rnd.uniform(3, 90) for _ in range(4)],
                destructive_command_count=0, bash_would_prompt_count=rnd.randint(0, 3))
    mtime = (NOW - timedelta(days=1, hours=3)).replace(tzinfo=timezone.utc).timestamp()
    for kind, d in (("facet", facet), ("meta", meta)):
        text = json.dumps(d)
        facet_rows.append((f"/home/demo/.claude/usage-data/{'facets' if kind == 'facet' else 'session-meta'}/{sid}.json", kind, sid, len(text), mtime, text, NOW))
store.insert(c, "usage_files", ["path", "kind", "session_id", "size", "mtime", "json", "ingested_at"], facet_rows)

# Grok sessions, a modest share of the day's sessions (about a third of Codex's). They come last and draw from their own
# random stream, so the Claude and Codex rows above are the same as without them. Grok has no limits, facets, /context
# snapshots, effort, branch or version, and no price in prices.json: each request carries the cost its log reports.
GROK_RATE = 0.08  # Grok sessions per Claude Code or Codex session
GROK_MODEL, GROK_WINDOW = "grok-4.7-build", 256_000
GROK_PRICE = (2.0, 0.5, 6.0)  # USD per million uncached input, cache read, output tokens
GROK_OK = [("read_file", "src/{f}.ts"), ("read_file", "src/{f}.py"), ("search_replace", "src/{f}.ts"), ("search_replace", "src/{f}.py"),
           ("grep", "TODO|FIXME"), ("list_dir", "src"), ("run_terminal_command", "npm test"), ("run_terminal_command", "git status"),
           ("run_terminal_command", "uv run pytest"), ("run_terminal_command", "git diff")]
GROK_FAIL = [("search_replace", "src/{f}.ts", "String to replace not found in file.\nString: const total = items.reduce("),
             ("run_terminal_command", "npm test", "Exit code 1\nFAIL src/cart.test.ts\n  ● cart › applies discount\n    expected 90, received 100\nTests: 1 failed, 41 passed"),
             ("run_terminal_command", "uv run pytest", "Exit code 1\nFAILED tests/test_orders.py::test_rate_limit - AssertionError: 429 != 200\n1 failed, 88 passed"),
             ("read_file", "src/{f}.tsx", "File does not exist."), ("run_terminal_command", "pnpm build", "Exit code 127\nzsh: command not found: pnpm")]
GROK_RESULT = {"read_file": 9_000, "search_replace": 300, "grep": 2_500, "list_dir": 900, "run_terminal_command": 4_000}
grnd = random.Random(11)
g_sessions, g_reqs, g_tools, g_prompts, g_runs = [], [], [], [], []
gn = 0
for d in range(DAYS, -1, -1):
    day = TODAY - timedelta(days=d)
    ramp = 0.5 + 0.8 * (DAYS - d) / DAYS
    for project, (weight, _) in PROJECTS.items():
        expected = weight * ramp * (0.3 if day.weekday() >= 5 else 1) * 0.6 * GROK_RATE / (1 - GROK_RATE)
        for _ in range(int(expected) + (grnd.random() < expected % 1)):
            gn += 1
            sid = f"demo-grok-{gn:04d}"
            start = datetime.combine(day, datetime.min.time()) + timedelta(hours=grnd.choice([9, 10, 11, 14, 15, 16, 21]), minutes=grnd.randrange(60))
            if start > NOW - timedelta(minutes=30):
                continue
            t, ctx, peak = start, int(grnd.gauss(START[project], START[project] * 0.2)), 0
            for p in range(grnd.randint(1, 5)):
                pid = f"{sid}-p{p}"
                g_prompts.append((pid, sid, t, grnd.random() < 0.08))
                turn_start, api_ms = t, 0
                for r in range(grnd.randint(3, 14)):  # a turn is many model calls, a few seconds apart
                    gap = grnd.randint(2, 9)
                    t += timedelta(seconds=gap)
                    api_ms += gap * 1000
                    ctx = min(ctx + grnd.randint(2_000, 12_000), int(GROK_WINDOW * 0.9))
                    peak = max(peak, ctx)
                    cache = int(ctx * grnd.uniform(0.6, 0.95)) if r or p else 0
                    uncached, out = ctx - cache + grnd.randint(50, 800), grnd.randint(100, 2_500)
                    cost = (uncached * GROK_PRICE[0] + cache * GROK_PRICE[1] + out * GROK_PRICE[2]) / 1e6
                    g_reqs.append((f"{sid}-r{p}-{r}", sid, t, GROK_MODEL, None, False, uncached, out, out // 4, cache, 0, 0, None, "end_turn", cost))
                    for k in range(grnd.randint(0, 2)):
                        if grnd.random() < 0.1:
                            tool, inp, err = grnd.choice(GROK_FAIL)
                        else:
                            (tool, inp), err = grnd.choice(GROK_OK), None
                        inp = inp.replace("{f}", grnd.choice(FILES))
                        commit = tool in categorize.SHELL_TOOLS and err is None and grnd.random() < 0.1
                        if commit:
                            inp = "git commit -m \"wip\""
                        test = tool in categorize.SHELL_TOOLS and categorize.runs_tests(inp)
                        size = len(err) if err else min(int(GROK_RESULT[tool] * grnd.lognormvariate(0, 0.7)), 600_000)
                        g_tools.append((f"{sid}-t{p}-{r}-{k}", sid, tool, None, None, inp, t, t + timedelta(milliseconds=grnd.randint(40, 6_000)),
                                        err is not None, err, categorize.categorize(err, tool, inp) if err else None,
                                        "Fixed the input and retried." if err else None, False, commit, test, (test and err is None) or commit,
                                        None, None, size))
                g_runs.append((sid, int(turn_start.replace(tzinfo=timezone.utc).timestamp() * 1000), api_ms))
                t += timedelta(minutes=grnd.randint(2, 20))
            g_sessions.append((sid, project, f"/home/demo/code/{project}", None, start, t, "cli", None, 0, peak, GROK_MODEL, "grok",
                               GROK_WINDOW, None))
store.insert(c, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint", "version",
                             "compactions", "peak_context", "peak_model", "source", "context_window", "first_compaction_ts"], g_sessions)
store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                             "cache_read", "cache_5m", "cache_1h", "thinking_ms", "stop_reason", "reported_cost"], g_reqs)
store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                               "is_error", "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed",
                               "result_file", "result_seq", "result_bytes"], g_tools)
store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], g_prompts)
store.insert(c, "session_runs", ["session_id", "start_ms", "api_ms"], g_runs)


def demo_spans():
    """One Claude Code session, `demo-spans`, of fixed rows and no random stream, so every other row stays as it is. It has
    its own lists and inserts, after every pass above: the limit snapshots read `reqs` and the /context snapshots read
    `sessions`, so a row in either would change them. It holds each case the session sheet's tool-call chart must draw:
    two subagents in parallel and a third later, each with a result file; three main-thread calls at once; a 24.5-minute
    call with nothing starting for 30 minutes (a squeezed gap, 10:00 to 40:10); a main-thread call and a subagent call with
    no result; a failed call with a result but no end time; the last call ending 3 minutes after the last start (55:00)."""
    sid, project, model = "demo-spans", "atlas-api", "claude-opus-5-5"
    t0 = datetime.combine(TODAY - timedelta(days=1), datetime.min.time()) + timedelta(hours=14)

    def at(m, s=0):
        return t0 + timedelta(minutes=m, seconds=s)

    base = "/home/demo/.claude/projects/-home-demo-code-atlas-api/"
    files = {None: base + "demo-spans.jsonl", **{a: f"{base}demo-spans/subagents/agent-{a}.jsonl" for a in "abc"}}
    fail = {"edit": "String to replace not found in file.\nString: const total = items.reduce(",
            "test": "Exit code 1\nFAIL src/cart.test.ts\n  ● cart › applies discount\n    expected 90, received 100\nTests: 1 failed, 41 passed"}
    calls = []

    def call(tool, inp, start, end, err=None, sub=None, result=True):
        """sub: the agent's letter for a subagent call (its result file); result: False for a call with no result."""
        test = tool in categorize.SHELL_TOOLS and categorize.runs_tests(inp)
        end = at(*end) if end else None
        calls.append((f"demo-spans-{len(calls) + 1}", sid, tool, None, None, inp, at(*start), end, (err is not None) if result else None,
                      fail[err] if err else None, categorize.categorize(fail[err], tool, inp) if err else None,
                      "Fixed the input and retried." if err else None, sub is not None, False, test, test and not err,
                      files[sub] if result else None, None, (len(fail[err]) if err else 2_000) if result else None))

    # main thread
    call("Read", "src/router.ts", (0, 10), (0, 12))
    call("Grep", "rateLimit|throttle", (0, 13), (0, 16))
    call("Read", "src/auth.ts", (0, 17), (0, 18))
    call("Read", "src/orders.py", (0, 40), (0, 42))
    call("Grep", "retryAfter", (0, 43), (0, 44))
    call("Read", "tests/test_orders.py", (0, 45), (0, 48))
    call("Agent", "Find how the orders endpoint reads its rate limits and where the limiter belongs", (1, 30), (7, 0))
    call("Agent", "Write tests for the sliding-window limiter and its Retry-After header", (1, 30), (8, 0))
    call("Bash", "npm test", (1, 30), (7, 31), err="test")
    call("Edit", "src/orders.py", (8, 10), (8, 11))
    call("Edit", "src/app.ts", (8, 40), (8, 41), err="edit")
    call("Bash", "npm run test:e2e", (10, 0), (34, 30))
    call("Agent", "Run the full suite against the limiter and list the slow tests", (41, 0), (49, 0))
    call("Bash", "npm run dev", (52, 0), None, result=False)
    call("Bash", "npm run build", (55, 0), (58, 0))
    # subagent a (1:40 to 6:50) and b (1:45 to 7:50), some calls overlapping inside one subagent
    for tool, inp, a, b in [("Read", "src/orders.py", (1, 40), (1, 43)), ("Grep", "rate_limit", (1, 44), (1, 46)),
                            ("Read", "src/limits.py", (1, 50), (1, 52)), ("Grep", "Retry-After", (2, 30), (2, 33)),
                            ("Read", "src/headers.py", (2, 31), (2, 35)), ("Edit", "src/limits.py", (4, 0), (4, 1)),
                            ("Edit", "src/orders.py", (6, 48), (6, 50))]:
        call(tool, inp, a, b, sub="a")
    for tool, inp, a, b in [("Read", "tests/test_orders.py", (1, 45), (1, 47)), ("Grep", "limiter", (2, 10), (2, 12)),
                            ("Write", "tests/test_limits.py", (3, 20), (3, 22)), ("Edit", "tests/test_limits.py", (3, 21), (3, 23)),
                            ("Read", "src/limits.py", (5, 0), (5, 2)), ("Edit", "tests/test_limits.py", (7, 48), (7, 50))]:
        call(tool, inp, a, b, sub="b")
    # subagent c (41:10 to 48:50), then a subagent call with no result file
    for tool, inp, a, b in [("Read", "package.json", (41, 10), (41, 12)), ("Grep", "slow", (41, 30), (41, 33)),
                            ("Edit", "src/limits.py", (45, 0), (45, 2)), ("Read", "src/orders.py", (47, 0), (47, 3)),
                            ("Grep", "p95", (48, 48), (48, 50))]:
        call(tool, inp, a, b, sub="c")
    call("Read", "src/limits.py", (48, 55), None, sub="x", result=False)
    # a failed main-thread call with a result but no end time: a red tick
    call("Bash", "npx vitest run src/cart.test.ts", (8, 20), None, err="test")

    # main-thread requests with a context, then each subagent's own requests
    ctx = [(0, 10, 48_000), (0, 40, 52_000), (1, 30, 61_000), (8, 10, 78_000), (8, 40, 84_000), (10, 0, 90_000), (40, 10, 97_000),
           (41, 0, 104_000), (44, 0, 112_000), (52, 0, 120_000), (55, 0, 126_000)]
    reqs = [(f"demo-spans-r{i}", sid, at(m, s), model, "high", False, 2_000, 1_200, 400, size - 6_000, 4_000, 0, 1_500, "end_turn")
            for i, (m, s, size) in enumerate(ctx)]
    reqs += [(f"demo-spans-s{i}", sid, at(m, s), "claude-haiku-5-5", "high", True, 1_500, 600, 200, 12_000, 2_000, 0, 800, "end_turn")
             for i, (m, s) in enumerate([(1, 42), (3, 30), (5, 40), (1, 48), (4, 10), (6, 30), (41, 15), (45, 0), (48, 0)])]

    store.insert(c, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint", "version",
                                 "compactions", "peak_context", "peak_model", "source", "context_window", "first_compaction_ts"],
                 [(sid, project, f"/home/demo/code/{project}", "feat/rate-limit", t0, at(58), "cli", "2.4.0", 0, 126_000, model,
                   "claude", None, None)])
    store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                                 "cache_read", "cache_5m", "cache_1h", "thinking_ms", "stop_reason"], reqs)
    store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                                   "is_error", "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed",
                                   "result_file", "result_seq", "result_bytes"], calls)
    store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"],
                 [(f"{sid}-p0", sid, t0, False), (f"{sid}-p1", sid, at(40), False)])
    store.insert(c, "session_titles", ["session_id", "custom", "agent"],
                 [(sid, None, "Add sliding-window rate limiting to the orders endpoint and run the e2e suite")])
    store.insert(c, "raw_lines", ["key", "file", "line_no", "byte_offset", "type", "session_id", "uuid", "ts", "subagent", "parsed", "json"],
                 [(f"{sid}-raw", None, 0, 0, "user", sid, f"{sid}-p0", t0.isoformat(), False, True,
                   json.dumps({"promptId": f"{sid}-p0", "message": {"content": "Add rate limiting to the /orders endpoint"}}))])


def demo_tree():
    """One live Claude Code session, `demo-tree`, for the Live page's Tree: fixed rows after every pass above, as
    demo_spans does, so every other row stays as it is. Its Agent call and the Agent call of its subagent both run (a
    subagent with a subagent of its own), two Agent calls finished (two done agents), and a delegation call has a task
    running on another provider. It has a line within the last ACTIVE (10 minutes) of the seed, so the Live page lists it
    for that long after `seed.py`; run seed.py again to see it later."""
    sid, project, model = "demo-tree", "atlas-api", "claude-opus-5-5"
    t0 = NOW - timedelta(minutes=8)
    lanes = {"a": "tree-a", "b": "tree-b", "c": "tree-c", "d": "tree-d"}  # the lane ids: Claude Code's agent ids
    calls, spawns, n = [], [], 0

    def at(m, s=0):
        return t0 + timedelta(minutes=m, seconds=s)

    def call(tool, inp, start, end, lane=None, spawn=None, **cols):
        """spawn: the spawns row of a call that starts an agent (agent) or delegates a task (kind delegation)."""
        nonlocal n
        n += 1
        cid = f"demo-tree-{n}"
        calls.append((cid, sid, tool, cols.get("mcp_server"), None, inp, at(*start), at(*end) if end else None, False if end else None,
                      None, None, None, lane is not None, False, False, False, None, None, 2_000 if end else None, lane))
        if spawn:
            kind = spawn.get("kind", "subagent")
            spawns.append((cid, sid, kind, lane, tool, inp, at(*start), spawn.get("agent"), spawn.get("provider"), spawn.get("model"),
                           spawn.get("status")))

    call("Read", "src/orders/router.ts", (0, 5), (0, 7))
    call("Grep", "rateLimit|throttle", (0, 20), (0, 23))
    call("Agent", "Find how the orders endpoint reads its rate limits and where the limiter belongs", (1, 0), None,
         spawn=dict(agent=lanes["a"]))
    call("Agent", "List every caller of the orders router", (1, 10), (3, 0), spawn=dict(agent=lanes["c"]))
    call("Agent", "Check the limiter config against the staging values", (1, 20), (4, 30), spawn=dict(agent=lanes["d"]))
    # subagent a, which starts subagent b
    call("Grep", "rate_limit", (1, 5), (1, 8), lane=lanes["a"])
    call("Read", "src/limits.py", (1, 30), (1, 33), lane=lanes["a"])
    call("Agent", "Read the sliding-window helper and say whether it is thread safe", (2, 30), None, lane=lanes["a"],
         spawn=dict(agent=lanes["b"]))
    call("Read", "src/window.py", (2, 40), (2, 43), lane=lanes["b"])
    call("Grep", "Lock|threading", (3, 20), (3, 22), lane=lanes["b"])
    call("Edit", "src/limits.py", (5, 0), (5, 2), lane=lanes["a"])
    # the two finished subagents
    for tool, inp, a, b in [("Grep", "ordersRouter", (1, 15), (1, 17)), ("Grep", "app.use(", (1, 40), (1, 42)), ("Read", "src/server.ts", (2, 20), (2, 23))]:
        call(tool, inp, a, b, lane=lanes["c"])
    for tool, inp, a, b in [("Read", "config/staging.json", (1, 25), (1, 27)), ("Grep", "limit", (2, 0), (2, 3)), ("Read", "src/limits.py", (4, 0), (4, 3))]:
        call(tool, inp, a, b, lane=lanes["d"])
    # a delegated task on another provider; its result says the task was accepted and is still running
    call("mcp__t3-code__delegate_task", "Add a Retry-After header test", (6, 0), (6, 1), mcp_server="t3-code",
         spawn=dict(kind="delegation", provider="codex", model="gpt-6.2-sol", status="running"))
    call("Edit", "src/orders/router.ts", (6, 30), (6, 31))

    reqs = [(f"demo-tree-r{i}", sid, at(m, s), model, "high", False, 2_000, 900, 300, size - 6_000, 4_000, 0, 1_200, "end_turn", None, None, None)
            for i, (m, s, size) in enumerate([(0, 5, 52_000), (1, 0, 61_000), (6, 0, 78_000), (7, 0, 84_000)])]
    for i, (m, s, lane) in enumerate([(1, 6, "a"), (1, 31, "a"), (2, 41, "b"), (3, 21, "b"), (1, 16, "c"), (2, 21, "c"), (1, 26, "d"), (2, 1, "d"), (4, 1, "d")]):
        reqs.append((f"demo-tree-s{i}", sid, at(m, s), "claude-haiku-5-5", "high", True, 1_500, 600, 200, 12_000, 2_000, 0, 800, "end_turn",
                     None, None, lanes[lane]))
    cols = ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking", "cache_read", "cache_5m",
            "cache_1h", "thinking_ms", "stop_reason", "reported_cost", "context_tokens", "lane"]
    store.insert(c, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint", "version",
                                 "compactions", "peak_context", "peak_model", "source", "context_window", "first_compaction_ts"],
                 [(sid, project, f"/home/demo/code/{project}", "feat/rate-limit", t0, NOW, "cli", "2.4.0", 0, 84_000, model, "claude", None, None)])
    store.insert(c, "requests", cols, reqs)
    store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                                   "is_error", "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed",
                                   "result_file", "result_seq", "result_bytes", "lane"], calls)
    store.insert(c, "spawns", ["call_id", "session_id", "kind", "lane", "tool", "description", "start_ts", "agent", "provider", "model", "status"],
                 spawns)
    store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], [(f"{sid}-p0", sid, t0, False)])
    store.insert(c, "session_titles", ["session_id", "custom", "agent"], [(sid, None, "Add sliding-window rate limiting to the orders endpoint")])


demo_spans()
demo_tree()
insights.rederive(c)
print(f"{len(sessions)} sessions, {len(reqs)} requests, {len(tools)} tool calls, {len(snaps)} limit snapshots, {len(facet_rows) // 2} facets; "
      f"{len(g_sessions)} Grok sessions, {len(g_reqs)} requests")
