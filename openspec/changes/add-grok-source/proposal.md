# Proposal

## Why

The user also runs xAI's Grok CLI (`grok`, 1.0.92), and that work and spend appear nowhere in AI Ledger. Twelve Grok sessions now exist locally: ten long single-turn reviews of 25 to 89 model calls and $1.50 to $6.60 each, a headless probe with a subagent, and an empty one. Grok keeps append-only session logs that carry each turn's token usage, the cost xAI billed, the context size at every model call, compactions, tools, hooks and subagents. So Grok can join Claude Code and Codex at the same depth.

This replaces the plan of early November. That plan made one request per turn. The app has since gained pages that read a request as one model call (Context, Live, the session timeline), and a row holding a 40-minute turn's 10 million input tokens would break each of them. The logs of 1.0.92 make a better mapping possible.

## What Changes

- **Grok CLI ingest.** Ingest reads `~/.grok/sessions/<encoded cwd>/<session>/updates.jsonl` incrementally, one file per session. The other files in a session folder are not ingested.
- **Usage per model call.** Grok writes usage once per turn, but every line of a model call carries the call's start and the context size. A finished turn becomes one request per model call: the turn's tokens are split over its calls in proportion to their context size. Turn totals stay exact; the split per call is an estimate. Usage shows up when the turn ends, not while it runs.
- **Reported cost.** Grok reports what each turn cost. The store keeps it, and Cost uses it in place of the price-table estimate. The estimate cannot stand in: xAI's long-context tier applies per call, and two of the ten long turns were billed above the flat rates.
- **Context.** A Grok session's peak context, compactions and context window come from its lines, so Context and Live show a Grok session as they show the others.
- **Model time.** Each turn reports its API time, so a Grok session has an output speed.
- **Subagents.** A Grok subagent runs as its own session folder. Its tools and prompts belong to the parent session as subagent work. Its usage is already part of the parent turn's usage and is not counted twice.
- **Tools and errors** come from `tool_call` and `tool_call_update` lines. A shell command that exits non-zero is an error even when Grok marks it `completed`. MCP calls go through Grok's `use_tool` and are recorded under the MCP tool's name.
- **Hooks** come from `hook_execution` lines.
- **Every page.** The source filter gains Grok (`source=grok`). Judgments stay Claude Code only, for Grok as for Codex. Limits has no Grok window: Grok reports no plan limits. Live shows a Grok session's state from its turn start and end. The palette gains `#grok`, and the context menu resumes a Grok session with `grok --resume <id>`.
- **CLI.** `--grok <dir>` sets the Grok home (default `~/.grok`).

## Capabilities

### New Capabilities
- `grok-transcripts`: how Grok CLI session logs become derived records. It covers where they live, line keys, usage per model call, reported cost, context and compactions, model time, subagents, tools and errors, prompts, and hooks.

### Modified Capabilities
- `transcript-store`: the sources include `grok`, and a request may carry the cost its source reported.
- `cost-dashboard`: cost is the reported cost when a request has one, and the estimate otherwise.
- `dashboard-app`: the source filter offers Grok; the unknown-source example changes.
- `usage-dashboard`, `insights-dashboard`, `project-page`: Judgments are absent for any source other than Claude Code.
- `context-dashboard`: cache lifetime, advice and overhead for a Grok session.
- `live-sessions`: a Grok session's state, shell tool, subagent lanes and close.
- `command-palette`, `context-menu`, `documentation-site`: the `#grok` term, the resume command, the docs heading.

## Impact

- `store.py`: a `grok` entry in `SOURCES`, `DEFAULT_GROK`, a nullable `reported_cost` column on `requests`, and a per-source line type for `raw_lines.type` (Grok lines have no top-level `type`).
- A new `grok.py`: file discovery, keys, `GrokDeriver`, `live_items`, `prompt_text`.
- `metrics.py`: `SOURCES` gains `grok`; the requests view takes `coalesce(r.reported_cost, estimate)`.
- `live.py`, `context.py`, `insights.py`, `categorize.py`: the branches written for two sources.
- `prices.json`: the context window of Grok's models, with no rates.
- `app.py`: `--grok`, passed into `roots`.
- `web/`: `Source`, `SOURCES`, labels, colors, the resume command, and every test of "not Claude" written as `=== "codex"`. Fixtures are regenerated.
- `README.md`, `site/`, `CHANGELOG.md`, `tools/demo/`.
- Tests: Grok fixtures trimmed from real 1.0.92 sessions; the tests that use `grok` as the unknown source move to `gemini`.
- Parked change `add-tool-filter` is not affected.
