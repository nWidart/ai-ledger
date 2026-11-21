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
Each rail entry SHALL show the session's title as its main line, then the project with its color, the state and the source on its second line, and the cost so far. An entry with no title SHALL show the project as its main line, and its second line SHALL hold the state, the source and the branch. An entry in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and an entry running a tool SHALL show the tool's name and how long it has run, such as `Bash 12s`.

#### Scenario: Two sessions in one project
- **WHEN** two `ai-ledger` sessions are active with the AI titles "Add session titles" and "Fix Cost test"
- **THEN** their rail entries show those titles as their main lines, and `ai-ledger` on their second lines

#### Scenario: Prompt title under Full text
- **WHEN** an active session has no agent title and Full text is off
- **THEN** its entry shows the project as its main line, and when Full text is turned on it shows the title made from its first prompt

#### Scenario: Untitled entry
- **WHEN** an active session on branch `main` has no title
- **THEN** its entry shows the project as its main line, and its second line shows the state, the source and `main`

#### Scenario: How long on your turn
- **WHEN** a session has been in your turn for 4 minutes
- **THEN** its entry shows 4m 00s beside the state, and the figure counts up

#### Scenario: How long idle
- **WHEN** a session has been idle for 7 minutes
- **THEN** its entry shows `idle 7m 00s`

#### Scenario: A running tool
- **WHEN** a session has run a `Bash` call for 12 seconds
- **THEN** its entry shows `Bash 12s` as the state

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
The page SHALL offer a Full text toggle that is off on every page load. With it off, prompts and replies SHALL show as word counts, tool results as sizes, tool inputs cut to 300 characters and subagent calls by their description. With it on, they SHALL show as written, a dismissible warning SHALL say that secrets can appear, without moving the page, and the toggle SHALL keep a warning tint. Turning it on SHALL keep open rows, folded lanes and the scroll position.

#### Scenario: Turn on full text
- **WHEN** the user turns on Full text
- **THEN** the stream shows prompts, replies and tool results as written, the warning appears, the stream does not move, and a row the user had open stays open

#### Scenario: Dismiss the warning
- **WHEN** the user dismisses the warning
- **THEN** it goes, nothing moves, Full text stays on with its tint, and the focus is on the Full text toggle

#### Scenario: Reload
- **WHEN** the user reloads the page after turning Full text on
- **THEN** Full text is off

### Requirement: Follow the newest event
With Follow on, the stream SHALL keep the newest event in view, wherever it falls in the stream, including inside a lane in the middle of it. Scrolling up or opening a tool row SHALL turn Follow off. The page's own scrolling SHALL NOT. A size change of the stream or its rows SHALL keep Follow on and put the newest event back in view. While Follow is off and new events arrive, the page SHALL offer Jump to latest, which turns Follow back on.

#### Scenario: Read back while the session runs
- **WHEN** the user scrolls up while new tool calls arrive
- **THEN** the stream stays where the user scrolled, and Jump to latest appears

#### Scenario: Newest event in a lane
- **WHEN** Follow is on, a running lane stands in the middle of the stream with a main-thread event after it, and the lane gets a new tool call
- **THEN** the stream scrolls to that call, and Follow stays on

#### Scenario: Stream changes size
- **WHEN** Follow is on and the window is resized, or a web font loads and the rows wrap anew
- **THEN** Follow stays on, and the newest event is in view

#### Scenario: Newest event taller than the stream
- **WHEN** Follow is on and the newest event, in the middle of the stream, is opened and taller than the stream's box
- **THEN** the stream shows that event from its top, and stays there

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
A wall tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. The error count SHALL agree in number with its noun: "1 error", "2 errors".

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile reads "1 error"

### Requirement: Show state time and title on a wall tile
A tile in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and one running a tool its name and run time. A tile in *your turn* SHALL have a border. The title SHALL take one line under the project, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL leave that line out.

#### Scenario: Long title on a tile
- **WHEN** a session's title is wider than its tile
- **THEN** the tile shows the title on one line, cut with an ellipsis, and hovering it shows the full title

#### Scenario: Your turn tile
- **WHEN** a session is in your turn
- **THEN** its tile has a border and shows how long the session has waited

### Requirement: Name a tile's latest shell call by its description
The latest action on a wall tile SHALL name a shell call that carries a description by that description, as the call's row in the stream; otherwise it SHALL show the call's input summary. The app SHALL cut either as it cuts a tool input.

#### Scenario: Latest call is a shell call with a description
- **WHEN** a session's newest call is a `Bash` call that runs `cd /long/path && uv run pytest` with the description "Run the Python tests"
- **THEN** its tile's latest action reads "Bash · Run the Python tests"

#### Scenario: Latest call is a shell call with no description
- **WHEN** a session's newest call is a `Bash` call that carries no description
- **THEN** its tile's latest action shows the command

### Requirement: Keep the selection in the URL
The page SHALL keep the selected session, the view (Stream or Wall) and the Wall's pins, oldest first, in the URL, with the shared project, source and automated filters. Pinning and unpinning SHALL replace the history entry, not add one. Of the pins the URL names, the page SHALL keep the well-formed ids, each once at its first place, and of more than two the last two.

#### Scenario: Reload on a session
- **WHEN** the user reloads `/live` while following session A
- **THEN** the page opens on session A in the same view

#### Scenario: Reload with pins
- **WHEN** the user reloads `/live?view=wall&pin=a,b`
- **THEN** the Wall shows with a and b pinned, a the oldest

#### Scenario: More pins than two
- **WHEN** the user opens `/live?view=wall&pin=a,b,a,c,bad%20id`
- **THEN** the Wall pins b and c, b the oldest

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
The stream SHALL offer filters, in a bar above it, that change what it draws and nothing it holds. Selecting the Errors count, there or in the status strip, SHALL filter the stream to failed tool rows, and selecting it again SHALL clear it. A Main thread only toggle SHALL hide every lane. A Hide read-only toggle SHALL hide the rows the app marks read-only: `Read`, `Grep`, `Glob`, and shell calls whose every command only reads or searches. It SHALL NOT hide a failed row.

#### Scenario: Filter to failed rows
- **WHEN** the user selects the Errors count while the stream holds two failed rows among forty
- **THEN** the stream shows the two failed rows, and selecting the count again shows all rows

#### Scenario: Main thread only
- **WHEN** the user turns on Main thread only with two lanes in the stream
- **THEN** no lane shows, and the main-thread rows do

#### Scenario: Hide read-only rows
- **WHEN** the user turns on Hide read-only with `Read`, `Grep`, `Glob` and `Edit` rows in the stream
- **THEN** only the `Edit` row shows among them

#### Scenario: Hide read-only shell rows
- **WHEN** the user turns on Hide read-only with a shell row that runs `rg TODO src` and one that runs `git commit`
- **THEN** only the `git commit` row shows among them

#### Scenario: Failed read-only row
- **WHEN** the user turns on Hide read-only, with the Errors filter or without it, and a `Read` row failed
- **THEN** the failed `Read` row shows

#### Scenario: Errors count pressed
- **WHEN** the user selects the Errors count in the status strip
- **THEN** the stream shows failed rows only, and the count shows as pressed in the strip and in the stream's bar

#### Scenario: Filters do not change figures
- **WHEN** the user turns on any filter
- **THEN** the strip's figures and the lane headers' tool counts do not change

### Requirement: Combine stream filters
The stream filters SHALL combine, SHALL be off on every page load, and SHALL stay on when the user opens another session. A lane with no matching row SHALL be hidden; a lane with matching rows SHALL keep its header, with the matching rows under it when it is open. The Errors filter SHALL open a finished lane that holds a failed row; a lane the user folded SHALL stay folded. The stream SHALL say how many rows the filters hide.

#### Scenario: Filters combine
- **WHEN** the user filters to failed rows and turns on Main thread only, and the only failed row is inside a lane
- **THEN** the stream shows no row, and says that the filters hide every row

#### Scenario: Failed row in a lane
- **WHEN** the user filters to failed rows and a finished lane, folded as any finished lane, holds one failed row among six
- **THEN** the lane opens, and shows its header and that one row

#### Scenario: Lane the user folded
- **WHEN** the user folds a lane that holds a failed row, with the stream filtered to failed rows
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

### Requirement: Pause the page's requests while the tab is hidden
While the tab is hidden, the Live page SHALL stop its interval requests and its per-second timers, SHALL hold the events it is told of, and SHALL NOT draw them. On return to the tab it SHALL fetch what it missed and the app's status once, draw the newest state, and resume. This SHALL NOT change a Pause the user chose: a paused page stays paused.

#### Scenario: Tab hidden for a minute
- **WHEN** the user switches to another tab for a minute while a session runs, and comes back
- **THEN** the page fetches what it missed at once, shows the session's current state, and the running timers show the real elapsed time

#### Scenario: Paused page in a hidden tab
- **WHEN** the user paused the page, hides the tab and returns
- **THEN** the page is still paused, and resuming shows the newest events

### Requirement: Show the session's status strip
Above the stream, under its head, the page SHALL show a strip with the selected session's state and its detail, a context meter with a mark at each compaction, cost, tool calls, errors, cache-read share, the use of each open plan limit of its source, the pulse, its working directory and Copy resume. An inferred state SHALL say it is inferred, with the reason behind a toggletip.

#### Scenario: Context near full
- **WHEN** the session uses more than 80% of its context window: the window the session states (Codex), else its model's window in the price table
- **THEN** the strip's context meter shows the warning color

#### Scenario: Likely waiting for approval
- **WHEN** the selected session's state is likely waiting for approval
- **THEN** the strip shows the state in the warning color with "(inferred)", and that toggletip gives the reason

#### Scenario: Unknown window
- **WHEN** the model's context window is not known
- **THEN** the strip shows the context in tokens and says the window is not known, with no meter

#### Scenario: Plan limit near full
- **WHEN** the session's source has a 5-hour limit at 86%
- **THEN** the strip shows "5h 86%" in the warning color with the word "near", and a toggletip beside it, reached by pointer and keyboard, gives its reset time

#### Scenario: Strip on a phone
- **WHEN** the user opens a session on a 390x844 screen
- **THEN** the strip shows the working directory, cut from its start, with the whole path in its text

### Requirement: Copy the resume command from the strip
The strip's Copy resume button SHALL copy the shell command that resumes the session in its agent, after a change to its working directory when the app knows it, and SHALL say politely whether the copy worked.

#### Scenario: Copy resume
- **WHEN** the user selects Copy resume on a Claude Code session started in `/work/api`
- **THEN** the clipboard holds `cd '/work/api' && claude --resume <id>`, and the page says it copied

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

### Requirement: Show context, errors and latest action in a rail entry
Each rail entry SHALL have a third line with a small context meter and its percent when the window is known, the session's latest action as a wall tile names it, and, when above zero, its error count with a ✕ that a screen reader reads as "N errors". At 1440x900 the rail SHALL hold 8 sessions without scrolling.

#### Scenario: Entry with failures
- **WHEN** a session at 62% of its window has two failed calls and its newest call is `Bash` running `npm test`
- **THEN** its entry's third line shows a meter, "62%", "Bash · npm test" and "✕ 2", read as "2 errors"

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
The page SHALL keep one update connection while it shows: pinning, unpinning, switching between Stream and Wall, and opening or closing a sheet SHALL NOT open another. A notice that names a pinned session SHALL refetch it.

#### Scenario: Pin, unpin and a sheet
- **WHEN** the user pins two sessions, unpins one, and opens and closes a session sheet
- **THEN** the page opened one connection, and it is still open

#### Scenario: Sheet over pins
- **WHEN** the user opens a pinned stream's session sheet from its head, and closes it
- **THEN** both pinned streams stay mounted under it, and the page opened no other connection

### Requirement: Fit the page to a narrow screen
Below 721 pixels wide, the rail SHALL be one row of entries that scrolls sideways inside itself, with its group headings for screen readers, and the page SHALL NOT scroll sideways. The strip SHALL keep the working directory, cut from its start, and the pulse's readout SHALL open under the strip and wrap within it. At 390x844 the first event of the stream SHALL be on the first screen.

#### Scenario: Phone with eight sessions
- **WHEN** the user opens a session on a 390x844 screen with 8 active sessions
- **THEN** the page has no sideways scroll, and the stream's first event shows without scrolling

#### Scenario: Pulse readout on a phone
- **WHEN** the user focuses the pulse on a 390x844 screen and presses End
- **THEN** the readout shows within the screen, and the page has no sideways scroll
