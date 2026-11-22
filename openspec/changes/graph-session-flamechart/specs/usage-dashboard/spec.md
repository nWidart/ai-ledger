## ADDED Requirements

### Requirement: Show a session's tool calls by thread
The session sheet SHALL show a section "Tool calls by thread" after the timeline and its events, and before the error loops. It SHALL draw each tool call of the session as a bar from its start to its end, at least 1px wide, on one lane per thread: the main thread first, then each subagent in the order of its first call, then one lane "Subagents, not told apart" for the subagent calls whose agent the store cannot name. Calls of one lane that ran at the same time SHALL stack in rows.

#### Scenario: Two subagents in parallel
- **WHEN** a session's main thread starts two Agent calls at once and each subagent makes its own calls
- **THEN** the section shows the main thread with the two Agent calls in two rows, and the lanes "Subagent 1" and "Subagent 2" with their calls side by side in time

#### Scenario: Subagent calls that cannot be told apart
- **WHEN** an old Claude Code transcript wrote its subagent calls into the session's main file
- **THEN** those calls share the lane "Subagents, not told apart"

#### Scenario: Sessions from three agents
- **WHEN** the sheet shows a Claude Code, a Codex or a Grok session
- **THEN** the section draws its calls by the same rules

### Requirement: Draw each kind of tool call by its shape
On the session sheet's tool-call chart, a failed call SHALL be a hollow bar, or a tick taller than its row when the bar would be narrower than 4px; a call with no result SHALL be a ring at its start; a call with no recorded duration, one that ends at or before its start, SHALL be a tick.

#### Scenario: A long failed test run
- **WHEN** a Bash call on the main thread runs from 14:02:10 to 14:08:41 and fails
- **THEN** the main thread shows a hollow bar spanning those six minutes

#### Scenario: A Codex call with no duration
- **WHEN** a Codex call starts and ends at the same moment
- **THEN** it is a tick, and its words say that no duration is recorded

### Requirement: Place tool calls on the timeline's time axis
The section SHALL place every call with the session timeline's own time mapping, at the timeline's width and text size, so that the start of a call's bar sits under that call's tick on the timeline, and the idle gaps the timeline squeezes out are squeezed there too, with the timeline's break mark. A call whose start is not recorded SHALL be placed at its end, as the timeline places it.

#### Scenario: Under the tick
- **WHEN** the session sheet shows a session at any width, at 16px or 32px text
- **THEN** each call's bar starts within half a pixel of the centre of its tick on the timeline

### Requirement: Clip a call that runs past the timeline's end
A call that ends after the timeline's last time SHALL be drawn to the plot's right edge, with a pointed end, and SHALL NOT be drawn past the edge. Its sentence, tooltip and table row SHALL give its true end and duration. The section's key SHALL explain the pointed end when such a call is drawn, and a note SHALL count such calls.

#### Scenario: The session's last call
- **WHEN** a session's last call starts at 14:55:00 and ends at 14:58:00, after every other event
- **THEN** its bar ends at the plot's right edge with a pointed end, and its tooltip says "14:55:00 to 14:58:00" and "3m"

### Requirement: Squeeze a call that runs through idle time
A call that ends inside an idle gap the timeline squeezes out SHALL NOT be drawn past the gap's far side: a call longer than the squeezed break SHALL end at the break's far side. Its sentence, tooltip and table row SHALL give its true duration. The section's key SHALL say that a call that ran through squeezed time is drawn shorter than it lasted, and a note SHALL count such calls.

#### Scenario: A 24-minute call with nothing else running
- **WHEN** a Bash call runs for 24 minutes and nothing else starts until 30 minutes after it started
- **THEN** its bar crosses the timeline's break and ends at the break's far side, and its tooltip says "24m"

### Requirement: Serve each tool call's thread
The session payload SHALL give each call a `lane`: 0 for a main-thread call; for a subagent call, the rank of the file that holds its result among the session's subagent files, by each file's first call, ties by that call's id; null when the subagent call has no result file or its file holds main-thread calls too. The ranks SHALL be taken over all of the session's calls, before the cut of 5,000 calls. The payload SHALL NOT send a file path.

#### Scenario: Subagents numbered by their first call
- **WHEN** a session has two subagent files, the later-named one making the first call
- **THEN** that file's calls have lane 1 and the other's lane 2

#### Scenario: A session resumed into a second main file
- **WHEN** a session's main-thread calls have their results in two files
- **THEN** every one of them has lane 0

#### Scenario: A subagent call with no result
- **WHEN** a subagent call has no result yet
- **THEN** its lane is null

#### Scenario: A cut session
- **WHEN** a session has more than 5,000 calls
- **THEN** the lanes of the calls sent keep the numbers they have over the whole session

### Requirement: Serve each tool call's input from one snapshot
The session payload SHALL give each call an `input`: its input summary cut to 120 characters, empty when there is none. Every figure of the payload SHALL be read in one read-only transaction, so that an ingest committed while it is built changes none of them.

#### Scenario: A long input
- **WHEN** a call's input summary is 130 characters long
- **THEN** its input is the first 120 characters

#### Scenario: An ingest during the read
- **WHEN** an ingest commits a tool call of the session after the payload's first statement
- **THEN** the payload's calls and its Tools table count the same calls

### Requirement: Read the tool-call chart by thread with the keys
Right and Left SHALL read the next and the previous call of the lane by start; Up and Down the call of the lane above or below nearest in time; Home and End the lane's first and last call. With nothing read, these keys SHALL read the top lane's first call, its last for Left and End. A key that cannot move SHALL say the call again. While the chart has focus, these keys SHALL NOT scroll the sheet.

#### Scenario: Changing thread
- **WHEN** the user reads a main-thread call that started at 14:02:10 and presses Down
- **THEN** the call of Subagent 1 that started nearest to 14:02:10 is read

#### Scenario: At the end of a lane
- **WHEN** the user reads a lane's last call and presses Right
- **THEN** the same call is read and said again

### Requirement: Read the tool-call chart with the pointer and open a tool
The pointer SHALL read the call under it within its row, or the nearest within 6px, and nothing in empty space. Enter on the call read, or a click on a call, SHALL open the tool's sheet; a call with no tool name SHALL open nothing and say so.

#### Scenario: Opening the tool
- **WHEN** the user reads a Bash call and presses Enter
- **THEN** the Bash tool sheet replaces the session sheet, with Back to return

#### Scenario: Empty space
- **WHEN** the pointer moves over a row where no call ran
- **THEN** nothing is read

### Requirement: Keep and end a tool-call reading
The reading SHALL be held by the call through newer figures, and SHALL end quietly when newer figures no longer hold that call. Escape SHALL end a reading, from anywhere in the sheet, and SHALL then leave the sheet open; with nothing read, Escape SHALL close the sheet as before.

#### Scenario: Escape with a call read
- **WHEN** the pointer has opened a call's tooltip and the user presses Escape
- **THEN** the tooltip closes and the session sheet stays open

#### Scenario: A call gone from newer figures
- **WHEN** a call is read and newer figures of the session no longer hold it
- **THEN** the reading ends and nothing is said

### Requirement: Word a tool call
The section SHALL say the call read in a polite live region and show it in a tooltip: the tool, its input, its thread, its start and end with seconds in the browser's locale, its duration in one unit, whether it failed, and how many other calls ran during it. A call with no result SHALL say "no result recorded"; one with no duration "no duration recorded"; one with no start "start not recorded".

#### Scenario: A failed call
- **WHEN** the user reads a failed Bash call from 14:02:10 to 14:08:41 whose input is `npm test`, while two other calls ran
- **THEN** the live region says "Bash on the main thread, 14:02:10 to 14:08:41, 6m, failed: npm test. 2 other calls ran during it."

#### Scenario: A call with no result
- **WHEN** the user reads a subagent's Bash call that started at 14:02:10 and has no result
- **THEN** the live region says "Bash on subagent 2, started 14:02:10, no result recorded: npm run dev."

### Requirement: Fit the tool-call tooltip and label the chart
The tooltip SHALL sit beside the pointer, or above or below the call a key read, wrap a long tool name or input, and stay inside the section's box. The chart's group SHALL be labelled with the session's call count, its threads, its active time, its longest call and the keys.

#### Scenario: A long input in a narrow box
- **WHEN** the section is 343px wide and the call read has a 120-character input
- **THEN** the tooltip wraps the input and lies inside the section

### Requirement: Offer the tool calls as a table
Under the chart, "Show data table" SHALL open a table "Calls by duration": one row per call drawn, longest first, then the calls with no duration or no result by start, with the call's start, thread, tool, input, duration and result. It SHALL show the first 20 rows and a button that shows every row. A row SHALL open the tool's sheet.

#### Scenario: Show all
- **WHEN** the session has 412 calls and the user opens the table
- **THEN** it lists the 20 longest calls and offers "Show all 412 calls"

### Requirement: Fold extra rows and threads
The section SHALL draw at most 4 rows on the main thread and 3 on another lane, and at most 6 subagent lanes; further subagents SHALL share one lane "Other subagents (N)". A call beyond a lane's last row SHALL be drawn over that row. A note SHALL count the calls drawn over a last row and name the subagents that share a lane. Each call's words SHALL keep its own subagent's number.

#### Scenario: Nine subagents
- **WHEN** a session has nine subagents
- **THEN** the section shows Subagents 1 to 6 and the lane "Other subagents (3)", and a call of subagent 8 is read as "subagent 8"

### Requirement: Say what the tool-call chart leaves out
The section SHALL say when the session was cut to its first 5,000 calls, and how many calls have no recorded duration. With no call in the session it SHALL say "No tool calls in this session."; when the session has too little activity for a timeline, "Not enough activity to draw the tool calls."

#### Scenario: A cut session
- **WHEN** a session has 6,000 tool calls
- **THEN** the section says "Long session: only its first 5,000 tool calls are drawn."

### Requirement: Load the tool-call chart on its own
The section's code SHALL load as its own chunk, requested when a session sheet opens, and SHALL NOT be part of the app's first download. When that chunk cannot load, the section SHALL say "The tool-call chart could not be loaded. Reload the page to try again." and the rest of the sheet SHALL stay.

#### Scenario: The chunk fails to load
- **WHEN** the request for the section's code fails
- **THEN** the sheet shows its figures, timeline, error loops and tables, and the section says the chart could not be loaded

### Requirement: Keep the tool-call chart legible everywhere
The section SHALL fit a 343px box at 32px text with no sideways scroll, its lane labels cut with their full names in the words and the table. Under forced colors its bars, ticks, rings, breaks and labels SHALL be in system colors, a failed call told by its shape or height, and the call read marked in the system highlight color. It SHALL follow the theme and the OS scheme without a reload, and SHALL NOT animate.

#### Scenario: Forced colors
- **WHEN** forced colors is on and the section is drawn
- **THEN** a successful call is a bar in the system text color, a failed one an outline in it, and the call read is outlined in the system highlight color
