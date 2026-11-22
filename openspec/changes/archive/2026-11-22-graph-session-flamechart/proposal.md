# Proposal

## Why

The session sheet tells what a session did, what it cost and where it failed. It does not tell where the wall-clock time went or what ran at once. The timeline draws every tool call as a 1px tick at its start and ignores its end. A six-minute test run, a subagent the main thread waited on for twenty minutes, three subagents working side by side: none of these shows. The Tools table's p50 hides the one long call, and the stat line's tool time is one total.

A chart of real tool-call spans, one lane per thread, answers that: each call is a bar from its start to its result, on the main thread or on its subagent's lane, on the timeline's own time axis. The long bars are where the time went; bars stacked in one lane ran at once; lanes side by side in time are subagents working in parallel. The research note `.claude/plans/recommendation-treemap-flamechart.md` (section 2) proposed it, and the owner accepted its picks on 2026-11-22. This change plans it.

## What Changes

- **New section in the session sheet: "Tool calls by thread".** It sits after the timeline (and its Events list) and before Error loops. One lane per thread: the main thread first, then each subagent in the order it made its first call, then one lane for subagent calls that cannot be told apart. Each call is a bar from its start to its end, at least 1px wide. A failed call is a hollow bar, or a 2px failure tick taller than its row when it is narrower than 4px or has no recorded duration; a call with no result is a ring at its start; any other call with no recorded duration is a 1px tick. Calls that ran at once stack in rows within their lane.
- **The timeline's time axis.** The section measures its own box, which has the timeline's width, and places every call with `timelineModel()`'s `x()` (`web/src/components/sheets/session.ts`), imported and never edited. So a call's bar starts under its tick on the timeline, and the idle gaps the timeline squeezes out are squeezed here too.
- **A call past the axis's end** (the axis ends at the last start, request or compaction): its bar runs on into the plot's right margin and ends in a point inside the box. On the demo store 794 of 15,567 calls (in 418 of 544 sessions) end after the axis's end, by up to 250px at the sheet's 552px plot (design decision 3). The sentence, the tooltip and the table give the true times.
- **A call that runs through a squeezed idle gap** (a call over 20 minutes with nothing else starting during it): its bar is drawn squeezed, up to the far side of the break. Its true duration is in the sentence, the tooltip and the table, and the section's own key says so (decision 4).
- **Reading by keyboard and pointer, its own.** Left and Right step through a lane's calls by start; Up and Down move to the lane above or below, to its call nearest in time; Home and End go to the lane's first and last call; Escape ends the reading. The pointer reads the call under it. One tooltip and one polite sentence give the tool, its input, the thread, the times, the duration, the result and how many calls ran at the same time. Enter or a click opens the tool's sheet in place of the session sheet, as the Tools table's rows do; the browser's Back returns. The shared chart wrapper draws only (`points={0}`, `read={() => ""}`), as on the three graphs built before (decision 7).
- **A data table, "Calls by duration"**, longest first, the first 20 and then Show all, through the shared `Table` component unchanged.
- **Caps, assumed from the demo store.** At most 4 rows on the main thread and 3 on a subagent's lane; after 6 subagent lanes the rest fold into "Other subagents (N)". A call past a lane's last row is drawn over that row and counted in a note.
- **Long, short and empty sessions.** A session cut at the 5,000-call cap says so, as the timeline does. A session with no tool call, or one the timeline cannot draw, shows a line in place of the chart.
- **Forced colors, dark, text size, reduced motion.** Bars, rings, breaks and labels take system colors under forced colors, and a failed call is told by its shape, not its hue. Nothing animates.
- **The session payload's calls gain `lane` and `input`.** `lane` is 0 for the main thread; for a subagent call, the rank of the file that holds its result among the session's subagent files, by each file's first call; null when the call's agent cannot be told (no result file, or the main thread's own file, as old Claude Code transcripts wrote it). The result file's path never leaves the server. `input` is the call's input summary cut to 120 characters. The payload also gains `calls_truncated`, true only when the 5,000 cap left a call out (the server fetches one row over the cap). All three sources (Claude Code, Codex, Grok) keep one shape. No parser change, no `rebuild`.
- **The session payload is read in one transaction**, as `usage()` is, so the chart, the timeline and the Tools table count the same calls.
- **A lazy chunk.** The section loads as its own chunk (`React.lazy`), requested when a session sheet opens. The entry chunk `index` grows by the mount only, 0.2 kB (109.9 to 110.1 kB of 130 kB). If the chunk cannot load, the section says so and the rest of the sheet stays.
- **No zoom** in this version. No change to the shared chart wrapper, to `Timeline.tsx`, to `session.ts` or to the shared `Table`. No ECharts part is registered.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: the session sheet's new section: its lanes, bars, axis, clipped and squeezed calls, reading, words, table, caps, notes, empty cases and loading; the session payload's `lane` and `input`.
- `dashboard-app`: a drawn chart of spans on lanes is read along its lanes and between them, with the span read marked on its own shape; spans keep their kind by shape under forced colors. Both are added requirements: no existing `dashboard-app` requirement is modified, so this change does not collide with the chart migrations in progress.

## Impact

- **Server.** `src/ai_ledger/metrics.py`: `session_timeline()`'s call query gains `lane` and `input` in the same statement; `session()` reads in one read-only transaction (BEGIN … ROLLBACK, as `usage()`). `tests/test_metrics.py`: one new test for the lanes, one assertion on the transaction. No stored data changes.
- **Web.** A new folder `web/src/components/sheets/spans/`: the pure layout, the reading rule and its words, the option, the component, its styles and their tests. `web/src/components/sheets/SessionSheet.tsx`: the heading, the lazy mount and its failure line (10 lines). `web/src/api.ts`: two fields on `SessionDetail["calls"]`. The generated fixtures under `web/src/__fixtures__/` (`session.ts`, `session-grok.ts`) gain the fields.
- **Not edited.** `web/src/components/echart/` (another team's), `web/src/components/sheets/Timeline.tsx`, `web/src/components/sheets/session.ts`, the shared `Table`. `echarts.ts` registers nothing new: the ECharts chunk stays at 176.5 kB of 195.
- **Bundle.** A new chunk for the section, `SessionSpans`, 6.4 kB gzip (estimated 6 to 8 kB from the quadrant's 4.6 kB and the cost flow's 6.1 kB). `web/scripts/check-bundle.mjs` gains its limit, 9 kB, in one line and one name.
- **Known cost: ECharts on pages without charts.** The section draws with the shared `<EChart>` wrapper, which loads the lazy ECharts chunk (176.5 kB gzip) when it mounts. Opening a session sheet on Live, Limits or Context, pages with no ECharts chart today, now downloads that chunk once per visit. On Activity, Cost, Errors and Project it is loaded already.
- **Privacy.** The sheet now shows each call's input (up to 120 characters), in the tooltip and the table. Inputs are already shown on the tool sheet (up to 400) and on Errors; the docs page "Share your screen safely" adds the section to the session sheet's row.
- **Demo store.** `tools/demo/seed.py` adds one session, `demo-spans`, of 35 calls with fixed values, inserted on its own after every other pass: two subagents in parallel and a third later, each with its own result file, a 6-minute failed test run, a 24.5-minute call through an idle gap, a call with no result, a subagent call with no result file, a failed call with a result but no end time, and a call that ends after the last start. The other rows stay as they are. Today every demo call has a NULL `result_file`, so no other session shows subagent lanes.
- **Tooling.** `tools/demo/chartfit/spans.mjs` and its name in `tools/demo/chartfit.mjs`; a `session-spans` shot in `tools/demo/record.mjs`.
- **Docs.** `CHANGELOG.md`, `README.md`, the docs site's sheets, keyboard and share-screen pages.
- **Shared with `context-overhead-list`** (in flight): `web/src/api.ts`, the fixtures, `CHANGELOG.md`, `README.md`, `tools/demo/chartfit.mjs`, `tools/demo/record.mjs`, maybe `web/scripts/check-bundle.mjs`. Each step keeps its edit there to the fewest lines.
- **Tests.** 785 net test lines (planned about 610), over the 400-line advice, plus the browser module's 918: the section owns its reading, as the three graphs before it did (611 to 701 lines). `design.md`, decision 12, says where they go, and `verification.md` why they grew.
