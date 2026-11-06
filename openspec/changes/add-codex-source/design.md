# Design

## Context

See proposal.md, "Why". Today `store.py` has one ingest path:
- `transcript_files(root)` finds the files.
- `line_key` dedups by `uuid`.
- `Deriver.add` reads Claude line shapes into in-memory dicts (`sessions`, `requests`, `uses`, `results`, `prompts`, `followups`).
- `Deriver.flush` writes those dicts to the derived tables in bulk.

`metrics.py` filters everything through `scope()` (project and automated) and `view()` (range). The Errors page is different: it gets every error from `errors_payload` and filters by project in the browser.

What the local Codex data shows (CLI 0.139 to 0.166; 15 live files, 5 archived):
- Every line has `timestamp`, `ordinal`, `type`, and `payload`. None has a `uuid`.
- `session_meta` (line 0) has `id`, `cwd`, `originator`, `cli_version` and `git.branch`.
- `turn_context` has `turn_id`, `model` and `collaboration_mode.settings.reasoning_effort` (not always set).
- `token_usage_record` has `turn_id`, `response_id` and `usage`. `usage` holds `input_tokens` (cached included), `cached_input_tokens`, `cache_write_input_tokens` (always 0 so far), `output_tokens` and `reasoning_output_tokens`. `response_id` never repeats.
- `event_msg` / `token_count` repeats the same usage as a running total, so it is ignored.
- Tools run in code mode. A `custom_tool_call` named `exec` runs a JS script that calls the real tools. The real calls arrive as `event_msg` / `item_completed`, and the item `type` is one of:
  - `McpToolCall`: `server`, `tool`, `arguments`, `status`, `result`, `duration`.
  - `CommandExecution`: `command[]`, `exit_code`, `aggregated_output`, `status`.
  - `FileChange`.
  - `Extension`: `web.search`.

  Each item `status` is `completed` or `failed`. The local data has 237 failed items.
- Prompts are `item_completed` / `UserMessage`. The CLI also injects `<environment_context>`, `<heartbeat>` and `# AGENTS.md` user messages. `turn_aborted` has a `reason`. `compacted` marks a compaction.
- `archived_sessions/` holds `.jsonl.zst` files: the same rollouts, compressed. Some are named `<session>_<thread>`. Those repeat the parent's `session_meta.id`, and their `ordinal` values overlap the parent's.

## Goals / Non-Goals

**Goals:**
- One source registry. Adding a third source later means one root, one key function and one parser.
- Leave the 2.3 GB `raw_lines` table as it is: no table rewrite and no re-ingest.
- The Codex parser reuses `Deriver.flush` and the tool-row logic, so the derived rows are the same shape for both sources.

**Non-Goals:**
- Grok, or any source other than Claude and Codex.
- Codex hook records. None appear in the transcripts.
- The Codex SQLite files (`state_5.sqlite`, `logs_2.sqlite`). Transcripts are the source of record, as they are for Claude.
- Per-source price caveats beyond the existing "list price estimate" note.

## Decisions

**Source stored on `files` and `sessions`, not on `raw_lines`.**
- A line's source is its file's source, so `files.source` records it without adding a column to 458k raw rows.
- `sessions.source` is what every metric filters on.
- Rejected: `raw_lines.source`. It is redundant with `files.source`, and the `ALTER` on the largest table is the riskiest part of the migration.
- Migration: `ALTER TABLE files|sessions ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'claude'`. Both tables are small (thousands of rows). If DuckDB refuses the `ALTER` because of the primary key, recreate the table and copy the rows, inside one transaction.

**A source registry in `store.py`.**
- The registry is `SOURCES = {"claude": Source(files=…, key=line_key, deriver=Deriver), "codex": Source(files=codex_files, key=codex_key, deriver=CodexDeriver)}`.
- `ingest(con, roots)` takes `{source: dir}`. The app builds it from `--projects` and `--codex`.
- Tests pass only temp dirs, so a test can never read the real `~/.codex`.
- `rebuild` reads each file's `source` from `files` and replays it with that source's deriver.
- Rejected: one parser that branches on line shape. The two formats share no keys, and mixing them makes each harder to change.

**Codex lines keyed `codex:<thread>:<ordinal>`.**
- `<thread>` is the id at the end of the file name, after the `_` when there is one.
- The key is the same for a live file and its archived `.zst` copy, so archiving dedups for free.
- A `<session>_<thread>` file still gets its own keys, so the overlapping ordinals don't collide.
- `raw_lines.session_id` is the `<session>` part, and those threads' rows are marked `subagent`.
- Rejected: `path:offset`. It changes when Codex moves a file to the archive, which would double-count every archived session.

**`.zst` files read whole.**
- They're immutable once written. `files.read_offset` records the compressed size, so an unchanged file is skipped by the existing `size == offset` check.
- A changed file is decompressed and re-read from offset 0, and dedup drops lines already stored. `byte_offset` is the offset in the decompressed text, so rebuild order is still correct.
- Decompression uses `compression.zstd` from the standard library, Python 3.14+. That's why `requires-python` goes to `>=3.14`.
- Rejected: the `zstandard` package. A new dependency for something the runtime already ships.

**`CodexDeriver(Deriver)` overrides `add` only.**
- It fills the same dicts. `flush`, `flush_tools`, `tool_row`, `followup` and the pending-error reload all come from `Deriver` unchanged.
- Turn state (`turn_id` to model and effort, and the turn's prompt id) is kept per file. An incremental chunk can start after its turn's `turn_context`, so on init the deriver reloads the file's latest `turn_context` from `raw_lines` (one indexed query per file per ingest).
- Mapping:
  - **Session:** `session_meta` gives `cwd`, `git_branch` (`git.branch`), `entrypoint` (`originator`) and `version` (`cli_version`). `compacted` adds to `compactions`.
  - **Request:** a `token_usage_record` becomes a `requests` row keyed by `response_id`, using the token mapping in the specs. Its model and effort come from its turn. Peak context is `input_tokens`.
  - **Tool:** an `item_completed` becomes `uses` and `results` together, since one event carries both. `start_ts` is `ts − duration`. Tool names:

    | Item | Tool name | Notes |
    |---|---|---|
    | MCP call | `mcp__<server>__<tool>` | Matches Claude's naming, so `mcp_server` parses the same way |
    | Shell command | `exec_command` | Input summary is the shell string |
    | File change | `apply_patch` | |
    | Web search | `web_search` | |

    `failed` means `is_error`. Error text is the MCP result text, or the exit code plus the command output.
  - **Follow-up:** an `AgentMessage` with text calls `followup()`.
  - **Prompt:** a `UserMessage` whose text doesn't start with `<` or `# AGENTS.md` becomes a prompt, keyed by its `turn_id`. `turn_aborted` with `reason: "interrupted"` marks that turn's prompt interrupted.

**Shell detection shared through a set.** `is_commit` and `is_test` apply when the tool is in `SHELL_TOOLS = {"Bash", "exec_command"}`. Activity's tool mix shows Codex's own tool names.

**Codex shell errors in Claude's error format.**
- The `categorize.py` rules match on error text and command, not on tool names. Many key on Claude's `Exit code N` prefix: no-match greps, long outputs and generic exit codes.
- A failed `CommandExecution` therefore gets the error text `Exit code <exit_code>` followed by its output, and every rule applies unchanged.
- Rejected: Codex-specific rules. They would duplicate the rule set for one formatting difference.

**Cache write is part of `input_tokens`.**
- The normalized input is `input_tokens − cached_input_tokens − cache_write_input_tokens`. Cache write goes to `cache_5m`, and `cache_1h` is 0.
- The total stays `input_tokens + output_tokens` whatever the split.
- The `cache_5m` price for OpenAI models is the cache-write rate from the pricing page, or the input rate when the page lists none.

**Source filter.**
- `scope()` gains `source`: `(? = '' OR s.source = ?)`. Every Activity and Cost query inherits it.
- `errors_payload` adds `src` to each error and to each `calls` row. The Errors page filters in the browser, as it already does by project.
- In the web app, `source` joins `SHARED_KEYS`. `Filters` gets a segmented control, which reuses the range control's styling.
- An unknown value falls back to All, as an unknown `range` does today.

## Risks / Trade-offs

- [Codex's format changes between CLI versions (0.139 to 0.166 locally)] → The parser ignores unknown line and item types. Fixtures come from real lines of several versions, and raw lines are kept, so a parser fix plus `rebuild` recovers.
- [`cache_write_input_tokens` is always 0 locally, so its subset-of-input meaning is unconfirmed] → The total is unaffected. Only the cache-write vs input price split could be off. See Open Questions.
- [OpenAI list prices for `gpt-6-astra` and `gpt-6.1-sol` may not be published] → Unlisted models stay unpriced. Cost already counts and shows unpriced requests.
- [The `ALTER` on a table with a primary key fails on this DuckDB version] → The fallback is copy-and-swap in one transaction. Task 1.2 first runs the migration on a clone of the real store.
- [Codex subagent and thread semantics are inferred from 2 archived files] → They're treated as subagent work of the parent session. If that's wrong, only `subagent` flags change, and a rebuild fixes them.

## Migration Plan

1. On open, the store adds `source` to `files` and `sessions` with default `claude`. No raw rows are touched.
2. The first ingest after upgrade reads all Codex files. That's 20 files, a few MB.
3. Rollback: the earlier code ignores the extra column. Codex sessions would then show as unlabeled sessions. To drop them, delete the `codex` rows from `files`, the derived tables and `raw_lines` (`key LIKE 'codex:%'`), then rebuild.

## Open Questions

- Does `cache_write_input_tokens` ever become nonzero, and is it then included in `input_tokens`? Check the first nonzero record against OpenAI's usage docs. Only the price split depends on it.
