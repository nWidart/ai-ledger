# Tasks

## 1. Payload

- [x] 1.1 Group runs once and reuse the groups for `coverage.runs` and the new `coverage.run_sizes`.
- [x] 1.2 Add `trend`: weekly counts of the view's facets by session start, with the achieved count.
- [x] 1.3 Test run sizes (one run, several, none, filters) and trend (week boundary, view filter, cap, no start time, Codex).

## 2. Page

- [x] 2.1 Add the "How this works" drawer and its section-index entry.
- [x] 2.2 Add the "Outcome trend" panel under the Outcomes and Friction row and its section-index entry.
- [x] 2.3 Update types in `web/src/api.ts`; add page tests; regenerate fixtures.

## 3. Verify

- [x] 3.1 Update README and CHANGELOG; run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build.
