# Proposal

## Why

AI Ledger only reads Claude Code transcripts, but the user also runs OpenAI's Codex CLI, and that work and spend don't show up anywhere. Codex keeps local, append-only JSONL transcripts with per-response token usage, so it can be ingested to the same depth as Claude: sessions, requests, every token kind, tools and errors. This is stage 2 of the multi-source plan. Stage 1, the rename to AI Ledger, has shipped. Grok is out of scope for now.

## What Changes

- The store learns about **sources**. Every raw line, file and session records which coding agent wrote it: `claude` or `codex`. Rows already stored become `claude`.
- Each source has its own transcript roots, line keys and parser. All parsers write the same derived tables (sessions, requests, tool calls, prompts).
- **Codex CLI ingest.** Ingest reads `~/.codex/sessions/**/rollout-*.jsonl` incrementally. It reads the compressed `~/.codex/archived_sessions/*.jsonl.zst` once per file. A session archived after ingest is not counted twice.
- **Token normalization.** Codex's `input_tokens` includes cached tokens. The parser stores the input that was neither cached nor a cache write in `input`, cached input in `cache_read`, cache writes in `cache_5m`, and reasoning in `thinking`. Totals and costs therefore mean the same thing for both sources.
- **Codex tools and errors** come from the CLI's completed-item events: MCP calls, shell commands, file changes and web searches. They don't come from the `exec` script wrapper, which hides the real tool. Failed items become tool errors on the Errors page.
- **Prices.** `prices.json` gains the OpenAI models seen in Codex sessions, at list prices. Cost stays an estimate, with the same caveat as Claude.
- **Dashboards.** Activity, Cost and Errors get a source filter (All, Claude Code, Codex). The URL keeps it, and it carries across pages like project and range. Wording that says "Claude" where it means any agent becomes source-neutral.
- **BREAKING (runtime):** Python 3.14 or newer is required, for the standard library's `compression.zstd`. The project's uv environment already uses 3.14.

## Capabilities

### New Capabilities
- `codex-transcripts`: how Codex CLI transcripts become derived records. It covers where they live, how lines are keyed and deduplicated across live and archived copies, token normalization, models and effort per turn, tools and errors, and human prompts.

### Modified Capabilities
- `transcript-store`: the store holds lines from several sources, records each line's and session's source, and rebuilds every source from raw lines.
- `dashboard-app`: a source filter shared by Activity, Cost and Errors, kept in the URL and carried across pages. Page wording no longer assumes Claude.

## Impact

- `store.py`: a source registry (roots, file discovery, line key, parser). A `source` column on `raw_lines`, `files` and `sessions`, added in place to the existing 2.3 GB store. Ingest reads `.zst` files. Rebuild runs each file's own parser.
- A new `codex.py` holds the Codex parser. `categorize.py` gets one shared set of shell tool names (`Bash`, `exec_command`). Its error rules stay the same.
- `metrics.py`: every query takes a `source` filter.
- `app.py`: `--codex` sets the Codex home (default `~/.codex`), and every API passes `source` through.
- `prices.json`: OpenAI model rates, with their source URL and read date.
- `web/`: the source control in `Filters`, a `source` hash key in `SHARED_KEYS`, and source-neutral empty-state and kicker text. Fixtures are regenerated.
- `pyproject.toml`: `requires-python = ">=3.14"`.
- Tests: Codex fixtures covering all three `test_*` layers, plus one migration test on a store that has no `source` column.
