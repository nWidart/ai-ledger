# Proposal

## Why

The owner is moving every chart in the web UI from hand-written SVG to Apache ECharts 6, one page at a time, behind one shared chart component. Cost's daily chart, Activity's work chart, the outcome trend and Errors' rate chart are done. Context is next. It holds four hand-written SVG charts, each with its own pointer math, key handler, tooltip placement, resize handling and text scaling: the cache chart, the growth chart, the weekly start chart and the session map. They are also the first charts with a band between two series, a strip of bars under a line, and a scatter on a log axis, which Limits and the session sheets need after it.

## What Changes

- **Four Context charts are drawn by the shared chart component**: "Cache use over time", the growth chart, "Median start by week" and "Sessions by start and peak". Each keeps its legend, its switches, its label, its words and its data table.
- **The cache chart**: the same three tracks over the same days or weeks, on the pattern of Errors' rate chart. **New: a zoom**, by the rules of Cost, Activity and Errors: a slider from 14 days or weeks, down to 7, plus and minus keys, and "Show all days" or "Show all weeks".
- **The growth chart**: the median line, its 25th to 75th percentile band, the project lines, the 80% line in share mode, and the strip of sessions still running as a second track under the curve. **New: a tooltip** at the turn being read, in place of the line of text under the chart.
- **The weekly start chart**: weeks placed by date, the band broken at a week with no session, a span for a lone week, the 30,000-token line. **New: a tooltip**, as on the growth chart.
- **The session map**: the shared component draws the axes, the lines, the quadrant names and up to 1,000 dots; the map keeps its own reading, by the nearest dot within 12px, as it reads today. No wrapper change.
- **Changed: an empty day or week is read.** On the cache chart and the weekly start chart, the arrow keys and the pointer stop on a day or week with no data and say so, as Cost, Activity and Errors read a quiet day. Today they skip it.
- **Changed: after newer data the reading stays on its point**: its day, week, turn or session. Today it stays on its index, which can then be another day or another session.
- **Changed: every chart grows with the text size**, so no plot shrinks at 200% text.
- **Changed: Escape closes a chart's tooltip wherever the focus is.**
- **Changed: the line of text under each chart that repeated the reading is gone.** The tooltip shows the figures; the live region still says the sentence (the map's is for screen readers only).
- **Changed: at 343px and 32px text the session map leaves out what does not fit**: a quadrant's name, the "80% of window" label, and the long x title. The quadrant buttons under the map still name all four.
- **The window pressure bars stay HTML**: each segment is a real button with its own list.
- **No wrapper contract change, nothing new in the ECharts chunk, no change to the shared chart files.** Bands, lines across the plot and dots are custom series, which are registered; the log axis comes with the grid.
- **The browser check gains Context** (`tools/demo/chartfit/context.mjs`), and the bundle check gains a budget for the Context page chunk.

`design.md` lists every difference a user can notice under "Differences the owner sees", the defaults the owner may flip, and what needs the owner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `context-dashboard`: the cache chart can be zoomed; an empty day or week is read on the cache and weekly start charts; the growth and weekly start charts show a tooltip; the reading stays on its point through newer data; the charts grow with the text size; the cache chart's stacks follow the shared stack rule; the session map names a quadrant on the plot where its name fits.
- `dashboard-app`: Context's four charts keep their space while the drawing code loads, and Escape dismisses their tooltips.

## Impact

- **Code.** In `web/src/pages/context/`: `CacheChart.tsx`, `GrowthChart.tsx`, `StartTrend.tsx` and `SessionMap.tsx` are rewritten around `<EChart>`, each with its figures and option in a new pure module (`cacheTracks.ts`, `growthCurves.ts`, `startWeeks.ts`, `mapDots.ts`), and the parts two of them share in `chartParts.ts`. `ContextPage.tsx` preloads the chunk and names the view; `sections.tsx` passes it down. `theme.css` gains two color tokens for the cache breaks. The page's stylesheets lose what only the SVG charts used.
- **Shared chart files.** None changes: `EChart.tsx`, `option.ts`, `stack.ts`, `tokens.ts`, `testing.ts`, `zoomReset.tsx`, `realTesting.ts` and `echarts.ts` are as they are.
- **Dependencies.** None added.
- **Built on `echart-point-keys`.** That change has merged (PR #219). The three swaps that pass a `view` key and `pointKeys` to the wrapper waited for it: the cache chart passes each slot's first day, the growth chart each turn, the weekly start chart each slot's week. The models, the page wiring and the session map did not wait; the map passes no `pointKeys` and keeps its reading on the session's id.
- **Tests.** The SVG charts' tests move to tests of the pure modules, run on the fake runtime, or go where the wrapper already tests the rule. Each chart gets one smoke test on real ECharts in jsdom.
- **Tooling.** `web/scripts/check-bundle.mjs` gains `ContextPage`. `tools/demo/chartfit.mjs` gains the `context` page. `tools/demo/record.mjs` gets the new selector for the session map.
- **Images.** The docs site's `context-starting`, `context-growth`, `context-pressure` and `context-cost` shots, and the README's `context` and `tour` recordings, are recorded again.
- **Docs.** `CHANGELOG.md`, the Context row of `README.md`, and the docs site's Context and keyboard pages.
- **Not changed.** The API, every payload, the page fixtures, stored data, the URL keys, the Content-Security-Policy, the ECharts chunk and its budget, the data tables, the start ranges, the window grids, the window pressure bars, the contributors, the tips, and the charts of Cost, Activity and Errors.
