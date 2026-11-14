# Spec Delta

## MODIFIED Requirements

### Requirement: Show all sessions on a wall
The page SHALL offer a Wall view with one tile per active session, grouped by state in the rail's order, with the same headings. Each group SHALL be a list under an `h2` heading, with one list item per tile. Inside a group, tiles SHALL be ordered by session start, oldest first. Selecting a tile SHALL open that session in the stream view.

#### Scenario: Pick a session from the wall
- **WHEN** the user selects the `graft` tile on the wall
- **THEN** the stream view opens on `graft`

#### Scenario: Wall groups
- **WHEN** one session is likely waiting for approval and two are running
- **THEN** the wall shows the approval tile under its heading, then the two running tiles under theirs

#### Scenario: Wall structure
- **WHEN** a screen reader user lists the wall's headings and lists
- **THEN** each group's heading is an `h2` followed by a list of its tiles, and the list says how many tiles it holds

## ADDED Requirements

### Requirement: Announce new events in the stream
The stream SHALL be a log (`role="log"`) that the user reads by moving through it, and SHALL NOT announce each event as it arrives. While Follow is off and new events arrive, the page SHALL show how many arrived beside Jump to latest, as "N new events" in a polite status region, and SHALL update it at most once every 5 seconds. With Follow on, the page SHALL announce nothing for new events.

#### Scenario: Read back while the session runs
- **WHEN** Follow is off and 12 tool calls arrive over 30 seconds
- **THEN** the status says "12 new events" by the end, was never read row by row, and Jump to latest turns Follow back on and empties the status

#### Scenario: Follow on
- **WHEN** Follow is on and tool calls arrive
- **THEN** the page announces nothing

### Requirement: Pause the page's requests while the tab is hidden
While the tab is hidden, the Live page SHALL stop its interval requests and its per-second timers, SHALL hold the events it is told of, and SHALL NOT draw them. On return to the tab it SHALL fetch what it missed and the app's status once, draw the newest state, and resume. This SHALL NOT change a Pause the user chose: a paused page stays paused.

#### Scenario: Tab hidden for a minute
- **WHEN** the user switches to another tab for a minute while a session runs, and comes back
- **THEN** the page fetches what it missed at once, shows the session's current state, and the running timers show the real elapsed time

#### Scenario: Paused page in a hidden tab
- **WHEN** the user paused the page, hides the tab and returns
- **THEN** the page is still paused, and resuming shows the newest events
