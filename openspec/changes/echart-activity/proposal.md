# Proposal

## Why

The owner is moving every chart in the web UI from hand-written SVG to Apache ECharts 6. `echart-foundation` built the shared chart component and moved Cost's daily chart onto it. Activity is next: its work chart and the Judgments view's outcome trend still carry their own pointer math, key handlers, tooltip placement and text scaling. The work chart is also the first chart with two tracks in one drawing, so this change sets the multi-track pattern that Errors, Context, Limits and the session sheets copy.

## What Changes

- **The work chart on the shared chart component.** Same bars by project (commits, prompts or sessions), same error-rate track with its own scale, hollow dots for buckets with few calls, legend, peak label, tooltip, readout, data table, and the day or week selection that narrows the tabs.
- **The outcome trend on the shared chart component.** Same 100% bars per week, half-width bars for weeks with few sessions, session counts over the bars, tooltip, readout and data table.
- **The multi-track pattern.** A chart with two tracks or more draws a frame over every track. The frame holds the one visible axis, the reading band and whatever crosses the tracks. Each track is a grid of its own on the same points. One band, one tooltip and one live sentence cover every track, and the zoom moves every track together. The wrapper's contract for reading is unchanged.
- **New: a zoom on the work chart**, by the Cost rules: a slider under the bucket labels from 14 bars, down to 7, plus and minus keys, and "Show all days" or "Show all weeks". It narrows the drawing only. The outcome trend gets no zoom: it never holds more than 26 bars.
- **New: the selected bar is framed.** The selected day or week keeps its tinted band across both tracks and gains a thin accent frame, so it reads apart from the unframed band over the bar being read. In forced colors the frame is the system highlight color, as today.
- **New: the reading survives newer data.** A background ingest no longer ends the reading on either chart.
- **New: Escape closes the outcome trend's tooltip wherever the focus is**, as on Cost and the work chart.
- **Changed: the work chart grows with the text size.** Its bars keep their height at 200% text; today they shrink to 24px.
- **Changed: the newest bucket's label always shows**, right-aligned on its bar, at every width, so the tracks stay on the same points in a narrow box.
- **Changed: the peak label stays inside the plot**, on the work chart and on Cost. Near an edge it slides in; a plot narrower than the label draws none. At a larger text size a mid-width plot now shows it.
- **Fixed on Cost, found while building:** the bar being read no longer changes color and the 7-day average no longer gets dots in ECharts' palette; on a reload that lands on Cost, projects no longer show as "Other" until the next data arrives.
- **Wrapper additions**, reserved by the foundation: `status` (a sentence said once, such as "selected") and `onEscape` (Escape with no reading open). Shared option helpers for tracks, the selection mark, a line with dots, and the slider.
- **The browser check is split** into a harness, shared checks and one module per page, and gains Activity and Judgments.
- **Sparklines and Live's pulse stay hand-written SVG.** The data tables stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: a drawn chart with several tracks is read as one point and zooms as one; a drawn chart marks its selected point apart from the point being read; a lone line takes the system text color under forced colors; the work chart and the outcome trend keep their space while the drawing code loads; Escape closes the outcome trend's tooltip.
- `usage-dashboard`: the work chart can be zoomed without changing the view or the selection; the selected bar is framed; a status says once what a selection did; the reading and the zoom survive newer data; the chart grows with the text size; the bars use the rate track's room in a view without tool calls.
- `insights-dashboard`: the outcome trend keeps the week being read through newer data.

## Impact

- **Code.** `web/src/components/echart/`: `EChart.tsx` gains `status` and `onEscape`; `option.ts` gains the track, selection, line and slider helpers; `stack.ts` passes the point's index to `width`; `testing.ts` models the slider's axes; a new `zoomReset.tsx` shares "Show all" with Cost. `web/src/pages/activity/WorkChart.tsx` and `judgments/OutcomeTrend.tsx` are rewritten around `<EChart>`, with their figures and options in the new pure modules `workTracks.ts` and `judgments/outcomeWeeks.ts`. `ActivityPage.tsx` preloads the chunk. `chart.css`, `theme.css`, `activity.css` and `chart.ts` lose what only these two charts used.
- **Dependencies.** None added. No ECharts component is added to `echarts.ts`: the line series, the custom series, the grid and the slider are already registered.
- **Tests.** SVG geometry tests move to tests of the pure models and option builders. Component tests run on the fake runtime, which now refuses a slider that does not drive every x axis, a second axis pointer, a slider trend drawn from another series than `trend`, and a chart of several grids that leaves one to ECharts' own fit. One smoke test per chart draws on real ECharts in jsdom.
- **Tooling.** `web/scripts/check-bundle.mjs` gains budgets for `ActivityPage` and for the chart chunk Cost and Activity share (`zoomReset-*.js`). `tools/demo/chartfit.mjs` becomes a runner over `tools/demo/chartfit/`. `tools/demo/firstscreen.mjs` and `tools/demo/record.mjs` get the new selectors.
- **Images.** The docs site's `activity-work` and `tour-overview` shots, and the README's `activity`, `insights` and `tour` recordings, are recorded again.
- **Docs.** `CHANGELOG.md`, the Activity row of `README.md`, and the docs site's Activity, Judgments and keyboard pages.
- **Not changed.** The API, every payload, the page fixtures, stored data, the Content-Security-Policy, the ECharts chunk's budget, and Cost's behavior beyond the peak label and the two fixes above.
