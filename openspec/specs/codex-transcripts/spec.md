# codex-transcripts Specification

## Purpose

How OpenAI Codex CLI transcripts become AI Ledger's sessions, requests, tool calls and prompts, at the same depth as Claude Code transcripts, so the dashboards can show Codex work and spend next to Claude's.

## Requirements

### Requirement: Ingest live and archived Codex sessions
The store SHALL ingest every Codex session file under the Codex home: plain `sessions/**/rollout-*.jsonl` files and compressed `archived_sessions/*.jsonl.zst` files. Plain files SHALL be read incrementally like Claude transcripts. A compressed file SHALL be read whole once, and again only when its size or modification time changes.

#### Scenario: Live session grows
- **WHEN** a session file under `~/.codex/sessions/2026/11/06/` gains 12 complete lines since the last ingest
- **THEN** ingest reads only those 12 lines

#### Scenario: Archived session never seen live
- **WHEN** `~/.codex/archived_sessions/rollout-2026-06-15T23-24-26-<id>.jsonl.zst` holds 314 lines and was never ingested
- **THEN** ingest stores all 314 lines, and its session appears in the dashboards

#### Scenario: Codex home missing
- **WHEN** `~/.codex` does not exist
- **THEN** ingest skips the Codex source without an error and still ingests Claude transcripts

### Requirement: Count an archived session once
Each Codex line SHALL be keyed by the thread named in its file name and its `ordinal`, so the same line in a live file and in its archived copy is stored once.

#### Scenario: Session archived after ingest
- **WHEN** a session was ingested from `sessions/` and Codex later moves it to `archived_sessions/` as `.jsonl.zst`
- **THEN** its lines, requests and tool calls are not duplicated, and its token totals do not change

#### Scenario: Thread file that continues a session
- **WHEN** a file is named `rollout-<time>-<session>_<thread>.jsonl.zst` and its ordinals overlap the ordinals of the `<session>` file
- **THEN** the store keeps both files' lines. Lines are keyed by `<thread>`, and that thread's requests and tool calls belong to session `<session>` as subagent work

### Requirement: Normalize Codex token counts
Each Codex response SHALL be counted once, by its `response_id`. Its token counts SHALL be stored with the same meaning as Claude's:
- uncached input is `input_tokens` minus `cached_input_tokens` and `cache_write_input_tokens`, so the total is always `input_tokens` plus `output_tokens`
- cache read is `cached_input_tokens`
- cache write is `cache_write_input_tokens`
- output is `output_tokens`
- thinking is `reasoning_output_tokens`, which is part of output, as Claude's thinking is

#### Scenario: Cached input
- **WHEN** a `token_usage_record` reports `input_tokens` 25,707, `cached_input_tokens` 13,440 and `output_tokens` 182
- **THEN** the request stores input 12,267, cache read 13,440 and output 182, and its total is 25,889 tokens

#### Scenario: Usage repeated in a running total
- **WHEN** an `event_msg` of type `token_count` repeats the same usage as the preceding `token_usage_record`
- **THEN** the usage is counted once

### Requirement: Attribute model and effort per turn
Each Codex request SHALL carry the model and reasoning effort of its turn, taken from that turn's `turn_context`. A session's peak context SHALL be its largest input including cached input.

#### Scenario: Model changes between turns
- **WHEN** turn 1's `turn_context` names `gpt-6-astra` with effort `medium` and turn 2's names `gpt-6.1-sol` with effort `high`
- **THEN** turn 1's requests are `gpt-6-astra` / `medium` and turn 2's are `gpt-6.1-sol` / `high`

#### Scenario: Effort not stated
- **WHEN** a turn's `turn_context` has no reasoning effort
- **THEN** its requests have no effort, and the model mix shows them as `(none)`

### Requirement: Record Codex tool calls and errors
Codex tool calls SHALL be the CLI's completed items: MCP tool calls, shell commands, file changes and web searches. The `exec` script that wraps them SHALL NOT itself count as a tool call. An item with status `failed` SHALL be a tool error, with the error text, a category, and the agent's next message as its follow-up.

#### Scenario: MCP call
- **WHEN** an `item_completed` event holds an `McpToolCall` for server `t3-code`, tool `preview_status`, with status `completed`
- **THEN** one tool call `mcp__t3-code__preview_status` with MCP server `t3-code` is recorded without an error

#### Scenario: Failed shell command
- **WHEN** a `CommandExecution` item has status `failed` and exit code 1
- **THEN** one tool call is recorded as an error with its command as input and its output and exit code as error text, and it appears on the Errors page

#### Scenario: Commit and test commands
- **WHEN** a `CommandExecution` item runs `git commit -m "fix"` and completes
- **THEN** it counts as a commit on Activity, as Claude's Bash commits do

### Requirement: Recognize human prompts in Codex sessions
A Codex prompt SHALL be a user message the person typed. Messages the CLI injects, such as `<environment_context>`, `<heartbeat>` and `AGENTS.md` instructions, SHALL NOT count as prompts. A turn that ends in `turn_aborted` with reason `interrupted` SHALL mark its prompt interrupted.

#### Scenario: Injected context
- **WHEN** a turn starts with an `<environment_context>` user message followed by the typed text `run it now`
- **THEN** the session gains one prompt, for `run it now`

#### Scenario: Automation heartbeat
- **WHEN** a user message starts with `<heartbeat>`
- **THEN** it is not a prompt, and the requests it causes still count toward usage and cost

#### Scenario: Interrupted turn
- **WHEN** a turn's `turn_aborted` event has reason `interrupted`
- **THEN** that turn's prompt is marked interrupted
