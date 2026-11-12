# Spec Delta

## MODIFIED Requirements

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *ended*: the transcript shows the session closed, and no timed line of the main thread follows the close.
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest main-thread line is a human prompt or a tool result, or, for Codex, the newest main-thread turn has started and not completed.
- *your turn*: otherwise.

#### Scenario: Tool running
- **WHEN** the newest line of a session is a `Read` tool use with no result yet
- **THEN** the state is running a tool, naming `Read` and its start time

#### Scenario: Turn ended
- **WHEN** the newest line is an assistant reply with text and no pending tool call
- **THEN** the state is your turn

#### Scenario: Prompt sent
- **WHEN** the newest line is the user's prompt
- **THEN** the state is thinking

#### Scenario: Quiet session
- **WHEN** a session's newest line is 7 minutes old, even with a pending tool call
- **THEN** the state is idle

#### Scenario: Codex turn started in a thread file
- **WHEN** a Codex session's newest turn started in a `<session>_<thread>` rollout file that continues the main thread (its `session_meta` has the same `session_id` and `id`) and has not completed, with no pending tool call
- **THEN** the state is thinking

#### Scenario: Child thread's turn completes
- **WHEN** a Codex session's main-thread turn has started and not completed, and a subagent thread's turn completes, with no pending tool call
- **THEN** the state stays thinking

### Requirement: Mark inferred states
Every payload that carries a state SHALL say whether it is inferred. *likely waiting for approval* is always inferred: no transcript records a permission prompt. *thinking* is inferred for Claude Code, which records no request in flight, and wherever a subagent's work gives it. It is not inferred for Codex's own turns, which it records. *running a tool*, *your turn*, *idle* and *ended* are not inferred.

#### Scenario: Thinking is inferred
- **WHEN** a session's state is thinking
- **THEN** the payload marks the state as inferred

#### Scenario: Codex turn in progress
- **WHEN** a Codex session's newest main-thread turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Thinking from a subagent
- **WHEN** a Codex session's state is thinking because a subagent is at work
- **THEN** the payload marks the state as inferred

#### Scenario: Running a tool is not inferred
- **WHEN** a session's state is running a tool
- **THEN** the payload does not mark the state as inferred

#### Scenario: Ended is not inferred
- **WHEN** a session's state is ended
- **THEN** the payload does not mark the state as inferred

### Requirement: Group subagent work
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: for Claude Code from the call's result when the subagent ends, and while it runs from `agent-<id>.meta.json`; for Codex from the `SubAgentActivity` start item in the parent's transcript.

#### Scenario: Subagent with three tool calls
- **WHEN** a Claude Code session starts an Explore subagent that makes three tool calls
- **THEN** the three calls are returned marked as that subagent's, not as the main thread's

#### Scenario: Subagent still running
- **WHEN** a Claude Code session started a subagent with an `Agent` call that has no result yet
- **THEN** that call names the subagent

#### Scenario: Codex subagent
- **WHEN** a Codex subagent thread writes `rollout-<time>-<thread>.jsonl` with its own `session_meta` naming the parent session, and makes two tool calls
- **THEN** the parent session's events hold the two calls marked as that thread's

#### Scenario: Codex spawn call
- **WHEN** a Codex `spawn_agent` call's id equals the `id` of a `SubAgentActivity` item of kind `started` for thread `<thread>`
- **THEN** that call names `<thread>`, and its end time stays unset until its result arrives

#### Scenario: Codex CLI without a start item
- **WHEN** a subagent of a Codex CLI that writes no `SubAgentActivity` start item runs
- **THEN** its lane is named by no call, and the page tells it done by its last turn mark

### Requirement: Report a closed session as ended
The app SHALL take as evidence of a close the `cost-state` line Claude Code writes as it exits, when it comes after the last timed line of the session's main transcript file. A subagent's lines SHALL NOT reopen a closed session, nor a line with no time. Codex writes no close line: a Codex session SHALL never be *ended*. An *ended* state SHALL carry the time of the newest timed line, as the close line has none.

#### Scenario: Closed session
- **WHEN** a Claude Code session's main transcript ends with a `cost-state` line
- **THEN** the state is ended, with the time of the session's newest timed line, and not your turn or idle

#### Scenario: Closed session resumed
- **WHEN** a timed line follows the `cost-state` line in the session's main transcript
- **THEN** the state comes from the other rules, as for any session

#### Scenario: Subagent writes after the close
- **WHEN** a subagent's transcript gains a line after the session's `cost-state` line
- **THEN** the state stays ended

#### Scenario: Codex session
- **WHEN** a Codex session's last turn has completed and its rollout is not written to again
- **THEN** the state is your turn, then idle after 5 minutes, and never ended

#### Scenario: Resumed session before its first timed line
- **WHEN** a resumed Claude Code session has written only lines with no time, such as `mode` or `tools-used`, after its `cost-state` line
- **THEN** the state is ended until its first timed line, a known limit: Claude Code writes such lines at exit as well, so none marks a resume

## ADDED Requirements

### Requirement: Keep a session working while a subagent works
When the main thread reads *your turn* and a subagent's newest line is newer than the main thread's and shows it at work, the state SHALL be *thinking*, inferred, since that line. A Codex subagent is at work when its newest turn mark is a turn start; a Claude Code one when its newest event is a finished tool call. A subagent's pending call still reads *running a tool*.

#### Scenario: Codex subagent mid-turn
- **WHEN** the main thread's last turn completed at 10:00:09 and a subagent started a turn at 10:00:12 that has not completed
- **THEN** the state is thinking since 10:00:12, marked as inferred

#### Scenario: Claude Code subagent between calls
- **WHEN** the main thread's newest event is a reply, after a background `Agent` call returned, and a subagent's newest event is a finished tool call, newer than it
- **THEN** the state is thinking, inferred

#### Scenario: Subagent done
- **WHEN** a Codex subagent's newest turn mark is a turn end
- **THEN** the state is your turn

#### Scenario: Subagent older than the main thread
- **WHEN** the main thread's turn completed after a subagent's last turn start
- **THEN** the state is your turn

### Requirement: Keep the main thread in the state window
The newest lines read for a session's state SHALL be taken apart for the main thread and for its subagents, so subagent traffic never pushes main-thread lines out. For Codex, the main thread's newest turn mark SHALL be read whatever its age.

#### Scenario: Busy subagent
- **WHEN** a subagent wrote more than 200 lines after the main thread's last line
- **THEN** the main thread's newest lines are still read for the state

#### Scenario: Long turn
- **WHEN** a Codex main-thread turn started more than 200 lines ago and has not completed
- **THEN** the state is thinking

### Requirement: Show a failed call made inside a Codex script
A failed Codex item that no tool call of the session has the id of, such as a command an `exec` script ran, SHALL be one finished, failed tool event on its file's lane, with its tool, input summary and error text, starting and ending at its line's time. It SHALL NOT change the state. A failed item with a matching call marks that call failed; a successful inner call shows nothing.

#### Scenario: Failed command inside a script
- **WHEN** an `exec` call's script runs a command that fails and the line has an id no call has
- **THEN** the stream holds a failed `exec_command` event with the command and its error text

#### Scenario: Matching call
- **WHEN** a failed item has the id of a tool call
- **THEN** that call is marked failed and no second event is shown

### Requirement: Skip a forked subagent's copied history
A forked Codex subagent's transcript names, in `subagent_history_start_ordinal`, the first line of its own: the lines before it copy the parent's history. Those lines SHALL produce no event and no state evidence.

#### Scenario: Copied turn start
- **WHEN** a forked subagent's file copies a parent turn start below its start ordinal
- **THEN** the session's events and state do not hold that turn start
