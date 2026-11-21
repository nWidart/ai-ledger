## ADDED Requirements

### Requirement: Zoom the daily chart
In a view of 14 days or more, the daily chart SHALL show a zoom control under the plot that narrows the days the chart shows, down to 7 days. The control SHALL NOT show in a shorter view. The value axis SHALL keep the scale of the whole view while zoomed. The zoom SHALL return to every day when the view, the metric, the scale or the stacking changes.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, on the same value axis

#### Scenario: Short view
- **WHEN** the view covers 7 days
- **THEN** no zoom control shows

#### Scenario: View change
- **WHEN** the chart is zoomed and the user changes the range
- **THEN** the chart shows every day of the new view

### Requirement: Keep the view unchanged while zoomed
Zooming the daily chart SHALL NOT change the page's time range, the URL, the data requested, the page's totals, the chart's accessible name or the chart's data table. The 7-day average of a day SHALL be the same zoomed or not.

#### Scenario: Zoomed page
- **WHEN** the user zooms the chart to ten days of a 30-day view
- **THEN** the heading, the project table and the URL still describe 30 days, no request is made, and the data table lists 30 days

#### Scenario: Average at the edge of the zoom
- **WHEN** the zoom starts at Oct 11
- **THEN** the average at Oct 11 is the mean of Oct 5 to Oct 11, as without zoom

### Requirement: Zoom and reset the daily chart by keyboard
With the chart focused, the plus key SHALL halve the days shown and the minus key SHALL double them, around the day being read, or around the newest day when none is read. While the chart is zoomed, a "Show all days" button beside the legend SHALL reset it. A polite status SHALL say the days shown after each change. The arrow keys, Home and End SHALL still reach every day of the view, and the days shown SHALL move to include the day being read.

#### Scenario: Zoom in by keyboard
- **WHEN** the chart shows 30 days, the user reads Oct 20 and presses plus
- **THEN** the chart shows 15 days that include Oct 20, and the status says which days are shown

#### Scenario: Reset
- **WHEN** the chart is zoomed and the user selects "Show all days"
- **THEN** the chart shows every day, the button goes away, and focus is on the chart

#### Scenario: Reading past the zoom
- **WHEN** the chart shows Oct 11 to Oct 20 and the user presses End
- **THEN** the last day of the view is read, and the days shown move to include it

#### Scenario: Browser zoom
- **WHEN** the chart has focus and the user presses Ctrl and plus
- **THEN** the chart's zoom does not change and the browser zooms the page
