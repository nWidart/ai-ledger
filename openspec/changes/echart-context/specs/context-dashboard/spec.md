## ADDED Requirements

### Requirement: Zoom the cache chart
In a view of 14 days or weeks or more, the cache chart SHALL show a zoom control under the bucket labels that narrows the buckets the chart shows, down to 7. A day or week with no request counts as one. The control SHALL NOT show in a view of fewer. The three tracks SHALL show the same buckets and keep the scales of the whole view while zoomed. The zoom SHALL return to every bucket when the view changes. Turning cache reads on or off SHALL keep it.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, with the bars, the breaks and the ratio line on the same scales as before

#### Scenario: Few buckets
- **WHEN** the chart shows 11 weeks
- **THEN** no zoom control shows

#### Scenario: Three tracks
- **WHEN** the chart is zoomed to Oct 11 to Oct 20
- **THEN** the bars, the breaks and the ratio line all show those ten days, and Oct 15's ratio point is over Oct 15's bar

#### Scenario: Cache reads keep the zoom
- **WHEN** the chart is zoomed to Oct 11 to Oct 20 and the user turns cache reads on
- **THEN** the chart still shows those ten days, with the cache-read parts on its bars

#### Scenario: Another view
- **WHEN** the chart is zoomed and the user selects another project
- **THEN** the chart shows every day of the new view

### Requirement: Zoom the cache chart from the keyboard
With the cache chart focused in a view that shows the zoom control, plus (or `=`) SHALL halve the buckets shown, around the bucket being read or the newest, and minus SHALL double them. A "Show all days" or "Show all weeks" button SHALL show while the chart is zoomed, show every bucket again and return the focus to the chart. The chart's polite status SHALL say the days or weeks shown after each change. Zooming SHALL NOT change the page's address, its requests or the data table.

#### Scenario: Plus
- **WHEN** the chart shows 30 days, the user reads Oct 15 and presses plus
- **THEN** the chart shows 15 days around Oct 15, and the status says the days shown, such as "Showing Oct 11 to Oct 25, 15 of 30 days."

#### Scenario: Show all
- **WHEN** the chart is zoomed and the user selects "Show all days"
- **THEN** every day shows, the status says "Showing all 30 days.", the button goes and the focus is on the chart

#### Scenario: A reading outside the days shown
- **WHEN** the chart is zoomed to Oct 11 to Oct 20 and the user presses Home
- **THEN** the first day is read, and the days shown move to include it

#### Scenario: Weeks
- **WHEN** the chart shows 20 weeks and the user zooms to six of them
- **THEN** the status names weeks, such as "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks."

#### Scenario: No zoom control
- **WHEN** the chart shows 11 weeks and the user presses plus
- **THEN** nothing changes, and the chart's label names no zoom keys

#### Scenario: The data table
- **WHEN** the chart is zoomed to ten days and the user opens its data table
- **THEN** the table lists every day of the view

### Requirement: Read a day or week with no data
On the cache chart and the weekly start chart, the arrow keys and the pointer SHALL read a day or week that has no request, or no session, as they read any other. The reading mark SHALL sit on it, and the tooltip and the live sentence SHALL say that it has none. Nothing else SHALL be drawn for it.

#### Scenario: A day with no request, by the keys
- **WHEN** the view has requests on 3 and 5 November and none on 4 November, the user reads 3 November on the cache chart and presses Right
- **THEN** 4 November is read: the tooltip says "No request" and the live sentence is "Nov 4, 2026: no request."

#### Scenario: A day with no request, by the pointer
- **WHEN** the pointer is over 4 November on any track of the cache chart
- **THEN** the reading mark is on 4 November across the three tracks, and the tooltip says "No request"

#### Scenario: A week with no session
- **WHEN** sessions started in the weeks of 2 and 16 November and none in the week of 9 November, and the user reads the week of 2 November on the weekly start chart and presses Right
- **THEN** the week of 9 November is read, and the live sentence is "Week of Nov 9: no session started."

### Requirement: Show a tooltip on the growth and weekly start charts
The growth chart and the weekly start chart SHALL show a tooltip at the turn or week being read, by the keys or the pointer, with the figures the live sentence gives: the median, the 25th to 75th percentile and the sessions. The growth chart's tooltip SHALL also give the median of each project drawn that has a point at that turn. The weekly start chart's tooltip SHALL say when the week rests on few sessions.

#### Scenario: A turn
- **WHEN** the user reads turn 12 on the growth chart, which draws two projects
- **THEN** a tooltip at turn 12 gives the median, the 25th to 75th percentile, the sessions and each project's median

#### Scenario: A project's curve has ended
- **WHEN** a project's curve stops at turn 3 and the user reads turn 5
- **THEN** the tooltip has no row for that project

#### Scenario: A week of few sessions
- **WHEN** the user reads a week that holds 2 sessions on the weekly start chart
- **THEN** the tooltip gives its median, its percentiles and its 2 sessions, and says it rests on few sessions

### Requirement: Keep a Context chart's reading on its point
When newer figures arrive for the same view, the cache, growth and weekly start charts SHALL keep the reading on the day, week or turn it was on, the cache chart SHALL keep its zoom on the same buckets, and the session map SHALL keep the reading on its session. The charts SHALL say nothing then, unless the words of a reading a key made have changed. A reading whose point is gone SHALL end, and a new view SHALL end the reading.

#### Scenario: A background ingest
- **WHEN** the user reads Nov 4 on the cache chart with the keys and a background ingest brings newer figures for the same view
- **THEN** the band, the tooltip and the reading stay on Nov 4, and nothing is said unless Nov 4's figures changed

#### Scenario: An earlier day appears
- **WHEN** the user reads Nov 4 on the cache chart and newer figures add a day before the first one shown
- **THEN** the reading is still on Nov 4, and a zoom on Nov 1 to Nov 10 still shows those days

#### Scenario: A session on the map
- **WHEN** the user reads a session on the map and newer figures add a newer session
- **THEN** the reading, the ring and the tooltip stay on the same session

#### Scenario: The session leaves the map
- **WHEN** the user reads the oldest session on a map of 1,000 sessions and newer figures push it off the map
- **THEN** the reading ends

#### Scenario: Another measure
- **WHEN** the user reads turn 12 on the growth chart and switches to share of the window
- **THEN** the reading ends

### Requirement: Keep each Context chart's plot at a larger text size
At a larger browser text size, the cache chart, the growth chart, the weekly start chart and the session map SHALL grow in height, so that each plot keeps the height it has at the default text size, with their labels at the larger size.

#### Scenario: Weekly start chart at 200% text
- **WHEN** the browser's text size is 200%
- **THEN** the weekly start chart's plot is as tall as at the default size, and its box is taller

#### Scenario: Session map at 200% text
- **WHEN** the browser's text size is 200%
- **THEN** the map's plot is as tall as at the default size, and a dot is read where it is drawn

### Requirement: Keep the cache chart's track titles inside the plot
Each track of the cache chart SHALL carry a title that names it and gives its figure for the view. In a plot too narrow for the title and the figure, the figure SHALL take a shorter form, and SHALL be left out when that does not fit either. A title still wider than the plot SHALL be cut with an ellipsis.

#### Scenario: Wide plot
- **WHEN** the cache chart is 800px wide
- **THEN** the bars' title reads "Tokens not read from the cache" with the view's total after it

#### Scenario: Phone width
- **WHEN** the cache chart is 343px wide
- **THEN** each track's title ends inside the plot, with its figure

#### Scenario: Phone width at 200% text
- **WHEN** the cache chart is 343px wide and the browser's text size is 200%
- **THEN** each track's title ends inside the plot, with its figure in the short form or left out

#### Scenario: Cache reads on
- **WHEN** the user turns cache reads on
- **THEN** the bars' title reads "Prompt tokens", and its figure counts the prompt tokens

## MODIFIED Requirements

### Requirement: Map the view's sessions
The page SHALL chart each of the view's sessions with a measured start, a known window and a peak as one mark, placed by starting context and peak share of the window, with the 30,000-token and 80% lines and each quadrant they make named where its name fits. A compacted session's mark SHALL differ by more than colour. A mark SHALL give the session's details; selecting it SHALL open its sheet. The chart SHALL show at most the 1,000 newest such sessions and say how many it shows of how many.

#### Scenario: Heavy start, full window
- **WHEN** a session starts at 60,000 tokens and peaks at 180,000 of a 200,000-token window
- **THEN** its mark sits right of the 30,000-token line and above the 80% line, in the quadrant named Heavy and full

#### Scenario: A narrow map at a large text size
- **WHEN** the map is 343px wide and the browser's text size is 200%
- **THEN** a quadrant's name that does not fit in its quadrant is left out of the plot, and the quadrant buttons under the map still name all four quadrants

#### Scenario: Open a session from the map
- **WHEN** the user selects the mark of session `s7`
- **THEN** the session sheet for `s7` opens and the page keeps its filters

#### Scenario: Unknown window
- **WHEN** a session has a measured start and no known window
- **THEN** it has no mark, and the count the chart states leaves it out

#### Scenario: More sessions than the chart shows
- **WHEN** the view has 3,412 sessions that qualify
- **THEN** the chart shows the 1,000 newest and says it shows 1,000 of 3,412

#### Scenario: Compacted session
- **WHEN** a session compacted twice
- **THEN** its mark differs in shape from a session that never compacted, and its details say 2 compactions

### Requirement: Keep the cache chart's stacks in their tracks
On the cache chart's bars and breaks strip, a part above zero SHALL be drawn at least 1px tall with 2px of surface between parts. A stack SHALL be its total's scaled height, the other parts shrinking to make room, so no stack rises past its track and none is drawn taller than a stack of a larger total. In a stack too short to hold every part's minimum, the gaps SHALL shrink first, so each nonzero part stays visible.

#### Scenario: A tall bar with thin parts
- **WHEN** a day's bar is almost all uncached input, with a few tokens of cache write and, with cache reads on, of cache read
- **THEN** each thin part shows at least 1px tall and the bar is as tall as its total drawn to scale

#### Scenario: The busiest day's breaks
- **WHEN** the busiest day has 998 breaks from a model switch, 1 expired and 1 other
- **THEN** its stack fills the 48px strip exactly, and each cause shows at least 1px tall

#### Scenario: A short stack of several causes
- **WHEN** one day has 1 break of each cause and another has 40 breaks from a model switch
- **THEN** the first day's stack is not taller than the second's
