# Spec Delta

## MODIFIED Requirements

### Requirement: Link to a project or session
The usage dashboard SHALL keep the selected project, time range, inspected project, inspected tool, MCP server or skill, and open session in the page URL, so a view can be reopened or shared into an agent prompt, and browser Back SHALL retrace filter and sheet changes. The Sessions drawer's day, search text and near-context-limit filter SHALL also be kept in the URL, written without adding history entries, and restored on reload. The day SHALL be cleared when the project, range or source changes.

#### Scenario: Open a copied URL
- **WHEN** the user opens a copied usage dashboard URL
- **THEN** the same project, range and session are selected

#### Scenario: Open a copied URL with a tool inspected
- **WHEN** the user opens a copied usage dashboard URL that was taken with the inspector open for `Bash`
- **THEN** the inspector for `Bash` opens in the same view

#### Scenario: Reload with Sessions filters
- **WHEN** the user filters Sessions to March 3 with the text `api` and near-limit only, then reloads the page
- **THEN** the Sessions drawer opens with the same three filters, and typing in the search added no Back entries

#### Scenario: Day outside the new view
- **WHEN** a day is selected and the user changes the range
- **THEN** the day filter is cleared

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: commits, prompts, sessions and active days, with turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard. When the view has a previous period, the commits, sessions and active days SHALL each show their change against it.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits, prompts, sessions and active days of those 30 days, and no cost figure appears before the attention summary

#### Scenario: Requests without a prompt
- **WHEN** a session works on its own on a day with no user prompt
- **THEN** that day is not an active day

#### Scenario: Compare with the period before
- **WHEN** the user opens the last 30 days and the 30 days before had 20 commits against 30 now
- **THEN** the headline shows commits up 50%

#### Scenario: All time
- **WHEN** the user opens the All range
- **THEN** the headline shows no change

### Requirement: Lead with what needs attention
Activity SHALL show, directly under its lead, every problem found in the view (error loops, sessions at 80% or more of the context window, tools failing over 10% of at least 20 calls, failed test runs), each with an action that opens the matching detail. The failed test runs action SHALL open a list of the newest failed runs, each with its session, command and time and a link to its error on the Errors page. When none is found it SHALL say so.

#### Scenario: Error loops present
- **WHEN** the view contains 3 error loops and 1 session near the context limit
- **THEN** the attention summary lists both problems, the error loops marked as needing action, and each offers to open its table

#### Scenario: Nothing found
- **WHEN** the view has no error loops, sessions near the limit, flaky tools or failed tests
- **THEN** the attention summary says that nothing needs attention

#### Scenario: Open the failed test runs
- **WHEN** the view has 4 failed test runs and the user chooses "See tests"
- **THEN** a drawer lists the 4 runs with session, command and time, and each links to its error on the Errors page

### Requirement: Show work per day
Activity SHALL chart commits, prompts or sessions across the view, from its first day with a session, with errors per 100 tool calls on the same chart against its own axis (the failed count stays in the tooltip). Selecting a day SHALL list that day's sessions. The all-time lead SHALL date the history from that same day. When the span from the first day with a session to the end of the range is over 60 days, the chart SHALL show one bar per week (Monday start, local time) instead of per day, and its totals SHALL equal the sum of its bars.

#### Scenario: History starts inside the range
- **WHEN** the user opens the 90-day view and the first session in it ran 40 days ago
- **THEN** the chart starts 40 days ago, with zeros for the idle days after that

#### Scenario: Pick a busy day
- **WHEN** the user selects a day with 40 commits on the work chart
- **THEN** the sessions table opens limited to the sessions that ran on that day

#### Scenario: Failure rate, not failed count
- **WHEN** a quiet day has 2 failed calls of 4 and a busy day has 6 of 200
- **THEN** the line shows 50 errors per 100 calls for the quiet day and 3 for the busy day, and each tooltip also gives the failed count

#### Scenario: Long range
- **WHEN** the user opens the All range and the first session ran 200 days ago
- **THEN** the chart shows one bar per week, a hint says to choose a shorter range to pick a day, and week bars cannot be selected

## ADDED Requirements

### Requirement: Sort tables by column
Activity SHALL let the user sort the Sessions, Project metrics and Tools tables by a column, and the sorted header SHALL carry `aria-sort`. Project metrics and Tools SHALL sort every row in the browser. Sessions SHALL sort the whole matching list on the server, not the loaded page. Project metrics SHALL open ordered by sessions, descending, and SHALL NOT show a cost column. The Sessions sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

#### Scenario: Most failing tool
- **WHEN** the user sorts Tools by failure rate
- **THEN** the tool with the highest rate is first and the header reads as sorted

#### Scenario: Default project order
- **WHEN** the user opens Project metrics
- **THEN** projects are ordered by sessions, most first, and no cost column appears

### Requirement: Show change against the previous period
Activity SHALL show, on each of its five tiles (errors per 100 calls, test runs passed, prompts interrupted, subagent share, median session), the change against the equal-length period before the view, and SHALL show nothing for the All range. A change in the worse direction (errors up, test pass rate down, interruptions up) SHALL be marked as worse.

#### Scenario: Errors rise
- **WHEN** errors per 100 calls were 4 in the previous period and are 6 now
- **THEN** the tile shows the rise and marks it as worse

#### Scenario: No previous period
- **WHEN** the user opens the All range
- **THEN** no tile shows a change

### Requirement: Show work by hour and weekday
Activity SHALL show, under the work chart, a heatmap of prompts by weekday and hour on the machine's local clock, and SHALL give it a text alternative.

#### Scenario: Late-night work
- **WHEN** 30 prompts were sent on Tuesdays at 23:00 local time
- **THEN** the Tuesday 23:00 cell is the darkest, and the text alternative names it

### Requirement: Break the work chart down by project
Activity SHALL stack the work chart's bars by the five projects with the most of the chosen metric in the view, plus Other, in the project colours used on every page. A view with one project SHALL show plain bars.

#### Scenario: Which project got the commits
- **WHEN** the user chooses Commits on a view with eight projects
- **THEN** each bar stacks the five projects with the most commits and an Other segment for the rest

#### Scenario: One project
- **WHEN** the project filter names one project
- **THEN** the bars are not stacked

### Requirement: Show the selected day's own figures
Selecting a day on the work chart SHALL show, for each of that day's sessions, that day's figures, and a session's Active time SHALL be that day's active time. Peak context and compactions SHALL stay whole-session figures, and a tooltip SHALL say so. The day SHALL also narrow Tools, MCP servers, skills and hooks, and Error loops to that day. Project metrics, the lead and the attention summary SHALL keep the range's figures.

#### Scenario: Session spanning two days
- **WHEN** a session worked 30 minutes on March 3 and 2 hours on March 4 and the user selects March 3
- **THEN** its Active time is 30 minutes and its peak context is the whole session's

#### Scenario: Error loops on one day
- **WHEN** the view has 5 error loops, 2 of them on the selected day
- **THEN** Error loops lists those 2 and the attention summary still counts 5

#### Scenario: Clear the day
- **WHEN** the user clears the selected day
- **THEN** Tools, MCP & hooks and Error loops show the range again
