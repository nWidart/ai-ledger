# Proposal

## Why

The Project page lists a project's eight most expensive sessions. It does not say whether that money bought anything, and it says nothing of the cheap sessions that got a lot done. A reader who wants to know "which of this project's sessions cost a lot and gave little, and which were cheap wins" has to open sessions one by one.

A scatter of sessions, cost across and output up, split at the medians into four named quadrants, answers that at a glance: the dots far right and low are the sessions to look at, the dots far left and high are the habits to keep. A design round proposed it as the "Session Efficiency Quadrant", drawn with Apache ECharts 6.1.0. This change plans it.

## What Changes

- **New block on the Project page: "Sessions by cost and tool calls".** One dot per session of the project in the view, its estimated cost across and its tool calls up, both on log scales. It sits in the right column after Sessions. No existing block changes.
- **The output is tool calls.** On the demo store, commits are 0 for 41% to 62% of a project's sessions (median 0 in 9 of 10 views), lines changed exist for Claude Code alone, and prompts take six values; tool calls are never 0 there, take 19 to 59 values per view and are recorded for Claude Code, Codex and Grok alike (design decision 1). A filled dot is a session that made a commit, a hollow one made none.
- **Four quadrants at the medians** of the sessions shown: "Cheap, much done", "Costly, much done", "Cheap, little done", "Costly, little done". Each is named on the plot when its name fits and always in a list under it, with its count.
- **Zero on a log axis.** A session at $0.00 or with no tool call sits in a narrow lane at the axis's start, labelled 0, drawn only when such a session exists.
- **Reading.** Left and Right step through the sessions from cheapest to costliest, Home and End go to the ends. The pointer reads the nearest dot. One tooltip and one polite sentence give the session's name, start, cost, tool calls, commits and quadrant. Enter or a click opens the session's sheet, as a row of Sessions does.
- **It follows the page's range, source and automated filters.** With fewer than three sessions it draws the dots with no split and says why. It says when it shows only the newest 300 sessions of the view, and how many sessions with no known cost it leaves out.
- **A data table** with one row per session.
- **Forced colors, dark, text size, reduced motion.** Under forced colors the dots, the guides and the labels are system colors and a commit is told by a filled dot, not by a hue. Nothing animates. Labels and margins grow with the text.
- **The usage payload's `sessions` rows gain their titles**, as `top_sessions` rows have them, so every dot has its name: one call to the existing `titles.with_titles()`, 17 ms of 340 ms on the demo store.
- **No change to the shared chart component.** No ECharts part is registered: the dots and guides are the custom series on a grid with two log axes, which are already in the chunk.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-page`: the new block, its axes, quadrants, zero lanes, reading, sheet, few-session and cut-off cases, table, and its place in the two columns.
- `dashboard-app`: a drawn scatter is read dot by dot, with the item read marked on its dot; a zero on a log axis of a drawn chart has a lane of its own. Both are added requirements: no existing requirement of `dashboard-app` is modified, so this change does not collide with the chart migrations in progress.

## Impact

- **Server.** `src/ai_ledger/metrics.py`: `usage()` passes its 300 `sessions` rows through `titles.with_titles()`. No stored data changes, no `rebuild`. Every page that reads `/api/usage` gets the titles; the session sheet's title cache (`UsageSheets.tsx`) already reads those rows.
- **Web.** A new folder `web/src/pages/project/quadrant/`: the pure model, fit and reading rule, the option, the component and its styles. `blocks.tsx` gains `QuadrantBlock`; `ProjectPage.tsx` renders it. `web/src/api.ts`: the `title` comment on `SessionRow`.
- **Shared chart component.** Not edited. `web/src/components/echart/echarts.ts` not edited. The ECharts chunk stays at 176.5 kB gzip.
- **Bundle.** The Project page is the third page to import `<EChart>`: the build then moves the wrapper out of `zoomReset-*.js` (7.7 kB to 2.1 kB) into a new shared `EChart-*.js` chunk (6.0 kB), measured. `web/scripts/check-bundle.mjs` gains limits for `EChart` and `ProjectPage`, so the shared chart code stays guarded.
- **Dependencies.** None added.
- **Tests.** One Python assertion; tests of the pure model, fit, reading rule and option; component tests on the fake runtime; one smoke test on real ECharts; the page's layout test. The generated usage fixtures change. About 360 net test lines.
- **Tooling.** `tools/demo/chartfit/quadrant.mjs` and its name in the runner.
- **Images and docs.** A new `project-quadrant` shot; `CHANGELOG.md`, the Project row of `README.md`, the docs site's Project, keyboard and glossary pages.
- **Open to the owner.** Questions at the end of `design.md`, and the wrapper additions that would let this graph drop its own reading ("For the owner of the shared chart component").
