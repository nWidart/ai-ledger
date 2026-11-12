# Tasks

## 1. Tests

- [x] 1.1 `tests/test_limits.py`: a hot last day reaches 100% before the usual forecast; a quiet last day is a flat line at the current percent; a missing last day gives none; the usual forecast is the same with and without the scenario; a scoped window counts only its model.
- [x] 1.2 `limits.test.ts`: `recentText`, and `readText` and `readPoints` with and without a scenario value. `LimitChart.test.tsx`: the second path and the readout. `LimitsPage.test.tsx`: the card line and the key entry only with a scenario.

## 2. Backend

- [x] 2.1 `limits.py` `forecast()`: step the scenario with the usual curves; add `recent` to each point and `recent_pace`, `recent_hits_at`, `recent_at_reset` to the forecast. Regenerate the page-test fixtures.

## 3. Page

- [x] 3.1 `api.ts`, `limits.ts` (`recentText`, `readPoints`, `readText`), `LimitChart.tsx` (the second path), `LimitsPage.tsx` (the card line, the key entry, the hint), `limits.css`.

## 4. Docs and verify

- [x] 4.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`; commit the build; archive the change.
