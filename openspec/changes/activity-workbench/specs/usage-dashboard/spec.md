# Spec Delta

## ADDED Requirements

### Requirement: Draw work and errors on two tracks
The work chart SHALL draw its bars on a top track and errors per 100 tool calls on a thin track under it, sharing one x-axis. The rate track SHALL have its own scale on the left and no right-hand axis. One hover, tooltip and keyboard reading SHALL cover both tracks, and a view with no tool calls SHALL show no rate track or legend entry.

#### Scenario: Two tracks
- **WHEN** the user opens Activity for a view with tool calls
- **THEN** the bars and the rate line sit on separate tracks under one row of bucket labels, and reading a bucket by keyboard gives its count and its errors per 100 calls

#### Scenario: No tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart shows the bars only, with no rate track and no rate legend entry

### Requirement: Select a week on the work chart
A weekly work chart SHALL let the user select a week by clicking its bar, or by Enter on the bar the arrow keys read. The selection SHALL narrow every workbench tab to that week's days in the view, and SHALL be kept in the URL as `week=` with the week's Monday, written without a history entry. Selecting a week SHALL clear a selected day, and selecting a day a selected week.

#### Scenario: Pick a week by keyboard
- **WHEN** the chart is weekly and the user focuses it, presses Right twice and Enter
- **THEN** the second week is selected, the URL holds `week=` with its Monday, and the Sessions tab lists that week's sessions

#### Scenario: A week cut by the range
- **WHEN** the range starts on a Wednesday and the user selects its first week
- **THEN** the tabs cover Wednesday to Sunday, not the days before the range

### Requirement: Show the selection as a chip
While a day or a week is selected, the chart header SHALL show a chip naming it, "Week of Nov 9" or "Nov 4", with a button that clears it. Escape on the chart, while no bucket is being read, SHALL clear it too. Escape elsewhere, such as closing a sheet, SHALL NOT clear it. Each narrowed tab panel SHALL say which days it shows.

#### Scenario: Clear with the chip
- **WHEN** a week is selected and the user activates the chip's button
- **THEN** the week is cleared, the tabs show the range again and the URL drops `week`

#### Scenario: Clear with Escape
- **WHEN** a week is selected and the user presses Escape twice on the chart after reading a bucket
- **THEN** the first Escape ends the reading and the second clears the week

### Requirement: Link each vital to its destination
Each vital SHALL be a link or a button to the place that explains it: Sessions to the Sessions tab, Errors per 100 calls to the Errors page for the same view, Test runs passed to the failed test runs, Subagents to Project metrics sorted by subagent share, and Output speed to the Sessions tab sorted by active time. Activity SHALL show at most six vitals.

#### Scenario: Tests tile
- **WHEN** the user activates the Test runs passed tile
- **THEN** the Loops and tests tab opens and focus moves to its Failed test runs list

#### Scenario: Errors tile
- **WHEN** the user views project `foo` for the last 30 days and activates Errors per 100 calls
- **THEN** the Errors page opens for `foo` over the last 30 days

### Requirement: Show the output speed trend
The Output speed vital SHALL show a sparkline of output speed per chart bucket, when at least two buckets hold a session that records model time. A session SHALL count in the bucket of its first request in the view. The sparkline SHALL be hidden from assistive technology.

#### Scenario: Speed per week
- **WHEN** the chart is weekly and three weeks hold sessions that record model time
- **THEN** the Output speed vital draws a three-point sparkline

### Requirement: Show the workbench as tabs
Under the vitals, Activity's Overview SHALL show its tables as tabs, in a tab list named "Activity detail": Sessions, Projects, Tools and MCP (tools, MCP servers, skills and hooks), and Loops and tests. Sessions SHALL be the default. The tabs SHALL follow the WAI-ARIA tabs pattern: one tab stop, Left and Right to move with wrap, Home and End, Enter or Space to activate.

#### Scenario: Keyboard
- **WHEN** focus is on the Sessions tab and the user presses Left, then Enter
- **THEN** focus moves to Loops and tests, and Enter shows its panel and marks it selected

#### Scenario: Default
- **WHEN** the user opens `/usage?range=30`
- **THEN** the Sessions tab is selected and its panel lists the sessions

### Requirement: Keep the workbench tab in the URL
The active tab SHALL be kept in the URL as `tab=projects`, `tab=tools` or `tab=loops`, with no key for Sessions, written without a history entry and restored on reload. An unknown tab SHALL read as Sessions.

#### Scenario: Reload on a tab
- **WHEN** the user picks Projects and reloads the page
- **THEN** the URL holds `tab=projects` and the Projects tab is selected

#### Scenario: Unknown tab
- **WHEN** the user opens `/usage?tab=hours`
- **THEN** the Sessions tab is selected

### Requirement: Preview error loops and failed test runs
The Loops and tests tab SHALL show the five newest error loops and the five newest failed test runs, each list headed with its count and followed by a "Show all N" button with `aria-expanded` when it holds more. The button SHALL expand the list in place to every row the payload carries.

#### Scenario: More loops than the preview
- **WHEN** the view has 12 error loops and the user opens Loops and tests
- **THEN** 5 loops show, and "Show all 12" shows the rest

## MODIFIED Requirements

### Requirement: Keep the Sessions filters in the URL
The Sessions tab's search text and near-context-limit filter, and the selected day or week, SHALL also be kept in the URL, written without adding history entries, and restored on reload. A day or week that is not a real calendar date SHALL read as none.

#### Scenario: Reload with Sessions filters
- **WHEN** the user filters Sessions to March 3 with the text `api` and near-limit only, then reloads the page
- **THEN** the Sessions tab shows the same three filters, and typing in the search added no Back entries

#### Scenario: Impossible day
- **WHEN** the user opens a URL with `day=2026-02-30`
- **THEN** Activity shows no selected day

### Requirement: Clear the day when the view changes
The day and the week SHALL be cleared in the same URL write as any change of project, range or source, from whichever control makes it, so browser Back restores the earlier view with its selection.

#### Scenario: Day outside the new view
- **WHEN** a day is selected and the user changes the range
- **THEN** the day filter is cleared in the same step, and Back returns to the earlier range with its day

#### Scenario: Week outside the new view
- **WHEN** a week is selected and the user changes the project
- **THEN** the week is cleared in the same step

### Requirement: Count sessions and active days
A Sessions vital SHALL state the view's sessions, active days and median session. A line under the lede SHALL state the share of prompts interrupted, with the turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. When the view has a previous period, the sessions, active days and share interrupted SHALL each show their change, or "unchanged".

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the Sessions vital shows the sessions, active days and median session of those 30 days, the sessions and active days each with their change

#### Scenario: Requests without a prompt
- **WHEN** a session works on its own on a day with no user prompt
- **THEN** that day is not an active day

### Requirement: Lead with what needs attention
Activity SHALL show, directly under its lead, every problem found in the view (error loops, sessions at 80% or more of the context window, tools failing over 10% of at least 20 calls, failed test runs), each with an action that opens the matching tab. When none is found it SHALL say so.

#### Scenario: Error loops present
- **WHEN** the view contains 3 error loops and 1 session near the context limit
- **THEN** the attention summary lists both problems, the error loops marked as needing action, and each offers to open its tab

#### Scenario: Nothing found
- **WHEN** the view has no error loops, sessions near the limit, flaky tools or failed tests
- **THEN** the attention summary says that nothing needs attention

### Requirement: List the failed test runs
The failed test runs SHALL be listed newest first, each with its session, command and time and a link to its error on the Errors page; the list's count SHALL be every failed run in the view, and a list cut at the newest 50 SHALL say so.

#### Scenario: Open the failed test runs
- **WHEN** the view has 4 failed test runs and the user chooses "See tests"
- **THEN** the Loops and tests tab lists the 4 runs with session, command and time, and each links to its error on the Errors page

#### Scenario: More failed runs than the list holds
- **WHEN** the view has 60 failed test runs and the user shows them all
- **THEN** the list's count is 60 and it lists the 50 newest, saying "Showing the 50 newest of 60"

### Requirement: Show work per day
Activity SHALL chart commits, prompts or sessions across the view, from its first day with a session, with errors per 100 tool calls on the rate track (the failed count stays in the tooltip). Selecting a day SHALL list that day's sessions. The all-time lead SHALL date the history from that same day.

#### Scenario: History starts inside the range
- **WHEN** the user opens the 90-day view and the first session in it ran 40 days ago
- **THEN** the chart starts 40 days ago, with zeros for the idle days after that

#### Scenario: Pick a busy day
- **WHEN** the user selects a day with 40 commits on the work chart
- **THEN** the tabs narrow to that day, the active tab stays, and the Sessions tab lists only the sessions that ran on that day, with no search or near-limit filter

#### Scenario: Failure rate, not failed count
- **WHEN** two busy days have 6 failed calls of 200 and 5 of 100
- **THEN** the rate track shows 3 and 5 errors per 100 calls, and each tooltip also gives the failed count

### Requirement: Mark work chart bars with few tool calls
On the rate track, a bucket with fewer than 50 tool calls SHALL draw its rate as a hollow dot and SHALL NOT set the track's scale, when at least one bucket has 50 or more. The line SHALL still run through the dot, and a rate above the scale SHALL stop at the track's top.

#### Scenario: Quiet day does not set the scale
- **WHEN** a quiet day has 2 failed calls of 4 and the busy days have 6 of 200 and 5 of 100
- **THEN** the quiet day's rate is a hollow dot with the line through it, the rate scale ends near 10 and not 100, the legend gives a key for the hollow dot, and the day's tooltip gives 50 errors per 100 calls and says it has too few calls for a steady rate

#### Scenario: Every bar is quiet
- **WHEN** no bucket has 50 tool calls
- **THEN** the chart marks no hollow dot and its rate scale fits the highest rate

### Requirement: Chart a long range by week
When the span from the first day with a session to today is over 60 days, the chart SHALL show one bar per week (Monday start, local time) instead of per day, and its totals for commits and prompts SHALL equal the sum of its bars; a session counts once in each bucket it touches. The week that holds the end of the range SHALL read "so far", and a first week cut by the start of the range SHALL read "from" that date.

#### Scenario: Partial weeks
- **WHEN** the weekly chart's range ends on a Wednesday
- **THEN** that week's label reads "so far"

#### Scenario: Long range
- **WHEN** the user opens the All range and the first session ran 200 days ago
- **THEN** the chart shows one bar per week, and a hint says to select a week to narrow the tabs

### Requirement: Sort Sessions over the whole list
Sessions SHALL sort the whole matching list on the server, not the loaded page; the server SHALL answer 400 for a sort it does not know. The "near limit" action and a day or week picked on the chart SHALL clear the Sessions sort; the Output speed vital SHALL set it to active time. The sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

### Requirement: Show change against the previous period
Activity SHALL show, on each of its tiles (sessions, errors per 100 calls, test runs passed, subagent share and output speed) and on the prompts interrupted line, the change against the equal-length period before the view, and SHALL show nothing for the All range. A figure that reads the same in both periods SHALL show "unchanged".

#### Scenario: No previous period
- **WHEN** the user opens the All range
- **THEN** no tile shows a change

### Requirement: Mark a change for the worse
A change in the worse direction (errors per 100 calls up, test runs passed down, prompts interrupted up, output speed down) SHALL be marked as worse; the sessions and subagent share SHALL NOT be judged.

#### Scenario: Errors rise
- **WHEN** errors per 100 calls were 4 in the previous period and are 6 now
- **THEN** the tile shows the rise and marks it as worse

### Requirement: Explain missing output speed
When no session in the view records model time, output speed SHALL read not available: when every session in the view is a Codex session, its tile SHALL give way to a quiet note under the vitals that Codex transcripts record no model time; otherwise, the tile SHALL say no session in the view records it. Which sessions are in the view SHALL decide it, priced or not.

#### Scenario: Nothing recorded
- **WHEN** every session in the view predates the `cost-state` line
- **THEN** output speed reads not available, its note says no session in the view records model time, and the duration note names no model or tool time

#### Scenario: Codex only
- **WHEN** every session in the view is a Codex session
- **THEN** no Output speed tile shows, and a note under the vitals says Codex transcripts record no model time

#### Scenario: Priced Codex and unpriced Claude Code
- **WHEN** the view has all sources, its Codex requests are priced, its Claude Code requests are from an unpriced model, and no session records model time
- **THEN** the Output speed tile reads not available, and its note says no session in the view records model time, not that Codex records none

### Requirement: Show the selected day's own figures
Selecting a day or a week on the work chart SHALL show, for each of its sessions, those days' figures, and a session's Active time SHALL be those days' active time. Peak context and compactions SHALL stay whole-session figures, and a tooltip SHALL say so. The selection SHALL narrow every workbench tab. The lead, attention summary, chart and vitals SHALL keep the range's figures.

#### Scenario: Session spanning two days
- **WHEN** a session worked 30 minutes on March 3 and 2 hours on March 4 and the user selects March 3
- **THEN** its Active time is 30 minutes and its peak context is the whole session's

#### Scenario: Error loops on one day
- **WHEN** the view has 5 error loops, 2 of them on the selected day
- **THEN** Error loops lists those 2 and the attention summary still counts 5

#### Scenario: Clear the day
- **WHEN** the user clears the selected day
- **THEN** every tab shows the range again

### Requirement: Say how sessions are counted
The Sessions tab SHALL say, behind its How measured toggletip, that it counts a session when it has a request in the range, and that the Judgments view counts sessions by their start time, so the two totals can differ slightly.

#### Scenario: Drawer names the counting rule
- **WHEN** the user opens the Sessions tab and activates its How measured toggletip
- **THEN** the toggletip says a session counts when it has a request in the range and that the Judgments view counts by start time

### Requirement: Order the Activity page
Activity SHALL show its view switch first. Its Overview SHALL then show, in this order: the lede with the filters beside it, the prompts interrupted line, the attention summary, the work chart, the vitals, then the workbench tabs. Overview SHALL have no section index.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals, and the tab list comes after the vitals

#### Scenario: The switch leads
- **WHEN** the user opens Activity
- **THEN** the view switch comes before the lede

### Requirement: Keep each view's own filters to that view
A switch of view SHALL keep the shared filters (project, range, source and the automated toggle) and SHALL drop the keys only the other view reads: Overview's session search, near-limit flag, day, week and tab; Judgments' outcome, friction and label filters. Focus SHALL stay on the view switch, on the button of the view now shown.

#### Scenario: Leave Overview's filters behind
- **WHEN** the user on `/usage?range=30&q=fix&near=1&tab=tools` picks Judgments
- **THEN** the URL is `/usage?range=30&view=judgments`, and focus is on the Judgments button

#### Scenario: Leave the judgment filters behind
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved&frf=buggy_code` picks Overview
- **THEN** the URL is `/usage?range=7`, and focus is on the Overview button

## REMOVED Requirements

### Requirement: Show work by hour and weekday
**Reason**: The heatmap filters nothing and answers no question Overview asks. Median output speed by hour, the other option, cannot be measured: model time is recorded per session run, not per request.
**Migration**: To spot a script by its hours, sort the Sessions tab by prompts and read the start times. The payload's `work_hours` is gone.
