# Proposal

## Why

Activity's Overview asks the reader to do too much work. The work chart draws volume bars and an error-rate line on two y-axes, so neither reads at a glance. Seven vitals tiles state figures that lead nowhere. Below them sit seven closed drawers, and an 11-pill section bar sits over the page to reach them. A weekly chart, the default for long ranges, cannot be drilled into at all. The prompts-by-hour heatmap filters nothing and answers no question the page asks.

## What Changes

- **Two-track work chart.** The volume bars (commits, prompts or sessions) get the top track. A thin track under them, on the same x-axis, draws errors per 100 tool calls with the existing low-call guard. The right-hand rate axis goes.
- **Week drill-down.** Week bars become selectable by click and by keyboard, as day bars are. A selected week narrows every workbench tab to that week. A chip in the chart header names the selection and clears it, and so does Escape on the chart. The week is kept in the URL (`week=YYYY-MM-DD`, its Monday), cleared like `day` when the view changes.
- **Vitals.** Five tiles, each a link or a button to its destination: Sessions (Sessions tab), Errors per 100 calls (Errors page), Test runs passed (the failed test runs in Loops and tests), Subagents (Projects tab, by subagent share), Output speed (Sessions tab, by active time). Output speed gets a sparkline per chart bucket. Median session folds into the Sessions tile. Prompts interrupted moves to a line under the lede. On a Codex-only view, Output speed becomes a quiet note under the strip.
- **Workbench tabs.** WAI-ARIA tabs replace the seven drawers and the section index: Sessions | Projects | Tools and MCP | Loops and tests. The active tab is in the URL (`tab=`). Loops and tests shows the five newest error loops and failed test runs, each list with "Show all N".
- **Work hours.** The prompts-by-hour heatmap and the payload's `work_hours` are removed. **BREAKING** for anyone who read it.
- **API.** `/api/day` and `/api/sessions` take `days` (1 or 7), so a week drill-down asks for seven days from its Monday. `/api/day` also returns the span's project metrics and failed test runs. `/api/usage` gains `speed_trend`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: the work chart's tracks and week selection, the vitals and their destinations, the workbench tabs, the removal of the heatmap.
- `dashboard-app`: drawer scenarios that named Activity move to other pages; the first screen holds Activity's tab list too.
- `tool-inspector`: the inspector opens from the Tools and MCP tab, not drawers.

## Impact

- `src/ai_ledger/metrics.py`: `on_day()` takes a span; `day_view()` adds project metrics and failed test runs; `session_list()` takes `days`; `usage()` drops `work_hours` and adds `speed_trend`.
- `src/ai_ledger/app.py`: `days` on `/api/day` and `/api/sessions`.
- `web/src/pages/activity/`: `WorkChart.tsx`, `ActivityPage.tsx`, `tables.tsx`, `SessionsDrawer.tsx` (now a tab panel), `search.ts`, a new `Workbench.tsx`; `WorkHours.tsx` goes.
- `web/src/url.ts`: `week` joins `day` among the keys a view change drops.
- `web/src/api.ts`: `DayView`, `sessionsUrl`, `dayUrl`, `UsagePayload`.
- Tests, page fixtures, README, the docs site, `tools/demo/firstscreen.mjs`.
