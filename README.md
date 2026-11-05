# Claude errors dashboard

A local app that keeps a permanent copy of your Claude Code transcripts (`~/.claude/projects`) in a DuckDB store and serves two dashboards on it:

- **Usage**: tokens by kind, estimated cost, cache efficiency, subagent share, context health, autonomy and friction, time, and outcomes (commits, test runs) per project and session.
- **Errors**: failed tool calls grouped into error types with suggested fixes, and the error rate over time.

## Usage

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

Options: `--projects <dir>` (transcript root), `--db <file>` (database, default `data/claude.duckdb`).

The app listens on `127.0.0.1:8765` only. Use that address, not `localhost`: fix markers live in that browser origin, so the app redirects `localhost` there.

## Pages

Both pages share the top bar. Switching pages keeps the selected project and time range (`#project=…&range=…`).

**Usage** (`/usage`): pick a project and a range (7, 14, 30, 90 days or all). Click a project row to filter, or a session to open its details. The URL holds `project`, `range` and `session`, so a copied URL reopens the same view. Cost is an estimate at API list prices from `prices.json`; models missing there are named on the page and left out of cost totals.

**Errors** (`/errors`): each example has a permalink (`#ex=<tool_use_id>`, the "Copy URL" button) and each error type has one (`#cat=<type>`), so you can paste a specific error into an agent prompt. The tool_use_id also lets an agent find the call in the transcripts with `grep -r <id> ~/.claude/projects`. Fixes you mark as applied are stored in the browser's localStorage, so the chart shows a marker on that date and the before/after error rate. Error loops on the usage page link here.

## Files

- `app.py` — the app: HTTP server, background ingest, `ingest` and `rebuild` commands.
- `store.py` — the store: raw lines, incremental ingest, project resolution, derived tables (sessions, requests, tool calls, prompts, hooks).
- `categorize.py` — error categories. Add a rule to `RULES` when a new error pattern shows up in "Other", then run `rebuild`.
- `metrics.py` — the queries behind both dashboards.
- `prices.json` — per-model prices (USD per million tokens) and context windows.
- `usage.html`, `dashboard_template.html`, `nav.html` — the Usage page, the Errors page and their shared top bar.
- `data/claude.duckdb` — the store, git-ignored and readable only by you. It holds full transcript content, including any secrets that appeared in sessions.
