# cost-dashboard Specification

## Purpose

Shows what Claude Code usage cost at API list prices, where that cost went, and why it changed against the previous period, so expensive projects, sessions and habits stand out.

## Requirements

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

### Requirement: Explain a day's cost
Selecting a day on the cost chart, or the peak day's action, SHALL list every session active that day with its estimated cost on that day, costliest first, so the listed costs add up to the day's bar.

#### Scenario: Session across two days
- **WHEN** a session cost $10 on Nov 4 and $30 on Nov 5, and the user selects Nov 4
- **THEN** the session is listed at $10, and the list's costs sum to Nov 4's total

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

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate. When a model has no price, the dashboard SHALL name the user prices file by its full path as the place to add one.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model and the path of the user prices file

#### Scenario: Price added by the user
- **WHEN** the user adds the model to the user prices file and reloads the page
- **THEN** the model's requests are priced, with no rebuild

### Requirement: Price fast-mode requests
A price entry MAY carry fast-mode rates: a request in fast mode on such a model SHALL cost those rates at any prompt size, replacing the long-prompt tier, because fast pricing applies across the full context window. A fast-mode request on a model without fast rates SHALL cost its standard price.

#### Scenario: Fast-mode request
- **WHEN** a request in fast mode used a model with fast rates, and an identical request used standard speed
- **THEN** the first costs the fast rates and the second the standard rates

#### Scenario: Fast-mode request on a long prompt
- **WHEN** a request in fast mode on a model with fast rates has a prompt past the long-prompt threshold
- **THEN** it costs the fast rates, not the long-prompt tier

#### Scenario: Fast mode on a model without fast rates
- **WHEN** a request in fast mode used a model with no fast rates
- **THEN** it costs the model's standard price and is not listed as unpriced

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

### Requirement: Take the median over comparable projects
The median project SHALL be taken over projects big enough to compare: those with at least 2% of the view's estimated cost or at least 10 prompts, and, for cost per commit, at least 3 commits.

#### Scenario: Scratch projects
- **WHEN** many one-prompt projects with near-zero cost sit beside three real projects
- **THEN** the real projects are compared with the median of the real projects, the scratch projects show their values untinted, and the table says which projects the median covers

#### Scenario: Too few projects to compare
- **WHEN** fewer than three projects are big enough to compare
- **THEN** the table tints no cell

### Requirement: Show model mix
The cost dashboard SHALL show each model and effort level's share of estimated cost, costliest first, with its cost, the top 8 until the user asks for all. Fast-mode requests SHALL form their own rows, marked "fast". A share that is above zero but rounds to 0% SHALL read "<1%".

#### Scenario: Two models
- **WHEN** 70% of the estimated cost in the view came from one model and 30% from another
- **THEN** the cost dashboard lists the first model above the second, with both shares and each model's estimated cost

#### Scenario: Fast mode in the mix
- **WHEN** a model had requests in fast mode and in standard mode at the same effort
- **THEN** the cost dashboard lists two rows for it, one marked "fast", each with its own share and cost

### Requirement: Link to a cost view
The cost dashboard SHALL keep the selected project, time range, inspected project and open session in the page URL, so a view can be reopened or shared, and browser Back SHALL retrace filter and sheet changes.

#### Scenario: Open a copied URL
- **WHEN** the user opens a copied cost dashboard URL
- **THEN** the same project, range and session are selected

### Requirement: Report a bad user prices file
When the user prices file cannot be read, is not valid JSON, has neither a `models` nor a `plans` object, has a model entry without a number for each price, or has a plan entry without a text `label` and a numeric `monthly`, the app SHALL ignore the whole file, price with the packaged tables alone, and the Cost page SHALL show the file's path and the reason.

#### Scenario: Malformed file
- **WHEN** the user prices file holds invalid JSON
- **THEN** every page still loads with the packaged prices, and the Cost page says the file was ignored and why

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

### Requirement: List the plans that apply to the view
The usage payload SHALL list the subscription plans that apply to the view: for each provider in scope, the plan on its newest limit snapshot that names one, when the plan prices (the packaged `plans` table with the user prices file's over it) know it, as provider, label and monthly USD price. With a source filter only that provider's plan SHALL be listed.

#### Scenario: Source filter
- **WHEN** both providers have a known plan and the source is Codex
- **THEN** only Codex's plan is listed and used

#### Scenario: Unknown plan
- **WHEN** the newest snapshot names a plan the plan prices lack, or there is no snapshot
- **THEN** no plan is listed

### Requirement: Show estimated cost by token kind
The dashboard SHALL show, for the view, the estimated cost of each billed kind (input, output, cache read, 5-minute cache write, 1-hour cache write) with its share of the estimated cost, next to the kind's token count and token share, ordered by cost, biggest first. When no request is priced, the cost of each kind SHALL show as unknown, not as zero.

#### Scenario: Cache reads dominate tokens, not cost
- **WHEN** cache reads are 66% of tokens and 5% of the estimated cost
- **THEN** the drawer shows the cache read row with 5% of cost and 66% of tokens, below the kinds that cost more

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** each kind's cost shows as a dash, unknown and not zero

### Requirement: Price token kinds like the request
Each request's kind costs SHALL use the same prices and tier as the request's cost and add up to it. Thinking tokens are billed as output: the dashboard SHALL show Output and thinking as one kind with one cost.

#### Scenario: Kind costs add up
- **WHEN** the view has priced requests
- **THEN** the kind costs sum to the view's estimated cost

#### Scenario: Thinking tokens
- **WHEN** a request used output and thinking tokens
- **THEN** the dashboard shows one Output and thinking row whose cost covers both

### Requirement: Validate fast-mode rates in the user prices file
An entry's `fast` object, when present, SHALL hold a number for each price kind; otherwise the whole file is ignored and reported as for any other bad entry.

#### Scenario: Incomplete fast rates
- **WHEN** an entry's `fast` object lacks `output`
- **THEN** the file is ignored and the Cost page says `fast.output must be a number` for that model

### Requirement: Show the projects inside Other
The cost chart SHALL stack the projects, or the models, that own a color of their own and sum the rest into Other. The day's cost tooltip SHALL list the three costliest names inside Other on that day, with their cost, and SHALL add "+ N more" when there are more than three. The day's screen-reader text SHALL carry the same names. A project with no name SHALL read as "(no project)".

#### Scenario: More than three projects in Other
- **WHEN** a day's Other holds projects B ($5), C ($3), D ($1) and E ($0.5), and the user hovers the day
- **THEN** the tooltip lists B, C and D under Other with their costs, then "+ 1 more"

#### Scenario: More than three models in Other
- **WHEN** the chart stacks by model and a day's Other holds models m7 ($4), m8 ($3), m9 ($2) and m10 ($1)
- **THEN** the tooltip lists m7, m8 and m9 under Other with their costs, then "+ 1 more"

#### Scenario: One project in Other
- **WHEN** a day's Other holds only project F ($2)
- **THEN** the tooltip lists F under Other

#### Scenario: Token view
- **WHEN** the user shows tokens per day
- **THEN** the tooltip lists the token kinds only, as before

### Requirement: Sort cost by project
The cost dashboard SHALL sort the project table by any column, by click or keyboard, marking the sorted column with `aria-sort`. The trend column SHALL sort by the cost of the view's last 7 days. The default SHALL be cost, highest first. A project with no value in the column SHALL come last in either direction. The sort SHALL reset when the view changes.

#### Scenario: Sort by a column
- **WHEN** the user selects the Cost / commit header twice
- **THEN** the table lists projects by cost per commit, highest then lowest first, projects without commits last both times

#### Scenario: Sort by change
- **WHEN** the user selects the change header
- **THEN** the table lists projects by change, the largest increase first

### Requirement: Compare projects from the cost-per-commit finding
Comparing projects from the cost-per-commit finding SHALL sort by cost per commit, highest first, ring the outlier and say how far it sits from the median, and a control in that note SHALL return to the default sort.

#### Scenario: Compare projects
- **WHEN** the user compares projects from an outlier finding
- **THEN** the table is sorted by cost per commit, highest first, with the outlier ringed and focused, and the note says how far it sits from the median

#### Scenario: Return to the default sort
- **WHEN** the user selects the control in the comparison note
- **THEN** the table returns to the default sort

### Requirement: Mark today as a partial day
The cost and tokens charts SHALL draw the bar for today (the last day of the view) hatched over each segment's own color, and SHALL show a "Today so far" key in the legend. The day's tooltip, the peak label when today is the peak, and the day's screen-reader text SHALL say "so far". The 7-day average at a day SHALL be the mean of the 7 complete days ending at that day; today SHALL have no average point, and the chart's hint SHALL say the average covers complete days.

#### Scenario: Hovering today
- **WHEN** the user hovers today's bar
- **THEN** the tooltip reads "so far" and shows no 7-day average

#### Scenario: Average at yesterday
- **WHEN** today costs far more than the days before it
- **THEN** the average at yesterday does not include today, and the line ends at yesterday

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

### Requirement: Export cost tables
The cost dashboard SHALL let the user download the project table and the most-expensive-sessions table as CSV, or copy either to the clipboard as tab-separated text. Each export SHALL hold every row of the table, in the order shown (for the project table, the order the projects have with the small projects shown, even when they are folded), with cost and share figures rounded to 4 decimals and n/a values as empty cells. The buttons SHALL NOT be shown when the table has no rows.

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

### Requirement: Export every project figure
The project export SHALL hold the cost, tokens, cache hit, 1-hour write share, subagent cost share, commits, cost per commit, cost per prompt and change of each project, including the figures the table does not show.

#### Scenario: Figures off the table
- **WHEN** the user downloads the project table
- **THEN** each row holds the project's tokens, 1-hour write share, subagent cost share and cost per prompt beside the figures the table shows

### Requirement: Name and guard exported files
The CSV file name SHALL be `ai-ledger-cost-projects-<date>.csv` or `ai-ledger-cost-sessions-<date>.csv`, dated today, or with the selected day's date when a day is selected in the sessions table. Text cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return SHALL be prefixed with an apostrophe; numbers SHALL NOT.

#### Scenario: Formula text
- **WHEN** a project name starts with `=`
- **THEN** its exported cell starts with an apostrophe, and a negative number is exported without one

#### Scenario: Leading tab
- **WHEN** a project name starts with a tab followed by `=1+1`
- **THEN** its exported cell starts with an apostrophe

#### Scenario: Session file on a selected day
- **WHEN** the user selects a day in the sessions table and downloads it
- **THEN** the file name carries that day's date

### Requirement: Stack the cost chart by project, model or agent
In the cost metric the chart SHALL offer a "Stack by" switch with Project, Model and Agent, Project by default. The choice SHALL be kept in the browser. The switch SHALL NOT show in the tokens metric. A day's total SHALL be the same in every stacking. A one-project view SHALL offer all three stackings.

#### Scenario: Switch to Model
- **WHEN** the user selects Model
- **THEN** the bars and the legend restack by model, and the tooltip total for each day is unchanged

#### Scenario: Stacking is remembered
- **WHEN** the user selects Agent and reopens the page
- **THEN** the chart stacks by agent

#### Scenario: Tokens metric
- **WHEN** the user shows tokens per day
- **THEN** the "Stack by" switch is not shown

#### Scenario: One-project view
- **WHEN** the view is filtered to one project
- **THEN** the switch offers Project, Model and Agent

### Requirement: Group the series under Model and Agent
Under Model the chart SHALL give a series color to each of the models with the most cost in the view, up to the number of series colors, and sum the rest into Other, labelled without the `claude-` prefix. Under Agent the chart SHALL show one series per agent and no Other. The heading, the hint, the chart's label and the day's screen-reader text SHALL name the stacking.

#### Scenario: Models beyond the series colors
- **WHEN** the chart stacks by model and the view has more models than series colors
- **THEN** the costliest models get a color each, the rest sum into Other, and model names show without the `claude-` prefix

#### Scenario: Agents
- **WHEN** the chart stacks by agent
- **THEN** it shows one series per agent and no Other

#### Scenario: Stacking named
- **WHEN** the chart stacks by model
- **THEN** the heading, the hint, the chart's label and the day's screen-reader text name the model stacking

#### Scenario: Agent key
- **WHEN** the chart stacks by agent and the user selects the Codex key
- **THEN** the page filters to Codex, and the same key then clears the filter

#### Scenario: Model key
- **WHEN** the chart stacks by model
- **THEN** a model key does not filter the page

#### Scenario: Today under Model
- **WHEN** the chart stacks by model
- **THEN** today's bar is hatched and the 7-day average leaves today out

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

### Requirement: Fold only when it hides enough
The cost-by-project table SHALL fold only with at least 3 small projects and at least 1 big project.

#### Scenario: Too few to fold
- **WHEN** a view has fewer than 3 small projects
- **THEN** the table lists every project with no bucket row

#### Scenario: No big project
- **WHEN** every project in the view is small
- **THEN** the table lists every project with no bucket row

### Requirement: Keep the selected project visible when folding
The selected project and the project ringed by "Compare projects" SHALL NOT be hidden: when one is small, the small projects SHALL show.

#### Scenario: A small project is selected
- **WHEN** the project filter names a small project
- **THEN** the small projects show, with that project among them

#### Scenario: A small project is ringed
- **WHEN** the user compares projects and the outlier is a small project
- **THEN** the small projects show, with the outlier among them

### Requirement: Reset the fold with the view
The shown or hidden state of the small projects SHALL reset when the view changes. The project count beside the table's title SHALL stay the number of all projects.

#### Scenario: View changes
- **WHEN** the user shows the small projects and then changes the time range
- **THEN** the small projects are hidden again

#### Scenario: Drawer count
- **WHEN** the table folds four small projects
- **THEN** the count beside the table's title is the number of all projects, folded ones included

### Requirement: Offer the cost chart as a table
Under the cost and tokens chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a table of the chart's figures: one row per day, and one column for the day, one for each series in the current stacking (Project, Model or Agent, with Other) and one for the day's total, in the chart's units, with the table named for the chart. The table SHALL follow the stacking and the metric, SHALL be closed on every page load, and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the cost chart stacked by Model
- **THEN** a table lists each day with the cost of each model and the day's total, and the button reads "Hide data table"

#### Scenario: Follows the stacking
- **WHEN** the table is open and the user selects Agent
- **THEN** its columns become the agents, and each day's total is unchanged

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Give the unpriced chip text
The "+?" chip that marks a cost figure as leaving out unpriced requests SHALL carry text for screen readers that says how many requests came from unpriced models ("plus an unknown cost for 12 requests from unpriced models"), and SHALL show that count as its hover text.

#### Scenario: Screen reader
- **WHEN** a screen reader reads a project's cost that has 12 requests from unpriced models
- **THEN** it reads the cost, then that the cost leaves out 12 requests from unpriced models

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
