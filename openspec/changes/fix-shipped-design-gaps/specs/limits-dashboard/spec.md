## MODIFIED Requirements

### Requirement: Draw at most four encodings per chart
Each open-window chart SHALL draw at most four encodings: the percent used so far as one line (solid where measured, dashed where estimated), the forecast as a shaded cone from its low to its high bound with its dotted middle, a `now` tick, and the safe-pace line. Lines SHALL differ by dash and width, not by opacity, and each line SHALL keep a contrast of at least 3:1 against the card in the light and the dark theme. A 100% grid line with its axis label and the reset time on the right edge SHALL frame the plot. The page SHALL show no chart key.

#### Scenario: Measured and estimated
- **WHEN** a Claude window has polls every 5 minutes after Nov 6 and calibrated estimates before
- **THEN** the chart draws the polled stretch as a solid line and the rest as a dashed line of the same color, with no dots

### Requirement: Show the last-24-hours scenario
A "Last 24 h pace" toggle above the cards SHALL show when an open window that is not at its limit has the scenario, off on every load and pressed when on. When on, each chart with the scenario SHALL draw it as a second line with its own dash and colour, and a forecast point's readout SHALL end with " · last 24 h pace <n>%" when the point has a value. When off, no chart SHALL draw the line and no readout SHALL name it.

#### Scenario: No scenario
- **WHEN** no open window has a scenario
- **THEN** the page has no "Last 24 h pace" toggle and no chart has the second line

#### Scenario: Only windows at their limit
- **WHEN** every window with a scenario is at its limit
- **THEN** the page has no "Last 24 h pace" toggle

#### Scenario: Reading a forecast point
- **WHEN** the toggle is on and the readout is on a forecast point of 58% whose scenario value is 72.3%
- **THEN** it reads "<time> · forecast 58% · last 24 h pace 72.3%", and without the last part when the toggle is off or the point has no scenario value

### Requirement: Draw the safe pace
Each open-window chart with a percent now SHALL draw a thin, long-dashed straight line from the point now at that percent to 100% at the reset: the pace that ends at exactly 100%. A curve steeper than the line runs hot. A window at its limit, a window with no percent now and a closed window's chart SHALL have no such line. The chart's data table SHALL give the line's value at each time after now.

#### Scenario: A window running hot
- **WHEN** a weekly window is at 40% at Wed noon and resets Sun noon
- **THEN** its chart draws a straight line from 40% at Wed noon to 100% at Sun noon, and its forecast cone rises above it

#### Scenario: A window at its limit
- **WHEN** a window is at its limit
- **THEN** its chart has no safe-pace line

### Requirement: Show a picked window's curve
Picking a bar SHALL show that window's curve in a panel under the strips: a heading with the window's name, its start and end, its final percent and its notes, and the chart the open windows use, from the window's start to its end, without a forecast or a "now" line, with the plan changes inside it marked and the chart readable by hover and keyboard as the open windows' charts are. A "Show data table" button under the chart SHALL offer its times and percents as a table, with no safe-pace column.

#### Scenario: A curve
- **WHEN** the bar of a Codex weekly window that a plan change ended early is picked
- **THEN** a panel names the window, its dates, 22% and the plan change, shows "Loading the curve…" and then its chart with the plan change marked, with no forecast and no "now" line

#### Scenario: The curve as a table
- **WHEN** the user selects "Show data table" under a picked window's curve
- **THEN** a table lists its times with the percent used, and no safe-pace column

### Requirement: Explain the method behind How measured
The forecast method, the last-24-hours line and the note that estimates count local agent work only SHALL sit behind the shared "How measured" toggletip at the end of the hint under "Open windows". The hint SHALL be one line.

#### Scenario: The method
- **WHEN** the user activates "How measured"
- **THEN** it says how forecasts are made, what the cone and the safe-pace line mean, what the last-24-hours line carries, and that estimates count local agent work only

## ADDED Requirements

### Requirement: Give Limits' figures without hover text
Limits SHALL give no figure's explanation only as hover text. The percent's chip SHALL read "estimated". A footer pace of "–" for a window with no forecast SHALL have a toggletip that says why. Each project and model in "What used this window" SHALL show its cost. A strip's unused summary SHALL have a How measured toggletip that says how many windows the average covers and which are left out.

#### Scenario: No forecast
- **WHEN** a window has no forecast
- **THEN** its footer's Pace reads "–" with a "Why no pace" toggletip that gives the reason

### Requirement: Name the range of What a point buys
"What a point buys" SHALL name the range it covers, the one set in Past windows, in its description and its hint: "over the last 30 days", or "over all time".

#### Scenario: Thirty days
- **WHEN** the Past windows range is 30 days
- **THEN** the drawer's hint reads "One point is 1% of a limit, over the last 30 days: the range set in Past windows."
