# Tasks

## 1. Payload

- [x] 1.1 The requests view carries the session's source; `usage()` returns `daily_models` and `daily_sources`, each summing per day to the day's cost in `daily`. Verify: `tests/test_metrics.py` (the model and source rows, a Codex session under codex).
- [x] 1.2 Add the rows to `web/src/api.ts` and regenerate the page-test fixtures (`uv run python -m unittest tests.test_web_fixtures`).

## 2. Stacking

- [x] 2.1 `costKinds` and `costDays` take the stacking; Other and its breakdown work for projects and models. Verify: `web/src/pages/cost/cost.test.ts`, `CostChart.test.tsx`.
- [x] 2.2 The "Stack by" switch in the Cost metric, kept in `localStorage` next to the metric. Verify: `CostPage.test.tsx` (survives a remount), `CostChart.test.tsx` (absent in Tokens).
- [x] 2.3 Legend: agent keys set the source filter and offer the way back; model keys are plain. Verify: `CostChart.test.tsx`.
- [x] 2.4 The heading, hint, chart label and screen-reader text name the stacking.
- [x] 2.5 Today's hatch and the 7-day average hold in Model stacking. Verify: `CostChart.test.tsx`.

## 3. Checks

- [x] 3.1 `uv run ruff check`, the Python tests and `cd web && npm run check` pass; the build in `src/ai_ledger/web/` is committed.
- [x] 3.2 `CHANGELOG.md` `[Unreleased]` and `README.md` name the change.
