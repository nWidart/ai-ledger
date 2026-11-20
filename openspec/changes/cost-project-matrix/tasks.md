# Tasks

## 1. Payload: run rate per agent

- [x] 1.1 In `metrics.run_rate()`, add `by_source`: per agent, `month_cost` and `projected` over the same windows and days left. Verify with a `test_metrics.py` test where two agents' figures add up to the totals, and the existing run-rate tests still pass.
- [x] 1.2 Add `by_source` to the `run_rate` type in `web/src/api.ts`, and regenerate the fixtures with `uv run python -m unittest tests.test_web_fixtures`.

## 2. Figures: gauge and table math

- [x] 2.1 In `cost.ts`, add `gaugeFigures()`: cost so far, pace, plan price and labels, the agents counted, and the multiple, or null without `run_rate`. Delete `planText`. Verify with `cost.test.ts` cases for one plan, no plan, an agent without a plan, a multiple below 1 and no `run_rate`.
- [x] 2.2 In `cost.ts`, add `projectMatrix()` (rows from `by_project`, `changes` and `daily_projects`), `sortMatrix()` and `foldMatrix()`. Verify with `cost.test.ts` cases for each sort key with no value last, a project used only before, the fold rule, a large drop staying unfolded, and a selected small project forcing the fold open.

## 3. Page

- [x] 3.1 Add `PlanGauge.tsx` beside the heading in place of `Spark`. Verify with `CostPage.test.tsx` that its figures read as text.
- [x] 3.2 Trim `Lede.tsx` to the cost and change, a windows line with the thin-history chip, and a "How measured" disclosure.
- [x] 3.3 Add `ProjectTable.tsx` (sortable, folded, exported, rows open the project sheet, Compare projects rings the outlier). Delete `Changes.tsx`, `SpendLedger` and `ProjectCostDrawer`. Verify with the moved and new `CostPage.test.tsx` cases.
- [x] 3.4 Delete the Biggest spender and Cache hit insights and the phone metric pair. Order the page: heading, chart, project table, insights beside Models and effort, drawers. Make the chart hints one line.
- [x] 3.5 Style for both themes, forced colors and phone width in `cost.css`.
- [x] 3.6 Run `cd web && npm run check` and commit the rebuilt `src/ai_ledger/web/`.

## 4. Docs

- [x] 4.1 Update `README.md` where it describes Cost.
- [x] 4.2 Update the docs site Cost page and the pages that name the removed panels, with the `doc-coauthoring` skill. Update the Cost screenshot panels in `tools/demo/record.mjs`. Verify with `cd site && npm run check`.
- [x] 4.3 Add an `[Unreleased]` entry to `CHANGELOG.md`.

## 5. Verify

- [x] 5.1 `openspec validate --specs --strict`, `openspec validate cost-project-matrix --strict`, `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`.
- [x] 5.2 Before and after screenshots from the demo store at 1440×900, light and dark, and at phone width. Verify the chart starts within 900px.
