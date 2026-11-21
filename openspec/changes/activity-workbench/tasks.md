# Tasks

## 1. Server

- [x] 1.1 `on_day()` takes `days` (1 or 7; a ValueError otherwise). `session_list()` and `day_view()` pass it, and `app.py` reads `days` on `/api/day` and `/api/sessions`. Verify in `tests/test_metrics.py`: a week span sums its days, a range-cut week covers only its days in the view, `days=3` is a 400.
- [x] 1.2 `day_view()` adds `by_project`, `failed_tests` and `tests_failed`; `failed_test_runs()` is shared with `usage()`. Verify the day's project rows and failed runs.
- [x] 1.3 `usage()` drops `work_hours` and adds `speed_trend` in the chart's buckets. Verify a session counts in the bucket of its first request in the view, and the trend's output over model time matches the total's.

## 2. Work chart

- [x] 2.1 Split `WorkChart.tsx` into a bar track and a rate track on one x scale, using `lowVolume` from `components/chart`. Drop the right-hand axis. Keep the tooltip, readout, `ChartTable`, forced colors and 3:1 contrast. Verify in `WorkChart.test.tsx`: both tracks' values, the readout, the table and the hollow dot.
- [x] 2.2 Make week bars selectable by click and Enter; add the selection chip in the header; Escape on the chart clears the selection when no bucket is read. Verify week selection by click and keyboard, the chip and Escape.

## 3. Page

- [x] 3.1 `search.ts`: `week` and `tab` keys; `url.ts`: `week` is view-scoped; `NO_OVERVIEW_KEYS` drops both. Verify in `search.test.ts` and `url.test.ts`.
- [x] 3.2 `Workbench.tsx`: the WAI-ARIA tab list and panels, tab in the URL without a history entry, manual activation. Move the drawer contents into panels; Loops and tests previews five rows with "Show all N". Remove `WorkHours.tsx` and the section index. Verify tabs by keyboard and URL, the previews and their expand.
- [x] 3.3 Vitals: five tiles as buttons or a link, the Sessions note with the median session, the interrupted line under the lede, the output speed sparkline, the Codex-only note. Verify each tile's destination and the Codex note.
- [x] 3.4 A selected day or week fetches `/api/day` with its span and narrows every tab; the Sessions tab passes `days`. Verify the filter effect and clearing.
- [x] 3.5 Attention: a compact list whose actions open their tab. Update `ActivityPage.test.tsx` and `SubjectMenu.test.tsx`.

## 4. Verify and document

- [x] 4.1 Regenerate `web/src/__fixtures__/`.
- [x] 4.2 Extend `tools/demo/firstscreen.mjs` with the tab list's bottom on Activity at 1440×900; record the numbers.
- [x] 4.3 README, docs site (`pages/activity.mdx` and the pages that name Activity's drawers), CHANGELOG `[Unreleased]`.
- [x] 4.4 Regenerate the Activity screenshots and GIFs that change.
- [x] 4.5 Run `uv run ruff check`, the Python tests, `npm run check` in `web/` and `site/`, `openspec validate --specs --strict` and `openspec validate activity-workbench --strict`.

## 5. Review fixes

- [x] 5.1 Clip every figure of a selected day or week, active time included, to the range's days up to today; name the clipped days in the panel. Validate `days` whenever present (1 or 7, with a `day`).
- [x] 5.2 Take no pick from a chart still showing the previous view; accept only a Monday for `week=` and drop a week the view does not reach.
- [x] 5.3 Move the focus once per tile or attention action; send the focus to the chart from the panel's "Show the whole range". Tiles and attention actions clear the selection.
- [x] 5.4 Forced colors: frame the hovered and selected bucket at full opacity, match the hollow-dot key to its dot; give the Sessions search the control border. Escape closes a pointer tooltip wherever the focus is.
- [x] 5.5 Restore the total active time, the thinking time and the interrupted count.
