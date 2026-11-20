# Tasks

## 1. Shared rule

- [x] 1.1 Add `LOW_CALLS` and `lowVolume(calls)` to `web/src/components/chart.ts`; use them in `errors/RateChart.tsx` and remove the constant from `errors/model.ts`. Verify that the Errors page tests pass unchanged.

## 2. Work chart

- [x] 2.1 In `WorkChart.tsx`, leave low bars out of the rate axis maximum, clamp a rate to the axis top, draw a hollow dot for each, and add the "Under 50 calls" legend key (`chart.css`). Verify with `WorkChart.test.tsx` tests for the scale, the dot, the line and the key.
- [x] 2.2 Say "too few calls for a steady rate" in the tooltip, the screen-reader text and the data table for a low bar. Verify with a `WorkChart.test.tsx` test, including that a view where every bar is quiet marks none.

## 3. Release

- [x] 3.1 Add a Fixed entry to `CHANGELOG.md`; rebuild `src/ai_ledger/web/`; run `openspec validate --specs --strict` and `openspec validate fix-workchart-low-calls --strict`.
