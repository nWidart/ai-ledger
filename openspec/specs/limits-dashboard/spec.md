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
Limits SHALL show one chart per open window. Each chart SHALL show the percent used so far, the forecast to reset with its low and high bounds, a 100% line, and the reset time. Measured points SHALL look different from estimated ones. Each chart SHALL say either "reaches 100% at …" or "resets first at about …%", and a text SHALL give 100% at the reset only for a line that reaches it: a percent from 99.5% up to 100% reads 99%.

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
Each open-window chart SHALL show a readout of one point (guide, marker, tooltip) among its past points, then its forecast points after now. The tooltip SHALL give the time, then the percent with measured or estimated, or the forecast with its likely range. A pointer SHALL read the nearest point. The tooltip SHALL stay inside the chart's width and wrap when wider than it.

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

#### Scenario: A long readout
- **WHEN** the readout is wider than the room beside the point, or wider than the chart
- **THEN** the tooltip moves to the other side of the point, or wraps when wider than the chart, and stays inside the chart's width

#### Scenario: A window without a forecast
- **WHEN** a window has no forecast
- **THEN** its points are the past points, and End reads the last of them

### Requirement: Read an open-window chart by keyboard
A chart with points SHALL be one tab stop that reads now on keyboard focus (focus from a click or tap keeps the pointer's readout), moves by key and clears on Escape and blur. A key with Alt, Ctrl, Meta or Shift held SHALL be left to the browser. Keyboard changes SHALL be announced, pointer moves SHALL NOT. A chart with nothing to read SHALL have no tab stop.

#### Scenario: Reading by keyboard
- **WHEN** the chart takes focus, then the right arrow key is pressed
- **THEN** the readout shows now, then the next point, and the text is announced; Home shows the first point, End the last, Escape or blur clears it

#### Scenario: Focus by click or tap
- **WHEN** the pointer reads a point and a click or tap focuses the chart
- **THEN** the readout stays on that point and nothing is announced; the arrow keys then move on from it

#### Scenario: Modified keys
- **WHEN** a key is pressed with Alt, Ctrl, Meta or Shift held
- **THEN** the chart does not handle it, so Alt+Left still goes back in history and Ctrl+Home still goes to the page top

#### Scenario: Nothing to read
- **WHEN** a window has no series and no forecast
- **THEN** its chart shows the image only, with no tab stop and no readout

### Requirement: Show the last-24-hours scenario
Each open-window chart whose forecast has the last-24-hours scenario SHALL draw it as a second line over the forecast span, with a dash pattern and a colour of its own. The chart key SHALL list it as "last 24 h pace" when any card shows the scenario line. A forecast point's readout SHALL end with " · last 24 h pace <n>%" when the point has a scenario value.

#### Scenario: No scenario
- **WHEN** no open window has a scenario
- **THEN** no card has the line, no chart has the second line and the chart key does not list "last 24 h pace"

#### Scenario: Reading a forecast point
- **WHEN** the readout is on a forecast point of 58% whose scenario value is 72.3%
- **THEN** it reads "<time> · forecast 58% · last 24 h pace 72.3%", and without the last part when the point has no scenario value

### Requirement: Say what the last-24-hours scenario reaches
Under the caption, the card SHALL say "If the last 24 hours continue: reaches 100% at <time>" when the scenario reaches 100% before the reset, in the warning style, or "If the last 24 hours continue: about <n>% at its reset" when it does not. A window at its limit, a window with no forecast and a window with no scenario SHALL show no such line. A percent at its reset from 99.5% up to 100% SHALL read 99%, so the line claims 100% only when it reaches it.

#### Scenario: The scenario reaches 100%
- **WHEN** a window's scenario reaches 100% at Sat, Nov 7, 3:00 PM before the reset
- **THEN** its card reads "If the last 24 hours continue: reaches 100% at Sat, Nov 7, 3:00 PM" in the warning style, and its chart has the second line

#### Scenario: The reset comes first
- **WHEN** a window's scenario stays at 41.26% at the reset
- **THEN** its card reads "If the last 24 hours continue: about 41% at its reset", not in the warning style

#### Scenario: A window at its limit
- **WHEN** a window is at its limit
- **THEN** its card has no scenario line

### Requirement: Keep the last-24-hours scenario apart from the card's other text
The hint under "Open windows" SHALL say that the line carries the use of the last 24 hours on to the reset. The scenario SHALL NOT change the heading, the status strip, the caption or the suggestion.

#### Scenario: The hint
- **WHEN** Limits shows open windows with the scenario line
- **THEN** the hint under "Open windows" says that the line carries the use of the last 24 hours on to the reset, and the heading, status strip, caption and suggestion read as without the scenario

### Requirement: Show what used each open window
Each open-window card with counted use since its start SHALL show a drawer, closed by default, headed "What used this window", after the cap-money line. Closed, its heading SHALL end with the window's top project and its share of the window's counted use ("ai-ledger 54%"), when the use has a project. A card with no counted use since its start SHALL have no drawer.

#### Scenario: A window that runs hot
- **WHEN** a weekly window that started 5 days ago has counted use, 54% of it in the project ai-ledger
- **THEN** its card has a closed drawer reading "What used this window · ai-ledger 54%", and opened it lists the top projects and models with their shares and points

#### Scenario: Nothing counted
- **WHEN** no use was counted since the window started
- **THEN** its card has no drawer

### Requirement: List what used an open window
Opened, the drawer SHALL list the top three projects and the top three models by estimated cost, each with its share as a percent and, when the window is calibrated, its points ("≈ 12.3 points"), and give its cost at API list prices as the row's title. It SHALL say that only counted local agent use at list prices is in it and that use elsewhere is not.

#### Scenario: Not calibrated
- **WHEN** a window is not calibrated yet
- **THEN** its drawer lists shares and costs and no points

### Requirement: Scope what used an open window to the window
The use in the drawer is that from the window's start to now, for the provider's agent and the models the limit covers. It SHALL NOT follow the page's project and range filters.

#### Scenario: A filtered page
- **WHEN** the page has a project or range filter set
- **THEN** the drawer's use is still that from the window's start to now, for the provider's agent and the models the limit covers

### Requirement: Link what used an open window to Cost
Each project SHALL link to Cost filtered to that project, with the window's provider as the source and automated sessions included (the drawer counts them, and Cost leaves them out otherwise). A link "Open in Cost" SHALL do the same with no project.

#### Scenario: Linking to Cost
- **WHEN** the reader follows the project link of ai-ledger in a Claude Code window that started 5 days ago
- **THEN** the page goes to Cost with the project ai-ledger, the source claude, automated sessions included and the range 7 days, without a page reload, and the link's title says that 7 days is the nearest preset

### Requirement: Pick the Cost range of a drawer link
Each such link SHALL use the smallest range preset (7, 14, 30 or 90 days, else all time) that covers every calendar date from the window's start date through today, as Cost's range counts days. The dates are the reader's local dates.

#### Scenario: A window that started seven days ago
- **WHEN** it is Nov 6 at noon and a window started Oct 30 at noon, so it spans 8 calendar dates
- **THEN** its links use the range 14 days, since Cost's 7 days begin Oct 31 at midnight

#### Scenario: A window older than the longest preset
- **WHEN** a window started more than 90 days ago
- **THEN** its "Open in Cost" link reads "Open in Cost · all time" and opens Cost over all time

### Requirement: Name the Cost range of a drawer link
Every such link, the project links included, SHALL name its range as the nearest preset, since Cost has no custom ranges, in its title. A project link's accessible name SHALL say where it goes ("ai-ledger in Cost, last 7 days").

#### Scenario: A project link's name
- **WHEN** a window started 5 days ago and the drawer links its project ai-ledger to Cost
- **THEN** the link's accessible name reads "ai-ledger in Cost, last 7 days" and its title names 7 days as the nearest preset

### Requirement: Show a scoped limit's share and the week's use by surface
An open-window card whose window has a share of the weekly allowance SHALL say, in a small muted line under the forecast lines, "This limit is <allowance>% of the weekly allowance; <used>% of the weekly allowance is used through it". A card without a share SHALL show no such line.

#### Scenario: A scoped card
- **WHEN** the Fable window has a share of 21% used of a 50% allowance
- **THEN** its card reads "This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it"

#### Scenario: No field
- **WHEN** a window has no share and no surfaces
- **THEN** its card shows neither line

### Requirement: Show the week's use by surface
A card whose window has surfaces SHALL say, in the same style, "All of this week's use so far came from <label>" when exactly one surface has any use (a percent above 0, before rounding), else "This week's use by surface: <label> <percent>%, …" listing every surface with use, most first. A card whose surfaces are all 0% SHALL show no surfaces line. A card without surfaces SHALL show no such line.

#### Scenario: One surface made all the use
- **WHEN** the unscoped weekly window's surfaces are Claude Code 100%, Chats 0%, Cowork 0%
- **THEN** its card reads "All of this week's use so far came from Claude Code"

#### Scenario: A mix of surfaces
- **WHEN** the surfaces are Claude Code 40%, Chats 60%, Cowork 0%
- **THEN** the card reads "This week's use by surface: Chats 60%, Claude Code 40%"

#### Scenario: No use yet
- **WHEN** every surface is 0%
- **THEN** the card shows no surfaces line

### Requirement: Round the percents of the share and surface lines
Percents SHALL read as whole numbers. A surface whose percent rounds to 0 SHALL read "<1%", and none SHALL read 100% beside another surface with use (it reads 99%).

#### Scenario: Almost all from one surface
- **WHEN** the surfaces are Claude Code 99.5%, Chats 0.5%
- **THEN** the card reads "This week's use by surface: Claude Code 99%, Chats 1%", never "All of this week's use so far came from Claude Code"

### Requirement: Keep the share and surface lines apart from the card's other text
The lines SHALL NOT change the heading, the status strip, the captions, the pace line or the freshness line, and the hint that estimates count local agent work only SHALL stay.

#### Scenario: A card with both lines
- **WHEN** a card shows the share line and the surfaces line
- **THEN** its heading, status strip, captions, pace line and freshness line read as without them, and the hint that estimates count local agent work only is still shown

### Requirement: Show past windows as bars with a curve on demand
Above the table of closed windows, Limits SHALL show one row per limit (its provider, limit id and scope) that has closed windows in the selected range, in the order the open windows use (provider, then longest window first, then scope), each with the limit's name (that of its newest closed window) and a strip of small bars, oldest left and newest right.

#### Scenario: A strip per limit
- **WHEN** the range holds closed Claude Code weekly windows and Codex weekly and 5-hour windows
- **THEN** the strips read Claude Code weekly, Codex weekly and Codex 5-hour, each with one bar per closed window, oldest left

#### Scenario: Two limits that read alike
- **WHEN** two limit ids of one provider share a label
- **THEN** each has its own strip and its own 60-bar cap

### Requirement: Draw each past window as a bar
A bar SHALL be as tall as the window's final percent, from 0 to 100, and SHALL never be shorter than a visible minimum, so a window at 0% can still be picked. A window that hit its limit SHALL be drawn in the critical colour, one that ended early SHALL be hatched, and an estimated one (rebuilt from counted usage, not measured) SHALL be drawn as a tint with an outline; a window MAY be all three.

#### Scenario: Hit, early and estimated bars
- **WHEN** a Codex 5-hour window hit its limit, a Codex weekly window was ended early by a plan change, and a Claude Code weekly window is estimated
- **THEN** the first bar is red, the second is hatched, the third is outlined

#### Scenario: A window with nothing used
- **WHEN** a closed window ended at 0%
- **THEN** its bar is still visible and can be picked

### Requirement: Cap a strip at 60 windows
A strip SHALL show at most the 60 most recent closed windows of its limit. When its limit has more, the strip SHALL say how many are shown of how many there are, and that the table lists all.

#### Scenario: A long history
- **WHEN** a limit has 143 closed windows in the range
- **THEN** its strip shows the 60 most recent and says "60 most recent of 143; the table lists all", and the table lists all 143

### Requirement: Key the marks of the past-window bars
A key under the strips SHALL name the three marks and draw each as its bars do (red, hatched, outlined).

#### Scenario: The key
- **WHEN** Limits shows the strips
- **THEN** the key under them names the limit hit, ended early and estimated marks, drawn red, hatched and outlined

### Requirement: Scroll a wide strip inside its box
A strip too wide for its box SHALL scroll inside that box, not the page, showing its newest bars when the box first has a width (so also when Past windows is opened after the page loaded). It SHALL never move back there after the user has scrolled it, focused a bar or pressed a key in it, and moving between its bars by keyboard SHALL bring the focused bar into view.

#### Scenario: Opened after load
- **WHEN** Past windows is opened after the page loaded and a strip is wider than its box
- **THEN** the strip shows its newest bars, and scrolls inside its box, not the page

#### Scenario: The user has scrolled
- **WHEN** the user scrolled the strip, focused a bar or pressed a key in it
- **THEN** the strip does not move back to its newest bars

### Requirement: Say each past-window bar in words
Each bar SHALL be a button with an accessible name and a tooltip that say what it shows in words (the window, when it ended, its final percent, that it hit its limit and for how long, that it ended early and why, that it is estimated), so no mark is carried by colour alone.

#### Scenario: A bar's name
- **WHEN** a Codex 5-hour window hit its limit for 4h 15m
- **THEN** its bar's name says so, for example "Codex 5-hour, ended <time>: 100%, hit its limit for 4h 15m"

### Requirement: Move between the bars of a strip by keyboard
A strip SHALL be one tab stop: Left and Right SHALL move between its bars from the bar last focused (by window: a refresh that adds or drops windows does not change which bar that is), Home and End SHALL go to the first and last, and the picked bar SHALL be marked as pressed.

#### Scenario: Keyboard
- **WHEN** a strip's bar has focus and Right is pressed
- **THEN** focus moves to the next newer bar, and Tab leaves the strip rather than visiting every bar

### Requirement: Show a picked window's curve
Picking a bar SHALL show that window's curve in a panel under the strips: a heading with the window's name, its start and end, its final percent and its notes, and the chart the open windows use, from the window's start to its end, without a forecast or a "now" line, with the plan changes inside it marked and the chart readable by hover and keyboard as the open windows' charts are.

#### Scenario: A curve
- **WHEN** the bar of a Codex weekly window that a plan change ended early is picked
- **THEN** a panel names the window, its dates, 22% and the plan change, shows "Loading the curve…" and then its chart with the plan change marked, with no forecast and no "now" line

### Requirement: Fetch a picked window's curve when it is picked
The curve SHALL be fetched when the bar is picked, and the panel SHALL show that it is loading, and, when the latest fetch fails, say so and offer Retry, even if an earlier answer is held (it SHALL NOT show a chart its latest fetch failed to refresh).

#### Scenario: A failed fetch
- **WHEN** the curve cannot be fetched, or a refetch after an ingest of a curve already shown fails
- **THEN** the panel says so, without the old chart, and Retry fetches it again

### Requirement: Close a picked window's curve panel
Picking the same bar again, or the panel's Close button, SHALL close the panel, and Close SHALL return focus to the bar. The picked window SHALL NOT be part of the page's address. A range, source or project that leaves the picked window out of the strips SHALL close the panel.

#### Scenario: Close
- **WHEN** the panel's Close button is pressed
- **THEN** the panel closes and the window's bar has focus

#### Scenario: The window leaves the range
- **WHEN** a bar is picked and the source filter then excludes its provider
- **THEN** the panel closes

### Requirement: Mark the picked window without changing the rest of Limits
The table row of the picked window SHALL be marked. The table, the Unused section and the other drawers SHALL NOT change.

#### Scenario: A picked window
- **WHEN** a bar is picked
- **THEN** the window's table row is marked, and the table, the Unused section and the other drawers read as before
