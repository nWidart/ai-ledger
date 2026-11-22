# Design

## Context

See `proposal.md` for the motivation. Two archived designs hold what this one builds on, and both are true to the code:

- "The foundation": `openspec/changes/archive/2026-11-21-echart-foundation/design.md`, the wrapper's contract.
- "The Activity design": `openspec/changes/archive/2026-11-21-echart-activity/design.md`, the multi-track pattern. Its section "What later changes inherit" is the starting point here.

This section holds only what shapes this change.

**The chart today** (`web/src/pages/errors/RateChart.tsx`, 251 lines, one SVG of 320px):

- Two panels on one time axis. Above: the error rate as a line, 100px high, on its own percent scale. Below: failed calls per day or week, stacked by type, on its own count scale. Each panel has a title inside the drawing.
- Points: one per bucket from the first day with a tool call. A stretch of 8 buckets or more with no call and no error folds into one point (`GAP_FOLD` in `model.ts`).
- Marks that cross both panels: a faint band over each run of buckets with no activity, labelled "no activity" when wider than 64px, with `//` on the baseline of a folded stretch; a dashed green line with "✓ type" for each applied fix.
- The rate line bridges a gap with a dotted line. A bucket with few calls gets a hollow dot and is left out of the scale.
- Two selections. A **type** (`cat`, from the legend, the table or a link) dims the other layers and fix markers, and the line becomes that type's rate in its color. A **bucket** (`at`, by click, Enter or Space) narrows the type table and the detail; the same act on the selected bucket clears it. A folded stretch cannot be selected.
- The reading: pointer or arrow keys, a band over both panels, a dot on the line, a tooltip and a live sentence (`#chartLive`). What a selection did is said by the page's status region (`#detailLive`).
- Any redraw ends the reading: newer data, a saved fix marker, a resize. The key cursor is kept by bucket key (`cur`), so Space still acts on the point after the reading is gone.
- Without calls, or without errors, a message replaces the drawing. The box (`#chart`) stays focusable: `tableFocus()` and the page's `IntersectionObserver` use it.

**Constraints.**

- The wrapper reads grid 0 and x axis 0, as category bands. `EChart.tsx` changes only by a prop the foundation reserved.
- `web/scripts/check-bundle.mjs`: the ECharts chunk is 176.5 kB gzip, limit 195 kB.
- `web/src/css.test.ts` lets allow-lists shrink only.
- `openspec validate --strict` rejects a requirement text over 500 characters.
- The page filters on the client: one payload holds every error. So the chart never draws a view other than the one the URL names, and the view key is always built from what is drawn.

**What a spike measured** (ECharts 6.1.0 from `web/node_modules`, the SVG renderer in ECharts' server-side mode, in Node; chunk sizes with the app's bundler, rolldown, minified, gzip -9; the spike is deleted). Server-side mode lays out and draws as a browser does, but estimates text widths. Each decision cites the result it rests on.

| # | Question | Result |
|---|---|---|
| S1 | The rate track above the bars: do the frame's points sit over each track's, and does the frame answer the pointer between the tracks? | Points 0, 15 and 29 of 30 have one x on the frame and on both tracks (64.3, 433.3, 777.7px at 800px). `containPixel({ gridIndex: 0 })` is true in the rate track, in the gap and in the bars, false over the labels. The track order is the caller's: nothing in the helpers assumes bars first. |
| S2 | A custom series on the frame, one item per fix: a dashed line over the frame's height and a text beside it? | Both drawn, at the point's x on the frame (138.1px for point 3, the same as on a track). `lineDash: [4, 3]` gives `stroke-dasharray`. Zoomed to points 10 to 25, the fix on point 3 is not drawn and the fix on point 20 is, at its new x. |
| S3 | A run of idle buckets as one item with two x dimensions (`encode: { x: [0, 1] }`), under the slider's default filter? | A run the window cuts is removed whole: with runs 5–7 and 18–22 zoomed to 6–20, neither is drawn, though five of their buckets show. With `filterMode: "weakFilter"` both are drawn, but that changes the slider every chart shares. |
| S4 | One item per idle bucket instead? | Each is filtered on its own: zoomed to 6–20, buckets 6, 7, 18, 19 and 20 draw, with shared edges (101.2, 691.6, 740.8px) inside the plot. |
| S5 | A track's title as its value axis's `name` (`nameLocation: "end"`, `nameTextStyle.align: "left"`, `nameGap: 7`)? | Drawn left-aligned at the grid's left (x 52), its text box ending 7px over the track's top (tracks at 22 and 148px: text centres at 9.5 and 135.5px). No component beyond the grid. `nameTruncate: { maxWidth, ellipsis: "…" }` cuts it ("Bash exit code other …" at 120px) and draws nothing at 5px. Not used as built: it measures once, before the web font loads (decision 4). |
| S6 | The slider's faint trend when the first track holds the line? | With the rate line alone: the rate. With a hidden totals line on the rate track's axes, listed before the rate line: the totals. Listed after it: the rate. On the bars' track: the rate (the lower axis wins). So `sliderTrend()`'s rule holds as written: first track with a line, before that track's lines. |
| S7 | A `dataZoom` action narrower than `minValueSpan` (6, on 30 points)? | ECharts widens it and keeps its start: 10–15 and 10–12 give 10–16; 0–2 gives 0–6. At the axis end it still keeps the start, then clamps the window to the last point: 24–26 and 27–29 give 23–29. A percent window of 40% to 50% gives 12–18. No window under 7 points can be held. On an axis of 6 points, 1–3 gives 0–5: every point. |
| S8 | The bridge: the rate data again with `connectNulls: true`, dotted, under the solid line? | One unbroken dotted path (`stroke-dasharray="1,4"`), and the solid line in four parts. A lone point (no neighbour with a value) is a move with no length in the solid line: it draws nothing, so its dot is `lineDots`'s. Zoomed, the bridge starts at the first point shown that has a value. |
| S9 | `style.opacity` on one rectangle of a custom series' group? | That rectangle alone is written with `fill-opacity="0.2"`; its neighbours are untouched. Step 3.4 found that it fades the rectangle's stroke too, so under forced colors a dimmed segment's edge faded with it; the chart uses `style.fillOpacity`, which fades the fill alone (decision 4). |
| S10 | A custom series with `z: 0` against the grid lines? | The grid lines are painted first, then `z: 0`, then `z: 1`, then a line series. A band on the frame is over the grid lines. |
| S11 | What would ECharts' own mark components cost? | Base 177.3 kB (the real chunk is 176.5 kB). `MarkLineComponent` +5.6 kB, `MarkAreaComponent` +3.1 kB, both +6.9 kB, `GraphicComponent` +2.2 kB, `TitleComponent` +0.8 kB. |
| S12 | How big is the Errors page chunk? | `ErrorsPage-*.js` is 20.6 kB gzip -9 at this change's base. The shared chart chunk `zoomReset-*.js` is 7.7 kB, the entry 109.1 kB. |

Not measured in the spike: the text measures in a browser (the fix label's side, the "no activity" label's fit, the title's cut). They use the canvas measure `pointLabel` already uses, which the Activity change checked in Chromium. Step 3.4 checked them on this chart, and found that `nameTruncate` (S5) cuts a title before the page's web font has loaded, in the fallback font, so a cut title ended 3 to 10px past a 219px plot once IBM Plex Sans drew it. The chart cuts its titles itself (decision 4).

## Goals / Non-Goals

**Goals:**

- Keep every behavior of the rate chart, and list every difference a user can notice.
- Nothing new in the ECharts chunk.
- Leave Context and Limits the pieces they need next, and no more: a titled track, the text measure, and a worked example of marks on the frame.

**Non-Goals:**

- Migrating any other chart. `Spark.tsx` and the detail's mini rate chart stay hand-written SVG, with `linePath` in `model.ts`.
- The reserved wrapper props Errors does not need: `locate`, `onMiss`, `keys.shiftStep`, `keys.start`.
- A shared "vertical mark" helper. Limits' marks differ (a short tick, a solid line), and its change decides what to share.
- Changing what a selection does to the type table, the detail, the URL or `settle`.
- Changing the tooltip's rows or any reading's words.
- The data tables.

## Visible differences

What a user will see or meet that differs from today. The owner reads this first; each line names the decision that explains it.

1. A zoom slider shows under the bucket labels in views of 14 points or more, and the box is 28px taller there. Plus and minus zoom; "Show all days" or "Show all weeks" shows while zoomed (decision 7).
2. The selected bucket is an accent-tinted band in a thin accent frame. Today it is a grey wash in a text-colored frame, with a small triangle under the axis. The triangle is gone (decision 6).
3. After a selection by key, the tooltip and the band stay on the point. Today both close and only the key cursor stays. The same key still clears the selection (decision 6).
4. The sentence about a selection ("Selected …", "Selection cleared …", "… cannot be selected") is said by the chart's live region, once, and stays there when the pointer leaves the chart or the reading ends. Today the page's status region says it (decision 6).
5. Newer data, a saved fix marker and a resize no longer end the reading (decision 8).
6. When newer data moves the chart's first point or a folded stretch, the reading ends and the zoom resets. Today the key cursor stays on its bucket. The selection itself is kept in both (decision 8).
7. No dot is drawn on the rate line at the point being read. The band alone shows the reading, as on Cost and Activity (the Activity design, decision 3).
8. Escape closes a tooltip the pointer opened wherever the focus is. Today the chart must have the focus.
9. Enter with no point read is left to the browser. Today it is prevented. Space still never scrolls the page under the focused chart (decision 2).
10. The chart draws a moment after the page on a first visit, in a box already at its height.
11. The bars grow once, when the chart first draws. Today they grow, and the line draws in, each time the filters change. Layers no longer fade when a type is selected: they dim at once.
12. ECharts picks which bucket labels fit. The newest bucket's label is always shown, right-aligned on its point.
13. The plot starts 52px from the left, where it started at 40px, so count labels up to "600,000" fit its margin (decision 1).
14. At a larger text size the box grows and both panels keep their height. Today the box stays 320px and the bars shrink, to 80px at 200% (decision 1).
15. A rate point with no neighbour that has calls is a solid dot of 5px. Today it is a 2px round cap. The hollow dot's ring takes the line's color, where it was muted grey, and its legend key follows (decision 10).
16. A bar's top segment has round corners when it is taller than 4px, and its other segments are square; a thin segment keeps at least 1px and a 2px gap. Today every segment has small round corners. This is the shared stack's rule, as on Cost and Activity.
17. A fix label stays inside the plot: left of its line near the right edge, left out when neither side has room. Labels of fixes on one bucket sit one under the other, in the order of their type labels; today they are drawn over each other. Each label has a halo in the page's surface color, so the rate line breaks behind its letters (decision 5).
18. The "no activity" label shows when its measured text fits its band. Today it shows in any band wider than 64px, whatever the text size. The band is over the grid lines, where it was under them (decision 5, S10).
19. A panel's title is cut with "…" when it is wider than the plot. Today it runs out of the chart (decision 4).
20. In forced colors: the point being read is a highlight-colored band with no frame, the selected bucket a highlight-colored frame with no tint, the rate line, its dots and the fix markers are in the system text color, and a no-activity band is a dashed frame with no fill.
21. While zoomed, a fix marker, a no-activity band or the selection's frame outside the points shown is not drawn. A run of idle buckets the zoom cuts is drawn from the plot's edge (decisions 5 and 7).
22. The tooltip is placed by the shared component, inside the chart's box rules, so it can sit a few pixels from where it sits today.
23. The rate line is 1.75px wide, where it was 2px. Label positions, dot sizes and the grid's pixels may differ by a pixel or two.
24. A rate axis in steps of 0.05 is labelled in hundredths ("0.00%", "0.05%", "0.10%"). Today it is labelled in tenths, so two labels read the same ("0.1%" twice) (decision 10).
25. Under forced colors, a dimmed type's segments keep their whole text-colored edge; today the edge fades with the fill (decision 4).

Not different: the legend and its type buttons, the selection panel under it, the tooltip's rows, every reading's words, the data table, the URL keys, the message shown without calls or errors, and what a bucket or a type selection does to the rest of the page.

## Decisions

### 1. Tracks: the frame, with the rate above the bars

Reuse as it is. `trackLayout`, `tracksOption`, `trackAxes` and `FRAME_AXES` take the tracks in the caller's order (S1). Track 0 is the rate, track 1 the bars.

| Part | Value at the default text size |
|---|---|
| Margins | top 20, right 10, bottom 24, left 52. They scale with the text. |
| Rate track | 100px, fixed |
| Gap | 24px, scaled: it holds the bars' title |
| Bars track | 152px, fixed |
| Box | 320px, as today; 348px with the slider; 388px at 200% text (416px with the slider) |

- The top margin is 20px: the rate track's title, as the browser draws it, has a text box 1.3 times the text size tall that ends 2px under the title's place. At 18px it started 1.3px above the box (3px at 200% text). The gap gives up those 2px, so the box keeps 320px.
- The left margin is 52px, as on Cost and Activity, where it is 40px today. Every grid sets `outerBoundsMode: "none"` (`tracksOption` does it), so a value label wider than its margin is clipped, not fitted. Measured in Chromium (`chartfit`): count labels up to "600,000" fit, the axis of 450,000 failed calls in one bucket. From 571,429 failed calls in one bucket the top label is "1,000,000", which the margin cuts by about 6px. The owner accepts this: such counts do not occur.
- Both tracks are fixed, so the box grows with the text and neither panel shrinks. Today the bars give their height to the labels, and the count axis has fewer steps at a larger text size; here its step is always worked out for 3 steps.
- The scales (decision 10): the rate's top is the highest steady rate plus 10%, its step the round step at or above a third of that, so the axis has two or three steps (a highest rate of 0.18% gives 0, 0.1 and 0.2%). The top value is exact, rounded off its float error, so ECharts draws the top grid line once. A scale in tenths keeps the decimal on every label, "0.0%" too; a step under 0.1 shows two decimals ("0.05%").
- Why not the rate under the bars, as on Activity: the page's subject is the rate, the legend and the data table name it first, and the order is free in the helpers.

### 2. Wrapper addition: `keys`

One prop, reserved by the foundation under this name and shape. Nothing else in `EChartProps` changes.

```tsx
/** Keys the box takes beyond the arrows, Home, End, Enter, Escape and the zoom keys.
 *  `space`: an unmodified Space activates the point being read, as Enter does. In a chart that has `onActivate` the key
 *  is always prevented, with a point read or not, so the page never scrolls under a chart that takes it. Shift+Space
 *  and any other modified Space are the browser's. Without `onActivate`, or without `keys.space`, Space is the browser's. */
keys?: { space?: boolean };
```

- Why a wrapper change at all: the page's spec gives Enter and Space the same act, Space is what a user presses on a control that toggles, and today Space on the focused chart never scrolls the page. The wrapper owns the box's key handler and the reading, so no chart can do this from outside it. The foundation foresaw it.
- Why opt in, and not Space on every chart: Space on the focused Cost and Activity charts scrolls the page today. Changing that is another change, with its own spec lines.
- `onActivate`'s comment gains one sentence, with no change of behavior: a chart may return `false` to keep the reading open, so that the same key acts on the same point again (decision 6).
- As built: the key is matched by `ev.key === " "` alone (not `"Spacebar"` nor `ev.code`). The box's key handler is there from the first render, so Space is prevented, and activates the point read, before the runtime has loaded.
- The step is the one Fable step of this change.

Alternative: drop Space on Errors, as the other charts have only Enter. Rejected as the default: it removes a key a user has today. It is the cheapest thing to flip (see "Defaults the owner may flip").

### 3. What the chart needs, and where each piece comes from

| Need | Decision | Where |
|---|---|---|
| Two tracks on one axis, the rate above | Reuse as is | `trackLayout`, `tracksOption` (decision 1) |
| Stacked bars by type, with Other | Reuse `stackSeries` on `trackAxes(1)`, with the chart's own width rule passed as `width` | `stack.ts` |
| A dimmed layer when a type is selected | **Extend** `stackSeries`: an opacity per kind | `stack.ts` (decision 4) |
| The rate line, broken at a bucket without calls | Reuse `lineSeries` | `option.ts` |
| Hollow dots, and a dot on a lone point | Reuse `lineDots` | `option.ts` |
| The dotted bridge over a gap | Local: `lineSeries`' result with `connectNulls: true` and a dotted style (S8) | `rateTracks.ts` (decision 5) |
| A title on each track | **Extend**: `axisTitle()` | `option.ts` (decision 4) |
| The bucket selection's mark | Reuse `selectionMark` | `option.ts` (decision 6) |
| The type selection | Local: the kinds' opacities, the line's data and color, the fix marks' opacity | `rateTracks.ts` (decision 6) |
| Fix markers across both tracks, with labels | Local: a custom series on the frame (S2) | `rateTracks.ts` (decision 5) |
| No-activity bands and fold marks | Local: a custom series on the frame (S4) | `rateTracks.ts` (decision 5) |
| A text's width, to keep a label inside the plot | **Extend**: export the measure as `labelWidth()` | `option.ts` (decision 4) |
| The zoom, its keys and its button | Reuse `zoomSlider`, `sliderTrend`, `useZoomReset` | decision 7 |
| What a selection did, said once | Reuse the wrapper's `status` | decision 6 |
| Space selects | **Wrapper**: `keys` | decision 2 |
| A reading that outlives a redraw | Reuse the wrapper's `view` | decision 8 |

No ECharts component is added. `markLine` and `markArea` would draw the fix lines and the bands, but `MarkLineComponent` and `MarkAreaComponent` would have to be registered, at +6.9 kB for both (S11), and their labels would still need the plot-edge rule written by hand. A custom series on the frame does both with what is registered, and it is the form `selectionMark` already has. The chart needs no `graphic`, no `title` component and no time axis.

What this change uses of ECharts that the earlier charts did not, all inside the registered grid, line series and custom series, each measured: a value axis's `name` (S5), a line with `connectNulls: true` and a dash pattern (S8), `lineDash` and a text in a custom series on the frame (S2), `style.fillOpacity` on one shape of a group (S9), and a track order with the line first (S1, S6).

The chart has no label over a point, so `pointLabel` is not used. Its two labels beside marks are measured with `labelWidth` and kept inside the plot (decision 5).

### 4. Shared helper additions

All pure, typed from `echarts.ts`, in `web/src/components/echart/`.

- **`axisTitle(env, text, maxWidth)`** in `option.ts`. It returns the part of a value axis that names it as a track's title: `name`, `nameLocation: "end"`, `nameGap: 7 × textScale` and `nameTextStyle` (left-aligned, the secondary ink, the chart's font size, weight 500) (S5). A chart spreads it into the axis `valueAxis()` gives. `maxWidth` is the plot's width: the box's width less the layout's left and right. `OptionEnv.ink` gains `secondary`, which `ChartEnv` already has. Who reuses it: Context's cache chart, the next change, has three titled tracks and today picks a shorter title by a rough character count.
  - The name is cut here, not by ECharts' `nameTruncate`: `text`, or its longest start with "…" whose width at weight 500 (`labelWidth`) is at most `maxWidth`, or "" where not even "…" fits. The cut falls between graphemes (`Intl.Segmenter`, by code point where it is missing), so an emoji or a letter with a combining mark is kept or left out whole. `nameTruncate` measures once, as ECharts first lays the title out, which in Chromium was before IBM Plex Sans had loaded (S5, step 3.4).
  - The fonts: `useChartEnv` (`tokens.ts`) listens to `document.fonts` `loadingdone` with the media queries it already watches, so every chart gets a new environment, and draws again, when the page's web fonts have loaded. That redraw is of the same view (decision 8): it keeps the reading, the zoom and the focus, and says nothing.
- **`labelWidth(env, text, weight = 400)`** in `option.ts`. The private `textWidth` made public, with the font built from the environment. `pointLabel` calls it. Who reuses it: Context's cache chart (its rough width), Limits' plan-change label, which changes sides at the plot's middle today.
- **`kinds[j].o`** in `stack.ts`. `StackSeriesInput.kinds` items may carry `o`, the opacity of the segment's fill from 0 to 1; left out, the segment is drawn as now. `stackSeries` writes it as the rectangle's `style.fillOpacity`, so its forced-colors edge stays whole, and the hatch keeps its own opacity (S9). No later chart is known to need it. It is in `stack.ts` because the segment's style is built there and nowhere else, and a color mixed by hand would not pass through `env.color`, which takes theme tokens only.

Not added: a shared series for vertical marks or for bands (Non-Goals), and a side-of-the-line anchor, which is four lines in `rateTracks.ts`.

### 5. The marks on the frame

Both are custom series on `FRAME_AXES`, built in `rateTracks.ts`, silent, with `emphasisDisabled` on their shapes, as `selectionMark` is.

**No-activity bands** (`id: "idle"`, `z: 0`: over the grid lines, under the selection's frame and the bars).

- One item per idle point, holding its index and its run's first and last index. A point is idle when it has neither calls nor errors (`idle()` in `model.ts`); a folded stretch is one idle point.
- Why one item per point and not one per run: the slider removes a run the window cuts, though part of it shows (S3). Per point, each is kept or left out on its own (S4).
- Only the first point of a run that is shown draws: one rectangle from its own left edge to the right edge of the last point of the run that is shown, over the frame's height. So a run is one rectangle, with no seam, also when the zoom cuts it. A point is shown when the middle of its band is inside the plot, the rule `lineDots` has.
- Theme: `var(--surface-2)` at 75%, as today. Forced colors: no fill, a 1px dashed frame in the grid ink, as the legend key's dashed edge.
- The label "no activity", in the muted ink, centred in the rectangle at the middle of the bars track, when `labelWidth` plus 8px fits the rectangle.
- A folded stretch draws `//` in the muted ink, centred on its band, on the frame's bottom line.

**Fix markers** (`id: "fixes"`, `z: 4`: over the line and its dots).

- One item per applied fix whose bucket is a point of the chart and whose type the page knows, as today: its index, its row and its type. The row is its rank among the fixes on the same point, in the order of the type labels.
- A 1.5px dashed line (`4 3`) in `var(--good)` at the middle of the point's band, over the frame's height. It is never wider than its band (98 weeks in a 246px plot is a 2.5px band).
- The label "✓ " and the type's short label, in `var(--good-text)`, 2px under the frame's top and 13px lower per row, both times the text scale. The rows on one point follow the type labels' order. It sits 4px right of the line. When it would pass the plot's right edge it sits 4px left of the line, right-aligned. When neither side has room it is not drawn.
- The label has a halo in the surface color, 3px wide times the text scale, as `pointLabel`'s, so the rate line breaks behind its letters (found at 32px text, with two labels near the right edge).
- With a type selected, a fix of another type is drawn at 20%, its label too (decision 6).
- Forced colors: the line and the label in the text ink, the halo in `Canvas`.
- A fix outside the points shown is not drawn (S2).

**The bridge** (`id: "bridge"`). `lineSeries` with the rate's data and color, then `connectNulls: true`, a 1.25px dotted line (`[1, 4]`, round caps) at 70%, listed before the rate line so it is under it (S8). With no type selected its color is the muted ink, as today.

### 6. The two selections

**The bucket** (`at`).

- **The mark.** `selectionMark(env, { index })`, as on Activity. The model's `selected` is the index of the point whose key is `v.at` and that can be selected, else `null`.
- **The toggle.** `onActivate` selects the point, or clears the selection when the point is the selected one, and returns `false` in every case. So the reading stays, and the same key or click acts on the same point again. A folded stretch changes nothing.
- **Why keep the reading.** The page's spec has "Enter, then Space" select and then clear, and three tests guard it, one of them for a selection that closes the open type. With the reading ended, as on Activity, a second key would do nothing and the next arrow would start again from an end of the chart.
- **Escape.** It ends the reading and never changes the selection, as today: a second Escape, with nothing read, does nothing either. No `onEscape`.
- **Words.** Said through the wrapper's `status`, with today's words:

| What happened | Status |
|---|---|
| A click, Enter or Space on a point that is not selected | "Selected Nov 4, 2026: the table and detail show only its errors." (a week: "Selected Week of Nov 2, 2026: …") |
| The same on the selected point | "Selection cleared: the table and detail cover the whole range." |
| The same on a folded stretch | "A stretch without tool calls cannot be selected.", and on the next such press "This stretch has no tool calls to select.", alternating, since the same text twice says nothing |
| The selection changes from outside the chart (the chip by the type table, Back, a type opened over the bucket, a filter, the URL) | Nothing: the status empties, which drops a sentence the region still holds |

- **How the status is made.** The chart keeps the last sentence and the selection it describes (`of`, a bucket key or none). The `status` prop is that sentence only while `v.at` is `of`, else empty. So the sentence appears in the render that draws the selection it names, whenever the URL lands.
- **Why that matters.** The reading of a selected point ends "(selected)", so a selection changes the words of the reading that stays open, and the wrapper says a key's reading again when its words change. When the status arrives in that same render, the wrapper says the status alone (`EChart.test.tsx`, "says a status alone when it arrives in the render that changes the words of a key's reading"). A status set in the handler could arrive a render earlier and be replaced by the reading.
- **The status outlives the reading it came in.** Since the reading stays open after a selection, the status arrives while a reading is open. The end of that reading (the pointer leaving, Escape, blur) drops only the reading's own sentence: the status stays in the region, as does a zoom sentence that took the region while a reading was open. This is a wrapper rule (`readAt` in `EChart.tsx`, with its comment on `status`), found in step 3.4: before it, the pointer leaving the chart right after a click emptied the region.
- The sentences, as `RateChart.tsx` writes them: `Selected ${pointWhen(v, p)}: the table and detail show only its errors.` ("Selected Nov 4, 2026: …", "Selected Week of Nov 2, 2026: …"), "Selection cleared: the table and detail cover the whole range.", and the two fold sentences of the table above.
- The page's own sentence when a type is opened over a bucket ("Selection cleared: … has no errors in …") stays in the page's status region.

Alternative: keep `say()` and the page's status region. Rejected: the chart's region would say the reading again ("… (selected)") while the page's region says the sentence, two announcements for one act.

**The type** (`cat`).

- The stack's kinds are the view's layers and Other. With a type selected, every kind but its layer gets `o: .2` (decision 4). A selected type with no layer of its own lights Other, as today.
- The rate line draws the type's rate in the type's color, on its own scale; the bridge takes that color too.
- A fix marker of another type is drawn at 20%.
- The type is **not** in the `view` key (decision 8): selecting a bucket can close the open type, and that must end neither the reading nor the zoom.

### 7. Zoom

The chart gains the zoom, by the rules of Cost and Activity (the foundation, decision 8; the Activity design, decision 6).

| Question | Answer |
|---|---|
| When | From `ZOOM_FROM` (14) points, by day and by week, down to `MIN_SHOWN` (7). A folded stretch is one point. Never while a message replaces the drawing: the model's `zoom` is `!bare && points >= 14`, so the label and the hint name no zoom keys there. |
| The slider's faint trend | The failed calls per point: `sliderTrend(totals, trackAxes(0))`, listed before the bridge and the rate line (S6). |
| Scales | Both tracks keep the whole view's scales. |
| The bucket selection | Kept. Its frame is not drawn while its point is outside the window; the chip and the chart's label still name it. Selecting or clearing keeps the window. |
| The type selection | Opening or closing a type keeps the window (decision 8). |
| Fix markers and bands | Drawn for the points shown only; a run the window cuts starts at the plot's edge (decision 5). |
| The reading | An arrow, Home or End moves the window to include the point read, as the wrapper does for every chart. |
| What it leaves alone | The URL, the summary, the type table, the detail, the data table (every point), and the network. |
| When it resets | A new view (decision 8): the range with its first point, the granularity, a filter or a toggle. |
| The button | `useZoomReset()`: "Show all days" or "Show all weeks", at the end of the legend row, as on Cost. |
| The label and the hint | They name plus and minus only in views that show the slider. |

Status wording, as on Activity, in days or weeks: "Showing Oct 11 to Oct 20, 10 of 30 days." and "Showing all 30 days."; by week "Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks." and "Showing all 20 weeks.". A folded stretch counts every bucket it stands for, and ends the span at its last one, so the sentence counts days or weeks and never "points".

Why a zoom here at all: a 90-day view has up to 90 bars in the same box, and the pattern is the same on three pages now.

### 8. `view` identity

| In the key | Why |
|---|---|
| The range, the granularity, the project, the source, the subagent toggle, the noise toggle | What the user chose that changes the points or the figures |
| The first point's bucket | A rolling range moves it; an ingest can add an earlier first day |
| Each folded stretch, as its first and last bucket | A fold that appears, grows or opens moves every point after it |

- Not in the key: the bucket selection, the open type, the tool filter, the fix markers, and anything else from the figures. A new point at the end keeps the view.
- The key is built in `rateModel()` from the points it returns. The page filters on the client, so those are always the points drawn.
- A muted type changes the figures and can change a fold; the fold part of the key covers it.
- Today every redraw ends the reading, and the key cursor is kept by bucket key. With the key, a redraw of the same view keeps the reading and the zoom, and a redraw that moves the points ends both. The wrapper maps nothing by key, as the Activity design states for the outcome trend.

### 9. The fake runtime: the slider's minimum window

`testing.ts` does not enforce `minValueSpan`, so a test can hold a window no user can make (`WorkChart.test.tsx` has one of six bars). The fake gains ECharts' rule, from S7:

- A window narrower than the first slider's `minValueSpan`, from a `dataZoom` action or from a `setOption`'s `startValue` and `endValue`, is widened to it. The start is kept; when the end would then pass the last point, the window is clamped to end on it (24–26 gives 23–29 on 30 points). On an axis of `minValueSpan` points or fewer, the window is every point.
- `zoomTo(from, to)`, the test's stand-in for a drag, throws when the window is narrower than `minValueSpan`, or than every point on an axis of `minValueSpan` points or fewer (`zoomTo(1, 3)` throws on 6 points). A drag cannot make such a window, so a test that asks for one is wrong.
- A slider with no `minValueSpan` is as now.
- Not modelled: a reversed window (an end before its start).

The header comment of `testing.ts` gains both lines. The six-bar window in `WorkChart.test.tsx` becomes seven.

### 10. The rate chart: every behavior and its form

`RateChart.tsx` splits as the work chart did. `rateTracks.ts` is pure: `rateModel(m, v, f, vt, fixes)`, `rateLayout(model, textScale)` and `rateOption(model, env)`. The component keeps the heading, the granularity switch, the legend, the selection panel, the words of the reading, the tooltip and the table.

| Behavior today | Form on the shared component |
|---|---|
| Points from the first day with a call, long idle stretches folded | `chartData()` in `model.ts`, unchanged; `points` is its count |
| The rate line, the selected type's rate when one is | `lineSeries` on `trackAxes(0)`; `null` for a bucket without calls; the color is `var(--text-primary)` or the type's |
| The rate scale: its own, buckets with few calls left out | `rateModel` keeps today's rule (the highest steady rate plus 10%, in round steps of at least a third of it: two or three), with an exact top; `valueAxis` with a percent format, in hundredths for a step under 0.1 (decision 1) |
| A rate above the scale stops at the top | The model draws `min(rate, top)`; the reading gives the rate itself |
| Hollow dot for a bucket with few calls | `lineDots` with `hollow` from `lowVolume()` |
| Dotted bridge over a gap | Decision 5 |
| Failed calls stacked by type, the biggest on the baseline, Other on top | `stackSeries` on `trackAxes(1)`; kinds in `vt.layers` order, then Other in `var(--type-other)` |
| Bar width: 72% of the band, 26px at most | Passed as `width` |
| The count scale, in whole steps | `rateModel` keeps today's rule (the highest count plus 5%, in round steps of at least a third of it and at least 1), at every text size: today a larger text size gave fewer steps |
| A title on each panel | `axisTitle` (decision 4): "Error rate, % of tool calls" or "… rate, % of tool calls"; "Failed calls per day, by type" |
| Bucket labels | The frame's `categoryAxis` with `label()` |
| No-activity bands, their label, `//` on a fold | Decision 5 |
| Fix markers with their type | Decision 5 |
| Legend: type buttons, Other, the rate key, "Under 50 calls", "No activity" | Unchanged HTML, with the "Show all" button at the end of its row. The hollow key's ring takes the line's color (decision 15). As today, no legend when the range has no errors, with or without calls. |
| The selection panel under the legend | Unchanged HTML |
| Selecting a type dims the rest and changes the line | Decision 6 |
| Hover or keys read a point on both panels | The wrapper, on the frame |
| Tooltip rows and readout wording | Unchanged: `tip(i)` and `pointText()` |
| The dot on the line at the point read | Dropped (difference 7) |
| A click, Enter or Space selects or clears a bucket | `onActivate` and `keys={{ space: true }}` (decisions 2 and 6) |
| A folded stretch cannot be selected, and the page says so | `onActivate` and `status` (decision 6) |
| The selected bucket's mark | `selectionMark` (decision 6) |
| The label names the selected bucket | Unchanged, in `label` |
| Escape ends the reading | The wrapper |
| The key cursor outlives a redraw | The reading itself outlives it, through `view` (decision 8) |
| No calls, or no errors: a message, and the keys do nothing | The component renders a plain focusable box with the message in place of `<EChart>`, with the same id, class `echart` (its focus ring), label and hint. Its one key handler keeps an unmodified Space from scrolling the page, as on the chart; no other key does anything |
| `#chart` as a focus target and for the mini chart's observer | `<EChart id="chart">`, and the same id on the message's box. The page observes a new stable element around both (`#chartView`): the two boxes are different elements, and an observer on one would go stale when they swap. |
| "Show data table" | Unchanged |
| Day / Week | Unchanged HTML |
| Text scaling | `trackLayout` (decision 1) |
| Motion | The wrapper: the bars grow on the first drawing only, never under reduced motion |
| Resize | The wrapper |

### 11. Files

| File | What |
|---|---|
| `web/src/pages/errors/rateTracks.ts`, `rateTracks.test.ts` | The rate chart's model, layout and option |
| `web/src/pages/errors/RateChart.real.test.tsx` | Its smoke test on real ECharts |
| `web/src/components/echart/realTesting.ts` | The path readers the real tests share, moved out of the two tests that each hold a copy |
| `tools/demo/chartfit/errors.mjs` | The browser check's module for the page |

Not `rateChart.ts`: on a case-insensitive file system it clashes with `RateChart.tsx`.

### 12. Tests

| Layer | What it proves |
|---|---|
| `EChart.test.tsx` | `keys.space`: Space activates the point read; prevented with `onActivate`, read or not; left alone with a modifier, without `onActivate`, and without the prop |
| `testing.test.ts` | The fake's minimum window (decision 9) |
| `option.test.ts`, `stack.test.ts`, `tokens.test.ts` | `axisTitle`'s fields at two text scales and its cut by the measured width at weight 500, between graphemes; `labelWidth` for a weight; a kind's fill opacity on its rectangle and on no other; a new environment when web fonts finish loading |
| `rateTracks.test.ts` | The geometry and option tests, on a fake env: both scales and their ticks, the clamp, nulls, hollow points, the kinds' order, colors and opacities, the bar width's cap, the idle items and what each draws for a window that cuts its run, the label's fit, the fold mark, the fix items with their rows and sides, the selected index, the trend before the lines, the bridge, the titles, the layout at scale 1 and 2, the zoom flag, the zoom words with a fold, the view key, and every color declared in `theme.css` |
| `ErrorsPage.test.tsx` | What a user reaches, on the fake: selection by pointer and by key, the toggle, the status, the tooltip, the readout, the legend, the message states, the data table, the zoom's button and words |
| `RateChart.real.test.tsx` | Real ECharts in jsdom, below |
| `tools/demo/chartfit/errors.mjs` | A real browser: decision 13 |

**What happens to the SVG chart's tests in `ErrorsPage.test.tsx`.**

| Test today | Fate |
|---|---|
| "selects a bucket with a click, narrows the table, and clears with a second click" | Kept. The click is the fake's (`fire("click", chart.pointAt(i))`), with no `getBoundingClientRect` mock. `#atMark` becomes: the option holds the `selected` series for that point. |
| "leaves keys with Alt, Ctrl, Meta or Shift to the browser on the chart, and never lets Enter or Space scroll it" | Deleted. The wrapper owns the rule; `EChart.test.tsx` has the modifiers and gains Space. |
| "selects and clears from the keyboard with Enter and Space" | Kept: the page's wiring of the toggle and of `keys`. The sentence is read from the chart's region. |
| "can't select a folded stretch without calls" | Kept. The sentence is read from the chart's region. |
| "draws the no-activity band and legend key only for buckets with neither calls nor errors" | Split. The legend key stays here. The band moves to `rateTracks.test.ts`. |
| "dismisses the tooltip and the reading with Escape, and the keys start over" | Deleted. The wrapper owns it and tests it. |
| "keeps Space working on the current point after Enter closes the open type" | Kept: a scenario of this change. |
| "keeps Space working when the closed type was outside the top five" | Kept. `.layer[data-c]` becomes the legend's button per layer (`#legend button[data-c]`), which the stack's kinds follow; the option's kinds are tested in `rateTracks.test.ts`. |
| "keeps the current point when new data shifts the chart's points" | Deleted. `rateTracks.test.ts` proves the two rules that replace it: the selected index follows the bucket key, and the view key changes with the first point. |
| "shows the fix markers of the payload, with their before and after rate" | Kept. `#chart .fix` becomes the option's `fixes` series and its label. |
| The others that touch the chart ("tells a screen reader…", "reads a point with errors and no calls…", "reads a quiet day…", "leaves the chart's keys alone once the last visible type is muted out…", "leaves the summary, chart, type table and the chart's point reading as they are under a tool filter", the data table's two) | Kept, with the new selectors: `[role=tooltip]` for `#tip`, the chart's `div.sr[aria-live]` for `#chartLive`. |

In `theme.test.ts`, the assertion on `.pg-errors #chart .layer` goes with its rule.

**The 400-line advisory.** As built (`git diff --numstat` against `main`, the test files and `realTesting.ts`): 933 lines added and 155 removed, a net of 778. Added: 308 in `rateTracks.test.ts`, 282 in `RateChart.real.test.tsx`, 69 net in `ErrorsPage.test.tsx` (145 added, 76 removed), 53 in `realTesting.ts`, and 115 net across the wrapper's, the fake's, the helpers' and the tokens' tests (`EChart.test.tsx` 24, `option.test.ts` 52, `tokens.test.ts` 19, `testing.test.ts` 16, `stack.test.ts` 4). Removed: `realTesting.ts` takes 45 net duplicated lines out of `WorkChart.real.test.tsx` and `CostChart.real.test.tsx`, and `theme.test.ts` loses 4. The net is over the advisory 400, and the pull request says so, with the reason: one chart now has three test layers where it had one (the pure model and option, the page on the fake runtime, real ECharts in jsdom), and the wrapper's new rules (Space, a status that outlives its reading), the fake's minimum window, the font-load redraw and the title's cut each need a test at the layer that owns them. Not counted: the browser check `tools/demo/chartfit/errors.mjs`, which runs locally, not in CI.

**Guards no test can turn red.**

- The marks' zoom guards: `idleBands` and `fixMarks` draw nothing for a point outside the plot. Under the slider's default filter (`filterMode: "filter"`) ECharts never hands them such an item, so with both guards removed every test of `web/src/pages/errors/` still passes (tried in step 3.6), the real one included; for the same reason `chartfit` cannot tell. They stay for a slider that ever keeps such items (`weakFilter`, S3).
- `outerBoundsMode: "none"` on Errors' grids: `tracksOption` sets it for every chart, and the fake refuses a grid without it, so Errors cannot drop it without changing the shared helper, whose own tests hold it.

**What this change relies on in ECharts, where it is verified, and what the fake models.**

| Reliance | Real ECharts | Fake runtime |
|---|---|---|
| The frame's points sit over both tracks', with the rate above | The smoke test at 800px, at 343px with 11 weeks and at 200% text; `chartfit` at 343px and at 32px text | Already so: one grid, the frame; it refuses a grid without `outerBoundsMode: "none"` |
| A mark on the frame is drawn at its point, and not outside the window | The smoke test: one dashed line per fix, none for a fix the zoom leaves out | Not modelled: the fake draws nothing |
| A run of idle buckets is one rectangle, also when the window cuts it | The smoke test: one band path per run, starting at the plot's left edge when cut; `chartfit` | Not modelled |
| The value axis's name is the track's title, cut at a width | The smoke test: both titles drawn as text; `chartfit` at 343px with a long type name, at 32px text, and with the web font arriving after the first drawing | Not modelled |
| `style.fillOpacity` dims one segment, its edge whole | The smoke test: with a type selected, the other layers' paths carry the opacity, and under forced colors their edge stays whole; `chartfit` under forced colors | Not modelled |
| The hidden totals line is the slider's trend | `chartfit`, by screenshot review | Already so: `sliderShadowOf` refuses another series than `trend` |
| The slider holds no window under its minimum | S7; `chartfit`: plus stops at 7 points | New: decision 9 |
| The bridge is one path under a broken line; a lone point is a dot | The smoke test | Not modelled |
| Only the frame's axis draws a band | The smoke test: one band path after a key | Already so |

Rules kept: component tests assert what a user reaches; geometry and option details are tested on the pure module and on real ECharts; a rule is tested once, at the layer that owns it.

### 13. The browser check

`tools/demo/chartfit/errors.mjs`, named in the runner: `node chartfit.mjs [cost] [activity] [judgments] [errors]`. It runs the shared checks of `checks.mjs` from its descriptor (`/errors?range=30`, root `.chart-card`), then its own. The legend's keys here are buttons with a swatch; if the shared checks need a descriptor field for that, the step adds it and changes no line the other pages print.

Its own checks:

- The rate line is the text color in light and dark, and `CanvasText` under forced colors. With a type selected it is the type's color, the other layers and the other types' fix markers are at 20%, and the legend's pressed button matches.
- One band from the top of the rate track to the bottom of the bars, for the pointer in the rate track, in the gap and in the bars, and for Right, Home and End. The pointer over the bucket labels reads nothing.
- A click, Enter and Space select a bucket: the URL holds `at`, the chip by the type table names it, the frame is drawn over both tracks, the tooltip stays, and the live region says the sentence once. The same act again clears it and says so. The chip's clear says nothing in the chart's region.
- With a payload changed to hold a folded stretch: the fold draws `//` and its band; Enter on it selects nothing and says its sentence; a second Enter says the other one.
- Escape with the focus on another control closes a tooltip the pointer opened, and the selection is unchanged.
- A fix marker is a dashed line in `--good` over both tracks with its label. With a payload changed: a fix on the newest bucket has its label left of the line and inside the plot; two fixes on one bucket have labels that do not overlap.
- A run of idle buckets is one band over both tracks; its label shows only where it fits.
- Zoom: the slider shows from 14 points and not under; plus, minus and a real drag; the live region says the points shown once; "Show all days" resets and returns the focus; the URL, the requests, the heading and the data table are unchanged. Zoomed, a rate point is over its bar, the selection's frame goes when its bucket is left out and comes back, a fix outside is not drawn, and a run the window cuts starts at the plot's edge. The Week switch shows every week. By week, the words name weeks.
- At 32px text: the box grows, both tracks are as tall as at 16px, no label is cut or overlaps, and both titles are inside the plot.
- In the `PHONE` window (a 343px box), by week: the edges and labels of the shared checks; the newest week's label ends inside the plot; a click on the newest week frames it centred on its bar with its rate point over it; a selected type with a long name has a title that ends with "…" inside the plot; a fix on the newest week has its label inside the plot.
- Under forced colors: the selection's frame is `Highlight` and unfilled, apart from the band, a `Highlight` wash with no frame; a hollow dot is `Canvas` in a `CanvasText` ring; a no-activity band is dashed with no fill; a fix marker is `CanvasText`.
- Newer figures keep the reading, the zoom and the selection, and say nothing. The bars grow once; under reduced motion never.
- With `SHOTS=<dir>`: the slider's faint trend follows the bars, not the rate line.

Where the demo store lacks a case (a fold, a fix on the newest bucket, two fixes on one bucket, a bucket of few calls), the check answers the request with the store's payload changed, as the other modules do.

As built, the module's header lists what it checks; beyond the list above:

- The slider's faint trend is read, not only looked at: its points follow the bars' totals, not the rate.
- The value labels fit the 52px margin with counts up to "600,000" and with a rate scale in hundredths (decision 1).
- The focus ring on the chart's box and on the message's box; Space on the message's box does not scroll the page, Shift+Space is the browser's.
- A click, then the pointer leaving at once, 400ms or 1.5s later: the selected sentence is said once and the region still holds it (decision 6). The chip and Back clear the selection, and the chart says nothing.
- The mini chart shows once `#chartView` scrolls out of view.
- About 98 weeks in a 343px box: the selected week's frame is visible and no wider than its band, and so is the fix line.
- Under forced colors every stroke the chart draws is a system color, and a dimmed segment keeps its edge.
- At 32px text in a 343px box, with the web font held back until the chart has drawn, the default title ends inside the plot once the font loads, with no interaction: the font-load redraw (decision 4).
- Every day of the 30-day views is given a call and an error, so every day draws a bar for the readers.

Not checked by the module: the focus ring under forced colors, the fix markers keeping their color while a point is read (the real test checks it in jsdom), and the bars growing again on a tool or a project filter (`motionOnce` covers a theme change, a type, a zoom out and newer data). Step 3.6 checked the three by hand, in Chromium on the demo store:

- The focus ring under forced colors: Tab to the chart, and to the message's box (a payload without errors): `:focus-visible`, a 2px solid outline in `Highlight`, 4px off the box, on both.
- The fix markers while a point is read: two fixes; their lines' strokes and their labels' fills are unchanged with the pointer on a fix's day, the pointer on another day, and a key reading a fix's day.
- With motion on, no bar segment grows on a project filter, back to all projects, a type opened, a tool filter on it (`etool`) or that filter cleared.

Seen in step 3.6, not checked by the module:

- The web font arriving during the first drawing's 500ms growth (held 250ms after the first bar): the bars finish their growth with no drop, while the rate line's draw-in ends at once, its clip snapping to the full width when the font redraw comes. ECharts ends a series' entry animation on a `setOption` with `animationDurationUpdate: 0`; Cost and Activity behave alike. Not changed.
- The fix label's halo over the selected bucket's tint: the surface-colored halo shows as a light (dark theme: dark) outline around the "✓" where it sits over the tint, and cuts a 3px notch in the selection's frame where the label crosses it; under forced colors a `Canvas` notch in the `Highlight` frame. Not changed: the halo is what keeps the rate line from running through the label (decision 5).

Each new reader is first shown to fail on a chart without the thing it reads. A dimmed segment carries `fill-opacity`, as the selection's frame and the band do: a reader that tells bars from marks by that attribute must be run with a type selected.

`tools/demo/firstscreen.mjs` waits for `.chart-card .bars rect` today. It waits for the chart's first drawn bar instead: a filled path directly under the plot's svg group, as `WORK_BAR` is written for the work chart, under `.chart-card .echart-plot`. `tools/demo/record.mjs` needs no change: its Errors and tour scenes use `#chartTitle`, `#legend button` and `.chart-card`, which stay.

### 14. Bundle

- **ECharts chunk.** Nothing is added to `echarts.ts`. Expected size: 176.5 kB, as now. The 195 kB limit stays.
- **Entry.** `ErrorsPage` is a lazy route. The 130 kB limit stays.
- **`ErrorsPage`.** New limit: **26 kB**. It is 20.6 kB at the base (S12). The SVG chart leaves and the option builder comes; Activity grew by 1.3 kB for two charts. Expected: 21 to 23 kB. As built: 21.0 kB.
- **As built** (`npm run check` in step 3.6, gzip): `index` 109.1 kB, `CostPage` 12.1 kB, `ActivityPage` 23.7 kB, `ErrorsPage` 21.0 kB, `zoomReset` 7.0 kB, `echarts` 176.5 kB, each within its limit.
- **Shared chart chunk.** `zoomReset-*.js` is 7.7 kB of its 9 kB at the base (7.0 kB as built). `keys`, `axisTitle`, `labelWidth` and the opacity add little. A third page importing the chart modules can make Vite name the chunk after another module: the check then fails on "found 0", and the step renames the entry in `check-bundle.mjs`.
- The comment on the ECharts chunk names Errors with Cost and Activity.
- `ErrorsPage.tsx` calls `preloadECharts()` at module load, as the other two pages do.

### 15. What this change removes, and what stays

Removed:

- From `RateChart.tsx`: the SVG, the `T` text helper, the width observer, the pointer math, the key handler, the `cur` key cursor, the tooltip placement, the `#chartLive` region, and its use of `say`.
- From `errors.css`: `.pg-errors #chart` (position and radius) and `.pg-errors #chart:focus-visible`, both replaced by `.echart`'s rules, which the message's box takes by carrying the class; `.pg-errors #chart svg`; the transition on `#chart .layer` and `#chart .fix`; `#chart svg.has-sel .layer:not(.on)` and `.fix:not(.on)`; `#chart svg.grow .bars` and `#chart svg.grow .rline`; `@keyframes err-grow` and `err-draw`; `.pg-errors #hit` with its comment. Changed, not removed: the ring of `.pg-errors .sw.low` reads `var(--low-ring, var(--text-primary))`, and the key sets `--low-ring` to the line's color. A custom property, not an inline border color: an inline color would outrank the forced-colors rule for that key.
- From `theme.css`: `.pg-errors circle.lowc` (the comment over it keeps what it says of the keys), and `.pg-errors #chart .layer` with its comment.
- From `theme.test.ts`: the assertion on `.pg-errors #chart .layer`.
- In `css.test.ts`: every allow-list value the test reports as unused after the removal. The `PAGE_GATES` counts do not change: no removed rule is a page-list gate. Nothing is added to an allow-list.

Stays:

- In `errors.css`: `.pg-errors #chart .empty`, the heading row, the legend, the swatches, the selection panel, the tooltip rows, `@keyframes err-bar-in` (the share bars), and `.mini` and `.spark` (the hand-written sparklines).
- In `theme.css`: the forced-colors rules for `.pg-errors .sw:not(.line)`, `.pg-errors .bar` and the pressed legend button, and the one for the "Under 50 calls" key, whose selector becomes `.pg-errors .legend .key .sw.low`: it names the legend and its key to outrank `errors.css`'s `.pg-errors .sw.low`, which the build places after `theme.css` and which now sets the ring's color through `--low-ring`.
- In `model.ts`: everything, `linePath` included (`Spark.tsx` uses it).
- In `chart.ts` and `chart.css`: everything. The rate chart used `FEW_CALLS`, `LOW_CALLS`, `lowVolume` and `textScale`, which other charts use, and never used `chart.css`.

### 16. Docs and images

- `CHANGELOG.md`, `[Unreleased]`, in the short-bullet style the section has. Under Added: "Errors' rate chart zooms in views of 14 bars or more, with a slider or the plus and minus keys.", beside the two like it. Under Changed, in the "Errors:" list: the chart uses the shared chart component, frames the selected day or week and keeps the reading on it so the same key clears it, says what a selection did from the chart's own region, keeps the point being read when new data lands, draws its fix labels inside the plot, and keeps both panels' height at larger text sizes. Under Fixed: the rate axis no longer repeats a label at a 0.05 step. Not claimed: following theme changes without a reload, which the old chart did too.
- `README.md`: one sentence on the zoom in the Errors row.
- Docs site, written with the `doc-coauthoring` skill: `pages/errors.mdx` ("Errors by type": the zoom, the frame, the reading that stays after a selection, the fix labels); `everywhere/keyboard-screen-reader.md` (the plus and minus rows name the Errors chart; the Enter and Space row is unchanged).
- `web/src/pages/errors/PARITY.md`: the "Rate chart" entries name the new files, and the entries this change alters say so, as its "Changed since" entries do.
- Shots, by `node tools/demo/record.mjs shots errors` only, in dark and light: `errors-chart`. `site/src/assets/shots/README.md` updates the `errors-chart` row to name the zoom slider. No shot is added.
- README recordings: the `errors` and `tour` scenes (`docs/errors*.gif`, `docs/tour*.gif`, `docs/tour*.mp4`). The docs site's hero plays the tour.

## Defaults the owner may flip

Each is a choice where today's chart gives no answer, or where the pattern and today's behavior pull apart. Flipping one changes the lines named, and nothing else.

| # | Default chosen | The other way | What flips |
|---|---|---|---|
| F1 | The chart zooms, by day and by week, from 14 points | No zoom on Errors | Decision 7, difference 1, the zoom requirements, the zoom lines of steps 2.1, 2.2 and 3.4 |
| F2 | Space selects, through the wrapper's reserved `keys` | Enter only, as on Cost and Activity | Step 1.1 goes, with the one Fable step; one more visible difference; the spec's "Enter or Space" |
| F3 | After a selection the reading stays, so the same key clears it | The reading ends, as on Activity, and Escape on the chart clears the selection | Decision 6, difference 3; `onEscape` is added |
| F4 | A selection the zoom leaves out stays selected, with no mark | Zooming it away clears it | Decision 7 |
| F5 | The slider's faint trend is the failed calls | The error rate | One line in `rateOption` |
| F6 | Labels of fixes on one bucket stack | Drawn over each other, as today | Decision 5, difference 17 |
| F7 | The plot starts at 52px | 40px, as today, with wide counts clipped | Decision 1, difference 13 |
| F8 | The selection's sentence is said by the chart's region | By the page's status region, as today | Decision 6, difference 4 |

## What later changes inherit

A chart orders its tracks as it likes: the frame is grid 0 whatever is above. A track's title is its value axis's name (`axisTitle`), cut at the plot's width. A mark that crosses the tracks is a custom series on `FRAME_AXES`, as `selectionMark` is, with one item per point it sits on: a run of points is drawn by the first of its points that is shown, since the slider removes an item the window cuts. A label beside a mark is measured with `labelWidth` and placed inside the plot, or left out. A chart that toggles its selection returns `false` from `onActivate`, so the reading stays, and words its `status` from the selection it draws, not in the handler. `keys={{ space: true }}` is for a chart whose page already gives Space that act. The fake runtime holds no zoom window under the slider's minimum.

For the next builders: Context's cache chart needs a reading that skips empty slots, a new wrapper rule to design in its change, and can take its three titles from `axisTitle`. Limits needs `locate` for its time axis, and decides there whether its marks and Errors' fix markers become one shared series.

## Risks / Trade-offs

- **The status and the reading in one render.** The status must arrive with the selection it names, or the reading replaces it. → It is derived from the selection drawn (decision 6); a page test reads the region after Enter and after Space; `chartfit` listens to the live region in a browser.
- **A reader that takes a mark for a bar.** The frame, the band, a dimmed segment and a no-activity band are all translucent rectangles. → Each new reader is first shown to fail without its mark, and the bar readers run with a type selected.
- **The message's box and the chart's box are two elements.** An observer or a focus on one goes stale when they swap. → The page observes the stable element around them; `tableFocus()` asks for `#chart` when it is called.
- **Text measures differ between jsdom and a browser.** jsdom estimates 0.6em a character. → The label rules are tested on the pure module with a stubbed measure, and in Chromium by `chartfit` at 343px and at 32px text.
- **The fake's new rule breaks a test elsewhere.** → Step 1.2 runs every test that uses the fake, and changes only a window no user can make.
- **A long type name hides the rest of a title.** The cut keeps the start: "Bash exit code other …". → The type's name comes first, and the legend and the selection panel name it in full.
- **The first screen.** The box is 28px taller with the slider. → The spec asks only that the chart starts in the first 900px; `firstscreen.mjs` checks it in both themes.
- **More test lines than the advisory.** → Decision 12 says why and what offsets them.
- **The slider is not keyboard-operable by itself.** → Plus, minus and "Show all" cover it, as on Cost and Activity.
- **Known limit: a dimmed fix label under forced colors.** With a type selected, another type's fix line and label are drawn at 20% in the system text color, so the label is faint on Canvas, below a readable contrast. The legend and the selection panel name the selected type in full, and the type table lists every fix. Not handled in this change.
- **Known limit: a fix label over the selected bucket.** Its halo, in the surface color, outlines the "✓" over the tint and notches the selection's frame (decision 13).
- **Known limit: the font arriving during the first drawing.** The rate line's draw-in snaps to its end; the bars finish growing (decision 13).
- **Known limit: a count of 571,429 failed calls or more in one bucket.** Its top label, "1,000,000", is cut by the 52px margin by about 6px (decision 1). Accepted by the owner.
- **Known limit: `shortLabel` in `model.ts` cuts a type's name at 25 UTF-16 units**, so an emoji or a combining mark at the cut is split, as `axisTitle`'s cut was before step 3.6. Its names come from the user's own types. Not changed here.

## Migration Plan

1. Land the wrapper prop, the fake's rule and the helpers (group 1). Cost and Activity are the only users and must not change.
2. Land the rate chart: its model and option, the swap, the smoke test, the docs (group 2).
3. Land the removal, the budget, the browser check and the images, one browser step at a time (group 3).
4. Rollback: revert the swap commit. The removal step comes after it, so until it lands a revert needs nothing else.

## Open Questions

- Whether the selected point's reading should keep ending "(selected)". It does today, and this design keeps it. Activity's reading does not say it.
- Whether Space should select on every chart. This change adds it for Errors only, as an opt-in.
- Whether the value axes should rescale to the points shown once a free time range exists. This change keeps the view's scales, as Cost and Activity do.
- Whether the tooltip should name the fixes applied on its bucket. It does not today, and a stacked label can be far from short on a narrow plot.
