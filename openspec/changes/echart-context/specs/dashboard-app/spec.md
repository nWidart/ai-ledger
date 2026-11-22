## MODIFIED Requirements

### Requirement: Dismiss a chart tooltip with Escape
Escape SHALL dismiss the open tooltip of the Cost, cost flow, Activity work, outcome trend, Errors rate and session plot charts, and of Context's cache, growth, weekly start and session map charts, whether the pointer or the keyboard reading opened it, without closing a sheet or the palette and without changing the selected bucket.

#### Scenario: Escape on a hovered bar
- **WHEN** the tooltip of a Cost bar is open and the user presses Escape
- **THEN** the tooltip closes and the selected day is unchanged

#### Scenario: Escape with a sheet open
- **WHEN** a sheet is open and no chart tooltip is
- **THEN** Escape closes the sheet, as before

#### Scenario: Escape on a hovered week of the outcome trend
- **WHEN** the pointer opened the tooltip of a week on the outcome trend, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes

#### Scenario: Escape on a hovered turn of the growth chart
- **WHEN** the pointer opened the tooltip of a turn on Context's growth chart, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes

#### Scenario: Escape on a hovered session of the map
- **WHEN** the pointer opened the tooltip of a session on Context's session map, a quadrant is selected, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes and the quadrant stays selected

### Requirement: Keep a chart's space while it loads
A chart whose drawing code loads after the page SHALL hold its final height from its first render, so nothing under it moves when it draws. Its label, keyboard reading, live readout and data table SHALL work before it has drawn. The Cost daily chart, the cost flow, the Activity work chart, the outcome trend, the Errors rate chart, the Activity calendar, the session plot, and Context's cache, growth, weekly start and session map charts are such charts.

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

#### Scenario: First visit to Context
- **WHEN** the user opens Context's Cache health tab for the first time and the chart's drawing code has not loaded yet
- **THEN** the cache chart's box is already at its final height, and the caption and the table under it do not move when the bars appear

#### Scenario: Reading the session map before it has drawn
- **WHEN** Context's session map has not drawn yet and the user focuses it and presses Right
- **THEN** the oldest session is read, with its ring and its tooltip where its dot will be
