# live-sessions Specification

## Purpose

Follow running Claude Code and Codex sessions within seconds of their transcript lines being written: which sessions are active, what each is doing, and the events of one session as they arrive, with transcript text sent only on request.

## Requirements

### Requirement: List active sessions
The app SHALL list as active every session whose newest stored line is less than 10 minutes old, newest first. Each entry SHALL give the session's project, source, git branch, model, cost so far and state. The list SHALL honour the project, source and automated filters.

#### Scenario: Two running sessions and an old one
- **WHEN** session A wrote a line 20 seconds ago, session B 4 minutes ago and session C 2 hours ago
- **THEN** the list holds A then B, and not C

#### Scenario: Filtered to one source
- **WHEN** a Claude Code and a Codex session are active and the source filter is Codex
- **THEN** the list holds only the Codex session

#### Scenario: Automated session
- **WHEN** an automated session is active and the automated toggle is off
- **THEN** the list does not hold it

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest line is a human prompt or a tool result, or, for Codex, the newest turn has started and not completed.
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

### Requirement: Flag a likely approval wait
When a shell tool call (Claude Code `Bash`, Codex `exec` or `exec_command`) has had no result for more than 30 seconds, the app SHALL report the state as *likely waiting for approval*, with how long the call has been pending. A newer pending call, in the main thread or a subagent, SHALL NOT hide it; with several such calls, the oldest SHALL be reported.

#### Scenario: Slow shell call
- **WHEN** a `Bash` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, pending 45 seconds

#### Scenario: Newer call in a subagent
- **WHEN** a `Bash` call started 45 seconds ago and has no result, and a subagent started a `Read` call 2 seconds ago
- **THEN** the state is likely waiting for approval, naming `Bash`, pending 45 seconds

#### Scenario: Slow non-shell call
- **WHEN** a `WebFetch` call started 45 seconds ago and has no result
- **THEN** the state is running a tool

### Requirement: Mark inferred states
Every payload that carries a state SHALL say whether it is inferred. *likely waiting for approval* is always inferred: no transcript records a permission prompt. *thinking* is inferred for Claude Code, which records no request in flight. It is not inferred for Codex, which records when a turn starts and completes. *running a tool*, *your turn* and *idle* are not inferred.

#### Scenario: Thinking is inferred
- **WHEN** a session's state is thinking
- **THEN** the payload marks the state as inferred

#### Scenario: Codex turn in progress
- **WHEN** a Codex session's newest turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Running a tool is not inferred
- **WHEN** a session's state is running a tool
- **THEN** the payload does not mark the state as inferred

### Requirement: Stream one session's events
For one session, the app SHALL return its events in transcript order: prompts, assistant replies, tool calls and compactions. Each tool call SHALL carry its tool, input summary, start time, end time or none, and failure with its error. A request for events after a given point SHALL return the later events and SHALL read again the minute before that point, as transcript lines can be written seconds after their timestamp; each event keeps one key, so the page holds one copy of it.

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

### Requirement: Group subagent work
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: from the call's result when the subagent ends, and while it runs from the start record Claude Code writes beside its transcript (`agent-<id>.meta.json`).

#### Scenario: Subagent with three tool calls
- **WHEN** a Claude Code session starts an Explore subagent that makes three tool calls
- **THEN** the three calls are returned marked as that subagent's, not as the main thread's

#### Scenario: Subagent still running
- **WHEN** a Claude Code session started a subagent with an `Agent` call that has no result yet
- **THEN** that call names the subagent

### Requirement: Send transcript text only on request
By default, prompts and replies SHALL be returned as word counts and tool results as character counts, without their text. A session title made from the first prompt is prompt text, and SHALL be left out by default. A tool call's input SHALL be cut to 300 characters by default, and a subagent call (Claude Code `Agent`, Codex `spawn_agent`) SHALL carry its description instead of its prompt. Only a request that asks for text SHALL receive the prompt and reply text, whole tool inputs, up to 4 KB of each tool result, and first-prompt titles.

#### Scenario: Default request
- **WHEN** the page asks for events without asking for text
- **THEN** no prompt, reply or tool-result text is in the response, no first-prompt title, no subagent prompt and no tool input longer than 300 characters

#### Scenario: Text requested
- **WHEN** the page asks for events with text
- **THEN** prompts and replies come as written and each tool result is cut to 4 KB

### Requirement: Report the agent's figures
For one session, the app SHALL report:
- the context of its newest main-thread request, and the model's context window when it is known;
- its compactions, with the context before each;
- its cost, requests, tool calls, failed tool calls and cache-read share;
- tokens per minute over the last minute;
- the newest plan-limit use for the session's source.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

### Requirement: Notify open pages of changes
While a Live page is connected, the app SHALL push a notice after each ingest that stored new lines, naming the sessions that gained lines. It SHALL send a keep-alive at least every 15 seconds. A notice SHALL never carry transcript content.

#### Scenario: Session gains lines
- **WHEN** an ingest stores new lines for sessions A and B
- **THEN** each connected Live page gets one notice naming A and B

#### Scenario: Nothing new
- **WHEN** an ingest stores no new lines
- **THEN** no notice is sent

#### Scenario: Connection drops
- **WHEN** a Live page closes or loses its connection
- **THEN** the app stops writing to that connection and counts one fewer connected page

### Requirement: Title each live session
Each active-session entry and each session payload SHALL carry the session's title and say whether it came from the agent (a custom title, an AI title or a Codex thread name) or from the first prompt. A title from the agent SHALL always be sent. A title from the first prompt SHALL be sent only to a request that asks for text.

#### Scenario: Agent title
- **WHEN** an active session has the AI title "Add session titles" and the page asks for the list without text
- **THEN** the entry carries "Add session titles", marked as from the agent

#### Scenario: Prompt title without text
- **WHEN** an active session has no agent title and the page asks for the list without text
- **THEN** the entry carries no title

#### Scenario: Prompt title with text
- **WHEN** the same session is asked for with text
- **THEN** the entry carries the title made from its first prompt, marked as from the prompt

#### Scenario: Title arrives during the session
- **WHEN** a session's `ai-title` line is stored after the page first listed it
- **THEN** the next list after the change notice carries the new title
