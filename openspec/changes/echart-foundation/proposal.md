# Proposal

## Why

Every chart in the web UI is hand-written SVG: eleven components that each repeat the same pointer math, key handler, tooltip placement, live readout and text scaling, about 2,000 lines in all. A new chart idea (a zoom slider, a brush, a second axis) means writing it eleven times. The owner has decided to move all charts to Apache ECharts 6. This change builds the shared foundation and migrates one chart, Cost's per-day chart, as the reference that later changes copy for Activity, Context, Errors, Limits, Live and the sheets.

## What Changes

- **New dependency.** `echarts` 6.1.0, loaded as its own lazy chunk with tree-shaken imports and the SVG renderer. No page pays for it until a chart mounts.
- **One chart component.** `<EChart>` owns loading, the theme, resize, disposal, reduced motion and the placeholder. It also owns the accessibility layer every chart has today: a focusable labelled group, arrow keys, Home, End, Enter and Escape, the tooltip, the polite readout, and system colors under forced colors. ECharts draws; React keeps the reading state, the words and the data table.
- **Theme from the CSS tokens.** Chart colors are read from the tokens in `theme.css` and read again when the theme, the OS scheme or forced colors changes, with no reload.
- **Cost's daily chart on ECharts.** Same stackings, metrics, scales, 7-day average, legend, today-so-far hatch, peak label, day selection, tooltip, readout and data table. The thin-segment rule is kept exactly: the stack is drawn from the same slot arithmetic as today.
- **New: a zoom slider under Cost's daily chart**, in views of 14 days or more. It narrows the days the chart shows, down to 7. It does not change the page's range, the URL, the request, the totals or the data table. The keyboard zooms with plus and minus, and "Show all days" resets it. The zoom and the day being read belong to the view: newer data for the same view (a background ingest) and a hidden token kind keep them, and a new view resets them. The wrapper's `view` prop names the view.
- **New: Escape dismisses Cost's tooltip wherever the focus is**, as the spec already asks and Activity already does.
- **A bundle budget** in `npm run check` and CI: the ECharts chunk stays under 195 kB gzip (176.5 kB built), and the entry chunk does not grow past 130 kB (121.7 kB built).
- **Sparklines stay hand-written SVG.** Every other chart stays as it is until its own change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: a chart keeps its space while its drawing code loads and stays readable when that code fails; chart colors follow the theme without a reload; a drawn chart uses system colors under forced colors; a chart does not animate under reduced motion; the drawing is hidden from assistive technology.
- `cost-dashboard`: the daily chart can be zoomed without changing the view.

## Impact

- **Code.** New `web/src/components/echart/` (the wrapper `EChart.tsx` and `EChart.css`, the lazy runtime `echarts.ts` and `load.ts`, the token resolver `tokens.ts`, the stack and option helpers `stack.ts` and `option.ts`, and the test fake `testing.ts`). `web/src/pages/cost/CostChart.tsx` is rewritten around `<EChart>`, with its figures and option in a new pure module `costDaily.ts`, and `CostPage.tsx` preloads the chunk. `chart.ts` gives `niceMax()` to both paths and stays for the charts not yet migrated. `chart.css` and `theme.css` lose their Cost-only SVG rules; `cost.css` loses one and places "Show all days". `test-setup.ts` mocks the runtime with the fake, and `vite.config.ts` raises the chunk-size warning limit.
- **Dependencies.** `echarts` 6.1.0 (brings `zrender` and `tslib`). The packaged web build grows by about 0.52 MB (176.5 kB gzip), in one lazy chunk.
- **Tests.** `CostChart.test.tsx` keeps its keyboard, tooltip, readout, legend and table tests and gains the zoom and refresh tests; its SVG geometry tests move to tests of the pure option builder (`costDaily.test.ts`) and the stack helper. New wrapper tests run against a fake runtime that merges options as ECharts 6 does, the fake has tests of its own, and one smoke test (`CostChart.real.test.tsx`) draws with real ECharts in jsdom. `CostPage.test.tsx` checks that zooming leaves the page's view alone and that an ingest keeps the zoom.
- **Tooling.** `web/scripts/check-bundle.mjs`, run by `npm run check` and by CI's `web-build` job (`.github/workflows/ci.yml`). A new browser check, `tools/demo/chartfit.mjs`, run locally. `tools/demo/firstscreen.mjs` gets a selector for Cost's drawn bars, and a fix for the Judgments view's Outcomes selector, which was already stale on `main`.
- **Images.** The docs site's Cost chart shots (`cost-spend.png`, `cost-spend-light.png`), the README's Cost GIFs (`docs/cost.gif`, `docs/cost-light.gif`) and the tour recordings (`docs/tour*.gif`, `docs/tour*.mp4`) are recorded again.
- **Docs.** `CHANGELOG.md`, the Cost row of `README.md`, and the docs site's Cost page and keyboard page.
- **Not changed.** The API, every payload, the page fixtures, stored data and the Content-Security-Policy: ECharts ran under the app's exact policy with no violation.
