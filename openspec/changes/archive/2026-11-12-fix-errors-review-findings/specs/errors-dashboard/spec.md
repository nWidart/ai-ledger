# Spec Delta

## MODIFIED Requirements

### Requirement: Import fix markers
The app SHALL accept `POST /api/errors/fixes/import` with `{"fixes": {category: "YYYY-MM-DD"}}` and answer with every mark. In one transaction it SHALL store a marker for each type whose fix marker the store has not decided (no row, or a row that is only a mute), and keep a type that was marked or marked and undone. It SHALL leave out an invalid entry instead of refusing the rest.

#### Scenario: Import over a marker set meanwhile
- **WHEN** another browser marks `x` for Nov 1 and then an import names `x` for Nov 4 and `worktree` for Oct 1
- **THEN** the store keeps `x` for Nov 1, takes `worktree` for Oct 1 and answers both

#### Scenario: Import after an undo
- **WHEN** a tab undoes `x` and an import from another tab, sent earlier, then names `x`
- **THEN** `x` stays unmarked

#### Scenario: One bad entry in an import
- **WHEN** an import holds a marker with a date after today and a valid one
- **THEN** the valid one is stored and the answer is 200

#### Scenario: Import after a mute
- **WHEN** another tab mutes `x`, which has no fix day, and an import then names `x` for Nov 4
- **THEN** the store keeps `x` muted and marks it fixed on Nov 4

#### Scenario: Import after a mute and an unmute
- **WHEN** another tab mutes and unmutes `x`, and an import then names `x` for Nov 4
- **THEN** `x` is marked fixed on Nov 4

### Requirement: Narrow the lists to a chart bucket
The Errors page SHALL let the user select one day or week of the errors chart by click, or by Enter or Space on the chart's current point, and clear it the same way. A folded stretch without tool calls SHALL NOT be selectable. A selected bucket SHALL narrow the type table and the open type's detail to its errors; the summary, chart, rate trend and change stay range-wide. The table's hint SHALL name the columns that follow the bucket and those that do not.

#### Scenario: Select a spike
- **WHEN** the user clicks the day's bar on the chart
- **THEN** the type table counts only that day's errors, a chip names the day, and the change column is unchanged

#### Scenario: Time lost in a bucket
- **WHEN** a day is selected and an incident has one of its failures on that day and the rest on another
- **THEN** the type table's Time lost and the detail's time-lost sentence count that incident whole, and Where to start and the summary stay range-wide

#### Scenario: Keyboard
- **WHEN** the user reads a point with the arrow keys and presses Enter, then Space
- **THEN** the point is selected, then cleared

#### Scenario: Folded stretch
- **WHEN** the current point is a folded stretch without tool calls and the user presses Enter
- **THEN** nothing is selected and the page says it cannot be

#### Scenario: The hint
- **WHEN** a day is selected
- **THEN** the table's hint says that the types, Errors, Time lost, Rate, Didn't recover and Share follow it, and Rate trend and Change stay range-wide

### Requirement: Never suggest a muted type
Where to start SHALL NOT list a muted type, neither among the open fixes nor under Rising fastest, whatever the toggle says. The summary's count of open types with a ready-made fix SHALL leave a muted type out too, so the two agree.

#### Scenario: Where to start
- **WHEN** `git` is muted and has a ready-made fix and the most time lost
- **THEN** Where to start does not list it, with the toggle on or off

#### Scenario: The summary's count
- **WHEN** `git` is the one open type with a ready-made fix and the user mutes it
- **THEN** the summary counts no open type with a ready-made fix

### Requirement: Sort the type table
The type table SHALL sort by Type (A to Z first), Errors, Time lost, Rate, Didn't recover and Change. Share and the rate trend are plain headers: Share orders as Errors does. The default is Errors, most first. A second click on a header SHALL flip the direction. Only the sorted header SHALL carry `aria-sort`. Ties SHALL keep the default order, and a row whose cell shows "–" for the sorted column SHALL come last in either direction.

#### Scenario: Sort by Didn't recover
- **WHEN** the user selects the "Didn't recover" header
- **THEN** the types with the largest share of unrecovered incidents come first, a type with no incident comes last, and only that header has `aria-sort`

#### Scenario: Flip the direction
- **WHEN** the user selects the sorted header again
- **THEN** the order reverses, a type with no value is still last, and keyboard focus stays on the header button

#### Scenario: No time lost
- **WHEN** the user sorts by Time lost, least first, and a type with no measurable time lost shows "–"
- **THEN** that type comes after the type that shows "1 min"

## REMOVED Requirements

### Requirement: Sort Change by its percent
**Reason**: Change sorted by the percent its cell shows, which put a type that went from 0 to 48 errors below one that went up 12%.
**Migration**: Replaced by "Sort Change by its change in points".

## ADDED Requirements

### Requirement: Sort Change by its change in points
The Change column SHALL sort by the change in the type's error rate, in percentage points (the rate after minus the rate before, as Rising fastest ranks), for every row with a comparison, a cell that shows counts included. Only a "–" cell SHALL sort last in either direction. The header's title SHALL say that it sorts by the change in error rate, in points.

#### Scenario: Counts sort by their points
- **WHEN** the user sorts by Change, most first, and one type shows "+12%", one "▼ -40%" and one "0 → 48", the last with the largest rise in rate
- **THEN** the order is "0 → 48", "+12%", "▼ -40%"

#### Scenario: No comparison
- **WHEN** the view has too few tool calls to compare and every Change cell shows "–"
- **THEN** the rows keep the default order

### Requirement: Open a type over a chart bucket
Choosing a type from the chart legend or Where to start SHALL open it, and SHALL clear a selected bucket that holds none of its errors, saying "Selection cleared: <type> has no errors in <bucket>." Choosing a type in the command palette SHALL always clear the bucket. A row of the type table is not affected, as its rows are the bucket's.

#### Scenario: A type with no errors that day
- **WHEN** a day is selected and the user chooses a type with no errors that day from the chart legend
- **THEN** the type opens, the selection clears and the status region says so

#### Scenario: A type with errors that day
- **WHEN** the type has errors in the selected day
- **THEN** the type opens and the day stays selected

### Requirement: Clear every filter a linked example misses
The "Outside current filters" note SHALL name the project, agent, range, bucket, tool and toggles, and its Clear filters button SHALL reset all of them, the agent filter included.

#### Scenario: Another agent
- **WHEN** a link opens an example of Claude Code under an agent filter of Codex, and the user selects Clear filters
- **THEN** the agent filter clears and the example shows in the list

### Requirement: Go back to a listed type
"Back to types" SHALL scroll to and focus the open type's row in the type table. When the type filter hides that row, it SHALL do so for the first listed type, or for the chart when no type is listed.

#### Scenario: Filtered out
- **WHEN** the filter box hides the open type and the user selects Back to types
- **THEN** focus lands on the first listed type's button

### Requirement: Read a chart point with errors and no calls
A chart point with errors and no tool calls SHALL be read, in the keyboard reading and the tooltip, as its errors and that no tool call started in that bucket, because a failed call counts on the day it started and its error on the day it ended. Only a point with neither SHALL read "no activity".

#### Scenario: Errors the day after the call
- **WHEN** a day has 4 errors and no tool call started in it
- **THEN** its reading says "4 errors, no tool call started in this day" and does not say "no activity"

### Requirement: Announce the chart as an application
The chart box SHALL have `role="application"` and `aria-roledescription="chart"`, as it handles arrow keys, Enter and Space itself. It SHALL keep its label (the instructions and the selected bucket), be described by the chart's hint, and keep its live region for the keyboard reading.

#### Scenario: Role
- **WHEN** a screen reader reaches the chart
- **THEN** it exposes an application described as a chart, and the arrow keys reach the page

### Requirement: Keep open message groups per type
An open By message group SHALL be remembered by type and message: "(no error text)" open in one type SHALL NOT be open in another.

#### Scenario: Two types with no error text
- **WHEN** the user opens "(no error text)" in one type and then opens another type that has it
- **THEN** the group is closed in the other type and still open when the first type is opened again

### Requirement: Answer an unexpected marks error
When a marks write raises an unexpected error, the app SHALL answer 500 with `{"error": "internal error"}`, release the store's lock, and log the error's type and message to stderr, never the request body.

#### Scenario: A store error
- **WHEN** the store raises an error while a mute is written
- **THEN** the endpoint answers 500, the next write is answered, and stderr names the error but not the type
