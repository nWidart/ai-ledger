# Tasks

## 1. Keyboard

- [x] 1.1 Add `modified()` in `web/src/components/keys.ts` and call it first in the key handlers of the work, cost, rate, cache, growth and start-trend charts, the session map, the session timeline (Shift kept for its step), and Activity's and Context's tab lists. Switch LimitChart, OutcomeTrend, Pulse and the Limits history strip to it. Verify with `keys.test.ts` and the "leave(s) keys with Alt, Ctrl, Meta or Shift to the browser" tests in `ActivityPage`, `ContextPage`, `CostChart`, `ErrorsPage`, `GrowthChart`, `StartTrend` and `sheets` tests, built on `prevented()` in `testing.tsx`.
- [x] 1.2 Make Activity's selected tab panel `tabIndex={0}`, as Context's. Verify with `ActivityPage.test.tsx` ("follow the WAI-ARIA keys": Tab reaches the panel).

## 2. Screen readers

- [x] 2.1 Give each wall tile a description with all it shows, keeping the name "Pin <session>" and `aria-pressed`. Verify with `LivePage.test.tsx` ("names a tile by its pin action …").
- [x] 2.2 Fall back to `#lede` when a sheet's opener is gone. Verify with `LivePage.test.tsx` ("returns focus to the page heading …").
- [x] 2.3 Show "N new events" beside Jump to latest in a polite status, at once and then at most once every 5 s, empty with Follow on. Verify with `LivePage.test.tsx` ("is a silent log, and shows the events …").

## 3. Forced colors

- [x] 3.1 Fix the rules for Live's pressed Errors figure, Activity's selected tab and Limits' Last 24 h pace toggle; drop the dead `rect[class^="seg-"]` and `.daystrip` rules. Verify with `css.test.ts` ("forced-colors rules").

## 4. Docs and checks

- [x] 4.1 Add the changes to `CHANGELOG.md` `[Unreleased]`, and to the docs site's Live and Keyboard and screen reader pages.
- [x] 4.2 Run `uv run ruff check`, the Python tests, `cd web && npm run check`, `openspec validate --specs --strict` and `openspec validate a11y-keyboard-parity --strict`.
