# Spec Delta

## Purpose

The Live page: watch running sessions as they happen from the agent's side, one session in detail or all of them at a glance, with transcript text shown only when the user asks for it.

## ADDED Requirements

### Requirement: Show active sessions in a rail
The Live page SHALL list the active sessions in a rail. Each entry SHALL show the project with its color, the source, the cost so far and the state. Selecting an entry SHALL open that session in the stream. With no session selected, the page SHALL open the newest active session.

#### Scenario: Open Live with two running sessions
- **WHEN** the user opens `/live` while sessions in `ai-ledger` and `jobdesk` are active, and `ai-ledger` wrote last
- **THEN** the rail lists both, and the stream shows `ai-ledger`

#### Scenario: No active session
- **WHEN** no session wrote a line in the last 10 minutes
- **THEN** the page says no session is active and shows when the newest session last wrote, with a link to it on Activity

### Requirement: Show a session's stream
The stream SHALL show the selected session's events in order. Each tool call SHALL be a row with its tool, input summary, duration and result. A running call SHALL show a timer that counts up each second. A failed call SHALL be marked as failed. Compactions SHALL be marked between events.

#### Scenario: Tool call starts and ends
- **WHEN** a `Bash` call starts in the followed session and ends 8 seconds later
- **THEN** its row appears within 3 seconds of the start with a running timer, and when the result arrives it shows 8s and passed

#### Scenario: Failed tool call
- **WHEN** a tool call fails
- **THEN** its row is marked as failed, and the agent panel's error count goes up by one

### Requirement: Open a tool call's detail
Selecting a tool row SHALL open its detail in place: the input summary, the start time, the error when it failed, and the result. With Full text off, the result SHALL show only its size.

#### Scenario: Open a failed call
- **WHEN** the user selects a failed `Bash` row with Full text off
- **THEN** the detail shows the command, the start time and the error, and the result as a character count

### Requirement: Fold subagent lanes
Subagent work SHALL appear as a lane inside the stream. The lane header SHALL show the subagent's name, its description, its tool-call count, its duration and whether it is still running. Selecting the header SHALL fold or unfold the lane.

#### Scenario: Fold a lane
- **WHEN** the user selects the header of an Explore lane with three tool calls
- **THEN** the three rows are hidden and the header still shows three tool calls

### Requirement: Show the agent panel
Beside the stream, the page SHALL show the selected session's state with its detail, context window fill with a mark at each compaction, cost, requests, tool calls, errors, cache-read share, a tokens-per-minute chart of the last minute, and the plan-limit use for its source. An inferred state SHALL be shown as inferred.

#### Scenario: Context near full
- **WHEN** the session uses more than 80% of its model's context window
- **THEN** the context meter shows the warning color

#### Scenario: Likely waiting for approval
- **WHEN** the selected session's state is likely waiting for approval
- **THEN** the panel and the tool row show it in the warning color, and say that it is inferred and why

### Requirement: Toggle full text
The page SHALL offer a Full text toggle that is off on every page load. With it off, prompts and replies SHALL show as word counts and tool results as sizes. With it on, they SHALL show as written, and a banner SHALL say that secrets can appear.

#### Scenario: Turn on full text
- **WHEN** the user turns on Full text
- **THEN** the stream shows prompts, replies and tool results as written, and the banner appears

#### Scenario: Reload
- **WHEN** the user reloads the page after turning Full text on
- **THEN** Full text is off

### Requirement: Follow the newest event
With Follow on, the stream SHALL keep the newest event in view. Scrolling up or opening a tool row SHALL turn Follow off. While Follow is off and new events arrive, the page SHALL offer Jump to latest, which turns Follow back on.

#### Scenario: Read back while the session runs
- **WHEN** the user scrolls up while new tool calls arrive
- **THEN** the stream stays where the user scrolled, and Jump to latest appears

### Requirement: Pause updates
The page SHALL offer Pause, which holds new events and states until Resume. While paused, the page SHALL say so.

#### Scenario: Pause and resume
- **WHEN** the user pauses, three tool calls arrive, and the user resumes
- **THEN** nothing changes while paused, and the three calls appear on resume

### Requirement: Show all sessions on a wall
The page SHALL offer a Wall view with one tile per active session. A tile SHALL show the project, state, latest action, context fill, tool count, errors, cost, branch, source and model. Selecting a tile SHALL open that session in the stream view.

#### Scenario: Pick a session from the wall
- **WHEN** the user selects the `graft` tile on the wall
- **THEN** the stream view opens on `graft`

### Requirement: Keep the selection in the URL
The page SHALL keep the selected session and the view (Stream or Wall) in the URL, with the shared project, source and automated filters.

#### Scenario: Reload on a session
- **WHEN** the user reloads `/live` while following session A
- **THEN** the page opens on session A in the same view

#### Scenario: Selected session no longer active
- **WHEN** the URL names a session that is no longer active
- **THEN** the stream still shows that session's newest events, marked idle

### Requirement: Recover from a dropped connection
When the update connection drops, the page SHALL say that updates are paused and SHALL reconnect on its own. After reconnecting it SHALL fetch what it missed.

#### Scenario: App restarted
- **WHEN** the app restarts while the Live page is open
- **THEN** the page shows that it is reconnecting, then catches up without a reload
