## ADDED Requirements

### Requirement: Place each control where it acts
The Errors header SHALL hold only the page-level filters: project, range and source. Day / Week SHALL sit in the rate chart's header, as a group named "Granularity". "Include subagents" and "Hide noise and muted" SHALL sit in the type table's toolbar, shown even when the view lists no type. Each SHALL keep its id (`fGran`, `fSub`, `fNoise`) and URL key (`gran`, `sub`, `noise`).

#### Scenario: Day and Week
- **WHEN** the user selects Week in the rate chart's header
- **THEN** the URL holds `gran=week`, the chart draws weeks, and the header holds no Day / Week control

#### Scenario: The toggles
- **WHEN** the user clears "Include subagents" in the type table's toolbar
- **THEN** the URL holds `sub=0` and the summary, chart and table leave out subagent errors

#### Scenario: A link with the keys
- **WHEN** the user opens `/errors?gran=week&sub=0&noise=0`
- **THEN** Week is pressed in the chart's header and the toolbar shows "Include subagents" off and "Hide noise and muted" on

### Requirement: Fit the type table in four columns
The type table SHALL have four columns: Type, with its swatch and Muted and Fix applied marks; Errors and Rate, with the share of errors as a bar; Time lost, with the share not recovered under it; and Trend, a sparkline with Change under it. At 1280px it SHALL fit the master pane with no sideways scroll, and no width SHALL hide a column.

#### Scenario: A laptop window
- **WHEN** the user opens Errors in a 1280px window
- **THEN** the type table shows its four columns within its panel, and neither it nor the page scrolls sideways

#### Scenario: A phone
- **WHEN** the user opens Errors on a phone 390px wide
- **THEN** the four columns stay, with tighter figures and no sparkline drawing

### Requirement: Tick the fix on a type's trend
A type with a recorded fix SHALL show a tick on its Trend sparkline at the bucket of the fix day, when that bucket is in the range, and say so to a screen reader.

#### Scenario: A fix in the range
- **WHEN** `tests` has a fix recorded on Nov 8 and the range holds Nov 8
- **THEN** its sparkline has one tick at Nov 8's bucket, and its cell says the trend marks the fix

### Requirement: Offer the rate chart as a data table
Under the rate chart, a "Show data table" disclosure, closed on load, SHALL show per chart point its tool calls, failed calls, the rate the line draws (the selected type's when one is) and the failed calls of each type layer and Other. Its name SHALL say the granularity and the rate. It SHALL be absent when the chart shows a message instead.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the chart, with days and no type selected
- **THEN** a table named "Failed tool calls by type and error rate per day" lists each day with its calls, failed calls, rate and failed calls by type

#### Scenario: A selected type
- **WHEN** type `x` is open and the view is by week
- **THEN** the table is named "Failed tool calls by type and x rate per week" and its rate column is `x`'s

### Requirement: Score the applied fixes
Where to start SHALL list every recorded fix, newest first, in a table "Applied fixes": the type and fix day, the error rate before and since, and the verdict of the type detail's before and after comparison. A type with errors in the view SHALL open from its row. With no fix recorded the table SHALL be absent.

#### Scenario: Two fixes
- **WHEN** fixes are recorded for `tests` on Nov 8 and `edit_unread` on Oct 25
- **THEN** the table lists `tests` then `edit_unread`, each with its rates and a verdict such as "Rate lower" or "Not enough calls yet"

#### Scenario: No fix
- **WHEN** no fix is recorded
- **THEN** Where to start shows no Applied fixes table

### Requirement: Draw an incident's attempts on a strip
Each incident row SHALL draw its failures on a time strip, then the call that recovered after a short fixed step. The strip SHALL grow with the failures' span, so a tight loop reads as a short strip of crowded marks and spaced failures as a long one. Its text alternative SHALL say the attempts, their span and spacing, and how the incident ended.

#### Scenario: A tight loop
- **WHEN** an incident has 3 failures 2 seconds apart and the next call succeeded 2 seconds later
- **THEN** its strip is short with touching ✕ marks then a ✓, and reads "3 failed attempts over 4s, 2s apart on average, then the next call succeeded 2s later"

#### Scenario: Spaced failures
- **WHEN** an incident has 3 failures 5 minutes apart and no later call
- **THEN** its strip is longer with separate marks, and reads "3 failed attempts over 10m, 5m apart on average, then no further call"

### Requirement: Show the whole summary on a narrow screen
The Errors summary SHALL show its date line, uncategorized share and four vitals at every width, two vitals to a row on a narrow screen, with no control that hides part of it. The date line SHALL NOT name the last ingest, and Where to start SHALL NOT repeat how often the app ingests: the navigation shows both.

#### Scenario: A phone
- **WHEN** the user opens Errors on a phone 390px wide
- **THEN** the summary shows the date line, the uncategorized share and all four vitals, two to a row, and no "More summary"

### Requirement: Word the page without contractions
The Errors page SHALL word its text without contractions, as the other pages do: "Could not", "did not", "cannot", "does not".

#### Scenario: A failed load
- **WHEN** the first request for errors fails
- **THEN** the message reads "Could not load errors."

### Requirement: Sort the four-column type table
The type table SHALL sort by Type (A to Z first), Errors, Rate, Time lost, Not recovered and Change, each a header button that Enter and Space also press. A header of two figures SHALL hold a button for each. The share bar orders as Errors does. The default is Errors, most first. A second press SHALL flip the direction. Only the sorted header SHALL carry `aria-sort`. Ties keep the default order; a "–" value SHALL come last either way.

#### Scenario: Sort by Not recovered
- **WHEN** the user selects the "Not recovered" button in the Time lost header
- **THEN** the types with the largest share of unrecovered incidents come first, a type with no incident comes last, and only the Time lost header has `aria-sort`

#### Scenario: Flip the direction
- **WHEN** the user selects the sorted button again
- **THEN** the order reverses, a type with no value is still last, and keyboard focus stays on the button

#### Scenario: No time lost
- **WHEN** the user sorts by Time lost, least first, and a type with no measurable time lost shows "–"
- **THEN** that type comes after the type that shows "1m"

#### Scenario: Keyboard
- **WHEN** the user focuses the Rate button and presses Enter, then Space
- **THEN** the table sorts by Rate, most first, then least first, and focus stays on the button

## MODIFIED Requirements

### Requirement: Narrow the lists to a chart bucket
The Errors page SHALL let the user select one day or week of the errors chart by click, or by Enter or Space on the chart's current point, and clear it the same way. A folded stretch without tool calls SHALL NOT be selectable. A selected bucket SHALL narrow the type table and the open type's detail to its errors; the summary, chart, rate trend and change stay range-wide. The table's hint SHALL name the figures that follow the bucket and those that do not.

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
- **THEN** the table's hint says that the types, Errors, Rate, the share, Time lost and Not recovered follow it, and Trend and Change stay range-wide

### Requirement: Count muted types as noise
A muted type SHALL count as noise, with `infra` and `user_denied`. The toggle in the type table's toolbar SHALL read "Hide noise and muted", keep its `fNoise` id and `noise` URL key, and have a toggletip that says what it leaves out. Wherever it leaves noise out, it SHALL leave muted types out: the error rate, the chart, the type table, the comparison with the period before and the uncategorized share.

#### Scenario: Toggle on
- **WHEN** `git` is muted and the page shows 6 failed tool calls, 2 of them `git`, and the user turns "Hide noise and muted" on
- **THEN** the page shows 4 failed tool calls, and the table has no `git` row

#### Scenario: Toggle off
- **WHEN** `git` is muted and "Hide noise and muted" is off
- **THEN** the `git` row shows with a "Muted" chip, dimmed, and its errors count in the rate

### Requirement: Settle a failed write by what the store holds
When a fix or mute write fails, the page SHALL read the store. If the store shows the write's effect, the write counts as saved: the saved announcement, no message. If it shows the write did not happen, the page SHALL say so beside the control and in the status region. If the read fails too, the page SHALL say it could not confirm the change, and assert nothing about the state.

#### Scenario: The answer is lost
- **WHEN** the store takes a mute and the answer is lost, with the toggle on
- **THEN** the type stays muted and hidden, the status region says "Type muted. It left the view: Hide noise and muted is on.", and no message shows

#### Scenario: Not confirmed
- **WHEN** a mute fails and the read of the store fails too
- **THEN** the message reads "Could not confirm the change to" the type's label, "Reload to see what the store holds.", and says neither "back in the list" nor "still muted"

### Requirement: Show each type's rate and share that did not recover
The type table SHALL show Rate: the type's errors per 100 tool calls in the view, with two decimals and "%", or "–" with no calls. Under Time lost it SHALL show the percent of the type's incidents whose outcome is not recovered ("37% not recovered"), with "N of M incidents" as text for a screen reader, or "–" with no incident. With a chart bucket selected, both SHALL count only that bucket's errors, and Rate SHALL use that bucket's calls.

#### Scenario: A bucket is selected
- **WHEN** the type has 2 errors on Mar 3 and 4 on Mar 4, there are 10 calls on each day, and the user selects Mar 3
- **THEN** the type's Rate reads 20.00%, not the range's 30.00%

## REMOVED Requirements

### Requirement: Sort the type table
**Reason**: The type table has four columns now: Rate and Errors share one header, Not recovered (no longer "Didn't recover") shares Time lost's, and Share is a bar under the count with no column.
**Migration**: Replaced by "Sort the four-column type table", which keeps the six sorts, the default, the flip and the "–" rule, and adds the keyboard.
