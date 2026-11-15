---
title: Activity
description: What got done per day or week, by project, and what needs your attention.
spec: [usage-dashboard]
---

Activity answers one question: what did the agents get done in this view, and where did they struggle? It counts commits, prompts, sessions and active days, and it lists error loops, sessions near the context limit, flaky tools and failed test runs. Its heading, Needs attention and Project metrics show no cost figure; [Cost](/ai-ledger/pages/cost/) leads with cost. The Sessions drawer and the sheets show each session's estimated cost.

The page follows the filters at its top. Every figure below describes the selected project, time range and source.

<!-- shot slot: activity-attention (the "Needs attention" card) -->
<!-- shot slot: activity-work (the "Work per day" chart) -->
<!-- shot slot: activity-hours (the "Prompts by hour" heatmap) -->

## Filters

| Control | Values |
| --- | --- |
| Project | A searchable list of projects, plus "All projects". |
| Time range | 7d, 14d, 30d, 90d, All. The default is 30d. |
| Source | All, Claude Code, Codex. |
| Include automated sessions | On or off. A tooltip names the file that lists more automated projects. |

The filters live in the page URL. The project filter changes only through these controls, or through a "Filter dashboard to" button in a sheet; selecting a project or session elsewhere opens a sheet and leaves the filter alone. See [Filters](/ai-ledger/everywhere/filters/) for how they behave on every page.

A selected day is cleared in the same step as any change of project, range or source.

## Page order

The page has a section index (Overview, Attention, Health, Work, Hours) and six drawers (Sessions, Projects, Tools, MCP & hooks, Loops, Tests). A drawer is a table folded behind its title. Opening one from a card or chart scrolls to it.

### Overview

**Shows** the heading, which answers "what got done?":

> 30 commits from 212 prompts, up from 20 commits, in 41 sessions across 6 projects, 18 active days

**Figures**

- Commits, prompts, sessions and active days of the view. An active day is a day with at least one user prompt; a session that works alone on a day with no prompt does not make it active.
- With one project selected, the heading adds "on" and the project. With the All range, it adds "since" and the first day with a session, and shows no change.
- Commits, sessions and active days each show their change against the previous period of equal length: "up from", "down from", or "unchanged".
- Under the heading: turns per prompt, tool calls per prompt, and the number of prompts interrupted.
- With no requests in the view, the heading reads "No agent activity in the last 30 days." (or "yet" for All). With a source selected, it names the source in place of "agent".

**Banner** "Automated projects file ignored" appears when the automated projects file cannot be used. It names the file and the reason. See [Configuration](/ai-ledger/reference/configuration/).

### Needs attention

**Shows** every problem found in the view, each with an action. The card opens just under the heading. It is hidden when the view has no requests.

**Figures**

| Line | Condition | Action |
| --- | --- | --- |
| N error loops: a tool failed 3+ times in a row. | At least one error loop. Marked as needing action. | See loops opens the Error loops drawer. |
| N sessions reached 80%+ of the context window. | At least one session at 80% or more. | See it or See them opens the Sessions drawer, limited to those sessions, nearest the limit first. |
| N tools fail over 10% of calls, worst *tool* (rate). | A flaky tool: one that failed more than 10% of at least 20 calls. | See tools opens the Tools drawer with those tools first. |
| N failed test runs of M. | At least one failed test or build run. | See tests opens the Failed test runs drawer. |

The card's title reads "N things to look at". With none of the four, it reads "Nothing needs attention".

### Work health

**Shows** five tiles. Each tile shows its change against the previous period of equal length, as ", up from X", ", down from X" or ", unchanged". The All range shows no change.

| Tile | Figure | Note under it | Marked worse when |
| --- | --- | --- | --- |
| Errors per 100 calls | Failed calls per 100 tool calls | "N failed of M tool calls." | It goes up. |
| Test runs passed | Share of test and build runs that passed, or "n/a" | "N passed, M failed of K test or build runs." | It goes down. |
| Prompts interrupted | Share of prompts interrupted | "N of M prompts." | It goes up. |
| Subagents | Share of tokens that came from subagents | "of tokens came from subagents." | Never judged. |
| Median session | Median active time of a session | "N sessions, X active and Y thinking in all." | Never judged. |

A session's active time leaves out every pause over 20 minutes. Two figures that display the same value read "unchanged".

### Work per day, or per week

**Shows** one bar per day, or per week, from the first day with a session to the end of the range. Idle days show as zero.

**Figures**

- The bars count Commits, Prompts or Sessions, as chosen. Commits is the default. The choice is kept in the browser.
- With several projects, each bar stacks the projects that have a color of their own, as Cost does, and puts every other project, and sessions with no project, in Other. With one project, or with no project that has a color, the bars are plain.
- A line shows errors per 100 tool calls against a right-hand axis. The failed count stays in the tooltip. A view with no tool calls shows no line, axis or legend entry.
- A label names the peak bar.
- The tooltip lists the commits, prompts and sessions of the bar, the project parts of the chosen measure, errors per 100 calls, and failed tool calls out of all tool calls.
- When the span from the first day with a session to today is over 60 days, the chart shows one bar per week, starting Monday on the machine's clock, and the title reads "Work per week". A week bar is labeled "Week of Oct 5". The week that holds the end of the range reads "so far"; a first week cut by the start of the range reads "from" its start date. Commit and prompt totals equal the sum of the bars. A session counts once in each week it touches, so the Sessions bars can add up to more than the total.

**Controls**

- **Commits, Prompts, Sessions** switch the measure.
- Select a day, or focus the chart, use the arrow keys (Home and End jump to the ends) and press Enter, to select that day. The Sessions drawer opens limited to the sessions that ran on that day. Week bars cannot be selected; a hint says to choose a shorter range.
- **Show data table** opens a named table under the chart: one row per day or week, the measure by project with Other, its total, and errors per 100 calls. It is closed on every page load.

A selected day also narrows Tools, MCP servers, skills and hooks, and Error loops to that day, and the Sessions drawer shows each session's figures for that day. A note in each narrowed drawer says so and offers "Show the whole range". The heading, Needs attention, Work health and Project metrics keep the range's figures.

### Prompts by hour

**Shows** a heatmap of prompts by weekday (Monday first) and hour, on the machine's local clock. A darker cell holds more prompts.

**Figures**

- A summary line names the busiest hour and the busiest day, and counts ties ("and 2 others"), then gives the total number of prompts.
- With no prompts in the range, the panel reads "No prompts in this range."

**Controls** The heatmap is one tab stop. The arrow keys move between cells, and Home and End jump to the first and last hour of the row. The cell under the cursor is read under the grid.

## Drawers

Each drawer title carries a count. The Sessions, Project metrics and Tools tables sort by a column: select a header; the sorted header carries `aria-sort`.

### Sessions

**Shows** every session in the view, one row each. The drawer title counts the sessions in the view. A line says a session counts here when it has a request in the range, and that Insights counts sessions by their start time, so the two totals can differ slightly.

**Columns**

| Column | Meaning |
| --- | --- |
| Session | Title, or its id; under it the start time, git branch and short id. |
| Project | The session's project. |
| Active | Active time. Pauses over 20 minutes are left out. |
| Prompts | User prompts. |
| Tokens | Tokens of the session. |
| Est. cost | Estimated cost at API list prices. |
| Peak context | Largest request. A chip shows the share of the context window when it is 80% or more. |
| Failed | Failed tool calls. |
| Compactions | Context compactions. |
| Commits | Successful `git commit` calls. |
| Tests | Test and build runs, passed of run, or "–" when none. |

**Controls**

- Search by title, session id, project or branch.
- **Near context limit only** limits the list to sessions at 80% or more of the context window.
- A day chip, "Active on *day*", shows when a day is selected. Its ✕ shows every day again.
- Every column except Project sorts, over the whole matching list on the server. Without a chosen sort, the order is newest first; with the near-limit filter, nearest the limit first; with a day, by cost on that day.
- A row opens the session sheet.
- **Show more sessions** loads the next page.
- The day, search text and near-limit filter are kept in the URL and restored on reload. The sort is not kept. A day that is not a real calendar date reads as no day.
- With a day selected, every figure is that day's, except Peak context and Compactions, which stay whole-session figures; a tooltip says so.

### Project metrics

**Shows** one row per project in the view, ordered by sessions, most first. There is no cost column.

**Columns** Project, Sessions (with a bar), Tokens, Subagents (share of tokens), Tokens / prompt, Commits, Errors / 100, Error loops.

With three or more projects, the Errors / 100 and Error loops cells are tinted when far from the median project, with a ▲ or ▼ mark and a key above the table. A project whose errors per 100 calls are 1.5 times the median or more is marked worse; an error-loop count that is 2 or more and above the median is marked worse. Hover a tinted cell for how far.

A row opens the project sheet. Every row sorts in the browser.

### Tools

**Shows** every tool called in the view, most calls first.

**Columns** Tool, Calls, Failed (failure rate), p50 and p95 (median and 95th-percentile time from `tool_use` to `tool_result`).

See tools in Needs attention puts the tools failing over 10% of at least 20 calls first, until you choose a column. A row opens the tool sheet.

### MCP servers, skills and hooks

**Shows** three tables: MCP servers (Server, Calls, Failed), Skills (Skill, Calls, Failed) and Hooks (Hook, Runs, Failed, Avg). A hook is named by its command cut to the last segment of each path, with its event under it. A row of the MCP servers or Skills table opens its sheet. Hooks have no sheet.

### Error loops

**Shows** the newest error loops in the view: the same tool failing three or more times in a row within a session. When there are more than the page carries, a hint says "Showing the N newest of M".

**Columns** When, Project, Session (opens the session sheet), Tool, Failures, and an "Open in Errors" link to the loop's first failure on [Errors](/ai-ledger/pages/errors/).

### Failed test runs

**Shows** the newest failed test and build runs. The drawer count is every failed run in the view. A list cut at the newest 50 says "Showing the 50 newest of N".

**Columns** When, Project, Session (opens the session sheet), Command, and an "Open in Errors" link to the failure on Errors.

## Sheets

A sheet opens beside the page and does not change the filters. Its state is in the URL, so Back, reload and shared links agree with it.

### Session sheet

Shows the whole session, whatever the range filter says.

- A line names the project (it opens the project sheet), the git branch, and the first and last time.
- **Filter dashboard to *project*** or **Show all projects**.
- **Source**: the first prompt as recorded. A long prompt is cut; **Show the whole prompt** loads all of it.
- A line of figures: estimated cost (a "+" marks a subtotal when some model has no price; "Unknown" when none has), tokens, prompts and interrupted prompts, peak context with its share of the window, compactions, commits, active time.
- **/insights judgment**, tagged model-judged, when the session has an `/insights` analysis: outcome, a "dissatisfied" marker when satisfaction includes it, helpfulness and session type, goal and friction categories, a brief summary and the friction detail, and **Open in Insights**, which keeps the view's filters. Only Claude Code sessions are analysed; a Codex session never shows it. See [Insights](/ai-ledger/pages/insights/).
- **Timeline** of the session.
- **Error loops** in the session, each with "Open in Errors".
- **Commits**, **Models** (requests, tokens, estimated cost) and **Tools** (calls, failed, p50), each folded.
- The session id, the working directory when the store has it, and the command that resumes the session, each with **Copy**. The resume command is `claude --resume <id>` or `codex resume <id>`, after `cd '<directory>' && ` when the directory is known. A copy says "Copied", or "Copy failed".
- **Wide** widens the sheet. The choice is kept in the browser.

### Project sheet

Shows the project over the page's range and source: **Filter dashboard to *project***, **Open project page**, **Open its errors**; eight figures (estimated cost, sessions, tokens, cache hit, tokens from subagents, cost per commit, errors per 100 calls, error loops); the change against the previous period; Models and effort; and the most expensive sessions. See [Project](/ai-ledger/pages/project/).

### Tool, MCP server and skill sheet

Shows one tool, MCP server or skill over the page's view: calls with their change against the previous period, failure rate, p50 and p95 latency, share from subagents, calls per day, where it ran (source, main thread or subagents, projects), the tools or input patterns behind it, failures by type with a fix, what happened after a failure (incidents, recovered, failed again, gave up), error loops, and recent calls. A skill's count is the calls that invoked the skill, not the calls made while it ran.

## Playbooks that start here

- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): a pass over Activity and the other pages.
- [Kill repeated tool failures](/ai-ledger/improve/tool-failures/): error loops and flaky tools from Needs attention.
- [Keep context lean](/ai-ledger/improve/lean-context/): sessions near the context limit.
- [Babysit agents less](/ai-ledger/improve/babysit-less/): prompts interrupted and the work that needs attention.
- [Get sessions to finish](/ai-ledger/improve/finish-sessions/): the `/insights` judgment in the session sheet.
- [Retro on one project](/ai-ledger/improve/project-retro/): Project metrics and the project sheet.
- [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/): the Source filter.
- [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/): the Include automated sessions toggle.
