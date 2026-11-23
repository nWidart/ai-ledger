# Spec Delta

## ADDED Requirements

### Requirement: Record the thread that made each call and request
Each derived tool call and each derived request SHALL carry the subagent thread that made it, as the id the Live page gives that subagent's lane: the `<id>` of Claude Code's `agent-<id>.jsonl`, a Codex thread id, a Grok child session id. A call or a request of the main thread SHALL carry none. All three sources SHALL fill it in the same shape.

#### Scenario: Call of a Claude Code subagent
- **WHEN** `subagents/agent-a1.jsonl` of a session holds a `Read` call and the request that made it
- **THEN** the derived call and the derived request both carry the thread `a1`

#### Scenario: Call of the main thread
- **WHEN** a session's main transcript holds a `Bash` call
- **THEN** the derived call carries no thread

#### Scenario: Codex thread
- **WHEN** a Codex subagent thread `t2` runs an `exec_command` call
- **THEN** the derived call carries the thread `t2`

#### Scenario: Grok child adopted later
- **WHEN** a Grok child session `c1` was stored as a session of its own, and its parent's `subagent_spawned` line is stored after it
- **THEN** the child's calls move to the parent's session and carry the thread `c1`

### Requirement: Record the calls that start a subagent or delegate a task
The store SHALL keep one derived record per call that starts a subagent (Claude Code `Agent` or `Task`, Codex `spawn_agent`, Grok `spawn_subagent`) and per call that delegates a task (`mcp__t3-code__delegate_task`): its session, its kind, the thread that made it, its tool, its start time, and the label the agent gave it, cut to 300 characters. The record SHALL NOT hold the prompt or the task text.

#### Scenario: Agent call
- **WHEN** a Claude Code main thread makes an `Agent` call with the description "Map the parsers" and a prompt of 4,000 characters
- **THEN** the store holds one record of kind subagent for that call, with the description "Map the parsers", no thread, and no prompt text

#### Scenario: Codex spawn call
- **WHEN** a Codex thread makes a `spawn_agent` call with the task name "review"
- **THEN** the store holds one record of kind subagent for that call, with the description "review"

#### Scenario: Delegation call
- **WHEN** a session makes a `mcp__t3-code__delegate_task` call with the title "Write the tests" and a task of 2,000 characters
- **THEN** the store holds one record of kind delegation for that call, with the description "Write the tests", and no task text

#### Scenario: Long label
- **WHEN** an `Agent` call has a description of 2,000 characters
- **THEN** the record holds its first 300 characters

### Requirement: Record the subagent a call started
A record of kind subagent SHALL name the subagent its call started once a transcript line says it: for Claude Code the call's result, for Codex the `SubAgentActivity` start item, for Grok the `spawn_subagent` call's result. The record SHALL be the same whichever of the call and the naming line is stored first.

#### Scenario: Claude Code result names the subagent
- **WHEN** an `Agent` call's result line carries the agent id `a1`
- **THEN** the call's record names the subagent `a1`

#### Scenario: Subagent of a subagent
- **WHEN** `subagents/agent-a1.jsonl` holds an `Agent` call whose result carries the agent id `b2`
- **THEN** the call's record carries the thread `a1` and names the subagent `b2`

#### Scenario: Codex start item stored first
- **WHEN** a `SubAgentActivity` start item for thread `t2` is stored in one ingest and the `spawn_agent` call it names in the next
- **THEN** the store holds one record for that call, with its description and the subagent `t2`

#### Scenario: Call still running
- **WHEN** a Claude Code `Agent` call has no result yet
- **THEN** its record names no subagent

### Requirement: Record a delegation's target and status
A record of kind delegation SHALL carry the provider and the model the call asked for (`target.providerInstanceId`, `target.model`), else those its result states, and the `status` its result states, as written. A value no line states SHALL be none. The store SHALL read nothing but the session's own transcript for it.

#### Scenario: Target in the input
- **WHEN** a delegation call's input has the target model `gpt-6.1-sol` and the provider `codex`
- **THEN** its record carries that model and that provider

#### Scenario: Status in the result
- **WHEN** a Claude Code delegation call's result line carries `mcpMeta.structuredContent.status` of `running` and a `model` of `claude-opus-5-5`, and its input named no target
- **THEN** its record carries the status `running` and the model `claude-opus-5-5`

#### Scenario: No result yet
- **WHEN** a delegation call has no result
- **THEN** its record carries no status

### Requirement: Add the agent records to an existing store
A store created before the thread of a call and of a request, and the records of subagent and delegation calls, existed SHALL gain them when opened, without losing or re-reading any line. They SHALL be empty for the lines already stored until the user runs a rebuild, which SHALL fill them from the stored lines alone. Lines ingested after the upgrade SHALL fill them.

#### Scenario: Older store opened
- **WHEN** the app opens a store that has no thread on its calls
- **THEN** the store opens, every page works, and the calls already derived carry no thread

#### Scenario: Rebuild fills the records
- **WHEN** the user runs a rebuild on that store
- **THEN** each subagent's calls and requests carry its thread, and each subagent and delegation call has its record

#### Scenario: New lines after the upgrade
- **WHEN** a subagent makes a call after the store was opened by the new version, with no rebuild
- **THEN** the derived call carries its thread
