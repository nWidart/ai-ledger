## MODIFIED Requirements

### Requirement: Zoom the rate chart
In a view of 14 chart points or more, by day or by week, the rate chart SHALL show a zoom control under the bucket labels that narrows the points the chart shows, down to 7. A folded stretch is one point. The control SHALL NOT show in a view of fewer points. Both panels SHALL keep the scales of the whole view while zoomed. The zoom SHALL return to every point when the view changes: the range, the granularity, the project, the source or a toggle.

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

### Requirement: Keep the rate chart's reading and zoom through newer data
When newer data arrives for the same view, as after an ingest in the background, or a fix marker is saved, the rate chart SHALL draw it and keep the points shown and the point being read, also when its first point or a folded stretch moves. Its polite status SHALL say nothing for such a redraw; only a point the keyboard is reading SHALL be said again, alone, when its words changed. A reading on a point that is folded away SHALL end.

#### Scenario: Ingest while reading
- **WHEN** the user reads Nov 4 with the arrow keys and an ingest adds a failed call to today
- **THEN** Nov 4 is still read, with its tooltip, and nothing is said

#### Scenario: A fix marker is saved
- **WHEN** the pointer rests on a day and a fix marker's write is answered
- **THEN** the day's tooltip stays open

#### Scenario: The points move
- **WHEN** the user reads Nov 4 in a chart zoomed to Oct 28 to Nov 6, and an ingest adds a tool call on a day before the chart's first day
- **THEN** Nov 4 is still read, with its tooltip over its bar, Oct 28 to Nov 6 still show, nothing is said, and a selected Nov 4 is still selected and framed

#### Scenario: Space after older calls arrive
- **WHEN** Nov 4 is selected and still read, an ingest adds a tool call on a day before the chart's first day, and the user presses Space
- **THEN** the selection is cleared, and the status says so once

#### Scenario: A folded stretch opens
- **WHEN** the user reads a folded stretch that starts on Oct 10 with the arrow keys, and an ingest adds a tool call on Oct 14
- **THEN** Oct 10 is read, now a day of its own, and the status says it again with its new words

#### Scenario: The day read is folded away
- **WHEN** the user reads Nov 3, the third of seven days without a call at the end of the range, and an eighth such day arrives
- **THEN** the eight days are one folded stretch, the reading ends, and its tooltip closes

#### Scenario: Week after Day
- **WHEN** the user reads Nov 2 by day and selects Week
- **THEN** the reading ends and every week shows
