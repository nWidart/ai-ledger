# Tasks

## 1. Helpers

- [x] 1.1 In `limits.ts`, add `safePace(w, now)` (the two ends of the safe-pace line, or null), `coneCrosses(w)`, `status(w)` (the card header's status and whether it is critical), `paceRates(w)` (the footer's pace and whether it runs hot), `headroom(w, now)`, `chartRows(w, now)` (the data table: at most 12 sampled times and now), and the strip summary (`stripSummary`). Add `hits` to `Strip`. Give `readText` a flag for the scenario. Verify with `limits.test.ts` cases for the diagonal ends, for no diagonal (at limit, no reading, closed window), for the cone tint (high bound only, none, at limit), the hourly pace, and the strip summary.

## 2. Chart

- [x] 2.1 Rewrite `LimitChart.tsx`: the actual line (measured solid, estimated faded, no dots), the cone with its middle (warning tint from `coneCrosses`), the `now` tick, the safe-pace line, the 100% grid line, a labelled plan-change tick, and the last-24-hours line only when `recent` is on. Keep the readout, the keyboard and the accessible name. Verify with `LimitChart.test.tsx`.
- [x] 2.2 Add forced-colors rules for the chart in `theme.css`. Verify by reading the CSS against `theme.css`'s existing forced-colors block.

## 3. Card and page

- [x] 3.1 `WindowCard`: the header status, the three-column footer, and a `Details` button controlling a region with the caption, the scenario line, the paces, the share and surfaces lines, the cap money, what used the window and the data table.
- [x] 3.2 Remove `StatusStrip` and the chart key. Trim the heading to two figures and the suggestion to one figure. Make the hint one line, and add "How measured". Add the "Last 24 h pace" toggle.
- [x] 3.3 Replace the "Past windows" drawer and "Left unused" with a visible "Past windows" section: the range segment in its header, the strip summaries, the bar key, the picked window's panel, and the table behind `ChartTable`.
- [x] 3.4 `Filters.tsx`: add a `project` prop and export `RangeFilter`. The Limits header shows Source only. The Limits page asks `/api/limits` for no project, and the "What a point buys" table always folds.
- [x] 3.5 Update `LimitsPage.test.tsx` for the spec's scenarios, then run `cd web && npm run check` and commit the rebuilt `src/ai_ledger/web/`.

## 4. Demo and docs

- [x] 4.1 Update the Limits scene and shots in `tools/demo/record.mjs`. Regenerate the docs-site Limits shots from the demo store.
- [x] 4.2 Update `README.md`, the docs-site Limits page (`doc-coauthoring`; `cd site && npm run check`), and `CHANGELOG.md` `[Unreleased]`.

## 5. Verify

- [x] 5.1 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `openspec validate --specs --strict` and `openspec validate limits-pace-cone --strict`. Take before and after screenshots of Limits from the demo store, in light and dark.
