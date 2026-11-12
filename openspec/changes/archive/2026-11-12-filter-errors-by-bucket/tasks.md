# Tasks

## 1. View and model

- [x] 1.1 Add `View.at` and the `at` hash key (`readView`, `viewPatch`, `viewHash`; not `savedOf`). A permalink leaves it out.
- [x] 1.2 Add `inBucket` and `bucketLabel`; narrow `typeRows` and `emptyTypes`; clear a stale bucket in `settle` and apply the type rule to the bucket's errors. A granularity change clears it in `update`.

## 2. Page

- [x] 2.1 Select and clear a bucket from the chart by click and by Enter or Space; mark it on the chart and in its label and reading.
- [x] 2.2 Add the chip, the hint and the detail's narrowing (counts, list, outside note, Clear filters).

## 3. Verify

- [x] 3.1 Add model, view and page tests for each rule. Update README, CHANGELOG and PARITY. Run `uv run ruff check && uv run python -m unittest discover -s tests && (cd web && npm run check) && openspec validate --all --strict`.
