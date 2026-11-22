## ADDED Requirements

### Requirement: Zoom the rate chart
In a view of 14 chart points or more, by day or by week, the rate chart SHALL show a zoom control under the bucket labels that narrows the points the chart shows, down to 7. A folded stretch is one point. The control SHALL NOT show in a view of fewer points. Both panels SHALL keep the scales of the whole view while zoomed. The zoom SHALL return to every point when the view changes: the range with its first point, the granularity, the project, the source or a toggle.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, with the rate line and the bars on the same scales as before

#### Scenario: Few points
- **WHEN** the chart shows 11 weeks
- **THEN** no zoom control shows

#### Scenario: Granularity change
- **WHEN** the chart is zoomed by day and the user selects Week
- **THEN** the chart shows every week

#### Scenario: Both panels
- **WHEN** the chart is zoomed to Oct 11 to Oct 20
- **THEN** the rate line and the bars both show those ten days, and Oct 15's rate point is over Oct 15's bar

### Requirement: Zoom the rate chart from the keyboard
With the rate chart focused in a view that shows the zoom control, plus (or `=`) SHALL halve the points shown, around the point being read or the newest, and minus SHALL double them. A "Show all days" or "Show all weeks" button SHALL show while the chart is zoomed, show every point again and return the focus to the chart. The chart's polite status SHALL say the days or weeks shown after each change, a folded stretch counting every day or week it stands for.

#### Scenario: Plus
- **WHEN** the chart shows 30 days, the user reads Oct 15 and presses plus
- **THEN** the chart shows 15 days around Oct 15, and the status says the days shown, such as "Showing Oct 8 to Oct 22, 15 of 30 days."

#### Scenario: Show all
- **WHEN** the chart is zoomed and the user selects "Show all days"
- **THEN** every day shows, the status says "Showing all 30 days.", the button goes and the focus is on the chart

#### Scenario: A reading outside the days shown
- **WHEN** the chart is zoomed to Oct 11 to Oct 20 and the user presses Home
- **THEN** the first day is read, and the days shown move to include it

#### Scenario: No zoom control
- **WHEN** the chart shows 11 weeks and the user presses plus
- **THEN** nothing changes, and the chart's label names no zoom keys

### Requirement: Keep the view apart from the rate chart's zoom
Zooming the rate chart SHALL NOT change the URL, the summary, the type table, the open type, the selected bucket or the chart's data table, and SHALL make no request. A fix marker, a no-activity band or a selected bucket outside the points shown SHALL NOT be drawn; the chip by the type table and the chart's label SHALL still name the selected bucket. Selecting or clearing a bucket, and opening or closing a type, SHALL keep the points shown.

#### Scenario: Zoom leaves the page alone
- **WHEN** the user zooms the chart to ten days
- **THEN** the URL, the heading, the type table and the data table under the chart are unchanged, and no request is made

#### Scenario: Selected bucket zoomed away
- **WHEN** Nov 3 is selected and the chart is zoomed to days after it
- **THEN** no bucket is framed, and the chip by the type table still names Nov 3

#### Scenario: Selecting while zoomed
- **WHEN** the chart is zoomed and the user clicks a day's bar
- **THEN** the day is selected and the chart shows the same days

#### Scenario: A type while zoomed
- **WHEN** the chart is zoomed and the user selects a type in the legend
- **THEN** the type opens, its rate line is drawn, and the chart shows the same days

### Requirement: Keep the rate chart's reading and zoom through newer data
When newer data arrives for the same view, as after an ingest in the background, or a fix marker is saved, the rate chart SHALL draw it and keep the points shown and the point being read. Its polite status SHALL say nothing for such a redraw; only a point the keyboard is reading SHALL be said again, alone, when its words changed. When the newer data moves the chart's first point or a folded stretch, the reading SHALL end and every point SHALL show.

#### Scenario: Ingest while reading
- **WHEN** the user reads Nov 4 with the arrow keys and an ingest adds a failed call to today
- **THEN** Nov 4 is still read, with its tooltip, and nothing is said

#### Scenario: A fix marker is saved
- **WHEN** the pointer rests on a day and a fix marker's write is answered
- **THEN** the day's tooltip stays open

#### Scenario: The points move
- **WHEN** the user reads Nov 4 and an ingest adds a tool call on a day before the chart's first day
- **THEN** the reading ends, every point shows, and a selected Nov 4 is still selected and framed

### Requirement: Say once what a selection on the rate chart did
After a click, Enter or Space on a chart point, the rate chart's polite status SHALL say once what it did: that the bucket is selected and the table and detail show only its errors, that the selection is cleared, or that a stretch without tool calls cannot be selected. The point SHALL stay the point being read, with its tooltip, so the same key clears the selection. The sentence SHALL stay when the reading ends. A selection changed from outside the chart SHALL NOT be said there.

#### Scenario: Select by key
- **WHEN** the user reads Nov 4 with the arrow keys and presses Enter
- **THEN** Nov 4 is selected, the status says "Selected Nov 4, 2026: the table and detail show only its errors." alone, and Nov 4's tooltip stays open

#### Scenario: Clear by the same key
- **WHEN** Nov 4 was just selected by Enter and the user presses Space
- **THEN** the selection clears and the status says "Selection cleared: the table and detail cover the whole range."

#### Scenario: Selecting closes the open type
- **WHEN** a type with no errors on Nov 4 is open, and the user reads Nov 4 and presses Enter, then Space
- **THEN** Nov 4 is selected and the type closes, then the selection clears

#### Scenario: The pointer leaves after a click
- **WHEN** the user clicks Nov 4's bar and at once moves the pointer off the chart
- **THEN** Nov 4 is selected, and the status says "Selected Nov 4, 2026: the table and detail show only its errors." once and still holds it

#### Scenario: Cleared by the chip
- **WHEN** Nov 4 is selected and the user clears it with the chip by the type table
- **THEN** the chart's status says nothing

### Requirement: Keep the rate chart's marks inside the plot
A fix marker's label SHALL sit beside its line inside the plot: right of the line, or left of it when it would pass the plot's right edge, and SHALL be left out when neither side has room or its row ends under the plot; its line stays. Labels of fixes marked on one bucket SHALL sit one under the other. The "no activity" label SHALL show only in a band wide enough for its text. A panel's title wider than the plot SHALL be cut with an ellipsis. Each SHALL hold in a 343px box and at 200% text.

#### Scenario: A fix on the newest day
- **WHEN** a fix is marked on the chart's newest day
- **THEN** its label is left of its line and ends inside the plot

#### Scenario: Two fixes on one day
- **WHEN** two types have a fix marked on Nov 4
- **THEN** both labels show beside Nov 4's line, one under the other

#### Scenario: Twelve fixes on one day
- **WHEN** twelve types have a fix marked on Nov 4 and the text is at 200%
- **THEN** Nov 4 has twelve dashed lines, and no label ends under the plot

#### Scenario: A narrow band
- **WHEN** one day has no activity in a 30-day view on a phone
- **THEN** its band is drawn with no "no activity" label, and the legend still has the "No activity" key

#### Scenario: A long title on a phone
- **WHEN** a type with a long name is selected and the chart box is 343px wide
- **THEN** the rate panel's title ends with an ellipsis inside the plot

#### Scenario: The page's font arrives after the chart
- **WHEN** the chart box is 343px wide, the text is at 200%, and the page's web font loads after the chart has drawn
- **THEN** with no action from the user, the bars panel's title ends inside the plot in that font

### Requirement: Keep the rate chart's panels at their height at every text size
The rate chart's box SHALL grow with the browser's text size: the room for its labels and titles grows, and the rate panel and the bars panel keep their heights. Each point SHALL sit at the same place on both panels at every box width and text size.

#### Scenario: Large text
- **WHEN** the browser's default font size is 32px
- **THEN** the chart's box is taller than at 16px, the bars panel is as tall as at 16px, and the band over a point covers its rate point and its bar

#### Scenario: Phone width
- **WHEN** the chart shows 11 weeks in a 343px box
- **THEN** the newest week's rate point is over the middle of its bar, and its label ends inside the plot

### Requirement: Draw the rate chart's marks in system colors under forced colors
In a forced-colors mode the rate chart SHALL draw its rate line, the line's dots and the fix markers in the system text color, and a no-activity band as a dashed frame with no fill. A hollow dot SHALL keep a page-colored center in a text-colored ring. Each bar segment SHALL keep its type color inside a text-colored edge. The selected bucket SHALL have a frame in the system highlight color with no tint, and the point being read a highlight-colored band with no frame.

#### Scenario: High contrast
- **WHEN** forced colors is on, Nov 3 is selected and the user reads Nov 5
- **THEN** Nov 3 has a highlight-colored frame, Nov 5 a highlight-colored band without a frame, and the rate line is in the system text color

#### Scenario: A fix marker in high contrast
- **WHEN** forced colors is on and a fix is marked on Nov 4
- **THEN** its dashed line and its label are in the system text color

#### Scenario: A type selected in high contrast
- **WHEN** forced colors is on and the user selects a type in the legend
- **THEN** the other types' bar segments are faint, each inside a whole text-colored edge
