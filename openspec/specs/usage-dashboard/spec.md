# usage-dashboard Specification

## Purpose

The Activity page: shows the work Claude Code, Codex and Grok did in each project (commits, prompts, sessions) and where they struggled (error loops, context pressure, flaky tools, failed tests, interruptions), so problems in projects and habits stand out. Cost is covered by the cost dashboard.

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

### Requirement: Show model and tool time
The dashboard SHALL show the model time and tool time that sessions record, summed over the view's sessions that record them. Like duration, these are whole-session figures: they include the session's subagent work and its time outside the range. When no session in the view records model time, the dashboard SHALL show no model time or tool time.

#### Scenario: Model and tool time
- **WHEN** the view holds two sessions that record 30 and 10 minutes of model time and 20 and 5 minutes of tool time, and a third that records none
- **THEN** the dashboard states 40 minutes waiting on the model and 25 minutes running tools, and does not count the third session in either figure

### Requirement: Show output speed
The dashboard SHALL show output speed: the output tokens of the sessions that record model time divided by their model time, in tokens per second. It SHALL be compared with the previous period, and a fall SHALL read as worse.

#### Scenario: Output speed
- **WHEN** the sessions that record model time spent 1,000 seconds of it and wrote 98,000 output tokens
- **THEN** output speed reads 98 tokens per second

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
The usage dashboard SHALL keep the selected project, time range, inspected project, inspected tool, MCP server or skill, and open session in the page URL, so a view can be reopened or shared into an agent prompt, and browser Back SHALL retrace filter and sheet changes.

#### Scenario: Open a copied URL
- **WHEN** the user opens a copied usage dashboard URL
- **THEN** the same project, range and session are selected

#### Scenario: Open a copied URL with a tool inspected
- **WHEN** the user opens a copied usage dashboard URL that was taken with the inspector open for `Bash`
- **THEN** the inspector for `Bash` opens in the same view

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

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: its lede SHALL state the commits and the prompts they came from. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard. When the view has a previous period, the commits SHALL show their change against it, or "unchanged" when both periods read the same.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits and prompts of those 30 days, and no cost figure appears before the attention summary

#### Scenario: Compare with the period before
- **WHEN** the user opens the last 30 days and the 30 days before had 20 commits against 30 now
- **THEN** the headline shows 30 commits followed by ", up from 20 commits"

#### Scenario: All time
- **WHEN** the user opens the All range
- **THEN** the headline shows no change

### Requirement: Count sessions and active days
A Sessions vital SHALL state the view's sessions, active days, median session, active time in all and, when recorded, thinking time. A line under the lede SHALL state the share and count of prompts interrupted, with the turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. When the view has a previous period, the sessions, active days and share interrupted SHALL each show their change, or "unchanged".

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the Sessions vital shows the sessions, active days, median session and active time of those 30 days, the sessions and active days each with their change

#### Scenario: Thinking without model time
- **WHEN** a Claude Code view records thinking but no session records model time
- **THEN** the Sessions vital still states the thinking time

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

### Requirement: Key and describe the hollow dot
The legend SHALL give a key for the hollow dot, and the bar's tooltip, screen-reader text and data table SHALL say it has too few calls for a steady rate while still giving its rate. In forced colors, the dot and its key SHALL stay hollow: a page-colored center in a text-colored ring.

#### Scenario: Forced colors
- **WHEN** the user's system forces its colors
- **THEN** the hollow dot and its key keep a page-colored center and a text-colored ring, apart from the solid line

### Requirement: Name the work chart's bucket
The work chart's How measured toggletip SHALL name its bucket: "How measured: work per day", or "per week" on a chart by week.

#### Scenario: Chart by week
- **WHEN** the work chart is by week
- **THEN** its How measured toggletip reads "How measured: work per week"

#### Scenario: A chart by week
- **WHEN** the chart shows one bar per week
- **THEN** its How measured toggletip is named "How measured: work per week"

### Requirement: Chart a long range by week
When the span from the first day with a session to today is over 60 days, the chart SHALL show one bar per week (Monday start, local time) instead of per day, and its totals for commits and prompts SHALL equal the sum of its bars; a session counts once in each bucket it touches. The week that holds the end of the range SHALL read "so far", and a first week cut by the start of the range SHALL read "from" that date.

#### Scenario: Partial weeks
- **WHEN** the weekly chart's range ends on a Wednesday
- **THEN** that week's label reads "so far"

#### Scenario: Long range
- **WHEN** the user opens the All range and the first session ran 200 days ago
- **THEN** the chart shows one bar per week, and a hint says to select a week to narrow the tabs

### Requirement: Sort tables by column
Activity SHALL let the user sort the Sessions, Project metrics and Tools tables by a column, and the sorted header SHALL carry `aria-sort`. Project metrics and Tools SHALL sort every row in the browser.

#### Scenario: Most failing tool
- **WHEN** the user sorts Tools by failure rate
- **THEN** the tool with the highest rate is first and the header reads as sorted

### Requirement: Sort Sessions over the whole list
Sessions SHALL sort the whole matching list on the server, not the loaded page, by one to three keys in order; the server SHALL answer 400 for a sort it does not know. The "near limit" action and a day or week picked on the chart SHALL clear the Sessions sort, every key of it; the Output speed vital SHALL set it to output speed alone, fastest first. The sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

#### Scenario: Two keys over the whole list
- **WHEN** the view has 250 sessions and the user sorts Sessions by failed calls, descending, then by cost, descending
- **THEN** the first rows are the sessions with the most failed calls of all 250, and among sessions with the same count the costliest comes first

#### Scenario: An action clears every key
- **WHEN** Sessions is sorted by failed calls, then cost, and the user activates the "near limit" action
- **THEN** no header is sorted and the list is ordered nearest the limit first

#### Scenario: Reload
- **WHEN** the user sorts Sessions by two columns and reloads the page
- **THEN** Sessions opens in its default order and the URL never named the sort

### Requirement: Order Project metrics by sessions
Project metrics SHALL open ordered by sessions, descending, and SHALL NOT show a cost column.

#### Scenario: Default project order
- **WHEN** the user opens Project metrics
- **THEN** projects are ordered by sessions, most first, and no cost column appears

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
Selecting a day or a week on the work chart SHALL show, for each of its sessions, those days' figures, and a session's Active time SHALL be those days' active time. Model time, output speed, peak context and compactions SHALL stay whole-session figures, and a tooltip SHALL say so. The selection SHALL narrow every workbench tab. The lead, attention summary, chart and vitals SHALL keep the range's figures.

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

### Requirement: Show a session's /insights judgment in its sheet
When a session has a `/insights` facet, its sheet SHALL show, after the summary figures and before the timeline, a block tagged model-judged with the session's outcome, a marker when its satisfaction includes dissatisfied, its helpfulness and session type, its goal and friction categories (most counted first), its brief summary and its friction detail. The block SHALL NOT show the facet's underlying goal or primary success.

#### Scenario: Judged session
- **WHEN** the user opens a session whose facet reports outcome `partially_achieved`, a `dissatisfied` satisfaction count and friction `wrong_approach`
- **THEN** the sheet shows a model-judged "/insights judgment" block above the timeline with the outcome badge "Partially achieved", the dissatisfied marker and the friction category

### Requirement: Leave out the judgment of an unanalysed session
A session with no `/insights` facet SHALL show no judgment block and no link to the Judgments view in its sheet. Only Claude Code sessions are analysed, so a Codex or Grok session SHALL never show one.

#### Scenario: Session without a facet
- **WHEN** the user opens a session that has no facet
- **THEN** the sheet shows no `/insights` block and no link to the Judgments view

#### Scenario: Codex session
- **WHEN** the user opens a Codex session
- **THEN** the sheet shows no `/insights` block

#### Scenario: Grok session
- **WHEN** the user opens a Grok session
- **THEN** the sheet shows no `/insights` block

### Requirement: Link a session's judgment to the Judgments view
The judgment block SHALL link to Activity's Judgments view, keeping the view's project, range, source and automated filters. A source other than Claude Code, picked alone, SHALL be dropped from the link: the session is a Claude Code one, and Activity opens Overview for the judgments of any other source.

#### Scenario: Open in Insights
- **WHEN** the user views project `foo` for the last 30 days and selects the link, now "Open in Judgments", in a judged session's sheet
- **THEN** Activity's Judgments view opens on project `foo` for the last 30 days, at `/usage?project=foo&range=30&view=judgments`

#### Scenario: Over a Codex-only view
- **WHEN** the source filter is Codex alone and the user opens a judged Claude Code session's sheet on `foo` over 30 days
- **THEN** its link opens `/usage?project=foo&range=30&view=judgments`, the Judgments view, where the session is listed

#### Scenario: Over a Grok-only view
- **WHEN** the source filter is Grok alone and the user opens a judged Claude Code session's sheet on `foo` over 30 days
- **THEN** its link opens `/usage?project=foo&range=30&view=judgments`, with no source in the link

### Requirement: Offer the work chart as a table
Under the work chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per day or week: the chosen measure by project with Other, its total, and errors per 100 tool calls. The table SHALL follow the chosen measure, SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user chooses Commits and selects "Show data table"
- **THEN** a table lists each day with its commits, by project and in total, and its errors per 100 calls

#### Scenario: Week buckets
- **WHEN** the chart is weekly, because the first session is more than 60 days before today
- **THEN** the table has one row per week, labelled as the chart labels its weeks, including "so far"

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Use the room of a wide session sheet
The session timeline SHALL span the width of the session sheet at either width, and SHALL draw a taller plot when it is at least 900px wide. When the sheet has room for two columns, the session's Models and Tools SHALL sit side by side; without that room they SHALL stack. The wide session sheet SHALL show the same sections and figures as the narrow one.

#### Scenario: Wide session sheet
- **WHEN** the user widens a session sheet on a 1440px viewport
- **THEN** the timeline spans the sheet with a taller plot, and Models sits beside Tools

#### Scenario: Narrow session sheet
- **WHEN** the user views a session sheet at the narrow width
- **THEN** the timeline has its narrow height and Models and Tools stack

### Requirement: Show how to resume a session in its sheet
A session sheet SHALL show, at its foot next to the session id, the session's working directory when the store has it, and the command that resumes the session in its agent, the same text the session's context menu copies, each with a Copy button. A copy SHALL say "Copied" or that the text could not be copied, as a polite status.

#### Scenario: Claude Code session with a directory
- **WHEN** the user opens the sheet of Claude Code session `abc` with working directory `/Users/me/app`
- **THEN** the sheet shows `/Users/me/app` and `cd '/Users/me/app' && claude --resume abc`, each with a Copy button

#### Scenario: Session without a directory
- **WHEN** the user opens the sheet of Codex session `def` the store holds no working directory for
- **THEN** the sheet shows `codex resume def` with a Copy button and no working directory

### Requirement: Show a session's model time, tool time and lines changed in its sheet
The session sheet SHALL show the session's model time, tool time, output speed, and the lines added and removed, when the session records them. The output speed SHALL be the session's output tokens divided by its model time. The sheet SHALL leave out each figure the session does not record, and SHALL show none of them for a session that records none.

#### Scenario: Recorded session
- **WHEN** a session records 15 minutes of model time, 6 minutes of tool time, 120 lines added and 30 removed, and wrote 81,000 output tokens
- **THEN** its sheet shows 15 minutes of model time, 6 minutes of tool time, 90 tokens per second, and +120 / −30 lines

#### Scenario: Session that records nothing
- **WHEN** the session is a Codex session
- **THEN** its sheet shows no model time, tool time, output speed or lines changed

#### Scenario: Grok session
- **WHEN** a Grok session's turns record 10 minutes of model time and it wrote 60,000 output tokens
- **THEN** its sheet shows 10 minutes of model time and 100 tokens per second, and no tool time or lines changed

### Requirement: Order the Activity page
Activity SHALL show its view switch first. Its Overview SHALL then show, in this order: the lede, the prompts interrupted line, the attention summary, the work chart, the vitals, then the workbench tabs. Its filters are in the scope bar above the page. Overview SHALL have no section index.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals, and the tab list comes after the vitals

#### Scenario: The switch leads
- **WHEN** the user opens Activity
- **THEN** the view switch comes before the lede

### Requirement: Switch between Overview and Judgments
Activity SHALL hold two views of the same sessions: Overview, its measured figures, and Judgments, how `/insights` judged them. A view switch over the heading, a group named "Activity view" with the two as pressed buttons, SHALL pick one. Overview is the default. The view SHALL be kept in the URL as `view=judgments`, with no key for Overview, and a switch SHALL add one history entry, so Back returns to the view before.

#### Scenario: Default
- **WHEN** the user opens `/usage?range=30`
- **THEN** Overview shows, its button is pressed, and the Judgments data is not requested

#### Scenario: Pick Judgments
- **WHEN** the user on `/usage?project=foo&range=30` picks Judgments
- **THEN** the URL is `/usage?project=foo&range=30&view=judgments`, the Judgments view shows for `foo` and the last 30 days, and Back returns to Overview

#### Scenario: A link to the view
- **WHEN** the user opens `/usage?range=7&view=judgments`
- **THEN** the Judgments view shows, and Overview's data is not requested

### Requirement: Keep each view's own filters to that view
A switch of view SHALL keep the shared filters (project, range, source and the automated toggle) and SHALL drop the keys only the other view reads: Overview's session search, near-limit flag, day, week and tab; Judgments' outcome, friction and label filters. Focus SHALL stay on the view switch, on the button of the view now shown.

#### Scenario: Leave Overview's filters behind
- **WHEN** the user on `/usage?range=30&q=fix&near=1&tab=tools` picks Judgments
- **THEN** the URL is `/usage?range=30&view=judgments`, and focus is on the Judgments button

#### Scenario: Leave the judgment filters behind
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved&frf=buggy_code` picks Overview
- **THEN** the URL is `/usage?range=7`, and focus is on the Overview button

### Requirement: Offer no Judgments for Codex alone
When the source filter is a source other than Claude Code, picked alone, the Judgments button SHALL be unavailable: marked `aria-disabled`, still focusable, doing nothing when activated, and described by a reason shown beside the switch that names the agent picked, such as "Codex writes no facets: /insights judges Claude Code sessions only." Activity SHALL show Overview.

#### Scenario: Codex picked
- **WHEN** the user picks Codex on Activity
- **THEN** the Judgments button is unavailable, the reason shows beside the switch, and selecting the button changes nothing

#### Scenario: Grok picked
- **WHEN** the user picks Grok on Activity
- **THEN** the Judgments button is unavailable, and the reason beside the switch reads "Grok writes no facets: /insights judges Claude Code sessions only."

#### Scenario: Back to All
- **WHEN** the user then picks All
- **THEN** the Judgments button is available again and the reason is gone

### Requirement: Open Overview for a link to the judgments of Codex
A URL that names both `view=judgments` and a source other than Claude Code, such as `source=codex` or `source=grok`, SHALL open Overview and drop the view and the judgment filters from the URL, with no history entry. Activity SHALL never show a page that only says there is nothing to show.

#### Scenario: A link to the judgments of Codex
- **WHEN** the user opens `/usage?range=30&source=codex&view=judgments`
- **THEN** Overview shows for Codex, the URL becomes `/usage?range=30&source=codex`, and the judgments are not requested

#### Scenario: A link to the judgments of Grok
- **WHEN** the user opens `/usage?range=30&source=grok&view=judgments`
- **THEN** Overview shows for Grok, the URL becomes `/usage?range=30&source=grok`, and the judgments are not requested

### Requirement: Draw work and errors on two tracks
The work chart SHALL draw its bars on a top track and errors per 100 tool calls on a thin track under it, sharing one x-axis. The rate track SHALL have its own scale on the left and no right-hand axis. One hover, tooltip and keyboard reading SHALL cover both tracks, and a view with no tool calls SHALL show no rate track or legend entry. In such a view the bars SHALL use the rate track's room.

#### Scenario: Two tracks
- **WHEN** the user opens Activity for a view with tool calls
- **THEN** the bars and the rate line sit on separate tracks under one row of bucket labels, and reading a bucket by keyboard gives its count and its errors per 100 calls

#### Scenario: No tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart shows the bars only, with no rate track and no rate legend entry

#### Scenario: Bars in a view without tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart's box is as tall as with a rate track, and the bars reach down to the bucket labels

### Requirement: Select a week on the work chart
A weekly work chart SHALL let the user select a week by clicking its bar, or by Enter on the bar the arrow keys read. The selection SHALL narrow every workbench tab to that week's days in the view, and SHALL be kept in the URL as `week=` with the week's Monday, written without a history entry. A `week=` that is not a Monday, or that the view does not reach, SHALL be dropped. Selecting a week SHALL clear a selected day, and selecting a day a selected week.

#### Scenario: Pick a week by keyboard
- **WHEN** the chart is weekly and the user focuses it, presses Right twice and Enter
- **THEN** the second week is selected, the URL holds `week=` with its Monday, and the Sessions tab lists that week's sessions

#### Scenario: A week cut by the range
- **WHEN** the range starts on Wednesday Nov 4 and the user selects its first week
- **THEN** every figure in the tabs, active time included, covers Wednesday to Sunday only, and the panel says "Nov 4 – Nov 8"

#### Scenario: Not a Monday
- **WHEN** the user opens a URL with `week=2026-11-18`, a Wednesday
- **THEN** Activity shows no selected week

#### Scenario: A week outside the view
- **WHEN** the user opens the last 30 days with a `week=` from four months earlier
- **THEN** the URL drops `week` and Activity shows no selected week

### Requirement: Count a selection's days only inside the range
A selected day or week SHALL count only its days from the range's start to today, for every figure: requests, tool calls, prompts and active time. `/api/day` and `/api/sessions` SHALL take `days=1` or `days=7` with a `day`, and SHALL answer 400 for any other `days`, a blank one, or `days` without `day`. While a new view loads, the chart still showing the previous view SHALL take no pick.

#### Scenario: Future-dated record
- **WHEN** the view ends on Thursday and a record is dated Friday of the same week
- **THEN** the week's figures leave that record out

#### Scenario: Unsupported span
- **WHEN** a client asks for `/api/sessions?days=3`, or `days=` blank with a `day`
- **THEN** the server answers 400

#### Scenario: Pick during a range change
- **WHEN** the user changes the range and presses Enter on the old chart before the new range loads
- **THEN** the URL holds no `week` or `day`

### Requirement: Show the selection as a chip
While a day or a week is selected, the chart header SHALL show a chip naming it, "Week of Nov 9" or "Nov 4", with a button that clears it. Escape on the chart, while no bucket is being read, SHALL clear it too. Escape elsewhere, such as closing a sheet, SHALL NOT clear it. Each narrowed tab panel SHALL name the days it counts, with a button that shows the whole range and then moves focus to the chart.

#### Scenario: Clear with the chip
- **WHEN** a week is selected and the user activates the chip's button
- **THEN** the week is cleared, the tabs show the range again and the URL drops `week`

#### Scenario: Clear from the panel
- **WHEN** a day is selected and the user activates "Show the whole range" by keyboard
- **THEN** the day is cleared and focus is on the chart

#### Scenario: Clear with Escape
- **WHEN** a week is selected and the user presses Escape twice on the chart after reading a bucket
- **THEN** the first Escape ends the reading and the second clears the week

### Requirement: Link each vital to its destination
Each vital SHALL be a link or a button to the place that explains it: Sessions to the Sessions tab, Errors per 100 calls to the Errors page for the same view, Test runs passed to the failed test runs, Subagents to Project metrics sorted by subagent share, and Output speed to the Sessions tab sorted by output speed. A vital or attention action SHALL clear a selected day or week, since its figure covers the range, and SHALL move focus only once. Activity SHALL show at most six vitals.

#### Scenario: Tests tile
- **WHEN** the user activates the Test runs passed tile
- **THEN** the Loops and tests tab opens and focus moves to its Failed test runs list

#### Scenario: Tests tile with a week selected
- **WHEN** a week is selected and the user activates the Test runs passed tile or "See tests"
- **THEN** the week is cleared and the Failed test runs list the range's runs, as the tile counts them

#### Scenario: Focus moves once
- **WHEN** the user activates the Test runs passed tile, opens Projects, then activates Loops and tests from the tab list
- **THEN** focus stays on the Loops and tests tab

#### Scenario: Errors tile
- **WHEN** the user views project `foo` for the last 30 days and activates Errors per 100 calls
- **THEN** the Errors page opens for `foo` over the last 30 days

#### Scenario: Output speed tile
- **WHEN** the user activates the Output speed tile
- **THEN** the Sessions tab opens sorted by output speed, fastest first

### Requirement: Show the output speed trend
The Output speed vital SHALL show a sparkline of output speed per chart bucket, when at least two buckets hold a session that records model time. A session SHALL count in the bucket of its first request in the view. The sparkline SHALL be hidden from assistive technology.

#### Scenario: Speed per week
- **WHEN** the chart is weekly and three weeks hold sessions that record model time
- **THEN** the Output speed vital draws a three-point sparkline

### Requirement: Show the workbench as tabs
Under the vitals, Activity's Overview SHALL show its tables as tabs, in a tab list named "Activity detail": Sessions, Projects, Tools and MCP (tools, MCP servers, skills and hooks), and Loops and tests. Sessions SHALL be the default. The tabs SHALL follow the WAI-ARIA tabs pattern: one tab stop, Left and Right to move with wrap, Home and End, Enter or Space to activate, and the selected panel as the next tab stop.

#### Scenario: Keyboard
- **WHEN** focus is on the Sessions tab and the user presses Left, then Enter
- **THEN** focus moves to Loops and tests, and Enter shows its panel and marks it selected

#### Scenario: Default
- **WHEN** the user opens `/usage?range=30`
- **THEN** the Sessions tab is selected and its panel lists the sessions

#### Scenario: Tab to the panel
- **WHEN** focus is on the selected tab and the user presses Tab
- **THEN** focus moves to the selected tab's panel

### Requirement: Keep the workbench tab in the URL
The active tab SHALL be kept in the URL as `tab=projects`, `tab=tools` or `tab=loops`, with no key for Sessions, written without a history entry and restored on reload. An unknown tab SHALL read as Sessions.

#### Scenario: Reload on a tab
- **WHEN** the user picks Projects and reloads the page
- **THEN** the URL holds `tab=projects` and the Projects tab is selected

#### Scenario: Unknown tab
- **WHEN** the user opens `/usage?tab=hours`
- **THEN** the Sessions tab is selected

### Requirement: Preview error loops and failed test runs
The Loops and tests tab SHALL show the five newest error loops and the five newest failed test runs, each list headed with its count and followed by a button with `aria-expanded` when it holds more. The button SHALL read "Show all N", or "Show the 50 newest" when the view holds more than the payload's 50, and SHALL expand the list in place to every row the payload carries.

#### Scenario: More loops than the preview
- **WHEN** the view has 12 error loops and the user opens Loops and tests
- **THEN** 5 loops show, and "Show all 12" shows the rest

#### Scenario: More runs than the payload
- **WHEN** the view has 60 failed test runs
- **THEN** the button reads "Show the 50 newest"

### Requirement: Keep a thin work chart segment visible
In every metric and bucket, a segment of the work chart's stacked bars with a value above zero SHALL be drawn at least 1px tall, with the 2px gap below it kept. A bar SHALL be its total's scaled height, the other segments shrinking to make room, as on Cost's chart; only a bar too short to hold every segment's minimum MAY draw slightly taller than its scaled height, so each nonzero segment stays visible.

#### Scenario: One commit beside a thousand
- **WHEN** a day has 1,000 commits in project `a` and 1 in project `c`, both with a color of their own
- **THEN** `c`'s segment shows at least 1px tall over `a`'s, and the bar is as tall as a bar of 1,001 commits of one project

#### Scenario: A tiny split bar
- **WHEN** a day has 1 commit in `a` and 1 in `c`, in a view whose busiest day has 200
- **THEN** both segments show, and the bar may be a few pixels taller than 2 commits drawn to scale

### Requirement: Show model time and output speed in Sessions
Sessions SHALL show each session's model time and output speed, output tokens per second of model time, as whole-session figures counted as the Output speed vital counts them, and SHALL sort by either. A session that records no model time, every Codex session and older Claude Code ones, SHALL read "–" in both, SHALL sort last in either direction and SHALL add nothing to the vital. The sorted column SHALL stay shown at every width.

#### Scenario: Run with no model time
- **WHEN** a session's only run records 0 ms of model time beside sessions that average 98 tok/s
- **THEN** the session reads "–" and the Output speed vital still reads 98 tok/s

#### Scenario: Narrow window
- **WHEN** the user activates the Output speed tile in a window 1,000px wide, where Tok/s is otherwise hidden
- **THEN** the Tok/s column shows, sorted fastest first

#### Scenario: Fastest first
- **WHEN** session `a` wrote 150,000 output tokens in 30 minutes of model time and `b` 85,200 in 10, and the user sorts Sessions by output speed, descending
- **THEN** `b` (142 tok/s) comes before `a` (83 tok/s)

#### Scenario: No model time
- **WHEN** the view holds a Codex session and the user sorts Sessions by output speed or model time, in either direction
- **THEN** the Codex session reads "–" in both columns and comes after every session that records model time

### Requirement: Accept several sort keys on the sessions endpoint
`/api/sessions` SHALL accept in `sort` one to three keys separated by commas, each a known sort key, with a leading `-` for descending. It SHALL order by the first key, then by each next key among the rows the earlier keys leave tied. Rows with no value for a key SHALL come last for that key in either direction. `sort=<key>&desc=1` SHALL keep meaning that one key, descending.

#### Scenario: Two keys
- **WHEN** a client asks for `/api/sessions?sort=-errors,cost` and sessions `a` and `b` both have 3 failed calls, `a` costing $2 and `b` $1
- **THEN** `b` comes before `a`, and both come before every session with fewer failed calls

#### Scenario: No value under the second key
- **WHEN** a client asks for `sort=-commits,-output_per_s` and two sessions with 2 commits include a Codex session, which records no model time
- **THEN** the Codex session comes after the other session with 2 commits, and before every session with 1 commit

#### Scenario: The earlier form
- **WHEN** a client asks for `/api/sessions?sort=cost&desc=1`
- **THEN** the answer is the same as for `sort=-cost`

### Requirement: Refuse a sort the server cannot read
The server SHALL answer 400 for a `sort` that holds an unknown key, the same key twice, an empty key or more than three keys, and for `desc=1` beside a `sort` that is not one key without a `-`.

#### Scenario: Four keys
- **WHEN** a client asks for `sort=cost,tokens,prompts,errors`
- **THEN** the server answers 400

#### Scenario: A key twice
- **WHEN** a client asks for `sort=cost,-cost`
- **THEN** the server answers 400

#### Scenario: Both forms at once
- **WHEN** a client asks for `sort=-cost,prompts&desc=1`
- **THEN** the server answers 400

#### Scenario: Blank sort
- **WHEN** a client asks for `/api/sessions?sort=`
- **THEN** the server answers 400

#### Scenario: No sort
- **WHEN** a client asks for `/api/sessions` with no `sort` key
- **THEN** the server answers the list in its own order, newest first

### Requirement: Page a sorted list without repeats
Rows that every sort key leaves tied SHALL keep the list's own order: newest first, nearest the limit first with the near-limit filter, costliest first on a selected day. Rows still tied SHALL be ordered by session id. The order SHALL be the same on every request over the same data, so pages neither repeat nor skip a session.

#### Scenario: Many ties
- **WHEN** 250 sessions all have 0 failed calls and a client reads `sort=-errors` in pages of 100
- **THEN** the three pages hold each of the 250 sessions once, newest first

#### Scenario: Identical start timestamps
- **WHEN** two sessions have identical start timestamps and no other sort or default order tells them apart
- **THEN** every request lists them in the order of their session ids

### Requirement: Add a column to the Sessions sort
Sessions SHALL offer a "Sort by several columns" checkbox. While it is ticked, activating a sortable header SHALL add its column as the last sort key, most first; activating it again SHALL reverse it, and a third time SHALL remove it. Activating a header with Shift held SHALL do the same whether or not the box is ticked. While the box is not ticked, activating a header without Shift SHALL sort by that column alone, as before.

#### Scenario: Keyboard
- **WHEN** Sessions is sorted by cost, the user ticks "Sort by several columns", moves focus to the Prompts header button and presses Enter
- **THEN** Sessions is sorted by cost, then prompts, most first, and focus stays on the Prompts button

#### Scenario: Shift
- **WHEN** the box is not ticked, Sessions is sorted by cost and the user Shift-clicks the Failed header
- **THEN** Sessions is sorted by cost, then failed calls

#### Scenario: Third press
- **WHEN** Sessions is sorted by cost, then prompts descending, the box is ticked and the user activates Prompts twice
- **THEN** prompts sorts ascending after the first press and leaves the sort after the second, which leaves cost alone

#### Scenario: One column again
- **WHEN** Sessions is sorted by cost, then prompts, the box is not ticked and the user clicks Tokens
- **THEN** Sessions is sorted by tokens alone, most first

### Requirement: Cap the Sessions sort at three columns
The Sessions sort SHALL hold at most three keys. Adding a column when it holds three SHALL replace the last key and keep the first two.

#### Scenario: A fourth column
- **WHEN** Sessions is sorted by cost, prompts, then tokens, and the user adds Failed
- **THEN** Sessions is sorted by cost, prompts, then failed calls

### Requirement: Mark each sorted Sessions header
Each sorted Sessions header SHALL show its direction, and its rank when the sort has more than one key. Only the first key's header SHALL carry `aria-sort`. With more than one key, every sorted header's button SHALL also say its rank and the number of keys in its accessible name, and each header after the first SHALL say its direction there too.

#### Scenario: Two keys
- **WHEN** Sessions is sorted by cost descending, then prompts descending
- **THEN** the Est. cost header carries `aria-sort="descending"` and shows "↓1", the Prompts header carries no `aria-sort` and shows "↓2", and the Prompts button is named "Prompts, sort 2 of 2, descending"

#### Scenario: One key
- **WHEN** Sessions is sorted by cost alone
- **THEN** the Est. cost header shows "↓" with no rank, carries `aria-sort="descending"`, and its button is named "Est. cost"

### Requirement: Say the whole Sessions order
The Sessions hint SHALL say the order of every sort key, the first key first, each next one after "then". It SHALL say the new order, as a polite status, when the sort changes.

#### Scenario: Two keys
- **WHEN** 250 sessions are sorted by cost descending, then prompts descending
- **THEN** the hint reads "250 sessions, costliest first, then most prompts first." before the count shown

### Requirement: Choose the Sessions columns
Sessions SHALL offer a Columns button that opens a list with one checkbox per column except Session, in the table's order. A checkbox SHALL be ticked when its column shows in the window as it is. Unticking a checkbox SHALL hide its column at every width. The Session column and the selection column SHALL NOT be offered and SHALL always show.

#### Scenario: Hide a column
- **WHEN** the user opens Columns at 1440px and unticks Compactions
- **THEN** the Compactions header and cells leave the table, and the other columns stay

#### Scenario: Session is not offered
- **WHEN** the user opens Columns
- **THEN** the list has Project, Active, Model, Tok/s, Prompts, Tokens, Est. cost, Peak context, Failed, Compactions, Commits and Tests, and no Session

#### Scenario: A column the width hides
- **WHEN** the user opens Columns at 390px, where the width hides Tokens
- **THEN** the Tokens checkbox is not ticked

### Requirement: Operate the column list by keyboard and screen reader
The Columns button SHALL say whether its list is open. Opening it SHALL move focus into the list, which SHALL be named "Columns". Tab SHALL move through its checkboxes and Space SHALL toggle one; the list SHALL stay open while checkboxes change. Escape SHALL close the list and return focus to the button. A click outside the list SHALL close it; focus SHALL stay on the element the click lands on when that element takes focus, and SHALL return to the button when it does not.

#### Scenario: Keyboard
- **WHEN** the user presses Enter on Columns, Tab to Tokens, Space, then Escape
- **THEN** the list opened with focus inside it, Tokens changed while the list stayed open, and focus is on the Columns button with the list closed

#### Scenario: Click on a control outside the list
- **WHEN** the list is open and the user clicks the Search sessions field
- **THEN** the list closes and focus is in the Search sessions field

#### Scenario: Click on nothing focusable
- **WHEN** the list is open and the user clicks plain text outside it, such as the work chart's hint
- **THEN** the list closes and focus is on the Columns button

#### Scenario: Screen reader
- **WHEN** a screen reader user moves to the Columns button and activates it
- **THEN** the button reads as collapsed, then expanded, and each checkbox reads its column's name and whether it is ticked

### Requirement: Keep a chosen column at every width
Ticking a column that the window's width hides SHALL keep it shown at every width; the table SHALL scroll sideways in its region when its columns do not fit. A column the user has not chosen SHALL keep hiding by its width priority. Ticking a column the user hid, at a width that shows it, SHALL return it to hiding by its width priority.

#### Scenario: Bring back a column on a phone
- **WHEN** the user ticks Tokens at 390px
- **THEN** Tokens shows at 390px and at every other width, and the Sessions region scrolls sideways if the table is wider than it

#### Scenario: Untouched columns
- **WHEN** the user ticked Tokens at 390px and has not touched Compactions
- **THEN** Compactions still hides under 78.75em

#### Scenario: Hide, then show
- **WHEN** the user unticks Active at 1440px, then ticks it again
- **THEN** Active shows at 1440px and hides again at 390px

### Requirement: Reset the Sessions columns
The column list SHALL offer "Reset columns", which SHALL drop every choice, so each column shows or hides by the window's width as it did before any choice. The Columns button SHALL say how many columns the user has hidden.

#### Scenario: Reset
- **WHEN** the user hid Compactions and Commits, the button reads "Columns, 2 hidden", and the user activates Reset columns
- **THEN** both columns show again at 1440px, the button reads "Columns", and the list stays open with focus on Reset columns

### Requirement: Keep the column choice per browser
The column choice SHALL be saved in the browser and SHALL apply on every later visit in that browser, in every view. It SHALL NOT be written to the URL. When storage is unavailable, the choice SHALL last for the page view. A saved value that cannot be read, and a column in it that the table does not have, SHALL be ignored.

#### Scenario: Reload
- **WHEN** the user hides Compactions and reloads the page
- **THEN** Sessions opens without Compactions

#### Scenario: Shared link
- **WHEN** another browser with no saved choice opens a link copied from a Sessions table with hidden columns
- **THEN** Sessions shows its automatic columns

#### Scenario: Storage blocked
- **WHEN** the browser blocks site storage and the user hides Compactions
- **THEN** Compactions is hidden until the page is reloaded

#### Scenario: Unknown column
- **WHEN** the saved choice names a column the table no longer has
- **THEN** Sessions ignores that entry and applies the others

### Requirement: Show every sorted column
A column in the Sessions sort SHALL show at every width and whatever the column choice says, for as long as it is in the sort; the choice SHALL apply again when the column leaves the sort. Unticking a column that is in the sort SHALL remove it from the sort.

#### Scenario: A vital sorts a hidden column
- **WHEN** the user hid Tok/s and activates the Output speed vital
- **THEN** Tok/s shows, sorted fastest first, and hides again when the sort moves to another column

#### Scenario: Hide a sorted column
- **WHEN** Sessions is sorted by cost, then prompts, and the user unticks Prompts
- **THEN** Prompts leaves the table and the sort, Sessions is sorted by cost alone, and the hint says so

#### Scenario: Three keys on a phone
- **WHEN** Sessions is sorted by tokens, compactions, then commits at 390px
- **THEN** all three columns show and the Sessions region scrolls sideways if the table is wider than it

### Requirement: Select sessions with a checkbox
Each Sessions row SHALL start with a checkbox named "Select" and the session's name. Activating the checkbox or its cell SHALL select or unselect the session and SHALL NOT open the session sheet. The rest of the row SHALL open the sheet as before. The table SHALL offer no select-all.

#### Scenario: Click a checkbox
- **WHEN** the user clicks the checkbox of the row "Fix login"
- **THEN** the row is selected, no sheet opens and the URL does not change

#### Scenario: Keyboard
- **WHEN** focus is on the checkbox "Select Fix login" and the user presses Space, then Tab
- **THEN** the session is selected and focus is on the row's session button, which Enter opens

#### Scenario: The rest of the row
- **WHEN** the user clicks the cost cell of a selected row
- **THEN** the session sheet opens and the row stays selected

### Requirement: Cap the selection at four sessions
At most four sessions SHALL be selected. With four selected, the checkboxes of the other rows SHALL be disabled, and the selection bar SHALL say that four is the most that compare.

#### Scenario: A fifth session
- **WHEN** four sessions are selected
- **THEN** every other row's checkbox is disabled, and unselecting one enables them again

### Requirement: Show the selection in a bar
While a session is selected, a bar above the Sessions table SHALL say how many are selected, as a polite status, and SHALL offer Clear selection, which SHALL unselect every session and move focus to the search field. With one session selected, the bar SHALL say that one more is needed to compare.

#### Scenario: First selection
- **WHEN** the user selects one session
- **THEN** the bar reads "1 selected. Select 1 more to compare." and offers Clear selection

#### Scenario: Clear
- **WHEN** three sessions are selected and the user activates Clear selection
- **THEN** no session is selected, the bar is gone and focus is on the search field

### Requirement: Keep the selection through list changes
The selection SHALL survive Show more, a sort change, a change of the search text or the near-limit filter, a refresh, a workbench tab change and an open sheet. A selected session the list no longer shows SHALL stay selected and counted. The selection SHALL clear when the project, range, source, automated toggle, or selected day or week changes.

#### Scenario: Show more and sort
- **WHEN** the user selects two sessions, loads more sessions and sorts by cost
- **THEN** both sessions are still selected, and their rows are ticked wherever they are listed

#### Scenario: A search that leaves a selected session out
- **WHEN** two sessions are selected and the user types a search that matches one of them
- **THEN** the bar still reads "2 selected" and the comparison still has both

#### Scenario: Refresh
- **WHEN** an ingest refreshes the Sessions rows while two sessions are selected
- **THEN** both stay selected

#### Scenario: Another range
- **WHEN** two sessions are selected and the user changes the range
- **THEN** no session is selected

#### Scenario: A day on the chart
- **WHEN** two sessions are selected and the user selects a day on the work chart
- **THEN** no session is selected

### Requirement: Select only rows of the view asked for
While the rows on screen were counted for another project, range, source, automated setting or selected days than the URL asks for, their checkboxes SHALL be disabled, and no figure of those rows SHALL enter the selection or the comparison. The rows SHALL still open their session sheet.

#### Scenario: A range that is still loading
- **WHEN** the user changes the range from 30 to 7 days and the 7-day figures have not arrived, so Sessions still lists the 30-day rows
- **THEN** no session is selected, every row's checkbox is disabled, and a row still opens its sheet

#### Scenario: The range arrives
- **WHEN** the 7-day figures and rows arrive
- **THEN** the checkboxes are enabled, and a session ticked then shows the figures of its row in the 7-day view in the comparison

#### Scenario: A range that fails to load
- **WHEN** the 7-day figures fail to load and Sessions keeps the 30-day rows
- **THEN** the checkboxes stay disabled until the view asked for and the rows shown agree again

### Requirement: Keep the selection out of the URL
The selection and the comparison SHALL NOT be written to the URL or saved in the browser: a reload or a copied link SHALL show Sessions with no session selected.

#### Scenario: Reload
- **WHEN** the user compares three sessions and reloads the page
- **THEN** Sessions shows no selection and no comparison, and the URL never named the sessions

### Requirement: Compare the selected sessions
With two or more sessions selected, the bar SHALL offer Compare, a button that says whether the comparison shows. Activating it SHALL show, above the Sessions table, a table named "Session comparison" with one column per selected session, in the order selected, and one row per figure. Focus SHALL stay on the button. Activating it again SHALL hide the comparison.

#### Scenario: Compare three
- **WHEN** the user selects three sessions and activates Compare
- **THEN** "Session comparison" shows above the Sessions table with three session columns in the order selected, the button reads as expanded and keeps focus

#### Scenario: Select while comparing
- **WHEN** the comparison shows three sessions and the user ticks a fourth row
- **THEN** the comparison gains a fourth column

#### Scenario: Headers
- **WHEN** a screen reader user reads a cell of the comparison
- **THEN** it hears the figure's name from the row header and the session's name from the column header

### Requirement: Show the table's figures in the comparison
The comparison SHALL have one row for each of project, start, active time, model time, output speed, prompts, tokens, estimated cost, peak context, failed calls, compactions, commits and tests, whatever columns the user has hidden. Each figure SHALL read as the Sessions table shows it for the same view and selected days, in the same format.

#### Scenario: Hidden column
- **WHEN** the user hid Compactions and compares two sessions
- **THEN** the comparison has a Compactions row

#### Scenario: Same figures
- **WHEN** a session's row reads $4.20 and 12/14 tests in the Sessions table
- **THEN** its comparison column reads $4.20 and 12/14

### Requirement: Keep each figure's scope in the comparison
The comparison SHALL use each figure's scope from the Sessions list. Start SHALL be the session's actual start, and Active SHALL cover the whole session unless a day or week is selected. Model time, output speed, peak context and compactions SHALL be whole-session figures. Prompts, tokens, estimated cost, failed calls, commits and tests SHALL count the view's range, or the selected days. The comparison SHALL make no request.

#### Scenario: A session that starts before the range
- **WHEN** a session started 10 days ago, was active 3 hours in all and 1 hour in the last 7 days, and the user compares it in a 7-day view with no day selected
- **THEN** its Start reads the day it started, 10 days ago, its Active reads 3 hours, and its prompts count the last 7 days only, as its row in the Sessions table reads

#### Scenario: A selected day
- **WHEN** the user selects a day on the work chart and compares two of its sessions
- **THEN** Active, prompts, tokens, estimated cost, failed calls, commits and tests are that day's, and model time, output speed, peak context and compactions are the whole session's

#### Scenario: No request
- **WHEN** the user opens the comparison
- **THEN** the app asks the server for nothing

### Requirement: Show a missing figure in the comparison
A figure a session does not record SHALL read "–" in the comparison. When a compared session records no model time, a note under the comparison SHALL say that "–" there means the session records no model time. On a selected day, the whole-session figures SHALL say that they are, as the Sessions table's do.

#### Scenario: Codex beside Claude Code
- **WHEN** the user compares a Codex session with a Claude Code session that records model time
- **THEN** the Codex column reads "–" for model time and output speed, the other column shows its figures, and the note explains the "–"

#### Scenario: Grok
- **WHEN** the user compares a Grok session whose turns record model time
- **THEN** its column shows its model time and output speed

#### Scenario: Unpriced session
- **WHEN** a compared session ran only on a model with no price
- **THEN** its estimated cost reads "–"

### Requirement: Keep compared figures current
The comparison SHALL show, for each selected session the list holds, the figures of its current row, so a refresh updates them. A selected session the list no longer holds SHALL keep the figures of the last row the list showed for it in the view asked for, not those it had when it was selected.

#### Scenario: Refresh
- **WHEN** a compared session gains 2 commits and an ingest refreshes the rows that hold it
- **THEN** its comparison column shows the new count

#### Scenario: Not listed
- **WHEN** a search leaves a compared session out of the list and an ingest refreshes the rows
- **THEN** its comparison column keeps the figures it had

#### Scenario: Refresh, then a search
- **WHEN** a session is selected with 0 commits, an ingest refreshes its row to 2 commits, and the user then types a search that leaves it out of the list
- **THEN** its comparison column still reads 2 commits

### Requirement: Open and remove a session from the comparison
Each comparison column's header SHALL hold the session's name as a button that opens its session sheet, and a Remove button named after the session, which SHALL unselect it. Removing SHALL move focus to the next column's Remove button, else to the previous one's. When fewer than two sessions stay selected, the comparison SHALL close and focus SHALL move to Clear selection.

#### Scenario: Open a session
- **WHEN** the user activates a session's name in the comparison and then closes the sheet
- **THEN** the session sheet opened over Activity, and focus returns to the name with the comparison still shown

#### Scenario: Remove one of three
- **WHEN** the comparison shows three sessions and the user activates the Remove button of the second
- **THEN** two columns stay, the session's row is unticked, and focus is on the Remove button of the session that followed it

#### Scenario: Remove one of two
- **WHEN** the comparison shows two sessions and the user removes one
- **THEN** the comparison closes, the bar reads "1 selected. Select 1 more to compare." and focus is on Clear selection

### Requirement: Keep the Sessions controls usable while rows load
While the Sessions rows are stale and inert, the Columns button, the "Sort by several columns" checkbox, the sortable headers, the selection bar and the comparison SHALL stay usable, and the row checkboxes SHALL be inert with their rows.

#### Scenario: Sort while loading
- **WHEN** a new sort is loading and the rows are inert
- **THEN** the user can still open Columns, remove a session from the comparison and add a sort key, and cannot tick a row

### Requirement: Fit the Sessions extras on a narrow screen
At 390px wide, the Sessions controls SHALL wrap without sideways scroll of the page, the column list SHALL fit in the viewport and scroll when it is taller than the room it has, the selection column SHALL show, and the comparison SHALL scroll sideways inside its own named region when its columns do not fit.

#### Scenario: A phone
- **WHEN** the user opens Sessions at 390px, opens Columns, then compares four sessions
- **THEN** the page does not scroll sideways, the column list stays inside the viewport, every row has its checkbox, and the comparison scrolls inside its region

### Requirement: Zoom the work chart
In a view of 14 bars or more, by day or by week, the work chart SHALL show a zoom control under the bucket labels that narrows the bars the chart shows, down to 7. The control SHALL NOT show in a view of fewer bars. Both tracks SHALL keep the scales of the whole view while zoomed. The zoom SHALL return to every bar when the view or the measure changes. A view is a range with its first bar, the bucket, a project, a source and the automated-sessions filter.

#### Scenario: Zoom in
- **WHEN** the user drags the zoom control's handles to Oct 11 and Oct 20 in a 30-day view
- **THEN** the chart shows those ten days, wider, with the bars and the rate line on the same scales as before

#### Scenario: Few bars
- **WHEN** the chart shows 11 weeks
- **THEN** no zoom control shows

#### Scenario: Many weeks
- **WHEN** the chart shows 30 weeks
- **THEN** the zoom control shows, and narrows the chart down to 7 weeks

#### Scenario: Measure change
- **WHEN** the chart is zoomed and the user chooses Prompts
- **THEN** the chart shows every bar

#### Scenario: The range moves on a day
- **WHEN** the chart is zoomed in a 30-day view, and at midnight the view's first bar becomes the next day
- **THEN** the chart shows every bar of the new view

### Requirement: Keep the work chart's zoom and reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the work chart SHALL draw it and SHALL keep the bars shown, the "Show all" button with any focus on it, and the bar being read. Selecting or clearing a bar SHALL keep the bars shown too. The polite status SHALL say nothing for such a redraw. Only a bar the keyboard is reading SHALL be said again, alone, when its words changed.

#### Scenario: Ingest while zoomed
- **WHEN** the chart shows Oct 11 to Oct 20 of a 30-day view and an ingest adds a commit to today
- **THEN** the chart still shows Oct 11 to Oct 20, and the status says nothing

#### Scenario: Ingest while reading
- **WHEN** the user is reading Oct 13 with the arrow keys and an ingest adds a commit to today
- **THEN** Oct 13 is still read, with its tooltip, and the status does not repeat it

#### Scenario: Today read by keyboard
- **WHEN** the user reads today with the arrow keys and an ingest adds a commit to today
- **THEN** the tooltip shows the new count and the status says the day again with it

#### Scenario: Select while zoomed
- **WHEN** the chart shows Oct 11 to Oct 20 and the user selects Oct 15
- **THEN** the tabs narrow to Oct 15 and the chart still shows Oct 11 to Oct 20

### Requirement: Keep the view and the selection unchanged while zoomed
Zooming the work chart SHALL NOT change the page's time range, the URL, the data requested, the page's figures, the selected day or week, the tabs, the chart's accessible name or the chart's data table.

#### Scenario: Zoomed page
- **WHEN** the user zooms the chart to ten days of a 30-day view
- **THEN** the heading, the vitals, the tabs and the URL still describe 30 days, no request is made, and the data table lists 30 days

#### Scenario: Selection outside the bars shown
- **WHEN** Oct 3 is selected and the user zooms the chart to Oct 11 to Oct 20
- **THEN** the chip still names Oct 3 and the tabs still show Oct 3

### Requirement: Zoom and reset the work chart by keyboard
With the chart focused and its zoom control available, the plus key SHALL halve the bars shown, rounding up and stopping at 7, and the minus key SHALL double them up to the full view, both around the bar read or, when none, the newest. While zoomed, a "Show all days" button, or "Show all weeks" on a chart by week, SHALL reset it. A polite status SHALL say the bars shown after each change. The arrow keys, Home and End SHALL still reach every bar, moving the bars shown to include the bar read.

#### Scenario: Zoom in by keyboard
- **WHEN** the chart shows 30 days, the user reads Oct 20 and presses plus
- **THEN** the chart shows 15 days that include Oct 20, and the status says which days are shown, as "Showing Oct 11 to Oct 25, 15 of 30 days."

#### Scenario: Weeks
- **WHEN** a chart of 20 weeks is zoomed to the weeks of Oct 5 to Nov 9
- **THEN** the status says "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks.", and the reset button reads "Show all weeks"

#### Scenario: Reset
- **WHEN** the chart is zoomed and the user selects "Show all days"
- **THEN** the chart shows every day, the button goes away, and focus is on the chart

#### Scenario: Reading past the zoom
- **WHEN** the chart shows Oct 11 to Oct 20 and the user presses End
- **THEN** the last day of the view is read, the days shown move to include it, and the status says the day and then the days shown

#### Scenario: Browser zoom
- **WHEN** the chart has focus and the user presses Ctrl and plus
- **THEN** the chart's zoom does not change and the browser zooms the page

### Requirement: Mark the selected bar on the work chart
While a day or a week is selected and the chart has its bar, the chart SHALL mark that bar with a tinted, framed band across both tracks, under the bars. The mark SHALL stay while other bars are read and when newer data arrives. A selection that the chart has no bar for, or that the zoom leaves out, SHALL mark no bar, and the chip SHALL still name it.

#### Scenario: Selected day
- **WHEN** the user selects Nov 4
- **THEN** Nov 4 has a framed band from the top of the bars to the bottom of the rate track, and it stays while the user reads other days

#### Scenario: A week on a chart by day
- **WHEN** a link names the week of Nov 2 and the chart is by day
- **THEN** the chip reads "Week of Nov 2" and no bar is marked

#### Scenario: Zoomed away
- **WHEN** Nov 4 is selected and the chart is zoomed to Nov 10 to Nov 20
- **THEN** no bar is marked and the chip still reads "Nov 4"

### Requirement: Say what a work chart selection did
After a selection by a click or Enter, a polite status SHALL say once the bucket selected and what the tabs now show; selecting the selected bar again SHALL say it is still selected. After a clear by the chip or by Escape, it SHALL say once that the tabs show the whole range. A reading SHALL replace the sentence, and its end SHALL NOT say it again. It SHALL win over a redraw's sentence of the same moment. A selection changed from outside the chart, or opened from the URL, SHALL say nothing.

#### Scenario: Select a week
- **WHEN** the user presses Enter on the week of Sep 7
- **THEN** the reading ends and the status says "Week of Sep 7, 2026 selected; the tabs below show its days."

#### Scenario: Clear with Escape
- **WHEN** a day is selected, no bar is read and the user presses Escape on the chart
- **THEN** the status says "Selection cleared; the tabs below show the whole range."

#### Scenario: A reading after a selection
- **WHEN** the user selects a day, reads another bar and presses Escape
- **THEN** the status is empty: the selection sentence is not said a second time

#### Scenario: A link with a selection
- **WHEN** the user opens a link with `day=2026-11-04`
- **THEN** the chip names Nov 4 and the status says nothing

#### Scenario: Select the selected bar again
- **WHEN** Nov 4 is selected and the user presses Enter on Nov 4, then reads it again and presses Enter once more
- **THEN** the status says "Nov 4, 2026 is still selected; the tabs below show its figures.", then "Nov 4, 2026 is already selected; the tabs below show its figures."

#### Scenario: A clear from outside the chart
- **WHEN** a day is selected, the status still says so, and the user presses the tab note's "Show the whole range"
- **THEN** the selection is cleared, the status is emptied and says nothing, and the focus moves to the chart

#### Scenario: A selection and a zoom that ends at the same moment
- **WHEN** a selection's sentence and the sentence of a zoom that ended with no one asking come in the same redraw
- **THEN** the status says the selection's sentence alone, and the chart shows every bar

### Requirement: Keep the work chart's bars their height at a larger text size
The bars track SHALL keep its height at every browser text size up to 200%. The chart's box SHALL grow by the room that its labels and the rate track need at that size.

#### Scenario: Default text size
- **WHEN** the browser's default font size is 16px and the view has fewer than 14 bars
- **THEN** the chart's box is 216px tall

#### Scenario: 200% text
- **WHEN** the browser's default font size is 32px
- **THEN** the bars track is as tall as at 16px, the rate track is twice as tall, and no label overlaps another
