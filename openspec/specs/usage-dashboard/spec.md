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
Sessions SHALL sort the whole matching list on the server, not the loaded page; the server SHALL answer 400 for a sort it does not know. The "near limit" action and a day or week picked on the chart SHALL clear the Sessions sort; the Output speed vital SHALL set it to output speed, fastest first. The sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

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
The work chart SHALL draw its bars on a top track and errors per 100 tool calls on a thin track under it, sharing one x-axis. The rate track SHALL have its own scale on the left and no right-hand axis. One hover, tooltip and keyboard reading SHALL cover both tracks, and a view with no tool calls SHALL show no rate track or legend entry.

#### Scenario: Two tracks
- **WHEN** the user opens Activity for a view with tool calls
- **THEN** the bars and the rate line sit on separate tracks under one row of bucket labels, and reading a bucket by keyboard gives its count and its errors per 100 calls

#### Scenario: No tool calls
- **WHEN** no bucket in the view has a tool call
- **THEN** the chart shows the bars only, with no rate track and no rate legend entry

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
