## MODIFIED Requirements

### Requirement: Zoom the daily chart
In a view of 14 days or more, the daily chart SHALL show a zoom control under the plot that narrows the days the chart shows, down to 7 days. The control SHALL NOT show in a shorter view. The value axis SHALL keep the scale of the whole view while zoomed. The zoom SHALL return to every day when the view, the metric, the scale or the stacking changes. A view is a range, a project, a source and the automated-sessions filter.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, on the same value axis

#### Scenario: Short view
- **WHEN** the view covers 7 days
- **THEN** no zoom control shows

#### Scenario: View change
- **WHEN** the chart is zoomed and the user changes the range
- **THEN** the chart shows every day of the new view

#### Scenario: The range moves on a day
- **WHEN** the chart shows Oct 11 to Oct 20 of a 30-day view, focus is on "Show all days", and at midnight the view's first day becomes the next one
- **THEN** the chart still shows Oct 11 to Oct 20, and the button keeps the focus

#### Scenario: Older days arrive
- **WHEN** the chart shows Oct 11 to Oct 20 of an all-time view, and an ingest of older transcripts moves its first day earlier
- **THEN** the chart still shows Oct 11 to Oct 20, and "Show all days" stays

### Requirement: Keep the zoom and the reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the daily chart SHALL draw it and SHALL keep the days shown, the "Show all days" button with any focus on it, and the day being read, also when the view's first day moves. Hiding or showing a token kind SHALL keep them too. The polite status SHALL say nothing for such a redraw. Only a day the keyboard is reading SHALL be said again, alone, when its words changed.

#### Scenario: Ingest while zoomed
- **WHEN** the chart shows Oct 11 to Oct 20 of a 30-day view, focus is on "Show all days", and an ingest changes today's cost
- **THEN** the chart still shows Oct 11 to Oct 20, the button keeps the focus, and the status says nothing

#### Scenario: Ingest while reading
- **WHEN** the user is reading Oct 13 and an ingest changes today's cost
- **THEN** Oct 13 is still read, with its tooltip, and the status does not repeat it

#### Scenario: Today read by keyboard
- **WHEN** the user reads today with the arrow keys, the focus is on the chart, and an ingest raises today's cost
- **THEN** the tooltip shows the new cost and the status says the day again with it, without the days shown

#### Scenario: Pointer resting on today
- **WHEN** the pointer rests on today's bar and an ingest raises today's cost
- **THEN** the tooltip shows the new cost and the status says nothing

#### Scenario: A day more while zoomed
- **WHEN** an all-time view is zoomed, the status holds "Showing Oct 11 to Oct 20, 10 of 30 days.", and a 31st day arrives
- **THEN** the chart shows the same days, and the status is emptied: the sentence is not said again, with the old count or a new one

#### Scenario: Hidden kind
- **WHEN** the tokens chart is zoomed and the user hides a kind in the legend
- **THEN** the chart shows the same days, on the value axis of the whole view without that kind

#### Scenario: Older days arrive while reading
- **WHEN** the user is reading Oct 13 with the arrow keys in an all-time view, and an ingest of older transcripts moves the view's first day earlier
- **THEN** Oct 13 is still read, with its tooltip over its bar, and the status says nothing
