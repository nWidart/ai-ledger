## MODIFIED Requirements

### Requirement: Show every open window with its forecast
Limits SHALL show one card per open window. Its header SHALL give the window's name and plan, with the plan's tier when it has one ("max 20x"), its percent used now, an "estimated" chip when that percent is estimated, and one status: "runs out <time>" when the forecast's middle reaches 100% before the reset, "at its limit until <time>", "about <n>% at reset", or "no forecast". "runs out" and "at its limit" SHALL be in the critical style with a marker, so the colour is not the only signal. A percent at reset from 99.5% up to 100% SHALL read 99%.

#### Scenario: Forecast unavailable
- **WHEN** a window has no calibration
- **THEN** its chart shows the past line and no cone, its header reads "no forecast", and its Details give the reason

#### Scenario: A window that runs out
- **WHEN** Claude weekly is at 88% and its forecast reaches 100% at Sat 2:00 PM, before its reset
- **THEN** its header reads 88% and "runs out Sat, … 2:00 PM" in the critical style with a marker

#### Scenario: An estimated percent
- **WHEN** a window's percent now is estimated from local work since its last reading
- **THEN** its header shows the percent with an "estimated" chip

#### Scenario: A plan tier
- **WHEN** a Claude Code window's plan is `max/default_claude_max_20x`
- **THEN** its header names the plan "max 20x", in visible text, not only in a hover title

### Requirement: Draw at most four encodings per chart
Each open-window chart SHALL draw at most four encodings: the percent used so far as one line (solid between two measured points, dashed elsewhere), the forecast as a shaded cone from its low to its high bound with its dotted middle, a `now` tick, and the safe-pace line. The last-24-hours line, drawn only while its toggle is on, SHALL be the one encoding beyond these. The percent line SHALL be drawn as contiguous runs, so measured points either side of an estimate never draw a solid line over it. Lines SHALL differ by dash and width, not by opacity, and each line SHALL keep a contrast of at least 3:1 against the card in the light and the dark theme, also while the page dims its figures for a slow load. A 100% grid line with its axis label and the reset time on the right edge SHALL frame the plot. The page SHALL show no chart key.

#### Scenario: Measured and estimated
- **WHEN** a Claude window has polls every 5 minutes after Nov 6 and calibrated estimates before
- **THEN** the chart draws the polled stretch as a solid line and the rest as a dashed line of the same color, with no dots

#### Scenario: An estimate between two readings
- **WHEN** a window's points are measured 20%, estimated 25% and measured 40%
- **THEN** the chart draws a dashed line from 20% through 25% to 40%, and no solid line from 20% to 40%

#### Scenario: A slow range change
- **WHEN** the user picks another range and its data takes a while
- **THEN** the page dims its text and fills while it waits, and the charts' lines keep their contrast

### Requirement: Show the last-24-hours scenario
A "Last 24 h pace" toggle above the cards SHALL show when an open window that is not at its limit has the scenario, off on every load and pressed when on. When on, each chart with the scenario SHALL draw it as a second line with its own dash and colour, and a forecast point's readout SHALL end with " · last 24 h pace <n>%" when the point has a value. When off, no chart SHALL draw the line and no readout SHALL name it.

#### Scenario: No scenario
- **WHEN** no open window has a scenario
- **THEN** the page has no "Last 24 h pace" toggle and no chart has the second line

#### Scenario: Only windows at their limit
- **WHEN** every window with a scenario is at its limit
- **THEN** the page has no "Last 24 h pace" toggle

#### Scenario: The last window reaches its limit while the toggle is on
- **WHEN** the toggle is on and a refresh brings the last window with a scenario to its limit
- **THEN** the toggle goes, no chart draws the line, no readout names it, and the toggle is off when a later refresh brings it back

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
Limits SHALL give no figure's explanation only as hover text. The percent's chip SHALL read "estimated". A footer pace of "–" for a window with no forecast, at its limit or not, SHALL have a toggletip that says why. Each project and model in "What used this window" SHALL show its cost. A strip's unused summary SHALL have a How measured toggletip that says how many windows the average covers and which are left out.

#### Scenario: No forecast
- **WHEN** a window has no forecast
- **THEN** its footer's Pace reads "–" with a "Why no pace" toggletip that gives the reason

#### Scenario: At its limit and not calibrated
- **WHEN** a window is at its limit and has no calibration
- **THEN** its footer's Pace reads "–" with a "Why no pace" toggletip that says it is not calibrated yet

### Requirement: Name each plan with its tier
A plan SHALL show its tier as text, not in a hover title, wherever Limits names it: card and panel headings, the closed windows table, What a point buys and a plan change's label. A tier with a multiplier SHALL read as the plan and the multiplier ("max 20x"); another tier SHALL follow the plan in brackets.

#### Scenario: A Claude Code tier
- **WHEN** a window's plan is `max/default_claude_max_20x`
- **THEN** Limits names it "max 20x"

### Requirement: Name the range of What a point buys
"What a point buys" SHALL name the range it covers, the one set in Past windows, in its description and its hint: "over the last 30 days", or "over all time". The hint SHALL be one line; how cost is priced SHALL sit behind its How measured toggletip.

#### Scenario: Thirty days
- **WHEN** the Past windows range is 30 days
- **THEN** the drawer's hint reads "One point is 1% of a limit, over the last 30 days: the range set in Past windows.", and its How measured toggletip says cost is at API list prices and a model without a price has no points
