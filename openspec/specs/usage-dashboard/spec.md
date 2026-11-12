# usage-dashboard Specification

## Purpose

The Activity page: shows the work Claude Code did in each project (commits, prompts, sessions) and where it struggled (error loops, context pressure, flaky tools, failed tests, interruptions), so problems in projects and habits stand out. Cost is covered by the cost dashboard.

## Requirements

### Requirement: Filter by time range and project
The usage dashboard SHALL let the user pick a time range and a project, and every metric on the page SHALL reflect that selection. The project filter SHALL change only through the filter controls or an explicit filter action; selecting a project or session elsewhere SHALL open its details in a side sheet without changing the filter.

#### Scenario: Narrow to one project
- **WHEN** the user selects project `foo` and the last 7 days
- **THEN** every chart, tile and table shows only `foo` sessions from those 7 days

#### Scenario: Inspect a project without filtering
- **WHEN** the user selects project `foo` in the spend ledger or the project table
- **THEN** a side sheet shows `foo`'s summary, the page keeps its current filter, and the sheet offers a button to filter the dashboard to `foo`

### Requirement: Show subagent share
The dashboard SHALL show what share of tokens came from subagents.

#### Scenario: Subagent heavy project
- **WHEN** 40% of a project's tokens came from subagent transcripts
- **THEN** the project shows a 40% subagent share

### Requirement: Show context health
The dashboard SHALL show peak context size per session, the number of compactions per session, and tokens spent per user prompt.

#### Scenario: Session near the limit
- **WHEN** a session's largest request used most of the model's context window
- **THEN** that session is listed among sessions near the context limit

### Requirement: Show autonomy and friction
The dashboard SHALL show assistant turns and tool calls per user prompt, the rate of user interruptions and rejections, and error loops (the same tool failing three or more times in a row within a session).

#### Scenario: Error loop detected
- **WHEN** a session has four consecutive failed `Edit` calls
- **THEN** the session counts one error loop and links to it in the errors dashboard

### Requirement: Show time metrics
The dashboard SHALL show session duration, thinking time, and tool call latency per tool. A session's duration SHALL be its active time: the time between its main-thread requests and tool calls, leaving out every pause over 20 minutes, the same rule as the session timeline.

#### Scenario: Resumed session
- **WHEN** a session works for 30 minutes, pauses for 22 hours, then works for 5 minutes
- **THEN** its duration is 35 minutes, not 23 hours

#### Scenario: Slow tool
- **WHEN** the user views tool latency
- **THEN** each tool shows its median and 95th percentile duration from `tool_use` to `tool_result`

### Requirement: Show outcomes and efficiency ratios
The dashboard SHALL count successful `git commit` calls and test or build runs (with pass and fail counts) per session, and SHALL show tokens per commit and errors per 100 tool calls per project.

#### Scenario: Project with no commits
- **WHEN** a project has sessions but no commits in the range
- **THEN** per-commit ratios show as not available, not as zero or infinity

### Requirement: Show model and tool mix
The dashboard SHALL show usage and failure rates per tool, MCP server, skill and hook.

#### Scenario: MCP server failures
- **WHEN** an MCP server's tool calls fail
- **THEN** the dashboard shows that server's call count and failure rate

### Requirement: Link to a project or session
The usage dashboard SHALL keep the selected project, time range, inspected project, inspected tool, MCP server or skill, and open session in the page URL, so a view can be reopened or shared into an agent prompt, and browser Back SHALL retrace filter and sheet changes. The Sessions drawer's day, search text and near-context-limit filter SHALL also be kept in the URL, written without adding history entries, and restored on reload. The day SHALL be cleared in the same URL write as any change of project, range or source, from whichever control makes it, so browser Back restores the earlier view with its day. A day that is not a real calendar date SHALL read as no day.

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
- **THEN** the day filter is cleared in the same step, and Back returns to the earlier range with its day

#### Scenario: Impossible day
- **WHEN** the user opens a URL with `day=2026-02-30`
- **THEN** Activity shows no selected day

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: commits, prompts, sessions and active days, with turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard. When the view has a previous period, the commits, sessions and active days SHALL each show their change against it, or "unchanged" when both periods read the same.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits, prompts, sessions and active days of those 30 days, and no cost figure appears before the attention summary

#### Scenario: Requests without a prompt
- **WHEN** a session works on its own on a day with no user prompt
- **THEN** that day is not an active day

#### Scenario: Compare with the period before
- **WHEN** the user opens the last 30 days and the 30 days before had 20 commits against 30 now
- **THEN** the headline shows 30 commits followed by ", up from 20 commits"

#### Scenario: All time
- **WHEN** the user opens the All range
- **THEN** the headline shows no change

### Requirement: Lead with what needs attention
Activity SHALL show, directly under its lead, every problem found in the view (error loops, sessions at 80% or more of the context window, tools failing over 10% of at least 20 calls, failed test runs), each with an action that opens the matching detail. The failed test runs action SHALL open a list of the newest failed runs, each with its session, command and time and a link to its error on the Errors page; its count SHALL be every failed run in the view, and a list cut at the newest 50 SHALL say so. When none is found it SHALL say so.

#### Scenario: Error loops present
- **WHEN** the view contains 3 error loops and 1 session near the context limit
- **THEN** the attention summary lists both problems, the error loops marked as needing action, and each offers to open its table

#### Scenario: Nothing found
- **WHEN** the view has no error loops, sessions near the limit, flaky tools or failed tests
- **THEN** the attention summary says that nothing needs attention

#### Scenario: Open the failed test runs
- **WHEN** the view has 4 failed test runs and the user chooses "See tests"
- **THEN** a drawer lists the 4 runs with session, command and time, and each links to its error on the Errors page

#### Scenario: More failed runs than the list holds
- **WHEN** the view has 60 failed test runs
- **THEN** the drawer's count is 60 and it lists the 50 newest, saying "Showing the 50 newest of 60"

### Requirement: Show work per day
Activity SHALL chart commits, prompts or sessions across the view, from its first day with a session, with errors per 100 tool calls on the same chart against its own axis (the failed count stays in the tooltip); a view with no tool calls SHALL show no rate line, axis or legend entry. Selecting a day SHALL list that day's sessions. The all-time lead SHALL date the history from that same day. When the span from the first day with a session to the end of the range is over 60 days, the chart SHALL show one bar per week (Monday start, local time) instead of per day, and its totals for commits and prompts SHALL equal the sum of its bars; a session counts once in each bucket it touches, so the bars for sessions can add up to more than the total. The week that holds the end of the range SHALL read "so far", and a first week cut by the start of the range SHALL read "from" that date.

#### Scenario: History starts inside the range
- **WHEN** the user opens the 90-day view and the first session in it ran 40 days ago
- **THEN** the chart starts 40 days ago, with zeros for the idle days after that

#### Scenario: Pick a busy day
- **WHEN** the user selects a day with 40 commits on the work chart
- **THEN** the sessions table opens limited to the sessions that ran on that day

#### Scenario: Failure rate, not failed count
- **WHEN** a quiet day has 2 failed calls of 4 and a busy day has 6 of 200
- **THEN** the line shows 50 errors per 100 calls for the quiet day and 3 for the busy day, and each tooltip also gives the failed count

#### Scenario: Partial weeks
- **WHEN** the weekly chart's range ends on a Wednesday
- **THEN** that week's label reads "so far"

#### Scenario: Long range
- **WHEN** the user opens the All range and the first session ran 200 days ago
- **THEN** the chart shows one bar per week, a hint says to choose a shorter range to pick a day, and week bars cannot be selected

### Requirement: Sort tables by column
Activity SHALL let the user sort the Sessions, Project metrics and Tools tables by a column, and the sorted header SHALL carry `aria-sort`. Project metrics and Tools SHALL sort every row in the browser. Sessions SHALL sort the whole matching list on the server, not the loaded page; the server SHALL answer 400 for a sort it does not know. The "near limit" attention action and a day picked on the chart SHALL clear the Sessions sort, since they set the list's own order. Project metrics SHALL open ordered by sessions, descending, and SHALL NOT show a cost column. The Sessions sort SHALL NOT be kept in the URL.

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
Activity SHALL show, on each of its five tiles (errors per 100 calls, test runs passed, prompts interrupted, subagent share, median session), the change against the equal-length period before the view, and SHALL show nothing for the All range. A figure that reads the same in both periods SHALL show "unchanged". A change in the worse direction (errors per 100 calls up, test runs passed down, prompts interrupted up) SHALL be marked as worse; the subagent share and median session SHALL NOT be judged.

#### Scenario: Errors rise
- **WHEN** errors per 100 calls were 4 in the previous period and are 6 now
- **THEN** the tile shows the rise and marks it as worse

#### Scenario: No previous period
- **WHEN** the user opens the All range
- **THEN** no tile shows a change

### Requirement: Show work by hour and weekday
Activity SHALL show, under the work chart, a heatmap of prompts by weekday and hour on the machine's local clock, and SHALL give it a text alternative that names the busiest hour and day, and counts the ties for them. The heatmap SHALL be one tab stop, and the arrow keys SHALL move between its cells.

#### Scenario: Late-night work
- **WHEN** 30 prompts were sent on Tuesdays at 23:00 local time
- **THEN** the Tuesday 23:00 cell is the darkest, and the text alternative names it

#### Scenario: Tie
- **WHEN** three cells each hold 5 prompts and no cell holds more
- **THEN** the text alternative names one of them and says "and 2 others"

### Requirement: Break the work chart down by project
Activity SHALL stack the work chart's bars by the projects that have a colour of their own, as the Cost page does, in the project colours used on every page, with every other project and sessions with no project in Other. A view with one project, or with no project that has a colour, SHALL show plain bars.

#### Scenario: Which project got the commits
- **WHEN** the user chooses Commits on a view with eight projects, five of which have a colour of their own
- **THEN** each bar stacks those five and an Other segment for the other three

#### Scenario: No coloured project
- **WHEN** none of the view's projects has a colour of its own
- **THEN** the bars are not stacked

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
