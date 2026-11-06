# Design

## Context

See proposal.md, "Why". Each source is a `store.Source` entry in `store.SOURCES`, with file discovery, a line key, `fields`, and a `Deriver` subclass that fills the shared dicts. `Deriver.flush` writes them. Ingest reads files in the order `files(root)` returns them. Rebuild replays `raw_lines` file by file in path order.

What the local Grok data shows (CLI 1.0.77; three sessions: a long TUI review, an empty one from 1.0.x in October, and a headless probe with a subagent and a failing `ls`):
- A session is a folder `~/.grok/sessions/<url-encoded cwd>/<session uuid>/`. Session ids are UUIDv7, so they sort by creation time.
- `updates.jsonl` is append-only. Each line is `{timestamp (epoch s), method, params: {sessionId, update: {sessionUpdate, ...}, _meta: {eventId "<sid>-<n>", agentTimestampMs, totalTokens?, promptId?}}}`.
- `sessionUpdate` values seen: `user_message_chunk` (`_meta.modelId`, `promptIndex`), `agent_message_chunk`, `agent_thought_chunk`, `tool_call` (`toolCallId`, `rawInput`, `_meta["x.ai/tool"]` with `name`, `namespace`, `kind`), `tool_call_update` (`status`, `rawOutput`, where shell output has `exit_code`, `command` and `output_for_prompt`), `hook_execution` (`event_name`, `runs[{name, status{status, elapsed_ms}}]`), `subagent_spawned` / `subagent_finished` (`child_session_id`), and `turn_completed` (`prompt_id`, `stop_reason`, `usage`).
- `turn_completed.usage` has `inputTokens` (cached included), `cachedReadTokens`, `cacheCreationTokens`, `outputTokens` (reasoning included), `reasoningTokens`, `modelCalls`, `costUsdTicks`, and the same per model under `modelUsage`. The billed model id (`grok-4.7-build`) differs from the UI model id (`grok-4.7`).
- In the probe, the parent turn reports 5 model calls and $0.134844. The subagent's own `turn_completed` reports 2 calls and $0.026428. The parent's figures include the subagent's. The subagent's folder has no reference to its parent. Only the parent's `subagent_spawned` line and its `subagents/<child>/meta.json` link the two.
- A failing shell command still ends with status `completed`. Only `rawOutput.exit_code` (1) shows the failure.
- The probe's costs fit xAI's published rates: $2 input, $0.50 cached input, $6 output per million tokens, with reasoning billed as output. xAI also charges a long-context tier on calls above 200K prompt tokens.
- Other files: `chat_history.jsonl` (model messages, with encrypted reasoning), `events.jsonl` (telemetry), `summary.json`, `usage.json` and `signals.json` (rewritten in place), `logs/unified.jsonl` (one shared, trimmed log, which has per-call usage but no model and no cost).

## Goals / Non-Goals

**Goals:**
- Grok becomes a third `SOURCES` entry. No change to the ingest loop, and no rewrite of `raw_lines`.
- Rebuild gives the same rows as ingest, using stored lines only.
- Cost for Grok matches what xAI billed.

**Non-Goals:**
- Per-call Grok requests. Usage is per turn.
- Reasoning effort and git branch for Grok sessions. They are only in `summary.json`, which is rewritten in place. Requests have no effort, so the model mix shows `(none)`.
- Grok plan limits on the Limits page. Nothing local reports them.
- Prices for Grok models in `prices.json`. Reported cost covers every Grok request.

## Decisions

**Ingest only `updates.jsonl`.** It holds everything the derived tables need, including usage and cost in `turn_completed`. It is append-only, so the incremental byte-offset reader fits. Alternatives:
- `chat_history.jsonl` holds the model and effort for each message, but not usage.
- `unified.jsonl` has per-call usage, but no model and no cost. It is also shared and trimmed: its oldest line is from 2026-11-03, so the October session's calls are already gone from it.
- `usage.json` repeats `turn_completed`, but it is rewritten in place, so the line store can't keep it.

**One request per turn and model.** The key is `grok:<session>:<prompt_id>:<model>`. Per-call rows would need `unified.jsonl`, which the decision above rules out. Cost and totals stay exact. The trade-off is coarser time: a turn's usage lands at its `turn_completed` time.

**A `reported_cost` column on `requests`.** It is nullable `DOUBLE`, added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on open, as `source` was. The `DERIVED_SCHEMA` gains it, so a rebuild creates it. `requests_cte` computes `cost` as `coalesce(r.reported_cost, <estimate>)`, and `unpriced` counts only rows whose cost is still NULL. Alternatives:
- Add Grok rates to `prices.json`. The long-context tier applies per call above 200K prompt tokens, so a per-turn row would hit that tier almost always and be overpriced. The fast-model rates are also not published as numbers.
- Name the column `cost`. That clashes with the `cost` alias in `requests_cte`, because the CTE selects `r.*`.

**Subagents are found through the parent's stored lines.** `GrokDeriver` looks for a stored `subagent_spawned` line in `raw_lines` whose `child_session_id` is this file's session, as `CodexDeriver.thread_lines` does. When it finds one, the file's tool calls and prompts go to the parent session with `subagent = true`. Its `turn_completed` lines make no requests, and it creates no session row. Ingest reads the parent first because `files(root)` returns paths sorted, and a child's UUIDv7 sorts after its parent's. Rebuild also replays in path order. Alternatives:
- Read `subagents/<id>/meta.json` from disk. A rebuild would then depend on files still existing.
- Subtract the child's usage from the parent's turn, to keep a Grok subagent split. That needs the child's usage before the parent turn is derived, and the parent turn ends after the child. The cost: the Cost page's subagent share leaves out Grok subagents' tokens. They count as the parent's.

**Tool rows reuse `Deriver.tool_row`.** `tool_call` fills `uses[toolCallId]`. The final `tool_call_update` fills `results[toolCallId]`. A shell tool's error text is `Exit code N` plus `output_for_prompt`, as for Codex. `run_terminal_command` joins `SHELL_TOOLS` in `categorize.py`, so commit and test detection apply. Agent message chunks give the follow-up text for errors.

**Timestamps come from `_meta.agentTimestampMs`.** It is in milliseconds. The top-level `timestamp` is whole seconds.

## Risks / Trade-offs

- [The format is new and undocumented beyond the CLI README] → Ignore unknown `sessionUpdate` values. Base fixtures on real 1.0.77 lines. Record the CLI version from `x.ai/tool` metadata or `user_message_chunk`, where present.
- [A child file read before its parent's `subagent_spawned` line is stored would become its own session and count its usage twice] → Sorted discovery reads parents first. Grok writes `subagent_spawned` before it creates the child folder (28.710 s and 28.723 s in the probe). The race needs a parent line to be half-written at ingest time. A test checks that discovery puts the child after the parent.
- [A cancelled turn may write no `turn_completed`, so its usage would be lost] → Task 2.1 checks this with a cancelled probe. If the line is missing, the gap goes in the README, and the change stays as specced.
- [`stop_reason` for a cancelled turn may not be `cancelled`] → Task 2.1 records the real value and updates the spec scenario before archive.

## Migration Plan

1. Opening the store adds `requests.reported_cost` (NULL for existing rows). There is no re-ingest.
2. The first ingest after upgrade reads `~/.grok/sessions/**/updates.jsonl` from the start.
3. Rollback: the older app ignores the extra column and the `grok` rows. Older metrics filter by known sources only in the UI, so Grok rows would show under All. If they must disappear, run `DELETE` on the `grok` rows of `raw_lines`, `files` and `sessions`, then `rebuild`.
