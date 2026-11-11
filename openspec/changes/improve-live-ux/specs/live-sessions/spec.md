# Spec Delta

## MODIFIED Requirements

### Requirement: List active sessions
The app SHALL list as active every session whose newest stored line is less than 10 minutes old, newest first. Each entry SHALL give the session's project, source, git branch, model, cost so far, state and the time the session started. The list SHALL honour the project, source and automated filters.

#### Scenario: Two running sessions and an old one
- **WHEN** session A wrote a line 20 seconds ago, session B 4 minutes ago and session C 2 hours ago
- **THEN** the list holds A then B, and not C

#### Scenario: Filtered to one source
- **WHEN** a Claude Code and a Codex session are active and the source filter is Codex
- **THEN** the list holds only the Codex session

#### Scenario: Automated session
- **WHEN** an automated session is active and the automated toggle is off
- **THEN** the list does not hold it

#### Scenario: Session start
- **WHEN** a session whose first line is stamped 09:00 wrote a line a minute ago
- **THEN** its entry carries 09:00 as its start, whatever its newest line says

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *ended*: the transcript shows the session closed, and no line follows the close.
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest line is a human prompt or a tool result, or, for Codex, the newest turn has started and not completed.
- *your turn*: otherwise.

The app SHALL report *ended* only when the transcript gives evidence of the close. With no such evidence, a closed session keeps the state the other rules give it. Each state SHALL carry the time it began.

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

#### Scenario: Closed session
- **WHEN** a session's transcript ends with the line that shows the session closed
- **THEN** the state is ended, with the time of that line, and not your turn or idle

#### Scenario: Closed session resumed
- **WHEN** a line follows the line that shows the session closed
- **THEN** the state comes from the other rules, as for any session

#### Scenario: No evidence of a close
- **WHEN** a session's last line is an assistant reply and nothing in the transcript shows the session closed
- **THEN** the state is your turn, and idle after 5 minutes

### Requirement: Flag a likely approval wait
When a shell tool call (Claude Code `Bash`, Codex `exec` or `exec_command`) has had no result for more than 30 seconds, the app SHALL report the state as *likely waiting for approval*, with how long the call has been pending. A newer pending call, in the main thread or a subagent, SHALL NOT hide it; with several such calls, the oldest SHALL be reported. A shell call that runs in the background, or that carries an explicit timeout above 120 seconds, SHALL NOT count: it reads as *running a tool* however long it has been pending. Each tool event and each running-a-tool state SHALL say whether its call is such a call, so the page applies the same rule as the app.

#### Scenario: Slow shell call
- **WHEN** a `Bash` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, pending 45 seconds

#### Scenario: Newer call in a subagent
- **WHEN** a `Bash` call started 45 seconds ago and has no result, and a subagent started a `Read` call 2 seconds ago
- **THEN** the state is likely waiting for approval, naming `Bash`, pending 45 seconds

#### Scenario: Slow non-shell call
- **WHEN** a `WebFetch` call started 45 seconds ago and has no result
- **THEN** the state is running a tool

#### Scenario: Background shell call
- **WHEN** a `Bash` call with `run_in_background` started 45 seconds ago and has no result
- **THEN** the state is running a tool, naming `Bash`, and the call is marked as such

#### Scenario: Long explicit timeout
- **WHEN** a `Bash` call with a timeout of 300 seconds started 45 seconds ago and has no result
- **THEN** the state is running a tool

#### Scenario: Short explicit timeout
- **WHEN** a `Bash` call with a timeout of 60 seconds started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval

#### Scenario: Background call hides no wait
- **WHEN** a `Bash` call with `run_in_background` started 90 seconds ago, and another `Bash` call without one started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, naming the second call, pending 45 seconds

### Requirement: Mark inferred states
Every payload that carries a state SHALL say whether it is inferred. *likely waiting for approval* is always inferred: no transcript records a permission prompt. *thinking* is inferred for Claude Code, which records no request in flight. It is not inferred for Codex, which records when a turn starts and completes. *running a tool*, *your turn*, *idle* and *ended* are not inferred.

#### Scenario: Thinking is inferred
- **WHEN** a session's state is thinking
- **THEN** the payload marks the state as inferred

#### Scenario: Codex turn in progress
- **WHEN** a Codex session's newest turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Running a tool is not inferred
- **WHEN** a session's state is running a tool
- **THEN** the payload does not mark the state as inferred

#### Scenario: Ended is not inferred
- **WHEN** a session's state is ended
- **THEN** the payload does not mark the state as inferred

### Requirement: Stream one session's events
For one session, the app SHALL return its events in transcript order: prompts, assistant replies, tool calls and compactions. Each tool call SHALL carry its tool, input summary, the description the agent gave a shell call when it gave one, start time, end time or none, and failure with its error. Each tool call SHALL also say whether it runs detached (in the background, or with an explicit timeout above 120 seconds) and whether it only reads (Claude Code `Read`, `Grep` and `Glob`; for Codex, a shell call whose every command only reads or searches). A request for events after a given point SHALL return the later events and SHALL read again the minute before that point, as transcript lines can be written seconds after their timestamp; each event keeps one key, so the page holds one copy of it.

#### Scenario: First load
- **WHEN** the page asks for a session's events with no starting point
- **THEN** the app returns the session's newest 500 events and says whether older ones were left out

#### Scenario: Catch up
- **WHEN** the page asks for events after the last one it holds, and two tool calls were written since
- **THEN** the app returns those two tool calls, the events of the minute before the point asked for, and nothing earlier

#### Scenario: Line written late
- **WHEN** a tool result stamped 10 seconds before the last line the page holds is written after the page caught up
- **THEN** the next catch-up returns the call with its result

#### Scenario: Tool call finishes
- **WHEN** a tool call the page received without a result later gets a failing result
- **THEN** the next response for that session carries the call again, with its end time and error

#### Scenario: Both sources
- **WHEN** the session is a Codex session
- **THEN** the events have the same kinds and fields as for a Claude Code session

#### Scenario: Shell call with a description
- **WHEN** a `Bash` call carries the description "Run the Python tests"
- **THEN** its event carries that description beside its command

#### Scenario: Read-only call
- **WHEN** a session makes a `Grep` call and a `Bash` call that runs `git commit`
- **THEN** the `Grep` event is marked as read-only and the `Bash` event is not

#### Scenario: Codex read-only call
- **WHEN** a Codex `exec_command` runs `rg TODO src` and another runs `rg TODO src && rm notes.md`
- **THEN** the first is marked as read-only and the second is not

### Requirement: Group subagent work
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: from the call's result when the subagent ends, and while it runs from the start record Claude Code writes beside its transcript (`agent-<id>.meta.json`). The session payload SHALL also give each subagent's cost and model, so the page can show them in the subagent's group.

#### Scenario: Subagent with three tool calls
- **WHEN** a Claude Code session starts an Explore subagent that makes three tool calls
- **THEN** the three calls are returned marked as that subagent's, not as the main thread's

#### Scenario: Subagent still running
- **WHEN** a Claude Code session started a subagent with an `Agent` call that has no result yet
- **THEN** that call names the subagent

#### Scenario: Subagent cost and model
- **WHEN** a subagent made two requests on `claude-haiku-5-5` that cost $0.02 and $0.03
- **THEN** the session payload gives that subagent a cost of $0.05 and the model `claude-haiku-5-5`

#### Scenario: Subagent with no priced requests
- **WHEN** a subagent has written no assistant line yet
- **THEN** the payload gives it no cost and no model
