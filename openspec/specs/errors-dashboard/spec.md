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

#### Scenario: Keyboard
- **WHEN** the user reads a point with the arrow keys and presses Enter, then Space
- **THEN** the point is selected, then cleared

#### Scenario: Folded stretch
- **WHEN** the current point is a folded stretch without tool calls and the user presses Enter
- **THEN** nothing is selected and the page says it cannot be

### Requirement: Keep the selected bucket in the view
The selected bucket SHALL be part of the URL view and push a history entry, and SHALL NOT be saved with the last view. The chart SHALL mark it beyond color and name it for assistive tech, and a chip by the type table SHALL name it and clear it. The selection SHALL clear when the view no longer has that bucket. An open type with no errors in the bucket SHALL close unless an example is linked.

#### Scenario: Granularity changes
- **WHEN** a day is selected and the user switches to weeks
- **THEN** the selection clears

#### Scenario: Linked example outside the bucket
- **WHEN** a link opens an example that falls outside the selected bucket
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the bucket
