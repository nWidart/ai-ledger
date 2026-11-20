# Design

## Context

`CostPage.tsx` renders, in order: the `Lede` (heading, windows line, `.sub` summary with the pace and plan sentences) beside the filters and `Spark`; the `SectionIndex`; `Changes` (What changed); four insight cards; `CostChart`; a `.split` of `SpendLedger` and Models and effort; and three drawers (Tokens and cache, Cost by project, Most expensive sessions).

The payload already has what the new parts need:

- `run_rate` (month cost to yesterday, 7-day mean, days left, projection) follows the project, source and automated filters, not the range.
- `plans` lists the known plan for each provider in scope.
- `by_project`, `changes` and `daily_projects` give each project's spend, its change and its daily cost.

## Goals / Non-Goals

**Goals:**
- Put the daily chart within the first 900px at 1440×900.
- Show the monthly pace against the plan as a figure, not a sentence.
- Show each project once, with its spend, trend, change and efficiency.

**Non-Goals:**
- The tokens metric and token economics: a later change.
- New prices or plan data.
- Other pages, the drawer component, and session link behavior.

## Decisions

**The gauge measures the calendar month, not the range.** A plan is billed by the month, and `run_rate` already projects the month under the view's filters. The bar runs from $0. A solid segment shows the cost so far this month (to yesterday, as `run_rate.month_cost`). A lighter segment extends it to the pace projection. A tick marks the plan's monthly price. The badge is the pace divided by the monthly price. The old plan sentence divided the range's cost by the plan prorated to the range's days. That number changed with the range and did not match a bill. It is dropped.

*Alternative:* keep the prorated range multiple. That would put two different multiples on one page, or a gauge whose bar depends on the range picker. Rejected.

**Only covered agents count.** The old plan line counted only the agents with a known plan, from `daily_sources`. The gauge needs the same split for the month, so `run_rate.by_source` gives each agent's `month_cost` and `projected`. They use the same windows and days left as the total. When an agent without a plan also spent, the gauge's caption names the agents it counts. When no covered agent spent, the gauge shows the whole cost with no plan.

**No `run_rate`, no gauge.** Without 7 complete days of priced history there is no pace, and a month-to-date bar alone says little. The heading then carries the cost and change only.

**One table component, rows from three sources.** `projectMatrix()` in `cost.ts` joins `by_project`, `changes` and `daily_projects` into one row per project. A project used only in the previous period gets a row with $0 spend and its negative change, so the table still shows what dropped. Sorting reuses `sortRows` and `SortTh`. Folding keeps the existing rule: projects outside the median set fold when there are 3 or more beside at least 1 big project. One addition: a project whose change is at least 2% of the view's cost stays unfolded, so a large drop is not hidden. The Trend column sorts by the cost of the view's last 7 days.

**The Δ column needs a previous period.** For the all-time range the column and its sort are left out.

**A one-project view has no project table.** One row would repeat the heading. The view keeps the chart, the insights (which then speak about sessions), Models and effort and the drawers.

**Phones keep project, spend and change.** Trend, cost per commit and cache hit hide below 32.5em. Every figure stays in the export and the project sheet.

**Trimmed insights.** Biggest spender repeats the table's first row, and Cache hit repeats the Tokens and cache drawer. Cost per commit (with Compare projects) and Peak day stay, in a row under the table.

## Risks / Trade-offs

- [The 1h-write share, subagent cost share, tokens and cost per prompt per project leave the page] → They stay in the CSV and Copy export. The view's totals stay in Tokens and cache, and tokens and cache hit stay in the project sheet.
- [The prorated range multiple goes away] → The gauge's monthly multiple replaces it. The CHANGELOG says so.
- [Two places compute coverage, `daily_sources` before and `run_rate.by_source` now] → Only the gauge computes it now. `planText` is deleted.
