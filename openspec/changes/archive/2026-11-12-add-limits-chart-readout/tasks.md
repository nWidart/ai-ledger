# Tasks

## 1. Tests

- [x] 1.1 `limits.test.ts`: `readPoints` (past then forecast after now, no duplicate at now, no forecast, no series, nothing at all), `nearestPoint` (nearest, clamped at both ends, none), `readText` (measured, estimated, forecast with a range, forecast without one).
- [x] 1.2 `LimitChart.test.tsx`: the pointer shows the nearest point, clamps at both ends and clears on leave; focus reads now, the arrows, Home, End, Escape and blur work; only the keyboard is announced; a chart with nothing to read has no tab stop.

## 2. Page

- [x] 2.1 `limits.ts`: export `readPoints`, `nearestPoint` and `readText`.
- [x] 2.2 `LimitChart.tsx`: a focusable labelled group around the image, the guide, the marker, the shared `.tip` tooltip placed by `tipAt`, and a polite live region.
- [x] 2.3 `limits.css`: style the guide, the marker, the focus ring and `touch-action`. `LimitsPage.tsx`: add the key hint.

## 3. Docs and verify

- [x] 3.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build; archive the change.
