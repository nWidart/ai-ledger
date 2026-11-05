# Design

## Context

See proposal.md for motivation. Current state that shapes the approach:

- `build_dashboard.py` globs `~/.claude/projects/*/*.jsonl` and `*/*/subagents/*.jsonl`, parses every line on each run, categorizes failed tool calls with `RULES`, and injects a JSON payload into `dashboard_template.html` at `/*__DATA__*/null`. The page keeps applied-fix markers in `localStorage` and permalinks in the URL hash.
- `.claude/launch.json` serves the folder with `python3 -m http.server 8765 --bind 127.0.0.1`. Applied-fix markers live in the `http://127.0.0.1:8765` origin.
- Transcripts (2860 files, 3.4 GB) hold everything needed. `assistant` lines carry `message.id`, `requestId`, `usage` (input, output, `output_tokens_details.thinking_tokens`, cache read, `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`), `thinkingDurationMs`, `isSidechain`, `cwd`, `gitBranch`. `api-request` lines carry `params.model`, `output_config.effort`, `shapeHash` and `tail` (a list of blob hashes). `api-request-blob` lines are already content-addressed by `hash`. `system` lines include `compact_boundary`, `turn_duration` and `stop_hook_summary` (hook timings and errors).
- Claude Code writes one `assistant` line per content block, and each line repeats the same `usage`. Summing per line overcounts.
- Project directories include 44 worktree paths and many throwaway temp-dir sessions (`/private/var/folders/...`).
- A 29.3 MB transcript compresses to 6.8 MB with zstd -19, since requests repeat the same context.

## Goals / Non-Goals

**Goals:**
- One local process, one database file, one new dependency.
- Refresh in seconds after the first full ingest.
- Raw lines are the source of truth. Derived tables can be thrown away and rebuilt.
- Keep the errors dashboard's look, behavior, permalinks and stored fix markers.

**Non-Goals:**
- Multiple machines, remote access, auth, or a hosted deployment.
- Capturing traffic outside transcripts (for example through the `ANTHROPIC_BASE_URL` proxy).
- Sentiment or quality scoring of prompts.
- Real billing figures. Cost is an estimate at API list prices.
- A frontend framework or build step.

## Decisions

### DuckDB as the store
Use one DuckDB file at `data/claude.duckdb`.
- Column storage compresses the repeated JSON text well, and analytics queries (group by project, day, model) are fast.
- `duckdb` is a single Python wheel with no server.
- Alternatives: SQLite (stdlib, but row storage compresses repeated text poorly and aggregate queries over millions of rows are slower); Postgres or ClickHouse (a server to run for a one-user, one-machine tool).
- Constraint accepted: DuckDB allows one writing process. The app is that process (see below).

### Raw layer
Table `raw_lines`: `key` (unique), `file`, `line_no`, `byte_offset`, `type`, `session_id`, `uuid`, `ts`, `subagent`, `parsed` (bool), `json` (original text).
- `key` is the dedup identity: `uuid` when present; `blob:<hash>` for `api-request-blob`; `shape:<shapeHash>` for `api-request-shape`; otherwise `<file>:<byte_offset>`.
- Insert with `ON CONFLICT (key) DO NOTHING`. Copied lines in resumed sessions become no-ops.
- Use DuckDB's zstd compression for the `json` column. Task 1.3 measures the final size; expect well under the raw 3.4 GB.

Table `files`: `path`, `size`, `read_offset`, `mtime`, `last_ingest`. Rows are never deleted, so missing files keep their history.

### Incremental ingest
For each file: if `size < read_offset`, reset to 0. Otherwise seek to `read_offset`, read to the last `\n`, and process those lines. Commit the raw rows, derived rows and the new `read_offset` in one transaction per file, so a crash never leaves offsets ahead of data.

### Derived layer, written during ingest
Ingest parses each new line once in Python and writes derived rows next to the raw row. A `rebuild` command drops the derived tables and replays them from `raw_lines` ordered by `file, byte_offset`, so it works for deleted transcripts.
- Alternative: derive with SQL views over `raw_lines.json`. Rejected for the main tables: tool_use and tool_result pairing, error categorization (`RULES` are Python lambdas) and follow-up text all need ordered stateful parsing that already exists in Python. Ad hoc questions can still use DuckDB's JSON functions on `raw_lines`.

Tables:
- `sessions`: `session_id`, `project`, `cwd`, `git_branch`, `first_ts`, `last_ts`, `entrypoint`, `version`, `compactions`, `peak_context`.
- `requests`: one row per `message.id` (first line wins), with `session_id`, `ts`, `model`, `effort`, `subagent`, every token kind, `thinking_ms`, `stop_reason`.
- `tool_calls`: `tool_use_id` (unique), `session_id`, `tool`, `mcp_server`, `input_summary`, `start_ts`, `end_ts`, `is_error`, `error`, `category`, `followup`, `subagent`, `is_commit`, `is_test`, `test_passed`.
- `prompts`: one row per user-typed prompt (`promptId`), with `session_id`, `ts`, `interrupted`.
- `hooks`: per `stop_hook_summary` entry, with command, duration and error flag.

`tool_calls` replaces today's `errors` list and per-day call counts. The errors API produces the same JSON shape the template reads today, so the template changes only in how it loads data.

### Project identity
Resolve once per distinct `cwd` and cache the result in a `projects_by_cwd` table, so the answer stays stable after the directory disappears.
1. Path under a system temp dir (`/private/var/folders/`, `/tmp/`, the Claude scratchpad): project `(temp)`.
2. Directory exists and `git -C <cwd> rev-parse --path-format=absolute --git-common-dir` succeeds: basename of the common dir's parent (the main checkout).
3. Otherwise: strip worktree segments (`/.claude/worktrees/…` as today, plus `/worktrees/…`) and use the basename.

### Metrics
- Computed with SQL over the derived tables at request time. Data is small enough after ingest that pre-aggregation is not needed.
- Cost: `prices.json` in the repo maps model ids to USD per million tokens for input, output, cache read, 5m write and 1h write. Prices come from Anthropic's published pricing page when implemented, not from memory. Thinking tokens are part of output tokens.
- Peak context: the largest `input + cache_read + cache_write` of any request in a session. Context limit per model also lives in `prices.json`.
- Commit: a successful Bash call whose command runs `git commit`. Test run: a call matching the existing `tests` rule's command pattern; passed means no error.
- Error loop: three or more consecutive failed calls of the same tool within one session, ordered by `start_ts`.
- Interruption: a user line with `Request interrupted by user`, or a tool result in the `user_denied` category.

### App
One Python process (`app.py`) using the stdlib `ThreadingHTTPServer` on `127.0.0.1:8765`.
- Keeping host and port keeps the `localStorage` origin, so applied-fix markers survive.
- One DuckDB connection; each request thread uses its own `cursor()`. A background thread ingests at startup and every 60 seconds. `POST /api/refresh` triggers it now. A lock prevents overlapping ingests.
- Routes: `/` redirects to `/usage`; `/errors` and `/usage` serve the HTML pages; `/api/errors`, `/api/usage?…`, `/api/status` return JSON.
- Alternative: FastAPI or Flask. Rejected: a second dependency for about six routes on localhost.
- CLI: `app.py ingest` and `app.py rebuild` open the database for writing. If the app holds the lock, DuckDB raises an error; catch it and exit 1 with "the app is running and owns the store; use Refresh in the dashboard".

### Shared navigation
A small `nav.html` partial with Errors and Usage links, inserted by the server into both pages. Pages keep `project` and `range` in the hash. Nav links copy those two keys across, so switching pages keeps the selection. Page-specific keys (`ex`, `cat`, `session`) are not copied.

### Packaging
`pyproject.toml` with `duckdb` pinned, run with `uv run app.py`. `.claude/launch.json` runs that. `data/` is git-ignored; the app creates it with mode `0700` and the database with `0600`.

## Measurements

First full ingest, 2026-11-05, of 2870 files (3.4 GB, a clone of `~/.claude/projects`):
- 238 seconds; 450,126 lines read, 445,076 stored after deduplication (1%).
- An empty refresh (nothing changed) takes 0.04 seconds.
- Database size: 2.2 GB. The stored text is 3.56 GB; 3.0 GB of it is in 77,753 lines over 4 KB (mostly `user` tool results at 2.1 GB, request blobs at 0.5 GB). DuckDB compresses each large string on its own, so it keeps about 62% of the text, not the 23% that whole-file zstd reaches. That is about 2.2 GB per month at the current rate, more than the 1 GB per month expected below.

Implementation notes:
- `api-request` lines carry an `id` and no `uuid`, so their dedup key is `req:<id>`.
- Hooks come from `stop_hook_summary` (command and duration) and from hook attachments (`hook_success`, `hook_*_error`, `hook_cancelled`), which name the hook event. `stop_hook_summary` lists errors without naming the hook, so there a hook counts as failed when errors were reported and it has no duration.
- A prompt is a `user` line in the main thread with a `promptId`, text content and no tool result, that is not `isMeta` and whose `origin.kind` is missing or `human`. An interruption marks the prompt with the same `promptId`.

## Risks / Trade-offs

- [The first full ingest of 3.4 GB is slow] → It runs once. Log progress per file, commit per file so an interrupted run resumes where it stopped.
- [The transcript format changes in a new Claude Code version] → Raw lines are kept verbatim. Fix the parser, then run `rebuild`.
- [The database holds secrets from sessions (tokens, env values, client code)] → Localhost only, `0600`, git-ignored, never uploaded. It holds the same content as `~/.claude/projects` today, just for longer.
- [The database grows without bound] → Expected well under 1 GB per month. Task 1.3 measures it. Retention controls are out of scope until size becomes a problem.
- [Users open `localhost:8765` instead of `127.0.0.1:8765`] → That origin has no fix markers. The app redirects `localhost` requests to `127.0.0.1`.
- [A git lookup on a slow or network path stalls ingest] → Run it with a short timeout and fall back to the path rule.
- [Price table goes stale] → Unpriced models show as unknown, with the model named, never as $0.

## Migration Plan

1. Install with `uv sync`, then run `uv run app.py`. The first start runs a full ingest.
2. Applied-fix markers carry over because the origin stays `http://127.0.0.1:8765`.
3. Delete `claude-errors.html` once the app works. It stays git-ignored.
4. Rollback: `git revert`, and serve the static build again. `data/` can be deleted with no loss, since the transcripts are still on disk (now kept for 36500 days).

## Open Questions

- Default ingest interval: 60 seconds. Tune it after measuring the cost of an empty refresh.
- Whether `(temp)` sessions should be hidden by default on the usage page. Decide after seeing their share of cost.
