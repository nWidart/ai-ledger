## ADDED Requirements

### Requirement: Show the monthly pace against the plan
Beside the heading, when `run_rate` is present, the cost dashboard SHALL show a horizontal gauge of the calendar month: the cost so far this month as a solid bar and the pace projection as a lighter extension of it. With a listed plan, it SHALL add a tick at the monthly price of the listed plans, naming each, and a badge with the projection as a multiple of that price. Its figures SHALL also be text. It SHALL NOT state savings. Without `run_rate` it SHALL NOT be shown.

#### Scenario: One plan
- **WHEN** the newest Claude snapshot names Max 20x, the month so far cost $150 and the projection is $840
- **THEN** the gauge shows $150 so far, about $840 pace, a tick at $200 named Claude Max 20x, and a "4.2× plan" badge

#### Scenario: No projection
- **WHEN** `run_rate` is null
- **THEN** no gauge is shown

### Requirement: Count only the agents a plan covers
The gauge's multiple SHALL count only the agents with a listed plan, from `run_rate.by_source`. When another agent also spent this month, the gauge SHALL name the agents it counts. A multiple below 1 SHALL be shown as such. Without a listed plan, or when no agent with a plan spent this month, the gauge SHALL show the cost so far and the pace of the whole view, with no tick and no multiple.

#### Scenario: No known plan
- **WHEN** `run_rate` is present and no plan is listed
- **THEN** the gauge shows the cost so far and the pace, with no tick and no multiple

#### Scenario: Agent without a plan
- **WHEN** only Codex has a listed plan and Claude Code also spent this month
- **THEN** the gauge counts Codex's cost only and says it counts Codex use

#### Scenario: Below the plan
- **WHEN** the projection is below the plan's monthly price
- **THEN** the badge shows the multiple below 1, such as "0.6× plan"

### Requirement: Show project spend and change in one table
The cost dashboard SHALL show one project table, "Project spend and change", with one row per project used in the view or in its previous period. Its columns SHALL be: the project; a daily cost sparkline over the view's days; the estimated cost with a bar and its share of the view's cost; the change against the previous period as a bar either side of a center line; the cost per commit; and the cache hit ratio. Selecting a row SHALL open the project sheet.

#### Scenario: Thirty-day view
- **WHEN** the user views the last 30 days across three projects
- **THEN** the table lists each project with its trend, cost and share, change, cost per commit and cache hit

### Requirement: Fit the project table to the view
The project table SHALL leave out the change column for the all-time range. A one-project view SHALL leave the table out. On phone widths the table SHALL keep the project, the cost and the change, and MAY hide the other columns.

#### Scenario: Project used only before
- **WHEN** project `old` had usage in the previous period and none in this one
- **THEN** the table lists `old` at $0 with its whole previous cost as a decrease

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the table has no change column

#### Scenario: One project
- **WHEN** the view is filtered to one project
- **THEN** no project table is shown

### Requirement: Explain the method behind a disclosure
The heading SHALL carry a "How measured" disclosure, closed by default. It SHALL name the windows with their count of days with a prompt, the previous period's cost, the view's sessions, projects, tokens and requests, that cost is estimated at API list prices (and leaves out unpriced models when some are unpriced), and how the gauge's pace and multiple are computed.

#### Scenario: Open the disclosure
- **WHEN** the user opens "How measured" on a 30-day view
- **THEN** it names both windows with their days with prompts, the previous cost, and the method of the estimate and the pace

### Requirement: Keep the insights to what the page does not already show
The cost dashboard SHALL show the cost-per-commit finding and the peak-day finding only. It SHALL NOT show a card that repeats the heading, the gauge or the project table, such as the biggest project by spend or the overall cache hit.

#### Scenario: Insights on a 30-day view
- **WHEN** the user views the last 30 days with usage
- **THEN** the insights are the cost-per-commit finding and the peak day, and no Biggest spender or Cache hit card is shown

### Requirement: Put the daily chart near the top
At 1440×900, the daily cost chart SHALL start within the first 900px of the page when no banner shows, and every chart hint SHALL be one line at that width.

#### Scenario: Desktop
- **WHEN** the user opens a 30-day view at 1440×900 with no banner
- **THEN** the top of the daily cost chart is within the first screen

## MODIFIED Requirements

### Requirement: Filter by time range and project
The cost dashboard SHALL let the user pick a time range and a project, and every figure on the page SHALL reflect that selection. The project filter SHALL change only through the filter controls or an explicit filter action; selecting a project or session elsewhere SHALL open its details in a side sheet without changing the filter.

#### Scenario: Narrow to one project
- **WHEN** the user selects project `foo` and the last 7 days on the cost dashboard
- **THEN** every chart, card and table shows only `foo` sessions from those 7 days

#### Scenario: Inspect a project without filtering
- **WHEN** the user selects project `foo` in the project table
- **THEN** a side sheet shows `foo`'s summary, the page keeps its current filter, and the sheet offers a button to filter the dashboard to `foo`

### Requirement: Lead with the period's cost and its change
The cost dashboard SHALL open with a heading of at most two figures: the estimated cost of the selected view and its change against the previous period of equal length. A line under it SHALL name the dates of both windows. For the all-time range it SHALL show the cost since the first recorded day, without a comparison.

#### Scenario: Thirty-day view
- **WHEN** the user views the last 30 days
- **THEN** the page heading shows the period's estimated cost and its change against the 30 days before, the line under it names both windows, and "How measured" gives their count of days with a prompt

#### Scenario: Thin previous period
- **WHEN** the previous period has prompts on fewer than half as many days as the current one
- **THEN** the comparison is marked as resting on thin history

#### Scenario: Previous period on unpriced models only
- **WHEN** every request in the previous period used a model missing from the price table
- **THEN** the heading says there was no priced usage before, the previous cost shows as unknown, not $0, and no change is computed

### Requirement: Show what changed by project
The project table SHALL show each project's change in estimated cost against the previous period, and SHALL mark projects with no usage in the previous period as new. A project whose cost in either period is unknown (only unpriced models) SHALL show that cost as unknown and no change. The bars SHALL share one scale, the largest change filling its half.

#### Scenario: New project
- **WHEN** project `foo` has cost in the current period and no usage in the previous one
- **THEN** `foo` shows its full cost as an increase and is marked new

### Requirement: Show token usage by kind
The dashboard SHALL show input, output, thinking, cache read, 5-minute cache write and 1-hour cache write tokens per day. Per project, it SHALL give a single total of tokens, not split by kind or over time, in the project table's export and in the project sheet.

#### Scenario: Daily token chart
- **WHEN** the user views a project
- **THEN** a chart shows each token kind per day

#### Scenario: Tokens per project
- **WHEN** the user exports the project table
- **THEN** each project's row holds one token total, and no split by kind

### Requirement: Show cache efficiency
The dashboard SHALL show the cache hit ratio (cache read tokens divided by all input tokens) and the share of cache writes that used the 1-hour lifetime, for the view in Tokens and cache. Per project, the project table SHALL show the cache hit ratio, and its export SHALL hold the cache hit ratio and the 1-hour write share.

#### Scenario: Cache ratio per project
- **WHEN** the user compares projects
- **THEN** each project shows its cache hit ratio, and the export holds its 1-hour write share

### Requirement: Show subagent cost share
The cost dashboard SHALL show what share of estimated cost came from subagents, for the view in Tokens and cache, and per project in the project table's export.

#### Scenario: Subagent heavy project
- **WHEN** 40% of a project's cost came from subagent requests
- **THEN** the project table's export holds a 0.4 subagent cost share for that project

### Requirement: Show cost per outcome
The cost dashboard SHALL show cost per commit per project in the project table, and cost per commit and cost per prompt per project in its export. It SHALL point out a project (or, inside one project, a session) whose cost per commit is more than twice the median and that holds at least 2% of the view's spend. Among findings of equal severity, the one with more money at stake SHALL lead.

#### Scenario: Cost-per-commit outlier
- **WHEN** one project with three or more commits costs four times the median project per commit
- **THEN** the cost dashboard names that project as an outlier and offers to compare projects

#### Scenario: Small outlier
- **WHEN** the project with the highest cost per commit holds 1% of the spend
- **THEN** the cost dashboard does not name it as an outlier

#### Scenario: Project with no commits
- **WHEN** a project has cost but no commits in the range
- **THEN** its cost per commit shows as not available, not as zero or infinity

### Requirement: Show a project's change in its sheet
When the view has a previous period, a project's sheet SHALL show its change against that period: the previous cost, this period's cost, the change with its sign, a mark when the project had no usage in the previous period, and a daily cost sparkline over both periods with the split between them marked. A cost that is unknown (only unpriced models) SHALL read as unknown, with no change. The all-time view SHALL show none of this.

#### Scenario: Project that grew
- **WHEN** the user opens project `foo` from the project table, and `foo` cost $4 in the previous 30 days and $10 in the last 30
- **THEN** the sheet shows $4, $10 and +$6, and a daily sparkline over both periods

#### Scenario: New project
- **WHEN** project `foo` had no usage in the previous period
- **THEN** the sheet marks `foo` as new

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the project sheet shows no change block

### Requirement: Project the month's cost
The usage payload SHALL carry `run_rate`: the cost of the calendar month up to yesterday, the mean daily cost of the last 7 complete days, the days left in the month counting today, and the projection (cost so far plus mean times days left). It SHALL also carry `by_source`: for each agent with a cost in either window, its own cost so far and projection over the same windows and days left. It SHALL follow the view's project, source and automated filters and SHALL NOT depend on its range.

#### Scenario: First of the month
- **WHEN** today is the 1st of a month
- **THEN** the cost so far is zero and the projection is the 7-day mean times the days of the month

#### Scenario: Range does not matter
- **WHEN** the user changes the time range and keeps the same filters
- **THEN** `run_rate` is unchanged

#### Scenario: Two agents
- **WHEN** Claude Code and Codex both have cost in the last 7 complete days
- **THEN** `by_source` lists both, and their costs so far and projections add up to the totals

### Requirement: Withhold the projection without enough history
`run_rate` SHALL be null without 7 complete days of history or without a priced request among them.

#### Scenario: Unpriced history
- **WHEN** every request in the last 7 complete days is on an unpriced model
- **THEN** `run_rate` is null and the page shows no gauge

#### Scenario: Short history
- **WHEN** fewer than 7 complete days of history exist
- **THEN** `run_rate` is null

### Requirement: Sort cost by project
The cost dashboard SHALL sort the project table by any column, by click or keyboard, marking the sorted column with `aria-sort`. The trend column SHALL sort by the cost of the view's last 7 days. The default SHALL be cost, highest first. A project with no value in the column SHALL come last in either direction. The sort SHALL reset when the view changes.

#### Scenario: Sort by a column
- **WHEN** the user selects the Cost / commit header twice
- **THEN** the table lists projects by cost per commit, highest then lowest first, projects without commits last both times

#### Scenario: Sort by change
- **WHEN** the user selects the change header
- **THEN** the table lists projects by change, the largest increase first

### Requirement: Export cost tables
The cost dashboard SHALL let the user download the project table and the most-expensive-sessions table as CSV, or copy either to the clipboard as tab-separated text. The project export SHALL hold the cost, tokens, cache hit, 1-hour write share, subagent cost share, commits, cost per commit, cost per prompt and change of each project. Each export SHALL hold every row of the table, in the order shown (for the project table, the order the projects have with the small projects shown, even when they are folded), with cost and share figures rounded to 4 decimals and n/a values as empty cells. The buttons SHALL NOT be shown when the table has no rows.

#### Scenario: Download the project table in its sorted order
- **WHEN** the user sorts the project table by cost per commit and selects "Download CSV"
- **THEN** the file lists the projects in that order, with a header row and CRLF line ends

#### Scenario: Download with small projects folded
- **WHEN** the table folds four small projects and the user selects "Download CSV"
- **THEN** the file lists every project, the small ones after the big ones

#### Scenario: Copy a table
- **WHEN** the user selects "Copy"
- **THEN** the clipboard receives the rows as tab-separated text, and the button reads "Copied" for about 2 seconds

#### Scenario: Copy fails
- **WHEN** the clipboard is unavailable or refuses the text
- **THEN** the button reads "Copy failed" and the status is announced

#### Scenario: No rows
- **WHEN** the sessions table has no rows
- **THEN** no export button is shown

### Requirement: Fold small projects
The project table SHALL fold the projects too small to compare, those outside the set the medians use (under 2% of the view's cost and under 10 prompts) and whose change is under 2% of the view's cost, into one "Small projects (N)" row after the big projects, whatever the sort. The row SHALL show their summed cost, share and change and a button, with `aria-expanded`, that shows or hides them. Shown, they SHALL follow the big projects in the current sort order.

#### Scenario: Scratch projects fold
- **WHEN** a view has three big projects and four small ones
- **THEN** the table shows the three big projects and a "Small projects (4)" row with their summed cost and change

#### Scenario: Show the small projects
- **WHEN** the user selects "Show 4 small projects"
- **THEN** the four projects appear below the big ones and the button reads "Hide small projects" with `aria-expanded` true

#### Scenario: A large drop stays visible
- **WHEN** a project with no usage in this period cost 10% of the view's cost in the previous one
- **THEN** it is listed among the big projects, not folded

### Requirement: Reset the fold with the view
The shown or hidden state of the small projects SHALL reset when the view changes. The project count beside the table's title SHALL stay the number of all projects.

#### Scenario: View changes
- **WHEN** the user shows the small projects and then changes the time range
- **THEN** the small projects are hidden again

#### Scenario: Drawer count
- **WHEN** the table folds four small projects
- **THEN** the count beside the table's title is the number of all projects, folded ones included

## REMOVED Requirements

### Requirement: Put the estimate next to the plan price
**Reason**: The plan multiple of the range's cost prorated to its days sat at the end of a muted line and changed with the range picker.
**Migration**: Replaced by "Show the monthly pace against the plan", whose multiple is the month's pace over the monthly price.

### Requirement: Keep the plan line factual
**Reason**: The plan line is gone.
**Migration**: "Show the monthly pace against the plan" keeps the same limits: no savings, nothing beyond the plan price, and no multiple without a known plan.

### Requirement: Show the projection in the heading
**Reason**: The projection moves out of the heading's prose.
**Migration**: "Show the monthly pace against the plan" shows it as the gauge's pace.
