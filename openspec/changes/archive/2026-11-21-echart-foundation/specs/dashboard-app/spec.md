## ADDED Requirements

### Requirement: Keep a chart's space while it loads
A chart whose drawing code loads after the page SHALL hold its final height from its first render, so nothing under it moves when it draws. Its label, keyboard reading, live readout and data table SHALL work before it has drawn. The Cost daily chart is such a chart.

#### Scenario: First visit to Cost
- **WHEN** the user opens Cost for the first time and the chart's drawing code has not loaded yet
- **THEN** the chart's box is already at its final height, and the project table under it does not move when the bars appear

#### Scenario: Reading before the chart has drawn
- **WHEN** the chart has not drawn yet and the user focuses it and presses Right
- **THEN** the readout and the tooltip give the first day

### Requirement: Keep a chart readable when it cannot draw
When a chart's drawing code fails to load, the chart's box SHALL say that the chart could not be drawn and that the data table has its figures. The legend, the keyboard reading, the readout and the data table SHALL stay.

#### Scenario: Drawing code fails to load
- **WHEN** the request for the chart's drawing code fails
- **THEN** the chart's box says the chart could not be drawn, and "Show data table" still lists the chart's figures

### Requirement: Follow the theme in drawn charts
A drawn chart SHALL take its colors from the theme's color tokens, and SHALL redraw in the new colors when the user changes the theme or the operating system changes its color scheme, without a reload. A series SHALL have the color its legend key shows.

#### Scenario: Theme toggle
- **WHEN** the Cost chart is drawn in the light theme and the user selects the dark theme
- **THEN** the chart's bars, text, grid and average line take the dark theme's colors without a reload

#### Scenario: Operating system scheme
- **WHEN** the theme is System and the operating system switches to dark
- **THEN** the chart redraws in the dark theme's colors

#### Scenario: Legend match
- **WHEN** a project's legend key shows its project color
- **THEN** that project's segments in the chart are the same color

### Requirement: Use system colors in a drawn chart under forced colors
In a forced-colors mode, a chart drawn by the shared chart component SHALL draw its text, grid lines, reading mark and zoom control in system colors. Each colored bar segment SHALL keep its series color, since the color is the data, with an edge in the system text color. A chart not yet drawn by the shared chart component keeps its own forced-colors rules. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Cost chart in high contrast
- **WHEN** forced colors is on and the Cost chart is drawn
- **THEN** its axis labels are in the system text color, each segment keeps its series color inside a text-colored edge, and the day being read is marked in the system highlight color

#### Scenario: Turning forced colors on
- **WHEN** the user turns forced colors on while the Cost chart is shown
- **THEN** the chart redraws in system colors without a reload

### Requirement: Draw charts without animation under reduced motion
A drawn chart SHALL NOT animate when the user asks for reduced motion: it SHALL show its end state at once, on its first draw and on every update.

#### Scenario: Reduced motion
- **WHEN** the operating system asks for reduced motion and the Cost chart draws
- **THEN** the bars appear at their full height with no animation

## MODIFIED Requirements

### Requirement: Label an interactive chart as a group
The box of a chart that the user reads by keyboard, on Cost, Activity and Errors, SHALL be a `role="group"` with a label that says what the chart shows and how to read it, and SHALL NOT be `role="img"` or `role="application"`. Its live region for the keyboard reading SHALL stay. The drawing inside the box SHALL be hidden from assistive technology, which reads the label, the live region and the data table instead; the chart SHALL NOT expose a description generated from its series.

#### Scenario: Roles
- **WHEN** a screen reader reaches the Cost chart
- **THEN** it exposes a group with the chart's label, and the label names the stacking

#### Scenario: Drawing hidden
- **WHEN** a screen reader user moves through the Cost chart's group
- **THEN** it reads the label and the day being read, and none of the chart's drawn text or shapes
