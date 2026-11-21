# Design

## Context

See `proposal.md` for the motivation. `echart-foundation` (archived under `openspec/changes/archive/2026-11-21-echart-foundation/`) holds the wrapper's contract; its `design.md` is true to the code. "The foundation" below means that design. This section holds only what shapes this change.

**The two charts today.**

- `WorkChart.tsx`: one SVG of 216px. Bars per day or week (stacked by project, or plain), and under them a rate track of 36px with its own scale. One band, one tooltip and one live sentence cover both tracks and the 16px between them. A click, or Enter on the bar read, selects a busy day or week; the selection is in the URL, on a chip, and drawn as an accent wash across both tracks. Escape ends the reading, then clears the selection. The live region also says what a selection or a clear did.
- `OutcomeTrend.tsx`: one SVG of 240px. One 100% bar per week (2 to 26), stacked by outcome, half width for a week of fewer than 5 sessions, with the week's session count over it. No selection.

**Constraints.**

- The wrapper reads one category x axis: `points` is "one per band of the option's first x axis", and the band, the pointer and the keys use `{ gridIndex: 0 }` and `{ xAxisIndex: 0 }`.
- At 1440×900 the work chart must start, and the workbench tab list must end, in the first 900px (`dashboard-app`, "Show the main chart in the first screen").
- `web/src/css.test.ts` lets allow-lists shrink only.
- `openspec validate --strict` rejects a requirement text over 500 characters.

**What a spike measured** (ECharts 6.1.0; jsdom with the SVG renderer, and Chromium headless on a static page and on the demo store; the spike is deleted). Each decision cites the result it rests on.

| Question | Result |
|---|---|
| Two grids with `axisPointer.link` and `triggerOn: "none"`: what does one `updateAxisPointer` action draw? | Two bands, one per grid, with the space between the grids unmarked. An action whose `y` is between the grids draws no band. `containPixel({ gridIndex: 0 })` is false there. |
| One grid over both tracks (a frame), holding the only axis with a pointer? | One band from the top of the first track to the bottom of the last. `containPixel({ gridIndex: 0 })` is true on both tracks and between them, false under and above. `convertToPixel` gives one x for a point on the frame's axis and on each track's axis. In Chromium a pointer in the bars, between the tracks and in the rate track reads the same point and draws the same band. |
| A slider with no `xAxisIndex`, over three x axes? | It zooms the first x axis and every other x axis in that axis's grid. On three grids that is the frame alone: the frame's points move and the tracks' do not. On one grid with a second x axis (the outcome trend's counts) both move. |
| A slider with `xAxisIndex: "all"`, or `[0, 1, 2]`? | Every axis shows the same window. `getOption().dataZoom[0]` gives `startValue` and `endValue` as point indexes, as with one axis. A silent `dataZoom` action sends no event, a plain one sends one. A real drag of a handle in Chromium sent one `datazoom` per move and moved all three axes together. A redraw under `replaceMerge` keeps the window. |
| A custom series on the frame, one item at the selected point? | Drawn as one rectangle over the frame's whole height, after the grid lines and before the bars (`z: 1`). With the point outside the zoom window it is not drawn; back inside, it is. |
| A line series with `symbol: "none"` and a symbol on single data items? | Only those items draw a symbol, with their own size, fill and border. `connectNulls: false` breaks the line at a null. |
| `axisLabel.verticalAlignMaxLabel: "top"` on a value axis of two ticks? | The top label hangs under its line. The lower label is unchanged. |
| Which series does the slider's faint trend draw? | The first `line`, `bar`, `candlestick` or `scatter` series on an axis it drives; a custom series never. With the rate line alone, the trend is the error rate. With a hidden line of the bars' totals listed before it, the trend is the totals. A later check (jsdom): the axis comes first, so a line on the first track wins over a totals line listed before it on the second. |
| A redraw that drops a track (one grid, two axes and a series less)? | No error. `getOption()` then holds `null` in the dropped series' place. The frame takes its new height. Adding the track back works. |
| A second x axis on the top of a grid, labels from a formatter? | Drawn, and thinned by ECharts: 26 of 26 counts at 800px, 9 of 26 at 254px. |
| Where do Activity's chart and tab list sit at 1440×900 on the demo store? | Chart 408 to 624px. Tab list ends at 842px (30 days, 29 bars) and 839px (all time, 11 weeks). 58px are free. |
| How big is `ActivityPage-*.js`? | 22.4 kB gzip -9. The entry is 109.1 kB and the ECharts chunk 176.5 kB at this change's base. |
| Three grids left to ECharts 6's own fit (`outerBoundsMode` unset), 11 weeks in a 343px box? (measured while building, in jsdom and Chromium) | ECharts shrinks only a grid whose axis labels would leave the box: the frame, the one grid with visible x labels. The frame's newest point is at 301.4px and the tracks' at 314.5px, so the band, the selection and the pointer's reading leave the bars by half a band. With `outerBoundsMode: "none"` on every grid the points agree. In Chromium the newest label right-aligned on its point is enough by itself to stop the shrink; jsdom's measures needed the grid setting. |

## Goals / Non-Goals

**Goals:**

- A multi-track pattern that Errors (two tracks), Context's cache chart (three tracks), Growth's strip and the session timeline's strip can copy without a wrapper change.
- Keep every behavior of the two charts, and list every difference a user can notice.
- Nothing new in the ECharts chunk.

**Non-Goals:**

- Migrating any other chart. Errors, Context, Limits, the sheets and Live keep their SVG and their CSS.
- The reserved wrapper props that Activity does not need: `locate`, `onMiss`, `keys`.
- A zoom on the outcome trend.
- Changing what a selection does to the tabs, the URL or the API.
- A legend that filters. Both legends stay static keys.

## Decisions

### 1. A frame grid over every track

A chart with two tracks or more draws `1 + n` grids:

| Index | Grid | x axis | y axis | Holds |
|---|---|---|---|---|
| 0 | The frame: from the top of the first track to the bottom of the last, at the tracks' left and right | The visible category axis: labels under the last track, and the only axis pointer | A hidden value axis, 0 to 1 | The reading band, the selection mark, anything that crosses the tracks |
| `t + 1` | Track `t` | A hidden category axis over the same labels, with no axis pointer | The track's value axis | The track's series |

Why: the wrapper already reads grid 0 and x axis 0. With the frame there, its pointer test, its pixel conversion, its band and its key tooltip are right for every track with no change, and the fake runtime's one grid is the frame. The spike shows one band over both tracks and the space between them, which is what the charts have today.

Alternative: one grid per track with `axisPointer.link`. Rejected by the spike: two bands with a hole between them, no reading in the hole, and the wrapper would need a track list to test the pointer against.

Rules that follow:

- Only the frame's x axis may set `axisPointer.show`. The wrapper sets `triggerOn: "none"` as before.
- The slider drives every x axis: `zoomSlider()` sets `xAxisIndex: "all"`, so no chart can forget it. With no `xAxisIndex`, ECharts drives the first x axis and every other x axis in its grid, which on a chart of several tracks is the frame alone. For a chart with one grid this is the same slider.
- Every grid of a chart of several tracks sets `outerBoundsMode: "none"`, so each sits exactly where the layout puts it. ECharts 6 otherwise fits each grid on its own and shrinks only the one whose labels would leave the box, the frame, which then leaves the tracks (spike: 11 weeks at 343px, newest point at 301.4px on the frame and 314.5px on the tracks). The layout keeps the labels inside instead: the left margin holds the value labels and half the first bucket label, and the frame's newest label is always shown, right-aligned on its point, so it ends inside the plot; labels it overlaps are hidden. In a browser the label's alignment alone stops the shrink; the grid setting stays because jsdom's measures needed it. The fake runtime refuses an option of two grids or more where one leaves it out. Later charts must keep their value labels inside their left margin: a wider label is clipped, not fitted.
- A series names its axes: `trackAxes(t)` gives `{ xAxisIndex: t + 1, yAxisIndex: t + 1 }`, and `FRAME_AXES` is `{ xAxisIndex: 0, yAxisIndex: 0 }`.
- A chart with one track needs no frame: its grid is grid 0. The outcome trend and Cost are such charts.
- The frame is a rule about indexes, not about category axes. A later chart on a value or time axis (Growth, the timeline) makes its frame the same way, and adds the foundation's reserved `locate` prop for its pointer.

### 2. Wrapper additions: `status` and `onEscape`

Both names were reserved by the foundation. Nothing else in `EChartProps` changes.

```tsx
/** A sentence the live region says once, when this changes to a new text that is not empty: what the last activation or
 *  Escape did ("… selected"). It takes the region as a zoom sentence does. A reading replaces it, and the end of that
 *  reading does not say it again. It is not said on mount, nor for a new view. An empty text drops a status the region holds. */
status?: string;
/** Escape on the focused box while nothing is read. Return true when it did something: the key is then prevented.
 *  Escape from anywhere else never calls it, and Escape with a reading open only ends the reading. */
onEscape?: () => boolean | void;
```

- `status` is a prop and not a method on the handle. The work chart sets it inside `onActivate`, and the wrapper ends the reading right after the handler returns, which empties the region. A method called from the handler would be wiped by that. The wrapper compares the prop with the last one it saw, in render, as it does for `view`, so the sentence lands after the reading has ended.
- The live region then holds one of: a status, a reading, a zoom sentence, or a reading and then a zoom sentence.
- A chart that uses `status` must pass `view`. A status that arrives with a new view is not said, nor one present at mount. The same text twice says nothing, so a chart that wants a sentence said again words it differently. An empty text drops a status the region still holds, and leaves a reading or a zoom sentence alone.
- A new status that is not empty, arriving in the same render as a redraw's own sentence (a zoom that ended with no one asking, or a key's reading said again with newer figures), wins: it is said alone, in one change of the region. The zoom still ends and `onZoom(null)` still fires; only its sentence is not said. The status is what the user's own act did, and the draw effect, which finds an ended zoom after the status is in the region, cannot take the status back; the other order would change the region twice. A redraw's sentence in a later render replaces the status as ever. When an empty status that drops a held one arrives with a zoom end the draw effect finds, the region is emptied by the render and then says the zoom's end: two changes, the second the one heard.
- `onEscape` runs from the box's own `keydown` only. The document listener (Escape anywhere) keeps ending readings only, so Escape in a sheet never clears a selection.
- `points`' comment gains: in a chart of several tracks, the first x axis is the frame's.

### 3. Shared option helpers

All in `web/src/components/echart/option.ts` unless said, pure, and typed from `echarts.ts`.

- `trackLayout(textScale, { margin, tracks, gap, slider })`: the box's height and each grid's place. A track's height is `fixed + scaled × textScale`. Margins and the gap scale with the text. `slider` adds `SLIDER_ROOM`. It takes the text scale and not the environment because the component needs the height for `<EChart height>` before any environment exists. It returns `{ height, left, right, frame: { top, height }, tracks: { top, height }[] }`.
- `tracksOption(env, { layout, labels, format, y })`: the `grid`, `xAxis` and `yAxis` lists of decision 1, from a layout, the labels and one value axis per track.
- `trackAxes(t)` and `FRAME_AXES`.
- `selectionMark(env, { index })`: decision 4.
- `lineSeries(env, { id, data, color, ...axes })`: a line with no symbols, broken at nulls, not clipped, silent. Colors by decision 5.
- `lineDots(env, { id, data, color, hollow, ...axes })`: the line's dots, a custom series on its axes over it (`z: 3`), one item per point with a value. A point `hollow(i)` names gets a hollow dot. Any other point gets a solid dot when no line reaches it in the points shown: neither neighbour has a value or is shown. The dot is decided as it is drawn, for the zoom window of that moment. ECharts filters the points outside the window out of the line, so a point whose only neighbour is outside draws a move with no length and no symbol (measured: two days of calls, zoomed past the first). A neighbour is shown when the middle of its band is inside the plot. A symbol callback cannot decide this: it gets the point's value and index, not the window. Colors by decision 5.
- `sliderTrend(data, axes)`: a hidden line (`id: "trend"`, no symbol, line opacity 0, transparent). The slider draws its faint trend from the first line, bar, candlestick or scatter series on the lowest-index x axis it drives that carries one; the series' order counts only among the series on that axis (`SliderZoomView._prepareDataShadowInfo`, ECharts 6.1.0). So the trend line goes on the first track that has a line, listed before that track's lines, with no line on an axis before it: on the work chart, on the bars' track, over the rate line's track. The fake runtime throws when the slider would draw another series, by the same rule (`sliderShadowOf` in `testing.ts`).
- `zoomSlider(env)`: gains `xAxisIndex: "all"` (decision 1).
- `pointLabel` (the peak label) measures its text as zrender does, with `measureText` on a canvas of its own, so `option.ts` imports nothing from ECharts at runtime; jsdom has no canvas, and there it estimates 0.6em a character. `labelAnchor` keeps the old anchor rule (centred over the bar, or anchored at the bar's edge within 56px times the text scale of the plot's edge), then slides the label along, its anchor kept, until its whole text is inside the plot. A plot narrower than the text draws no label. This replaces the rule "no peak label in a plot under 300px times the text scale at a larger text size", on the work chart and on Cost: at a larger text size a mid-width plot now shows the label. Known limits: the width is not measured again when the font loads after the first drawing, and the label's 3px halo may pass the plot's edge by 1.5px.
- `SLIDER_ROOM` (28) and `ZOOM_FROM` (14, `ZOOM_DAYS` in `costDaily.ts` today) move here from `costDaily.ts`, which imports them and still exports `SLIDER_ROOM`, so `CostChart.tsx` is not touched by this.
- `stack.ts`: `width` becomes `(band, i) => number`. The outcome trend halves the width of a week with few sessions.
- No highlight: the band alone shows the reading. By default ECharts' axis pointer highlights every item on the point read (`dispatchHighDownActually` in `axisTrigger.js`), and `silent` does not stop it, since it only mutes the pointer's own events. A highlighted custom series is redrawn in lifted colors that no token gives (`createEmphasisDefaultState`), and a line with no symbols gets a dot in ECharts' own palette (`LineView.highlight`). Measured on Cost and the outcome trend before this fix; on Cost, which shipped with it, the bar being read changed color and the 7-day average got dots in ECharts' palette. Two guards, each enough alone: `categoryAxis()` sets `axisPointer.triggerEmphasis: false`, so the frame's pointer (or a one-grid chart's) highlights nothing; and the shapes of `stackSeries()`, `selectionMark()` and `pointLabel()` set `emphasisDisabled: true`, so a highlight from any other source leaves them as drawn. A series-level `emphasis.disabled` would not do this for a custom series: there it only stops the blur of other series. Bars on a track's axis are never highlighted by the pointer in any case: ECharts highlights only the items on the axis that shows the pointer, the frame's, where only the selection mark sits.

Cost's `avgLine` stays as it is: a haloed text-colored line is another thing than a series-colored line with dots.

### 4. The selection mark

- **How a chart tells it.** The chart's model holds `selected: number | null`, the index of the selected point, and its option builder adds `selectionMark(env, { index })`. The wrapper has no prop for it. The selection is not part of `view`, so selecting redraws the same view: the reading and the zoom stay.
- **How it is drawn.** A custom series with `id: "selected"` on the frame, `z: 1` (over the grid lines, under the marks), one item, silent. Its rectangle is the point's whole band over the frame's height, inset by half the frame line. Theme: fill `ink.tint` (the accent at 16%), a 1.5px frame in `ink.accent`. Forced colors: no fill, a 2px frame in `ink.accent`, which is `Highlight` there.
- **Apart from the reading.** The reading band has no frame and sits over the marks: a neutral wash in the theme, a `Highlight` wash in forced colors. The frame is the selection in both modes, so the two differ by shape and not by hue alone. Both show on a point that is selected and read. Reading a point changes no color of what is drawn: the helpers turn ECharts' own highlight off (decision 3).
- **Zoom.** A selected point outside the points shown draws nothing (spike). The chip still names it. An index outside the axis draws nothing either: ECharts would place it by extrapolation, in a margin or off the box.
- **Words.** The chip names the selection, and `status` says a selection or a clear once. A bar's reading does not say "selected": it does not today. The work chart words its status from the selection it leaves:

| What happened | Status |
|---|---|
| A click or Enter selects a bar | "Week of Sep 7, 2026 selected; the tabs below show its days." (a day: "Nov 4, 2026 selected; the tabs below show its figures.") |
| The bar already selected is selected again | "… is still selected; …", and on the next such press "… is already selected; …", alternating, since the same text twice says nothing |
| The chip's ✕, or Escape on the chart with nothing read | "Selection cleared; the tabs below show the whole range." |
| The selection changes from outside the chart (the tab note's "Show the whole range", an attention action, a tile, the URL) | Nothing: the status empties, which drops a sentence the region still holds, so it is never said later out of context |

Alternative: a `selected` prop on the wrapper. Rejected: the wrapper would add a series to an option it does not own, for a mark that needs no React state. The peak label is drawn the same way, by the option.

### 5. Forced colors for a line

- A line that is the only line on its track is drawn in `ink.text` (`CanvasText`). Its color is not what tells it apart: its track and its legend key do. A theme color such as `--critical` has no sure contrast on the user's `Canvas`.
- A solid dot on it is `ink.text` with an `ink.surface` border. A hollow dot is `ink.surface` inside an `ink.text` ring, as the spec already asks of the work chart's hollow dot.
- `lineSeries()` and `lineDots()` do this from `env.forced`, so no chart writes it.
- The legend keys are HTML. The line key's border and the hollow key (`.legend i.low`, which keeps its rule in `theme.css`) already follow.
- Lines that only their colors tell apart (Growth's project medians) are not built here. They keep their colors, over a halo in `ink.surface`: see "What later changes inherit".

### 6. Zoom

| Chart | Zoom | Why |
|---|---|---|
| Work, by day | Yes, from 14 bars, down to 7 | A day view holds up to 61 bars. The Cost rules apply as they are. |
| Work, by week | Yes, from 14 bars, down to 7 | An all-time view holds a week per bar with no upper limit: a year is 52 bars. One rule for both buckets, counted in bars. A weekly chart of 9 to 13 bars gets no slider. |
| Outcome trend | No | It never holds more than 26 bars, every bar is as tall as the next, and the counts over the bars already thin out. A slider would add height for nothing to find. |

- The rules are Cost's (foundation, decision 8): the slider, plus and minus around the bar read, the window moved to include a bar read outside it, "Show all", the status after each change, and no effect on the range, the URL, the request, the figures or the data table.
- Both tracks keep the whole view's scales while zoomed.
- The box is 28px taller with the slider. The spike's 58px of free room keeps the tab list in the first screen (870px).
- The slider's faint trend is the bars' totals, through `sliderTrend()`. Without it the trend would be the error rate.
- "Show all days" or "Show all weeks" comes from a shared hook, `useZoomReset()` in `web/src/components/echart/zoomReset.tsx`. It holds what `CostChart.tsx` does today: the handle ref, whether the chart is zoomed as the wrapper reports it, the move of the focus to the box when the button leaves with the focus on it, and the button. Cost moves onto it. The foundation named a second zoomed chart as the time to share this. The button's rule (`.show-all`) moves from `cost.css` to `EChart.css`.
- The work chart's legend is `aria-hidden`, so its button sits beside the legend, not in it.
- Status wording: "Showing Oct 11 to Oct 20, 10 of 30 days." and "Showing all 30 days."; by week "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks." and "Showing all 20 weeks.".
- The chart's label and hint gain the zoom keys only in views that show the slider.

### 7. `view` identity

| Chart | Key | Why |
|---|---|---|
| Work | range, bucket, first bar's day, project, source, automated filter, measure | A bar keeps its index while the view starts on the same bar and counts in the same bucket. The measure is in the key as Cost's metric is: the chart reads other figures. |
| Outcome trend | the Judgments view on screen (its request URL), and every week's date | Weeks without a session are left out, so an older week can join in the middle and move the bars. The wrapper maps nothing by key, so any change to the list is another view. |

- Not in the work chart's key: the selection, and anything from the figures. A new bar at the end keeps the view.
- The outcome trend takes the view from `Judgments.tsx` as a prop. A new newest week ends its reading, at most once a week. It has no zoom to lose.
- Today both charts end the reading on every new payload. With the key, a background ingest keeps it.

### 8. The work chart: every behavior and its form

`WorkChart.tsx` splits as Cost did. `workTracks.ts` is pure: `workModel(d, metric, selected)` and `workOption(model, env)`, with `rateScale`, `bucketLabel` and `weekCut` moved there. The component keeps the heading, the measure switch, the chip, the legend, the words of the reading, the tooltip and the table.

Layout at the default text size: margins top 20, right 16, bottom 24, left 52; bars track 120px fixed; gap 16; rate track 36px scaled. That is 216px, as today, and 244px with the slider.

| Behavior today | Form on the shared component |
|---|---|
| Bars per day or week from the first day with a session | `tracksOption` over `workBuckets(d)`; `points` is the bar count |
| Stacked by project with Other, or plain | `stackSeries` on `trackAxes(0)`, kinds from `workKinds`, values from `workStack`; plain bars are one kind in `var(--series-1)` |
| Thin segment at least 1px, 2px gaps | `stackRects`, the same slot rule |
| Measure switch | Unchanged HTML; the model takes the measure |
| Day or week, labels "Week of Oct 5" | The frame's `categoryAxis` with `bucketLabel` |
| Value axis in round ticks | `niceMax()` and `valueAxis` |
| Rate track: its own scale, ticks at 0 and its top | `valueAxis` on `trackAxes(1)` with `max` and `step` both `rateScale().top`; the top label hangs under its line (`verticalAlignMaxLabel: "top"`) |
| Rate line, broken at a bucket without calls | `lineSeries` in `var(--critical)`, `null` for no calls |
| A rate above the scale stops at the top | The model draws `min(rate, top)`; the reading gives the rate itself |
| Hollow dot for a bucket with few calls, left out of the scale | `lineDots` with `hollow` from `low`; `lowVolume()` and `rateScale()` unchanged |
| Dot on a point no line reaches | `lineDots`, in the days shown: also a point whose neighbour the zoom leaves out |
| No tool calls: no rate track, no key | One track; the bars take the rate track's room |
| Legend: project keys, rate key, "Under 50 calls" | Unchanged HTML, static |
| Peak label | `pointLabel` on `trackAxes(0)`, `id: "peak"`; left out at a zero peak, kept inside the plot and left out when the plot is narrower than its text, as on Cost (decision 3) |
| Hover or keys read a bar on both tracks | The wrapper, on the frame |
| Tooltip rows and readout wording | Unchanged, in `tip(i)` and `read(i)` |
| Escape ends the reading, from anywhere | The wrapper |
| Click or Enter selects a busy bar; an idle bar does nothing | `onActivate`; the handler returns `false` for an idle bar, so the reading stays |
| No pick while a new view loads | No `onActivate` when `onPick` is absent |
| The reading ends at a pick, and the live region says what it did | The wrapper ends it; `status` |
| The selection is an accent wash across both tracks | `selectionMark` (decision 4) |
| A selection the chart has no bar for marks nothing | `selected` is `null` |
| Escape with no reading clears the selection, prevented | `onEscape` |
| The chip, and its button that clears and focuses the chart | Unchanged HTML; the focus goes through the handle |
| "Show the whole range" focuses the chart by its id | `<EChart id>` keeps `CHART_ID` |
| "Show data table" | Unchanged |
| Text scaling | `trackLayout`: the labels and the rate track scale, the bars keep 120px, the box grows |
| Reduced motion, forced colors | The wrapper's environment; decisions 4 and 5 |
| One bar, or a view with no work | One point; "no commits yet" in the label; no peak label |

What will look or behave differently:

1. A zoom slider shows under the bucket labels in views of 14 bars or more, and the box is 28px taller there.
2. The selected bar has a thin accent frame, and its tint is 16% where it was 12%.
3. A background ingest no longer ends the reading.
4. The sentence about a selection or a clear is said once. Today the live region shows it again when a later reading ends.
5. The chart draws a moment after the page on a first visit, in a box already at its height.
6. Bars grow once, when the chart first draws, not each time data lands.
7. ECharts picks which bucket labels fit.
8. In forced colors the bar being read is a highlight-colored band with no frame. Today it has the same 2px frame as the selected bar, so the two cannot be told apart. The rate line is in the system text color, where it kept the theme's red.
9. The pointer is a hand over every bar, idle ones included, while the chart takes a pick, and nowhere while it does not. It is the wrapper's rule: the wrapper cannot tell which points `onActivate` would decline.
10. At a larger text size the box grows and the bars keep their height. Today the box stays 216px and the bars shrink, to 24px at 200%.
11. In a view with no tool calls the bars fill the box. Today 52px stay empty over the labels.
12. The peak label is not drawn while the zoom leaves the peak bar out.
13. Enter on a chart that still shows the previous view is left to the browser.
14. Label positions, dot sizes and the grid's pixels may differ by a pixel or two.
15. The newest bucket's label is always shown, right-aligned on its point, at every width; a label it would overlap is hidden (decision 1).
16. The peak label stays inside the plot: near an edge it slides in, and a plot narrower than its text draws none. At a larger text size a mid-width plot now shows it (decision 3). Cost's peak label follows the same rule.
17. Re-selecting the selected bar says "is still selected", then "is already selected"; a selection changed from outside the chart says nothing (decision 4).

### 9. The outcome trend: every behavior and its form

`OutcomeTrend.tsx` splits the same way. `judgments/outcomeWeeks.ts` holds `trendModel(weeks)` and `trendOption(model, env)`. One grid, 240px, margins top 20, right 8, bottom 26, left 40, scaled with the text.

| Behavior today | Form on the shared component |
|---|---|
| One bar per week, 100% tall, stacked best outcome first | `stackSeries` with `TREND_PARTS` and each part's share of the week; `valueAxis` 0 to 1 in quarters, as Cost's Share |
| A part with a session is at least 1px, 2px between parts | `stackRects` |
| Half width for a week of fewer than 5 sessions, in full color | `width: (band, i)` |
| Bar width: the band less min(6, 25%) | The same rule, passed as `width` |
| The week's sessions over its bar, thinned when they would overlap | A second x axis on top of the grid, over the same weeks, whose labels are the counts; ECharts thins them (spike). It sets no axis pointer. |
| Week labels under the bars | `categoryAxis` |
| Legend, and "Under 5 sessions" when a week has it | Unchanged HTML |
| Hover or keys read a week; tooltip and readout wording | The wrapper; `tip(i)` and `read(i)` unchanged |
| Escape and blur end the reading | The wrapper |
| No selection, Enter does nothing | No `onActivate` |
| "Show data table" | Unchanged |
| Shown from 2 weeks | Unchanged, in `Judgments.tsx` |

What will look or behave differently:

1. A background ingest no longer ends the reading.
2. Escape closes the tooltip wherever the focus is.
3. The chart draws a moment after the page on a first visit, and its bars grow once.
4. ECharts picks which week labels and which counts fit.
5. The top part of a bar has rounded corners when it is taller than 4px, as on Cost.
6. In forced colors the week being read is a highlight-colored band, not a 2px frame.
7. Label positions may differ by a pixel or two.

### 10. Files

| File | What |
|---|---|
| `web/src/pages/activity/workTracks.ts`, `workTracks.test.ts` | The work chart's model and option |
| `web/src/pages/activity/WorkChart.real.test.tsx` | Its smoke test on real ECharts |
| `web/src/pages/activity/judgments/outcomeWeeks.ts`, `outcomeWeeks.test.ts` | The trend's model and option |
| `web/src/pages/activity/judgments/OutcomeTrend.real.test.tsx` | Its smoke test |
| `web/src/components/echart/zoomReset.tsx`, `zoomReset.test.tsx` | The shared "Show all" hook |

No new name matches an existing file's name in another case: `workChart.ts` and `outcomeTrend.ts` would clash with `WorkChart.tsx` and `OutcomeTrend.tsx` on a case-insensitive file system, as `costChart.ts` did.

### 11. Tests

| Layer | What it proves |
|---|---|
| `option.test.ts`, `stack.test.ts` | `trackLayout` heights at scale 1 and 2, with and without the slider; `tracksOption` indexes, the one axis pointer, hidden track axes; `selectionMark` in theme and forced colors; `lineSeries` colors and nulls, `lineDots` in both modes and for a window that leaves a neighbour out; `sliderTrend`; `zoomSlider` drives all axes; `width(band, i)` |
| `EChart.test.tsx` | `status` said once, replaced by a reading, not said again, not said on mount or for a new view, dropped when empty; `onEscape` only with no reading, prevented only on true, never from the document |
| `testing.test.ts` | The fake's new rules, below |
| `zoomReset.test.tsx` | The button shows by the wrapper's report, resets and focuses the box, and hands the focus over when it leaves |
| `workTracks.test.ts`, `outcomeWeeks.test.ts` | The geometry and option tests moved from the component tests: stack order and colors, the rate scale and its ticks, the clamp, nulls, dots, the peak label, the selected index, the layout, the counts axis, half widths, and every color declared in `theme.css` |
| `WorkChart.test.tsx`, `Judgments.test.tsx`, `ActivityPage.test.tsx` | What a user reaches, on the fake: tooltip rows, readout wording, legend, chip, status, selection by key and by pointer, Escape, the table, the zoom button |
| `WorkChart.real.test.tsx`, `OutcomeTrend.real.test.tsx` | Real ECharts in jsdom, below |
| `tools/demo/chartfit.mjs` | A real browser: decision 12 |

**What this change relies on in ECharts, where it is verified, and what the fake models.**

| Reliance | Real ECharts | Fake runtime |
|---|---|---|
| The slider drives only the x axes it names | Work's smoke test: after a zoom, a rate dot is still over the middle of its bucket's bar | New: `zoomAxes` follows ECharts' rule (none named: the first x axis and every other x axis in its grid), and `setOption` throws when an option has a slider and an x axis it does not drive |
| Each grid sits where the layout puts it | Work's smoke test at narrow widths (11 weeks at 343px, 13 weeks at 600px and 200% text): the frame's points over the tracks'; `chartfit` at 343px and at 32px text |
| The peak label stays inside the plot | Work's smoke test: the peak at each of 11 weeks in 343px; `chartfit` at 343px, zoomed and not | Not modelled: the fake draws nothing | New: `setOption` throws when an option of two grids or more leaves one without `outerBoundsMode: "none"` |
| Only an axis that shows a pointer draws a band | Both smoke tests: one band path after a key reads a point | New: `setOption` throws when an x axis after the first sets `axisPointer.show` |
| The frame answers the pointer over every track | `chartfit`: the pointer in each track and between them | Already so: the fake's one grid is the frame, and a finder index other than 0 throws |
| A mark outside the zoom window is not drawn | Work's smoke test | Not modelled: no component test depends on it |
| Symbols on single items of a line without symbols | Work's smoke test: a hollow and a solid dot are drawn, and no other | Not modelled |
| The top label of a two-tick axis hangs under its line | `chartfit`: no label overlaps at 16px and 32px | Not modelled |
| The hidden totals line is the slider's trend | `chartfit`, by screenshot review | New: `sliderShadowOf` follows ECharts' rule, and `setOption` throws when a slider would draw its trend from another series than `trend` |
| A redraw that drops a track | Work's smoke test: a payload without tool calls leaves no rate path and logs no error | Already so: `replaceMerge` empties a listed key |

Rules kept from the foundation: component tests assert what a user reaches; geometry and option details are tested on the pure modules; one smoke test per chart draws on real ECharts.

### 12. The browser check

`tools/demo/chartfit.mjs` becomes a runner: `node chartfit.mjs [cost] [activity] [judgments]`, every page when none is named. One seeded store and one browser serve them all.

| File | What |
|---|---|
| `tools/demo/chartfit.mjs` | The runner: the pages named, every page when none is |
| `tools/demo/chartfit/harness.mjs` | The store, the server and its stop, the browser, `line()`, `until()`, `open()`, what the pages reported, and `PHONE`, a 417px window, in which a chart's box is 343px wide |
| `tools/demo/chartfit/readers.mjs` | The in-page readers, for a chart found by its root selector: the frame from the grid lines, bars, the band, the selection frame, lines and dots, slider handles, texts, tooltip, readout, legend keys |
| `tools/demo/chartfit/checks.mjs` | The checks every chart runs, from a descriptor (path, root, points, names): colors in light, dark and a system flip; forced colors; 32px text; pointer and keys on the same point; zoom; newer figures; no CSP or console error |
| `tools/demo/chartfit/cost.mjs` | Cost's descriptor and its own checks, moved with no check dropped |
| `tools/demo/chartfit/activity.mjs`, `judgments.mjs` | The same for the work chart and the trend, with their own checks |

A later page adds one module and one line in the runner.

- **A dropped load is retried.** The demo server's listen queue is 5, and on a loaded machine it drops connections. `open()` throws away a page load during which the server dropped a request, and loads the page again in a fresh browser context, up to 3 loads; on the third drop the run stops and names the page. The drops of a discarded load go unreported; any other console error, page error or CSP violation of that load still fails the run. A drop after the kept load, during the checks, still fails.
- **Narrow widths.** Each page also runs in the `PHONE` window (a 343px box): no label is cut by the box or overlaps another, the pointer and Home and End read the first and last bars with the band centred on its bar, and, on a chart of several tracks, the newest point's label ends inside the plot. The work chart also runs by week at 32px text in a 900px window (22 weeks).
- The pages load IBM Plex Sans from Google Fonts, as the app does, so the text measures need the network.

The work chart's checks run on the Sessions measure: every day of the demo store has a session, so every day draws a bar and the readers count every point.

The work chart's own checks: one band from the top of the bars to the bottom of the rate track, for the pointer in each track and between them, and for the keys; the rate line in `--critical` and in `CanvasText` under forced colors; the hollow dot's center and ring; a click and Enter select (URL, chip, frame, status), an idle bar declines, two Escapes end the reading and then clear; the frame stays while other bars are read and is not the band; zoomed, a rate point sits under its bar, the frame goes when its bar is left out and comes back; the slider said once; "Show all days"; the URL, the requests, the heading and the data table unchanged by a zoom; newer figures keep the zoom, the reading and the selection; at 32px the bars track is as tall as at 16px; the all-time view by week has no slider at 11 bars; re-selecting says "is still selected", then "is already selected", and the tab note's "Show the whole range" says nothing; by week in a 343px box, a click on the newest week frames it centred on its bar with its rate point under it; in a 343px box, with the peak two weeks in and zoomed, the peak label stays inside the plot.

The trend's own checks: the five parts in the legend's colors; a half-width bar for a week of few sessions; the counts thinned with none overlapping in a 320px window with 26 weeks; Escape from another control closes the tooltip; no slider; in a 343px box, the edges and labels of the shared checks.

Where the demo store lacks a case (a bucket of few calls, a week of few sessions, 26 weeks), the check answers the request with the store's payload changed, as Cost's empty-day check does.

`tools/demo/firstscreen.mjs` waited for `#work .bar-seg` and measured `#work .chart`: it now waits for the first filled path under the plot's svg group (`WORK_BAR`, as `COST_BAR` is for Cost) and measures `#work .echart`. `tools/demo/record.mjs` clicked `#work svg` and `#trend svg`: it now clicks `#work .echart` and `#trend .echart`.

### 13. Bundle

- **ECharts chunk.** Nothing is added to `echarts.ts`. Two tracks are grids, the rate is a line series, the mark and the bars are custom series, and the slider is registered. Expected size: 176.5 kB, as now. The 195 kB limit stays.
- **Entry.** `ActivityPage` is a lazy route, so the entry does not change. The 130 kB limit stays.
- **`ActivityPage`.** New limit: **28 kB** (22.4 kB at the spike; Cost grew by 4.2 kB for one chart). `check-bundle.mjs` reads its page and shared chunks from one list (`SINGLE`), each of which must match exactly one file, so a later page adds a line.
- **Shared chunk.** The chart code Cost and Activity share (the wrapper, the stack, the option helpers, `useZoomReset`) is split by Vite into its own chunk, named after its first module: `zoomReset-*.js`, limit **9 kB**. A move of modules can rename it; the check then fails on "found 0" rather than skip it.
- Sizes as built, gzip -9: entry 109.1 kB (limit 130), `CostPage` 12.1 kB (20), `ActivityPage` 23.7 kB (28), `zoomReset` 7.6 kB (9), ECharts 176.5 kB (195).
- `ActivityPage.tsx` calls `preloadECharts()` at module load, as `CostPage.tsx` does.

### 14. What this change removes, and what stays

Removed:

- From `WorkChart.tsx` and `OutcomeTrend.tsx`: the SVG, the pointer math, the key handlers, the document Escape listener, the tooltip placement.
- From `chart.ts`: `roomForLabels`, which no chart uses any more.
- From `chart.css`: the rules for `.chart`, `.chart svg`, `.chart:focus-visible`, `.chart .bar-seg` under `.grow`, and `.chart .hit.pick`. Activity and Judgments have no `.chart` box left.
- From `theme.css`: `@keyframes grow-y`; the forced-colors rule for `.chart svg > rect:not(.hit)`; `.chart .bar-seg` in the bars' edge rule (Errors' `#chart .layer` stays); `.pg-activity` in the `circle.lowc` rule (Errors' stays).
- From `activity.css`: `.pg-activity .work .chart svg`.
- From `cost.css`: `.pg-cost .legend .show-all`, replaced by `.show-all` in `EChart.css`.
- In `css.test.ts`: the `PAGE_GATES` counts of `components/chart.css` and `theme.css` go down to what is left (9, from 14, and 4, from 7), and any allow-list value that no stylesheet uses any more is removed. Nothing is added to an allow-list.
- In `theme.test.ts`: the test "frames the hovered and selected chart buckets", which asserted the removed forced-colors rule for `.chart svg > rect:not(.hit)`.

Stays:

- In `chart.ts`: `dayAxis`, `useWidth`, `scaleMargins`, `stackHeights`, `tipAt`, `peakLabelAt`, `niceMax`, `textScale`, `motion`, `lowVolume`, `LOW_CALLS`, `FEW_CALLS`, `useCountUp`. The charts not yet moved, the wrapper and the helpers' tests use them.
- In `chart.css`: the heading row, legend and tooltip row rules for Activity, Cost and Judgments, with `.legend i.line.fail` and `.legend i.low`.
- In `theme.css`: the forced-colors rule for `.pg-activity .legend .key i.low`, and every rule for Errors, Context and Limits.
- `ChartTable` and the shared `Table`, untouched.

### 15. Docs and images

- `CHANGELOG.md`, `[Unreleased]`: under Added, the work chart's zoom; under Changed, the framed selection, the reading kept through new data on both charts, Escape on the trend's tooltip, and the work chart growing with the text size.
- `README.md`: one sentence on the zoom in the Activity row.
- Docs site, written with the `doc-coauthoring` skill: `pages/activity.mdx` (the work chart section), `pages/insights.mdx` (the trend's Esc row), `everywhere/keyboard-screen-reader.md` (the plus and minus rows name the work chart; the forced-colors line).
- Shots, by `node tools/demo/record.mjs shots` only, in dark and light pairs: `activity-work` and `tour-overview`. `site/src/assets/shots/README.md` updates the `activity-work` row to name the slider. No shot is added.
- README recordings: `docs/activity*.gif`, `docs/insights*.gif`, `docs/tour*.gif` and `docs/tour*.mp4`.

## What later changes inherit

A chart with several tracks puts a frame at grid 0, over every track: the frame holds the one visible x axis, the only axis pointer and whatever crosses the tracks, and each track is a grid of its own with a hidden x axis over the same points (`trackLayout`, `tracksOption`, `trackAxes`). The wrapper is not changed for it: it reads grid 0, so one band, one tooltip and one sentence cover every track, and `zoomSlider()` drives every axis. Every grid sets `outerBoundsMode: "none"` (`tracksOption` does it), so the layout's margins must hold the labels: value labels inside the left margin, and the newest bucket label right-aligned on its point. A persistent selection is `selectionMark()` in the option, a frame, never the reading band; what a selection did is said through `status`, and Escape with no reading goes to `onEscape`. Under forced colors bar segments keep their colors inside a text-colored edge, a lone line is the system text color (`lineSeries`), and lines that only their colors tell apart keep them over a halo in the page color. Each chart splits into a pure model and option module with its own tests, a component that keeps the words, one smoke test on real ECharts, and one module under `tools/demo/chartfit/`.

For the next builders: Errors needs `keys={{ space: true }}`, marks that cross the tracks (fix lines, no-activity bands) as series on the frame, and its own bar width. Context's cache chart needs a reading that skips empty slots, which is a new wrapper rule to design in its change. Growth and the timeline need `locate` for a value or time axis.

## Risks / Trade-offs

- **A chart that zooms its frame and not its tracks.** The fake has one grid, so a forgotten axis passes on it. → `zoomSlider()` names every axis itself, the fake throws on a slider that leaves an x axis out, and Work's smoke test compares the axes on real ECharts.
- **Two bands.** A track axis that shows a pointer draws a second band. → `tracksOption()` builds the track axes, the fake throws, and both smoke tests count the band paths.
- **The frame and the tracks drift apart.** Three grids must share one left, right and point list. → `tracksOption()` builds all of them from one layout and one label list; `chartfit` checks a rate point under its bar, zoomed and not.
- **A status said twice, or lost.** It is set in the same turn as the reading ends. → Wrapper tests for the order, and `chartfit` listens to the live region through a selection, a reading and a clear.
- **The selection frame read as the band by a check.** Both are translucent rectangles as tall as the frame. → The readers tell them apart by the frame's stroke; `chartfit` asserts both on one point.
- **The first screen.** The slider adds 28px over the tab list. → 58px are free (spike); `firstscreen.mjs` checks it in both themes.
- **The split of `chartfit.mjs` drops a Cost check.** → The step compares the printed lines before and after: the same lines, all ok.
- **A larger download for Judgments with no trend.** The page preloads the chunk even when the trend is left out. → One cached request; Overview, the default view, always draws a chart.
- **The slider is not keyboard-operable by itself.** → Plus, minus and "Show all" cover it, as on Cost.

## Migration Plan

1. Land the wrapper additions, the helpers, the fake's rules, the shared button and the split of the browser check (group 1). Cost is the only user and must not change.
2. Land the work chart (group 2) and the outcome trend (group 3), each with its tests and docs.
3. Land the removal, the budget, the browser check and the images (group 4).
4. Rollback: revert a chart's swap commit. The removal step comes after both swaps, so until it lands a revert needs nothing else.

## Open Questions

- Whether the weekly work chart should zoom at all. This design gives it the same rule as days, from 14 bars. Saying no later means one condition in `workModel`.
- Whether the selected bar's reading should say "selected". It does not today, and the chip names the selection.
- Whether the value axes should rescale to the bars shown once a free time range exists. This change keeps the view's scales, as Cost does.
