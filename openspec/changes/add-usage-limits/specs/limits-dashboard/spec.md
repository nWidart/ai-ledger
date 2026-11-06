# Spec Delta

## Purpose

The Limits page shows how much of each provider's plan limits is used, when each limit will run out or reset, and where unused capacity is left. It helps the user avoid running out and use every plan fully.

## ADDED Requirements

### Requirement: Lead with the binding window
Limits SHALL open with the window that will stop the user first: the one forecast to reach 100% soonest. If none is forecast to reach 100% before it resets, it SHALL show the window closest to its cap. The lead SHALL name the provider and window, the percent used and when it resets.

#### Scenario: One window runs out
- **WHEN** Claude's weekly window is forecast to reach 100% on Sat 14:00, and every other window resets first
- **THEN** the lead says Claude weekly reaches 100% on Sat 14:00, before its reset on Sun 06:00

#### Scenario: Nothing runs out
- **WHEN** every window is forecast to reset below 100%
- **THEN** the lead says no limit runs out at the current pace, and names the highest forecast at reset

### Requirement: Show every open window with its forecast
Limits SHALL show one chart per open window. Each chart SHALL show the percent used so far, the forecast to reset with its low and high bounds, a 100% line, and the reset time. Measured points SHALL look different from estimated ones. Each chart SHALL say either "reaches 100% at …" or "resets first at about …%".

#### Scenario: Measured and estimated
- **WHEN** a Claude window has polls every 5 minutes after Nov 6 and calibrated estimates before
- **THEN** the chart marks the polled points as measured and the rest as estimated

#### Scenario: Forecast unavailable
- **WHEN** a window has no calibration
- **THEN** its chart shows the measured points, no forecast, and the reason

### Requirement: Show headroom and pace
For each open window, Limits SHALL show the percent left, the time left to reset, the current rate, and the pace that ends at exactly 100% at reset. It SHALL say whether the user is ahead of or behind that pace.

#### Scenario: Behind pace
- **WHEN** Codex weekly is at 20% with 3.5 of 7 days left
- **THEN** Limits shows 80% left over 3.5 days, a target pace of about 23% a day, and says the user is behind that pace

### Requirement: Suggest where to send work
Limits SHALL suggest the provider with the most headroom left at the current pace. It SHALL not suggest a provider whose binding window is forecast to reach 100% before it resets. It SHALL suggest nothing unless at least two providers have a forecast.

#### Scenario: Only one provider forecast
- **WHEN** Claude weekly has a forecast and Codex is not calibrated yet
- **THEN** Limits suggests no provider

#### Scenario: Codex has room
- **WHEN** Claude weekly is forecast to reach 100% before it resets and Codex weekly is forecast to reset at 30%
- **THEN** Limits suggests Codex and shows the 70% it would leave unused

### Requirement: Show limit history
Limits SHALL list the closed windows of the selected range, newest first. Each row SHALL give the window's provider, kind, plan and final percent, and say whether it hit 100% and for how long it stayed there. Plan changes and early resets SHALL be marked on the charts and in the list.

#### Scenario: Window left unused
- **WHEN** a Codex weekly window closed at 22% because of a plan change
- **THEN** the history shows it closed at 22%, ended early by a plan change from `plus` to `prolite`

#### Scenario: Limit hit
- **WHEN** a Codex 5-hour window reached 100% at 23:52 and reset at 04:07
- **THEN** the history shows a hit of about 4 hours 15 minutes

### Requirement: Show unused capacity
Limits SHALL show, for the selected range, the average percent left at reset for each provider and window kind.

#### Scenario: Four weekly windows
- **WHEN** four Codex weekly windows closed at 30%, 40%, 50% and 40%
- **THEN** Limits shows an average of 60% left unused

### Requirement: Show value per 1%
For each calibrated limit, Limits SHALL show the tokens and estimated cost one percentage point buys, broken down by model. Per project, it SHALL show commits per percentage point. A figure without enough data SHALL show as not available.

#### Scenario: Model breakdown
- **WHEN** Claude weekly is calibrated at $8 per 1% and two models used it
- **THEN** Limits shows tokens and cost per 1% for each model

### Requirement: Show freshness of limit data
Limits SHALL show, per provider, when the last snapshot was taken and whether the current figure is measured or estimated. It SHALL flag a provider whose polling is failing, or whose last snapshot is older than twice its poll interval.

#### Scenario: Polling failing
- **WHEN** the last three Claude polls failed
- **THEN** Limits shows Claude's figures as estimated, gives the time of the last successful poll, and says polling is failing

### Requirement: Filter Limits by time range and source
Limits SHALL apply the shared time range to the history, unused-capacity and value sections, and the source filter to every section. Open windows SHALL always show, whatever the range. The project filter SHALL apply only to commits per percentage point, because limits are per account.

#### Scenario: Codex only
- **WHEN** the user picks source Codex on Limits
- **THEN** only Codex windows, history and value appear, and the URL records `source=codex`

#### Scenario: Project filter set
- **WHEN** the shared project filter is `foo`
- **THEN** the windows show account-wide usage, and commits per percentage point shows only `foo`
