## ADDED Requirements

### Requirement: Show the project's sessions by cost and tool calls
The page SHALL show a block "Sessions by cost and tool calls": one dot per session of the project in the view with a known cost, its estimated cost across and its tool calls up, both on log scales. The range, source and automated filters SHALL apply to it, as to every usage block. The block SHALL link to Activity filtered to the project. Its tick labels and axis names SHALL lie inside the block, none over another, however many digits the labels have.

#### Scenario: A project's sessions
- **WHEN** the user views `foo` for the last 30 days and `foo` has 93 sessions with a known cost
- **THEN** the block shows 93 dots, each at its session's estimated cost and tool calls

#### Scenario: Sessions from three agents
- **WHEN** the view holds Claude Code, Codex and Grok sessions of `foo`
- **THEN** each of them is a dot at its own cost and tool calls

#### Scenario: A source filter
- **WHEN** the user picks Codex in the source filter
- **THEN** the block shows Codex sessions only

#### Scenario: Wide labels
- **WHEN** one session of the view made 120,000 tool calls and another cost $1,500
- **THEN** the margins widen so that every tick label and both axis names lie inside the block, apart

### Requirement: Mark the sessions that made a commit
On the session plot, a dot SHALL be filled when the session made a commit and hollow when it made none, so that a commit is told by shape and not by color alone.

#### Scenario: A commit
- **WHEN** a session made two commits and another made none
- **THEN** the first is a filled dot and the second a hollow one

### Requirement: Split the session plot at the medians
With three dots or more, two dashed lines SHALL cross the session plot at the median cost and the median tool calls of the sessions shown. A session above the median cost SHALL count as costly and one at or below it as cheap; one above the median of tool calls as much done and one at or below it as little done.

#### Scenario: Four quadrants
- **WHEN** the shown sessions' median cost is $1.42 and their median tool calls 23
- **THEN** a session at $4.20 and 12 tool calls counts as costly with little done

#### Scenario: A session on a line
- **WHEN** a session's cost is the median cost
- **THEN** it counts as cheap

### Requirement: Name the session plot's quadrants
The four quadrants SHALL be named "Cheap, much done" (top left), "Costly, much done" (top right), "Cheap, little done" (bottom left) and "Costly, little done" (bottom right). A list under the plot SHALL give each name with its count. A name SHALL be drawn in its quadrant's corner only when it fits there.

#### Scenario: Counts
- **WHEN** 8 of the shown sessions are costly with little done
- **THEN** the list under the plot reads "Costly, little done" with 8

#### Scenario: A name with no room
- **WHEN** a quadrant is too narrow for its name at the text size in use
- **THEN** its name is not drawn on the plot, and the list under the plot still names it with its count

### Requirement: Show few sessions without a split
With one or two dots, the block SHALL draw them with no median lines, no quadrant names and no quadrant list, and SHALL say that the sessions are too few to split at a median. With sessions but none of known cost, it SHALL say that none can be placed and draw no plot.

#### Scenario: Two sessions
- **WHEN** the view holds two sessions of `foo` with a known cost
- **THEN** the block shows two dots and says "2 sessions: too few to split at a median."

#### Scenario: No known cost
- **WHEN** every session of the view is on unpriced models
- **THEN** the block says no session in this view has a known cost, and shows no plot

### Requirement: Say which sessions the session plot leaves out
When the view holds more sessions than the usage payload lists, the block SHALL say that it shows the newest of them and that the medians are theirs. It SHALL say how many sessions it leaves out because their cost is unknown. A session whose cost is below $0 (a custom price list may hold negative rates) SHALL have no dot either, and the same line SHALL count it. A session with a cost and some unpriced requests SHALL be a dot at its known cost, read as "at least" that cost.

#### Scenario: More than 300 sessions
- **WHEN** the view holds 412 sessions of `foo`
- **THEN** the block says it shows the newest 300 of 412 sessions in this view, with their medians

#### Scenario: Unknown costs
- **WHEN** two sessions of the view are on unpriced models alone
- **THEN** the block says two sessions with no known cost are left out

#### Scenario: A cost below $0
- **WHEN** a custom price list gives one session of the view a cost below $0
- **THEN** that session has no dot, and the block says one session with a negative cost is left out

### Requirement: Show a zero on the session plot's log axes
A session at $0, or with no tool call, SHALL be drawn in a lane at the start of that axis, labelled "$0" on the cost axis and "0" on the tool-call axis. The lane SHALL lie under the power of ten at or below the axis's lowest value and span at most one decade. The lane SHALL be drawn only when a shown session needs it; an axis with no positive value SHALL take a fallback decade with a lane.

#### Scenario: No tool call
- **WHEN** a session of the view made no tool call
- **THEN** its dot sits in the lane at the bottom of the plot, labelled 0, and its reading says "no tool call"

#### Scenario: A session at no cost
- **WHEN** a session of the view has an estimated cost of 0
- **THEN** its dot sits in the lane at the left of the plot, labelled "$0", and its reading says "$0"

#### Scenario: No session at zero
- **WHEN** every shown session has a cost above $0 and at least one tool call
- **THEN** neither axis has a lane

### Requirement: Read the session plot from the cheapest session to the costliest
The session plot SHALL be read by keyboard from the cheapest session to the costliest: Right and Left to the next and previous dot, Home and End to the ends. The pointer SHALL read the dot nearest to it within 12px. A reading SHALL say the session's name (its title, or its short id without one), start (its time in the browser's locale), estimated cost, tool calls, commits and, with three dots or more, its quadrant.

#### Scenario: First key
- **WHEN** the user focuses the session plot and presses Right, in an en-US browser
- **THEN** the cheapest session is read, for example "Fix the flaky invoice export test, started Nov 2, 09:05 AM: $0.85, 41 tool calls, 2 commits. Cheap, much done."

### Requirement: Write a session's cost on the session plot
A session's cost SHALL read as the app writes a cost, with "$0" for a true zero. A positive cost under a cent SHALL read "under $0.01" in the sentence and "<$0.01" in the tooltip and the table; with unpriced requests it SHALL read "more than $0".

#### Scenario: A cost under a cent
- **WHEN** the session read cost $0.003 and all its requests are priced
- **THEN** its sentence says "under $0.01" and its tooltip "<$0.01"

#### Scenario: Sessions in one place
- **WHEN** three sessions sit within 4px of each other and the pointer reads one of them
- **THEN** its tooltip says "and 2 more sessions here", and the arrow keys read each of the three in turn

### Requirement: Open a session from the session plot
Enter on the dot read, or a click on a dot, SHALL open the session's sheet over the page, as a row of the Sessions block does. When the sheet closes and the focus is back on the plot, Right and Left SHALL go on from that dot. The plot's data table, "Sessions on the plot", SHALL list every dot with the same figures and quadrant, and a row SHALL open its session's sheet.

#### Scenario: Open a session
- **WHEN** the user reads a dot and presses Enter
- **THEN** its session sheet opens over the Project page and the URL names the session

#### Scenario: The data table
- **WHEN** the user opens the plot's data table and selects a row
- **THEN** that session's sheet opens over the Project page

## MODIFIED Requirements

### Requirement: Lay out the blocks in two columns
On wide screens the Project page SHALL show its blocks in two columns: Activity, Cost and Context on the left, and Errors, Plan limits, Sessions, Sessions by cost and tool calls, and Session judgments on the right, each in that order. On narrow screens it SHALL show them in one column in the same order, left column first. The heading SHALL span the page above the columns, under the scope bar. A block SHALL NOT repeat the project sheet's summary figures, except the Cost block's estimated cost.

#### Scenario: Wide screen
- **WHEN** the user opens the Project page on a screen wider than 60em
- **THEN** Activity, Cost and Context are in the left column and Errors, Plan limits, Sessions, Sessions by cost and tool calls, and Session judgments in the right

#### Scenario: Narrow screen
- **WHEN** the user opens the Project page on a phone
- **THEN** the blocks stack in one column, Activity first and Session judgments last
