# Tasks

## 1. Tests

- [x] 1.1 `LimitsPage.test.tsx`: `capText` for a weekly window, a 5-hour window, an unknown window length, a singular "1 window" and a null calibration; a calibrated card shows the line; an uncalibrated card has no `.cap-money` element.

## 2. Page

- [x] 2.1 `limits.ts`: export `capText(w: LimitWindow): string | null`, using `usd` and `plural` from `format.ts`.
- [x] 2.2 `LimitsPage.tsx`: render `<p className="cap-money">` after the pace line, only when `capText` is not null.
- [x] 2.3 `limits.css`: style `.cap-money` as secondary card text, like `.pace`.

## 3. Docs and verify

- [x] 3.1 Update `CHANGELOG.md` under `[Unreleased]`. `README.md` stays as it is.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build; archive the change.
