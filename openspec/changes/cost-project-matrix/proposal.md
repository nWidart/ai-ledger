# Proposal

## Why

A design review of the Cost page found three problems:

- About two screens of preamble come before the main chart. The heading, its windows line, a muted summary line and a sparkline come first. The section index, the What changed panel and four insight cards follow. Only then does the daily chart start (at 996px at 1440×900 on the demo store). The page says "this period against the previous one" three times before the chart.
- The monthly pace and the plan multiple ("You pay about $200 a month… 4.2× your plan") sit at the end of the muted summary line. For a subscriber, this is the main reason to open Cost.
- The same per-project data shows three times: the What changed bars, the Where the spend went ledger and the Cost by project drawer.

## What Changes

- **Plan gauge.** A horizontal bullet bar beside the heading replaces the sparkline and the plan and pace sentences. It shows the month's cost so far and the pace projection against a `1× plan` tick, with a bold `N× plan` badge. Without a known plan, it shows the cost so far and the pace only. It uses the existing `run_rate` and `plans` data and adds no prices.
- **One project table.** "Project spend and change" replaces What changed, Where the spend went and the Cost by project drawer. Its columns are project, a daily trend sparkline, spend with a share bar, the change against the previous period as a centered diverging bar (new projects marked), cost per commit and cache hit. Every column sorts. Small projects fold into one row that expands. A row opens the project sheet. CSV and Copy export stay, with every figure the old drawer exported plus the change.
- **Chart first.** The daily cost chart starts within the first 900px at 1440×900.
- **Trim.** The heading keeps two figures: the cost and the change. The windows' day counts, the sessions, tokens and requests, and the method text move behind a "How measured" disclosure. The Biggest spender and Cache hit insight cards go: the table and the Tokens and cache drawer show the same figures. Chart hints are one line.
- **Payload.** `run_rate` gains `by_source`, the month's cost so far and projection per agent, so the gauge can count only the agents a known plan covers, as the plan line did. The per-project daily series the trend sparklines need is already in `daily_projects`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cost-dashboard`: the heading, the plan and pace figures (now a gauge), the per-project panels (now one table), the insights and the method text.

## Impact

- `metrics.py`: `run_rate()` adds `by_source`.
- `web/src/pages/cost/`: new `PlanGauge` and `ProjectTable`. `Changes.tsx`, `SpendLedger` and `ProjectCostDrawer` are deleted, and so are the Biggest spender and Cache hit insights. `Lede.tsx`, `CostPage.tsx`, `CostChart.tsx` (one-line hint), `cost.ts` and `cost.css` change. `Spark` stays for the project sheet.
- Fixtures in `web/src/__fixtures__/` are regenerated, and `src/ai_ledger/web/` is rebuilt.
- Docs: `README.md`, the docs site Cost page and pages that name the removed panels, the screenshot list in `tools/demo/record.mjs`, and `CHANGELOG.md` `[Unreleased]`.
- Out of scope: the tokens metric and token economics, other pages, `components/Drawer.tsx`, and how session links open.
