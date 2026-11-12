# Tasks

## 1. Payload

- [x] 1.1 `metrics.run_rate` returns the month's cost up to yesterday, the mean daily cost of the last 7 complete days, the days left counting today and the projection; None without 7 complete days of history or a priced day among them. The usage payload carries it as `run_rate`. Verify: `tests/test_metrics.py` (`RunRateTest`).
- [x] 1.2 Add `run_rate` to `web/src/api.ts` and regenerate the fixtures.

## 2. Chart

- [x] 2.1 Hatch today's bar over each segment's own color, add the "Today so far" legend key, and say "so far" in the tooltip, the peak label and the screen-reader text. Verify: `CostChart.test.tsx`.
- [x] 2.2 The 7-day average leaves today out; the hint says it covers complete days. Verify: `CostChart.test.tsx`.

## 3. Heading

- [x] 3.1 `Lede` adds "On pace for about $X this month" after the list-price sentence when the payload has a run rate. Verify: `CostPage.test.tsx`.

## 4. Checks

- [x] 4.1 `uv run ruff check`, the Python tests and `cd web && npm run check` pass; the build in `src/ai_ledger/web/` is committed.
- [x] 4.2 `CHANGELOG.md` `[Unreleased]` and `README.md` name the change.
