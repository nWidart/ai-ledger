# Spec Delta

## ADDED Requirements

### Requirement: Offer the growth chart as a table
Under the growth chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per turn the chart draws: the turn, the view's median context, its 25th and 75th percentile, its sessions, and the median of each project drawn separately. The table SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the growth chart, which draws two projects
- **THEN** a table lists each turn with the median, percentiles and sessions, and a column of medians for each project, and the button reads "Hide data table"

#### Scenario: A project's curve has ended
- **WHEN** a project's curve stops at turn 3 and the table shows turn 5
- **THEN** that project's cell for turn 5 reads as a dash

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Offer the weekly start chart as a table
Under the chart of the median starting context per week, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per week: the week's start, the median tokens and the sessions. The table SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the weeks
- **WHEN** the user selects "Show data table" under the weekly chart
- **THEN** a table lists every week with its median start and sessions

### Requirement: Dismiss the growth chart's reading with Escape
The growth chart SHALL be a focusable group named for its contents, SHALL read a turn with the arrow keys, Home and End, and SHALL clear that reading when the user presses Escape or leaves it.

#### Scenario: Escape
- **WHEN** the user reads a turn with the right arrow key and presses Escape
- **THEN** the turn's readout is cleared and focus stays on the chart
