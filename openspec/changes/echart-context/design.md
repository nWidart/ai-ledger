# Design

## Context

See `proposal.md` for the motivation. Three archived designs hold what this one builds on, and all three are true to the code:

- "The foundation": `openspec/changes/archive/2026-11-21-echart-foundation/design.md`, the wrapper's contract.
- "The Activity design": `openspec/changes/archive/2026-11-21-echart-activity/design.md`, the multi-track pattern.
- "The Errors design": `openspec/changes/archive/2026-11-22-echart-errors/design.md`, marks on the frame, track titles and the zoom's rules. Its section "What later changes inherit" is the starting point here.

This section holds only what shapes this change.

**The five drawings today** (`web/src/pages/context/`).

| File | What it draws | How it is read |
|---|---|---|
| `CacheChart.tsx` (212 lines, one SVG of 380px) | Three tracks over calendar slots (a day, or a week when the view's first request is more than 60 days old): stacked bars of uncached input and cache writes (cache reads on request), the cache breaks stacked by cause, the cache-hit ratio as a line with a dot per bucket. A slot with no request is empty. Each track has a title with a figure at the right. | Arrow keys skip empty slots; the pointer reads the slot under it, nothing on an empty one. A dashed line and an outline mark the bucket; a tooltip and a visible line of text give its figures. |
| `GrowthChart.tsx` (150 lines, 306px) | x is the turn. The view's median with a halo, its 25th to 75th percentile band, one line per project (up to five), a dashed 80% line in share mode, and under the axis a strip of bars: the sessions still running at each turn. | The nearest turn by x. A dashed line and a dot; a visible line of text, no tooltip. The measure switch and the project isolation are React state. |
| `StartTrend.tsx` (107 lines, 180px) | One point per week with a session, placed by date. The median with a halo, the band broken into runs of neighbouring weeks, a vertical span for a week with no neighbour, a dot per week (hollow and faded under 3 sessions), the dashed 30,000-token line. | The nearest week by x. A dashed line and a ring; a visible line of text, no tooltip. |
| `SessionMap.tsx` (239 lines, 320px) | Up to 1,000 dots on a log x axis (starting context) and a share y axis (peak share of the window), rings on compacted sessions, dashed lines at 30,000 tokens and 80%, four quadrant names wrapped to fit, a wash on the selected quadrant, the dots outside it at 20%. | The pointer reads the nearest dot within 12px in both directions. The keys step from the oldest session to the newest. Enter or a click on a dot opens the session's sheet. A click away from any dot selects the quadrant under it. One Escape ends the reading and clears the quadrant. A ring marks the dot; a tooltip and a visible line of text give its figures. |
| `PressureBars.tsx` (87 lines) | HTML: per window, a flex row of buttons, one per band, each with its own list of sessions. No SVG. | Each segment is a button in the tab order, with `aria-pressed` and its own name. |

**Constraints.**

- The wrapper reads grid 0 and x axis 0 as category bands: `convertFromPixel({ xAxisIndex: 0 }, x)` is the point's index. `EChart.tsx` and `testing.ts` belong to the `echart-point-keys` change until it merges, and a wrapper contract change is the owner's to make.
- `web/scripts/check-bundle.mjs`: the ECharts chunk is 176.5 kB gzip, limit 195 kB. Registered: `CustomChart`, `LineChart`, `DataZoomSliderComponent`, `GridComponent`, `SVGRenderer`.
- Only color tokens declared in `theme.css` as hex or `rgb()` inside `light-dark()` may go through `env.color` (the foundation, decision 4). The cache chart's break colors are `color-mix()` values scoped to `.pg-context .cache-chart` today.
- `web/src/css.test.ts` lets allow-lists shrink only. `openspec validate --strict` rejects a requirement text over 500 characters.
- The page reads one payload per view (`queries.context(want)`, with the previous view's figures kept while the next loads). The server leaves out a day or week with no request, a week with no session, and a turn with fewer than 5 sessions.
- The turns of a curve are 1 to N with none missing: a session that has turn t has turn t - 1, so the count of sessions per turn never rises, and the curve is cut at the first turn under 5 sessions (`growth()` in `src/ai_ledger/context.py`). A project's curve and a share curve end at or before the view's.
- Another thread is building a session quadrant on the Project page (`graph-project-quadrant`, not on main; read on `step/quadrant-4-1-browser`). It is the same shape as the session map: log axes, dots as a custom series, a reading by the nearest dot. It uses the wrapper as it is, with `points={0}`, and reads by itself. It registers no new series type.

**What the spikes measured** (ECharts 6.1.0 from `web/node_modules`, registered as `echarts.ts` registers it, the SVG renderer in jsdom under vitest, with the app's own `option.ts` and `stack.ts`; chunk sizes with `vite build` and `gzip -9`, as `check-bundle.mjs` counts; the spike files are in the planner's scratchpad and in no commit). jsdom lays nothing out and estimates a text's width at 0.6em a character. Each decision cites the result it rests on.

| # | What was asked | What was measured | The decision it supports |
|---|---|---|---|
| S1 | A band between two series over category slots and a value axis, with breaks: can a custom series draw it? | One item per run draws one polygon through every point of the run: 80 points for 40 turns, written with `fill-opacity="0.16"`. Over 12 weekly slots with runs at 0–3, 5 and 8–11: two polygons of 8 points and, for the lone week, one line 7px wide with round caps from its 75th to its 25th percentile. The line series over the same slots, with `null` at an empty slot, is three moves: it breaks where the band does. A dashed line across the plot at a value with a right-aligned label is one more item (`stroke-dasharray="4,3"`). A curve of one turn draws no line, and `lineDots` draws its dot. | 5, 7, 8 |
| S2 | Does the wrapper's index model read turns and weeks? Its calls: `containPixel({ gridIndex: 0 })`, `convertFromPixel({ xAxisIndex: 0 }, x)`, `convertToPixel`, the `updateAxisPointer` action. | **Turns as category bands** (40 turns, two tracks, `tracksOption`): a pointer in the curve, in the gap and in the strip reads the same index (0, 8 and 39 at 800px), and nothing under the labels. **Calendar slots with empty slots** (30 days, 4 empty): the empty slot reads its own index in every track, and the action draws the band on it, as wide as on any other slot (24.7px at 800px, 9.4px at 343px). **A category axis with `boundaryGap: false`**: `convertFromPixel` rounds to the nearest point (points at 52 and 198.8px: x 125 reads 0, x 200 reads 1). **A value axis**: `convertFromPixel` gives values, not indexes (1.33, 1.5, 2.01, 3.5), and `convertToPixel(0)` is -94.8px, off the plot. | 3, 4 |
| S3 | Do `trackLayout` and `tracksOption` hold, with `outerBoundsMode: "none"`, for a strip of bars under a line track and for three tracks? | Yes. Two tracks: points 0, 20 and 39 have one x on the frame and on both tracks (61.2, 428.2, 776.8px at 800px; 55.5, 194, 325.5px at 343px). 40 strip bars, the first centred on 61.2px and the last on 776.8px, 10px wide at 800px and 4.8px at 343px. Three tracks at 343px and twice the text: one x on the frame and on the three tracks (107.7, 137.5, 323.3px). | 6, 7 |
| S4 | The session map's shape: a log axis with ticks at 1, 2 and 5; 1,000 dots; picking in two dimensions; a click on empty plot; emphasis; the cost of a draw. | **Ticks.** By default a log axis labels the powers of ten and its ends (5k, 10k, 100k, 200k). With `axisLabel.customValues` and `axisTick.customValues` it labels 5k, 10k, 20k, 50k, 100k and 200k, and draws a split line at each. **Pixels.** With `outerBoundsMode: "none"` and the grid given as left, top, width and height, ECharts' pixel of each of 1,000 points equals `left + logFraction × width` within 4.5e-13px, at 800px, at 343px and at twice the text. **Drawing.** 1,000 dots and 143 rings are 1,176 SVG nodes; the first drawing takes 16 to 19ms and a redraw with a quadrant selected 12 to 16ms, in jsdom, with no layout and no paint. **Picking.** The nearest of 1,000 points within 12px, by a pass over all of them: 0.01ms a pick. **A miss.** A pixel in the plot's top right: `containPixel` true, `convertFromPixel` gives [138,301, 0.9]; under the plot, false. **Emphasis.** A `highlight` action on the dots changes no dot's paint, with `emphasisDisabled` or without. **Text.** "Heavy\nand full" is two text nodes 12.65px apart; the axis names are drawn, the y one rotated. | 9 |
| S5 | The zoom slider on the cache chart's slots, and on a turn axis. | **Cache.** A window of 10–12 becomes 10–16: the minimum is 7. Zoomed to 10–19, ten bars are drawn and slots 10, 13 and 19 have one x on the frame and on the three tracks (89, 311, 755px). Slot 10, whose neighbours 11 and 12 are empty, is a move with no length in the ratio line, and `lineDots` draws its dot. **The faint trend.** With the hidden totals line on the ratio track, listed before the ratio line, the slider's line is the mirror image of the one it draws without it: the totals, not the ratio. **Turns.** A slider over 100 turn slots works: zoomed to turns 1–20, the labels are 1 and 20. | 10 |
| S6 | Text the chart measures, at a 343px box and at twice the text size. | **Track titles.** `axisTitle` cuts "Tokens not read from the cache · 2.4M in this view" (330px by the estimate) to "Tokens not read from the cache · 2.4M in…" in a 283px plot, and to "Tokens not read…" at twice the text (660px in a 223px plot). **Bucket labels.** ECharts thins them: 15 of 30 at 800px, 7 at 343px, 3 at 343px and twice the text. At 343px the newest label is not drawn in jsdom's estimate, though `tracksOption` asks for it. **Turn labels.** With `axisLabel.interval` as a function, 83 turns are labelled 1, 20, 40, 60, 80 and, right-aligned, 83 at 800px; 1, 20, 40, 60 and 83 at 343px. **The map.** At 343px and twice the text the x labels are 5k, 10k and 50k; the others are hidden as overlapping. | 6, 7, 9 |
| S7 | What would each candidate add to the ECharts chunk? | Base 176.5 kB. `ScatterChart` +1.8 kB (178.3). `MarkLineComponent` +5.6 kB (182.1). `MarkAreaComponent` +3.1 kB (179.6). Both mark components +6.9 kB (183.4). All three +8.7 kB (185.2). The log axis: +0, it comes with the grid (S4 ran on the app's registration). Custom series: +0. | 18 |
| S8 | How big is the Context page chunk? | `ContextPage-*.js` is 19.4 kB gzip -9 at this change's base. The shared chart chunk `zoomReset-*.js` is 7.1 kB, the entry 109.9 kB. | 18 |

**What jsdom cannot show**, handed to the browser steps (4.2 to 4.4): the real widths of texts (which track title form fits, the newest bucket label of S6, the wrap of a quadrant's name, the side of the "80% of window" label, the thinned labels), the pointer's place in a laid-out page (the map's box under a scroll, a page zoom, a tooltip beside the pointer), every color (dark, a system flip, forced colors), the draw-in on a first drawing, a real drag of the slider, the focus ring, and the time a redraw of 1,000 dots takes in Chromium.

## Goals / Non-Goals

**Goals:**

- Move the four SVG charts to the shared chart component, keep every behavior, and list every difference a user can notice.
- No wrapper contract change, no change to a shared chart file, nothing new in the ECharts chunk.
- Leave Limits and the session sheets the pieces they need next: a band, a line across the plot, a scatter read from its own layout.

**Non-Goals:**

- The window pressure bars (decision 1), the start ranges, the window grids and the contributors' bars: HTML, with no SVG.
- The data tables. Each chart keeps its `<ChartTable>` as it is.
- A zoom on the growth chart, the weekly start chart or the map (decision 10).
- A shared scatter reading in the wrapper. The map and the Project page's quadrant each read by themselves; one later change can move both (see "Needs the owner").
- Folding long empty stretches into one point, as Errors does.
- Changing any reading's words for a point that has data, any label beyond the zoom keys named on the cache chart, the legend, the measure switch, the project isolation, the quadrant buttons or their lists.
- Deleting `dayAxis` and `peakLabelAt` from `chart.ts`: `option.test.ts`, a shared chart file's test, still uses them. The last migration deletes them.

## Differences the owner sees

What a user will see or meet that differs from today. The owner reads this first; each line names the decision that explains it.

**All four charts.**

1. The chart draws a moment after the page on a first visit to Context, in a box already at its height.
2. The point being read is a band over the plot, with no line and no dot on it: a faint wash in the theme, a highlight-colored wash in forced colors. Today it is a dashed vertical line with a dot (growth, weekly start), or a dashed line with an outline on the bucket's bars (cache). The map keeps its ring (decisions 6 to 9).
3. Escape closes a tooltip the pointer opened wherever the focus is. Today the chart must have the focus.
4. After newer data, the reading stays on its day, week, turn or session. Today it stays on its index, which can then be another day or another session (decision 11).
5. The cache bars grow and the lines draw in once, when the chart first draws; never under reduced motion. The map never animates.
6. ECharts picks which axis labels fit. Line widths are 1.75px where they were 2px. Label positions and the grid's pixels may differ by a pixel or two.

**Cache use over time** (decision 6).

7. A zoom slider shows under the bucket labels in views of 14 days or weeks or more, and the box is 28px taller there. Plus and minus zoom; "Show all days" or "Show all weeks" shows while zoomed (decision 10).
8. A day or week with no request is read: the band sits on it, the tooltip says "No request" and the sentence is "Nov 4, 2026: no request.". Today the keys skip it and the pointer reads nothing on it (decision 4).
9. A track's figure follows its title after a middle dot: "Tokens not read from the cache · 2.4M in this view". Today it is right-aligned at the plot's edge. In a narrow plot the figure takes its short form ("· 2.4M"), then the title stands alone, then it is cut with "…".
10. The ratio line has no dot on every bucket: a dot shows only on a bucket whose neighbours have no request. It has no halo: it is alone on its track.
11. A bar's parts follow the shared stack's rule, as on Cost, Activity and Errors: a part above zero keeps at least 1px, with 2px between parts, and the top part has round corners when it is taller than 4px. Today a part keeps 2px, with 1px between, and every part is square.
12. The line of text under the chart that repeated the reading is gone: the tooltip has the same figures, and the live region still says the sentence.
13. The newest bucket's label is always shown, right-aligned on its point (the shared rule for charts of several tracks).
14. The box is 364px, 392px with the slider. Today it is 380px.
15. In forced colors the cache-read part keeps its theme fill inside the text-colored edge. Today it is filled with the page color.
16. The breaks strip has a grid line at its top as well as at its baseline.

**The growth chart** (decision 7).

17. A tooltip shows at the turn being read: the median, the band, the sessions, and each project's median. The line of text under the chart is gone.
18. Each turn is a band, so the curve starts half a band inside the plot's left edge and ends half a band before its right edge. Today it runs from edge to edge. With 100 turns that is under 4px; with 5 turns it is 73px at 800px.
19. The strip of sessions still running sits between the curve and the turn labels, and its caption is a title over it, with the figures after a middle dot. Today the turn labels are between the curve and the strip, and the caption is under the strip with the figures at the right.
20. The last turn is always labelled, right-aligned on its point, beside turn 1 and the round turns.
21. The curve's last point has no dot. A curve of one turn is a dot.
22. The box is 302px. Today it is 306px.
23. In forced colors each project line sits on a page-colored halo.

**Median start by week** (decision 8).

24. A tooltip shows at the week being read. The line of text under the chart is gone.
25. A week with no session is read: "Week of Nov 9: no session started.". Today the keys skip it (decision 4).
26. A week of fewer than 3 sessions is a hollow dot in the line's color at full strength. Today it is faded to 60%. A week with neighbours has no dot; a week with no neighbour keeps its dot and its span. Today every week has a dot.
27. Each week is a band, as on the growth chart: the first and last weeks sit half a band inside the plot.
28. At a larger text size the box grows and the plot keeps its 144px. Today the box stays 180px and the plot shrinks, to 108px at 200%.
29. The "30k" label sits over its line at every text size, and under it only where it would leave the plot's top. Today it moves under the line at a larger text size.

**Sessions by start and peak** (decision 9).

30. At a larger text size the box grows and the plot keeps its 260px. Today the box stays 320px and the plot shrinks, to 200px at 200%.
31. The line of text under the map that repeated the reading is for screen readers only. The tooltip shows the same fields.
32. Escape from another control closes a tooltip the pointer opened. It clears the selected quadrant only from the map or the quadrant buttons, as today.
33. In forced colors the ring around the dot read is highlight-colored, and a dot's edge and a compacted session's ring are in the system text color. Today the ring around the dot read keeps the theme's text color, which a dark forced palette hides.
34. A quadrant's name wraps by its measured width. Today the width is estimated from its letter count.
35. Tick labels that would overlap are hidden. Today every tick is labelled.

Not different: every legend, the "Cache reads" toggle, the measure switch, the project isolation, the quadrant buttons, their lists and Clear, what a click on the map does, the one Escape that ends the reading and clears the quadrant, every label, every reading's words for a point with data, the tooltips' rows on the cache chart and the map, the data tables, the empty states, the captions, and the window pressure bars.

## Decisions

### 1. What moves and what stays

| Chart | Decision | Why |
|---|---|---|
| Cache chart | Moves to `<EChart>`, three tracks, with the zoom | Nearest to Errors' rate chart: `tracksOption`, `stackSeries`, `lineSeries`, `axisTitle`, `zoomSlider` as they are (S2, S3, S5) |
| Growth chart | Moves to `<EChart>`, two tracks: the curve and the strip | Turns are 1 to N, so they are category slots and the wrapper reads them as it is (S2); the band and the 80% line are custom series (S1) |
| Weekly start chart | Moves to `<EChart>`, one grid | Weeks placed by date are calendar slots, one per week, as the cache chart's are (S1, S2) |
| Session map | Moves to `<EChart points={0}>`: the wrapper draws, the map reads | The wrapper reads one axis as indexes, and the map reads the nearest dot in two dimensions (S4). The Project page's quadrant made the same choice. No wrapper change |
| Window pressure bars | Stay HTML | Each segment is a real button in the tab order with its own name, pressed state and list. A drawn bar would need a reading rebuilt for it, and would lose the focus ring per segment and the text that wraps inside a segment. Nothing here is SVG, so nothing is hand-written chart code to remove |

### 2. One change, and no wrapper contract change

One change holds the four charts. Nothing in it needs the wrapper's contract to change:

- The cache chart, the growth chart and the weekly start chart use the wrapper's index model as it is (decision 3).
- The reading of an empty slot needs no new rule: the slot is read (decision 4).
- The session map reads by itself, around a wrapper that reads nothing (decision 9).

The session map is the riskiest chart and touches no file another chart touches. Its four steps (1.5, 2.5, 3.3, 4.4) can be left out or follow later with nothing else waiting.

Alternative: a second change for the map, with a wrapper `locate` contract. Not chosen: the map's own reading exists today and stays the same size, the quadrant thread chose the same form, and a shared scatter reading is better designed from two working charts than from one (see "Needs the owner").

### 3. Points are category slots

Every chart that the wrapper reads puts its points on a category axis, one band per point, as Cost, Activity and Errors do.

| Chart | A point is | Slots |
|---|---|---|
| Cache | A day or week of the calendar | Every day (or week) from the first row to the last; a slot with no row is empty |
| Growth | A turn | The curve's points, in order: turn 1 to turn N |
| Weekly start | A week of the calendar | Every week from the first to the last, 7 days apart; a week with no session is empty |

- **Why not a value axis for turns.** The wrapper would read values as indexes (S2), so it would need the reserved `locate` prop: a contract change. Turns are whole and have no gaps, so a band per turn places them exactly as evenly as a value axis does. The only difference is the half band at each end (difference 18).
- **Why not `boundaryGap: false`.** It would keep the curve on the plot's edges, and the wrapper would read it (S2). But `tracksOption` builds band axes for every track, and the strip's bars need bands. A local copy of `tracksOption` for one chart costs more than the half band.
- **Weeks placed by date.** One slot per calendar week gives every week its place by date, and a week with no session its gap. That is the spec's "weeks placed by date", drawn on bands.
- **The band is the reading mark** on all three, as on Cost, Activity and Errors (difference 2).
- Each track's x axis is the frame's, from `tracksOption`; the weekly start chart has one grid and uses `categoryAxis`.

### 4. An empty slot is read

On the cache chart and the weekly start chart, the keys and the pointer stop on a slot with no data. `points` is the slot count, and `read(i)` and `tip(i)` answer for an empty slot.

| Chart | Sentence | Tooltip |
|---|---|---|
| Cache, by day | "Nov 4, 2026: no request." | The date as its head, then "No request" |
| Cache, by week | "Week of Nov 2, 2026: no request." | The same |
| Weekly start | "Week of Nov 9: no session started." | "Week of Nov 9", then "No session started" |

Why:

- It needs no wrapper rule. The Activity and Errors designs foresaw "a reading that skips empty slots, a new wrapper rule". That rule is a contract change, and the owner makes those.
- Cost, Activity and Errors read a quiet day. One rule on every page: the arrow keys move one slot of the calendar.
- A gap is a fact. "No request" on Nov 4 tells a user that the missing bar is no fault of the drawing.

The cost: a long gap is many presses. A week view with 13 empty weeks is 13 presses, or one of Home, End or the pointer. Errors folds such stretches; this chart does not, since the spec asks for weeks placed by date and for each track to leave the day empty.

The other way is the wrapper prop `skip`, designed under "Needs the owner", W1.

### 5. Context-local chart parts

`web/src/pages/context/chartParts.ts` holds what two charts or more of this page need. All pure, typed from `echarts.ts`, tested once in `chartParts.test.ts`. No shared chart file changes.

- **`calendarSlots(first, last, bucket)`**: the days from `first` to `last`, or the weeks 7 days apart. The date walk of today's `cacheSlots`. Users: cache, weekly start.
- **`bandSeries(env, { id, lo, hi, color, opacity, xAxisIndex, yAxisIndex })`**: a custom series, silent, `z: 1`, shapes with `emphasisDisabled`. `lo` and `hi` are per slot, `null` where there is no point. One item per run of neighbouring slots with values: a polygon through the run's `hi` points and back along its `lo` points, filled with `color` at `opacity`. A run of one slot is a line from its `hi` to its `lo`, 7px wide with round caps, at `opacity` plus .12 (S1). Users: growth (one run), weekly start (runs and lone weeks).
- **`thresholdLine(env, { id, value, text, xAxisIndex, yAxisIndex })`**: a one-item custom series, silent, `z: 2`: a 1px dashed line (`[4, 3]`) in `ink.muted` across the plot at `value`, and `text` right-aligned at the plot's right edge, 4px over the line, or 4px under it when it would pass the plot's top. Users: growth's 80% line, the weekly start chart's 30k line.
- **`fitTitle(env, title, figures, maxWidth)`**: `title · figure` for the first of `figures` (the long form, then the short) whose width at weight 500 (`labelWidth`) fits `maxWidth`, else `title` alone. The result goes to `axisTitle`, which cuts it when even the title is too wide (S6). Users: the cache chart's three titles, the growth strip's title.

Not here: the map's dots and guides (one user), and the cache-read edge (one user).

Why local and not in `option.ts`: two pages do not need them yet, `option.ts` belongs to every chart, and `echart-point-keys` is changing the shared files now. Limits' band and its plan-change line can move them to `option.ts` in its change, with the proof that asks.

### 6. The cache chart: every behavior and its form

`CacheChart.tsx` splits as the rate chart did. `cacheTracks.ts` is pure: `cacheModel(series, reads)`, `cacheLayout(model, textScale)`, `cacheOption(model, env)`, `cacheZoomWords(model, shown)`, with `waste`, `hitRatio` and `ratioFloor` moved there. The component keeps the legend, the toggle, the label, the words of the reading, the tooltip, the caption and the table.

Layout at the default text size: margins top 20, right 8, bottom 24, left 52, scaled with the text; the bars 180px, the breaks 48px, the ratio 44px, all fixed; a gap of 24px, scaled, that holds each lower track's title. The box is 364px, 392px with the slider, 456px at 200% text.

| Behavior today | Form on the shared component |
|---|---|
| One slot per day or week, empty where no request | `calendarSlots`; `points` is the slot count |
| Bars of uncached input and cache writes, the biggest part first | `stackSeries` on `trackAxes(0)`, kinds `var(--accent)` and `var(--series-1)` |
| Cache reads on request, on top, the axis rescaled | A third kind, `var(--track)`; the model's `max` is over the prompt tokens. A local one-series edge (`id: "reads-edge"`) frames each cache-read part with 1px of `ink.muted`, from `stackRects`, so the pale part keeps its 3:1 edge. Not drawn in forced colors, where the stack edges every part |
| The token axis in round ticks | `niceMax()` and `valueAxis`, as `dayAxis` gave |
| The breaks by cause, stacked, on their own scale | `stackSeries` on `trackAxes(1)`, `id: "breaks"`, kinds `var(--cache-switch)`, `var(--cache-expired)`, `var(--text-muted)` (decision 13); a value axis to the busiest slot's breaks, its labels hidden |
| The ratio line, broken at an empty slot, from 90% or the lowest ratio's tenth | `lineSeries` on `trackAxes(2)` in `var(--text-primary)`, `null` for an empty slot; a value axis from `ratioFloor()` to 1 in one step |
| A dot per bucket on the ratio line | `lineDots`: a dot only on a bucket no line reaches (difference 10) |
| A title and a figure per track | `axisTitle(env, fitTitle(…), plot width)`: "Tokens not read from the cache" or "Prompt tokens" with "· 2.4M in this view" (short: "· 2.4M"); "Cache breaks" with "· most in a day: 4" (short: "· most: 4"; none: "· none in this view", "· none"); "Cache-hit ratio" with "· 91% in this view" (short: "· 91%") |
| Bucket labels | The frame's `categoryAxis` with `dayLabel` |
| Hover or keys read a bucket on the three tracks | The wrapper, on the frame |
| The keys skip an empty slot | An empty slot is read (decision 4) |
| Tooltip rows and the sentence for a bucket | Unchanged: `tip(i)` and `read(i)` |
| The dashed line and the outline on the bucket read | Dropped: the band (difference 2) |
| The legend and the "Cache reads" toggle | Unchanged HTML, with the "Show all" button at the end of its row |
| The label | Unchanged, plus the zoom keys in views that show the slider |
| The caption, the data table, "No request in this view." | Unchanged; the empty state renders no chart |
| Thin parts stay visible, no stack leaves its track | `stackRects` (difference 11) |
| Text scaling | `trackLayout`: the labels and gaps scale, the three tracks keep their height |
| The zoom | Decision 10 |

Series order: the slider's trend (in a view that shows the slider), the bars, the cache-read edge, the breaks, the ratio line, its dots, the slider.

### 7. The growth chart: every behavior and its form

`growthCurves.ts` is pure: `growthModel(curve, projects, share, mode, isolated, color)`, `growthLayout(textScale)`, `growthOption(model, env)`. `color` is the page's project color function; the component memoizes the model on it, since a project's hue changes with the project order (the Cost chart's stale colors, found in `echart-activity`). The component keeps the measure switch, the legend with its project buttons, the label, the axis note, the words and the table.

Layout at the default text size: margins top 12, right 14, bottom 24, left 52, scaled; the curve 218px and the strip 22px, both fixed; a gap of 26px, scaled, that holds the strip's title. The box is 302px, 364px at 200% text.

| Behavior today | Form on the shared component |
|---|---|
| x is the turn | One category slot per point of the curve in view; `points` is its length |
| Turn labels at 1 and at round turns | The frame's axis with `axisLabel.interval` as a function: turn 1 and the multiples of `niceStep(turns / 6)`. `tracksOption` adds the last turn, right-aligned (S6, difference 20) |
| The y axis: tokens, or the share of the window | `valueAxis`, with today's rule moved to the model: the top is the highest drawn value (and 80% in share mode) plus 6%, in round steps of a quarter of it |
| The band, the view's or the isolated project's | `bandSeries` on `trackAxes(0)`: `ink.secondary` at .16, or the project's color at .18 |
| The 80% line in share mode, with its label | `thresholdLine` at `NEAR_LIMIT`, "80% of the window" |
| One line per project, thicker when isolated | `lineSeries` per project with its color and width set after (1.5px, 3px when isolated): `lineSeries` alone would draw every line in the text color under forced colors. `null` after the project's last turn. In forced colors each sits on a 4.5px `ink.surface` line |
| The view's median with a halo | Two `lineSeries`: 4.5px in `ink.surface`, then the line in `var(--text-primary)` |
| The dot on the last point | Dropped. `lineDots` draws a curve of one turn (S1, difference 21) |
| The strip: one bar per turn, by its sessions | `stackSeries` on `trackAxes(1)`, `id: "strip"`, one kind `var(--text-muted)` at `o: .55`, width `min(10, band × .7)`; a value axis to the most sessions, its labels hidden |
| The strip's caption and figures | `axisTitle(env, fitTitle("Sessions still running at each turn", ["55 at turn 1 to 5 at turn 80", "55 to 5"], …))` on the strip's axis |
| The nearest turn by x, a dashed line and a dot | The wrapper: the band over both tracks |
| The visible line of text | A tooltip, `tip(i)`: "Turn 12", then Median, 25th to 75th percentile, Sessions, and one row per drawn project with a point at that turn (its band too when isolated). `read(i)` is today's sentence, unchanged |
| The measure switch ends the reading | The measure is in the `view` key (decision 11) |
| Isolating a project keeps the reading | It is not in the key: the same view is drawn again |
| Escape and blur end the reading | The wrapper |
| No curve: nothing | Unchanged |

### 8. The weekly start chart: every behavior and its form

`startWeeks.ts` is pure: `weeksModel(trend)`, `weeksLayout(textScale)`, `weeksOption(model, env)`. One grid: margins top 10, right 14, bottom 26, left 52, scaled; the plot 144px, fixed. The box is 180px, 216px at 200% text.

| Behavior today | Form on the shared component |
|---|---|
| Weeks placed by date, a gap for a week with no session | `calendarSlots(first, last, "week")`; `points` is the slot count |
| The median with a halo, broken at a gap | Two `lineSeries`, `null` at an empty slot |
| The band in runs, a span for a lone week | `bandSeries` (S1) |
| A dot per week, hollow and faded under 3 sessions | `lineDots` with `hollow` for a week under `TREND_MIN_SESSIONS` (difference 26) |
| The dashed 30,000-token line, when the axis reaches it | `thresholdLine` at `START_LARGE_TOKENS`, "30k" |
| The y axis | `valueAxis`, today's rule in the model: the highest of the medians and 75th percentiles plus 8%, in round steps of a third of it |
| Week labels, one every 64px | `categoryAxis` with `dayLabel`; ECharts thins them |
| The nearest week by x | The wrapper |
| The visible line of text | A tooltip, `tip(i)`: "Week of Nov 2", then Median, 25th to 75th percentile, Sessions, and "Rests on few sessions" under 3. `read(i)` is `readWeek`, or the empty week's sentence (decision 4) |
| One week: a dot and no line | `lineDots` and `bandSeries`' span |
| No week: nothing | Unchanged |

### 9. The session map: the wrapper draws, the map reads

`<EChart>` gets `points={0}`, `read={() => ""}` and no `tip`, `onActivate`, `status`, `onEscape` or `zoom`. With no points its key handler prevents nothing, its pointer reads nothing and its live region stays empty (`EChart.tsx`: `if (step == null || !points) return`, and `under()` answers null). It keeps the focusable group with its label, the lazy load, the environment, the resize, the height from the first render and the "could not be drawn" text.

`mapDots.ts` is pure:

- `mapModel(points)`: the sessions oldest first, the x domain and its ticks (`startDomain`, `startTicks`, `roundDown`, `roundUp`, `logFraction`, `drawnShare`, moved from `SessionMap.tsx`), and the count per quadrant.
- `mapFit(model, width, textScale, measure)`: the plot's rectangle (margins top 14, right 16, bottom 46, left 52, scaled; 260px high, fixed), each dot's pixel, the pixels of the 30,000-token and 80% lines, each quadrant name's lines and place (`fitLines`, with the width from `measure`, which the component gives as `labelWidth` at weight 600), and the side of the "80% of window" label.
- `dotAt(fit, x, y)`: the nearest dot within 12px, or null. `quadAtPixel(fit, x, y)`: the quadrant under a pixel of the plot.
- `mapOption(fit, env, { quad, color })`.

| Behavior today | Form |
|---|---|
| A log x axis from a round value under the smallest start to one over the largest, ticks at 1, 2 and 5 | `type: "log"` with `min` and `max`, and `customValues` for the labels and ticks (S4) |
| The y axis, 0 to 100% in fifths | `valueAxis` with `max: 1`, `step: .2` |
| The axis titles | Each axis's `name`, `nameLocation: "middle"`, `nameMoveOverlap: false`; the y one rotated, and "Peak share" when the plot is too short for the long form |
| The plot sits where the reading expects it | One grid given as left, top, width and height, with `outerBoundsMode: "none"`: ECharts' pixel is the fit's (S4) |
| The 30,000-token and 80% lines, their labels, the quadrant names, the selected quadrant's wash | One custom series `id: "guides"`, `z: 1`: the wash (`var(--surface-2)`; in forced colors a 2px `ink.accent` frame with no fill), two dashed lines in `ink.muted`, the two labels and the four names with a 3px `ink.surface` halo, the selected name in `ink.text` |
| One dot per session in its project's color, a ring on a compacted one, the others at 20% outside the selected quadrant | One custom series `id: "dots"`, `z: 3`: a 4px circle at .75 with a 1px `ink.surface` edge, and a 7.5px ring 1.5px wide. In forced colors the edge and the ring are `ink.text` |
| The ring around the dot read | An `<svg class="map-mark">` over the box, with no pointer events, as the quadrant's mark: it needs no redraw of 1,000 dots (S4), and it shows before the chart has drawn |
| Pointer: the nearest dot within 12px | `mousemove` on the box around the wrapper: `dotAt` on the pointer's place less the box's |
| Keys: oldest to newest, Home, End | The box's `keydown`; a modified key is the browser's |
| Enter or a click on a dot opens the session | `openSessionSheet` |
| A click away from any dot selects or clears the quadrant | `quadAtPixel` |
| One Escape ends the reading and clears the quadrant | Unchanged, on the box. A capturing `keydown` on the document ends a reading from elsewhere, and never clears the quadrant from there (difference 32) |
| The tooltip | Unchanged rows, placed with `tipAt` |
| The line of text | The same sentence in a `div.sr` (difference 31) |
| The reading is an index | It is the session's id: newer data keeps it on its session, and it ends when the session leaves the map or the view changes (difference 4) |
| The hand over the plot | A class on the box while the pointer is in the plot, with an important `cursor` rule: zrender writes its own cursor inline on each move |
| The legend, the count line, the quadrant buttons, their lists, the table, the empty state | Unchanged HTML |

The option sets `animation: false` in every mode: a dot sliding in would read as a session changing.

Why not register `ScatterChart`: +1.8 kB (S7) for dots a custom series draws with what is registered, and the ring on a compacted session would still be a second series. Why not the mark components for the two lines: +5.6 kB, and their labels would still need the halo and the side rule by hand.

The form is the quadrant's on purpose: a custom series of circles, a guides series, `outerBoundsMode: "none"`, a pure fit that owns the pixels, `points={0}`. The two charts share no code yet, since the quadrant is not on main.

### 10. Zoom

| Chart | Zoom | Why |
|---|---|---|
| Cache | Yes, from `ZOOM_FROM` (14) slots down to `MIN_SHOWN` (7), by day and by week | A view holds up to 60 daily slots, or a week per slot with no upper limit. Bars over time, as on Cost, Activity and Errors: the same rules apply as they are (S5) |
| Growth | No | A curve of at most 100 turns, read whole: its shape from the first turn is the figure. A slider works on turn slots (S5), but it would add 28px for nothing to find |
| Weekly start | No | A 180px line chart of weeks. The outcome trend, the nearest chart, has none either |
| Session map | No | The map has no slots |

The cache chart's zoom, by the rules of the foundation (decision 8) and the Errors design (decision 7):

- The model's `zoom` is `slots >= 14`. The slider's faint trend is what the bars draw, the waste or the prompt tokens: `sliderTrend(totals, trackAxes(2))`, listed before the ratio line, on the first track that holds a line (S5).
- The three tracks keep the whole view's scales while zoomed.
- "Show all days" or "Show all weeks" from `useZoomReset()`, at the end of the legend row.
- The label gains "Plus and minus zoom." only in views that show the slider.
- The "Cache reads" toggle keeps the window (decision 11).
- Status wording, as on Errors: "Showing Oct 11 to Oct 20, 10 of 30 days." and "Showing all 30 days."; by week "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks." and "Showing all 20 weeks.". An empty slot counts as its day or week.
- The data table lists every bucket, zoomed or not.

### 11. `view` identity and point keys

Another change, `echart-point-keys`, adds a wrapper prop, expected as `pointKeys?: readonly string[]`: within one `view`, the reading and the zoom follow their points by key when newer data moves the indexes. With it, a chart no longer puts its first point in its `view` key. It is not merged. The steps that pass `view` and `pointKeys` to a reading wrapper (2.2, 2.3, 2.4) wait for it, and take the prop's name, type and rules from the merged code, not from this section.

The page's key: `ContextPage.tsx` builds `[d.project, d.range, d.automated, d.source].join("|")` from the payload on screen, not from the URL, so a view still shown while the next one loads keeps its key. `sections.tsx` passes it to each chart as the prop `view`.

| Chart | `view` | Point keys | Not in the key |
|---|---|---|---|
| Cache | The page's key, and the bucket (`day` or `week`) | Each slot's first day | The "Cache reads" toggle; the first slot; the figures |
| Growth | The page's key, and the measure (`tokens` or `share`) | Each point's turn | The isolated project; the figures |
| Weekly start | The page's key | Each slot's week | The first week; the figures |
| Session map | The page's key, to the wrapper; the map's own reading resets on it | The session's id, in the map's own reading; no `pointKeys` to the wrapper, which reads nothing | The selected quadrant |

- The bucket is in the cache chart's key: a view that turns 60 days old changes days into weeks, which are other points.
- The toggle and the isolated project redraw the same view: the reading and the zoom stay, and a reading a key made is said again when its words change (the wrapper's rule).
- A turn's index is always its number less one, so the growth chart's keys never move a point. They are passed all the same: one rule for the three charts.
- No model module builds a view key or a list of point keys: the swap steps do, from `model.slots`. So the models can be built before `echart-point-keys` merges.

### 12. Shared chart files and the fake runtime

No shared chart file changes: not `EChart.tsx`, `option.ts`, `stack.ts`, `tokens.ts`, `testing.ts`, `zoomReset.tsx`, `realTesting.ts` or `echarts.ts`.

What the fake runtime must model for the new shapes: nothing new. Each shape, and why:

| Shape | What the fake does with it | What hides behind it, and where it is seen |
|---|---|---|
| A value x axis | Not used: turns are category slots (decision 3) | — |
| Points placed by time | Calendar slots are category points; an empty slot is a point like any other, and the fake reads its index | Whether an empty slot's band is drawn on the slot: S2, the real tests, `chartfit` |
| A band between two series | The fake draws nothing | Whether the polygon follows the points, breaks at a gap and spans a lone week: the pure tests with a stubbed `api`, the real tests |
| A line across the plot | The fake draws nothing | Its place and its label's side: the real tests, `chartfit` |
| A log axis | The fake never converts on it: with `points={0}` the wrapper asks for no pixel, and the map reads from its own fit. The fake's one grid takes the option, which has one grid | Whether ECharts' pixel is the fit's: the real test compares a drawn dot's centre with the fit; `chartfit` reads a dot under the pointer |
| Scatter picking | Not the fake's: `dotAt` is tested on the pure module, and the component test fires DOM pointer events on the box at the fit's pixels (jsdom's box is at 0, 0 and 800px wide) | Whether the box's origin is the drawing's in a laid-out page: `chartfit` |
| Two grids for the growth chart | Already so: the fake's one grid is the frame, and it refuses a grid without `outerBoundsMode: "none"` | The strip under the curve: the real test |
| The slider on three tracks | Already so: `zoomAxes`, `sliderShadowOf`, the minimum window | Three tracks zoomed together: the real test |

If a step finds that a helper must go in `option.ts`, or that the fake must model something after all, it stops and reports. That work is then a separate small step after `echart-point-keys` merges, with the `chartfit` lines of Cost, Activity, Judgments and Errors shown byte-identical before and after.

### 13. Colors and tokens

- The cache breaks' colors become two tokens in `theme.css`, since only a token declared there as a hex color may go through `env.color`, and the probe sits outside `.pg-context .cache-chart`:
  - `--cache-switch: light-dark(#14835c, #199e70)`: today's `color-mix(in srgb, var(--series-3) 75%, #000)` worked out (three quarters of `#1baf7a`), and `--series-3`'s dark value.
  - `--cache-expired: light-dark(#8a5a00, #d99a1e)`: `--warning-text`'s light value and `--warning`'s dark value.
- The other colors are tokens that exist: `--accent`, `--series-1`, `--track`, `--text-muted`, `--text-primary`, `--surface-2`, and the project colors of `colors.ts`.
- `CacheChart.css` then sets its legend swatches from the two tokens, and its `#000` leaves `css.test.ts`'s `RAW_COLORS` (step 3.4).
- Each model's test checks that every color it hands to `env.color` is declared in `theme.css` as a color, as `rateTracks.test.ts` does.

### 14. Keyboard, speech and the display modes, per chart

| | Cache | Growth | Weekly start | Session map |
|---|---|---|---|---|
| Keyboard | The wrapper: arrows, Home, End, Escape, plus and minus | The wrapper | The wrapper | The map's own handler: arrows, Home, End, Enter, Escape |
| Speech | The group's label; the wrapper's live region says `read(i)` and the zoom's sentence | Label; `read(i)` | Label; `read(i)` | Label; the map's own polite region says the dot's sentence |
| Sighted reading | Tooltip | Tooltip (new) | Tooltip (new) | Tooltip and the ring |
| Dark | The environment's colors; a theme or system change redraws | The same | The same | The same; the ring is CSS in `--text-primary` |
| Forced colors | Parts keep their fills in a text-colored edge; the ratio line, labels and titles in the text color; the band highlight-colored | The median in the text color, project lines on a page-colored halo, the band the text color at 16% | As growth; a hollow dot is page-colored in a text-colored ring | Dots keep their project color in a text-colored edge; rings, lines and names in the text color; the selected quadrant a highlight frame; the ring around the dot read highlight-colored |
| Reduced motion | No growth, no draw-in (the wrapper) | The same | The same | Never animated |
| A 343px box | `fitTitle` shortens the titles; ECharts thins the labels; the newest label inside the plot | The strip's title shortens; turn labels thin | Week labels thin | Names wrap (`fitLines`); the "80% of window" label changes side; overlapping ticks hide; the tooltip stays in the box |
| 32px text | Margins and gaps double, the tracks keep 180, 48 and 44px, the box is 456px | The curve keeps 218px, the box is 364px | The plot keeps 144px, the box is 216px | The plot keeps 260px, the box is 380px |

Value labels stay inside the 52px margin (times the text scale): the longest are "120k", "100%" and "45k". The map's left margin also holds the rotated axis title, as today.

Known limit, as today: a dot outside the selected quadrant is drawn at 20%, which is faint under forced colors. The quadrant's list names its sessions.

### 15. Files

| File | What |
|---|---|
| `web/src/pages/context/chartParts.ts`, `chartParts.test.ts` | Decision 5 |
| `web/src/pages/context/cacheTracks.ts`, `cacheTracks.test.ts` | The cache chart's model, layout and option |
| `web/src/pages/context/growthCurves.ts`, `growthCurves.test.ts` | The growth chart's |
| `web/src/pages/context/startWeeks.ts`, `startWeeks.test.ts` | The weekly start chart's |
| `web/src/pages/context/mapDots.ts`, `mapDots.test.ts` | The map's model, fit, picking and option |
| `web/src/pages/context/CacheChart.real.test.tsx`, `GrowthChart.real.test.tsx`, `StartTrend.real.test.tsx`, `SessionMap.real.test.tsx` | One smoke test each on real ECharts |
| `tools/demo/chartfit/context.mjs` | The browser check's module for the page |

No new name matches an existing file's name in another case: `cacheChart.ts`, `growthChart.ts`, `startTrend.ts` and `sessionMap.ts` would clash with the components on a case-insensitive file system.

### 16. Tests

| Layer | What it proves |
|---|---|
| `chartParts.test.ts` | The slots by day and by week; the band's polygon for a run, its breaks, its span for a lone slot, through `renderItem` with a stubbed `api`; the line's place and its label over or under it; the title's three forms by a stubbed measure |
| `cacheTracks.test.ts` | The kinds and values with reads off and on, both scales, the ratio's floor, `null` at an empty slot, the three titles' forms, the edge series only with reads on and not in forced colors, the trend before the ratio line on its axes, the layout at scale 1 and 2 and with the slider, the zoom flag and words, every color declared in `theme.css` |
| `growthCurves.test.ts` | The slots and the label rule, both measures' scales, the band's owner, each project's line with its width and its nulls, the halo, the 80% line only in share mode, the strip's values and title, the layout, every color declared |
| `startWeeks.test.ts` | The slots across a gap, the runs, the hollow weeks, the 30k line only when the axis reaches it, the scale, the layout, every color declared |
| `mapDots.test.ts` | The log scale's tests, moved; the fit's pixels for a known point, the quadrant's place, the names' wrap by a stubbed measure, the label's side; `dotAt` inside and outside 12px and between two dots; `quadAtPixel` in each corner; the option's axes, ticks and grid; the dots' and rings' styles, dimmed and in forced colors, through `renderItem` |
| The four component tests | What a user reaches, on the fake: the label, a reading by key and by pointer, the tooltip, the empty slot's words, the toggle, the switch, the isolation, the zoom's button and words, the map's Enter, click, quadrant and Escape, the tables, the empty states |
| The four real tests | Real ECharts in jsdom: decision 12's right column |
| `tools/demo/chartfit/context.mjs` | A real browser: decision 17 |

**What happens to the SVG charts' tests.** Each file is rewritten, not added to.

| File today | Fate |
|---|---|
| `CacheChart.test.tsx` (208 lines) | The `cacheSlots` and `ratioFloor` tests move to `chartParts.test.ts` and `cacheTracks.test.ts`. The bars, the scale, the titles, the ratio track, the missing slot and the broken line move to `cacheTracks.test.ts`. "marks the bucket being read by an outline" is deleted: the band is the wrapper's. The two stack tests are deleted: `stack.test.ts` owns the rule. "skips empty slots with the arrow keys" becomes "reads an empty day as no request". Kept on the fake: the toggle, the reading and its sentence, the label, the pointer, the weeks' words, the table, the empty state. Added: the zoom, in the test that builds a long view |
| `GrowthChart.test.tsx` (177 lines) | The curve, the band, the strip, the 80% line and the one-point curve move to `growthCurves.test.ts`. The modified-keys test is deleted: the wrapper owns it. Kept on the fake: the label, the reading by key and by pointer with the tooltip, the table, the share switch, the isolation and its restore, the cleared isolation on a switch |
| `StartTrend.test.tsx` (102 lines) | The placement, the band, the broken line and the span move to `startWeeks.test.ts`. The modified-keys test is deleted. Kept on the fake: the reading of a week of 2 sessions, the keys, the pointer, the table, the single week. Added to the keys' test: the empty week's sentence |
| `SessionMap.test.tsx` (227 lines) | The log scale, the placement, the clamp at 100%, the rings and the wrap move to `mapDots.test.ts`. Kept, with DOM events on the box at the fit's pixels: the count line, the keys and Escape, Enter and a click near a dot, the table's row, the names, the quadrant list, the quadrant by keyboard and by click, Clear's focus, the empty state |
| `ContextPage.test.tsx` | One line: the count of `#growth path.curve.proj` becomes the count of the legend's project buttons |

**The 400-line advisory.** Estimate: about 1,100 net test lines. Added: `chartParts.test.ts` 110, `cacheTracks.test.ts` 230, `growthCurves.test.ts` 170, `startWeeks.test.ts` 110, `mapDots.test.ts` 200, the four real tests 450. Removed: about 170 net from the four component tests (714 lines today, about 545 after). The net is over the advisory 400, and the pull request says so, with the reason: four charts each go from one test layer to three (the pure model and option, the component on the fake runtime, real ECharts in jsdom), at about 275 net lines a chart, where Errors' one chart was 778. Offsets: every geometry assertion leaves the component tests, five tests of rules the wrapper or the stack own are deleted (the outline on the bucket read, the two stack tests, the two modified-keys tests), and no shared file's test grows.

**Guards no test can turn red.** `outerBoundsMode: "none"` on the cache and growth charts' grids: `tracksOption` sets it and the fake refuses a grid without it. The band's and the line's `emphasisDisabled`: nothing asks for a highlight (`categoryAxis` turns the pointer's off, and the map has no axis pointer, S4).

### 17. The browser check

`tools/demo/chartfit/context.mjs`, named in the runner: `node chartfit.mjs [cost] [activity] [judgments] [errors] [context]`. It runs the shared checks of `checks.mjs` for the cache chart (`/context?range=30&tab=cache`, root `.cache-chart`), the growth chart (`&tab=growth`, root `.growth`) and the weekly start chart (`/context?range=30`, root `.start-trend`), each from its descriptor, in a 1440px window, in the `PHONE` window and at 32px text. Then its own lines. The pointer is aimed only after `document.fonts.ready`: a font that swaps in moves the chart (the Errors change measured 27px).

The lines it must hold, each first shown to fail on a chart without the thing it reads:

**Cache.**

- One band from the top of the bars to the bottom of the ratio track, for the pointer in each track and in each gap, and for Right, Home and End. The pointer over the bucket labels reads nothing.
- With a payload changed to leave a day out: the band sits on the empty slot, the tooltip says "No request", the live region says the sentence once, and no bar, break or ratio point is drawn there; the ratio line does not cross it.
- The parts are the legend's colors in light and dark; the two break colors are `--cache-switch` and `--cache-expired`. "Cache reads" adds a third part with its 1px edge, the axis rescales, the title reads "Prompt tokens", and the toggle is pressed.
- A ratio point sits over the middle of its bucket's bar, zoomed and not.
- Zoom: the slider shows from 14 slots and not at 13; plus stops at 7; a real drag moves the three tracks together; the live region says the days shown once; "Show all days" resets and returns the focus; the URL, the requests and the data table are unchanged; "Cache reads" keeps the window; by week the words name weeks.
- With `SHOTS=<dir>` and by reading its points: the slider's faint trend follows the bars' totals, not the ratio.
- In the `PHONE` window: each title ends inside the plot, in its short form or cut with "…"; the newest bucket's label ends inside the plot.
- At 32px text: the box is 456px (484px with the slider), each track as tall as at 16px, no label cut or overlapping.
- Under forced colors: each part keeps its fill in a `CanvasText` edge, the ratio line is `CanvasText`, the band is `Highlight`, every stroke is a system color.

**Growth.**

- One band over the curve and the strip, for the pointer in each and in the gap, and for the keys; the tooltip names the turn, the median and each project.
- A strip bar sits under the middle of its turn's point on the curve.
- The band's fill covers from the 25th to the 75th percentile at three turns, read from the polygon.
- "Share of window": a dashed line at 80% with its label inside the plot, the axis in percent, and the reading ended. Isolating a project: one project line, thicker, its band in its color, and the reading kept.
- The turn labels are 1, the round turns and the last turn, with none overlapping.
- In the `PHONE` window and at 32px text: the curve track is 218px, the strip's title ends inside the plot, no label is cut.
- Under forced colors: the median is `CanvasText`, each project line keeps its color over a `Canvas` halo.

**Weekly start.**

- With a payload changed to hold a gap and a lone week: two band polygons and one span, the line in three parts, the lone week's dot, the hollow dot for a week of 2 sessions; the band on the empty week says "no session started".
- The 30k line is dashed with its label inside the plot, also at 32px text.
- At 32px text the plot is 144px and the box 216px.

**Session map.**

- A drawn dot's centre is within 1px of where the map's reading puts it: the pointer on a dot's centre reads that session, and 13px away from every dot reads nothing. Checked in the 1440px window, in the `PHONE` window, at 32px text, and after the page scrolls.
- Right reads the oldest session; the ring is centred on its dot; the tooltip names it; Enter opens its sheet, and closing the sheet returns the focus.
- A click on a dot opens its sheet. A click in the top right, away from any dot, selects "Heavy and full": the wash is drawn there, the other dots are at 20%, the bars above narrow, and the list shows. A second click clears it.
- One Escape on the map ends the reading and clears the quadrant. Escape with the focus on another control closes a tooltip the pointer opened and leaves the quadrant.
- The x ticks are at 1, 2 and 5 times a power of ten, with no label overlapping; both axis titles are inside the box.
- A compacted session has a ring; with a payload of 1,000 sessions the first drawing and a quadrant's redraw each take under 100ms, printed.
- In the `PHONE` window: each quadrant's name is inside its quadrant, wrapped where needed; the "80% of window" label is inside the plot; the tooltip is inside the window.
- At 32px text: the plot is 260px, the box 380px.
- Under forced colors: the ring around the dot read is `Highlight`, a dot's edge and a compacted ring are `CanvasText`, the selected quadrant is a `Highlight` frame with no fill.
- Newer figures keep the reading on its session and say nothing.

Where the demo store lacks a case (an empty day, a gap of weeks, a lone week, a week of 2 sessions, 1,000 sessions), the check answers the request with the store's payload changed, as the other modules do.

`tools/demo/firstscreen.mjs` needs no change: Context's first plotted mark is the first range bar of "Starting context" (`#starting .rng-bar`), which is HTML and stays. The step runs it to show so. `tools/demo/record.mjs`'s `context` scene moves and clicks on `#pressure rect.hit`: it takes the map's box, `#pressure .session-map .echart`.

### 18. Bundle

- **ECharts chunk.** Nothing is added to `echarts.ts`. Expected: 176.5 kB, as now. The 195 kB limit stays. What each candidate would have cost is S7; none is needed.
- **Entry.** `ContextPage` is a lazy route. The 130 kB limit stays.
- **`ContextPage`.** New limit: **26 kB**. It is 19.4 kB at the base (S8). Four SVG charts leave and five modules come. Errors grew by 0.4 kB for one chart, Activity by 1.3 kB for two. Expected: 21 to 23 kB.
- **Shared chart chunk.** `zoomReset-*.js` is 7.1 kB of its 9 kB. A fourth page importing the chart modules can make Vite split or rename it (the quadrant thread saw an `EChart-*.js` chunk appear when the Project page imported the wrapper alone). The check then fails on "found 0", and step 3.5 renames or adds the entry and says so.
- `ContextPage.tsx` calls `preloadECharts()` at module load, as the other three pages do.
- The comment on the ECharts chunk names Context with Cost, Activity and Errors.

### 19. What this change removes, and what stays

Removed:

- From the four components: the SVG, the width observers of three of them, the pointer math, the key handlers of three of them, the tooltip placement of the cache chart, the visible readout lines, and their use of `dayAxis`, `scaleMargins`, `stackHeights` and `textScale`.
- Local helpers that die: `stack()`, `textWidth()`, `MIN_H`, `SEP` in `CacheChart.tsx`; the estimate inside `fitLines`.
- From `context.css`: `.pg-context .chart`, `.pg-context .chart svg`, `.pg-context .chart:focus-visible` (replaced by `.echart`'s rules), `.pg-context .readout`, and the three height rules for `.growth .chart svg`, `.start-trend .chart svg` and `.session-map .chart svg`.
- From `GrowthChart.css`: `.pg-context .growth .chart svg.growth-svg`.
- From `CacheChart.css`: the six `--cc-*` properties and the `color-mix()`, the six `.seg-*` fill rules for the SVG, `svg g.on .seg`, and in its forced-colors block the rules for `svg .seg`, `svg .seg-read`, `svg g.on .seg`, `svg .cursor`, `svg .ratio`, `svg .ratio-halo` and `svg .ratio-dot`. The six `i.seg-*` swatch rules stay, reading the tokens.
- From `SessionMap.css`: `.session-map .hit`, `.quad-label`, `.quad-label.on`, `.quad-on`, `.pt.out`, and the forced-colors rule for `.quad-on`.
- In `css.test.ts`: `"pages/context/CacheChart.css: #000"` leaves `RAW_COLORS`; `".pg-context .cache-chart svg .seg"` leaves the forced-colors test's `required` list, since the stack's own edge replaces that rule (the real test and `chartfit` hold it); any allow-list value the test then reports as unused. Nothing is added to an allow-list, and `PAGE_GATES` does not change.
- `theme.test.ts`: nothing. It asserts no Context chart rule.

Stays:

- In `chart.ts`: everything. `dayAxis` and `peakLabelAt` lose their last chart but `option.test.ts` and `chart.test.ts` use them; `useWidth` and `tipAt` serve the map, Limits and Live; `scaleMargins` and `stackHeights` serve other charts.
- In `context.css`: the legend, `.axis-note`, `.caption` and the tooltip row rules.
- In `theme.css`: the forced-colors rules for the pressed growth legend button, the pressed toggle and `.pg-context .legend i:not(.line)`.
- `PressureBars.tsx`, its CSS and its tests, untouched.

### 20. Docs and images

- `CHANGELOG.md`, `[Unreleased]`, in the short-bullet style the section has. Under Added: "Context's cache chart zooms in views of 14 days or weeks or more, with a slider or the plus and minus keys.", beside the bullet like it. Under Changed, a "Context:" list: the charts use the shared chart component; the cache and weekly start charts read a day or week with no data; the growth and weekly start charts show a tooltip; the reading stays on its point when new data lands; the weekly start chart and the session map keep their plot's height at larger text sizes.
- `README.md`: one sentence on the cache chart's zoom in the Context row.
- Docs site, written with the `doc-coauthoring` skill: `pages/context.mdx` (the four charts' sections) and `everywhere/keyboard-screen-reader.md` (the plus and minus rows name the cache chart; the map's keys are unchanged).
- Shots, by `node tools/demo/record.mjs shots context` only, in dark and light: `context-starting`, `context-growth`, `context-pressure`, `context-cost`. `site/src/assets/shots/README.md` updates the `context-cost` row to name the zoom slider when the shot shows it. No shot is added.
- README recordings: the `context` and `tour` scenes (`docs/context*.gif`, `docs/tour*.gif`, `docs/tour*.mp4`).
- Context has no `PARITY.md`: none is added.

## Needs the owner

**Wrapper contract.** Nothing in this change needs a wrapper contract change. Two designs are here for the owner, each tied to a default below. Neither is built in this change.

*W1: `skip`, if the owner flips F1 (empty slots are skipped, as today).* A Fable step on `EChart.tsx` and `EChart.test.tsx`, after `echart-point-keys` merges.

```tsx
/** Points the reading passes over: `skip(i)` is true for a point with nothing to read, such as a day with no request.
 *  An arrow key reads the next point in its direction that is not skipped, and stays where it is when there is none.
 *  Home and End read the first and the last such point; the first Right reads the first such point, the first Left the
 *  last. The pointer over a skipped point reads nothing, as outside the grid, and a click there activates nothing.
 *  The zoom counts every point, skipped or not. A reading on a point that newer data makes skipped ends, as on a point
 *  that is gone. Without it every point is read. */
skip?: (i: number) => boolean;
```

- With every point skipped, no key reads anything and none is prevented.
- The band, the tooltip and the zoom's "move to include the point read" follow the point read, as now.
- The fake runtime models nothing new: the rule is the wrapper's own arithmetic on indexes, and the fake already answers a pixel for every point.
- Users: the cache chart and the weekly start chart. Their `read` and `tip` then never see an empty slot.

*W2: `locate`, a later change, for the map and the Project page's quadrant together.* Once both are on main, one change can move both readings into the wrapper and delete two copies. The foundation reserved `locate={{ by: "item", series, at }}` and `onMiss(dataCoords)`; both charts since measured that the pixels must come from the chart's own layout, so the reading works before the chunk loads. The shape that fits them:

```tsx
/** Where the points are, for a chart that does not place them on the bands of its first x axis, such as a scatter.
 *  `at(i)` is point i's place in px from the box's top left, from the chart's own layout; its option must draw the
 *  point there (a grid with `outerBoundsMode: "none"`). The pointer reads the nearest point within `within` px (12 by
 *  default), in both directions. The keys step in index order. The tooltip goes beside the point, and a ring `ring` px
 *  in radius marks it in place of the band. Without it the points are the bands. */
locate?: { at: (i: number) => { x: number; y: number }; within?: number; ring?: number };
/** A click inside the grid that is on no point, with its place in px from the box's top left. Only with `locate`. */
onMiss?: (at: { x: number; y: number }) => void;
```

- The fake must then model only what it has: `containPixel` on its one grid, which a test sets to the chart's plot. It converts nothing on a log axis.
- `pointKeys` would be the sessions' ids.

**Bundle.** No limit needs raising. The numbers, for the record (S7): the chunk is 176.5 kB of 195 kB; `ScatterChart` would add 1.8 kB, `MarkLineComponent` 5.6 kB, `MarkAreaComponent` 3.1 kB, both mark components 6.9 kB, all three 8.7 kB; the log axis and custom series add nothing. Recommended: add none. The new `ContextPage` limit is 26 kB, over a chunk of 19.4 kB today and 21 to 23 kB expected.

**Two color tokens in `theme.css`** (decision 13): `--cache-switch` and `--cache-expired`. They hold today's colors.

**Other threads.**

- `echart-point-keys` owns `EChart.tsx` and `testing.ts` until it merges. This change edits neither. Steps 2.2, 2.3 and 2.4 wait for it. Both changes modify `dashboard-app` requirements: the one that archives second takes the other's text as its base.
- The quadrant thread (`graph-project-quadrant`) edits `web/scripts/check-bundle.mjs`, `tools/demo/chartfit.mjs` and the docs site's keyboard page too. Whoever merges second resolves small conflicts there.

## Defaults the owner may flip

Each is a choice where today's chart gives no answer, or where the pattern and today's behavior pull apart. Flipping one changes the lines named, and nothing else.

| # | Default chosen | The other way | What flips |
|---|---|---|---|
| F1 | An empty day or week is read, on the cache and weekly start charts | The keys and the pointer skip it, as today | W1, a Fable step on the wrapper; decision 4, differences 8 and 25, one spec requirement |
| F2 | The cache chart zooms, by day and by week, from 14 slots | No zoom | Decision 10, difference 7, two spec requirements, the zoom lines of steps 1.2, 2.2 and 4.2 |
| F3 | The growth and weekly start charts do not zoom | A slider from 14 points, as it works on slots (S5) | Decision 10; 28px more on each box |
| F4 | A track's figure follows its title after a middle dot | Right-aligned at the plot's edge, as today, by one more local custom series per track | Decisions 5 and 6, difference 9 |
| F5 | A dot only on a hollow or lone point (`lineDots`) | A dot on every point, as today, by a local series | Decisions 6 and 8, differences 10 and 26 |
| F6 | The cache bars follow the shared stack's rule: 1px parts, 2px gaps | Today's 2px parts and 1px gaps, by a local stack series | Decision 6, difference 11, one spec requirement |
| F7 | The map reads by itself around the wrapper | A wrapper `locate` contract now | W2; steps 1.5, 2.5, 3.3 and 4.4 become a second change |
| F8 | The map's line of text is for screen readers only | It stays visible, as today | One class in `SessionMap.tsx`; difference 31 |
| F9 | Turns and weeks are bands, half a band inside the plot at each end | Points on the plot's edges, by axes built beside `tracksOption` | Decision 3, differences 18 and 27 |
| F10 | The slider's faint trend is what the bars draw | The cache-hit ratio | One line in `cacheOption` |
| F11 | The weekly start chart and the map grow with the text | Fixed boxes of 180 and 320px, as today, with the plots shrinking | Decisions 8 and 9, differences 28 and 30 |
| F12 | The window pressure bars stay HTML | Drawn by the shared component | A new group of steps, and a reading designed for segments |

## What later changes inherit

A chart whose points are whole steps with no gaps (turns) or steps of a calendar (days, weeks) puts them on category slots, and the wrapper reads them as it is; a slot with no data is a point that says so. A band between two series is `bandSeries`, one polygon per run of slots and a span for a lone slot; a line across the plot with its label is `thresholdLine`; a track title with a figure is `fitTitle` into `axisTitle`. All three are in `web/src/pages/context/chartParts.ts`: the second page that needs one moves it to `option.ts` in its own change. A scatter is a custom series of circles on a grid given as left, top, width and height with `outerBoundsMode: "none"`, over a pure fit that owns every pixel; the wrapper draws it with `points={0}` and the chart reads from the fit, so the reading works before the chunk loads. A log axis takes its ticks from `customValues`. A line that only its color tells apart keeps its color after `lineSeries`, over a page-colored halo in forced colors.

For the next builders: Limits needs a time axis whose points are not steps of a calendar, so it needs `locate` or slots of its own; its band and its plan-change line can take `bandSeries` and `thresholdLine`. The session sheets' timeline has thousands of ticks: measure a custom series against the map's 1,000 dots first. The map and the Project page's quadrant are two copies of one reading: W2 is the change that joins them.

## Risks / Trade-offs

- **The map's reading and the drawing disagree.** The fit computes the pixels, and ECharts draws them. → `outerBoundsMode: "none"` with the grid given whole makes them equal within 1e-12px (S4); the real test compares a drawn dot with the fit; `chartfit` reads a dot under the pointer at four sizes and after a scroll.
- **The fake hides a chart that draws nothing.** The component tests run on the fake, which draws nothing, and the map's wrapper is told nothing at all. → One real test per chart; `chartfit` for each.
- **`renderItem` tested with a stubbed `api`.** A wrong use of `api.coord` or `params.coordSys` in the band, the line, the guides or the dots passes the pure tests. → The real tests read the drawn paths; steps 1.1, 1.2 and 1.5 are marked risky.
- **`echart-point-keys` lands with another shape.** → No model builds a key; the three swaps wait, and read the merged contract.
- **A long gap is many key presses** on the cache and weekly start charts. → Home, End and the pointer; F1 is the flip.
- **Text measures differ between jsdom and a browser.** → The fit rules are tested with a stubbed measure, and in Chromium at 343px and at 32px text.
- **The newest bucket label at 343px.** jsdom did not draw it (S6), though the shared helper asks for it and Errors' browser check holds it. → `chartfit`'s `PHONE` line for the cache chart.
- **1,000 dots in SVG.** Today's map is the same count of SVG nodes; jsdom drew them in under 20ms (S4). → `chartfit` prints the time in Chromium; over 100ms, the step reports and the owner decides on the canvas renderer for this chart.
- **More test lines than the advisory.** → Decision 16 says why and what offsets them.
- **The slider is not keyboard-operable by itself.** → Plus, minus and "Show all" cover it, as on the other three pages.
- **Known limit: no zoom on turns.** A phone's 2.8px bands on a curve of 100 turns are hard to hit with a finger, as today's nearest-turn reading is. F3 is the flip.
- **Known limit: a dimmed dot under forced colors** is faint (decision 14).

## Migration Plan

1. Land the local parts and the four models (group 1). No chart changes: the components import what moved.
2. Land the page wiring and the map's swap. When `echart-point-keys` has merged and main is in, land the three other swaps (group 2).
3. Land the real tests, the removal, the budget and the docs (group 3).
4. Land the browser steps one at a time, then the final step (group 4).
5. Rollback: revert a chart's swap commit. The removal step comes after every swap, so until it lands a revert needs nothing else.

## Open Questions

- Whether a long run of empty weeks should fold into one point, as Errors folds idle stretches. This design reads each week.
- Whether the map and the quadrant should share one reading now or after both merge. This design waits (W2).
- Whether the value axes should rescale to the points shown once a free time range exists. This change keeps the view's scales, as Cost, Activity and Errors do.
