## ADDED Requirements

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
- **THEN** the strip shows "5h 86%" in the warning color with the word "near", and its reset time for a screen reader and on hover

### Requirement: Copy the resume command from the strip
The strip's Copy resume button SHALL copy the shell command that resumes the session in its agent, after a change to its working directory when the app knows it, and SHALL say politely whether the copy worked.

#### Scenario: Copy resume
- **WHEN** the user selects Copy resume on a Claude Code session started in `/work/api`
- **THEN** the clipboard holds `cd '/work/api' && claude --resume <id>`, and the page says it copied

### Requirement: Show the session's pulse
The strip SHALL show a pulse of the last 10 minutes: the context of each main-thread request as a line, and a tick for each finished tool call, an upright mark for a success and a ✕ for a failure. The two marks SHALL differ in shape. The pulse's line and marks SHALL keep 3:1 against the surface, and SHALL show under forced colors. Its name SHALL say the context's range, the calls and the failures.

#### Scenario: Pulse of a busy session
- **WHEN** a session's context went from 40,000 to 62,000 tokens over its last 10 minutes, with 18 calls of which 2 failed
- **THEN** the pulse's line rises, it has 16 upright marks and 2 ✕ marks, and its name says 40k to 62k tokens, 18 tool calls, 2 failed

#### Scenario: Cache rereads
- **WHEN** a session's requests reread a large cached context without adding to it
- **THEN** the pulse's line stays flat

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
Selecting a wall tile SHALL pin that session's stream beside the tiles, and selecting it again SHALL unpin it; the tile SHALL say whether it is pinned. A pinned stream SHALL show its head, a strip and the stream, with its own filters and Follow, an Unpin button and an Open in Stream button. Unpin SHALL move the focus to the session's tile.

#### Scenario: Pin from the wall
- **WHEN** the user selects the `graft` tile
- **THEN** the Wall stays, `graft`'s stream shows beside the tiles, and the tile reads as pinned

#### Scenario: Unpin
- **WHEN** the user selects Unpin on the pinned `graft` stream
- **THEN** the stream goes and the focus is on the `graft` tile

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

### Requirement: Fit the page to a narrow screen
Below 721 pixels wide, the rail SHALL be one row of entries that scrolls sideways inside itself, with its group headings for screen readers, and the page SHALL NOT scroll sideways. At 390x844 the first event of the stream SHALL be on the first screen.

#### Scenario: Phone with eight sessions
- **WHEN** the user opens a session on a 390x844 screen with 8 active sessions
- **THEN** the page has no sideways scroll, and the stream's first event shows without scrolling

## MODIFIED Requirements

### Requirement: Toggle full text
The page SHALL offer a Full text toggle that is off on every page load. With it off, prompts and replies SHALL show as word counts, tool results as sizes, tool inputs cut to 300 characters and subagent calls by their description. With it on, they SHALL show as written, a dismissible warning SHALL say that secrets can appear, without moving the page, and the toggle SHALL keep a warning tint. Turning it on SHALL keep open rows, folded lanes and the scroll position.

#### Scenario: Turn on full text
- **WHEN** the user turns on Full text
- **THEN** the stream shows prompts, replies and tool results as written, the warning appears, the stream does not move, and a row the user had open stays open

#### Scenario: Dismiss the warning
- **WHEN** the user dismisses the warning
- **THEN** it goes, nothing moves, and Full text stays on with its tint

#### Scenario: Reload
- **WHEN** the user reloads the page after turning Full text on
- **THEN** Full text is off

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

### Requirement: Fit the stream page to the window
At 721 pixels wide and up, the Live page's Stream view SHALL fit the window's height, so the page does not scroll: the rail and the stream SHALL stay within it and scroll inside themselves, and the stream SHALL take the width the rail leaves. From 1100 pixels wide, the Wall view with a pinned stream SHALL fit the same way, the tiles and each stream scrolling inside themselves. Otherwise the page scrolls as any other.

#### Scenario: Titled session in a short window
- **WHEN** the user opens a session with a title in a window 720 pixels high
- **THEN** the page does not scroll, and the rail and the stream each end above the bottom of the window

#### Scenario: Stream width
- **WHEN** the user opens a session in a 1440x900 window
- **THEN** the stream is wider than the 798 pixels it had beside the agent panel

### Requirement: Keep the selection in the URL
The page SHALL keep the selected session, the view (Stream or Wall) and the Wall's pins, oldest first, in the URL, with the shared project, source and automated filters. Pinning and unpinning SHALL replace the history entry, not add one.

#### Scenario: Reload on a session
- **WHEN** the user reloads `/live` while following session A
- **THEN** the page opens on session A in the same view

#### Scenario: Reload with pins
- **WHEN** the user reloads `/live?view=wall&pin=a,b`
- **THEN** the Wall shows with a and b pinned, a the oldest

#### Scenario: Selected session no longer active
- **WHEN** the URL names a session that is no longer active
- **THEN** the stream still shows that session's newest events, marked idle

#### Scenario: Unknown session
- **WHEN** the URL names a session the store does not hold
- **THEN** the stream says the session was not found and offers a link back to the active sessions

## REMOVED Requirements

### Requirement: Show the agent panel
**Reason**: The status strip above the stream shows the panel's figures and gives its width to the stream; the pulse replaces the tokens-per-minute chart.
**Migration**: See "Show the session's status strip" and "Show the session's pulse". Requests per model are on the session sheet.
