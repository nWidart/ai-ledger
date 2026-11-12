# Tasks

## 1. Tests

- [x] 1.1 `tests/test_limits.py`: `used` sums only use inside the window and the provider's source, only the scope's models for a scoped window; top three by cost, ties by name; shares of at most 1; points only when calibrated; null when nothing was counted; a request with no project; the filters do not apply.
- [x] 1.2 `limits.test.ts`: range preset boundaries at 7, 14, 30 and 90 days and beyond, the Cost URL, the summary hint. `LimitsPage.test.tsx`: the closed drawer with its hint, the lists, the links, no drawer when `used` is null, no points when null.

## 2. Backend

- [x] 2.1 `limits.py` `window_used()`, added to each open window in `payload()`. Regenerate the page-test fixtures.

## 3. Page

- [x] 3.1 `api.ts`, `limits.ts` (`usedRange`, `usedRangeName`, `usedHref`, `usedHint`), `LimitsPage.tsx` (`Used`), `limits.css`.

## 4. Docs and verify

- [x] 4.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`; commit the build; archive the change.
