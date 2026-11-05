# Tasks

## 1. Setup and raw store

- [x] 1.1 Add `pyproject.toml` with `duckdb` pinned, add `data/` to `.gitignore`, and verify `uv sync` succeeds and `uv run python -c "import duckdb"` works
- [x] 1.2 Create the store module: open or create `data/claude.duckdb` (directory `0700`, file `0600`), create `files` and `raw_lines` with the dedup `key`, and verify with a unittest that checks the schema and file modes
- [x] 1.3 Implement incremental raw ingest (read from offset to last newline, reset on shrink, one transaction per file, `ON CONFLICT DO NOTHING`, mark malformed lines unparsed). Verify with unittests over fixture JSONL files: growth, partial last line, shrink, duplicate `uuid` across files, duplicate blob `hash`, malformed line, deleted source file keeps rows. Then run a full ingest of `~/.claude/projects` and record the time and database size in design.md

## 2. Derived tables and project identity

- [x] 2.1 Move `RULES` and the parsing helpers out of `build_dashboard.py` into a categorization module that ingest imports, and verify that categorizing the same transcripts gives the same per-category counts as `build_dashboard.py` on the commit before this change
- [x] 2.2 Implement project resolution (temp dirs as `(temp)`, `git --git-common-dir` with a short timeout, worktree path fallback, cached per `cwd`), and verify with unittests for a real worktree, a missing directory, a `.claude/worktrees` path and a temp path
- [x] 2.3 Write `sessions`, `requests` (one row per `message.id`), `tool_calls`, `prompts` and `hooks` during ingest, and verify with unittests: three `assistant` lines with one `message.id` count usage once; a `tool_use` and `tool_result` pair gives one tool call with latency and category; `git commit` and test runs are flagged; `compact_boundary` increments `compactions`
- [x] 2.4 Implement `rebuild` (drop derived tables, replay `raw_lines` in file and offset order), and verify that derived row counts after a rebuild equal the counts after incremental ingest, including for a deleted source file

## 3. App and errors dashboard

- [x] 3.1 Implement `app.py` on `ThreadingHTTPServer` bound to `127.0.0.1:8765`: startup ingest, 60-second background ingest with a lock, `POST /api/refresh`, `/api/status`, and a `localhost` to `127.0.0.1` redirect. Verify that the app refuses connections on the LAN address, and that a new transcript line shows in `/api/status` counts within one interval
- [x] 3.2 Add `app.py ingest` and `app.py rebuild` commands that exit 1 with the "app owns the store" message when the app is running, and verify both cases by hand
- [x] 3.3 Serve `/api/errors` in the current payload shape from `tool_calls`, and change `dashboard_template.html` to fetch it instead of reading the injected data. Verify in the browser that categories, `#ex=` and `#cat=` permalinks and existing applied-fix markers work, and that error counts match task 2.1
- [x] 3.4 Remove static HTML output from `build_dashboard.py` (or remove the file if nothing is left), update `.claude/launch.json` to `uv run app.py`, and update README usage. Verify the README commands run as written

## 4. Usage dashboard and navigation

- [x] 4.1 Add `prices.json` with per-model prices and context limits taken from Anthropic's pricing page, and verify every model present in `requests` is either priced or reported as unpriced by `/api/usage`
- [x] 4.2 Implement `/api/usage` with project and range filters: token kinds per day, cost, cache hit ratio and 1h write share, subagent share, peak context and compactions, tokens per prompt, turns and tool calls per prompt, interruption rate, error loops, session duration and thinking time, tool latency p50/p95, commits, test pass/fail, per-commit ratios (null when no commits), model and effort mix, tool, MCP, skill and hook failure rates. Verify with unittests over a fixture database with known values for each metric
- [x] 4.3 Build the usage page (KPI tiles, daily token and cost chart, per-project comparison table, session list with drill-in), reusing the errors page's styles and theme tokens, with `project`, `range` and `session` in the URL hash. Verify in the browser at desktop and phone width, in light and dark mode, and that a copied URL restores the view
- [x] 4.4 Add the shared `nav.html` partial to both pages, carrying `project` and `range` across. Verify in the browser that switching Usage to Errors keeps the project and range and drops `ex`, `cat` and `session`, and document both pages in the README

## 5. Integration check

- [x] 5.1 From a clean `data/`, run `uv run app.py` against the real transcripts. Verify the first ingest completes, an empty refresh takes under 5 seconds, a live Claude Code session shows up without a restart, both dashboards load, and totals on the usage page match a direct DuckDB query on `requests`

## Workflow follow-up

- Archive the change with `/opsx:archive` after review.
