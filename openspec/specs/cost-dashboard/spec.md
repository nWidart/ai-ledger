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
- **WHEN** the user selects project `foo` in the spend ledger
- **THEN** a side sheet shows `foo`'s summary, the page keeps its current filter, and the sheet offers a button to filter the dashboard to `foo`

### Requirement: Lead with the period's cost and its change
The cost dashboard SHALL open with the estimated cost of the selected view, its change against the previous period of equal length, and a daily cost sparkline across both periods. For the all-time range it SHALL show the cost since the first recorded day, without a comparison.

#### Scenario: Thirty-day view
- **WHEN** the user views the last 30 days
- **THEN** the page heading shows the period's estimated cost and its change against the 30 days before, and names both windows with their count of days with a prompt

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
The cost dashboard SHALL show each project's change in estimated cost against the previous period, largest change first, and SHALL mark projects with no usage in the previous period as new. A project whose cost in either period is unknown (only unpriced models) SHALL show that cost as unknown and no change. A one-project view SHALL leave this panel out.

#### Scenario: New project
- **WHEN** project `foo` has cost in the current period and no usage in the previous one
- **THEN** `foo` shows its full cost as an increase and is marked new

### Requirement: Show token usage by kind
The dashboard SHALL show input, output, thinking, cache read, 5-minute cache write and 1-hour cache write tokens per project and over time.

#### Scenario: Daily token chart
- **WHEN** the user views a project
- **THEN** a chart shows each token kind per day

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate. When a model has no price, the dashboard SHALL name the user prices file by its full path as the place to add one. A price entry MAY carry fast-mode rates: a request in fast mode on such a model SHALL cost those rates at any prompt size, replacing the long-prompt tier, because fast pricing applies across the full context window. A fast-mode request on a model without fast rates SHALL cost its standard price.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model and the path of the user prices file

#### Scenario: Price added by the user
- **WHEN** the user adds the model to the user prices file and reloads the page
- **THEN** the model's requests are priced, with no rebuild

#### Scenario: Fast-mode request
- **WHEN** a request in fast mode used a model with fast rates, and an identical request used standard speed
- **THEN** the first costs the fast rates and the second the standard rates

#### Scenario: Fast mode on a model without fast rates
- **WHEN** a request in fast mode used a model with no fast rates
- **THEN** it costs the model's standard price and is not listed as unpriced

### Requirement: Show cache efficiency
The dashboard SHALL show the cache hit ratio (cache read tokens divided by all input tokens) and the share of cache writes that used the 1-hour lifetime.

#### Scenario: Cache ratio per project
- **WHEN** the user compares projects
- **THEN** each project shows its cache hit ratio and 1-hour write share

### Requirement: Show subagent cost share
The cost dashboard SHALL show what share of estimated cost came from subagents.

#### Scenario: Subagent heavy project
- **WHEN** 40% of a project's cost came from subagent requests
- **THEN** the cost dashboard shows a 40% subagent cost share for that project

### Requirement: Show cost per outcome
The cost dashboard SHALL show cost per commit and cost per prompt per project, and SHALL point out a project (or, inside one project, a session) whose cost per commit is more than twice the median and that holds at least 2% of the view's spend. The median project SHALL be taken over projects big enough to compare: those with at least 2% of the view's estimated cost or at least 10 prompts, and, for cost per commit, at least 3 commits. Among findings of equal severity, the one with more money at stake SHALL lead.

#### Scenario: Cost-per-commit outlier
- **WHEN** one project with three or more commits costs four times the median project per commit
- **THEN** the cost dashboard names that project as an outlier and offers to compare projects

#### Scenario: Small outlier
- **WHEN** the project with the highest cost per commit holds 1% of the spend
- **THEN** the cost dashboard does not name it as an outlier

#### Scenario: Project with no commits
- **WHEN** a project has cost but no commits in the range
- **THEN** its cost per commit shows as not available, not as zero or infinity

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
- **WHEN** the user opens project `foo` from What changed, and `foo` cost $4 in the previous 30 days and $10 in the last 30
- **THEN** the sheet shows $4, $10 and +$6, and a daily sparkline over both periods

#### Scenario: New project
- **WHEN** project `foo` had no usage in the previous period
- **THEN** the sheet marks `foo` as new

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the project sheet shows no change block

### Requirement: Put the estimate next to the plan price
The usage payload SHALL list the subscription plans that apply to the view: for each provider in scope, the plan on its newest limit snapshot that names one, when the plan prices (the packaged `plans` table with the user prices file's over it) know it, as provider, label and monthly USD price. With a source filter only that provider's plan SHALL be listed. The Cost heading SHALL then add one line giving the monthly price (summed over the listed plans, naming each) and the estimated cost as a multiple of that price prorated to the view's days (monthly price × days / 30; for all time, the days from the first recorded day to today). A multiple below 1 SHALL be shown as such. The line SHALL NOT state savings or what the user actually pays beyond the plan price. With no known plan, no usage or an unknown cost, the line SHALL NOT be shown.

#### Scenario: One plan, 30 days
- **WHEN** the newest Claude snapshot names Max 20x and a 30-day view estimates $840
- **THEN** the heading says "You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan."

#### Scenario: Source filter
- **WHEN** both providers have a known plan and the source is Codex
- **THEN** only Codex's plan is listed and used

#### Scenario: Unknown plan
- **WHEN** the newest snapshot names a plan the plan prices lack, or there is no snapshot
- **THEN** no plan is listed and no line is shown

### Requirement: Show estimated cost by token kind
The dashboard SHALL show, for the view, the estimated cost of each billed kind (input, output, cache read, 5-minute cache write, 1-hour cache write) with its share of the estimated cost, next to the kind's token count and token share, ordered by cost, biggest first. Each request's kind costs SHALL use the same prices and tier as the request's cost and add up to it. Thinking tokens are billed as output: the dashboard SHALL show Output and thinking as one kind with one cost. When no request is priced, the cost of each kind SHALL show as unknown, not as zero.

#### Scenario: Cache reads dominate tokens, not cost
- **WHEN** cache reads are 66% of tokens and 5% of the estimated cost
- **THEN** the drawer shows the cache read row with 5% of cost and 66% of tokens, below the kinds that cost more

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** each kind's cost shows as a dash

### Requirement: Validate fast-mode rates in the user prices file
An entry's `fast` object, when present, SHALL hold a number for each price kind; otherwise the whole file is ignored and reported as for any other bad entry.

#### Scenario: Incomplete fast rates
- **WHEN** an entry's `fast` object lacks `output`
- **THEN** the file is ignored and the Cost page says `fast.output must be a number` for that model

### Requirement: Show the projects inside Other
The cost chart SHALL stack the projects that own a color of their own and sum the rest into Other. The day's cost tooltip SHALL list the three costliest projects inside Other on that day, with their cost, and SHALL add "+ N more" when there are more than three. The day's screen-reader text SHALL carry the same projects. A project with no name SHALL read as "(no project)".

#### Scenario: More than three projects in Other
- **WHEN** a day's Other holds projects B ($5), C ($3), D ($1) and E ($0.5), and the user hovers the day
- **THEN** the tooltip lists B, C and D under Other with their costs, then "+ 1 more"

#### Scenario: One project in Other
- **WHEN** a day's Other holds only project F ($2)
- **THEN** the tooltip lists F under Other

#### Scenario: Token view
- **WHEN** the user shows tokens per day
- **THEN** the tooltip lists the token kinds only, as before

### Requirement: Sort cost by project
The cost dashboard SHALL sort the cost-by-project table by any column, by click or keyboard, marking the sorted column with `aria-sort`. The default SHALL be cost, highest first. A project with no value in the column SHALL come last in either direction. Comparing projects from the cost-per-commit finding SHALL sort by cost per commit, highest first, ring the outlier and say how far it sits from the median, and a control in that note SHALL return to the default sort. The sort SHALL reset when the view changes.

#### Scenario: Sort by a column
- **WHEN** the user selects the Cost / commit header twice
- **THEN** the table lists projects by cost per commit, highest then lowest first, projects without commits last both times

#### Scenario: Compare projects
- **WHEN** the user compares projects from an outlier finding
- **THEN** the table is sorted by cost per commit, highest first, with the outlier ringed and focused

### Requirement: Mark today as a partial day
The cost and tokens charts SHALL draw the bar for today (the last day of the view) hatched over each segment's own color, and SHALL show a "Today so far" key in the legend. The day's tooltip, the peak label when today is the peak, and the day's screen-reader text SHALL say "so far". The 7-day average at a day SHALL be the mean of the 7 complete days ending at that day; today SHALL have no average point, and the chart's hint SHALL say the average covers complete days.

#### Scenario: Hovering today
- **WHEN** the user hovers today's bar
- **THEN** the tooltip reads "so far" and shows no 7-day average

#### Scenario: Average at yesterday
- **WHEN** today costs far more than the days before it
- **THEN** the average at yesterday does not include today, and the line ends at yesterday

### Requirement: Project the month's cost
The usage payload SHALL carry `run_rate`: the cost of the calendar month up to yesterday, the mean daily cost of the last 7 complete days, the days left in the month counting today, and the projection (cost so far plus mean times days left). It SHALL follow the view's project, source and automated filters and SHALL NOT depend on its range. It SHALL be null without 7 complete days of history or without a priced request among them. The heading's second line SHALL read "On pace for about $X this month" after the list-price sentence when `run_rate` is present, and SHALL not show it otherwise.

#### Scenario: First of the month
- **WHEN** today is the 1st of a month
- **THEN** the cost so far is zero and the projection is the 7-day mean times the days of the month

#### Scenario: Unpriced history
- **WHEN** every request in the last 7 complete days is on an unpriced model
- **THEN** `run_rate` is null and the heading shows no projection
