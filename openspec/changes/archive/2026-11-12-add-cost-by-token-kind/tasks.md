# Tasks

## 1. Server

- [x] 1.1 Price each kind in `requests_cte` from one long-prompt tier flag, and make `cost` their sum. Sum the kinds into `usage()` totals as `cost_input`, `cost_output`, `cost_cache_read`, `cost_cache_5m`, `cost_cache_1h`. Verify with `test_cost_by_kind`: the kinds add up to `totals.cost` on the base and long tier, and an unpriced request contributes nothing.

## 2. Page

- [x] 2.1 Add the fields to `Totals` in `api.ts` and regenerate the fixtures.
- [x] 2.2 Rework `TokensDrawer` to list the billed kinds by cost, with cost share and token share. Verify with `CostPage.test.tsx`: order, shares, one combined Output and thinking row, and a dash for an unknown cost.

## 3. Docs and check

- [x] 3.1 Add a `CHANGELOG.md` line; rebuild `src/ai_ledger/web/`; run `uv run ruff check`, the Python tests and `cd web && npm run check`.
