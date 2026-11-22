# Proposal

## Why

The Project page lists a project's eight most expensive sessions. It does not say what that money paid for, and it says nothing of the cheap sessions that did a lot. A reader who wants to know "which of this project's sessions cost a lot and did little, and which were cheap and did much" has to open sessions one by one.

A scatter of sessions, cost across and tool calls up, split at the medians into four named quadrants, answers that at a glance: the dots far right and low are the sessions to look at, the dots far left and high are the habits to keep. A design round proposed it under another name, drawn with Apache ECharts 6.1.0. This change plans it.

## What Changes

- **New block on the Project page: "Sessions by cost and tool calls".** One dot per session of the project in the view, its estimated cost across and its tool calls up, both on log scales. It sits in the right column after Sessions. No existing block changes.
- **The vertical axis is tool calls.** They count what a session did, not what it produced. On the demo store, commits are 0 for 41% to 62% of a project's sessions (median 0 in 9 of 10 views), lines changed exist for Claude Code alone, and prompts take six values; tool calls are never 0 there, take 19 to 59 values per view and are recorded for Claude Code, Codex and Grok alike (design decision 1). A filled dot is a session that made a commit, a hollow one made none. The hint ends: "Done" counts tool calls, not results.
- **Four quadrants at the medians** of the sessions shown: "Cheap, much done", "Costly, much done", "Cheap, little done", "Costly, little done". Each is named on the plot when its name fits and always in a list under it ("Sessions per quadrant"), with its count.
- **Zero on a log axis.** A session at $0 or with no tool call sits in a narrow lane at the axis's start, labelled "$0" on the cost axis and "0" on the tool-call axis, drawn only when such a session exists. The lane lies under the power of ten at or below the lowest value and spans at most one decade.
- **Reading.** Left and Right step through the sessions from cheapest to costliest, Home and End go to the ends; Up and Down are left to the page. The pointer reads the nearest dot within 12px. One tooltip and one polite sentence give the session's name, start, cost, tool calls, commits and quadrant. Enter or a click opens the session's sheet, as a row of Sessions does; when the sheet closes, Right and Left go on from that dot.
- **It follows the page's range, source and automated filters.** With fewer than three sessions it draws the dots with no split and says why. It says when it shows only the newest 300 sessions of the view, and how many sessions with no known cost it leaves out.
- **A data table**, "Sessions on the plot", with one row per session.
- **Forced colors, dark, text size, reduced motion.** Under forced colors the dots, the guides and the labels are system colors and a commit is told by a filled dot, not by a hue. Nothing animates. Labels and margins grow with the text.
- **The usage payload's `sessions` rows gain their titles**, as `top_sessions` rows have them, so every dot has its name: one title lookup over both lists. For one project's view every `sessions` row may fall back to its first prompt; over all projects only the `top_sessions` rows may, because that fallback reads raw lines.
- **No change to the shared chart component.** No ECharts part is registered: the dots and guides are the custom series on a grid with two log axes, which are already in the chunk.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-page`: the new block, its axes, quadrants, zero lanes, reading, sheet, few-session and cut-off cases, table, and its place in the two columns.
- `dashboard-app`: a drawn scatter is read dot by dot, with the item read marked on its dot; a zero on a log axis of a drawn chart has a lane of its own. Both are added requirements: no existing requirement of `dashboard-app` is modified, so this change does not collide with the chart migrations in progress.

## Impact

- **Server.** `src/ai_ledger/metrics.py`: `usage()` passes its 300 `sessions` rows and its 50 `top_sessions` rows through one `titles.with_titles()` call. `src/ai_ledger/titles.py`: `titles()` and `with_titles()` take `prompts` as True, False or the session ids whose first prompt may be read. No stored data changes, no `rebuild`. Every page that reads `/api/usage` gets the titles; the session sheet's title cache (`UsageSheets.tsx`) already reads those rows.
- **Web.** A new folder `web/src/pages/project/quadrant/`: the pure model, fit and reading rule, the option, the component and its styles. `blocks.tsx` gains `QuadrantBlock`; `ProjectPage.tsx` renders it. `web/src/api.ts`: the `title` comment on `SessionRow`.
- **Shared chart component.** Not edited. `web/src/components/echart/echarts.ts` not edited. The ECharts chunk stays at 176.5 kB gzip.
- **Bundle.** The Project page draws with `<EChart>` but does not zoom: the build moves the wrapper out of `zoomReset-*.js` into a shared `EChart-*.js` chunk, which Cost, Activity, Errors and Project load. Measured on the build rebased on main: `ProjectPage-*.js` 9.0 kB, `EChart-*.js` 6.3 kB, `zoomReset-*.js` 1.2 kB. `web/scripts/check-bundle.mjs` gains limits for `ProjectPage` (11 kB) and `EChart` (8 kB) and lowers `zoomReset`'s to 3 kB, so the shared chart code stays guarded.
- **Dependencies.** None added.
- **Tests.** One Python test; tests of the pure model, fit, reading rule and option; component tests on the fake runtime; one smoke test on real ECharts; the page's layout test and one page test of the block. The generated usage fixtures change. 611 net test lines (`verification.md` says why).
- **Tooling.** `tools/demo/chartfit/quadrant.mjs` (69 lines) and its name in the runner.
- **Images and docs.** A new `project-quadrant` shot; `CHANGELOG.md`, the Project row of `README.md`, the docs site's Project, keyboard and glossary pages.
- **Open to the owner.** Questions at the end of `design.md`, and the wrapper additions that would let this graph drop its own reading ("For the owner of the shared chart component").
