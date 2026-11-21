## MODIFIED Requirements

### Requirement: Show each session on its wall tile
A wall tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. The error count SHALL agree in number with its noun: "1 error", "2 errors". The tile SHALL be a toggle whose pressed state says whether it is pinned. Its accessible name SHALL come from its content: "Pin" and the session's name, then all the tile shows, in words, current after each update.

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile reads "1 error"

#### Scenario: A screen reader on a tile
- **WHEN** a screen reader reaches the tile of a session titled "Fix login" in project foo
- **THEN** it reads "Pin Fix login", then the project, state, latest action, context, tools, errors, cost, branch, source and model, and not pressed

#### Scenario: A tile that updates
- **WHEN** the tile's state or figures change while a screen reader is on it
- **THEN** the tile's name says the new state and figures

### Requirement: Announce new events in the stream
The stream SHALL be a log (`role="log"`) that the user reads by moving through it, and SHALL NOT announce each event as it arrives. While Follow is off and new events arrive, the page SHALL show how many arrived beside Jump to latest, as "N new events" in a polite status region, and SHALL update it at most once every 5 seconds. With Follow on, the page SHALL announce nothing for new events.

#### Scenario: Read back while the session runs
- **WHEN** Follow is off and 12 tool calls arrive over 30 seconds
- **THEN** the status says "12 new events" by the end, was never read row by row, and Jump to latest turns Follow back on and empties the status

#### Scenario: Follow on
- **WHEN** Follow is on and tool calls arrive
- **THEN** the page announces nothing

#### Scenario: Follow turned off with its checkbox
- **WHEN** 2 events arrive with Follow on, the user clears the Follow checkbox, and 1 more event arrives
- **THEN** the status says "1 new event"

#### Scenario: A full buffer
- **WHEN** the stream holds as many events as it keeps, Follow is off, and 1 event arrives, dropping the oldest
- **THEN** Jump to latest shows and the status says "1 new event"
