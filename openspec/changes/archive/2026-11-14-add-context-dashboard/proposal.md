# Proposal

## Why

The context window is the budget every session spends, and the store already holds what fills it: each request's prompt tokens, each compaction, each tool result. Today that data surfaces as three figures on Activity (peak context, compactions, the near-limit list) and a meter on Live. Nothing says how big a project's sessions start, how fast they grow, which tools and MCP servers fill them, what the cache and the long-prompt tier cost because of it, or what to do about it. A Context page turns those figures into per-project habits and concrete tips, for Claude Code and Codex alike.

## What Changes

- **Context page.** A new top-level dashboard at `/context`, with the shared filters (project, range, source, automated), five sections and a tip list:
  - *Starting context*: the prompt tokens of each session's first turn, as a median and a 10th percentile per project, its share of the model's window, and its trend by week.
  - *Growth*: context against turn index as a median curve, tokens added per user prompt, turns and active minutes until the first compaction, and the distribution of peak fill (peak / window) grouped by window size.
  - *What fills context*: the size of tool results by tool and by MCP server, with an estimated token count (bytes / 4, labelled as an estimate), the largest results linked to their sessions, and the results of subagent transcripts counted apart from the main thread.
  - *Cost*: cache-read spend, long-prompt-tier spend and cache-hit ratio per project, and the sessions where caching broke, with the cause (model switch, cache expiry, other).
  - *Tips*: fixed rules with named thresholds, each shown only when it fires, with its evidence figures, its advice and the sessions that match it, which open in the session sheet.
- **Three derived columns**, filled by both parsers and needing one `ai-ledger rebuild`: `tool_calls.result_bytes` (the size of the tool result text as stored in the transcript), `sessions.context_window` (the window Codex states per turn; none for Claude Code, whose window comes from the price table) and `sessions.first_compaction_ts`. A store opened before the rebuild shows the page with these figures marked as not yet available.
- **Navigation, routes and palette.** Context joins the nav after Cost, `>context` opens it from the palette, and it hosts the project, tool and session sheets like Activity and Cost.
- No file outside the store is read: starting context is measured from tokens alone, and the page never opens `CLAUDE.md`, `AGENTS.md` or `.mcp.json`.

## Capabilities

### New Capabilities
- `context-dashboard`: the Context page: its filters, the starting-context, growth, fill, cost and tip sections, the token estimate, the drill-down from a tip to its sessions, and what the page says when the store needs a rebuild.

### Modified Capabilities
- `transcript-store`: derived tool calls carry the size of their result; derived sessions carry the context window their source states and the time of their first compaction; a store from before these columns gains them on open and fills them on rebuild.
- `codex-transcripts`: Codex tool calls record the size of their result text; a Codex session records the context window its turns state.
- `dashboard-app`: the shared navigation, the served routes, the page titles, the source filter and the automated filter include Context.
- `command-palette`: `>context` opens the Context page, and Context hosts the tool, MCP server, skill and session sheets.

## Impact

- `src/ai_ledger/store.py`: `DERIVED_SCHEMA` gains the three columns; `open_store` adds them in place; `Deriver` computes `result_bytes` from `tool_result` content and `first_compaction_ts` from `compact_boundary`; `tool_row`, `flush` and `flush_tools` write them.
- `src/ai_ledger/codex.py`: `CodexDeriver` computes `result_bytes` from a completed item's output, `context_window` from `task_started`, and `first_compaction_ts` from `compacted`.
- New `src/ai_ledger/context.py`: the `/api/context` payload, the metric queries and the tip rules with their constants.
- `src/ai_ledger/app.py`: the `/api/context` route and `/context` in `PAGES`.
- `web/`: `pages/context/` (page, chart, helpers, styles, tests), `ContextPayload` and `contextUrl` in `api.ts`, the nav entry, the route in `App.tsx`, the palette's hosting pages, and a page-only `tip` hash key. Fixtures in `web/src/__fixtures__/` gain `context.ts`; `src/ai_ledger/web/` is rebuilt.
- Tests: `tests/test_derive.py`, `tests/test_codex.py` (result sizes, window, first compaction, rebuild parity), a new `tests/test_context.py` (metrics and tip rules), `tests/test_app.py` (route), `tests/test_web_fixtures.py` (the new fixture).
- `README.md` ("What you get", the rebuild note) and `CHANGELOG.md` (`[Unreleased]`, with the rebuild instruction).
- Interaction: the in-flight `add-grok-source` change adds a source. Whichever merges second makes Grok's deriver write the three columns (NULL where Grok gives nothing).
