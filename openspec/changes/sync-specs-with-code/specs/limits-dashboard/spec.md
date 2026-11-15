## MODIFIED Requirements

### Requirement: Lead with the binding window
Limits SHALL open with the window that will stop the user first: one already at its limit, else the one forecast to reach 100% soonest. If none is at or forecast to reach 100% before it resets, it SHALL show the fullest window: the one with the highest forecast percent at its reset, or its current percent when it has no forecast. That lead SHALL read "Fullest: …". The lead SHALL name the provider and window, the percent used now and when it resets.

#### Scenario: One window runs out
- **WHEN** Claude's weekly window is at 90% and forecast to reach 100% on Sat 14:00, and every other window resets first
- **THEN** the lead says Claude weekly, at 90% now, reaches 100% on Sat 14:00, before its reset on Sun 06:00

#### Scenario: Nothing runs out
- **WHEN** every window is forecast to reset below 100%
- **THEN** the lead says no limit runs out at the current pace, and reads "Fullest:" followed by the window with the highest forecast at reset

#### Scenario: Window without a forecast
- **WHEN** no window runs out and the fullest one has no forecast
- **THEN** the lead names the window with the highest current percent after "Fullest:"

#### Scenario: A window at its limit
- **WHEN** Codex 5-hour is at 100% and resets at 04:08
- **THEN** the lead says Codex 5-hour is at its limit until 04:08, and its card says so in the critical style

### Requirement: Show value per 1%
For each calibrated limit, Limits SHALL show the tokens and estimated cost one percentage point buys, broken down by model, and the points each model used inside that limit's windows on its plan. A model without a price SHALL be marked unpriced, and a limit from an earlier plan SHALL say so. Per project, it SHALL show commits per percentage point, listing projects that used at least one point. Without a project filter, it SHALL fold the rest into one "smaller projects" row for each provider; with a project filter, it SHALL list only that project. A figure without enough data SHALL show as not available.

#### Scenario: Model breakdown
- **WHEN** Claude weekly is calibrated at $8 per 1% and two models used it
- **THEN** Limits shows tokens and cost per 1% for each model

#### Scenario: Use on another plan
- **WHEN** Codex 5-hour belongs to plan `plus`, and the user spent on plan `prolite`, which has no 5-hour limit
- **THEN** the 5-hour points used leave out the `prolite` spend, and the limit is marked as an earlier plan

#### Scenario: Small projects folded
- **WHEN** no project filter is set and three projects of one provider used under one point each
- **THEN** the table lists the larger projects and one "3 smaller projects" row for that provider

#### Scenario: Project filter
- **WHEN** the user filters to a project that used under one point
- **THEN** the table lists that project alone, with no "smaller projects" row

### Requirement: Show a status strip of open windows
Limits SHALL show a status strip under its heading: a list labelled "Open windows at a glance" with one chip per open window, in payload order. Each chip SHALL show the window name, the percent used now ("–" with no reading) and "resets in". A chip at its limit or forecast to hit 100% before reset SHALL have the warning tone and say "at limit" or "runs out". The navigation's dot on the Limits tab is a separate signal: it uses the critical tone for a window at its limit or forecast to run out, and the warning tone only for a high one. An estimated chip SHALL carry an "est." marker. With no open window the strip SHALL NOT render.

#### Scenario: One chip per window
- **WHEN** three windows are open
- **THEN** the strip lists three chips in payload order, each with its percent used and "resets in"

#### Scenario: A window at its limit
- **WHEN** Codex weekly is at 100% until its reset
- **THEN** its chip has the warning tone and says "at limit", while the navigation's dot is critical

#### Scenario: A window that runs out
- **WHEN** Claude weekly is forecast to reach 100% before its reset
- **THEN** its chip has the warning tone and says "runs out", while the navigation's dot is critical

#### Scenario: No open windows
- **WHEN** no window is open
- **THEN** the page shows no strip
