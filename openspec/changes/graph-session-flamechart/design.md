# Design

## Context

See `proposal.md` for the motivation. The reader has opened one session and asks: where did the wall-clock time go, and what ran at once? Every open choice below is settled from that reader's side.

The settled picks (owner, 2026-11-22, from `.claude/plans/recommendation-treemap-flamechart.md`, section 2): real tool-call spans on one lane per thread; a chart of its own under the session timeline, on the timeline's time mapping; a lazy chunk; no zoom; drawn with the custom series already registered; Enter or a click opens the tool's sheet; a data table "Calls by duration". This design does not reopen them.

"The wrapper" is `<EChart>` in `web/src/components/echart/EChart.tsx`. Every file in `web/src/components/echart/` belongs to another team. **This change edits none of them**, nor `web/src/components/sheets/Timeline.tsx`, nor `web/src/components/sheets/session.ts`, nor the shared `Table` (`web/src/components/table/Table.tsx`). It imports `timelineModel`, `openToolSheet` and the `TimelineModel` type from `session.ts`, read-only. Its new code lives in `web/src/components/sheets/spans/`.

**Facts checked in the code** (base `e88a6005`).

- `/api/session` is `metrics.session()` (`src/ai_ledger/app.py:525-527`), which runs `session_detail()` (`src/ai_ledger/metrics.py:1049-1079`): about a dozen statements, with no transaction around them. `session_timeline()` (`metrics.py:1085-1106`) reads `requests` (main and subagent, `LIMIT TIMELINE_CAP`), `calls` (`tool_use_id AS id, tool, start_ts, end_ts, is_error, category, subagent, is_commit`, rows with `coalesce(start_ts, end_ts)` set, ordered by it then id, `LIMIT TIMELINE_CAP`), the compaction times, and sets `truncated` when either list reaches `TIMELINE_CAP = 5000` (`metrics.py:1082`).
- `calls[].category` is the error category, set only for a failed call (`store.py:728`).
- `tool_calls.result_file` is the file of the line that held the call's result: `self.path if r else None` (`store.py:735`). It is NULL exactly when the call has no result. Claude Code: the main file, or `…/subagents/agent-<id>.jsonl` for a subagent (`store.py:898`: a subagent's file is one with `/subagents/` in its path); old transcripts wrote sidechain lines (`isSidechain`) into the main file (`store.py:584`, `602`). Codex: one rollout file per thread; a subagent thread's own file, and a file that continues the main thread is main-thread work (`codex.py:3-6`, `59-66`). Grok: one `updates.jsonl` per session folder; a spawned child's calls move into the parent session with `subagent = true` and keep the child's log as `result_file` (`grok.py:406-431`). `metrics.incidents()` already tells one agent from another by `coalesce(result_file, '')` (`metrics.py:220-235`).
- `tool_calls.tool_use_id` is the primary key (`store.py:84`). `tool`, `subagent` and `is_error` have no NOT NULL: a call with no result has `is_error` NULL (`store.py:733`).
- `input_summary` is the command, file path, pattern, URL, path, query, skill or prompt of the call, else its JSON input cut to 300 characters (`categorize.py:248-256`). The tool sheet already sends it for its recent calls, cut to 400 (`metrics.py:721`); Errors sends it cut to 400 (`metrics.py:196`).
- `timelineModel(s, width, ts)` (`session.ts:95-141`) builds its axis from the times of main-thread requests with a known context, every call's `start_ts || end_ts`, and the compactions (`session.ts:97-102`); `start` and `end` are the first and the last of them (`:103`); no model when there are fewer than two times or they are equal (`:104`). A gap of over 20 minutes between consecutive times is squeezed to `keep = max(3% of active time, 30 s)` (`:106-109`). `W = max(300, width)` (`:111`), margins `m = { l: 40 × ts, r: 8, t: 14 × ts }`, plot width `iw = W − m.l − m.r`, `x(t) = m.l + ct(t) / total × iw` (`:113`), not clamped. It returns `x`, `m`, `iw`, `W`, `start`, `end`, `fmtT` and `gaps: { a, b, bx }[]` (`:139`). A call's `end_ts` takes no part in the axis.
- `Timeline` measures `div.tl` with `el.clientWidth` in a layout effect and a `ResizeObserver`, from an initial `Math.min(640, innerWidth) − 40` (`Timeline.tsx:63-68`), and draws an `<svg viewBox="0 0 W H">` at `width: 100%` (`sheets.css:80`), so below 300px the drawing is scaled by `clientWidth / 300`. `dialog.sheet .tl` has `margin: 4px 0 6px` and no padding or border (`sheets.css:79`). A successful call's tick is `x(t) − 0.5`, 1px wide; a failed one's `x(t) − 1`, 2px wide (`Timeline.tsx:51-52`). The Events list, the key line and the readout are rendered by `Timeline` itself, after its svg.
- `SessionSheet` returns a fragment: `<h3>Timeline</h3>`, `<Timeline>`, then Error loops, Commits, the Models and Tools pair (`SessionSheet.tsx:107-126`). `div.tl` is a direct child of the sheet's body.
- The wrapper reads one ordered list of points along x axis 0: its keys are `STEPS` (Left, Right, Home, End; `EChart.tsx:121`); `onKey` returns before `preventDefault` for any other key and when `points` is 0 (`:434-435`); Escape with nothing read calls `onEscape` only (`:419-422`); its pointer reads `convertFromPixel({ xAxisIndex: 0 }, offsetX)` inside grid 0 (`:469-474`); a key's tooltip and band go to `convertToPixel({ xAxisIndex: 0 }, i)` (`drawnAt`, `:211-215`). PR #219 added `pointKeys` (identity across redraws), not keys or a second dimension.
- `echarts.ts` registers `CustomChart`, `LineChart`, `DataZoomSliderComponent`, `GridComponent` and the SVG renderer (`echarts.ts:14-20`). The cost flow draws on the custom series with `coordinateSystem: "none"` (`pages/cost/flow/flowModel.ts:293-310`).
- Bundle at the base (the brief's measurement on the built assets): `index-*.js` 109.9 kB gzip of 130; `echarts-*.js` 176.5 of 195; `EChart-*.js` 6.3 of 8. The session sheet is in `index` (`UsageSheets.tsx:11`). Pages that load the wrapper today: Activity, Cost, Errors, Project (`grep` of `components/echart/EChart` under `web/src/pages`); Live, Limits and Context do not.
- `React.lazy` is used twice, with `fallback={null}` and no error boundary (`App.tsx:14`, `main.tsx:14-17`). The app has no error boundary (`grep` for `componentDidCatch`).
- The session sheet is a modal `<dialog>`: Escape reaches it as a `cancel` event, and `Sheet.tsx:74-75` closes the sheet on it.
- `dur()` writes one unit ("42s", "7m", "1.5h"; `format.ts:15-21`), as the requirement "Write durations in one unit" demands; `ms()` writes "420ms" under a second (`format.ts:23`).
- The demo seed writes `result_file = None` for every call (`tools/demo/seed.py:155-156`, `201-203`, `360-363`).

**What a measurement found.** The demo store of `tools/demo/seed.py`, seeded to a scratch path (544 sessions over 5 projects and three sources, 15,567 tool calls), each session read through `metrics.session()`, with `timelineModel`'s axis rule ported line for line (times, gaps, `keep`, `ct`, `x`) at the sheet's 600px box (the timeline's fallback width, 552px plot) and at a 343px box (a 375px phone less its gutters, 295px plot). The script prints counts and durations only. No browser and no real store were used: what only those show is listed under decision 12 and in "What could not be found out".

| Question | Result |
|---|---|
| Calls per session against the 5,000 cap | p50 27, p90 50, p99 64, max 85; none at the cap (synthetic; real autonomous sessions can reach thousands, assumed) |
| Null `end_ts`, null `start_ts`, `start = end`, `end < start` | 0, 0, 0, 0 on the demo store (it writes every call with a start and an end); by code, Codex writes `start = end` for a call with no duration (`codex.py:376-380`) and never a null end; Claude Code and Grok write a null end for a call with no result |
| Calls whose end is after the axis's end (point 1) | **794 of 15,567, in 418 of 544 sessions (77%)**: 727 on the main thread, 67 of subagents; at most 4 per session. Past the plot's right edge by p50 1.2px, p99 78.3px, max 249.7px at 552px. The demo starts a request's calls at the request and writes no request after the last one, so its last calls always run past; real Claude Code writes a request after each result, so real sessions see it mostly for a session's last calls (interrupted, crashed) and for subagent calls, whose requests take no part in the axis (assumed) |
| Calls over 20 minutes (point 2) | 0 (the demo's calls run 40 ms to 19.9 s by construction; p50 4.4 s, p90 8.1 s) |
| Calls whose end falls inside a squeezed gap | 518; none of them drawn past the gap's far side by `x()` (`x(end) > x(b)`: 0), because each is shorter than `keep` (at least 30 s). The fault of point 2 needs a call longer than `keep` that ends inside a gap |
| Spans at least 1px wide | 7,368 of 15,567 (47%) at the 552px plot; 3,186 (20%) at the 295px plot. Session axes span p50 43 min, p90 91 min, max 128 min |
| Overlap depth (greedy rows by start, which equals the most calls at once) | main thread: p50 3, p90 3, p99 4, max 4; all subagent calls of a session in one lane: p50 3, max 3 |
| Subagent lanes | 1,556 subagent calls in 311 sessions (all Claude Code; the demo's Codex and Grok sessions have none), every one with a NULL `result_file`: 0 subagent lanes today, so every demo session would show one "not told apart" lane |
| `input_summary` length | p50 13, p99 215, max 302 characters; 192 of 15,567 over 120 |
| Calls that overlap another call in time | 12,723 of 15,567 (81.7%) |
| One list of a session's calls by start: steps that change thread | 1,246 of 15,023 (8.3%), with every subagent call in one lane |

## Goals / Non-Goals

**Goals:**

- One picture of where a session's wall-clock time went, on which thread, and what ran at once, on the timeline's own axis.
- Every call reached by keyboard and by pointer, with its figures in words, and every call in a table.
- Nothing new in the ECharts chunk; the entry chunk grows by the lazy mount only (0.2 kB, decision 13).
- No edit to the wrapper's files, `Timeline.tsx`, `session.ts` or `Table`; no parser change.

**Non-Goals:**

- Zoom, panning or a brush. Later, in step with the timeline's own migration, so both zoom together.
- The exact link from a spawn call to the agent it started (a parser change in all three sources), and lanes named after their spawn call.
- Requests on the lanes, a tool-kind colouring, lanes by tool.
- The section on any page but the session sheet.

## Decisions

### 1. Lanes: one per thread, from the result file

Each call of `/api/session` gains `lane` and `input`, computed in the existing calls statement of `session_timeline()`, so the lanes and the calls come from one statement:

- **`lane` = 0** for a main-thread call (`NOT coalesce(subagent, false)`: a NULL `subagent` counts as the main thread, the only reading the other columns allow).
- **`lane` = k ≥ 1** for a subagent call whose `result_file` is a subagent file of the session: k is the file's rank among those files by its first call in the payload's own order. Each call of the session is numbered by `row_number()` over `coalesce(start_ts, end_ts)`, then `tool_use_id`, and each file is ranked by the smallest number among its calls. Two files whose first calls start at the same moment are ranked by those first calls' ids; a tool use id is unique, so no tie is left. Subagents are numbered in the order they started: "Subagent 1, 2, …".
- **`lane` = null** for a subagent call whose agent cannot be told: its `result_file` is NULL (no result yet, or never), or it is one of the session's **main files**. The main files are the distinct `result_file` values of the session's main-thread calls. Old Claude Code transcripts wrote sidechain calls into the main file: those calls share it with the main thread and cannot be told from one another. All such calls go on one lane, "Subagents, not told apart".
- **A session resumed into a second main file** (a Codex file that continues the main thread, `codex.py:5-6`; a Claude Code session whose results land in another main file) has two main files: both are main-thread work, lane 0. No special case: the rule reads the set.
- **The 5,000 cap.** The ranks are computed over all of the session's calls, before the `LIMIT`, so a lane keeps its number when the cap cuts the list. Because ranks follow each file's first call and the cap keeps the first calls by start, the lanes left are always 1 to k with none missing; a lane whose calls run past the cap loses only its later calls. `truncated` says so, as today, and the payload gains `calls_truncated` beside it: true when the calls' own list reached the cap (`truncated` is also set by the requests' cap). The section's note reads `calls_truncated`.
- **Never the result file's path.** The result file's path stays in the server; the browser gets only the rank. A call's `input` can hold a path (a Read call's file, for one): that is the call's input, sent by design.
- **`input`** = `left(input_summary, 120)`, or `""` when NULL. It feeds the tooltip, the sentence and the table. It holds what `input_summary` holds: a command, a path, a search, a URL, a subagent's prompt, or an MCP call's JSON input; any of these can quote a secret the agent read or typed. The browser already gets the same text, longer, on the tool sheet (400) and on Errors (400); the session sheet now shows it too, and the docs page "Share your screen safely" says so (task 1.10). 120 is the cut the recommendation set: long enough for a command's start, short enough for a tooltip.

Shape (as built in `session_timeline()`):

```sql
WITH c AS (SELECT *, row_number() OVER (ORDER BY coalesce(start_ts, end_ts), tool_use_id) AS n
           FROM tool_calls WHERE session_id = ? AND coalesce(start_ts, end_ts) IS NOT NULL),
main AS (SELECT DISTINCT result_file FROM c WHERE NOT coalesce(subagent, false) AND result_file IS NOT NULL),
agents AS (SELECT result_file, row_number() OVER (ORDER BY min(n)) AS lane
           FROM c WHERE coalesce(subagent, false) AND result_file IS NOT NULL AND result_file NOT IN (SELECT result_file FROM main)
           GROUP BY result_file)
SELECT c.tool_use_id AS id, c.tool, c.start_ts, c.end_ts, c.is_error, c.category, c.subagent,
       c.is_commit AND coalesce(c.test_passed, false) AS is_commit,
       CASE WHEN NOT coalesce(c.subagent, false) THEN 0 ELSE a.lane END AS lane,
       coalesce(left(c.input_summary, 120), '') AS input
FROM c LEFT JOIN agents a ON a.result_file = c.result_file
ORDER BY coalesce(c.start_ts, c.end_ts), c.tool_use_id LIMIT {TIMELINE_CAP}
```

**All three sources keep one shape**: every source writes `result_file` the same way (the deriver's `flush_tools` and `tool_row`, `store.py:696-737`, which `CodexDeriver` and `GrokDeriver` inherit from `store.Deriver`, `codex.py:249`, `grok.py:345`), so the rule is the same code for each.

**Known limits.** A Claude Code session whose main thread has no call with a result, but whose sidechain calls do (an old transcript), has no main file in the set: its main file is then ranked as "Subagent 1", holding every sidechain call. A Codex thread whose rollout file was compressed or moved to `archived_sessions/` while it still ran stores its later calls under the new path: one subagent can show as two lanes. Both are rare and change only a lane's name, not a call's times. Neither can be measured without a real store.

**One transaction.** `metrics.session()` wraps `session_detail()` in `BEGIN` … `ROLLBACK`, as `usage()` does (`metrics.py:409-417`): an ingest that commits while the payload is built changes none of its figures, so the chart's calls, the timeline's axis (requests, calls, compactions: three statements) and the Tools table (another statement) agree. The transaction only reads and takes no lock. None of `session_detail()`'s callees opens a transaction of its own (`insights.insight()`, `titles.first_prompts()`, `titles.titles()` only read); step 1.1 checks this by running the existing tests.

Alternatives:

- **Lanes by `subagent` alone** (main and "subagents"): no server change for the lane, but parallel subagents would share a lane and their calls would stack as if one agent ran them at once. Rejected: it answers neither "which agent" nor "what ran in parallel".
- **The exact spawn-to-agent link** (`toolUseResult.agentId`, `SubAgentActivity`, `SubagentCompleted.subagent_id`): a parser change in all three sources and a `rebuild`. Out of scope (owner); a later change can name the lanes from it.
- **Lane names from a spawn call that contains the lane in time** (the recommendation's rule): rejected for this version. When two subagents run in parallel (the case the chart is for), two spawn calls overlap, and containment names one lane after the wrong spawn call as easily as the right one. The lane is "Subagent k", and the main thread's long Agent bars show the spawns.

### 2. The time axis: the timeline's, through one guarded mapping

The section calls `timelineModel(s, width, ts)` itself, with its own measured width and the same `textScale()`, and maps each time through `spanX(tl, width, t)` in `spans.ts`:

1. `x = tl.x(t)`.
2. **Inside a squeezed gap** (`g.a < t < g.b` for a gap of `tl.gaps`): `x = min(x, tl.x(g.b))` (decision 4).
3. **Clamp** to the plot: `x = min(max(x, tl.m.l), tl.m.l + tl.iw)`; a time after `tl.end` is **clipped** (decision 3). No time of a call can come before `tl.start`: every call's `start_ts || end_ts` is one of the axis's times.
4. **Scale** by `k = width / tl.W`: 1 when the box is 300px or wider, the timeline's own `viewBox` scale below (its svg is `width: 100%` over a `W` of at least 300).

A call's bar runs from `spanX(start) − 0.5` to `max(spanX(end), spanX(start)) + 0.5`: at least 1px wide, and its left edge is the timeline tick's left edge for a successful call (`x(t) − 0.5`). Its centre at the start is the tick's centre for every call. A clipped call's edges are decision 3's.

- **No start** (`start_ts` null, `end_ts` known: a result whose use was never read): a tick at `spanX(end)`, the same x as the timeline's tick, which uses `start_ts || end_ts`. Its words say "start not recorded".
- **No result** (neither an end nor an error flag: `end_ts` and `is_error` both null; every source sets both from the result): a ring at `spanX(start)` (decision 6). Its words say "no result recorded".
- **No duration**: `end ≤ start` (a Codex call with no duration, a clock that jumped back), or a result with no end time (`is_error` set, `end_ts` null), or an `end_ts` present but unparseable. A tick at `spanX(start)`, as `latency()` treats `end ≤ start` as no timing (`metrics.py:164`), so the Tools table's p50 and this chart agree. Its words say "no duration recorded".
- **No time the timeline can read** (`start_ts || end_ts` null or unparseable): no span, as the timeline draws no tick for it.

**Same width as the timeline (point 3).** The section measures its own box with `useWidth(box, Math.min(640, innerWidth) − 40)` (`components/chart.ts:51-63`): `clientWidth`, read in a layout effect and on every resize, from the timeline's own initial width. Its box (`div.spans`) is a direct child of the sheet's body, as `div.tl` is: `SessionSheet` renders it in its fragment, and `Suspense` adds no element. Its CSS has vertical margins only, no horizontal margin, padding or border, as `dialog.sheet .tl` (`sheets.css:79`). So both read the same `clientWidth`, call `timelineModel` with the same width and text scale, and get the same `x()`. The browser check proves it to the pixel (step 1.11, check 2): for the `demo-spans` session, the sorted centres of the timeline's ticks equal the sorted start centres of the chart's bars and ticks within 0.5px, at the 40rem sheet, the Wide sheet, a 343px box and 32px text.

The two read `textScale()` in their own renders; a text-size change that does not resize the sheet reaches each at its next render. The sheet's width is in rem, so a text-size change resizes it and both re-render (accepted, as on the other charts).

### 3. A call past the axis's end: clipped, with an open end

The axis ends at the last start, request or compaction; a call's end takes no part. On the demo store 77% of sessions have such a call, up to 250px past the edge at a 552px plot (measured). The bar runs on into the plot's right margin and ends in a point (a polygon, its last 4px narrowing to the bar's middle), so it reads as "goes on". The point ends 2px before the box's right edge (`tl.W × k − 2`), and the drawn shape is at least 6px long: its left edge is the sooner of `spanX(start) − 0.5` and 6px before the point, also when the call starts at the axis's end (the session's last start). A failed clipped call is the same point, hollow. The sentence, the tooltip and the table give its true end and duration. The key line shows "▸ ran past the last event" when such a call is drawn, and a note counts them: "1 call ran past the last event: its bar ends in a point." ("2 calls ran past the last event: their bars end in a point."). Drawn as is, it would cross the sheet's edge.

Alternative: extend the axis to the last end. That would move every tick of the timeline above, which this change does not edit. Rejected.

### 4. A call through a squeezed idle gap: squeezed, crossing the break

A gap of over 20 minutes between consecutive times is squeezed to `keep`. A call longer than `keep` that ends inside such a gap is drawn by `x()` past the gap's far side, by its true length at the squeezed scale (`ct()` subtracts a gap only once it is over, `session.ts:109`), and could run off the plot. A single call over 20 minutes with nothing starting during it is such a gap. The rule: inside a gap, `x = min(x(t), x(g.b))`. A short call near the gap keeps its true length (the 518 demo calls ending inside gaps are all shorter than `keep`, so none changes); a long one ends at the gap's far side, crossing the break mark at `g.bx`.

The timeline's key says "⌇ idle time squeezed out", which is untrue for the stretch where a call ran. The section words its own key line: "⌇ squeezed: over 20 minutes with nothing starting; a call that ran through it is drawn shorter than it lasted". A note counts them: "1 call ran through squeezed time; its bar is shorter than its duration." The sentence, the tooltip and the table give the true duration.

Alternative (not the plan): squeeze a gap only where no call is running, so a long call keeps its width. That needs another axis than the timeline's, which this change does not edit, and the bars would no longer sit under the ticks. Recorded for the timeline's own migration.

### 5. The layout: lanes, rows and caps

`spansLayout(tl, calls, width, s)` in `spans.ts`, pure: `tl` is `timelineModel(s, width, ts)`'s result, made by the caller, and `calls` the payload's calls, typed by the fields the layout reads. It returns `null` when `tl` is null (fewer than two times) and otherwise the lanes, the spans, the box's height and the counts the notes need.

**Lanes**, top to bottom: the main thread; subagent lanes 1, 2, … by rank; "Subagents, not told apart" (lane null); a lane is drawn only when it has a call, except the main thread, drawn while any lane has a call. A lane's key is built from its rank (`main`, `sub-3`, `apart`, `other`), never from a name or a path.

**Rows.** Within a lane, calls are packed greedily by start (then id): a call takes the first row whose last call ended at or before its start, in **time**, not pixels. A row is a thread of calls that did not overlap; rows are what ran at once. On intervals, greedy packing by start uses the fewest rows, equal to the most calls running at one time. A call with no end, or no duration, occupies its row only at its start. Successive short calls at one pixel share a row and draw over one another, as the timeline's ticks do.

**Caps (assumed, from the demo store; set again from a real store).** The main thread has at most 4 rows (demo max 4); a subagent lane at most 3 (demo max 3, every subagent in one lane). A call that would need a further row is drawn in the lane's last row, over what is there, and counted: "3 calls ran beside 4 others on the main thread and are drawn over its last row." After 6 subagent lanes, the rest fold into one lane, "Other subagents (N)", at most 3 rows; its calls keep their own subagent's number in their words.

**Geometry** (s is the text scale, `k` the width scale of decision 2):

| Name | Value |
|---|---|
| Top padding | 4px |
| Lane label line | 14px × s, the label at 11px × s, weight 600, from the plot's left |
| Row | 10px: an 8px bar and a 2px gap |
| Gap after a lane | 6px |
| Time labels under the lanes | 16px × s: the axis's first and last time, `tl.fmtT`, at 10.5px × s, as the timeline's |
| Box height | 4 + Σ lanes (14 × s + rows × 10 + 6) + 16 × s, rounded up |
| Plot | from `tl.m.l × k` to `(tl.m.l + tl.iw) × k`: lane labels sit above their lane, not in the 40px left margin |

Examples: a session with one main row and no subagent, 4 + 30 + 16 = 50px at 16px text. Main 3 rows and three subagent lanes of 2 rows: 190px. The cap: main 4 rows, 6 subagent lanes and the folded lane of 3 rows, and the not-told-apart lane of 3 rows: 480px at 16px text, 622px at 32px text.

**Spans.** Each holds the call's id, tool (`"Unknown tool"` when NULL, with `known` false), input, lane, row, its own thread (`sub`: 0, the subagent's rank even in a folded lane, or null), `x0`, `x1`, its kind (`ok`, `failed`, `open` for no result, `still` for no duration or no start; decision 2), three flags (`failed` from `is_error`, whatever the kind; `clipped`; `squeezed`), and its true start, end and duration in ms. They stay in payload order. The layout also gives the plot's left and right, the breaks' x, where the lanes end (`bottom`) and `long` (the axis runs over 20 hours).

**Notes** (each only when its count is not 0): the cut ("Long session: only its first 5,000 tool calls are drawn.", the number the spans drawn, shown only when the payload's `calls_truncated` is true); no duration ("4 calls have no recorded duration: drawn as ticks."; "1 call has no recorded duration: drawn as a tick."); clipped (decision 3); squeezed (decision 4); rows over the cap (above); folded lanes ("Subagents 7 to 9 share the lane Other subagents."; "Subagent 7 shares …" for one; "7, 9 and 12" when the numbers skip).

### 6. Drawing: the custom series on no grid

One option, `spansOption(layout, env, times)` in `spansOption.ts` (`times`: the axis's first and last time as `tl.fmtT` writes them), types only from `components/echart/echarts.ts`:

- `...baseOption(env)` from `option.ts` as it is, `animation: false` in every mode.
- No grid and no axis. Three custom series, each `coordinateSystem: "none"`, `silent: true`: `breaks` (z 1: for each of `tl.gaps`, a 6px band in `--surface-2` at `g.bx × k` over the lanes' height, and the ⌇ zigzag at its top, as the timeline draws it), `spans` (z 2: one data item per span, `renderItem` returning its shape by `dataIndex`; `z2` higher for shorter spans, so a tick over a long bar stays visible), `labels` (z 3: the lane labels, `overflow: "truncate"` to the plot's width; the two time labels).
- **Shapes.** `ok`: a filled rect in `--series-1`. `failed`: a hollow rect, 1.5px stroke in `--critical` inside the bar's edges and fill `ink.surface`, when at least 4px wide. The failure tick: a 2px rect in `--critical`, 10px high, that rises 2px above its row, for a failed call narrower than 4px and for a failed call with no recorded duration (`still`), so a failed tick is told by its height as well as its hue. `open`: a ring of 3px radius at the start, 1.5px stroke in `ink.muted`, no fill. `still` (not failed): a 1px rect in `ink.muted`. `clipped`: the bar's last 4px narrow to its point in the plot's right margin (a polygon, decision 3), filled or hollow by its kind. `spanBox()` in `spansOption.ts` gives each shape's outer box, which the component's mark and a key's tooltip use too. Colors from `env.color()` and `env.ink`; every color set.
- **Forced colors** (`env.forced`): `ok` filled `CanvasText`; `failed` a `CanvasText` outline over `Canvas` (the failure tick: a taller `CanvasText` tick); `open` a `CanvasText` ring; `still` `CanvasText`; breaks and their ⌇ `GrayText`; labels and times `CanvasText`. Kinds are told by shape and height, not by hue.
- **Nothing registered.** `echarts.ts` is not edited; rect, circle, polygon, polyline and text are the custom series' own shapes. The ECharts chunk stays at 176.5 kB.
- The view key given to the wrapper is the session id.

A real-ECharts smoke test (step 1.7) proves the shapes, their places and the forced colors on ECharts 6.1.0, since the fake runtime draws nothing.

### 7. Reading: the section's own

**Why not the wrapper's** (point 7). Its reading is one ordered list along x axis 0: Left, Right, Home and End only (`EChart.tsx:121`, `:434`); its pointer reads the band of x axis 0 under the pointer (`:469-474`), one dimension; its tooltip and band go to the middle of band i (`:211-215`). This chart has two dimensions: time across, lane and row down. 81.7% of the demo's calls overlap another call in time (measured), so at most x positions an x-only pointer cannot tell which call it is over; and a single list by start changes thread on 8.3% of steps with every subagent in one lane (measured), more with real lanes, so Left and Right would jump between lanes. PR #219 added identity (`pointKeys`), not keys or a second axis; no prop sets the pointer test or a point's place. So the wrapper draws and the section reads, as the calendar, the cost flow and the session plot do (`ActivityCalendar.tsx:248`, `CostFlow.tsx`, `SessionQuadrant.tsx`): `<EChart points={0} read={() => ""} />` with no `tip`, `onActivate`, `status`, `onEscape` or `zoom`. With `points` 0 the wrapper prevents no key (`:435`) and its pointer reads nothing (`:473`): keys and pointer events reach the section's own box. It keeps the focusable `role="group"` box, its label, the lazy load, the environment, the resize and "The chart could not be drawn" text.

`spansReading.ts`, pure: `stepSpan(layout, at, key)` (the span a key reads, or undefined for any other key), `spanAt(layout, x, y)` (the span under the pointer, or null), `alongside(layout, id)` (how many other calls overlap it in time, any lane), the sentence, the tooltip rows, the group label and the notes' words. `SessionSpans.tsx`: the state `{ id, keyed, text, n } | null` held by call id, the handlers on `div.spans-box` around the wrapper's box, the tooltip, the mark and the live region.

**Order.** Within a lane, by start (`start ?? end`), then id. Lanes top to bottom as drawn.

**Keys**, on the focused box (a key with Alt, Ctrl, Meta or Shift is the browser's: `modified()`):

| Key | Reads |
|---|---|
| Right, Left | the next, the previous call of the lane; at an end, stays and says the sentence again |
| Up, Down | the lane above, below: its call nearest in time to the call read (by start, else end; ties to the earlier); a lane with no call (the main thread, drawn empty while a subagent has a call) is skipped; at the top or bottom lane, stays and says the sentence again |
| Home, End | the lane's first, last call |
| Any of these with nothing read | the top lane's first call (Left and End: its last) |
| Enter | opens the read call's tool sheet (decision 8); with nothing read, left alone |
| Escape | ends the reading; with nothing read, left alone, to the sheet, which closes |

The arrows, Home and End are prevented while the box has focus: the sheet does not scroll under the chart. Blur ends the reading, unless the focus moves within the box.

**Escape in a sheet.** The sheet is a modal dialog that closes on Escape. While a reading is open, Escape ends the reading and is prevented (`preventDefault()` on the keydown), never stopped, so the sheet stays open and a control the focus is in still gets the key; with nothing read, Escape is left alone and closes the sheet as before. A reading the pointer opened while the focus is elsewhere in the sheet ends on Escape from anywhere in the sheet's dialog: a capturing `keydown` listener on the document while a reading is open, attached in a layout effect (an Escape pressed the moment the tooltip shows finds it), which also prevents the key. Both ignore an Escape during IME composition (`isComposing`) or with a modifier; the document's listener also ignores one whose target is outside the sheet's dialog (a control over it, such as the command palette) and leaves the box's own keys to the box. The browser check proves that the sheet stays open (step 1.11): jsdom does not turn Escape into a dialog's `cancel`.

**Pointer.** `mousemove`, `mouseleave` and `click` on `div.spans-box`; the position is the client position less the box's. `spanAt` reads, in the row band under the pointer (10px, the row's bar and its gap), the span nearest horizontally within 6px (distance 0 inside the bar); ties go to the shorter span (drawn on top), then the earlier start, then the id. Outside every span nothing is read. A click on a span opens it (decision 8). The cursor is a hand over a span: a class on `div.spans-box` with `cursor: pointer !important`, over the inline cursor zrender sets.

**The mark.** An outline around the span read: `<svg class="spans-mark" aria-hidden="true">` over the box, a 2px rect 2px outside the span's drawn box (`spanBox()`; a circle of 6px radius around a ring), in `--text-primary`; `Highlight` under forced colors. HTML, so it works before the chart has drawn.

**The tooltip.** A `div.tip` with `role="tooltip"`, shown with an inline `display: block` (the app's stylesheet hides `.tip` until a chart shows it). Measured at the box's top left before it is placed, so a long input never overflows a 343px box. The pointer's: placed with `tipAt()` beside the pointer; when that leaves the box or would cover the span's mark (over a long bar's middle), centred on the pointer above the span, or below the span when the window has no room above it. A key's: centred on the span's start above the span, or below it when the window has no room above it. The room above is measured against the window, not the box (the session plot's rule): a one-lane box is 50px tall, so an in-box test would put every key's tooltip below the chart, over "Show data table" and often below the fold; above, it may cover the section's hint and key line, which are plain text. It never covers the span's own mark. Either is then kept inside the box at both edges. The tool name and the input wrap (`overflow-wrap: anywhere`), at most 18rem wide and never wider than the box. Rows: the tool (bold); the input (when not empty); the thread ("Main thread", "Subagent 2", "Subagents, not told apart"); "14:02:10 to 14:08:41" (or "Started 14:02:10, no result recorded", "At 14:02:10, no duration recorded", "Ended 14:02:10, start not recorded"); the duration; "Failed" or "Succeeded" (none without a result); "and 2 other calls at the same time" when `alongside` is not 0. Times by `toLocaleTimeString(undefined, { hour, minute, second })` in the browser's locale, with the date before them when the session spans over 20 hours (the timeline's `long` rule).

**The live region.** One `div.sr` with `aria-live="polite"` in the component; the wrapper's stays empty.

| Case | Sentence |
|---|---|
| A failed timed call | "Bash on the main thread, 14:02:10 to 14:08:41, 7m, failed: npm test. 2 other calls ran during it." |
| A successful timed call | "Read on the main thread, 14:00:00 to 14:00:03, 3s: src/app.ts." (nothing of its outcome) |
| No result | "Bash on subagent 2, started 14:02:10, no result recorded: npm run dev." |
| No duration | "exec_command on the main thread, at 14:02:10, no duration recorded: cargo test." (failed: "…, no duration recorded, failed: …") |
| No start | "Read on the main thread, ended 14:02:10, start not recorded." |
| A subagent call not told apart | "Read on a subagent not told apart, started 14:48:55, no result recorded: src/limits.py." |
| Clipped or squeezed | as a timed call; its duration is the true one |

The duration is `dur(ms / 1000)`, one unit, rounded, as the requirement "Write durations in one unit" asks ("7m" for 6 minutes 31 seconds, not the recommendation's "6 min 31 s"); under a second `ms()` ("420ms"). ", failed" follows the time of a failed call of any kind. The input follows a colon when not empty. "N other calls ran during it" only when N is not 0. Tooltip and sentence say a call of the folded lane by its own subagent's number.

- A key that cannot move says the sentence again, so it is not met with silence.
- Newer data keeps the reading: it is held by call id. The lookup of a call gone from the newer payload returns nothing and never throws; the reading then ends quietly, with no sentence. A reading a key made is said again when newer data changes its words (a call that got its result); the pointer's is not, its tooltip shows them (the wrapper's rule).

**The group's label**, on the wrapper's box: "Tool calls of this session by thread, on the timeline's time axis: 412 calls on 3 threads, the main thread and 2 subagents, over 1.9h of active time; the longest, Bash, 7m. Use the left and right arrow keys to step through a thread's calls, up and down to change thread, Home and End for its first and last call, Enter to open the tool." The active time is `info.active_s` (`dur`; left out when null), the longest call the timed call of the longest duration (left out with none). The calls of subagents not told apart count as one thread, listed as "subagents not told apart".

**Visible lines.** Heading (in `SessionSheet`): "Tool calls by thread". Hint: "Each bar is a tool call, from its start to its result, on its thread: the main thread, then each subagent. Calls stacked in a lane ran at once." The key line (HTML, `aria-hidden` as the timeline's): Call, Failed, No result, and, when drawn, "▸ ran past the last event" and the squeezed line of decision 4.

### 8. Enter and click: the tool's sheet

Enter on the read call, or a click on a span, ends the reading and calls `openToolSheet("tool", tool)` (`session.ts`), as a row of the sheet's Tools table does (`TOOL_PICK`, `ToolSheet.tsx:56`). The tool sheet opens in place of the session sheet. It shows no "← Back" (the sheets give one only to a session opened from a project or tool sheet, `UsageSheets.tsx`); the browser's Back returns to the session sheet, as from the Tools table. A call whose tool is NULL opens nothing: Enter or a click says "No sheet for an unknown tool." in the live region and the reading stays. A failed call's sentence does not link to Errors: the Events list and Error loops above keep their "Open in Errors" links.

### 9. Placement and loading

- **Place.** After `<Timeline>` in `SessionSheet.tsx`, so after the timeline and its Events list, before Error loops: `<h3>Tool calls by thread</h3>` then the lazy section. `Timeline.tsx` renders its Events list after its svg, so the section sits under the Events list, not under the svg (correction to the brief: "directly under the timeline" needs an edit of `Timeline.tsx`, which this change does not make). The Events list shows at most 8 events before "Show all".
- **Lazy chunk.** `const SessionSpans = lazy(loadSpans)` in `SessionSheet.tsx`, where `loadSpans = () => import("./spans/SessionSpans").then(m => ({ default: m.SessionSpans }), () => ({ default: () => <p className="empty">…</p> }))`. A failed load resolves to a component that says "The tool-call chart could not be loaded. Reload the page to try again." in place of the section: React.lazy keeps that result, so the rest of the sheet stays and nothing throws to the root (the app has no error boundary).
- **Requested when the sheet opens.** `SessionSheet` calls `loadSpans()` while it shows "Loading session…" (and on every render; the promise is cached), so the chunk loads beside the session's request. `Suspense` gets `fallback={null}`. When the session's figures are already cached (the context menu fetches them, `SubjectMenu.tsx:43`) the section can appear a moment after the sheet, the first time in a page's life; the content under it then moves once. Accepted: the chunk is a few kB from the local server, and putting the layout in `index` to reserve the height would grow the entry chunk, which the owner ruled out. The browser check measured the move: the Models block went 406px down, once. The mount itself (the `lazy()` line, the failure line, the heading and `Suspense`) grew `index` by 0.2 kB, 109.9 to 110.1 kB gzip. A failed load stays failed until a reload: React.lazy keeps its result.
- **The ECharts chunk** loads when the wrapper mounts, as on every chart: once per visit on Live, Limits and Context, which load no chart today (proposal, known cost).
- **No chart** (each a line in place of the chart, no box): `spansLayout` null: "Not enough activity to draw the tool calls."; a session with no call: "No tool calls in this session."

### 10. Colors, forced colors, dark and motion

- Bars in `--series-1`, failures in `--critical` (the timeline draws failures red), rings and no-duration ticks in `ink.muted`, breaks in `--surface-2`, labels in `ink.secondary`, times in `ink.muted`. One hue for every lane: lanes are told by place and label.
- **Color is never alone.** A failed call is hollow, or a taller tick; no result is a ring; a clipped bar has a point; every figure is in the sentence and the table.
- **Forced colors**: decision 6. The mark `Highlight`. The chart redraws when forced colors turns on or off: the wrapper's environment changes.
- **Dark**: the tokens carry both schemes; the wrapper redraws on a theme or scheme change; the mark's `--text-primary` turns light.
- **Reduced motion, and in every mode**: `animation: false`.

### 11. The data table: "Calls by duration"

"Show data table" under the chart, through `ChartTable` and the shared `Table`, unchanged, closed on every load. Name: "Calls by duration". One row per call drawn, longest first; calls with no duration or no result after the timed ones, by start (else end), then id. The first 20 rows, then a "Show all N calls" button that renders the rest and moves the focus to the 21st row's button, or to the row itself when its call has no tool (the row then takes `tabIndex` −1; the timeline's "Show all events" pattern). Columns, in this order: Started (the time with seconds, with its date when the axis spans over 20 hours; "–" with no start), Thread ("Main thread", "Subagent 2", "Subagents, not told apart"), Tool (a button when the tool is known, plain "Unknown tool" otherwise; `pick` opens the tool's sheet, as `TOOL_PICK`; the cell wraps and is at least 8ch wide), Input (wrapping anywhere), Duration (one unit; "–" with none), Result ("Failed" for every failed call, timed or not; "No result"; else "Succeeded"). `rowId` is the call id. The table sits in the shared table's own scroll region (`div.scroll`, region classes `scroll tall`): at a 343px box it scrolls sideways inside that region, and the sheet does not grow.

### 12. Tests and the browser check

| Where | What | Catches |
|---|---|---|
| `tests/test_metrics.py`, a new test on its own inserts (a new branch: lanes) | main calls in two main files; two subagent files whose first calls are out of file-name order; a sidechain call in a main file; a subagent call with no result; a NULL `subagent`; a 130-character input and a NULL one: `lane` 0, 0, 1, 2 by first call, null, null, 0; `input` cut at 120 and `""`; with `TIMELINE_CAP` patched to a small number, the lanes kept keep their numbers; one assertion in the same test that an ingest committed after the first statement changes no figure (the pattern of `test_one_snapshot_for_the_whole_payload`) | The payload rule and the transaction |
| `spans/spans.test.ts` | `spanX` (inside a gap, past the end, below 300px), the lanes' order and keys, packing, caps, folding, kinds, flags, heights at s 1 and 2, notes' counts | Every rule of decisions 1 to 5 the layout owns |
| `spans/spansReading.test.ts` | `stepSpan` for every key at both ends and with nothing read, `spanAt` on a bar, beside it within 6px, 7px away, over a tick on a bar, `alongside` (through the sentences and the tooltip rows), the sentences of the five cases, the tooltip rows, the label | Decision 7's rules and words |
| `spans/spansOption.test.ts`, stubbed `api` | one item per break and per span, shapes per kind, `z2`, colors and forced colors; `coordinateSystem: "none"`, `silent: true`, `animation: false` and no grid are constants of the option, not asserted: the real-ECharts test (each span drawn at the layout's pixels) and the browser module (the pointer read by the section through the box) depend on them | Decision 6 |
| `spans/SessionSpans.test.tsx`, fake runtime | what a user reaches: the label, hint, key line, notes; Right, Up, Down, Home, End; the sentence in the live region, the tooltip, the mark; pointer read and leave; Enter and a click open the tool sheet; Escape ends a reading and is prevented, and Escape with nothing read is not; newer data keeps the reading, a gone call ends it quietly; the table's first 20 and Show all; the empty lines | Wiring and wording |
| `sheets.test.tsx`, the existing "shows the session with its timeline, events and error-loop link to Errors" test, and a new one, "says so when the tool-call chart's chunk fails to load, and the rest of the sheet works" (a new branch: the failed import) | the heading "Tool calls by thread" and the chart's group after the timeline; the failure line with the timeline and the error-loop link still shown | The mount and the failed load |
| `spans/SessionSpans.real.test.tsx`, real ECharts | one path per span at its layout pixel; hollow, ring, tick and point shapes; breaks; labels as text; newer data redraws with no stale path; forced colors | An option ECharts refuses or draws elsewhere |
| `tools/demo/chartfit/spans.mjs`, Chromium's headless shell (866 lines, 56 check lines) | what jsdom cannot show (step 1.11) | Layout, real text, real events, the dialog's Escape |

The fake runtime draws nothing, and the reading does not use the chart: a section that draws no bar passes every fake test. The real test and the browser check see the drawing.

Only a browser shows: that the bars sit under the timeline's ticks to the pixel; real label widths at 16px and 32px text in a 343px box; that `mousemove` and `click` reach `div.spans-box` through zrender's svg, and a touch tap; the hand cursor; that Escape with a reading open leaves the sheet open; the tooltip shown and inside the box; forced colors; dark and the OS flip; no sideways scroll at 375px and 32px text. The browser check ran on Chromium's headless shell only: Firefox and WebKit could not be run here.

Net test lines, estimated: Python 45, layout 160, reading and words 110, option 70, component 150, real 70, mount 5: about 610, over the 400-line advice. As built: Python 46, layout 153, reading and words 110, option 121, component 216, real 119, mount and failed load 20: 785 (`verification.md` says why), plus the browser module's 866 lines, which run outside the test suites. Why: the section owns a two-dimensional reading the wrapper cannot give (decision 7), as the calendar (701), the cost flow and the session plot (611 to 654) did.

### 13. Bundle

Measured on the built assets (gzip -9, `node scripts/check-bundle.mjs`):

- `echarts-*.js`: unchanged, 176.5 kB of 195. No part registered.
- `index-*.js`: 110.1 kB of 130, 0.2 kB over the base's 109.9: the mount itself (`SessionSheet.tsx` gains the `lazy()` line, the failure component, the heading and `Suspense`).
- A new chunk, `SessionSpans-*.js` (Vite named it after its entry module, as assumed): 6.4 kB. `web/scripts/check-bundle.mjs` has `SessionSpans: 9` in `LIMITS`, with the comment "6.4 kB: the session sheet's tool-call chart (layout, option, reading and table), loaded when a sheet opens", and the name in `SINGLE`.
- `EChart-*.js`: 7.1 kB of 8. This change edits none of its files and adds nothing to it; the section imports it, as the pages do (the base's 6.3 kB grew on the default branch before this change's base).

### 14. The demo store: one session for the images and the browser check

Every demo call has a NULL `result_file`, so the demo shows no subagent lane, and its calls run 40 ms to 20 s, so it has no call over 20 minutes (measured). `tools/demo/seed.py` gains one session, `demo-spans` (task 1.8): atlas-api, Claude Code, yesterday from 14:00 to 14:58, with fixed values and no random stream. `demo_spans()` builds its own lists of rows and inserts them itself, and runs after every other pass: the limit snapshots read the seed's requests and the /context snapshots its sessions, so a row added to either list would change them. Every other row the seed writes stays the same. It holds 35 calls (`demo-spans-1` to `demo-spans-35`), with each case the chart must show: two subagents in parallel and a third later, each with its own result file; three main-thread calls at once at 1:30; a 6-minute failed test run; a failed short Edit at 8:40; a 24.5-minute call with nothing starting for 30 minutes (a squeezed gap, 10:00 to 40:10); a main-thread call with no result (52:00); a subagent call with no result file (48:55); `demo-spans-35`, a failed Bash at 8:20 with a result and no end time (the failure tick); the last call ending 3 minutes after the last start (55:00). A fixed id lets the browser check and the shot open it by URL.

What else reads the seed's output, and what the new session changes there:

- `tools/demo/chartfit/*.mjs` read the served payloads at run time and name no demo session or count (`grep` for `demo-` ids and `result_file` finds only payload readers): one more atlas-api session is one more row, dot or bar for them, not a broken check.
- `tools/demo/record.mjs`: its shots crop panels of pages; its GIF scenes open a session sheet from the first Sessions row and from an "Open session" link of the Judgments log (`record.mjs:136`, `199`, `248`). Sessions are sorted newest first and the seed has sessions until 30 minutes ago, so `demo-spans` (yesterday) is not a first row. The new `session-spans` shot (task 1.12) opens it by URL. The README GIFs are not re-recorded in this change: they show the session sheet without the section until the next recording.
- `tools/demo/firstscreen.mjs`, `typefit.mjs`, `sticky.mjs`, `livefit.mjs`: layout checks of pages and Live; `demo-spans` is not live (it ended yesterday).
- Errors, Cost and Activity count one more session with three failed calls (the test run, an edit and the 8:20 Bash) and its requests' cost. Nothing hard-codes those figures.

## Corrections to the brief and the recommendation

1. **The axis is not built from call starts only.** `timelineModel` takes main-thread requests with a known context, every call's `start_ts || end_ts`, and compactions (`session.ts:97-103`). The consequence (a call's end can pass the axis's end) holds.
2. **"Directly under the timeline" is under its Events list.** `Timeline.tsx` renders the Events list itself (`Timeline.tsx:136-154`); placing the section between the svg and the Events would edit it.
3. **Durations in one unit.** The recommendation's "6 min 31 s" breaks the requirement "Write durations in one unit": the sentence says "6m".
4. **One lane for every subagent call that cannot be told apart.** The recommendation had two ("Subagent, not known" for no file, "Subagents (not told apart)" for the main file); both are calls whose agent the store cannot name, so one lane holds both.
5. **No lane names from spawn calls** in this version (decision 1, alternatives).
6. **The demo seed writes `result_file = None` for every call, main thread included**, not only subagent calls (`seed.py:155-156`, `201-203`, `360-363`).
7. **Escape in a sheet** is a fault class the three built graphs did not have: they live on pages, not in a modal dialog. Decision 7 settles it; the browser check proves it.

## Differences found while building

Each is folded into the decision named; the code is the reference.

1. **Heights** (decision 5): every cap at 32px text is 622px by the formula, not 642px.
2. **The failure tick** (decisions 2 and 6): a failed call with no recorded duration is drawn as the failure tick, not the muted 1px tick. A call with a result but no end time, or an unparseable end, has no duration; only a call with neither an end nor an error flag has no result.
3. **The clipped bar** (decision 3) ends in a point in the plot's right margin, 2px before the box's edge, and is at least 6px long; its note says "… in a point.", not "… at the edge."
4. **The words** (decision 7): a successful call's sentence says nothing of its outcome; "a subagent not told apart"; the cut note counts the spans drawn and shows only with `calls_truncated`; a 6 minutes 31 seconds call reads "7m"; the tooltip's placement and Escape's exact conditions.
5. **Back** (decision 8): the tool sheet has no "← Back"; the browser's Back returns.
6. **The entry chunk** (decisions 9 and 13) grew by 0.2 kB, the mount itself.
7. **The table** (decision 11): its columns as built, the Tool cell's 8ch, its own scroll region.
8. **The lane ranks** (decision 1) follow the payload's own call order (`min(n)`), not `min(start), min(id)`; the payload gains `calls_truncated`; only the result file's path is kept from the browser.
9. **The seed** (decision 14) inserts its own rows after every other pass, and holds 35 calls.

## Risks / Trade-offs

- **The chart's drawing and the timeline are drawn by two renderers from one model.** → Both call `timelineModel` with the same width and scale (decision 2); the browser check compares them to 0.5px.
- **A real store's shape is unknown**: calls per session, the share with no end or no duration, overlap depth, lanes per session, subagent calls with no file. → The caps are constants in `spans.ts`, named as assumed; the owner can run the measurement script on a copy of the store.
- **Parallel spans may not be true.** If Claude Code writes the results of parallel calls all at once, their ends are the last one's (unknown; see below). → The chart draws what the store holds.
- **Input text on screen.** → Already on the tool sheet and Errors; the share-screen docs page names the section; the tooltip shows it only while a call is read, the table only when opened.
- **A first-open layout shift** when the session's figures are cached and the chunk is not (decision 9). → Accepted; measured by the browser check (step 1.11, check 10).
- **ECharts on Live, Limits and Context.** → Once per visit, after the sheet opens; nothing on those pages' own first load.
- **The reading rules now exist five times** (the wrapper, the calendar, the cost flow, the session plot, here). → This one copies the wrapper's where they apply (Escape, blur, a key's reading said again, held by id).
- **Accepted limits.** No zoom: at 13 s a pixel on a 2-hour session most calls are ticks, and only calls of about 13 s or more are bars (the bars are where the time went). A lane past the cap draws its calls over its last row. A label too long for a 343px box at 32px text is truncated; its full name is in the sentence and the table.

## What could not be found out

These need a copy of the owner's store (never the live one) or a browser; the measurement script `measure_spans.py` (kept by the planner in its scratchpad, outside the repo) prints counts and durations only and runs on a copy:

- Real calls per session against the 5,000 cap; the share of calls with no end or no duration, per source; how many calls run at once per lane; how many subagent lanes a session has; how many subagent calls have no file or a main file.
- Whether Claude Code writes each parallel call's result when that call ends or all at once.
- How often a real session ends with a call past the axis, and how often a call runs over 20 minutes alone.
- Real label widths, the tooltip's place and the bar-under-tick alignment at 343px and 32px text: the browser check.

## Open Questions

None that block the plan. The caps of decision 5 are assumptions to check on a real store.
