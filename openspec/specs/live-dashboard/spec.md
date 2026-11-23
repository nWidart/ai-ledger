# live-dashboard Specification

## Purpose

The Live page: watch running sessions as they happen from the agent's side, one session in detail or all of them at a glance, with transcript text shown only when the user asks for it.

## Requirements

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

### Requirement: Count the sessions in the rail's footer
The rail's footer SHALL say how many sessions are working, those of the *working* group, and how many wait for the user: those the tab title counts, likely waiting for approval or in your turn. Idle and ended sessions SHALL count as neither.

#### Scenario: Count of working sessions
- **WHEN** three sessions are active: one running a tool, two waiting for a prompt
- **THEN** the rail's footer says 1 session working and 2 waiting for you

#### Scenario: Session likely waiting for approval
- **WHEN** one session is likely waiting for approval, one is in your turn and one is thinking
- **THEN** the rail's footer says 1 session working and 2 waiting for you, and the tab title starts with (2)

### Requirement: Show each session in its rail entry
Each rail entry SHALL take two lines, and every entry SHALL have the same height. Its first line SHALL show the session's title, cut with an ellipsis when it does not fit, and, at its end when above zero, the error count with a ✕, such as `✕2`. An entry with no title SHALL show the project as its first line.

#### Scenario: Two sessions in one project
- **WHEN** two `ai-ledger` sessions are active with the AI titles "Add session titles" and "Fix Cost test"
- **THEN** their rail entries show those titles as their first lines, and `ai-ledger` on their second lines

#### Scenario: Prompt title under Full text
- **WHEN** an active session has no agent title and Full text is off
- **THEN** its entry shows the project as its first line, and when Full text is turned on it shows the title made from its first prompt

#### Scenario: Entry with failures
- **WHEN** a session at 62% of its window has two failed calls
- **THEN** its first line ends with `✕2`, read as "2 errors", and its second line ends with "62%"

### Requirement: Show state, project and context on a rail entry's second line
An entry's second line SHALL show the state, then the project with its color when the entry has a title, and, at its end, the context percent when the window is known, in the warning color above the near-full mark. The project SHALL shrink first, cut with an ellipsis; the state SHALL be cut with an ellipsis only once the project has shrunk to nothing. An inferred state SHALL NOT show "(inferred)" in the entry.

#### Scenario: Untitled entry
- **WHEN** an active session on branch `main` has no title
- **THEN** its entry shows the project as its first line, its second line shows the state and no project, and `main` shows nowhere in the entry

#### Scenario: Long title and long project
- **WHEN** a session titled with 72 characters in a project of 30 characters is running a `mcp__t3-code__delegate_task` call, in a 1440x900 window
- **THEN** the title and the project are cut with an ellipsis, the state shows whole while any of the project remains, and the entry has the height of every other entry

#### Scenario: Unknown window
- **WHEN** the session's context window is not known
- **THEN** its second line shows no percent

### Requirement: Show how long a session has been in its state in the rail
An entry in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and an entry running a tool SHALL show the tool's name and how long it has run, such as `Bash 12s`.

#### Scenario: How long on your turn
- **WHEN** a session has been in your turn for 4 minutes
- **THEN** its entry shows 4m 00s beside the state, and the figure counts up

#### Scenario: How long idle
- **WHEN** a session has been idle for 7 minutes
- **THEN** its entry shows `idle 7m 00s`

#### Scenario: A running tool
- **WHEN** a session has run a `Bash` call for 12 seconds
- **THEN** its entry shows `Bash 12s` as the state

### Requirement: Keep the rail entry lean
An entry SHALL NOT show the cost, the source, the branch, the latest action or a meter. At 1440x900 the rail SHALL hold 8 sessions without scrolling.

#### Scenario: Eight sessions
- **WHEN** 8 sessions in five groups are active in a 1440x900 window
- **THEN** the rail shows all 8 without scrolling

### Requirement: Name a rail entry for assistive technology
The entry's accessible name SHALL carry what it shows: the title or project, the state with its detail, the project, the context percent and the errors in words, such as "2 errors". For an inferred state, the name SHALL say it is inferred.

#### Scenario: Inferred state in the name
- **WHEN** an active session's state is inferred
- **THEN** its entry shows no "(inferred)", and its accessible name says the state is inferred

### Requirement: Open a session from the rail
Selecting a rail entry SHALL open that session in the stream. With no session selected, the page SHALL open the newest active session, the one that wrote last.

#### Scenario: Open Live with two running sessions
- **WHEN** the user opens `/live` while sessions in `ai-ledger` and `jobdesk` are active, and `ai-ledger` wrote last
- **THEN** the rail lists both, and the stream shows `ai-ledger`

#### Scenario: Filter leaves the open session out
- **WHEN** no session is named in the URL and the user picks a project whose sessions do not include the one in the stream
- **THEN** the stream opens the newest session of that project

### Requirement: Show a session's stream
The stream SHALL show the selected session's events in order. Each tool call SHALL be a row with its tool, row text, duration and result. A running call SHALL show a timer that counts up each second. A failed call SHALL be marked as failed. Compactions SHALL be marked between events. The time of an event SHALL include its date when the event is not from today. A time SHALL stay on one line, and the time column SHALL be wide enough for it.

#### Scenario: Tool call starts and ends
- **WHEN** a `Bash` call starts in the followed session and ends 8 seconds later
- **THEN** its row appears within 3 seconds of its transcript line being written, with a running timer, and when the result arrives it shows 8s and passed

#### Scenario: Failed tool call
- **WHEN** a tool call fails
- **THEN** its row is marked as failed, and the status strip's error count goes up by one

#### Scenario: Event from another day
- **WHEN** the user views an idle session whose last event was yesterday at 14:03:12
- **THEN** the times in the stream show yesterday's date with the time, and events from today show the time alone

### Requirement: Name a shell call by its description
The row text of a shell call that carries a description SHALL be that description; otherwise it SHALL be the input summary.

#### Scenario: Shell call with a description
- **WHEN** a `Bash` call runs `cd /long/path && uv run pytest` with the description "Run the Python tests"
- **THEN** its row text is "Run the Python tests"

#### Scenario: Shell call with no description
- **WHEN** a `Bash` call carries no description
- **THEN** its row text is its command

### Requirement: Link the stream to the session sheet
The stream head and each pinned stream's head SHALL link to the session's sheet, which opens over Live. When older events are left out, the stream SHALL say so and link to the session's sheet. The streams, the rail and the live connection SHALL stay open under the sheet. The sheet SHALL be named in the URL under `sheet`; closing it SHALL go back over the sheet alone, keeping the session the stream follows.

#### Scenario: Link to the session sheet
- **WHEN** the user selects the session sheet link in the stream head
- **THEN** the session's sheet opens over Live, and the stream keeps updating under it

#### Scenario: Link from a pinned stream
- **WHEN** the user selects the session sheet link in a pinned stream's head
- **THEN** the session's sheet opens over the Wall, and the pinned streams keep updating under it

#### Scenario: Close after picking sessions
- **WHEN** the user picks session `s2` in the rail, opens its session sheet and closes it
- **THEN** the stream still follows `s2`

### Requirement: Open a tool call's detail
Selecting a tool row SHALL open its detail in place: the input summary, the start time, the error when it failed, and the result. For a shell call that carries a description, the detail SHALL show the description and the command. With Full text off, the result SHALL show only its size.

#### Scenario: Open a failed call
- **WHEN** the user selects a failed `Bash` row with Full text off
- **THEN** the detail shows the command, the start time and the error, and the result as a character count

#### Scenario: Open a call with a description
- **WHEN** the user selects a `Bash` row whose row text is its description
- **THEN** the detail shows the description and, apart from it, the command

### Requirement: Fold subagent lanes
Subagent work SHALL appear as a lane inside the stream. Selecting the lane header SHALL fold or unfold the lane. A finished lane SHALL be folded by default. A running lane with more than 5 rows SHALL show its last 5 and a control to show all of them, and to go back to the last 5. A fold or an expansion the user chose SHALL be kept while the page is open. Updates SHALL keep every lane with all the rows the page holds for it.

#### Scenario: Fold a lane
- **WHEN** the user selects the header of an Explore lane with three tool calls
- **THEN** the three rows are hidden and the header still shows three tool calls

#### Scenario: Update brings another lane's work
- **WHEN** a session has three lanes and an update brings new calls of one of them only
- **THEN** all three lanes stay, each with its rows and its count

#### Scenario: Finished lane
- **WHEN** the user opens a session with a finished Explore lane of twelve calls
- **THEN** the lane is folded, and its header shows twelve tool calls, its cost, its model and its duration

#### Scenario: Running lane
- **WHEN** a running lane holds twelve tool rows
- **THEN** the stream shows its last 5, and a control that says it shows all 12

#### Scenario: Show all rows
- **WHEN** the user selects the control of a running lane
- **THEN** all twelve rows show, and the control offers the last 5 again

#### Scenario: Lane the user opened finishes
- **WHEN** the user unfolds a running lane and the lane then finishes
- **THEN** the lane stays unfolded

### Requirement: Tell when a lane is finished
A lane whose own events hold a turn start or end, as a Codex lane, SHALL be finished when its newest turn has ended, and running while that turn goes on: a Codex spawn call returns at once. Any other lane SHALL be finished when the call that started it has ended. A finished lane's duration SHALL stop at its last event.

#### Scenario: Codex lane whose turn ended
- **WHEN** a Codex subagent thread made twelve tool calls and its turn has completed
- **THEN** its lane is folded and marked done, and its duration is the time from its first event to its last

#### Scenario: Codex lane in a turn
- **WHEN** a Codex subagent thread ended a turn and started another that has not completed
- **THEN** its lane is unfolded and marked running, shows its last 5 rows, and its duration counts up

#### Scenario: Lane with a call still running
- **WHEN** the `Agent` call that started a Claude Code lane has no result yet
- **THEN** the lane is running

### Requirement: Show a lane's figures in its header
The lane header SHALL show the subagent's name, its description, its tool-call count, its duration, its cost and its model when the app gives them, its error count when above zero, and whether it is still running.

#### Scenario: Lane header figures
- **WHEN** a lane made 8 tool calls, 2 of them failed, on `claude-haiku-5-5` for $0.05
- **THEN** its header shows 8 tools, 2 errors, `claude-haiku-5-5` and $0.05

#### Scenario: Lane with no cost
- **WHEN** the app gives no cost and no model for a lane
- **THEN** its header shows neither, and still shows its tool count and duration

### Requirement: Toggle full text
The page SHALL offer a Full text toggle that is off on every page load. With it off, prompts and replies SHALL show as word counts, tool results as sizes, tool inputs cut to 300 characters and subagent calls by their description. With it on, they SHALL show as written. Turning it on SHALL keep open rows, folded lanes and the scroll position.

#### Scenario: Turn on full text
- **WHEN** the user turns on Full text
- **THEN** the stream shows prompts, replies and tool results as written, the warning appears, the stream does not move, and a row the user had open stays open

#### Scenario: Reload
- **WHEN** the user reloads the page after turning Full text on
- **THEN** Full text is off

### Requirement: Keep Full text to the Stream view
The Full text toggle and its warning SHALL show only in the Stream view. On the Wall and in the Tree, the page's requests SHALL NOT ask for full text, whatever the toggle says, and the toggle SHALL keep its setting for the return to the Stream view.

#### Scenario: Wall view
- **WHEN** the user turns on Full text in the Stream view and opens the Wall
- **THEN** the Wall shows no Full text toggle and no warning, its requests ask for no full text, and back in the Stream view Full text is on

#### Scenario: Tree view
- **WHEN** the user turns on Full text in the Stream view and opens the Tree, where a session has only a title made from its first prompt
- **THEN** the Tree shows no Full text toggle and no warning, its requests ask for no full text, and that session's node shows its project in place of a title

### Requirement: Warn that full text can show secrets
With Full text on, a dismissible warning SHALL say that secrets can appear, without moving the page, and the toggle SHALL keep a warning tint. The warning SHALL close by itself 6 seconds after it shows, SHALL NOT count that time while the pointer is over it or the focus is inside it, and SHALL move no focus when it closes by itself.

#### Scenario: Dismiss the warning
- **WHEN** the user dismisses the warning
- **THEN** it goes, nothing moves, Full text stays on with its tint, and the focus is on the Full text toggle

#### Scenario: Warning closes by itself
- **WHEN** the user turns on Full text and waits 7 seconds with the pointer and the focus elsewhere
- **THEN** the warning is gone, Full text stays on with its tint, and the focus has not moved

#### Scenario: Warning under the pointer
- **WHEN** the user turns on Full text and rests the pointer on the warning for 10 seconds
- **THEN** the warning stays, and it closes no more than 6 seconds after the pointer leaves

#### Scenario: Warning with the focus
- **WHEN** the focus moves into the warning before it closes
- **THEN** the warning stays while the focus is inside it

### Requirement: Follow the newest event
With Follow on, the stream SHALL keep the newest event in view, wherever it falls in the stream, including inside a lane in the middle of it. A size change of the stream or its rows SHALL keep Follow on and put the newest event back in view.

#### Scenario: Newest event in a lane
- **WHEN** Follow is on, a running lane stands in the middle of the stream with a main-thread event after it, and the lane gets a new tool call
- **THEN** the stream scrolls to that call, and Follow stays on

#### Scenario: Stream changes size
- **WHEN** Follow is on and the window is resized, or a web font loads and the rows wrap anew
- **THEN** Follow stays on, and the newest event is in view

#### Scenario: Newest event taller than the stream
- **WHEN** Follow is on and the newest event, in the middle of the stream, is opened and taller than the stream's box
- **THEN** the stream shows that event from its top, and stays there

### Requirement: Turn Follow off by scrolling away
Scrolling up or opening a tool row SHALL turn Follow off. The page's own scrolling SHALL NOT. While Follow is off and new events arrive, the page SHALL offer Jump to latest, which turns Follow back on.

#### Scenario: Read back while the session runs
- **WHEN** the user scrolls up while new tool calls arrive
- **THEN** the stream stays where the user scrolled, and Jump to latest appears

### Requirement: Turn Follow back on at the bottom
While Follow is off, a scroll by the user that brings the stream within 2 pixels of its bottom SHALL turn Follow back on, as Jump to latest does; a resize or new content that leaves the stream at its bottom SHALL NOT. Turning Follow off with its checkbox while the stream is at its bottom SHALL keep it off until a later scroll by the user reaches the bottom.

#### Scenario: Scroll back to the bottom
- **WHEN** Follow is off after the user scrolled up, new events arrived, and the user scrolls down to the bottom of the stream
- **THEN** Follow is on, Jump to latest goes, and the new-events status is empty

#### Scenario: Follow cleared at the bottom
- **WHEN** the stream is at its bottom and the user clears the Follow checkbox
- **THEN** Follow stays off, and turns on again only when the user scrolls up and back down to the bottom

#### Scenario: Content reaches the bottom
- **WHEN** Follow is off and the stream lands at its bottom because the window grew or rows were hidden
- **THEN** Follow stays off

### Requirement: Pause updates
The page SHALL offer Pause, which holds new events and states until Resume. While paused, the page SHALL say so, and SHALL NOT show the live indicator: the connection line has no green dot and the state dots do not pulse.

#### Scenario: Pause and resume
- **WHEN** the user pauses, three tool calls arrive, and the user resumes
- **THEN** nothing changes while paused, and the three calls appear on resume

#### Scenario: Paused page
- **WHEN** the user pauses while a session is running a tool
- **THEN** the connection line says Paused with no green dot, the session's state dot does not pulse, and both are back when the user resumes

### Requirement: Show all sessions on a wall
The page SHALL offer a Wall view with one tile per active session, grouped by state in the rail's order, with the same headings. Each group SHALL be a list under an `h2` heading, with one list item per tile. Inside a group, tiles SHALL be ordered by session start, oldest first. Selecting a tile SHALL pin its stream on the Wall; a pinned stream's Open in Stream SHALL open that session in the stream view.

#### Scenario: Pick a session from the wall
- **WHEN** the user selects Open in Stream on the pinned `graft` stream
- **THEN** the stream view opens on `graft`

#### Scenario: Wall groups
- **WHEN** one session is likely waiting for approval and two are running
- **THEN** the wall shows the approval tile under its heading, then the two running tiles under theirs

#### Scenario: Wall structure
- **WHEN** a screen reader user lists the wall's headings and lists
- **THEN** each group's heading is an `h2` followed by a list of its tiles, and the list says how many tiles it holds

#### Scenario: Empty wall
- **WHEN** no session is active, nothing is pinned, and the URL still names a session from the Stream view
- **THEN** the Wall says no session is active

### Requirement: Show each session on its wall tile
A wall tile SHALL show, in this order: the state, with the error count with a ✕ when above zero and a pinned mark when pinned; the title; the project when the session has a title, and the model without its `claude-` prefix; the context meter with its percent. A tile SHALL NOT show the latest action, the tool count, the cost, the branch or the source. Tiles in one row SHALL have one height.

#### Scenario: Tiles of one row
- **WHEN** a row holds a tile with a 30-character title and one with an 80-character title, in a 1440x900 window
- **THEN** both tiles have the same height

#### Scenario: Codex model
- **WHEN** a Codex session runs on `gpt-6.2-sol` with no known cost
- **THEN** its tile shows `gpt-6.2-sol`, and no cost

### Requirement: Name a wall tile for assistive technology
The tile SHALL be a toggle whose pressed state says whether it is pinned. Its accessible name SHALL come from its content: "Pin" and the session's name, then all the tile shows, in words, current after each update. In the name, the error count SHALL agree in number with its noun: "1 error", "2 errors".

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile shows `✕1`, and its name reads "1 error"

#### Scenario: A screen reader on a tile
- **WHEN** a screen reader reaches the tile of a session titled "Fix login" in project foo on `claude-opus-5-5`
- **THEN** it reads "Pin Fix login", then the state, the errors, the project, `opus-5-5` and the context, and not pressed, and it reads no latest action, tools, cost, branch or source

#### Scenario: A tile that updates
- **WHEN** the tile's state or figures change while a screen reader is on it
- **THEN** the tile's name says the new state and figures

### Requirement: Show state time and title on a wall tile
A tile in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and one running a tool its name and run time. A tile in *your turn* SHALL have a border. The title SHALL take at most two lines, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL show the project in the title's place, and SHALL leave the project out of the line under it.

#### Scenario: Long title on a tile
- **WHEN** a session's title is longer than two lines of its tile
- **THEN** the tile shows the title on two lines, cut with an ellipsis, and hovering it shows the full title

#### Scenario: Untitled tile
- **WHEN** a session in project `foo` has no title
- **THEN** its tile shows `foo` in the title's place, and the line under it shows the model alone

#### Scenario: Your turn tile
- **WHEN** a session is in your turn
- **THEN** its tile has a border and shows how long the session has waited

### Requirement: Keep the selection in the URL
The page SHALL keep the selected session, the view (Stream, Wall or Tree), the Tree's layout and the Wall's pins, oldest first, in the URL, with the shared project, source and automated filters. Pinning, unpinning and switching the Tree's layout SHALL replace the history entry, not add one. Of the pins the URL names, the page SHALL keep the well-formed ids, each once at its first place, and of more than two the last two.

#### Scenario: Reload on a session
- **WHEN** the user reloads `/live` while following session A
- **THEN** the page opens on session A in the same view

#### Scenario: Reload with pins
- **WHEN** the user reloads `/live?view=wall&pin=a,b`
- **THEN** the Wall shows with a and b pinned, a the oldest

#### Scenario: More pins than two
- **WHEN** the user opens `/live?view=wall&pin=a,b,a,c,bad%20id`
- **THEN** the Wall pins b and c, b the oldest

#### Scenario: Reload on the Org chart
- **WHEN** the user reloads `/live?view=tree&layout=org`
- **THEN** the Tree shows with the Org chart

#### Scenario: Layout outside the Tree
- **WHEN** the user opens `/live?layout=org` or `/live?view=tree&layout=cards`
- **THEN** the first shows the Stream view and the second the Tree's Outline, and the page drops the `layout` key from the URL it writes next

#### Scenario: Session that fails to load
- **WHEN** the selected session answers with an HTTP error and the page holds nothing of it
- **THEN** the stream's panel says it could not load the session, once, with no loading message

#### Scenario: Selected session no longer active
- **WHEN** the URL names a session that is no longer active
- **THEN** the stream still shows that session's newest events, marked idle

#### Scenario: Unknown session
- **WHEN** the URL names a session the store does not hold
- **THEN** the stream says the session was not found and offers a link back to the active sessions

### Requirement: Recover from a dropped connection
When the update connection drops, the page SHALL say "Connection lost · reconnecting…" and SHALL reconnect on its own. When the app answers the connection with an HTTP error, which ends the connection for good, the page SHALL say the same and SHALL open a new connection after a delay that grows with each failure up to 30 seconds and starts over after a success. After reconnecting it SHALL fetch what it missed and the app's status, for the navigation.

#### Scenario: App restarted
- **WHEN** the app restarts while the Live page is open
- **THEN** the page says "Connection lost · reconnecting…", then catches up without a reload, and the navigation shows the time of the last ingest again

#### Scenario: HTTP error from the events stream
- **WHEN** the events stream answers with an HTTP 503 and the browser closes it
- **THEN** the page shows reconnecting, retries after 1 second, then 2, then 4, and when a retry succeeds it shows Updating live and fetches what it missed

### Requirement: Title the stream
The stream SHALL show the selected session's title as a heading above its project, branch, source and model. With no title, the heading SHALL be the project.

#### Scenario: Session with a custom title
- **WHEN** the followed session was renamed "release notes" with `/rename`
- **THEN** the stream's heading is "release notes", with the project and branch below it

#### Scenario: Session with no title
- **WHEN** the followed session is a Codex session with no title, in project `foo`
- **THEN** the stream's heading is "foo", followed by its branch, source and model

### Requirement: Filter the stream
The stream SHALL offer filters, in a bar above it, that change what it draws and nothing it holds. A Main thread only toggle SHALL hide every lane.

#### Scenario: Main thread only
- **WHEN** the user turns on Main thread only with two lanes in the stream
- **THEN** no lane shows, and the main-thread rows do

#### Scenario: Filters do not change figures
- **WHEN** the user turns on any filter
- **THEN** the strip's figures and the lane headers' tool counts do not change

### Requirement: Filter the stream to failed calls
A Failed calls only toggle SHALL filter the stream to failed tool rows. While the session has failed calls, its label SHALL give the session's total, such as "Failed calls only (2)", which can exceed the failed rows the loaded events hold. When none of the loaded events failed, the filtered stream SHALL say no failed calls are in the events held. It SHALL be the page's only control that filters to failed rows: the status strip's error count SHALL NOT be a control.

#### Scenario: Filter to failed rows
- **WHEN** the user turns on Failed calls only while the stream holds two failed rows among forty
- **THEN** the stream shows the two failed rows, and turning it off shows all rows

#### Scenario: Failed calls count
- **WHEN** the session has two failed calls
- **THEN** the toggle reads "Failed calls only (2)", and with no failed call it reads "Failed calls only"; if the session has five failed calls and the loaded events hold two, it reads "(5)" and the filtered stream shows two rows; if they hold none, it says no failed calls are in the events held

#### Scenario: Errors count pressed
- **WHEN** the session has two failed calls
- **THEN** the strip shows the error count as text in the error color, and selecting it does nothing

### Requirement: Hide read-only rows
A Hide read-only toggle SHALL hide the rows the app marks read-only: `Read`, `Grep`, `Glob`, and shell calls whose every command only reads or searches. It SHALL NOT hide a failed row.

#### Scenario: Hide read-only rows
- **WHEN** the user turns on Hide read-only with `Read`, `Grep`, `Glob` and `Edit` rows in the stream
- **THEN** only the `Edit` row shows among them

#### Scenario: Hide read-only shell rows
- **WHEN** the user turns on Hide read-only with a shell row that runs `rg TODO src` and one that runs `git commit`
- **THEN** only the `git commit` row shows among them

#### Scenario: Failed read-only row
- **WHEN** the user turns on Hide read-only, with Failed calls only or without it, and a `Read` row failed
- **THEN** the failed `Read` row shows

### Requirement: Combine stream filters
The stream filters SHALL combine, SHALL be off on every page load, and SHALL stay on when the user opens another session. A lane with no matching row SHALL be hidden; a lane with matching rows SHALL keep its header, with the matching rows under it when it is open. Failed calls only SHALL open a finished lane that holds a failed row; a lane the user folded SHALL stay folded. The stream SHALL say how many rows the filters hide.

#### Scenario: Filters combine
- **WHEN** the user turns on Failed calls only and Main thread only, and the only failed row is inside a lane
- **THEN** the stream shows no row, and says that the filters hide every row

#### Scenario: Failed row in a lane
- **WHEN** the user turns on Failed calls only and a finished lane, folded as any finished lane, holds one failed row among six
- **THEN** the lane opens, and shows its header and that one row

#### Scenario: Lane the user folded
- **WHEN** the user folds a lane that holds a failed row, with Failed calls only on
- **THEN** the lane shows its header and no row

#### Scenario: Another session
- **WHEN** the user turns on Main thread only and opens another session
- **THEN** Main thread only is still on

#### Scenario: Reload
- **WHEN** the user reloads the page after turning a filter on
- **THEN** every filter is off

### Requirement: Show who needs you in the tab title
The browser tab title SHALL carry the number of listed sessions that need the user, those likely waiting for approval and those in your turn, while that number is above zero. With none, the title SHALL be the page's usual title. Leaving the Live page SHALL restore the title of the page the user goes to.

#### Scenario: Two sessions need the user
- **WHEN** one session is likely waiting for approval and one is in your turn
- **THEN** the tab title starts with (2)

#### Scenario: Nobody needs the user
- **WHEN** every active session is running or idle
- **THEN** the tab title has no count

#### Scenario: Leave Live
- **WHEN** the tab title shows (1) and the user opens Cost
- **THEN** the title is Cost's, with no count

### Requirement: Fit the stream page to the window
At 721 pixels wide and up, the Live page's Stream view SHALL fit the window's height, so the page does not scroll: the rail and the stream SHALL stay within it and scroll inside themselves, and the stream SHALL take the width the rail leaves. From 1100 pixels wide, the Wall view with a pinned stream SHALL fit the same way, the tiles and each stream scrolling inside themselves. Otherwise the page scrolls as any other.

#### Scenario: Titled session in a short window
- **WHEN** the user opens a session with a title in a window 720 pixels high
- **THEN** the page does not scroll, and the rail and the stream each end above the bottom of the window

#### Scenario: Stream width
- **WHEN** the user opens a session in a 1440x900 window
- **THEN** the stream is wider than the 798 pixels it had beside the agent panel

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

### Requirement: Pause the page's requests while the tab is hidden
While the tab is hidden, the Live page SHALL stop its interval requests and its per-second timers, SHALL hold the events it is told of, and SHALL NOT draw them. On return to the tab it SHALL fetch what it missed and the app's status once, draw the newest state, and resume. This SHALL NOT change a Pause the user chose: a paused page stays paused.

#### Scenario: Tab hidden for a minute
- **WHEN** the user switches to another tab for a minute while a session runs, and comes back
- **THEN** the page fetches what it missed at once, shows the session's current state, and the running timers show the real elapsed time

#### Scenario: Paused page in a hidden tab
- **WHEN** the user paused the page, hides the tab and returns
- **THEN** the page is still paused, and resuming shows the newest events

### Requirement: Show the session's status strip
Above the stream, under its head, the page SHALL show a strip about the selected session's conversation only, in two rows. The first row SHALL show the state and its detail, then the cost, the tool calls, the errors as a number in the error color when above zero, and the cache-read share with a toggletip. The strip SHALL NOT show plan limits, the working directory or Copy resume.

#### Scenario: Plan limit near full
- **WHEN** the session's source has a 5-hour limit at 86% and the session's working directory is known
- **THEN** the strip shows no plan limit, no directory and no Copy resume

### Requirement: Say when the strip's state is inferred
An inferred state in the status strip SHALL say it is inferred, with the reason behind a toggletip.

#### Scenario: Likely waiting for approval
- **WHEN** the selected session's state is likely waiting for approval
- **THEN** the strip shows the state in the warning color with "(inferred)", and that toggletip gives the reason

### Requirement: Show context and pulse in the strip's second row
The strip's second row SHALL hold two columns of equal width: Context, a readout of the context over its window, its percent and, when above zero, its compactions, above a meter as wide as the column with a mark at each compaction; and Last 10 min, the pulse as wide as its column. Below 721 pixels wide, and in a pinned stream on the Wall, the two columns SHALL stack.

#### Scenario: Context near full
- **WHEN** the session uses more than 80% of its context window: the window the session states (Codex), else its model's window in the price table
- **THEN** the strip's context meter shows the warning color

#### Scenario: Context readout
- **WHEN** the session uses 119,500 tokens of a 1,000,000-token window and has compacted twice
- **THEN** the Context column reads "119.5k / 1.0M · 12% · 2 compactions" above its meter, and with no compaction it reads "119.5k / 1.0M · 12%"

#### Scenario: Unknown window
- **WHEN** the model's context window is not known
- **THEN** the strip shows the context in tokens and says the window is not known, with no meter

#### Scenario: Pulse width
- **WHEN** the user opens a session in a 1440x900 or a 1280x800 window
- **THEN** the pulse is at least 200 pixels wide and fills its column

#### Scenario: Strip on a phone
- **WHEN** the user opens a session on a 390x844 screen
- **THEN** the Context column shows above the Last 10 min column, and the page has no sideways scroll

### Requirement: Show the session's pulse
The strip SHALL show a pulse of the last 10 minutes: the context of each main-thread request as a line, and a tick for each finished tool call, an upright mark for a success and a ✕ for a failure. The two marks SHALL differ in shape. The pulse's line and marks SHALL keep 3:1 against the surface, and SHALL show under forced colors. Its name SHALL say the lowest and highest context it plots, the calls and the failures.

#### Scenario: Pulse of a busy session
- **WHEN** a session's context went from 40,000 to 62,000 tokens over its last 10 minutes, with 18 calls of which 2 failed
- **THEN** the pulse's line rises, it has 16 upright marks and 2 ✕ marks, and its name says 40k to 62k tokens, 18 tool calls, 2 failed

#### Scenario: Cache rereads
- **WHEN** a session's requests reread a large cached context without adding to it
- **THEN** the pulse's line stays flat, and its name gives the one context

#### Scenario: Context that fell back
- **WHEN** a session's context went from 40,000 to 62,000 tokens and back to 40,000
- **THEN** the pulse's name says 40k to 62k tokens

### Requirement: Read the pulse by keyboard
The pulse SHALL be a focusable group read one minute at a time: Left and Right SHALL move between minutes, Home and End SHALL go to the first and the last, and Escape SHALL dismiss the readout. The readout SHALL give the minute, the context at its end, its calls and its failures, in a polite live region.

#### Scenario: Read a minute
- **WHEN** the user focuses the pulse and presses End, in a minute with 3 calls of which 1 failed and a context of 52,000 tokens
- **THEN** the readout gives that minute, "context 52k", "3 calls" and "1 failed"

### Requirement: Pin streams on the wall
Selecting a wall tile SHALL pin that session's stream beside the tiles, and selecting it again SHALL unpin it; the tile SHALL say whether it is pinned. A pinned stream SHALL show its head with a Session sheet link, Open in Stream and Unpin, a strip and the stream, with its own filters and Follow. Unpin SHALL move the focus to the session's tile; with none, to the other pin's first button, else the first tile, else the page's heading. Open in Stream SHALL move it to the stream's heading.

#### Scenario: Pin from the wall
- **WHEN** the user selects the `graft` tile
- **THEN** the Wall stays, `graft`'s stream shows beside the tiles, and the tile reads as pinned

#### Scenario: Unpin
- **WHEN** the user selects Unpin on the pinned `graft` stream
- **THEN** the stream goes and the focus is on the `graft` tile

#### Scenario: Unpin a session with no tile
- **WHEN** `notes` and `graft` are pinned, `notes` has left the active list, and the user selects Unpin on `notes`
- **THEN** the focus is on `graft`'s Open in Stream button

#### Scenario: Two pins apart
- **WHEN** the user turns on Main thread only in one pinned stream and opens a row in the other
- **THEN** the other keeps its filters, and only the second stops following

### Requirement: Show a pinned stream's state
A pinned stream SHALL be marked busy while it first loads. A failed update SHALL say so above the stream it keeps. A pin the store does not hold SHALL say in words that the session is not found, and SHALL keep its Unpin button. A pinned session that ends or leaves the active list SHALL stay pinned until the user unpins it.

#### Scenario: Unknown pin
- **WHEN** the URL pins `constructor`, which the store does not hold, and the user turns on Full text
- **THEN** its pin says the session is not found, and Unpin removes it

#### Scenario: Failed update
- **WHEN** a pinned stream's update answers with an HTTP error
- **THEN** the pin keeps its events and says it could not update the session

### Requirement: Keep two pins at most
The wall SHALL hold at most 2 pinned streams. Pinning a third SHALL unpin the oldest, and a polite status SHALL name both sessions.

#### Scenario: Pin a third
- **WHEN** `notes` and `graft` are pinned, in that order, and the user pins `dotfiles`
- **THEN** `graft` and `dotfiles` are pinned, and the status says that `dotfiles` is pinned and `notes` unpinned

### Requirement: Keep one update connection
The page SHALL keep one update connection while it shows: pinning, unpinning, switching between Stream, Wall and Tree, switching the Tree's layout, and opening or closing a sheet SHALL NOT open another. A notice that names a pinned session SHALL refetch it.

#### Scenario: Pin, unpin and a sheet
- **WHEN** the user pins two sessions, unpins one, and opens and closes a session sheet
- **THEN** the page opened one connection, and it is still open

#### Scenario: Sheet over pins
- **WHEN** the user opens a pinned stream's session sheet from its head, and closes it
- **THEN** both pinned streams stay mounted under it, and the page opened no other connection

#### Scenario: Tree and back
- **WHEN** the user opens the Tree, switches to the Org chart, selects a node and goes back
- **THEN** the page opened one connection, and it is still open

### Requirement: Fit the page to a narrow screen
Below 721 pixels wide, the rail SHALL be one row of entries that scrolls sideways inside itself, with its group headings for screen readers, and the page SHALL NOT scroll sideways. The strip's second row SHALL stack its columns, and the pulse's readout SHALL open under the strip and wrap within it. At 390x844 the first event of the stream SHALL be on the first screen.

#### Scenario: Phone with eight sessions
- **WHEN** the user opens a session on a 390x844 screen with 8 active sessions
- **THEN** the page has no sideways scroll, and the stream's first event shows without scrolling

#### Scenario: Pulse readout on a phone
- **WHEN** the user focuses the pulse on a 390x844 screen and presses End
- **THEN** the readout shows within the screen, and the page has no sideways scroll

### Requirement: Render prompts and replies as Markdown
With Full text on, the stream SHALL render the body of each prompt and reply as Markdown, with GFM tables. A code block SHALL scroll sideways inside the body and SHALL NOT widen the stream. Tool output SHALL stay plain text. An update to the stream SHALL NOT parse again a body that did not change.

#### Scenario: Reply with Markdown
- **WHEN** Full text is on and a reply holds a heading, a list, bold text, inline code, a link, a GFM table and a code fence
- **THEN** the stream shows a heading, a list, bold text, code, a link, a table and a code block

#### Scenario: Long code block
- **WHEN** Full text is on and a reply holds a code fence with a 400-character line
- **THEN** the code block scrolls sideways inside the body, and the stream has no sideways scroll

#### Scenario: Tool output
- **WHEN** Full text is on and a tool result holds `# not a heading`
- **THEN** its detail shows `# not a heading` as plain text

#### Scenario: Full text off
- **WHEN** Full text is off
- **THEN** prompts and replies show as word counts, with no Markdown rendered

### Requirement: Keep Markdown bodies safe
Raw HTML in a prompt or reply body SHALL show as text and SHALL NOT become elements. A link SHALL keep its href only when it is `http:`, `https:` or `mailto:`, and SHALL open in a new tab with `rel="noreferrer noopener"`; any other link SHALL show as text. An image SHALL show as a link to its source, so the page makes no image request.

#### Scenario: Raw HTML in a prompt
- **WHEN** Full text is on and a prompt holds `<img src=x onerror=alert(1)>` and `<b>hi</b>`
- **THEN** the stream shows both as text, and the page holds no element made from them

#### Scenario: Unsafe link
- **WHEN** Full text is on and a reply holds `[run](javascript:alert(1))` and `[docs](https://example.com)`
- **THEN** "run" shows as text with no link, and "docs" links to `https://example.com` in a new tab with `rel="noreferrer noopener"`

#### Scenario: Image in a reply
- **WHEN** Full text is on and a reply holds `![chart](https://example.com/c.png)`
- **THEN** the stream shows a link named "chart" to that address, and the page requests no image

### Requirement: Show sessions and their agents as a tree
The page SHALL offer a Tree view, next to Stream and Wall, with one root per active session and that session's agents under it. The roots SHALL be grouped by state in the rail's order, with the same headings, each group under an `h2` heading. Inside a group, sessions SHALL be ordered by session start, oldest first. With no active session, the Tree SHALL say so as the Wall does.

#### Scenario: Open the Tree
- **WHEN** the user selects Tree while a working session with two subagents and a session in your turn with none are active
- **THEN** the Tree shows a your turn group with one session, then a working group with one session and its two subagents under it

#### Scenario: Session changes state
- **WHEN** a session in the working group finishes its turn
- **THEN** it moves, with its agents, to the your turn group, and no other session changes place

#### Scenario: Empty Tree
- **WHEN** no session is active
- **THEN** the Tree says no session is active, and shows when the newest session last wrote

### Requirement: Nest each agent under its parent
An agent SHALL stand under the agent the list names as its parent, and under its session when it has none. Nesting SHALL have no fixed depth. Under one parent, agents SHALL be ordered by start, oldest first, subagents and delegations together. An agent whose parents do not lead to its session SHALL stand under its session.

#### Scenario: Subagent of a subagent
- **WHEN** a session's main thread started subagent A, and A started subagent B
- **THEN** A stands under the session and B under A, one level deeper

#### Scenario: Order under a parent
- **WHEN** a session started a subagent at 10:00, a delegation at 10:02 and a subagent at 10:05, all still running
- **THEN** they stand under the session in that order

#### Scenario: Parent not in the list
- **WHEN** an agent names a parent the list does not hold
- **THEN** it stands under its session

### Requirement: Show a session's figures on its node
A session node SHALL show its state, with its time as the rail shows it, its title, else its project, the project under a title, its tool calls, the time since it started, its cost, its model without its `claude-` prefix, and its error count when above zero. A figure the app does not give SHALL be left out.

#### Scenario: Session node
- **WHEN** a session titled "Add the Tree" in project `ai-ledger`, started 12 minutes ago, has run `Bash` for 12 seconds, with 40 tool calls, 2 failed, $1.20 on `claude-opus-5-5`
- **THEN** its node shows `Bash 12s`, "Add the Tree", `ai-ledger`, 40 tools, 12m 00s, $1.20, `opus-5-5` and `✕2`

#### Scenario: Codex session with no cost
- **WHEN** a Codex session runs on a model with no known price
- **THEN** its node shows its model and no cost

### Requirement: Show a subagent's figures on its node
A subagent node SHALL show whether it is running or done, its name, its description, its tool calls, its duration, its cost and its model when the app gives them, and its error count when above zero. A running subagent's duration SHALL count up each second; a done one's SHALL stop at its last call or request.

#### Scenario: Running subagent
- **WHEN** a subagent named `Agent`, described "Map the parsers", started 90 seconds ago and made 8 tool calls, 2 failed, on `claude-haiku-5-5` for $0.05
- **THEN** its node shows running, `Agent`, "Map the parsers", 8 tools, `✕2`, 1m 30s counting up, $0.05 and `haiku-5-5`

#### Scenario: Subagent with no cost
- **WHEN** the app gives no cost and no model for a subagent
- **THEN** its node shows neither, and still shows its tool calls and duration

### Requirement: Show a delegation call as a node
A delegation SHALL be a node of its own kind, marked as a delegated task, with its description, its target provider and model when the app gives them, when it started, and its status in words: "sending" for `pending`, "started" for `started`, "done" and "failed". It SHALL show no tool calls, cost or errors. It SHALL have no link to another session.

#### Scenario: Started delegation
- **WHEN** a session delegated "Write the tests" to `gpt-6.1-sol` 20 minutes ago and the call returned
- **THEN** its node shows a delegated task, "Write the tests", `gpt-6.1-sol` and "started", with no tool calls and no cost

#### Scenario: Why started says no more
- **WHEN** the user reads a delegation node that says "started"
- **THEN** its hover text and its accessible name say that the transcript does not tell when the delegated task ends

#### Scenario: No target
- **WHEN** a delegation call names no provider and no model
- **THEN** its node shows its description and its status alone

### Requirement: Fold finished agents
Under each parent, the agents that are over SHALL be folded into one row placed after the others, which says how many it holds, such as "4 finished subagents". A subagent is over when it is done and no agent under it shows. A delegation is over when it is done or failed, or when its call returned more than 10 minutes ago. Selecting the row SHALL show them, and selecting it again SHALL fold them.

#### Scenario: Four finished, two running
- **WHEN** a session has four done subagents and two running ones
- **THEN** the two running nodes show, then a row that reads "4 finished subagents"

#### Scenario: Unfold
- **WHEN** the user selects the row "4 finished subagents"
- **THEN** the four nodes show under it, each marked done

#### Scenario: Finished parent of a running subagent
- **WHEN** subagent A is done and subagent B, under A, is running
- **THEN** A shows, with B under it

#### Scenario: Old delegation
- **WHEN** a parent has one done subagent and one delegation that returned 30 minutes ago with the status `running`
- **THEN** the fold row reads "1 finished subagent, 1 earlier delegation", and the delegation, when shown, still says "started"

#### Scenario: Nothing over
- **WHEN** every agent of a parent is running
- **THEN** the parent has no fold row

### Requirement: Keep the folds the user chose
A fold row the user opened SHALL stay open, and a node the user collapsed SHALL stay collapsed, while the page is open, in both layouts and across updates. On every page load the fold rows SHALL be folded and every other node open.

#### Scenario: Subagent finishes under an open fold
- **WHEN** the user opened a session's fold row and a running subagent of that session finishes
- **THEN** the subagent moves into the open fold and still shows

#### Scenario: Switch layout
- **WHEN** the user opens a fold row in the Outline and switches to the Org chart
- **THEN** that fold is open in the Org chart

#### Scenario: Reload
- **WHEN** the user reloads the page after opening a fold row
- **THEN** the fold row is folded

### Requirement: Offer two layouts of the Tree
The Tree SHALL offer a toggle between two layouts of the same nodes, folds and order: Outline, which is the default, and Org chart. The toggle SHALL say which is on. Switching SHALL move no focus away from the toggle.

#### Scenario: Switch to the Org chart
- **WHEN** the user selects Org chart in the Tree
- **THEN** the same sessions and agents show as cards, the toggle reads Org chart as pressed, and the focus is on the toggle

#### Scenario: Default layout
- **WHEN** the user opens `/live?view=tree`
- **THEN** the Tree shows the Outline

### Requirement: Draw the Outline as an indented tree
The Outline SHALL draw each node as one row, indented one step per level under its parent up to a bound (8 steps, 6 below 721 pixels wide), so a deep row keeps room for its name, with a control that collapses and expands a node that has children. A row SHALL show its figures in columns that line up across rows. A description SHALL be cut with an ellipsis when it does not fit, with the full description on hover.

#### Scenario: Three levels
- **WHEN** a session has subagent A, and A has subagent B
- **THEN** A's row is indented one step under the session's, and B's one step under A's

#### Scenario: Collapse a session
- **WHEN** the user collapses a session with three agents showing
- **THEN** its three agents and its fold row are hidden, and the session's row stays

#### Scenario: Long description
- **WHEN** a subagent's description is 300 characters long in a 1440x900 window
- **THEN** its row keeps one line, the description ends with an ellipsis, and hovering it shows all of it

### Requirement: Read the Outline by keyboard
Each state group of the Outline SHALL be a tree (`role="tree"`) named by its heading, with one tab stop. Up and Down SHALL move between the rows that show; Right SHALL expand a collapsed row, else move to its first child; Left SHALL collapse an expanded row, else move to its parent; Home and End SHALL go to the first and the last row; Enter and Space SHALL select the row. Each row SHALL state its level, its place among its siblings, and whether it is expanded.

#### Scenario: Walk into a session
- **WHEN** the focus is on an expanded session row with two agents and the user presses Right, then Down
- **THEN** the focus is on its first agent, then on its second

#### Scenario: Left on an agent
- **WHEN** the focus is on a subagent with no children and the user presses Left
- **THEN** the focus is on its parent's row

#### Scenario: Open a fold row by keyboard
- **WHEN** the focus is on a fold row and the user presses Right
- **THEN** the finished agents show, and the row reads as expanded

#### Scenario: A screen reader on a row
- **WHEN** a screen reader reaches a running subagent row, the second of three under its session
- **THEN** it reads the node's name, description, state and figures in words, level 2, 2 of 3

### Requirement: Draw the Org chart as cards
The Org chart SHALL draw one diagram per session, top-down: the session's card on top, its agents' cards in a row under it, and each agent's own agents under that agent, with a connector from each parent to each of its children. A card SHALL show what the node's Outline row shows. A fold SHALL be one card that says how many it holds.

#### Scenario: Session with three running subagents
- **WHEN** a session has three running subagents in a 1440x900 window
- **THEN** its chart shows the session's card, three cards in a row under it, and a connector from the session to each

#### Scenario: Fold card
- **WHEN** the same session also has four done subagents
- **THEN** a fourth card, after the three, reads "4 finished subagents", and selecting it shows the four as cards

### Requirement: Fit the Org chart to many children and narrow screens
A parent with more than 5 children that show SHALL stack them in a column under it, each joined to one line that runs down from the parent. Below 721 pixels wide, every parent SHALL stack its children that way. A chart wider than the page SHALL scroll sideways inside itself, and the page SHALL NOT scroll sideways.

#### Scenario: Eight children
- **WHEN** a session shows 8 running subagents in a 1440x900 window
- **THEN** the eight cards stand in one column under the session's card, each joined to the line that runs down from it

#### Scenario: Phone
- **WHEN** the user opens the Org chart on a 390x844 screen with a session of three subagents
- **THEN** the three cards stand in a column under the session's card, and the page has no sideways scroll

#### Scenario: Deep chart
- **WHEN** a chart of four subagents that each have four of their own is wider than a 1280x800 window
- **THEN** the chart scrolls sideways inside its own box, and the page does not

### Requirement: Read the Org chart with assistive technology
Each chart SHALL be a list of nested lists, one item per node, in the order parent then children, under its group's `h2` heading. Each card SHALL be a button whose accessible name gives what the card shows, in words. A fold card SHALL say whether it is expanded. The connectors SHALL be hidden from assistive technology. Tab SHALL reach every card in that order.

#### Scenario: A screen reader on a chart
- **WHEN** a screen reader user moves through the chart of a session with two subagents, one of which has a subagent
- **THEN** it reads the session, then a list of 2 items, and inside the first a list of 1 item, and reads no connector

#### Scenario: Card name
- **WHEN** a screen reader reaches the card of a running subagent with 8 tool calls of which 2 failed
- **THEN** it reads its name, its description, "running", "8 tool calls" and "2 errors"

### Requirement: Open a node in the Stream
Selecting a session node SHALL open that session in the Stream view. Selecting a subagent node SHALL open its session in the Stream view with that subagent's lane unfolded and in view. Selecting a delegation node SHALL open its session in the Stream view with the delegation call's row in view, and its lane unfolded when a subagent made it. The focus SHALL go to the lane's header or the call's row, else to the stream's heading. Back SHALL return to the Tree.

#### Scenario: Select a session
- **WHEN** the user selects the node of session `graft`
- **THEN** the Stream view opens on `graft`, Follow is on, and the focus is on the stream's heading

#### Scenario: Select a finished subagent
- **WHEN** the user selects a done subagent's node, whose lane the stream would fold
- **THEN** the Stream view opens on its session, that lane is unfolded and in view, the focus is on its header, and Follow is off

#### Scenario: Lane not among the events held
- **WHEN** the user selects a subagent whose calls are older than the events the stream loads
- **THEN** the Stream view opens on its session as for a session node

#### Scenario: Select a delegation
- **WHEN** the user selects a delegation node whose call the stream holds
- **THEN** the Stream view opens on its session with that call's row in view and focused, and Follow is off

#### Scenario: Back
- **WHEN** the user selects a node and then goes back
- **THEN** the Tree shows, in the layout it had

### Requirement: Turn the Stream's filters off for an agent's node
Selecting a subagent or delegation node SHALL turn the Stream's filters off (Failed calls only, Main thread only, Hide read-only), as each can hide the lane or the call it opens. Selecting a session node SHALL leave them as they are.

#### Scenario: Filters on
- **WHEN** Main thread only is on and the user selects a subagent's node
- **THEN** the Stream's filters are off and the subagent's lane is in view

### Requirement: Mark the selected session in the Tree
The node of the session the URL names SHALL be marked as the current one, and SHALL be the row or the card the keyboard reaches first in its group. A node that moves, to another group or into a fold, while it holds the keyboard focus SHALL keep the focus where it lands; one that goes into a closed fold SHALL give the focus to the fold row.

#### Scenario: Return from the Stream
- **WHEN** the user opens `graft` from the Tree and goes back
- **THEN** `graft`'s node is marked current

#### Scenario: Focused subagent finishes
- **WHEN** the focus is on a running subagent's row and the subagent finishes, with its parent's fold closed
- **THEN** the focus is on the fold row, which now counts one more

### Requirement: Keep the Tree current
The Tree SHALL update when the active list does: after each change notice and on the page's recheck, under the page's one update connection, and it SHALL follow Pause and a hidden tab as the rest of the page. It SHALL ask for the agents only while it shows. An update SHALL keep the folds, the scroll position and the keyboard focus.

#### Scenario: New subagent
- **WHEN** a session in the Tree starts a subagent
- **THEN** its node appears under the session within 3 seconds of its first line being written, and no fold changes

#### Scenario: Paused
- **WHEN** the user pauses the page and a subagent finishes
- **THEN** the Tree does not change until Resume

#### Scenario: Stream view
- **WHEN** the user is in the Stream view or on the Wall
- **THEN** the page's requests for the active list do not ask for agents

### Requirement: Say when a session's agents are left out
When the list left agents of a session out, the session's node SHALL say how many, after its agents, with a link to the session's sheet.

#### Scenario: Agents left out
- **WHEN** the list holds 200 agents of a session and says it left 60 out
- **THEN** the session's last row reads "60 older agents not shown", with a link that opens the session's sheet over Live

### Requirement: Fit the Outline to a narrow screen
Below 721 pixels wide, an Outline row SHALL take two lines: its state, name and error count, then its figures; its description SHALL show under them, cut with an ellipsis. The indent per level SHALL shrink so that a third-level row keeps at least half the screen's width. The page SHALL NOT scroll sideways.

#### Scenario: Phone
- **WHEN** the user opens the Outline on a 390x844 screen with a session, a subagent and that subagent's subagent
- **THEN** each row shows on two lines and its description, the third-level row is at least 195 pixels wide, and the page has no sideways scroll
