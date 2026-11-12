# Tasks

## 1. Filters

- [x] 1.1 `drill.ts`: the four kinds keyed by raw name (URL key, label, match), the active filters of a hash, a hook that toggles one in the URL (`push: true`). Tests in `InsightsPage.test.tsx` first.
- [x] 1.2 `LedgerRow` takes `active` (marks the row, `aria-pressed` on its button).

## 2. Page

- [x] 2.1 Outcomes, helpfulness, Friction and Goals rows filter the list and jump to it; the active row clears it; zero rows are not buttons.
- [x] 2.2 Card chips and the outcome badge are buttons that filter.
- [x] 2.3 Active filter chips with remove buttons and "Clear filters"; the outcome select in sync; the empty state and the count for all filters; the truncation note.
- [x] 2.4 The sort state lives in `InsightsPage`; a test for the source round trip.
- [x] 2.5 `insights.css`: row, chip and badge buttons, the filter chips.

## 3. Docs and verify

- [x] 3.1 Update `README.md` and `CHANGELOG.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
