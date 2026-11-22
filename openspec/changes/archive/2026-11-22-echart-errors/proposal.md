# Proposal

## Why

The owner is moving every chart in the web UI from hand-written SVG to Apache ECharts 6, one page at a time, behind one shared chart component. Cost's daily chart, Activity's work chart and the outcome trend are done. Errors is next: its rate chart still carries its own pointer math, key handlers, tooltip placement, resize handling and text scaling. It is also the first chart with marks that cross its tracks (fix markers and no-activity bands), which Context, Limits and the session sheets need after it.

## What Changes

- **The Errors rate chart on the shared chart component.** Same two panels on one time axis: the error rate as a line above, the failed calls by type as stacked bars below. Same legend, type selection, fix markers, no-activity bands, folded stretches, hollow dots for buckets with few calls, tooltip, readout, bucket selection and data table.
- **New: a zoom**, by the rules of Cost and Activity: a slider under the bucket labels from 14 points, down to 7, plus and minus keys, and "Show all days" or "Show all weeks". It narrows the drawing only.
- **New: the reading survives newer data.** A background ingest, a saved fix marker or a resize no longer ends the reading.
- **New: Escape closes the chart's tooltip wherever the focus is**, as on the other drawn charts.
- **Changed: the selected bucket is a tinted band in a thin accent frame.** It replaces the grey wash with a triangle under the axis.
- **Changed: after a selection the reading stays on the point**, so the same key or click clears it. The chart's own live region says once what the selection did.
- **Changed: the chart grows with the text size.** Both panels keep their height at 200% text; today the bars shrink.
- **Changed: marks stay inside the plot.** A fix label moves to the other side of its line near the right edge, labels of fixes on one bucket stack, the "no activity" label shows only where it fits, and a panel title is cut with "…" in a narrow plot.
- **Wrapper addition**, reserved by `echart-foundation`: `keys={{ space: true }}`, so Space selects on Errors as it does today. One wrapper rule changes for every chart: the end of a reading drops only its own sentence, so a status that arrived while it was open stays in the live region.
- **Shared helpers**: a title for a track, cut by its measured width, the text measure, and an opacity for a stack segment's fill. Every chart draws again once the page's web fonts have loaded, so its texts are measured in the font they are drawn in. The fake chart runtime refuses a zoom window narrower than the slider allows.
- **The browser check gains Errors** (`tools/demo/chartfit/errors.mjs`), and the bundle check gains a budget for the Errors page chunk.
- **Sparklines stay hand-written SVG**: the type table's trend and the detail's mini rate chart. The data tables stay as they are.

`design.md` lists every difference a user can notice, under "Visible differences", and the defaults the owner may flip.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `errors-dashboard`: the rate chart can be zoomed without changing the view or the selection; a status says once what a selection on the chart did; the reading and the zoom survive newer data; the chart's marks stay inside the plot; the chart grows with the text size.
- `dashboard-app`: the Errors rate chart keeps its space while the drawing code loads.

## Impact

- **Code.** `web/src/pages/errors/RateChart.tsx` is rewritten around `<EChart>`, with its figures and option in the new pure module `rateTracks.ts`. `ErrorsPage.tsx` preloads the chunk and watches a stable box for the mini chart. `web/src/components/echart/`: `EChart.tsx` gains `keys` and keeps a status through the end of a reading; `option.ts` gains `axisTitle` and `labelWidth`; `stack.ts` takes a fill opacity per kind; `tokens.ts` gives a new chart environment when web fonts finish loading; `testing.ts` enforces the slider's minimum window. `errors.css`, `theme.css` and `theme.test.ts` lose what only the SVG chart used.
- **Dependencies.** None added. No ECharts component is added to `echarts.ts`: the marks are custom series, which are registered.
- **Tests.** The SVG chart's tests in `ErrorsPage.test.tsx` move to tests of the pure model and option (`rateTracks.test.ts`), run on the fake runtime, or go where the wrapper already tests the rule. `RateChart.real.test.tsx` draws the chart on real ECharts in jsdom, with the path readers it shares with the Cost and Activity real tests in `realTesting.ts`.
- **Tooling.** `web/scripts/check-bundle.mjs` gains `ErrorsPage`. `tools/demo/chartfit.mjs` gains the `errors` page. `tools/demo/firstscreen.mjs` gets the new selector for the chart's first bar.
- **Images.** The docs site's `errors-chart` shot, and the README's `errors` and `tour` recordings, are recorded again.
- **Docs.** `CHANGELOG.md`, the Errors row of `README.md`, the docs site's Errors and keyboard pages, and `web/src/pages/errors/PARITY.md`.
- **Not changed.** The API, every payload, the page fixtures, stored data, the URL keys, the Content-Security-Policy, the ECharts chunk and its budget, the type table, the detail, and the Cost and Activity charts' options. Those charts share the two wrapper rules above: the redraw when web fonts load, and the status kept through the end of a reading.
