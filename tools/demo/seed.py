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
CODEX_MODELS = [("gpt-6.1-sol", "high", 0.7), ("gpt-6-astra", "medium", 0.3)]

# (tool, input, error text or None) templates; errors are categorized with the app's own rules
OK = [("Read", "src/{f}.ts"), ("Read", "src/{f}.py"), ("Edit", "src/{f}.ts"), ("Edit", "src/{f}.py"), ("Grep", "TODO|FIXME"),
      ("Glob", "src/**/*.ts"), ("Bash", "npm test"), ("Bash", "git status"), ("Bash", "uv run pytest"), ("Bash", "git diff"),
      ("Write", "src/{f}.test.ts"), ("WebFetch", "https://developer.mozilla.org/en-US/docs/Web/API"), ("Task", "Explore the codebase")]
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
            t, ctx, peak, compactions = start, 20_000, 0, 0
            commits = 0
            for p in range(n_prompts):
                pid = f"{sid}-p{p}"
                interrupted = rnd.random() < 0.08
                prompts.append((pid, sid, t, interrupted))
                if p == 0:
                    text = rnd.choice(PROMPTS[project])
                    raw.append((f"{sid}-raw", None, 0, 0, "user", sid, pid, t.isoformat(), False, True,
                                json.dumps({"promptId": pid, "message": {"content": text}})))
                for r in range(rnd.randint(2, 9)):
                    t += timedelta(seconds=rnd.randint(8, 90))
                    sub = source == "claude" and rnd.random() < 0.15
                    m = "claude-haiku-5-5" if sub else model
                    ctx = min(ctx + rnd.randint(3_000, 18_000), 900_000)
                    if ctx > 700_000 and rnd.random() < 0.3:
                        ctx, compactions = 40_000, compactions + 1
                    peak = max(peak, ctx)
                    out = rnd.randint(300, 4_000)
                    reqs.append((f"{sid}-r{p}-{r}", sid, t, m, effort, sub, rnd.randint(50, 3_000), out, out // 3,
                                 ctx, rnd.randint(500, 8_000), rnd.randint(0, 6_000), rnd.randint(0, 9_000), "end_turn"))
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
                        test = tool in categorize.SHELL_TOOLS and bool(categorize.TEST_CMD.search(inp))
                        mcp = "github" if tool.startswith("mcp__") else None
                        skill = rnd.choice(["review-change", "ship", "frontend-design"]) if tool == "Read" and rnd.random() < 0.05 else None
                        if skill:
                            tool, inp = "Skill", skill
                        cat = categorize.categorize(err, tool, inp) if err else None
                        follow = "Fixed the old_string and retried." if err else None
                        tools.append((tid, sid, tool, mcp, skill, inp, t, end, err is not None, err, cat, follow, sub,
                                      commit, test, (test and err is None) or commit, None, None))
                if rnd.random() < 0.5:
                    hooks.append((sid, t, "stop_summary", "Stop", "notify.sh", rnd.randint(40, 400), rnd.random() < 0.04))
                t += timedelta(minutes=rnd.randint(2, 25))
            sessions.append((sid, project, f"/home/demo/code/{project}", rnd.choice(["main", "feat/rate-limit", "fix/undo", "feat/export"]),
                             start, t, "cli", "2.4.0", compactions, peak, model, source))

store.insert(c, "sessions", ["session_id", "project", "cwd", "git_branch", "first_ts", "last_ts", "entrypoint", "version",
                             "compactions", "peak_context", "peak_model", "source"], sessions)
store.insert(c, "requests", ["message_id", "session_id", "ts", "model", "effort", "subagent", "input", "output", "thinking",
                             "cache_read", "cache_5m", "cache_1h", "thinking_ms", "stop_reason"], reqs)
store.insert(c, "tool_calls", ["tool_use_id", "session_id", "tool", "mcp_server", "skill", "input_summary", "start_ts", "end_ts",
                               "is_error", "error", "category", "followup", "subagent", "is_commit", "is_test", "test_passed",
                               "result_file", "result_seq"], tools)
store.insert(c, "prompts", ["prompt_id", "session_id", "ts", "interrupted"], prompts)
store.insert(c, "hooks", ["session_id", "ts", "source", "hook", "command", "duration_ms", "is_error"], hooks, tail="")
store.insert(c, "raw_lines", ["key", "file", "line_no", "byte_offset", "type", "session_id", "uuid", "ts", "subagent", "parsed", "json"], raw)

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
insights.rederive(c)
print(f"{len(sessions)} sessions, {len(reqs)} requests, {len(tools)} tool calls, {len(snaps)} limit snapshots, {len(facet_rows) // 2} facets")
