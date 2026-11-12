# Tasks

## 1. Tests

- [x] 1.1 `tests/test_limits.py`: `history_row` identity fields; `window_curve` for a measured window (series from its start to its close, equal to what the open card drew for the same points), an estimated earlier window, a window ended early by a plan change (with its event) and one that hit its limit; none for an unknown start, the open window and another limit; ValueError for bad input; every window `payload()` lists at 7, 14 and 30 days can be asked for; the history rows carry no curve; the HTTP route's 200, 404 and 400 answers.
- [x] 1.2 `limits.test.ts`: bar names, keys, the strips' grouping, order and 60-bar cap, `closedWindow`. `LimitChart.test.tsx`: a closed window. `LimitsPage.test.tsx`: the strips, the key, the cap and its note, keyboard movement, picking (loading, then the chart), picking again, Close and focus, the error with Retry, the panel closing when the window leaves the history.

## 2. Backend

- [x] 2.1 `limits.py`: identity on `history_row`; `limit_windows` shared by `payload()` and `window_curve`; `window_curve`. `app.py`: `GET /api/limits/window`.
- [x] 2.2 `tests/test_web_fixtures.py`: the route's answer for the fixture's early-ended window as a fixture; regenerate the fixtures.

## 3. Page

- [x] 3.1 `api.ts` (`LimitHistoryRow` identity, `LimitWindowCurve`, `limitWindowUrl`), `limits.ts` (`barName`, `historyStrips`, `closedWindow`, `windowNotes`), `LimitChart.tsx` (`now: null`), `LimitsPage.tsx` (`HistoryStrip`, `WindowPanel`), `limits.css`.

## 4. Docs and verify

- [x] 4.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`; commit the build; archive the change.
