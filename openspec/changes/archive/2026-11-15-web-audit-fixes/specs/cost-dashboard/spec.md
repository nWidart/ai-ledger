# Spec Delta

## ADDED Requirements

### Requirement: Offer the cost chart as a table
Under the cost and tokens chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a table of the chart's figures: one row per day, and one column for the day, one for each series in the current stacking (Project, Model or Agent, with Other) and one for the day's total, in the chart's units, with the table named for the chart. The table SHALL follow the stacking and the metric, SHALL be closed on every page load, and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the cost chart stacked by Model
- **THEN** a table lists each day with the cost of each model and the day's total, and the button reads "Hide data table"

#### Scenario: Follows the stacking
- **WHEN** the table is open and the user selects Agent
- **THEN** its columns become the agents, and each day's total is unchanged

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Give the unpriced chip text
The "+?" chip that marks a cost figure as leaving out unpriced requests SHALL carry text for screen readers that says how many requests came from unpriced models ("plus an unknown cost for 12 requests from unpriced models"), and SHALL show that count as its hover text.

#### Scenario: Screen reader
- **WHEN** a screen reader reads a project's cost that has 12 requests from unpriced models
- **THEN** it reads the cost, then that the cost leaves out 12 requests from unpriced models
