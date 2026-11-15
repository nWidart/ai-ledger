# Tasks

Group 1 comes first. Groups 2 to 7 need only group 1 and touch separate files, so they can run at the same time; none of them edits `sections.tsx`, `ContextPage.tsx` or `context.css`, and none commits the build. Group 8 needs 2 to 7. Group 9 needs 8.

## 1. Backend: payload, types and fixture

- [x] 1.1 `FILL_BINS` becomes `(0.25, 0.5, metrics.NEAR_LIMIT, 0.9)` (design D1); update `FILL_LABELS` in `web/src/pages/context/context.ts` and the assertions that name the old labels. Verify in `tests/test_context.py`: a session at 79% of its window is in bin 2 and one at 81% in bin 3; a window's bins still add up to its sessions.
- [x] 1.2 `starting.trend` rows gain `p25` and `p75` (D2). Verify: a week with starts of 10,000, 20,000, 30,000 and 40,000 gives `p25` 17,500 and `p75` 32,500.
- [x] 1.3 `growth.share_curve` and each `growth.by_project_curves[].share_curve` (D3). Verify: a session with a 200,000 window at 150,000 tokens at a turn contributes 0.75 there; a session with no window is in the token curve's `sessions` and not the share curve's; a turn with 5 sessions of which 4 have a window is on the token curve and not on the share curve.
- [x] 1.4 `sessions_map` with `total` and the newest `SESSION_POINTS` points (D4). Verify: a session without a measured start, without a window or without a peak has no point and is not in `total`; with `SESSION_POINTS` patched to 2 and 3 eligible sessions, `points` holds the 2 newest and `total` is 3; `turns` is the session's number of turns; a point carries no `title`.
- [x] 1.5 `cost.series` (D5): move the `brk` CTE text to a helper shared with `session_breaks`, add the break's `ts`, and bucket by `metrics.day` or `metrics.week` as `metrics.usage` decides its work bucket. Verify: the sums of `cache_read` over the rows and of all three kinds reproduce `cost.cache_hit_ratio`; a day with 2 model-switch breaks and 1 expired break shows those counts; a view whose first request is 200 days old has `bucket == "week"`; `session_breaks` returns what it did before.
- [x] 1.6 `p95_bytes` on every `FillRow` (D6). Verify on a tool with 20 results of known sizes.
- [x] 1.7 Extend `ContextPayload` and `FillRow` in `web/src/api.ts` to match, with a doc comment per new field. Regenerate the fixture: `uv run python -m unittest tests.test_web_fixtures`. Make sure the rich store of `tests/test_context.py` gives the fixture at least two windows, two weeks on the trend, a share curve, ten or more session points with one compacted, three or more series buckets with a break, and more than ten tools; extend the store if it does not.
- [x] 1.8 `uv run ruff check`, `uv run python -m unittest discover -s tests` (leave `tests.test_web_build` failing only for a stale build), and `cd web && npm run typecheck && npm run lint && npx vitest run` pass.

## 2. Window pressure bars

- [x] 2.1 `PressureBars.tsx` with its stylesheet (D1, D7, D9): props `fill` and `points`; one stacked bar per window, segments as shares with count and share readable, tones neutral to critical with a text label per band; a segment is a button that toggles a list under the bar of the points in that window and band, newest first, at most 20 with a count of the rest, each row opening the session sheet; when `points` holds fewer sessions than the segment counts, the list says it covers the newest sessions on the map.
- [x] 2.2 `PressureBars.test.tsx`: segment widths are shares of the window, not of the largest bin; an empty band renders no segment and is still in the text alternative; selecting a segment lists the right sessions and selecting it again hides them; a row calls the session sheet opener; keyboard reaches every segment.

## 3. Starting ranges and trend

- [x] 3.1 `StartRanges.tsx` with its stylesheet (D2, D7): the by-project table of `sections.tsx` with a range cell (10th to 90th percentile bar, median tick, the 30,000-token line, one scale for all rows) in place of the inline bar, and a 90th percentile column; row selection opens the project sheet as today; the whole-view row keeps its place.
- [x] 3.2 `StartTrend.tsx` with its stylesheet, replacing the export of that name in `Charts.tsx`: median line and 25th to 75th percentile band, labelled y-axis, weeks placed by date so a missing week is a gap, weeks under `TREND_MIN_SESSIONS` drawn faded and named in the readout, keyboard reading and readout as `GrowthChart`, and a `ChartTable`.
- [x] 3.3 Tests for both: the range bar's left and width follow `p10` and `p90` on the shared scale; the threshold line is at 30,000; a project with a null window shows no share; the trend leaves a gap for a missing week; a 2-session week is marked; arrow keys step through weeks.

## 4. Growth chart

- [x] 4.1 In `GrowthChart.tsx` (D3, D9): a strip under the x-axis with a bar per turn for `curve[i].sessions`, labelled; a tokens or share-of-window switch (hidden when there is no share curve) that swaps curves, axis format and the 80% line; legend project keys as toggle buttons that isolate one project and draw its band, with `aria-pressed`; the readout and the `ChartTable` follow the mode and the selection.
- [x] 4.2 Extend `GrowthChart.test.tsx`: the strip has one bar per curve point; switching to share draws the 80% line and formats the axis as percentages; selecting a project hides the other project curves and draws a band; selecting it again restores them; no switch without a share curve.

## 5. Session map

- [x] 5.1 `SessionMap.tsx` with its stylesheet (D4, D9): log x-axis of starting context with labelled ticks and the axis named as logarithmic, y-axis of peak share capped at 100%, the 30,000-token and 80% lines, dots coloured by project, a ring on compacted sessions, a tooltip with the fields of the spec, arrow keys stepping through points in date order, Enter and click opening the session sheet, the "N of M" count, and a `ChartTable` of the points whose rows open the session sheet.
- [x] 5.2 `SessionMap.test.tsx`: a point's position against the two thresholds; a peak over its window is drawn at 100% and its tooltip shows the real share; the compacted mark; the count line when `total` exceeds the points; click and Enter call the opener; an empty map renders the empty state.

## 6. Cache chart

- [x] 6.1 `CacheChart.tsx` with its stylesheet (D5, D9): bars per bucket placed by date and stacked by cache read, cache write and uncached input; the cache-hit ratio as a line on a 0 to 100% right axis; a strip under it of breaks per bucket stacked by cause; a legend with text for every series; tooltip and keyboard reading as `CostChart`; a caption that causes are inferred; a `ChartTable`.
- [x] 6.2 `CacheChart.test.tsx`: a bucket's three segment heights; its ratio; breaks by cause; a missing day leaves a gap; weekly buckets are labelled as weeks; no series renders the empty state.

## 7. Tool contributors

- [x] 7.1 `Contributors.tsx` with its stylesheet (D6, D9): the main-thread and subagent totals as one split bar with both figures in text; a by-tool or by-MCP-server switch (no switch when there is no MCP row); the ten largest rows as horizontal total bars with estimated tokens labelled as estimates, each beside a median to 95th percentile range on a log scale with the 100 KB line; "Other" with a total and no range; a row opens the tool sheet.
- [x] 7.2 `Contributors.test.tsx`: ten rows and "Other" for 14 tools, no "Other" for 10; the split bar's shares; a row with a null range draws none; the estimate label; selecting a row calls the tool sheet opener for the right kind.

## 8. Wiring

- [x] 8.1 `sections.tsx`, `ContextPage.tsx`, `context.css` (D7, D8): use the new components; add the Window pressure section with id `pressure` and its section-index entry; show the per-project growth table whenever the view has more than one project; drop the inline bars from the tool tables and add the 95th percentile column; delete `Charts.tsx` and the styles only it used.
- [x] 8.2 Update `ContextPage.test.tsx` for the new page: every section renders from the fixture; the empty states; the section index.
- [x] 8.3 `cd web && npm run check`; commit the build in `src/ai_ledger/web/`. `uv run python -m unittest discover -s tests` passes with the fresh build.

## 9. Docs and verification

- [x] 9.1 `README.md`: the Context page's description names the new charts. `CHANGELOG.md`: entries under `[Unreleased]`.
- [x] 9.2 Time `context.payload` for the all-time view on a copy of a real store (never the live one), before and after; record both in the pull request. Open the page on that copy and check each chart in light and dark themes and at a narrow width. Measured on a copy with 1,217 sessions in the all-time view: 0.68 s before, 0.83 s after (median of three runs); the payload grew from 124 kB to 401 kB, most of it the 1,000 session points.
- [x] 9.3 `openspec validate improve-context-charts --strict` and `openspec validate --specs --strict` pass.
