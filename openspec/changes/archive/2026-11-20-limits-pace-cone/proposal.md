# Proposal

## Why

A design review of the Limits page found it hard to read:

- Each open-window chart is 168px tall and draws nine encodings: measured, reading, estimated, forecast, last 24 h pace, likely range, now, limit and plan change. A key above the grid names them all.
- Each card stacks up to seven lines of text under its chart: caption, last-24-hours line, weekly share, surfaces, pace, cap money and "What used this window". The pace sentence ("usual pace 6.8% a day; this window 34%…; 12.1% a day would use it all") is the hardest to read.
- The status strip under the heading repeats every percent and "resets in" that the cards show just below it.
- The past-window bars, which answer "how did my past windows end?", sit in a closed "Past windows" drawer. The open "Left unused" panel shows one average per limit, which hides how the windows are spread.
- The filter bar shows Project and Range, and then a hint says that they do not apply to the open windows. Project changes only one table in the closed "What a point buys" drawer.

## What Changes

- **Pace cone chart.** Each open-window chart draws four things. It draws the actual line (measured solid, estimated faded) and the forecast as a shaded cone, with a warning tint when the cone reaches 100% before the reset. It draws a `now` tick, and a faint straight line from now to 100% at the reset: the safe pace. A curve steeper than that line runs hot. The 100% line stays as a grid line. Reading dots and the separate forecast-middle style go. The page has no chart key.
- **Last 24 h pace behind one toggle.** One "Last 24 h pace" toggle above the card grid draws the last-24-hours line on every chart. It is off on every load.
- **Plan changes as labelled ticks.** A plan change inside a window is a short tick with a label at the top of the chart, so it needs no key.
- **Card footer.** The card header gives the percent used now and a short status: "runs out <time>", "at its limit until <time>", "about N% at reset" or "no forecast". Under the chart, a three-column footer gives headroom (percent left and time to reset), pace (current %/day against safe %/day) and the top project. Everything else is in one `Details` disclosure: the full forecast caption, the last-24-hours sentence, the usual and recent paces, the weekly share, surfaces, cap money, what used the window, and the chart's data as a table.
- **No status strip.** The status strip goes. The nav's Limits badge stays.
- **Past windows on the page.** The past-window strips move out of their drawer into a visible "Past windows" section. This section replaces "Left unused". Each strip row says "avg N% unused · K hits". Clicking a bar still opens that window's curve. The table of closed windows is behind a "Show data table" toggle.
- **Filters.** The page header keeps only Source. The Range segment moves to the "Past windows" section header, the part of the page that it changes. The page has no Project filter, and the page no longer sends a project to `/api/limits`.
- **What a point buys.** The drawer stays. Its commits-a-point table always lists every project, with the smaller ones folded. A project's own figures stay on the Project page's "Plan limits" block.
- **Trim.** The heading gives at most two figures. The hints are one line each. The forecast method and the note on local estimates move into a "How measured" disclosure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `limits-dashboard`: the open-window chart, card, status strip, past windows, unused capacity, filters, value and heading requirements change as listed above.

## Impact

- `web/src/pages/limits/`: `LimitsPage.tsx`, `LimitChart.tsx`, `limits.ts`, `limits.css` and their tests.
- `web/src/components/Filters.tsx`: a `project` prop to hide the picker, and the range segment exported for use elsewhere on the page. `Drawer.tsx` does not change.
- `web/src/theme.css`: forced-colors rules for the Limits chart.
- No payload change. `/api/limits` keeps its `project` parameter, which the Project page uses, and its `projects` field.
- `tools/demo/record.mjs`: the Limits scene and the docs-site shots no longer open a "Past windows" drawer or a "Left unused" panel.
- Docs: `README.md`, the docs-site Limits page and its screenshots, and `CHANGELOG.md` `[Unreleased]`.
