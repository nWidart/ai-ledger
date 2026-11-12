# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): "Past windows" is a table. A table of hundreds of closed windows hides the pattern the page exists to show: how full each limit gets, how often it is hit, and which windows were cut short. The shape of a window (how fast it filled) is not in the table at all.

## What Changes

- **A strip per limit.** Above the Past windows table, each limit with closed windows in the range gets a row of small bars, oldest left, newest right. A bar is as tall as the window's final percent (with a visible minimum, so a 0% window is still a target). A window that hit its limit is red, one that ended early is hatched, an estimated one (rebuilt from counted usage) is a tint with an outline. They combine. Each bar is a button whose name and tooltip say all of it in words, so colour is never the only signal. A strip shows the 60 most recent windows of its limit and says how many there are when that is more. A key explains the three marks.
- **A curve on a click.** Picking a bar shows that window's curve in a panel under the strips: a heading with its name, dates, final percent and notes, and the same chart the open cards use (no forecast, no "now", plan changes marked, readable by hover or keyboard). Picking it again, or its Close button, closes the panel; Close returns focus to the bar. The selection is page state, not part of the URL, and a range or source that no longer holds the window closes the panel. The table row of the picked window is marked.
- **A lazy route.** `GET /api/limits/window?provider&limit_id&scope&start` answers one closed window's curve. The `/api/limits` payload carries no curve for closed windows: a long history has hundreds of 5-hour windows, and a curve is hundreds of points. The history rows gain the window's identity (`limit_id`, `scope`, `window_minutes`, `resets_at`) so a row can be asked for again.

Out of scope: a forecast or scenario line for past windows, "what used this window" for past windows, the selection in the URL, changes to the Unused section or the table's columns, a nav badge.

## Impact

- `src/ai_ledger/limits.py` (`history_row`, `limit_windows`, `window_curve`, `payload`), `src/ai_ledger/app.py` (the route), `tests/test_limits.py`, `tests/test_web_fixtures.py`, `web/src/api.ts`, `web/src/pages/limits/`, the page-test fixtures in `web/src/__fixtures__/`, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. The `/api/limits` payload gains four fields on each history row; nothing is stored and no `rebuild` is needed.

## Capabilities

### Modified Capabilities
- `plan-limits`: one closed window's curve can be asked for.
- `limits-dashboard`: Past windows draws a strip of bars per limit and a curve for the picked one.
