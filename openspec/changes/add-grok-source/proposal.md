# Proposal

## Why

The user now also runs xAI's Grok CLI (`grok`, 1.0.77), and that work and spend appear nowhere in AI Ledger. Grok keeps local, append-only session logs that carry each turn's token usage and the cost xAI billed, so Grok can join Claude Code and Codex at the same depth: sessions, requests, tools, errors, prompts and hooks. This is stage 3 of the multi-source plan. The Codex change deferred it until a real Grok session existed. Two now exist, plus a probe session with a subagent and a failing command.

## What Changes

- **Grok CLI ingest.** Ingest reads `~/.grok/sessions/<encoded cwd>/<session>/updates.jsonl` incrementally, one file per session. The other files in a session folder are not ingested.
- **Usage per turn.** Each `turn_completed` line becomes one request per model it names, with Grok's token counts mapped onto the shared columns. Grok writes usage per turn, not per model call. A turn shows up in the dashboards when it ends, not while it runs.
- **Reported cost.** Grok reports what each turn cost (`costUsdTicks`). The store keeps it, and Cost uses it in place of the price-table estimate when it exists. Grok's long-context tier applies per model call, so the price table cannot estimate a per-turn row correctly.
- **Subagents.** A Grok subagent runs as its own session folder. Its tools and prompts belong to the parent session as subagent work. Its usage is already part of the parent turn's usage, so it is not counted a second time.
- **Tools and errors** come from `tool_call` / `tool_call_update` lines. A shell command that exits non-zero is an error even though Grok marks it `completed`.
- **Hooks** come from `hook_execution` lines.
- **Dashboards.** The source filter gains Grok. Its URL value is `source=grok`.
- **CLI.** `--grok <dir>` sets the Grok home (default `~/.grok`).

## Capabilities

### New Capabilities
- `grok-transcripts`: how Grok CLI session logs become derived records. It covers where they live, line keys, per-turn usage and reported cost, models, subagent attribution, tools and errors, prompts, and hooks.

### Modified Capabilities
- `transcript-store`: the store's sources include `grok`, and a request may carry the cost its source reported.
- `cost-dashboard`: cost uses the reported cost when a request has one, and the estimate otherwise.
- `dashboard-app`: the source filter offers Grok. The "unknown source" scenario uses a value other than `grok`.

## Impact

- `store.py`: a `grok` entry in `SOURCES`, `DEFAULT_GROK`, and a nullable `cost` column on `requests`, added in place on open.
- A new `grok.py` holds the Grok file discovery, keys and `GrokDeriver`.
- `metrics.py`: `SOURCES` gains `grok`. The requests view takes `coalesce(r.cost, estimate)`.
- `app.py`: `--grok`, passed into `roots`.
- `web/`: `Source` and `SOURCES` gain `grok`, and the `Filters` control gets a Grok choice. Fixtures are regenerated, and `web/dist/` is rebuilt.
- `README.md`: what is ingested, and the `--grok` option.
- Tests: Grok fixtures trimmed from the real probe session, through all three `test_*` layers.
- Interaction: the in-flight `add-command-palette` change lists sources for `#` filters. Whichever change merges second adds `grok` there.
