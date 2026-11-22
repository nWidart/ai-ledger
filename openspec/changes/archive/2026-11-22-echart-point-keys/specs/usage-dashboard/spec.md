## MODIFIED Requirements

### Requirement: Zoom the work chart
In a view of 14 bars or more, by day or by week, the work chart SHALL show a zoom control under the bucket labels that narrows the bars the chart shows, down to 7. The control SHALL NOT show in a view of fewer bars. Both tracks SHALL keep the scales of the whole view while zoomed. The zoom SHALL return to every bar when the view or the measure changes. A view is a range, the bucket, a project, a source and the automated-sessions filter.

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

#### Scenario: Bucket change
- **WHEN** the chart is zoomed by day, and a longer history makes it draw one bar per week
- **THEN** the chart shows every week, and nothing is read

#### Scenario: The range moves on a day
- **WHEN** the chart shows Oct 11 to Oct 20 of a 30-day view, and at midnight the view's first bar becomes the next day
- **THEN** the chart still shows Oct 11 to Oct 20, and "Show all days" stays

### Requirement: Keep the work chart's zoom and reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the work chart SHALL draw it and SHALL keep the bars shown, the "Show all" button with any focus on it, and the bar being read, also when the view's first bar moves. Selecting or clearing a bar SHALL keep the bars shown too. The polite status SHALL say nothing for such a redraw. Only a bar the keyboard is reading SHALL be said again, alone, when its words changed.

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

#### Scenario: An earlier first bar
- **WHEN** the user is reading Oct 13 with the arrow keys and an ingest adds a session on a day before the chart's first bar
- **THEN** Oct 13 is still read, with its tooltip over its bar, and the status says nothing
