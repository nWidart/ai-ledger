# Spec Delta

## ADDED Requirements

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
