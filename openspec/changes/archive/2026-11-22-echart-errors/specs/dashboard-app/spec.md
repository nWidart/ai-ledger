## MODIFIED Requirements

### Requirement: Keep a chart's space while it loads
A chart whose drawing code loads after the page SHALL hold its final height from its first render, so nothing under it moves when it draws. Its label, keyboard reading, live readout and data table SHALL work before it has drawn. The Cost daily chart, the Activity work chart, the outcome trend and the Errors rate chart are such charts.

#### Scenario: First visit to Cost
- **WHEN** the user opens Cost for the first time and the chart's drawing code has not loaded yet
- **THEN** the chart's box is already at its final height, and the project table under it does not move when the bars appear

#### Scenario: Reading before the chart has drawn
- **WHEN** the chart has not drawn yet and the user focuses it and presses Right
- **THEN** the readout and the tooltip give the first day

#### Scenario: First visit to Activity
- **WHEN** the user opens Activity for the first time and the chart's drawing code has not loaded yet
- **THEN** the work chart's box is already at its final height, and the vitals and the tabs under it do not move when the bars appear

#### Scenario: Selecting before the work chart has drawn
- **WHEN** the work chart has not drawn yet and the user focuses it, presses Right and Enter on a busy day
- **THEN** that day is selected and the tabs narrow to it

#### Scenario: First visit to Errors
- **WHEN** the user opens Errors for the first time and the chart's drawing code has not loaded yet
- **THEN** the rate chart's box is already at its final height, and the type table under it does not move when the bars appear

#### Scenario: Selecting before the rate chart has drawn
- **WHEN** the rate chart has not drawn yet and the user focuses it, presses Right and Space
- **THEN** that bucket is selected and the type table narrows to it
