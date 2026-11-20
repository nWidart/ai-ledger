# Spec Delta

## MODIFIED Requirements

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: its lede SHALL state the commits and the prompts they came from. A Sessions vital SHALL state the sessions and the active days, and the Prompts interrupted vital SHALL state the turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard. When the view has a previous period, the commits, sessions and active days SHALL each show their change against it, or "unchanged" when both periods read the same.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits and prompts of those 30 days, the Sessions vital shows their sessions and active days, and no cost figure appears before the attention summary

#### Scenario: Requests without a prompt
- **WHEN** a session works on its own on a day with no user prompt
- **THEN** that day is not an active day

#### Scenario: Compare with the period before
- **WHEN** the user opens the last 30 days and the 30 days before had 20 commits against 30 now
- **THEN** the headline shows 30 commits followed by ", up from 20 commits"

#### Scenario: All time
- **WHEN** the user opens the All range
- **THEN** the headline shows no change

### Requirement: Show change against the previous period
Activity SHALL show, on each of its tiles (sessions, errors per 100 calls, test runs passed, prompts interrupted, subagent share, median session and output speed), the change against the equal-length period before the view, and SHALL show nothing for the All range. A figure that reads the same in both periods SHALL show "unchanged".

#### Scenario: No previous period
- **WHEN** the user opens the All range
- **THEN** no tile shows a change

### Requirement: Mark a change for the worse
A change in the worse direction (errors per 100 calls up, test runs passed down, prompts interrupted up, output speed down) SHALL be marked as worse; the sessions, subagent share and median session SHALL NOT be judged.

#### Scenario: Errors rise
- **WHEN** errors per 100 calls were 4 in the previous period and are 6 now
- **THEN** the tile shows the rise and marks it as worse

### Requirement: Show work by hour and weekday
Activity SHALL show, in a "Prompts by hour" drawer closed by default, a heatmap of prompts by weekday and hour on the machine's local clock, and SHALL give it a text alternative that names the busiest hour and day, and counts the ties for them. The heatmap SHALL be one tab stop, and the arrow keys SHALL move between its cells.

#### Scenario: Late-night work
- **WHEN** 30 prompts were sent on Tuesdays at 23:00 local time and the user opens the Prompts by hour drawer
- **THEN** the Tuesday 23:00 cell is the darkest, and the text alternative names it

#### Scenario: Tie
- **WHEN** three cells each hold 5 prompts and no cell holds more
- **THEN** the text alternative names one of them and says "and 2 others"

#### Scenario: Closed by default
- **WHEN** the user opens Activity
- **THEN** the heatmap is not shown until the user opens its drawer

### Requirement: Say how sessions are counted
The Sessions drawer SHALL say, behind its How measured toggletip, that it counts a session when it has a request in the range, and that Insights counts sessions by their start time, so the two totals can differ slightly.

#### Scenario: Drawer names the counting rule
- **WHEN** the user opens the Sessions drawer and activates its How measured toggletip
- **THEN** the toggletip says a session counts when it has a request in the range and that Insights counts by start time

## ADDED Requirements

### Requirement: Order the Activity page
Activity SHALL show, in this order: the lede, the attention summary, the work chart, the vitals, then the drawers.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals
