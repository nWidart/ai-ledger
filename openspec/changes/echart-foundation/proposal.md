# Proposal

## Why

Every chart in the web UI is hand-written SVG: eleven components that each repeat the same pointer math, key handler, tooltip placement, live readout and text scaling, about 2,000 lines in all. A new chart idea (a zoom slider, a brush, a second axis) means writing it eleven times. The owner has decided to move all charts to Apache ECharts 6. This change builds the shared foundation and migrates one chart, Cost's per-day chart, as the reference that later changes copy for Activity, Context, Errors, Limits, Live and the sheets.

## What Changes

- **New dependency.** `echarts` 6.1.0, loaded as its own lazy chunk with tree-shaken imports and the SVG renderer. No page pays for it until a chart mounts.
- **One chart component.** `<EChart>` owns loading, the theme, resize, disposal, reduced motion and the placeholder. It also owns the accessibility layer every chart has today: a focusable labelled group, arrow keys, Home, End, Enter and Escape, the tooltip, the polite readout, and system colors under forced colors. ECharts draws; React keeps the reading state, the words and the data table.
- **Theme from the CSS tokens.** Chart colors are read from the tokens in `theme.css` and read again when the theme, the OS scheme or forced colors changes, with no reload.
- **Cost's daily chart on ECharts.** Same stackings, metrics, scales, 7-day average, legend, today-so-far hatch, peak label, day selection, tooltip, readout and data table. The thin-segment rule is kept exactly: the stack is drawn from the same slot arithmetic as today.
- **New: a zoom slider under Cost's daily chart**, in views of 14 days or more. It narrows the days the chart shows. It does not change the page's range, the URL, the request, the totals or the data table. The keyboard zooms with plus and minus, and "Show all days" resets it.
- **New: Escape dismisses Cost's tooltip wherever the focus is**, as the spec already asks and Activity already does.
- **A bundle budget** in `npm run check` and CI: the ECharts chunk stays under 195 kB gzip (182 kB measured), and the entry chunk does not grow.
- **Sparklines stay hand-written SVG.** Every other chart stays as it is until its own change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: a chart keeps its space while its drawing code loads and stays readable when that code fails; chart colors follow the theme without a reload; a drawn chart uses system colors under forced colors; a chart does not animate under reduced motion; the drawing is hidden from assistive technology.
- `cost-dashboard`: the daily chart can be zoomed without changing the view.

## Impact

- **Code.** New `web/src/components/echart/` (the wrapper, the lazy runtime, the token resolver, the stack and option helpers, a test fake). `web/src/pages/cost/CostChart.tsx` is rewritten around `<EChart>`, with its figures and option in a new pure module `costChart.ts`. `chart.css`, `theme.css` and `cost.css` lose their Cost-only SVG rules. `chart.ts` stays for the charts not yet migrated.
- **Dependencies.** `echarts` 6.1.0 (brings `zrender` and `tslib`). The packaged web build grows by about 0.54 MB (182 kB gzip), in one lazy chunk.
- **Tests.** `CostChart.test.tsx` keeps its keyboard, tooltip, readout, legend and table tests; its SVG geometry tests move to tests of the pure option builder and the stack helper. New wrapper tests run against a fake runtime, and one smoke test draws with real ECharts in jsdom.
- **Tooling.** `web/scripts/check-bundle.mjs`, a `tools/demo` browser check for the chart, and new selectors in `tools/demo/firstscreen.mjs`. The docs site's Cost chart images are recorded again.
- **Not changed.** The API, every payload, the page fixtures, stored data and the Content-Security-Policy: ECharts ran under the app's exact policy with no violation.
