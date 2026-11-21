# Design

## Context

See proposal.md, "Why". Each source is a `store.Source` entry in `store.SOURCES`: file discovery, a line key, `fields`, `placement`, a `Deriver` subclass that fills the shared dicts, and the readers Live and titles use (`live_items`, `prompt_text`, `prompt_type`, `close_type`). `Deriver.flush` writes the rows. Ingest reads files in the order `files(root)` returns them. Rebuild replays `raw_lines` file by file in path order.

What the local Grok data shows (CLI 1.0.92, twelve sessions, surveyed on 2026-11-21 by key and number only):

- A session is a folder `~/.grok/sessions/<url-encoded cwd>/<session uuid>/`. Session ids are UUIDv7, so they sort by creation time.
- `updates.jsonl` is append-only. Each line is `{timestamp (epoch s), method, params: {sessionId, update: {sessionUpdate, ...}, _meta: {eventId "<sid>-<n>", agentTimestampMs, ...}}}`. Event ids are unique. Lines are not in event-id order: 1 to 20% of them sit after a later id.
- No line has a top-level `type`. The kind is `params.update.sessionUpdate`.
- **Model calls.** Lines written during a model call (`agent_thought_chunk`, `agent_message_chunk`, `tool_call`, `tool_call_update`) carry `_meta.promptId`, `streamStartMs`, `turnStartMs` and `totalTokens`. The distinct `streamStartMs` values of a turn equal its `modelCalls` in all ten long turns (the cancelled one has 51 for 50). `totalTokens` is the context size and grows within a call. Summed over a turn's calls, each call's first value is 98.5 to 102.5% of the turn's `inputTokens`.
- **Turns.** `turn_completed` has `prompt_id`, `stop_reason` (`end_turn`, `cancelled`), `elapsed_ms` and `usage`: `inputTokens` (cached included), `cachedReadTokens`, `cacheCreationTokens` (always 0), `outputTokens` (reasoning included), `reasoningTokens`, `modelCalls`, `apiDurationMs`, `costUsdTicks`, and the same per model under `modelUsage`. The billed model id (`grok-4.7-build`) differs from the UI model id (`grok-4.7`). Every turn so far names one model.
- **A cancelled turn still writes `turn_completed`**, with its usage and `stop_reason: cancelled`. This closes the open question of the earlier plan.
- **Cost.** `costUsdTicks / 1e10` equals the flat rates ($2 input, $0.50 cached, $6 output per million) in nine turns. The two turns whose context passed 200K were billed 5% and 13% above them.
- **Compaction.** `auto_compact_started` has `context_window` (256,000) and `tokens_used`; `auto_compact_completed` has `tokens_before` and `tokens_after`.
- **Prompts.** `user_message_chunk` has `_meta.promptIndex` and the text, and no prompt id. A prompt can come as several chunks with the same index. The `user_prompt_submit` hook line before it carries `prompt_id`.
- **Tools.** `tool_call` has `toolCallId`, `rawInput` and `_meta["x.ai/tool"]` (`name`, `kind`; the namespace is always `grok_build`). Each call gets two `tool_call_update` lines: one in progress with no status, one final with `status` (`completed`, `failed`) and `rawOutput`. A failing shell command is `completed` with `rawOutput.exit_code` 1 (33 of them), or `failed` (1). An MCP call is the tool `use_tool` with `rawInput.tool_name` `"<server>__<tool>"`; its output has `server_name`, `tool_name` and `is_error`.
- **Hooks.** `hook_execution` has `event_name` and `runs[{name, status{status, elapsed_ms}}]`. `session_end` is written as the CLI exits (12 lines for 12 sessions).
- **Subagents.** The parent writes `subagent_spawned` and `subagent_finished` with `child_session_id`. The child's folder does not name its parent. The parent's turn usage includes the child's: 5 calls and $0.134844 for the parent, 2 calls and $0.026428 in the child's own `turn_completed`.
- **Other files.** `summary.json` (title, effort, branch), `usage.json` and `signals.json` are rewritten in place. `chat_history.jsonl` holds model messages with no usage. `events.jsonl` is telemetry. `logs/unified.jsonl` is shared and trimmed.

### Probe on 1.0.92 (task 2.1)

A headless run (`grok -p … --always-approve`) in an empty git folder: turn 1 spawned a subagent that read one file, ran `ls missing-dir`, made a commit and called an MCP tool; turn 2 (`--resume <session>`) started `sleep 60` and the process got SIGINT after 30 s. It differs from the list above in these points:

- **Event ids are not unique within a session.** Each run of the CLI restarts the counter at 1. The resumed run wrote `<sid>-1`, `-3`, `-5`, `-6` …, so two ids of turn 1 repeat (2 of 56 lines). The counter is shared with the subagent: the child's ids (68 to 101) fill a gap in the parent's (65, then 102).
- **Line shape.** Each line also has `timestamp_us`. `method` is `session/update` for `user_message_chunk`, `agent_*_chunk`, `tool_call` and `tool_call_update`, and `_x.ai/session/update` for `hook_execution`, `turn_completed`, `subagent_*` and `background_tasks`. Model-call lines' `_meta` also holds `requestTrimmedTokens` (0), `updateType` (`AgentThoughtChunk`, `AgentMessageChunk`, `ToolCall`, `ToolCallUpdate`), `chunkId` on chunks and `updateParams` on tool lines. `chunkId` jumps between stored chunk lines (e.g. 37 then 49).
- **Ids.** The probe's prompt ids are UUIDs (36 characters); the older sessions' are 15 characters. A `toolCallId` is `<4 characters>-<uuid>-<n>`, with `n` counting the session's calls from 0 (it does not restart on resume).
- **Order of a first turn.** Headless, `user_prompt_submit` (id 2) and the prompt (id 3) come before `session_start` (id 5). A resumed run writes `session_start`, then `background_tasks {tasks: []}`, then `user_prompt_submit` and the prompt.
- **A prompt in a second turn** has `_meta.promptIndex` 1, and `user_prompt_submit` carries the new turn's `prompt_id`.
- **The parent's turn counts the child's calls.** Parent turn: `modelCalls` 5 and `numTurns` 3, with 3 distinct `streamStartMs` among its own lines; the child's `turn_completed`: `modelCalls` 2, `numTurns` 2, `inputTokens` 22,871, 413,320,000 ticks. The parent's 90,180 input tokens and 1,305,300,000 ticks include them. `usage.numTurns` is a key the list above leaves out; in the other sessions it equals `modelCalls`. So one request per parent `streamStartMs` splits the whole turn (child included) over the parent's 3 calls.
- **Subagent lines in the parent.** `spawn_subagent` (`kind: task`, label `Subagent`) was followed by a `search_tool` call before the `subagent_spawned` line. `subagent_spawned` has `subagent_id` (= the child's session id), `attempt_id`, `parent_session_id`, `parent_prompt_id`, `child_session_id`, `subagent_type` (`general-purpose`), `description`, `effective_context_source` (`new`) and `model` (`grok-4.7`). `subagent_finished` has `subagent_id`, `attempt_id`, `child_session_id`, `status` (`completed`), `tool_calls` 1, `turns` 1, `duration_ms`, `tokens_used` (11,546), `output` and `will_wake` (false).
- **The `spawn_subagent` result.** Its final `tool_call_update` is `completed` with `rawOutput {type: SubagentCompleted, output, subagent_id, subagent_type, tool_calls, turns, duration_ms, worktree_path: null, resume_from_hint}`; `subagent_id` and `resume_from_hint` are the child's session id.
- **The child's lines** (12): `user_prompt_submit` hook with the child's `prompt_id`, `user_message_chunk` (`promptIndex` 0, the task text), two model calls with the same `_meta` keys as the parent's, one `read_file` call (in-progress and `completed` updates, with `pre_tool_use` and `post_tool_use` hooks), a `subagent_stop` hook with `prompt_id`, `turn_completed` (`end_turn`), then `session_end`. No `session_start` hook, and no line names the parent.
- **MCP calls.** A failed `use_tool` is `status: failed` with `rawOutput {type: MCP, tool_name: "<tool>", server_name, output: {Error: text}, is_error: true}`, and its hook is `post_tool_use_failure`, not `post_tool_use`. A successful one has `output: {OkayOutput: text}` and no `is_error` key. Hooks name the call `<server>__<tool>` in `tool_name`.
- **A cancelled headless turn writes no `turn_completed`.** After SIGINT the file ends with `session_end` and `stop` hooks (no `prompt_id`); the running `sleep` call has only its in-progress `tool_call_update`. The one real cancelled turn (an interactive session) has `turn_completed` with `stop_reason: cancelled` and `cancelTrigger: shutdown`, `cancellationCategory: MidTurnAbort` in `_meta`; it is the source of the `cancelled` fixture.
- **Other results.** `grep` writes `completed` with `exit_code` 1 when nothing matches; the one `failed` grep has `exit_code` 2 and `failure: path_not_found`. Shell output also comes as a byte array (`rawOutput.output`) beside `output_for_prompt`.
- **Hooks.** `stop` runs at the end of each turn (with `prompt_id`) and again after `session_end` (without). `pre_compact` runs before a compaction, and a `compaction_checkpoint` line (`checkpoint_id`, `prompt_index_at_compaction`, `checkpoint_file`, `schema_version`, `created_at`) comes between `auto_compact_started` and `auto_compact_completed`.

## Goals / Non-Goals

**Goals:**
- Grok is a third `SOURCES` entry. The ingest loop and `raw_lines` keep their shape.
- A Grok request is one model call, like every other request, so no page needs a Grok exception for request counts, context curves or cache breaks.
- Rebuild gives the same rows as ingest, from stored lines only.
- A Grok turn's tokens and cost add up to what xAI reported.

**Non-Goals:**
- Exact tokens per call. Only the turn total and each call's context size are recorded.
- Usage while a turn runs.
- Reasoning effort, git branch, Grok's own session title and the CLI version. They are only in `summary.json`, which is rewritten in place. The title falls back to the first prompt.
- Grok plan limits. Nothing local reports them.
- Grok rates in `prices.json`. The reported cost covers every Grok request.
- A subagent share of Grok tokens on Cost.
- Background task lines (`background_tasks`, `task_backgrounded`, `task_completed`).

## Decisions

### Ingest only `updates.jsonl`
It holds everything the derived tables need and it is append-only, so the byte-offset reader fits. `usage.json` repeats `turn_completed` but is rewritten in place. `unified.jsonl` is shared and trimmed.

### Lines are keyed by event id and time
The key is `grok:<eventId>:<agentTimestampMs>`. The probe (task 2.1) showed that a resumed run counts event ids from 1 again, so the event id alone repeats within a session and the second line would be dropped. A line keeps both values when its file is read again, so the key still stores each line once. This replaces the survey's "event ids are unique", which held only because no surveyed session had been resumed.

### A headless turn cut by a signal reports no usage
The probe's cancelled headless turn wrote `session_end` and no `turn_completed`. Such a turn makes no request: its usage is in no append-only file. The docs say so. An interactive cancel does write `turn_completed`.

### One request per model call, the turn's usage split by context size
A call is a distinct `streamStartMs` among the lines of one `promptId`. Its context size is the largest `totalTokens` on its lines. When `turn_completed` arrives, the deriver makes one request per call:

- key `grok:<session>:<prompt_id>:<streamStartMs>`, time `streamStartMs`, model the turn's one `modelUsage` key;
- each of uncached input, cache read, cache write, output and thinking is the turn's figure times the call's share of the summed context sizes, rounded so that the rows add up to the turn's figure (largest remainder);
- `reported_cost` is split the same way, the last row taking the remainder.

When the calls cannot be told (no line of the turn has a `streamStartMs`) or the turn names more than one model, the turn makes one request per model at the turn's end, key `grok:<session>:<prompt_id>:<model>`.

An incremental chunk can hold a `turn_completed` whose call lines came in an earlier chunk. So the deriver always reads a turn's calls from `raw_lines`, which already holds the chunk being derived. It counts only the lines between the file's previous `turn_completed` and this one. That makes the rows the same however the file was cut into ingests (a line written late lands after the turn's end and counts nowhere), and a prompt id used by two turns counts no call twice.

The peak context is the largest context size a call states. The `tokens_used` of a compaction notice is not used: it would set a peak in a chunk that does not know the model yet.

Alternatives:
- *One request per turn* (the earlier plan). Exact, but a row with 10 million input tokens at the turn's end breaks every reader of a request as a call: the context curves and cache breaks on Context, the gauge and pulse on Live, the session timeline, active time, the long-prompt count, requests per prompt. Each would need a Grok exception.
- *Per-call rows that hold only the context size, plus one usage row per turn.* Two kinds of request row; every sum would have to pick one.

The cost: the split of cached and uncached input and of output between the calls of a turn is an estimate. Day, session, project and model totals are exact, except that a turn crossing midnight splits by call time.

### A `reported_cost` column on `requests`
Nullable `DOUBLE`, in `DERIVED_SCHEMA` and added on open with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. `requests_cte` computes `cost` as `coalesce(r.reported_cost, <estimate>)`, so `unpriced` counts only rows with neither. The per-kind costs (`cost_input` and the others) stay NULL for a Grok request; the cost-by-token-kind chart treats such a request as it treats an unpriced one today. The column is not named `cost`: the CTE selects `r.*` and defines `cost`.

Alternative: Grok rates in `prices.json`. The long-context tier applies per call, and the split per call is an estimate, so the estimate would drift from the bill.

### `prices.json` holds the window of Grok's models
An entry for `grok-4.7-build` with `context: 256000` and no rates gives Live and Context a window before the first compaction states one. Verify in task 1.4 that an entry without rates is accepted and prices nothing.

### `raw_lines.type` comes from the source
`ingest_chunk` stores `d.get("type")`. `Source` gains a `type` reader, default `d.get("type")`. Grok's gives `sessionUpdate`, and the hook's `event_name` for a `hook_execution` line, so the closing line has the type `session_end`. Live and titles select lines by `raw_lines.type`.

### Subagents are found through the parent's stored lines
`grok.placement` looks for a stored `subagent_spawned` line whose `child_session_id` is the file's session. When there is one, the file's lines belong to the parent session with `subagent = true`: its tool calls and prompts go to the parent, its `turn_completed` lines make no request, and it has no session row. Ingest reads the parent first, because `files(root)` sorts and a child's UUIDv7 follows its parent's. Rebuild replays in path order too.

Alternatives:
- Read `subagents/<id>/meta.json` from disk. A rebuild would then depend on files still being there.
- Subtract the child's usage from the parent's turn. The child file is read after the parent in the same pass, so the parent's rows would have to be rewritten later.

The cost: Cost's subagent share leaves out Grok.

### Tool rows reuse `Deriver.tool_row`
`tool_call` fills `uses[toolCallId]`; the `tool_call_update` with a status fills `results[toolCallId]`. A call is an error when its status is `failed`, when a shell command's `exit_code` is not 0, or when an MCP output has `is_error`. A shell error's text is `Exit code N` plus `output_for_prompt`, the shape `categorize` expects. `run_terminal_command` joins `SHELL_TOOLS`. `use_tool` is stored as `mcp__<server>__<tool>`. The result size is the UTF-8 length of the result's text content. Agent message and thought chunks give the follow-up text of an error.

### Prompts are keyed by the turn's prompt id
A `user_message_chunk` belongs to the newest `user_prompt_submit` hook's `prompt_id` before it. The chunks of one prompt make one row. A turn that ends `cancelled` marks its prompt interrupted. Text is not classified as injected: a wrapper around the typed text (T3 Code's) is still the person's prompt.

Prompt ids repeat across sessions: a wrapper app can supply them, and nine real sessions share one. So the stored prompt id is `<session id>:<prompt id>`, in `prompts`, in the interrupted marks and in the tool results.

### Model time is one run per turn
`session_runs` gets a row per `turn_completed`: `start_ms` is the turn's end minus `elapsed_ms`, `api_ms` is `apiDurationMs`, and tool time and lines are NULL. Task 3.6 checks that every reader shows "–" for the NULLs.

### Live reads a Grok turn from its lines
`grok.live_items` gives `prompt` and `turn_start` for a prompt line, `turn_end` for `turn_completed` (with `interrupt` when cancelled), `tool_use` and `tool_result`, `reply`, `compaction`, and `agent` for a spawn. The turn marks that `live.recent` and `live.state` now read with Codex's raw types become a property of the source, not a `source == "codex"` test. `close_type` is `session_end`.

`store.Source` holds four fields for this. `turns` is a `Turns` value, or None for a source with no turn marks (Claude Code): the values of a turn's start and end lines, which are raw types, or the strings at a JSON path when the marks share one raw type (Codex). `lane` maps the path of a file of subagent lines to the subagent's id. `spawn` is the raw type and a text of the lines whose `live_items` give an `agent` item, or None for a source that names the spawn call beside the subagent's file (Claude Code). `compaction` is the raw type and a text of a compaction line; `store.compaction_filter` builds the SQL filter of Live and of the session timeline from it.

### "Not Claude" is said as "not Claude"
Web and Python code that means "this source has no judgments" or "no `/context`" tests `=== "codex"` today. It becomes a test for Claude Code. Text that names the agent takes the picked source's label.

## Risks / Trade-offs

- [The format is undocumented and changed between 1.0.77 and 1.0.92] → Ignore unknown `sessionUpdate` values. Base fixtures on real 1.0.92 lines. Derive nothing from a field the fixtures do not hold.
- [A call with no line carrying `streamStartMs` would be missed] → The turn's totals stay exact whatever the number of rows; only the request count is off by that call.
- [The first value of `totalTokens` in a turn's first call is a stale estimate (about 4K against 24K)] → Use the largest value of the call.
- [A child file read before its parent's `subagent_spawned` line is stored would be its own session and count its usage twice] → Sorted discovery reads parents first, and Grok writes `subagent_spawned` before it creates the child folder. A test checks the order. A rebuild repairs a store where it happened.
- [A turn that never ends (a crash) has no `turn_completed`] → Its usage is lost. The README says usage arrives per turn.
- [xAI's cache lifetime is not stated anywhere local] → A Grok cache break is never `expired`.
- [Only one subagent session exists, from CLI 1.0.77] → Task 2.1 runs a probe on 1.0.92 with a subagent, an MCP call and a cancelled turn before the fixtures are cut.

## Migration Plan

1. Opening the store adds `requests.reported_cost` (NULL for existing rows). There is no re-ingest.
2. The first ingest after upgrade reads `~/.grok/sessions/**/updates.jsonl` from the start.
3. Rollback: the older app ignores the extra column. It would show `grok` rows under All. To remove them, delete the `grok` rows of `raw_lines` and `files`, then run `rebuild`.
