# Proposal

## Why

The errors dashboard re-parses all transcripts (3.4 GB today) on every build and only looks at failed tool calls. It says nothing about token usage, cost, cache efficiency or outcomes per project. Claude Code also deletes transcripts after `cleanupPeriodDays`, so history older than 30 days was being lost (the oldest surviving transcript was 33 days old). `cleanupPeriodDays` is now set to 36500, but transcripts remain a fragile, unindexed source. A local store that keeps every transcript line permanently, plus a usage dashboard on top of it, turns this into a durable record of how Claude works in each project.

## What Changes

- Add a local DuckDB store that keeps every transcript line verbatim (full request and response bodies), deduplicated, and never deletes data when a source transcript disappears.
- Add incremental ingest: only new bytes of each transcript file are read, so a refresh takes seconds instead of a full rescan.
- Add derived tables (sessions, requests, tool calls, prompts) built during ingest and rebuildable from the raw lines.
- Resolve worktrees to their repository, so one repo shows as one project.
- Add a usage dashboard with per-project metrics: tokens by kind, estimated cost, cache efficiency, context health, autonomy and friction, time, and outcomes (commits, test runs).
- Add one local app, bound to `127.0.0.1`, that owns the database, runs ingest, and serves both dashboards behind a shared navigation.
- **BREAKING**: the errors dashboard reads from the store and is served by the app. `build_dashboard.py` no longer writes a static `claude-errors.html`. Error categories, permalinks (`#ex=`, `#cat=`) and applied-fix markers keep working.
- Add `duckdb` as the project's first dependency, managed with `uv`.

## Capabilities

### New Capabilities

- `transcript-store`: durable local storage of every Claude Code transcript line, incremental ingest, deduplication, project identity, and derived tables.
- `usage-dashboard`: per-project usage, cost, efficiency and outcome metrics, and how they are shown.
- `dashboard-app`: the local app that owns the store, schedules ingest, serves the Errors and Usage dashboards with shared navigation, and keeps transcript data local.

### Modified Capabilities

None. No specs exist yet. The errors dashboard has no spec; its move onto the store is covered by `dashboard-app`.

## Impact

- Code: new store, ingest and app modules; `build_dashboard.py` becomes the error-categorization module used by ingest; `dashboard_template.html` loads data from the app instead of an injected payload; new usage page template.
- Dependencies: `duckdb` (Python package), `uv` for running the app. Python 3 stdlib otherwise.
- Data: a new database file under `data/`, git-ignored, readable only by the user. It holds full transcript content, including any secrets that appeared in sessions.
- Tooling: `.claude/launch.json` starts the app instead of `python3 -m http.server`. README usage changes.
- Global config (already done, outside this repo): `cleanupPeriodDays: 36500` in `~/.claude/settings.json`.
