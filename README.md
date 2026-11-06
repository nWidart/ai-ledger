# AI Ledger

A local ledger of your AI coding-agent transcripts (today Claude Code, from `~/.claude/projects`). It keeps a permanent copy of them in a DuckDB store and serves three dashboards on it:

- **Activity**: what Claude did and where it struggled: commits, prompts and sessions, what needs attention (error loops, sessions near the context limit, flaky tools, failed tests), context health, autonomy and friction, time, and tool, MCP, skill and hook use per project and session.
- **Cost**: what it cost and why that changed: estimated cost against the previous period, tokens by kind, cache efficiency, model mix, and cost per project, session and commit.
- **Errors**: failed tool calls grouped into error types with suggested fixes, and the error rate over time.

## Usage

Needs Python 3.14 or newer (`uv sync` installs it): Codex archives are read with the standard library's `compression.zstd`.

```bash
uv sync
uv run app.py
open http://127.0.0.1:8765/
```

The first start ingests every transcript (about 4 minutes for 3.4 GB). After that the app ingests new transcript lines every 60 seconds; **Refresh** in the top bar ingests now. The store keeps lines after Claude Code deletes the transcript files.

Commands, which only run while the app is stopped (the app owns the store):

```bash
uv run app.py ingest    # ingest new transcript lines once
uv run app.py rebuild   # regenerate derived tables from the stored lines, e.g. after a parser change
uv run python -m unittest discover -s tests
```

Options: `--projects <dir>` (transcript root), `--db <file>` (database, default `data/ai-ledger.duckdb`).

The app listens on `127.0.0.1:8765` only. Use that address, not `localhost`: fix markers live in that browser origin, so the app redirects `localhost` there.

## Pages

All pages share the top bar. Switching pages keeps the selected project, time range, source and automated-sessions choice (`#project=…&range=…&source=…&auto=1`). `/` opens Activity.

Every page has a source filter: All, Claude Code or Codex (`source=claude` or `source=codex`; All leaves it out of the URL).

Activity and Cost share their filters: a project and a range (7, 14, 30, 90 days or all). Click a project or a session to open its details in a side sheet; the sheet offers a button to filter the page to that project. The URL holds `project`, `range`, `inspect` (the open project) and `session`, so a copied URL reopens the same view, and browser Back retraces filter and sheet changes. A session's details show its first prompt, a timeline of context size per request with tool calls, failures, compactions and commits, and a list of those events; failures link to the Errors page.

Sessions that a tool starts in the background (the projects in `AUTOMATED_PROJECTS` in `metrics.py`, today claude-mem's `observer-sessions`) are left out of Activity and Cost unless you tick **Include automated sessions**, or filter to that project.

**Activity** (`/usage`): the heading gives the commits, prompts and sessions of the view, followed by what needs attention, each with a link to its table. A chart shows commits, prompts or sessions per day with failed tool calls; select a day to list its sessions. Below: sessions, per-project metrics, tools, MCP servers, skills and hooks, and error loops.

**Cost** (`/cost`): the heading gives the estimated cost and compares it with the equal period before; "What changed" shows each project's share of that change. Cost is an estimate at API list prices from `prices.json`; models missing there are named on the page and left out of cost totals. Below: cost per day by project, where the spend went, models and effort, tokens and cache, cost per project and the most expensive sessions.

**Errors** (`/errors`): each example has a permalink (`#ex=<tool_use_id>`, the "Copy URL" button) and each error type has one (`#cat=<type>`), so you can paste a specific error into an agent prompt. The tool_use_id also lets an agent find the call in the transcripts with `grep -r <id> ~/.claude/projects`. Fixes you mark as applied are stored in the browser's localStorage, so the chart shows a marker on that date and the before/after error rate. Error loops on the Activity page link here. Inside an error type, failures are grouped into incidents: failures of the same tool with the same error type in one session, each within 10 minutes of the last. An incident counts as recovered when the tool's next call in that session succeeds.

## Files

- `app.py` — the app: HTTP server, background ingest, `ingest` and `rebuild` commands.
- `store.py` — the store: raw lines, incremental ingest, project resolution, derived tables (sessions, requests, tool calls, prompts, hooks).
- `categorize.py` — error categories. Add a rule to `RULES` when a new error pattern shows up in "Other", then run `rebuild`.
- `metrics.py` — the queries behind the dashboards.
- `prices.json` — per-model prices (USD per million tokens) and context windows.
- `web/` — the pages: one React and TypeScript app (Vite). `web/src/pages/` holds Activity, Cost and Errors, `web/src/components/` the shared top bar, filters, sheets, drawers and charts, and `web/src/theme.css` the colors for light and dark. `web/dist/` is the committed build that the app serves.
- `data/ai-ledger.duckdb` — the store, git-ignored and readable only by you. It holds full transcript content, including any secrets that appeared in sessions.

## Renamed from claude-errors-dashboard

The app was called `claude-errors-dashboard` and kept its store in `data/claude.duckdb`. On start it moves that file, and its `.wal`, to `data/ai-ledger.duckdb`. It never creates an empty store next to it. Sessions run in the old folder belong to project `ai-ledger` (`PROJECT_ALIASES` in `store.py`). Browser state (applied fixes, saved views) is kept.

To rename the folder:

1. Start the app once from the old folder, so the store moves and the project names are rewritten. Then stop it.
2. Stop every agent session that runs in the folder.
3. `mv ~/Sites/projects/claude-errors-dashboard ~/Sites/projects/ai-ledger`
4. Move the Claude Code memory for this project, which is kept per folder path: `mkdir -p ~/.claude/projects/-Users-<you>-Sites-projects-ai-ledger && mv ~/.claude/projects/-Users-<you>-Sites-projects-claude-errors-dashboard/memory ~/.claude/projects/-Users-<you>-Sites-projects-ai-ledger/`. Leave the transcript `.jsonl` files where they are: ingest reads every folder under `~/.claude/projects`.
5. Run `uv sync` in the new folder (the virtualenv holds absolute paths). Repoint anything that opens the old path, such as your editor or shell aliases, then start the app.

## Develop the pages

Running the app needs only Python. Changing the pages needs Node:

```bash
cd web
npm install
npm run dev      # http://127.0.0.1:5173/usage, with /api proxied to the app on 127.0.0.1:8765 (start the app first)
npm run check    # typecheck, tests and build: run it before committing
```

Commit `web/dist/` with the source change. `npm run build` writes `web/dist/source-hash.txt`, and `tests/test_web_build.py` fails when the sources no longer match the build. `tests/test_web_fixtures.py` regenerates the API fixtures in `web/src/__fixtures__/` that the page tests use.

The dev server is a different browser origin, so fixes marked as applied there are kept apart from the ones on `127.0.0.1:8765`.
