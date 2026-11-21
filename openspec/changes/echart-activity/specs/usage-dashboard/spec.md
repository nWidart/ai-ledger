## ADDED Requirements

### Requirement: Zoom the work chart
In a view of 14 bars or more, by day or by week, the work chart SHALL show a zoom control under the bucket labels that narrows the bars the chart shows, down to 7. The control SHALL NOT show in a view of fewer bars. Both tracks SHALL keep the scales of the whole view while zoomed. The zoom SHALL return to every bar when the view or the measure changes. A view is a range with its first bar, the bucket, a project, a source and the automated-sessions filter.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, with the bars and the rate line on the same scales as before

#### Scenario: Few bars
- **WHEN** the chart shows 11 weeks
- **THEN** no zoom control shows

#### Scenario: Many weeks
- **WHEN** the chart shows 30 weeks
- **THEN** the zoom control shows, and narrows the chart down to 7 weeks

#### Scenario: Measure change
- **WHEN** the chart is zoomed and the user chooses Prompts
- **THEN** the chart shows every bar

#### Scenario: The range moves on a day
- **WHEN** the chart is zoomed in a 30-day view, and at midnight the view's first bar becomes the next day
- **THEN** the chart shows every bar of the new view

### Requirement: Keep the work chart's zoom and reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the work chart SHALL draw it and SHALL keep the bars shown, the "Show all" button with any focus on it, and the bar being read. Selecting or clearing a bar SHALL keep the bars shown too. The polite status SHALL say nothing for such a redraw. Only a bar the keyboard is reading SHALL be said again, alone, when its words changed.

#### Scenario: Ingest while zoomed
- **WHEN** the chart shows Oct 11 to Oct 20 of a 30-day view and an ingest adds a commit to today
- **THEN** the chart still shows Oct 11 to Oct 20, and the status says nothing

#### Scenario: Ingest while reading
- **WHEN** the user is reading Oct 13 with the arrow keys and an ingest adds a commit to today
- **THEN** Oct 13 is still read, with its tooltip, and the status does not repeat it

#### Scenario: Today read by keyboard
- **WHEN** the user reads today with the arrow keys and an ingest adds a commit to today
- **THEN** the tooltip shows the new count and the status says the day again with it

#### Scenario: Select while zoomed
- **WHEN** the chart shows Oct 11 to Oct 20 and the user selects Oct 15
- **THEN** the tabs narrow to Oct 15 and the chart still shows Oct 11 to Oct 20

### Requirement: Keep the view and the selection unchanged while zoomed
Zooming the work chart SHALL NOT change the page's time range, the URL, the data requested, the page's figures, the selected day or week, the tabs, the chart's accessible name or the chart's data table.

#### Scenario: Zoomed page
- **WHEN** the user zooms the chart to ten days of a 30-day view
- **THEN** the heading, the vitals, the tabs and the URL still describe 30 days, no request is made, and the data table lists 30 days

#### Scenario: Selection outside the bars shown
- **WHEN** Oct 3 is selected and the user zooms the chart to Oct 11 to Oct 20
- **THEN** the chip still names Oct 3 and the tabs still show Oct 3

### Requirement: Zoom and reset the work chart by keyboard
With the chart focused and its zoom control available, the plus key SHALL halve the bars shown, rounding up and stopping at 7, and the minus key SHALL double them up to the full view, both around the bar read or, when none, the newest. While zoomed, a "Show all days" button, or "Show all weeks" on a chart by week, SHALL reset it. A polite status SHALL say the bars shown after each change. The arrow keys, Home and End SHALL still reach every bar, moving the bars shown to include the bar read.

#### Scenario: Zoom in by keyboard
- **WHEN** the chart shows 30 days, the user reads Oct 20 and presses plus
- **THEN** the chart shows 15 days that include Oct 20, and the status says which days are shown, as "Showing Oct 11 to Oct 25, 15 of 30 days."

#### Scenario: Weeks
- **WHEN** a chart of 20 weeks is zoomed to the weeks of Oct 5 to Nov 9
- **THEN** the status says "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks.", and the reset button reads "Show all weeks"

#### Scenario: Reset
- **WHEN** the chart is zoomed and the user selects "Show all days"
- **THEN** the chart shows every day, the button goes away, and focus is on the chart

#### Scenario: Reading past the zoom
- **WHEN** the chart shows Oct 11 to Oct 20 and the user presses End
- **THEN** the last day of the view is read, the days shown move to include it, and the status says the day and then the days shown

#### Scenario: Browser zoom
- **WHEN** the chart has focus and the user presses Ctrl and plus
- **THEN** the chart's zoom does not change and the browser zooms the page

### Requirement: Mark the selected bar on the work chart
While a day or a week is selected and the chart has its bar, the chart SHALL mark that bar with a tinted, framed band across both tracks, under the bars. The mark SHALL stay while other bars are read and when newer data arrives. A selection that the chart has no bar for, or that the zoom leaves out, SHALL mark no bar, and the chip SHALL still name it.

#### Scenario: Selected day
- **WHEN** the user selects Nov 4
- **THEN** Nov 4 has a framed band from the top of the bars to the bottom of the rate track, and it stays while the user reads other days

#### Scenario: A week on a chart by day
- **WHEN** a link names the week of Nov 2 and the chart is by day
- **THEN** the chip reads "Week of Nov 2" and no bar is marked

#### Scenario: Zoomed away
- **WHEN** Nov 4 is selected and the chart is zoomed to Nov 10 to Nov 20
- **THEN** no bar is marked and the chip still reads "Nov 4"

### Requirement: Say what a work chart selection did
After a selection by a click or Enter, a polite status SHALL say once the bucket selected and what the tabs now show. After a clear by the chip or by Escape, it SHALL say once that the tabs show the whole range. A reading SHALL replace the sentence, and the end of that reading SHALL NOT say it again. Opening a page with a selection in the URL SHALL say nothing.

#### Scenario: Select a week
- **WHEN** the user presses Enter on the week of Sep 7
- **THEN** the reading ends and the status says "Week of Sep 7, 2026 selected; the tabs below show its days."

#### Scenario: Clear with Escape
- **WHEN** a day is selected, no bar is read and the user presses Escape on the chart
- **THEN** the status says "Selection cleared; the tabs below show the whole range."

#### Scenario: A reading after a selection
- **WHEN** the user selects a day, reads another bar and presses Escape
- **THEN** the status is empty: the selection sentence is not said a second time

#### Scenario: A link with a selection
- **WHEN** the user opens a link with `day=2026-11-04`
- **THEN** the chip names Nov 4 and the status says nothing

### Requirement: Keep the work chart's bars their height at a larger text size
The bars track SHALL keep its height at every browser text size up to 200%. The chart's box SHALL grow by the room that its labels and the rate track need at that size.

#### Scenario: Default text size
- **WHEN** the browser's default font size is 16px and the view has fewer than 14 bars
- **THEN** the chart's box is 216px tall

#### Scenario: 200% text
- **WHEN** the browser's default font size is 32px
- **THEN** the bars track is as tall as at 16px, the rate track is twice as tall, and no label overlaps another

## MODIFIED Requirements

### Requirement: Draw work and errors on two tracks
The work chart SHALL draw its bars on a top track and errors per 100 tool calls on a thin track under it, sharing one x-axis. The rate track SHALL have its own scale on the left and no right-hand axis. One hover, tooltip and keyboard reading SHALL cover both tracks, and a view with no tool calls SHALL show no rate track or legend entry. In such a view the bars SHALL use the rate track's room.

#### Scenario: Two tracks
- **WHEN** the user opens Activity for a view with tool calls
- **THEN** the bars and the rate line sit on separate tracks under one row of bucket labels, and reading a bucket by keyboard gives its count and its errors per 100 calls

#### Scenario: No tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart shows the bars only, with no rate track and no rate legend entry

#### Scenario: Bars in a view without tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart's box is as tall as with a rate track, and the bars reach down to the bucket labels
