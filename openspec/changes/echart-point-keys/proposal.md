# Proposal

## Why

Every chart on the shared chart component keeps the point being read and the zoom window by index. So each chart puts its first point in its `view` key: when that point moves, the chart is treated as another view, and the reading and the zoom are dropped. They are dropped though the point read is still drawn. It happens in four cases of the same scope: older calls are ingested on an all-time range, a rolling range moves on a day at midnight, a backfill lands inside the range, and on Errors a folded stretch appears, grows or opens.

On Errors this also breaks a key. A selection keeps the reading on its point, so that Space clears it. After such a redraw nothing is read, and Space does nothing. The hand-written Errors chart kept its cursor by date, and had a test for it. The limit is recorded in the archived `echart-errors` design (decision 8 and its risks), which names the fix: a `pointKeys` prop.

## What Changes

- **Wrapper addition: `pointKeys`.** A chart gives each point's key, in order. When a redraw of the same view brings other keys, the wrapper keeps the reading and the zoom on the keys they were on. A point read that is still drawn is read at its new index. The points shown run from the first to the last of the points shown before that are still drawn. Nothing is said.
- **A reading on a point that is gone ends.** A zoom with none of its points left, or with every point in it, ends, and the chart says so once, as it does today when a zoom ends with no one asking.
- **The tooltip never shows over another point.** A key's tooltip is placed after the new drawing, never before it. A pointer's tooltip stays beside the pointer while the point read is still under it; else it goes over the point, with the band.
- **A slider drag in progress goes on** from the window the wrapper put back, and the release says the points shown once.
- **The four charts use it.** Cost's daily chart, Activity's work chart, the outcome trend and the Errors rate chart pass their days, weeks or buckets as keys. Their `view` keys lose the first point, Errors' loses its folds, and the outcome trend's loses its list of weeks.
- **Errors: Space clears the selection after a backfill**, since the reading stays on the selected point.
- **The browser check gains a backfill** on each of the four charts, through an answered payload.

`design.md` records what a spike measured on real ECharts 6.1.0, each decision with its reason, and the defaults the owner may flip.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: a drawn chart keeps its reading and its zoom on the same points when newer data of the same view moves them.
- `cost-dashboard`: the daily chart's zoom no longer resets when the view's first day moves.
- `usage-dashboard`: the work chart's zoom no longer resets when the view's first bar moves.
- `insights-dashboard`: the outcome trend's reading no longer ends when a week joins or leaves the trend.
- `errors-dashboard`: the rate chart's reading and zoom no longer end when its first point or a folded stretch moves, and Space still clears the selection after it.

## Impact

- **Code.** `web/src/components/echart/EChart.tsx` gains `pointKeys`, two branches in its render chain (the remap, and a check of the keys when the count of points changes under them), an effect that tells the console of a list it cannot go by, and two placement rules for the tooltip. `rateTracks.ts`, `RateChart.tsx`, `CostChart.tsx`, `workTracks.ts`, `WorkChart.tsx` and `OutcomeTrend.tsx` pass keys and shorten their `view` keys.
- **Dependencies.** None added. Nothing is added to the ECharts chunk.
- **Tests.** The remap rule is tested once, in `EChart.test.tsx`. A new `EChart.real.test.tsx` runs it on real ECharts in jsdom, a slider drag included. Each page gets one wiring assertion, in a test that already builds its fixture. The fake runtime gains no behavior: its header names what it does not model. Estimate: 250 to 300 net test lines. As built: 444 added, 42 removed, 402 net, two over the advisory 400; `design.md` (decision 10) says why.
- **Tooling.** `tools/demo/chartfit/checks.mjs` gains a shared backfill check, and `cost.mjs`, `activity.mjs`, `judgments.mjs` and `errors.mjs` run it.
- **Docs.** `CHANGELOG.md`, three sentences of the docs site (Cost, Activity, Errors), one widened on Insights (the outcome trend) and one entry of `web/src/pages/errors/PARITY.md`. `README.md` has no sentence that becomes untrue.
- **Not changed.** The API, every payload, the page fixtures, stored data, the URL keys, the option builders' drawings, the zoom's rules and words, and the Context page: another change migrates it and builds on this contract.
