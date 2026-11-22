# Verification

How each scenario of the two spec deltas is proved, on the head of review fix 4 (the key's tooltip placed by the window, the over-the-cap note's wording, the test trims). Test names are quoted as the files write them. Browser lines are the `line(…)` calls of `tools/demo/chartfit/spans.mjs`, quoted from the source; a template's `${…}` is left in. Fix 4 ran that module three times in a row, every one of its 58 lines "ok", on Chromium's headless shell, after the fix; its two new lines (442 and 451) were first seen failing against the build without the fix (the tooltip at 446..572, below the call, under a box at 416..626 in a 900px window).

Files, for short: `metrics` is `tests/test_metrics.py`; `spans`, `reading`, `option`, `component` and `real` are `spans.test.ts`, `spansReading.test.ts`, `spansOption.test.ts`, `SessionSpans.test.tsx` and `SessionSpans.real.test.tsx` in `web/src/components/sheets/spans/`; `sheets` is `web/src/components/sheets/sheets.test.tsx`; `browser` is `tools/demo/chartfit/spans.mjs`, with its line number.

## usage-dashboard

| Requirement | Scenario | Proved by |
|---|---|---|
| Show a session's tool calls by thread | Two subagents in parallel | `metrics` "test_session_calls_carry_their_lane_and_input" (x1 and y1 start at the same moment, lanes 1 and 2); `spans` "packs %s" (row "three calls at once"); `browser` 217 "the answer for ${SID} holds every case the checks use: …" (lanes main, sub-1, sub-2, sub-3, apart; three at once at 1:30) |
| | Subagent calls that cannot be told apart | `metrics` "test_session_calls_carry_their_lane_and_input" (`sc`, a sidechain call in a main file: lane null); `spans` "orders the lanes by rank and keys them by it, whatever the calls' order" (the "Subagents, not told apart" lane) |
| | Sessions from three agents | Not tested once per source, by the repo's rule: the lane is one SQL statement over `tool_calls`, which all three derivers fill alike. The regenerated Grok fixture (`web/src/__fixtures__/session-grok.ts`, `tests.test_web_fixtures`) carries `lane` and `input` |
| | (placement) | `sheets` "shows the session with its timeline, events and error-loop link to Errors" (the heading after the timeline, the chart's group) |
| Draw each kind of tool call by its shape | A long failed test run | `option` "draws each kind by its shape at the layout's pixels"; `real` "draws each span in its box, the shapes, the break and the labels, marks the bar it reads, and redraws newer data" (the hollow bar: fill `--surface-1`, stroke `--critical`); `browser` 336 "the pointer over the hollow test run, the failed Edit's tick and a ring reads that call, the mark on its drawn span within 1px" |
| | A Codex call with no duration | `spans` "draws %s from x(start) − 0.5, at least 1px wide" (row "a call with no duration": `still`); `reading` "says each call in one sentence, its true times and one-unit duration" ("exec_command on the main thread, at …, no duration recorded: cargo test.") |
| | A failed call with no end time | `spans` "draws %s from x(start) − 0.5, at least 1px wide" (row "a failed call with no end": `still`, failed); `reading` "says each call in one sentence, …" ("…, no duration recorded, failed."); `browser` 312 "the failed call with no end (${clocks[C.nodur.id]}) is the red 2px tick, taller than its row, and its sentence says it failed" |
| Place tool calls on the timeline's time axis | Under the tick | `browser` 259 "${what}: the ${N} ticks of the timeline sit at the start centres of the chart's ${N} spans, sorted, within 0.5px", run at the 40rem sheet, the Wide sheet and back, a 343px box at 16px and 32px text, 32px text at 1280px, a cached reopen, a sheet opened on Cost, and with a classic scrollbar coming and going; `spans` "puts a call with no start at its end, as the timeline's tick, and names an unknown tool" |
| Clip a call that runs past the timeline's end | The session's last call | `browser` 296 "the call past the axis's end is one bar at least 6px long that ends in a point in the plot's right margin, inside the box"; `spans` "%s" (row "a time past the axis's end: its point in the right margin, 2px before the box's edge") and "scales by the box's width below 300px, as the timeline's svg" (6px long when it starts at the axis's end); `real` "draws each span in its box, …" (five points, ending 2px before the box's edge); `reading` "gives a clipped call's tooltip its true times"; the key line and the note: `component` "labels the chart, shows the hint, the key line with its clipped and squeezed entries, and the notes" |
| Squeeze a call that runs through idle time | A 24-minute call with nothing else running | `spans` "%s" (row "a call longer than keep ending inside the gap: at the gap's far side") and "flags the clipped and the squeezed call, not the short one" (its true 28 minutes); `browser` 303 "the 24.5-minute bar ends where the squeezed gap ends, across the break"; the key line and the note: `component`, as above |
| Serve each tool call's thread | Subagents numbered by their first call | `metrics` "test_session_calls_carry_their_lane_and_input" (agent-b before agent-a; no `.jsonl` in the payload) |
| | A session resumed into a second main file | the same test (`m1` in `s4.jsonl`, `m2` in `s4-resumed.jsonl`: lane 0) |
| | A subagent call with no result | the same test (`nr`: lane null) |
| | A cut session | the same test (`TIMELINE_CAP` patched to 9: lanes `[0, 0, None, 1, 2, None, 2, 1, 2]`, `truncated` and `calls_truncated` true; patched to 10, the number of calls: all 10 sent, both false) |
| Serve each tool call's input from one snapshot | A long input | the same test (130 characters sent as 120; a NULL as "") |
| | An ingest during the read | the same test (the `rows` patch commits a call after each statement: 10 calls and a Tools sum of 10) |
| Read the tool-call chart by thread with the keys | Changing thread | `reading` "from %o on %s" (rows `[b, "ArrowDown", e]`, `[d, "ArrowUp", a]`, the tie to the earlier); `browser` 387 "keys: ${seq.length} presses of Right, Left, Home, End, Down and Up read as decision 7 says, …" |
| | At the end of a lane | `reading` "from %o on %s" (rows `[c, "ArrowRight", c]`, `[e, "ArrowDown", e]`); said again: `component` "reads the main thread's first call on Right …" (Left at the lane's first call says it again) and `browser` 387, as above ("a key that cannot move says it again"); the sheet does not scroll: `component` "reads the main thread's first call on Right …" (prevented) and `browser` 389 "keys: every one is prevented and the sheet does not scroll" |
| Read the tool-call chart with the pointer and open a tool | Opening the tool | `component` "opens the read call's tool on Enter and the clicked one's on a click, and says a call with no tool has no sheet"; `browser` 399 "Enter on ${at.tool} opens its tool's sheet in place of the session's, and the browser's Back returns to the session's" and 408 "a click on the test run opens Bash's sheet, and the browser's Back returns to the session's" |
| | Empty space | `reading` "%s" of `spanAt` (rows "7px beside a bar" and "in the gap after the lane": null); `component` "reads the call under the pointer with a hand over it, nothing in empty space, and ends on leaving"; `browser` 348 "the pointer in empty space reads nothing; the cursor is a hand over a span only" |
| Keep and end a tool-call reading | Escape with a call read | `component` "ends a reading on Escape and keeps the key from the sheet; with nothing read, leaves Escape to the sheet" (prevented, composition and another control); `browser` 474 "a pointer's tooltip with the focus on another control: Escape ends the reading and the sheet stays open; a second Escape closes it", 494, 504 and 519 (the command palette) |
| | A call gone from newer figures | `component` "keeps a key's reading on newer figures and says its newer words, and ends it quietly when its call is gone"; `reading` "reads nothing of a gone call, and never says a missing value"; `browser` 906 "newer figures (a window focus) keep the call read with the keys on its drawn span, and say nothing" |
| Word a tool call | A failed call | `reading` "says each call in one sentence, its true times and one-unit duration" (a 6.5-minute failed Bash: "…, 7m, failed: npm test. 2 other calls ran during it.") |
| | A call with no result | the same test ("Bash on subagent 2, started …, no result recorded: npm run dev. 1 other call ran during it.") |
| Fit the tool-call tooltip and label the chart | A long input in a narrow box | `browser` 712 "${what}: the tooltip of a ${BIG.length}-character input and a ${MCP.length}-character tool name, by a key and by the pointer, is shown, both wrapped, inside the box", 692 and 610; clear of the mark: `component` "reads the call under the pointer …" and `browser` 362; the label: `reading` "labels the group" |
| | A key's reading near the window's top | `component` "reads the main thread's first call on Right …" (the box at the window's top: below the call; 500px down: above it, though not inside the box); `browser` 442 "a key's reading of the main thread's first call with the chart's box in view: the tooltip is shown above the call, inside the window, clear of the call's mark and of "Show data table"" and 451 "…and with the chart's box at the very top of the sheet's visible area, the tooltip goes below the call, clear of its mark, inside the window" |
| Offer the tool calls as a table | Show all | `component` "lists the 20 longest calls in its data table, then every call with the focus on the 21st, and a row opens its tool" (27 calls); its own scroll region: `browser` 737 "${what}: the "Calls by duration" table opened with every row scrolls sideways in its own region, not the sheet; …" |
| Fold extra rows and threads | Nine subagents | In parts, not as one session of nine: `reading` "says the notes" (nine subagents: "Subagents 7 to 9 share the lane Other subagents."); `spans` "caps a subagent lane at three rows, and folds the seventh subagent into Other subagents" (the lane's name with its count, the call keeps its number); `reading` "says each call in one sentence, …" ("Bash on subagent 7, …", a folded call); the over-the-cap note: `reading` "says the notes" (on subagent 1 and on "the lane of subagents not told apart"), `spans` "packs %s" and `browser` 762 |
| Say what the tool-call chart leaves out | A cut session | `reading` "says the notes" ("Long session: only its first 22 tool calls are drawn." with the cut set); `component` "labels the chart, shows the hint, …" (shown with `calls_truncated`, not with `truncated` alone); the empty lines: `component` "says a session with no call, or too little activity for a timeline, in place of the chart" |
| Load the tool-call chart on its own | The chunk fails to load | `sheets` "says so when the tool-call chart's chunk fails to load, and the rest of the sheet works"; `browser` 794 "with the chunk's request blocked, the section says it could not be loaded, and the timeline and the Models block show"; not in the first download: `browser` 274 "a fresh page: no SessionSpans chunk is requested before a sheet opens" and 278 |
| Keep the tool-call chart legible everywhere | Forced colors | `option` "takes system colors for every fill and stroke under forced colors"; `browser` 847 "forced colors: the spans, the rings and the labels CanvasText (a failure's fill Canvas), the breaks GrayText" and 850 "forced colors: the mark is Highlight, and the key's three swatches are system colors"; theme and motion: `browser` 869, 877 and 885; fit: `browser` 286, 626, 635 and 680 |

## dashboard-app

| Requirement | Scenario | Proved by |
|---|---|---|
| Read a drawn chart of spans along and across its lanes | Reading before the chart has drawn | `component` "reads the main thread's first call on Right with its sentence, its tooltip shown and the mark around its bar" (the fake runtime draws nothing) |
| | Two calls at one moment | `browser` 336 "the pointer over the hollow test run, the failed Edit's tick and a ring reads that call, the mark on its drawn span within 1px" (the test run is the third of three calls starting at 1:30) |
| Tell spans apart by shape under forced colors | Failed and open calls in high contrast | `option` "takes system colors for every fill and stroke under forced colors"; `browser` 847, as above (rings `CanvasText`, a failure's fill `Canvas`); switching without a reload: the wrapper's environment, not tested here (it is the wrapper's rule, tested with it) |

No scenario is left with no test. Two are proved in parts: "Sessions from three agents" (one statement for every source, so not once per source) and "Nine subagents" (folding, naming and the note in separate tests).

## Net test lines

`git diff --shortstat origin/main HEAD -- tests 'web/src/**/*.test.ts' 'web/src/**/*.test.tsx'`: 7 files changed, 772 insertions(+), 0 deletions: **772 net**. The browser module, `tools/demo/chartfit/spans.mjs`, adds **911** lines more (58 check lines), outside the test suites.

| Where | Planned | Built |
|---|---|---|
| Python (`tests/test_metrics.py`) | 45 | 46 |
| layout (`spans.test.ts`) | 160 | 151 |
| reading and words (`spansReading.test.ts`) | 110 | 110 |
| option (`spansOption.test.ts`) | 70 | 115 |
| component (`SessionSpans.test.tsx`) | 150 | 222 |
| real ECharts (`SessionSpans.real.test.tsx`) | 70 | 108 |
| mount (`sheets.test.tsx`) | 5 | 20 |
| **Total** | **610** | **772** |

772 is 162 over the plan's 610 and 372 over the repo's advisory 400. Review fix 4 removed cases that repeated a branch or asserted a constant (a second `end > start` row, a second height row, four `stepSpan` rows, the separate Up/Down test, the jsdom forced-colors run, the option's constant ids, `z`, `silent` and `animation`) and added the tooltip's place by the window and the second over-the-cap note. Why it stays over:

- The section owns a reading in two dimensions that the wrapper cannot give (design decision 7), as the calendar (701), the cost flow and the session plot (611 to 654) did; that was the plan's 610.
- The option grew by its forced-colors set and the check that every token handed to `env.color` is declared in `theme.css`; the real-ECharts test by the clipped point's five points and margin.
- The component grew by the edge cases step 1.9 found, each a new branch: Escape during composition and on another control, the tooltip kept clear of the mark, the tooltip above or below by the window, Show all landing on a row with no button, a call with no tool.
- The mount grew by one new test, the failed chunk load (a new branch: the import fails), which the plan left to the browser alone.
- No test replays another layer's cases: the component test asserts the words through `readSpan` and `noteLines`, not their cases again.

## Known and left as is

Each checked against the code at the head of review fix 4.

- `web/src/api.ts` types a call's `tool` as `string` and `is_error` as `boolean`, never null, though both can be (a call with no tool name; a call with no result). The section reads them through its own `SpanCall` type, which allows null. Fixing `api.ts` reaches into `session.ts`, which this change may not edit.
- A subagent's call with no result yet has a NULL `result_file`, so it sits on "Subagents, not told apart"; it moves to its subagent's lane when the result lands.
- A zero-length call (its end at its start) reads "no duration recorded" and is drawn as a tick, as a call with no duration.
- The axis's two time labels can overlap in a 343px box at 32px text on a session over 20 hours (they carry a date), as the timeline's own labels do.
- At 32px text in a 343px box the session sheet scrolls sideways because of a chip in the sheet's header (`div.hint > span.chip`, 454px), with or without this section. The section adds no sideways scroll of its own.
- The content under the section moves once (measured 406px) when the chunk arrives after the session's figures were cached.
- A key's tooltip above the call can cover the section's hint and key line, and below it the labels of the lanes below: its placement keeps clear of the span's mark only.
- The room above is measured against the window, not the sheet's sticky head (97px tall at 1440px): a call less than about the tooltip's height below the head gets its tooltip above, partly where the head is; the browser check does not measure which of the two is drawn on top.
- The over-the-cap note counts the others as the lane's rows ("ran beside 4 others"): when more than one call runs past the cap at once, a call ran beside more others than it says.
- At 32px text the bars stay 8px high and the rows 10px: only the labels and times scale.
- A failed chunk load stays failed until a reload: React.lazy keeps its result.
- A touch tap reads the call and opens the tool's sheet at once (the tap's mouse move and its click come together), as on the other graphs.
- The row and lane caps (4, 3, 6) are set from the synthetic demo store, not from a real one.
- An old transcript whose main thread has no call with a result shows its main file as "Subagent 1", holding every sidechain call.
- A Codex rollout moved (compressed or archived) while it ran shows as two lanes.
- Opening a session sheet on a page without charts (Live, Limits, Context) downloads the ECharts chunk once per visit.
- The browser check ran on Chromium's headless shell only; Firefox and Safari were not run.
