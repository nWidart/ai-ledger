# Spec Delta

## Purpose

How xAI Grok CLI session logs become AI Ledger's sessions, requests, tool calls, prompts and hooks, so the dashboards can show Grok work and spend next to Claude Code's and Codex's.

## ADDED Requirements

### Requirement: Ingest Grok session logs
The store SHALL ingest each session's `updates.jsonl` under the Grok home's `sessions/<encoded cwd>/<session>/` folders, incrementally like Claude transcripts. The session's working directory SHALL be the URL-decoded folder name. Other files in a session folder SHALL NOT be ingested.

#### Scenario: Live session grows
- **WHEN** a session's `updates.jsonl` gains 40 complete lines since the last ingest
- **THEN** ingest reads only those 40 lines

#### Scenario: Working directory from the folder name
- **WHEN** a session lives under `sessions/%2FUsers%2Fme%2FSites%2Fai-ledger/<session>/`
- **THEN** its session has cwd `/Users/me/Sites/ai-ledger` and belongs to that folder's project

#### Scenario: Grok home missing
- **WHEN** `~/.grok` does not exist
- **THEN** ingest skips the Grok source without an error and still ingests the other sources

### Requirement: Key Grok lines by event id
Each Grok line SHALL be keyed by its `_meta.eventId`, which names the session and the line's place in it, so a line read twice is stored once.

#### Scenario: File read again from the start
- **WHEN** a session's `updates.jsonl` is rewritten and ingest reads it from the start
- **THEN** lines already stored are not stored again, and the session's totals do not change

### Requirement: Count Grok usage per turn
Each `turn_completed` line SHALL become one request per model in its `usage.modelUsage`, counted once. A turn that has not completed SHALL have no requests yet. Token counts SHALL keep the shared meaning:
- uncached input is `inputTokens` minus `cachedReadTokens` and `cacheCreationTokens`
- cache read is `cachedReadTokens`, cache write is `cacheCreationTokens`
- output is `outputTokens`, and thinking is `reasoningTokens`, part of output

#### Scenario: Probe turn
- **WHEN** a `turn_completed` line reports, for model `grok-4.7-build`, `inputTokens` 97,245, `cachedReadTokens` 41,600, `cacheCreationTokens` 0, `outputTokens` 459 and `reasoningTokens` 230
- **THEN** one request is stored with model `grok-4.7-build`, input 55,645, cache read 41,600, output 459 and thinking 230, and its total is 97,704 tokens

#### Scenario: Turn still running
- **WHEN** a session's current turn has made model calls but has no `turn_completed` line yet
- **THEN** the session's tool calls appear, and its usage for that turn does not appear until the turn completes

#### Scenario: Two models in one turn
- **WHEN** a turn's `usage.modelUsage` names `grok-4.7-build` and `grok-4.7-build-fast`
- **THEN** that turn stores two requests, one per model, each with its own counts and cost

### Requirement: Keep the cost Grok reports
Each Grok request SHALL carry the cost Grok reported for its model in that turn, `costUsdTicks` divided by 10,000,000,000, in US dollars.

#### Scenario: Reported cost
- **WHEN** a turn's model usage reports `costUsdTicks` 1,348,440,000
- **THEN** its request costs $0.134844

### Requirement: Peak context of a Grok session
A Grok session's peak context SHALL be the largest `_meta.totalTokens` seen on its lines, and its peak model the model of the turn where it occurred.

#### Scenario: Context grows across a turn
- **WHEN** a session's lines report `totalTokens` 4,347, then 28,194, then 146,654
- **THEN** the session's peak context is 146,654

### Requirement: Attribute Grok subagents to their parent
A subagent session SHALL be recognized from the parent's `subagent_spawned` line, which names its `child_session_id`. The child's tool calls and prompts SHALL belong to the parent session as subagent work. The child's usage SHALL NOT be counted, because the parent turn's usage already includes it. The child SHALL NOT appear as a session of its own.

#### Scenario: Subagent reads a file
- **WHEN** a parent turn spawns subagent `C` that makes 2 model calls and 1 `read_file` call, and the parent's `turn_completed` reports 5 model calls in total
- **THEN** the parent session gains one subagent tool call `read_file`, its requests count all 5 calls' tokens once, and no session `C` appears

### Requirement: Record Grok tool calls and errors
Each `tool_call` SHALL be one tool call, named by `_meta["x.ai/tool"].name`, with its start time. Its `tool_call_update` with a final `status` SHALL end it. The call SHALL be an error when that status is `failed`, or when `rawOutput.exit_code` is set and not 0. A tool outside the `grok_build` namespace SHALL be recorded as MCP tool `mcp__<namespace>__<name>` with that MCP server.

#### Scenario: Failed shell command
- **WHEN** `run_terminal_command` runs `ls /definitely-not-here`, and its update has status `completed` and `rawOutput.exit_code` 1
- **THEN** one tool call is recorded as an error, with the command as input and the exit code and output as error text, and it appears on the Errors page

#### Scenario: Commit command
- **WHEN** `run_terminal_command` runs `git commit -m "fix"` and exits 0
- **THEN** it counts as a commit on Activity, as Claude's Bash commits do

#### Scenario: MCP tool
- **WHEN** a `tool_call` names namespace `t3-code` and tool `preview_status`
- **THEN** one tool call `mcp__t3-code__preview_status` with MCP server `t3-code` is recorded

### Requirement: Recognize prompts in Grok sessions
Each turn's `user_message_chunk` lines SHALL make one prompt, timed at the first chunk. A turn whose `turn_completed` `stop_reason` is `cancelled` SHALL mark its prompt interrupted.

#### Scenario: One typed prompt
- **WHEN** a turn starts with two `user_message_chunk` lines
- **THEN** the session gains one prompt

#### Scenario: Cancelled turn
- **WHEN** a turn's `turn_completed` has `stop_reason` `cancelled`
- **THEN** that turn's prompt is marked interrupted

### Requirement: Record Grok hooks
Each run in a `hook_execution` line SHALL be one hook record, with the event name as the hook, the run's name as the command, its `elapsed_ms` as the duration, and an error when its status is not `success`.

#### Scenario: Session-start hooks
- **WHEN** a `hook_execution` line for `session_start` lists two runs that succeeded in 11 ms and 232 ms
- **THEN** the session gains two `session_start` hook records with those durations and no error
