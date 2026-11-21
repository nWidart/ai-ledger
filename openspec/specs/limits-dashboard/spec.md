# limits-dashboard Specification

## Purpose

The Limits page shows how much of each provider's plan limits is used, when each limit will run out or reset, and where unused capacity is left. It helps the user avoid running out and use every plan fully.

## Requirements

### Requirement: Lead with the binding window
Limits SHALL open with the window that will stop the user first: one already at its limit, else the one forecast to reach 100% soonest. If none is at or forecast to reach 100% before it resets, it SHALL show the fullest window after "Fullest: …": the one with the highest forecast percent at its reset, or its current percent when it has no forecast. The lead SHALL name the provider and window and give at most two figures, as the scenarios show.

#### Scenario: One window runs out
- **WHEN** Claude's weekly window is at 90% and forecast to reach 100% on Sat 14:00, and every other window resets first
- **THEN** the lead says Claude weekly, at 90% now, runs out on Sat 14:00, and gives no third figure

#### Scenario: Nothing runs out
- **WHEN** every window is forecast to reset below 100%
- **THEN** the lead says no limit runs out at the current pace, and reads "Fullest:" followed by the window with the highest forecast at reset and that forecast percent

#### Scenario: Window without a forecast
- **WHEN** no window runs out and the fullest one has no forecast
- **THEN** the lead names the window with the highest current percent after "Fullest:", with its percent now

#### Scenario: A window at its limit
- **WHEN** Codex 5-hour is at 100% and resets at 04:08
- **THEN** the lead says Codex 5-hour is at its limit until 04:08, and its card says so in the critical style

### Requirement: Show every open window with its forecast
Limits SHALL show one card per open window. Its header SHALL give the window's name and plan, with the plan's tier when it has one ("max 20x"), its percent used now, and an "estimated" chip when that percent is estimated.

#### Scenario: An estimated percent
- **WHEN** a window's percent now is estimated from local work since its last reading
- **THEN** its header shows the percent with an "estimated" chip

#### Scenario: A plan tier
- **WHEN** a Claude Code window's plan is `max/default_claude_max_20x`
- **THEN** its header names the plan "max 20x", in visible text, not only in a hover title

### Requirement: Show one forecast status per window
The header of an open window's card SHALL give one status: "runs out <time>" when the forecast's middle reaches 100% before the reset, "at its limit until <time>", "about <n>% at reset", or "no forecast". "runs out" and "at its limit" SHALL be in the critical style with a marker, so the colour is not the only signal. A percent at reset from 99.5% up to 100% SHALL read 99%.

#### Scenario: Forecast unavailable
- **WHEN** a window has no calibration
- **THEN** its chart shows the past line and no cone, its header reads "no forecast", and its Details give the reason

#### Scenario: A window that runs out
- **WHEN** Claude weekly is at 88% and its forecast reaches 100% at Sat 2:00 PM, before its reset
- **THEN** its header reads 88% and "runs out Sat, … 2:00 PM" in the critical style with a marker

### Requirement: Draw at most four encodings per chart
Each open-window chart SHALL draw at most four encodings: the percent used so far as one line (solid between two measured points, dashed elsewhere), the forecast as a shaded cone from its low to its high bound with its dotted middle, a `now` tick, and the safe-pace line. The last-24-hours line, drawn only while its toggle is on, SHALL be the one encoding beyond these.

#### Scenario: Measured and estimated
- **WHEN** a Claude window has polls every 5 minutes after Nov 6 and calibrated estimates before
- **THEN** the chart draws the polled stretch as a solid line and the rest as a dashed line of the same color, with no dots

### Requirement: Keep the chart lines apart and legible
The percent line SHALL be drawn as contiguous runs, so measured points either side of an estimate never draw a solid line over it. Lines SHALL differ by dash and width, not by opacity, and each line SHALL keep a contrast of at least 3:1 against the card in the light and the dark theme, also while the page dims its figures for a slow load.

#### Scenario: An estimate between two readings
- **WHEN** a window's points are measured 20%, estimated 25% and measured 40%
- **THEN** the chart draws a dashed line from 20% through 25% to 40%, and no solid line from 20% to 40%

#### Scenario: A slow range change
- **WHEN** the user picks another range and its data takes a while
- **THEN** the page dims its text and fills while it waits, and the charts' lines keep their contrast

### Requirement: Frame the chart without a key
A 100% grid line with its axis label and the reset time on the right edge SHALL frame the plot. The page SHALL show no chart key.

#### Scenario: Chart frame
- **WHEN** an open-window chart is drawn
- **THEN** a 100% grid line with its axis label and the reset time frame the plot, and no chart key shows

### Requirement: Show headroom and pace
Each open-window card SHALL show a three-column footer. Headroom SHALL give the percent left and the time to reset. Pace SHALL give the forecast's pace against the safe pace, per hour under a day, critical when above the safe pace; a window at its limit or without a forecast SHALL show none. Top SHALL give the top project and its share, or "–". Details SHALL give the usual and recent paces and whether the user is ahead of or behind the safe pace.

#### Scenario: Behind pace
- **WHEN** Codex weekly is at 20% with 3.5 of 7 days left and a forecast pace of 10% a day
- **THEN** its footer reads "80% left · 3d 12h" and "10%/d vs 22.9%/d safe", not in the critical style, and its Details say the user is behind pace

#### Scenario: Both paces
- **WHEN** a weekly window's usual pace is 6.8% a day and it used 34% over its last day
- **THEN** its Details give a usual pace of 6.8% a day and this window at 34% a day over its last day

#### Scenario: A short window
- **WHEN** a 5-hour window's forecast pace is 48% a day and its safe pace 480% a day
- **THEN** its footer reads "2%/h vs 20%/h safe"

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
Limits SHALL list the closed windows of the selected range, newest first, in a table behind a "Show data table" toggle in the "Past windows" section, closed on every load. Each row SHALL give the window's provider, kind, plan and final percent, and say whether it hit 100% and for how long it stayed there. Plan changes SHALL be marked on the charts and early resets in the list.

#### Scenario: Window left unused
- **WHEN** a Codex weekly window closed at 22% because of a plan change
- **THEN** the history shows it closed at 22%, ended early by a plan change from `plus` to `prolite`

#### Scenario: Limit hit
- **WHEN** a Codex 5-hour window reached 100% at 23:52 and reset at 04:07
- **THEN** the history shows a hit of about 4 hours 15 minutes

### Requirement: Show unused capacity
Each strip row in "Past windows" SHALL end with "avg <n>% unused · <k> hits": the average percent left at reset over the limit's full-length windows in the range, and how many of its closed windows in the range hit their limit. A limit with no full-length window SHALL read "no full-length windows". The row's title SHALL say what the average covers and leaves out. A model-scoped window with nothing used and no counted use of its model SHALL be skipped. Limits SHALL show no "Left unused" panel.

#### Scenario: Four weekly windows
- **WHEN** four Codex weekly windows closed at 30%, 40%, 50% and 40%, and none hit its limit
- **THEN** the Codex weekly strip reads "avg 60% unused · 0 hits"

#### Scenario: A window cut short
- **WHEN** one more Codex weekly window ended after a day at 10% because of a plan change
- **THEN** the average stays 60%, and the row's title says 1 window that ended early is left out

### Requirement: Show value per 1%
For each calibrated limit, Limits SHALL show the tokens and estimated cost one percentage point buys by model, and the points each model used inside that limit's windows on its plan, over the range set in "Past windows". An unpriced model and a limit from an earlier plan SHALL be marked. Per project, it SHALL show commits per point for every project, folding each provider's projects under one point into a "smaller projects" row. A figure without enough data SHALL show as not available.

#### Scenario: Model breakdown
- **WHEN** Claude weekly is calibrated at $8 per 1% and two models used it
- **THEN** Limits shows tokens and cost per 1% for each model

#### Scenario: Use on another plan
- **WHEN** Codex 5-hour belongs to plan `plus`, and the user spent on plan `prolite`, which has no 5-hour limit
- **THEN** the 5-hour points used leave out the `prolite` spend, and the limit is marked as an earlier plan

#### Scenario: Small projects folded
- **WHEN** three projects of one provider used under one point each
- **THEN** the table lists the larger projects and one "3 smaller projects" row for that provider

#### Scenario: Project filter
- **WHEN** the page's address carries `project=foo` from another page
- **THEN** the table still lists every project, and the page asks `/api/limits` for no project

### Requirement: Show freshness of limit data
Limits SHALL show, per provider, when the last snapshot was taken, how long ago, and whether the current figure is measured or estimated. It SHALL flag a provider whose polling is failing, or whose last snapshot is older than twice its poll interval. A reading from a provider that is not polled SHALL count as estimated once it is over an hour old.

#### Scenario: Polling failing
- **WHEN** the last three Claude polls failed
- **THEN** Limits shows Claude's figures as estimated, gives the time of the last successful poll, and says polling is failing

#### Scenario: An old Codex reading
- **WHEN** the last Codex reading is 5 hours old
- **THEN** Limits shows it was taken 5 hours ago, and Codex figures as estimated

### Requirement: Filter Limits by time range and source
The scope bar SHALL show the Source filter only on Limits. Source SHALL apply to every section. The time range SHALL be set in the "Past windows" section header and SHALL apply to the past windows and to "What a point buys". Open windows SHALL always show, whatever the range. Limits SHALL have no project filter.

#### Scenario: Codex only
- **WHEN** the user picks source Codex on Limits
- **THEN** only Codex windows, history and value appear, and the URL records `source=codex`

#### Scenario: Project filter set
- **WHEN** the shared project filter is `foo` on another page and the user opens Limits
- **THEN** Limits shows no project filter, every section reads as with no project, and the URL keeps `project=foo` for the other pages

#### Scenario: Range in Past windows
- **WHEN** the user picks 7d in the "Past windows" header
- **THEN** the strips, the table and "What a point buys" cover the last 7 days, the open windows do not change, and the URL records `range=7`

### Requirement: Show the cap in money and its calibration
Each calibrated open-window card SHALL show, in its Details, one muted line: "100% ≈ <money> <period> at list prices, from <N> over <M>". The money SHALL be the calibrated value per percent times 100. The period SHALL follow the window length. A card with no calibration SHALL NOT show the line.

#### Scenario: A weekly window
- **WHEN** a weekly window is calibrated at 4.2 dollars per percent from 37 points over 2 windows
- **THEN** its Details show "100% ≈ $420 a week at list prices, from 37 points over 2 windows"

#### Scenario: The period follows the window length
- **WHEN** a window is 10080 minutes, 1440, 43200, 300, another whole number of hours, or of unknown length
- **THEN** its line reads "a week", "a day", "per 30 days", "per 5 hours", "per <h> hours", or "a window"

#### Scenario: A thin calibration
- **WHEN** a window is calibrated from one window
- **THEN** the line says "over 1 window", with no added wording

#### Scenario: A window that is not calibrated
- **WHEN** a window has no calibration
- **THEN** its Details show no cap-money line

#### Scenario: A window at its limit that is not calibrated
- **WHEN** a window reports 100% before any priced usage is counted, so it has no calibration
- **THEN** its Details show no cap-money line, and its header says "at its limit until …"

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

### Requirement: Say what the last-24-hours scenario reaches
A card's Details SHALL say "If the last 24 hours continue: reaches 100% at <time>" when the scenario reaches 100% before the reset, in the warning style, or "If the last 24 hours continue: about <n>% at its reset" when it does not, whatever the toggle. A window at its limit, a window with no forecast and a window with no scenario SHALL show no such line. A percent at its reset from 99.5% up to 100% SHALL read 99%, so the line claims 100% only when it reaches it.

#### Scenario: The scenario reaches 100%
- **WHEN** a window's scenario reaches 100% at Sat, Nov 7, 3:00 PM before the reset
- **THEN** its Details read "If the last 24 hours continue: reaches 100% at Sat, Nov 7, 3:00 PM" in the warning style

#### Scenario: The reset comes first
- **WHEN** a window's scenario stays at 41.26% at the reset
- **THEN** its Details read "If the last 24 hours continue: about 41% at its reset", not in the warning style

#### Scenario: A window at its limit
- **WHEN** a window is at its limit
- **THEN** its Details have no scenario line

### Requirement: Keep the last-24-hours scenario apart from the card's other text
"How measured" SHALL say that the last-24-hours line carries the use of the last 24 hours on to the reset. The scenario SHALL NOT change the heading, the card header, the footer or the suggestion.

#### Scenario: The hint
- **WHEN** Limits shows open windows with the scenario
- **THEN** "How measured" says that the line carries the use of the last 24 hours on to the reset, and the heading, card headers, footers and suggestion read as without the scenario

### Requirement: Show what used each open window
The footer's Top column SHALL give the window's top project and its share of the window's counted use ("ai-ledger 54%"), when the use has a project, else "–". The card's Details SHALL list what used the window when it has counted use since its start. A card with no counted use since its start SHALL have no such list.

#### Scenario: A window that runs hot
- **WHEN** a weekly window that started 5 days ago has counted use, 54% of it in the project ai-ledger
- **THEN** its footer's Top reads "ai-ledger 54%", and its Details list the top projects and models with their shares and points

#### Scenario: Nothing counted
- **WHEN** no use was counted since the window started
- **THEN** its footer's Top reads "–" and its Details have no list of what used it

### Requirement: List what used an open window
In the card's Details, Limits SHALL list the top three projects and the top three models by estimated cost, each with its share as a percent and, when the window is calibrated, its points ("≈ 12.3 points"), and give its cost at API list prices as the row's title. It SHALL say that only counted local agent use at list prices is in it and that use elsewhere is not.

#### Scenario: Not calibrated
- **WHEN** a window is not calibrated yet
- **THEN** its Details list shares and costs and no points

### Requirement: Scope what used an open window to the window
The use in the Details is that from the window's start to now, for the provider's agent and the models the limit covers. It SHALL NOT follow the page's range.

#### Scenario: A filtered page
- **WHEN** the page has a range set
- **THEN** the Details' use is still that from the window's start to now, for the provider's agent and the models the limit covers

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
An open-window card whose window has a share of the weekly allowance SHALL say, in a small muted line in its Details, "This limit is <allowance>% of the weekly allowance; <used>% of the weekly allowance is used through it". A card without a share SHALL show no such line.

#### Scenario: A scoped card
- **WHEN** the Fable window has a share of 21% used of a 50% allowance
- **THEN** its Details read "This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it"

#### Scenario: No field
- **WHEN** a window has no share and no surfaces
- **THEN** its Details show neither line

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
The lines SHALL NOT change the heading, the card header, the footer or the freshness line, and "How measured" SHALL still say that estimates count local agent work only.

#### Scenario: A card with both lines
- **WHEN** a card shows the share line and the surfaces line
- **THEN** its heading, card header, footer and freshness line read as without them, and "How measured" still says that estimates count local agent work only

### Requirement: Show past windows as bars with a curve on demand
A "Past windows" section, always shown on the page and not in a drawer, SHALL show one row per limit (its provider, limit id and scope) that has closed windows in the selected range, in the order the open windows use (provider, then longest window first, then scope), each with the limit's name (that of its newest closed window), a strip of small bars, oldest left and newest right, and its unused and hits summary. With no closed window in the range, it SHALL say so.

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
A strip too wide for its box SHALL scroll inside that box, not the page, showing its newest bars when the box first has a width. It SHALL never move back there after the user has scrolled it, focused a bar or pressed a key in it, and moving between its bars by keyboard SHALL bring the focused bar into view.

#### Scenario: Opened after load
- **WHEN** the page loads, or the section first gets a width, and a strip is wider than its box
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
Picking a bar SHALL show that window's curve in a panel under the strips: a heading with the window's name, its start and end, its final percent and its notes, and the chart the open windows use, from the window's start to its end, without a forecast or a "now" line, with the plan changes inside it marked and the chart readable by hover and keyboard as the open windows' charts are. A "Show data table" button under the chart SHALL offer its times and percents as a table, with no safe-pace column.

#### Scenario: A curve
- **WHEN** the bar of a Codex weekly window that a plan change ended early is picked
- **THEN** a panel names the window, its dates, 22% and the plan change, shows "Loading the curve…" and then its chart with the plan change marked, with no forecast and no "now" line

#### Scenario: The curve as a table
- **WHEN** the user selects "Show data table" under a picked window's curve
- **THEN** a table lists its times with the percent used, and no safe-pace column

### Requirement: Fetch a picked window's curve when it is picked
The curve SHALL be fetched when the bar is picked, and the panel SHALL show that it is loading, and, when the latest fetch fails, say so and offer Retry, even if an earlier answer is held (it SHALL NOT show a chart its latest fetch failed to refresh).

#### Scenario: A failed fetch
- **WHEN** the curve cannot be fetched, or a refetch after an ingest of a curve already shown fails
- **THEN** the panel says so, without the old chart, and Retry fetches it again

### Requirement: Close a picked window's curve panel
Picking the same bar again, or the panel's Close button, SHALL close the panel, and Close SHALL return focus to the bar. The picked window SHALL NOT be part of the page's address. A range or source that leaves the picked window out of the strips SHALL close the panel.

#### Scenario: Close
- **WHEN** the panel's Close button is pressed
- **THEN** the panel closes and the window's bar has focus

#### Scenario: The window leaves the range
- **WHEN** a bar is picked and the source filter then excludes its provider
- **THEN** the panel closes

### Requirement: Mark the picked window without changing the rest of Limits
The table row of the picked window SHALL be marked. The table, the strips' summaries and the drawers SHALL NOT change.

#### Scenario: A picked window
- **WHEN** a bar is picked
- **THEN** the window's table row is marked, and the table, the strips' summaries and the drawers read as before

### Requirement: Draw the safe pace
Each open-window chart with a percent now SHALL draw a thin, long-dashed straight line from the point now at that percent to 100% at the reset: the pace that ends at exactly 100%. A curve steeper than the line runs hot. A window at its limit, a window with no percent now and a closed window's chart SHALL have no such line. The chart's data table SHALL give the line's value at each time after now.

#### Scenario: A window running hot
- **WHEN** a weekly window is at 40% at Wed noon and resets Sun noon
- **THEN** its chart draws a straight line from 40% at Wed noon to 100% at Sun noon, and its forecast cone rises above it

#### Scenario: A window at its limit
- **WHEN** a window is at its limit
- **THEN** its chart has no safe-pace line

### Requirement: Tint a cone that reaches 100% before the reset
The forecast cone SHALL take the warning tint when its high bound reaches 100% before the reset, and the neutral tint otherwise. The tint SHALL NOT be the only signal: the card header still says "runs out" when the middle reaches 100%, and the Details caption gives when the high and low bounds do.

#### Scenario: Only the high bound reaches 100%
- **WHEN** a window's forecast middle resets at 92% and its high bound reaches 100% on Sat
- **THEN** its cone has the warning tint, its header reads "about 92% at reset", and its Details caption gives the range up to 100%

#### Scenario: Nothing reaches 100%
- **WHEN** a window's high bound stays under 100% at reset
- **THEN** its cone has the neutral tint

### Requirement: Mark plan changes without a key
A plan change inside a window SHALL be drawn as a short tick at the top of the plot labelled "plan: <plan>", with a tooltip and the chart's accessible name giving the change in words.

#### Scenario: A plan change
- **WHEN** the plan changed from `plus` to `prolite` inside a window
- **THEN** its chart shows a tick at that time labelled "plan: prolite", and its accessible name says "Plan change from plus to prolite, <time>"

### Requirement: Keep the rest of a card behind Details
Each open-window card SHALL have one "Details" button in its footer that shows and hides a region under the footer, closed on every load, with `aria-expanded` and `aria-controls` while open. The region SHALL hold the forecast caption with its range, the last-24-hours line, the paces, the weekly share and surfaces lines, the cap-money line, what used the window with its links to Cost, and the chart's data as a table.

#### Scenario: Opening Details
- **WHEN** the user presses a card's "Details"
- **THEN** the region under the footer shows the caption, the paces, the cap money and the chart's data table, and the button reads as expanded

### Requirement: Offer each chart's data as a table
Each open-window card's Details SHALL hold a table of its chart: at most 12 times spread from the window's start to its reset, and now, each with the time, the percent and its kind (measured, estimated, or forecast with its likely range), and the safe-pace percent for times after now.

#### Scenario: A weekly window
- **WHEN** a weekly window's Details are open
- **THEN** its table lists the window's start, about one time a day and now, each with a percent, and forecast rows to the reset with their likely range and the safe-pace percent

### Requirement: Explain the method behind How measured
The forecast method, the last-24-hours line and the note that estimates count local agent work only SHALL sit behind the shared "How measured" toggletip at the end of the hint under "Open windows". The hint SHALL be one line.

#### Scenario: The method
- **WHEN** the user activates "How measured"
- **THEN** it says how forecasts are made, what the cone and the safe-pace line mean, what the last-24-hours line carries, and that estimates count local agent work only

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
