## ADDED Requirements

### Requirement: Read the tracks of a drawn chart as one point
A chart drawn by the shared chart component with two tracks or more over one axis SHALL have one reading. The point being read SHALL be one band across every track and the space between them. One tooltip and one live sentence SHALL give that point's figures on every track. The pointer SHALL read the point under it anywhere in the tracks or between them, and nothing outside them.

#### Scenario: Pointer over the lower track
- **WHEN** the pointer is over Nov 4 on the work chart's rate track
- **THEN** one band covers Nov 4 from the top of the bars to the bottom of the rate track, and the tooltip gives Nov 4's commits and its errors per 100 calls

#### Scenario: Pointer between the tracks
- **WHEN** the pointer is in the space between the bars and the rate track, over Nov 4
- **THEN** Nov 4 is read, with the same band and tooltip

#### Scenario: Keys and pointer agree
- **WHEN** the user reads the tenth bar with the arrow keys, and later moves the pointer over it
- **THEN** the band is in the same place both times, and the tooltip and the live sentence name the same bar

#### Scenario: Pointer over the bucket labels
- **WHEN** the pointer is over the bucket labels under the tracks
- **THEN** no bar is read and no band shows

### Requirement: Zoom the tracks of a drawn chart together
In a chart drawn by the shared chart component with two tracks or more, a zoom SHALL show the same points on every track, each point at the same place across the tracks. The band, the tooltip and the live sentence SHALL stay on the point being read after a zoom.

#### Scenario: Zoomed work chart
- **WHEN** the work chart is zoomed to Oct 11 to Oct 20
- **THEN** the bars and the rate line both show those ten days, and Oct 15's rate point is under Oct 15's bar

#### Scenario: Reading while zoomed
- **WHEN** the user reads Oct 15 and presses plus
- **THEN** the band is over Oct 15 at its new place on both tracks

### Requirement: Mark the selected point of a drawn chart
A chart drawn by the shared chart component that keeps a selection SHALL mark the selected point with a tinted band in a frame, across every track and under the marks. The mark SHALL stay while other points are read. The band over the point being read SHALL have no frame. In a forced-colors mode the frame SHALL be in the system highlight color with no tint. A selected point that the zoom leaves out SHALL have no mark.

#### Scenario: Selected and read
- **WHEN** Nov 4 is selected on the work chart and the user reads Nov 7
- **THEN** Nov 4 has a framed band and Nov 7 has a band without a frame

#### Scenario: Reading the selected point
- **WHEN** Nov 4 is selected and the user reads Nov 4
- **THEN** Nov 4 shows its frame and the reading band over it

#### Scenario: Forced colors
- **WHEN** forced colors is on and Nov 4 is selected
- **THEN** Nov 4 has a frame in the system highlight color and no tint, and the bar being read has a highlight-colored band without a frame

#### Scenario: Zoomed away
- **WHEN** Nov 4 is selected and the chart is zoomed to days after it
- **THEN** no bar is marked

### Requirement: Draw a lone line in the system text color under forced colors
In a forced-colors mode, a chart drawn by the shared chart component SHALL draw a line that is the only line on its track in the system text color. A dot on that line SHALL be in the system text color too. A hollow dot SHALL have a page-colored center in a text-colored ring.

#### Scenario: Work chart's rate line in high contrast
- **WHEN** forced colors is on and the work chart is drawn
- **THEN** the rate line is in the system text color, and a hollow dot on it has a page-colored center in a text-colored ring

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the work chart is shown
- **THEN** the rate line takes the theme's error color again, without a reload

## MODIFIED Requirements

### Requirement: Keep a chart's space while it loads
A chart whose drawing code loads after the page SHALL hold its final height from its first render, so nothing under it moves when it draws. Its label, keyboard reading, live readout and data table SHALL work before it has drawn. The Cost daily chart, the Activity work chart and the outcome trend are such charts.

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

### Requirement: Dismiss a chart tooltip with Escape
Escape SHALL dismiss the open tooltip of the Cost, Activity work, outcome trend and Errors rate charts, whether the pointer or the keyboard reading opened it, without closing a sheet or the palette and without changing the selected bucket.

#### Scenario: Escape on a hovered bar
- **WHEN** the tooltip of a Cost bar is open and the user presses Escape
- **THEN** the tooltip closes and the selected day is unchanged

#### Scenario: Escape with a sheet open
- **WHEN** a sheet is open and no chart tooltip is
- **THEN** Escape closes the sheet, as before

#### Scenario: Escape on a hovered week of the outcome trend
- **WHEN** the pointer opened the tooltip of a week on the outcome trend, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes
