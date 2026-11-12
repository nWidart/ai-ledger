# errors-dashboard Specification

## Purpose
The Errors page: failed tool calls of every coding agent by type, with fixes. This spec covers how failures group into incidents and how the page compares error rates.

## Requirements

### Requirement: Group failures into incidents
The Errors page SHALL group failed tool calls into incidents, each a retry loop of one agent: failures of one tool by one agent (the main thread or one subagent) with one error type, each starting at most 10 minutes after the previous one ended, with at most 2 successful calls of that tool by that agent in between.

#### Scenario: Retry after a check
- **WHEN** a subagent's `Bash` call fails, one `Bash` call succeeds, and the same `Bash` error follows two minutes later
- **THEN** both failures are one incident with 1 successful call in between

#### Scenario: The agent moved on
- **WHEN** 3 successful `Bash` calls come between two failures of the same type by one agent
- **THEN** the failures are two incidents

#### Scenario: Two subagents
- **WHEN** two subagents of one session each fail `Bash` with the same error a minute apart
- **THEN** the failures are two incidents

### Requirement: Say how an incident ended
An incident's outcome SHALL be what its agent's next call of the tool, started after the incident's last failure ended, did: recovered if it succeeded, failed again if it failed, given up if there was none.

#### Scenario: Parallel call
- **WHEN** a `Bash` call starts before an incident's last failure ended and succeeds, and no later `Bash` call follows
- **THEN** the incident is given up, not recovered

### Requirement: Compare error rates one way
The Errors page SHALL compare error rates the same way in the summary, the type table and Rising fastest: a range against the same number of days just before it; all time, the calls before and since the day that splits its calls in half. It SHALL show no change when either side has fewer than 200 tool calls, and say why. A type with fewer than 5 errors on either side SHALL show its counts instead of a percent.

#### Scenario: Thin start
- **WHEN** the store holds 11 tool calls in June and thousands from late September on, and the user picks All
- **THEN** the halves split inside the busy period, and no type reads as new because of June

#### Scenario: No calls before the range
- **WHEN** the 7 days before the range hold no tool calls
- **THEN** Change shows "–" with "Fewer than 200 tool calls in the 7 days before"

#### Scenario: Few errors
- **WHEN** a type had 2 errors in the previous 30 days and 9 in this range
- **THEN** the table shows "2 → 9"

### Requirement: Narrow the lists to a chart bucket
The Errors page SHALL let the user select one day or week of the errors chart by click, or by Enter or Space on the chart's current point, and clear it the same way. A folded stretch without tool calls SHALL NOT be selectable. A selected bucket SHALL narrow the type table and the open type's detail to its errors, while the summary, chart, rate trend and change stay range-wide and the table says so.

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

### Requirement: Keep the selected bucket in the view
The selected bucket SHALL be part of the URL view and push a history entry, and SHALL NOT be saved with the last view. The chart SHALL mark it beyond color and name it for assistive tech, and a chip by the type table SHALL name it and clear it. The selection SHALL clear when it is no longer a selectable point of the chart the view draws. An open type with no errors in the bucket SHALL close unless an example is linked.

#### Scenario: Granularity changes
- **WHEN** a day is selected and the user switches to weeks
- **THEN** the selection clears

#### Scenario: Filter moves the chart's start
- **WHEN** a day is selected and the user picks a project whose first tool call is later than that day
- **THEN** the selection clears, so the marker and the lists never disagree

#### Scenario: Linked example outside the bucket
- **WHEN** a link opens an example that falls outside the selected bucket
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the bucket

### Requirement: Show the uncategorized share
The Errors summary SHALL show the share of the view's errors in the catch-all types (Other, Other non-zero exit and MCP tool error), which are the errors no specific rule matched, with a title that says so. When the view is not filtered to one source and more than one source has errors, the line SHALL split the share by source. It SHALL show nothing when the view has no errors.

#### Scenario: Share shows
- **WHEN** the view has errors, and 12 of 100 of them are of catch-all types
- **THEN** the summary shows "Uncategorized: 12% of errors", titled with the catch-all types and what they mean

#### Scenario: Split by source
- **WHEN** the view has no source filter and both Claude Code and Codex have errors in it
- **THEN** the line adds each source's share in parentheses, such as "(Claude Code 9%, Codex 31%)"
- **AND** a view filtered to one source shows the share alone

### Requirement: State each type's time lost
The Errors page SHALL state each error type's time lost: the sum, over the view's incidents of that type, of each incident's span, from its first failure's start to its last failure's end. An incident SHALL count whole when at least one of its failures is in the view. A type whose incidents have no measurable span SHALL show no time. The page SHALL rank the open types that have a ready-made fix by time lost, most first, then by error count, and show each one's time lost.

#### Scenario: Fewer errors, more time lost
- **WHEN** one open type has 3 errors in two incidents of 10 minutes each, and another has 4 errors in one incident of 1 minute
- **THEN** Where to start lists the first type above the second, and the type table shows 20 min and 1 min

#### Scenario: Equal time lost
- **WHEN** two open types lost the same time
- **THEN** the one with more errors is listed first

#### Scenario: Incident partly outside the view
- **WHEN** an incident's first failure is before the range and its last failure is inside it
- **THEN** the incident's whole span counts toward its type's time lost

#### Scenario: No measurable span
- **WHEN** a type's only incident is one failure with no recorded duration
- **THEN** its time lost reads "–"

### Requirement: Break a type down by tool and agent
The open type's detail SHALL list, next to By project, the type's top five tools (By tool) and top five agents (By agent), each with its error count and share of the type's errors in the detail, and fold the rest into "N more: M errors". A By agent row SHALL set the page's source filter. By agent SHALL be hidden under a source filter and when the type's errors come from one agent only.

#### Scenario: Top tools and agents
- **WHEN** a type's errors come from Edit and Bash, by Claude Code and Codex
- **THEN** By tool lists Edit and Bash and By agent lists Claude Code and Codex, each with count and share

#### Scenario: One agent
- **WHEN** all of a type's errors come from one agent
- **THEN** By agent is not shown

#### Scenario: Filter to an agent
- **WHEN** the user clicks a By agent row
- **THEN** the page's source filter is that agent and By agent is hidden

### Requirement: Narrow the type detail to a tool
A By tool row SHALL narrow the open type's detail, and only it, to the errors of that tool, on top of a selected chart bucket: the incident sentence, By project, By agent, and the incidents and examples with their counts. The summary, chart and type table SHALL NOT change. The selected row SHALL stay listed and pressed, and a click on it or on a chip naming the tool SHALL clear the selection.

#### Scenario: Select a tool
- **WHEN** the user clicks a tool in By tool
- **THEN** the detail counts only that tool's errors, the row is pressed, a chip names the tool, and the type table is unchanged

#### Scenario: Selected tool below the top five
- **WHEN** a link selects a tool that ranks sixth or lower in the type
- **THEN** its row is listed after the top five, pressed, and the fold counts the other rows

#### Scenario: One tool
- **WHEN** a type's errors come from one tool only and none is selected
- **THEN** By tool is not shown

#### Scenario: Clear
- **WHEN** the user clicks the pressed row or the chip
- **THEN** the detail returns to all tools and focus stays on a control that still exists

### Requirement: Keep the selected tool in the view
The selected tool SHALL be part of the URL view under `etool`, push a history entry, and SHALL NOT be saved with the last view. It SHALL clear when the type closes, another type opens, or the open type has no error of that tool in the view. Opening a type from the command palette SHALL clear it too. A linked example of another tool SHALL show under "Outside current filters", Clear filters SHALL also clear the tool, and an example's permalink SHALL leave it out.

#### Scenario: Another type opens
- **WHEN** a tool is selected and the user opens another type
- **THEN** the tool selection is cleared

#### Scenario: Linked example of another tool
- **WHEN** a link opens an example of a tool other than the selected one
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the tool
