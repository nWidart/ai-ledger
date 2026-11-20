## MODIFIED Requirements

### Requirement: Show active sessions in a rail
The Live page SHALL list the active sessions in a rail, grouped by state in this order: *approval?*, *your turn*, *working* (running a tool or thinking), *idle*, *ended*. A group with no session SHALL NOT be drawn. Inside a group, sessions SHALL be ordered by session start, oldest first, not by last write, so an entry moves only when its state changes.

#### Scenario: No active session
- **WHEN** no session wrote a line in the last 10 minutes
- **THEN** the page says no session is active and shows when the newest session last wrote, with a link that opens its session sheet over Live

#### Scenario: Groups by state
- **WHEN** five sessions are active: one ended, one idle, one thinking, one in your turn and one likely waiting for approval
- **THEN** the rail lists them from the top in this order: approval?, your turn, working, idle, ended, each under its own heading

#### Scenario: Order does not follow writes
- **WHEN** two sessions are running, A started at 09:00 and B at 09:30, and A writes a line
- **THEN** A stays above B

#### Scenario: Session changes state
- **WHEN** a session in the working group finishes its turn
- **THEN** its entry moves to the your turn group, and no other entry changes place

#### Scenario: New session joins
- **WHEN** a third session starts while two are running
- **THEN** it joins the end of its group and the two entries above it do not move

#### Scenario: Focused session changes state
- **WHEN** the keyboard focus is on a session's entry in the rail, or on its tile on the wall, and the session moves to another group
- **THEN** the focus is on that session's entry or tile in its new group

### Requirement: Link the stream to the session sheet
The stream head SHALL link to the session's sheet, which opens over Live. When older events are left out, the stream SHALL say so and link to the session's sheet. The stream, the rail and the live connection SHALL stay open under the sheet. The sheet SHALL be named in the URL under `sheet`; closing it SHALL go back over the sheet alone, keeping the session the stream follows.

#### Scenario: Link to the session sheet
- **WHEN** the user selects the session sheet link in the stream head
- **THEN** the session's sheet opens over Live, and the stream keeps updating under it

#### Scenario: Close after picking sessions
- **WHEN** the user picks session `s2` in the rail, opens its session sheet and closes it
- **THEN** the stream still follows `s2`
