# limits-dashboard Specification

## Purpose

The Limits page shows how much of each provider's plan limits is used, when each limit will run out or reset, and where unused capacity is left. It helps the user avoid running out and use every plan fully.

## Requirements

### Requirement: Lead with the binding window
Limits SHALL open with the window that will stop the user first: one already at its limit, else the one forecast to reach 100% soonest. If none is at or forecast to reach 100% before it resets, it SHALL show the window closest to its cap. The lead SHALL name the provider and window, the percent used now and when it resets.

#### Scenario: One window runs out
- **WHEN** Claude's weekly window is at 90% and forecast to reach 100% on Sat 14:00, and every other window resets first
- **THEN** the lead says Claude weekly, at 90% now, reaches 100% on Sat 14:00, before its reset on Sun 06:00

#### Scenario: Nothing runs out
- **WHEN** every window is forecast to reset below 100%
- **THEN** the lead says no limit runs out at the current pace, and names the highest forecast at reset

#### Scenario: A window at its limit
- **WHEN** Codex 5-hour is at 100% and resets at 04:08
- **THEN** the lead says Codex 5-hour is at its limit until 04:08, and its card says so in the critical style

### Requirement: Show every open window with its forecast
Limits SHALL show one chart per open window. Each chart SHALL show the percent used so far, the forecast to reset with its low and high bounds, a 100% line, and the reset time. Measured points SHALL look different from estimated ones. Each chart SHALL say either "reaches 100% at …" or "resets first at about …%".

#### Scenario: Measured and estimated
- **WHEN** a Claude window has polls every 5 minutes after Nov 6 and calibrated estimates before
- **THEN** the chart marks the polled points as measured and the rest as estimated

#### Scenario: Forecast unavailable
- **WHEN** a window has no calibration
- **THEN** its chart shows the measured points, no forecast, and the reason

### Requirement: Show headroom and pace
For each open window, Limits SHALL show the percent left, the time left to reset, the usual pace, the window's own recent pace once it has one, and the pace that ends at exactly 100% at reset. It SHALL say whether the user is ahead of or behind that pace. A window at its limit SHALL show no pace.

#### Scenario: Behind pace
- **WHEN** Codex weekly is at 20% with 3.5 of 7 days left
- **THEN** Limits shows 80% left over 3.5 days, a target pace of about 23% a day, and says the user is behind that pace

#### Scenario: Both paces
- **WHEN** a weekly window's usual pace is 6.8% a day and it used 34% over its last day
- **THEN** its card shows a usual pace of 6.8% a day and this window at 34% a day over its last day

### Requirement: Suggest where to send work
Limits SHALL suggest the provider with the most headroom left at the current pace. It SHALL not suggest a provider with a window at its limit, or whose binding window is forecast to reach 100% before it resets. It SHALL suggest nothing unless at least two providers have a forecast.

#### Scenario: Only one provider forecast
- **WHEN** Claude weekly has a forecast and Codex is not calibrated yet
- **THEN** Limits suggests no provider

#### Scenario: Codex has room
- **WHEN** Claude weekly is forecast to reach 100% before it resets and Codex weekly is forecast to reset at 30%
- **THEN** Limits suggests Codex and shows the 70% it would leave unused

#### Scenario: Codex at its limit
- **WHEN** Codex 5-hour is at 100%
- **THEN** Limits does not suggest Codex

### Requirement: Show limit history
Limits SHALL list the closed windows of the selected range, newest first. Each row SHALL give the window's provider, kind, plan and final percent, and say whether it hit 100% and for how long it stayed there. Plan changes and early resets SHALL be marked on the charts and in the list.

#### Scenario: Window left unused
- **WHEN** a Codex weekly window closed at 22% because of a plan change
- **THEN** the history shows it closed at 22%, ended early by a plan change from `plus` to `prolite`

#### Scenario: Limit hit
- **WHEN** a Codex 5-hour window reached 100% at 23:52 and reset at 04:07
- **THEN** the history shows a hit of about 4 hours 15 minutes

### Requirement: Show unused capacity
Limits SHALL show, for the selected range, the average percent left at reset for each provider and window kind, over windows that ran their full length. It SHALL say how many windows ended early and were left out. A model-scoped window with nothing used and no counted use of its model SHALL be skipped.

#### Scenario: Four weekly windows
- **WHEN** four Codex weekly windows closed at 30%, 40%, 50% and 40%
- **THEN** Limits shows an average of 60% left unused

#### Scenario: A window cut short
- **WHEN** one more Codex weekly window ended after a day at 10% because of a plan change
- **THEN** the average stays 60%, and Limits says 1 window that ended early is left out

### Requirement: Show value per 1%
For each calibrated limit, Limits SHALL show the tokens and estimated cost one percentage point buys, broken down by model, and the points each model used inside that limit's windows on its plan. A model without a price SHALL be marked unpriced, and a limit from an earlier plan SHALL say so. Per project, it SHALL show commits per percentage point, listing projects that used at least one point and folding the rest into one row. A figure without enough data SHALL show as not available.

#### Scenario: Model breakdown
- **WHEN** Claude weekly is calibrated at $8 per 1% and two models used it
- **THEN** Limits shows tokens and cost per 1% for each model

#### Scenario: Use on another plan
- **WHEN** Codex 5-hour belongs to plan `plus`, and the user spent on plan `prolite`, which has no 5-hour limit
- **THEN** the 5-hour points used leave out the `prolite` spend, and the limit is marked as an earlier plan

### Requirement: Show freshness of limit data
Limits SHALL show, per provider, when the last snapshot was taken, how long ago, and whether the current figure is measured or estimated. It SHALL flag a provider whose polling is failing, or whose last snapshot is older than twice its poll interval. A reading from a provider that is not polled SHALL count as estimated once it is over an hour old.

#### Scenario: Polling failing
- **WHEN** the last three Claude polls failed
- **THEN** Limits shows Claude's figures as estimated, gives the time of the last successful poll, and says polling is failing

#### Scenario: An old Codex reading
- **WHEN** the last Codex reading is 5 hours old
- **THEN** Limits shows it was taken 5 hours ago, and Codex figures as estimated

### Requirement: Filter Limits by time range and source
Limits SHALL apply the shared time range to the history, unused-capacity and value sections, and the source filter to every section. Open windows SHALL always show, whatever the range. The project filter SHALL apply only to commits per percentage point, because limits are per account.

#### Scenario: Codex only
- **WHEN** the user picks source Codex on Limits
- **THEN** only Codex windows, history and value appear, and the URL records `source=codex`

#### Scenario: Project filter set
- **WHEN** the shared project filter is `foo`
- **THEN** the windows show account-wide usage, and commits per percentage point shows only `foo`

### Requirement: Show a status strip of open windows
Limits SHALL show a status strip under its heading: a list labelled "Open windows at a glance" with one chip per open window, in payload order. Each chip SHALL show the window name, the percent used now ("–" with no reading) and "resets in". A chip at its limit or forecast to hit 100% before reset SHALL have the warning tone and say "at limit" or "runs out". An estimated chip SHALL carry an "est." marker. With no open window the strip SHALL NOT render.

#### Scenario: One chip per window
- **WHEN** three windows are open
- **THEN** the strip lists three chips in payload order, each with its percent used and "resets in"

#### Scenario: A window at its limit
- **WHEN** Codex weekly is at 100% until its reset
- **THEN** its chip has the warning tone and says "at limit"

#### Scenario: A window that runs out
- **WHEN** Claude weekly is forecast to reach 100% before its reset
- **THEN** its chip has the warning tone and says "runs out"

#### Scenario: No open windows
- **WHEN** no window is open
- **THEN** the page shows no strip

### Requirement: Show the cap in money and its calibration
Each calibrated open-window card SHALL show, under its pace line, one muted line: "100% ≈ <money> <period> at list prices, from <N> over <M>". The money SHALL be the calibrated value per percent times 100. The period SHALL follow the window length. A card with no calibration SHALL NOT show the line.

#### Scenario: A weekly window
- **WHEN** a weekly window is calibrated at 4.2 dollars per percent from 37 points over 2 windows
- **THEN** its card shows "100% ≈ $420 a week at list prices, from 37 points over 2 windows"

#### Scenario: The period follows the window length
- **WHEN** a window is 10080 minutes, 1440, 43200, 300, another whole number of hours, or of unknown length
- **THEN** its line reads "a week", "a day", "per 30 days", "per 5 hours", "per <h> hours", or "a window"

#### Scenario: A thin calibration
- **WHEN** a window is calibrated from one window
- **THEN** the line says "over 1 window", with no added wording

#### Scenario: A window that is not calibrated
- **WHEN** a window has no calibration
- **THEN** its card shows no cap-money line

#### Scenario: A window at its limit that is not calibrated
- **WHEN** a window reports 100% before any priced usage is counted, so it has no calibration
- **THEN** its card shows no cap-money line, and its caption says "At its limit until …"

### Requirement: Read an open-window chart at a point in time
Each open-window chart SHALL show a readout of one point (guide, marker, tooltip) among its past points, then its forecast points after now. The tooltip SHALL give the time, then the percent with measured or estimated, or the forecast with its likely range. A pointer SHALL read the nearest point. The tooltip SHALL stay inside the chart. A chart with points SHALL be one tab stop that reads now on keyboard focus (focus from a click or tap keeps the pointer's readout), moves by key and clears on Escape and blur; a key with Alt, Ctrl, Meta or Shift held SHALL be left to the browser; keyboard changes SHALL be announced, pointer moves SHALL NOT. A chart with nothing to read SHALL have no tab stop.

#### Scenario: A past point
- **WHEN** the pointer is nearest a measured point of 42% at Sat, Nov 7, 2:00 PM
- **THEN** the tooltip reads "Sat, Nov 7, 2:00 PM · 42% · measured", with a guide and a marker at that point

#### Scenario: A forecast point
- **WHEN** the readout is on a forecast point with a middle of 71% and a likely range of 60% to 85%
- **THEN** it reads "<time> · forecast 71% (60–85%)", and "<time> · forecast 71%" when low and high read the same

#### Scenario: The pointer beyond the ends
- **WHEN** the pointer is left of the first point or right of the last
- **THEN** the readout shows the first or the last point

#### Scenario: Leaving the chart
- **WHEN** the pointer leaves the chart
- **THEN** the readout clears

#### Scenario: Reading by keyboard
- **WHEN** the chart takes focus, then the right arrow key is pressed
- **THEN** the readout shows now, then the next point, and the text is announced; Home shows the first point, End the last, Escape or blur clears it

#### Scenario: Focus by click or tap
- **WHEN** the pointer reads a point and a click or tap focuses the chart
- **THEN** the readout stays on that point and nothing is announced; the arrow keys then move on from it

#### Scenario: Modified keys
- **WHEN** a key is pressed with Alt, Ctrl, Meta or Shift held
- **THEN** the chart does not handle it, so Alt+Left still goes back in history and Ctrl+Home still goes to the page top

#### Scenario: A long readout
- **WHEN** the readout is wider than the room beside the point, or wider than the chart
- **THEN** the tooltip moves to the other side of the point or wraps, and stays wholly inside the chart

#### Scenario: A window without a forecast
- **WHEN** a window has no forecast
- **THEN** its points are the past points, and End reads the last of them

#### Scenario: Nothing to read
- **WHEN** a window has no series and no forecast
- **THEN** its chart shows the image only, with no tab stop and no readout
