# Design

## Context

See `proposal.md` for the motivation. The reader's question is "which of this project's sessions cost a lot and did little, and which were cheap and did much". Every open choice below is settled from that reader's side.

"The wrapper" is `<EChart>` in `web/src/components/echart/EChart.tsx`. Its files (`EChart.tsx`, `option.ts`, `stack.ts`, `testing.ts`, `zoomReset.tsx`, and `realTesting.ts`, now on main) belong to another team. **This change edits none of them**, and does not edit `echarts.ts`. Everything the graph needs is in `web/src/pages/project/quadrant/`. Context's hand-drawn `SessionMap.tsx` is read for its patterns and not changed: another team migrates it.

**Facts checked in the code** (base `4de1da48`; the change was later rebased on main `036b4131`, where the Errors page draws with the wrapper too, and every chart redraws once when the web font loads).

- The Project page reads `queries.usage(want)` with the project as the filter; every usage block renders through `Block` in `blocks.tsx`, which owns loading, error, Retry, `aria-busy`, dimming and the landing.
- `usage.sessions` (`metrics.usage()`, line 472) is the view's sessions sorted by `first_ts`, newest first, cut to 300. `totals.sessions` is the count before the cut. `top_sessions` are the 50 costliest, passed through `titles.with_titles()`; `sessions` rows carry no title (`SessionRow.title` is "set on top_sessions and /api/sessions rows only").
- `SessionRow` has `cost` (null when every request is unpriced), `unpriced` (requests with no price), `tool_calls`, `commits` (`is_commit AND test_passed`: a commit that succeeded), `prompts`, `first_ts`, and no `source`. Counts are limited to the view's range.
- `is_commit` is set by all three parsers from a shell call matching `GIT_COMMIT` (`store.py`, `codex.py`, `grok.py`). Tool calls are rows of `tool_calls` for all three. Lines changed exist in `session_runs` (Claude Code's cost-state lines; Grok "reports neither", Codex writes no runs) and in `/insights` session-meta rows (Claude Code only).
- A session row opens its sheet with `openSessionSheet(id)` (`components/sheets/session.ts`); a session's name is `sessName()`, the title or `#` and the id's first 8 characters.
- The wrapper reads keys on one ordered list of points (`STEPS`: Left, Right, Home, End), its pointer reads `convertFromPixel({ xAxisIndex: 0 }, offsetX)` inside grid 0, a key's tooltip and band go to `convertToPixel({ xAxisIndex: 0 }, i)`, and no prop reports or sets the point read.
- Bundle at the base: `echarts-*.js` 176.5 kB gzip (limit 195), `index-*.js` 109.1 (130), `CostPage-*.js` 12.1 (20), `ActivityPage-*.js` 23.7 (28), `zoomReset-*.js` 7.7 (9), `ProjectPage-*.js` 4.4 kB with no limit.

**What a spike measured** (ECharts 6.1.0, SVG renderer, vitest and jsdom with `vi.unmock` of `components/echart/load`, through `init()` and through the real wrapper; `npm run build` and `node scripts/check-bundle.mjs` for sizes; the demo store of `tools/demo/seed.py` written to a scratch path, 499 sessions over 5 projects and three sources, read with `metrics.usage()` per project at 30 days and all time; the generated usage fixtures. The spike files are deleted. No browser was used: what only a browser shows is listed in decision 12 and checked in step 4.1.)

| Question | Result |
|---|---|
| Candidates for the vertical axis on the demo store, 10 project views (5 projects × 30 days, all time) | **Commits** 0 for 41% to 62% of a view's sessions (atlas-api 30 days 56 of 93, all time 100 of 182; pixel-studio 43 of 73; docs-site 11 of 21; ledger-web all time 40 of 97), median 0 in 9 of 10 views, 4 to 6 distinct values. **Lines changed** 0 for 100% (the demo writes no run lines; Codex and Grok never have them). **Prompts** never 0, but 6 distinct values (1 to 6) and 17 to 36 sessions on the median value. **Tool calls** never 0 in any view or source (Claude Code, Codex and Grok counted apart), 19 to 59 distinct values, 0 to 6 sessions on the median value. |
| The same on the generated fixtures (10 sessions in 4 payloads) | commits 0 for 8, tool calls 0 for 4 (sessions of requests only), prompts 0 for none |
| Spread and link to cost (demo, tool calls) | max ÷ median 2.6 to 2.8; Spearman with cost 0.72 to 0.83. Split at the medians, the off-diagonal quadrants hold 8 to 22 sessions per view (9% to 12% each); atlas-api 30 days: 39 cheap and little, 8 cheap and much, 8 costly and little, 38 costly and much. |
| Cost spread (demo) | median $1.09 to $2.09, max ÷ median 3.9 to 13.1, from $0.04 to $20.01: 2.7 decades |
| Titles for the 300 `sessions` rows (demo, all projects, all time) | `titles.titles()` 17 ms of `usage()`'s 340 ms; 272 of 300 titled; 10.3 KB of JSON. atlas-api 30 days: 93 sessions, 50 of them in `top_sessions`, so 43 dots (46%) would have no title without it. |
| Log axis, explicit `min` 0.02 and `max` 50 | extent kept as given (`scale.getExtent()` = [0.02, 50]); labels at the powers of ten and at both ends: "$0.02", "$0.1", "$1", "$10", "$50". |
| Value 0 on a log axis | `convertToPixel` gives `-Infinity` (x) and `Infinity` (y): a 0 cannot be drawn as data. |
| Grid at 343 × 260, default `outerBoundsMode` | ECharts' x pixel differs from `left + (log v − log min) ÷ (log max − log min) × width` by 0.24 px at 11px labels and by 9.5 px at 22px labels: ECharts 6 shrinks the grid to fit the labels. |
| The same with `outerBoundsMode: "none"` | equal to the formula to 1e-13 at 11px and 22px labels (x of $1: 189.5 and 189.5; 213.5 and 213.5). |
| Labels at 343px, 5 decades, `hideOverlap: true` | 11px: "$0", "$0.1", "$1", "$10", "$100", all shown. 22px: the same. 22px over $0.05 to $20: "$0.1", "$1", "$10", the end labels hidden. |
| A zero lane: y `min` 0.5 under "1", the min label formatted "0" | 11px, plot 212px: "0" and "1" 19 px apart, both shown. 22px, plot 176px: 16 px apart, "0" hidden. 22px, plot 338px: 31 px apart, both shown. |
| Custom series `circle` through `api.coord` | written as a path, `M{cx + r} {cy}A{r} {r} 0 1 1 …`, `fill-opacity` and `stroke-opacity` from `style.opacity`. A custom `line` with `lineDash: [5, 4]`: `stroke-dasharray="5,4"`. A custom `text` with `stroke` and `lineWidth`: drawn with its halo. |
| System colors | `fill="CanvasText"`, `stroke="Canvas"`, `stroke="GrayText"` written as given, on dots, split lines and axis labels. An axis label with no color set is `#54555a`: the option sets every color. |
| Axis names (`nameLocation: "middle"`, `nameRotate: 90`) | drawn, the y name rotated (`matrix(0,-1,1,0,…)`). |
| **Way (a): the wrapper's own reading**, 7 dots ordered by cost, log x axis, `points={7}` | Pointer over the dot at $0.50 reads point `0.5000000000000002`, at $1.42 point `1.4200000000000002`, at $20 nothing (20 ≥ 7): the pointer reads the cost as an index. Right, Right read points 0 and 1, but their tooltip and band go to `convertToPixel(x, i)`, the pixel of $0 (`-Infinity`) and of $1, not the dots. |
| Way (b) bundle: a prototype block (log axes, custom series dots, own keys) imported by `ProjectPage.tsx` | `echarts-*.js` 176.5 kB, unchanged. `ProjectPage-*.js` 4.4 to 5.1 kB. The build moves the wrapper out of `zoomReset-*.js` (7.7 to 2.1 kB) into a new chunk `EChart-*.js` (6.0 kB) that Cost, Activity and Project share. `check-bundle.mjs` still passes, but its 9 kB limit then guards 2.1 kB and the new chunk has none. |
| Way (a) bundle: `ScatterChart` registered | `echarts-*.js` 178.2 kB: +1.7 kB. `MarkLineComponent` for guide lines: +5.6 kB (measured by the owner). |

## Goals / Non-Goals

**Goals:**

- One picture of the project's sessions in the view, cost against what they did, split into four named quadrants, every dot named and opening its session.
- Every dot reached by keyboard and by pointer, with its figures in words.
- Nothing new in the ECharts chunk: a treemap is still to come.
- No edit to the wrapper's files, and no change to the page's existing blocks.

**Non-Goals:**

- Selecting a quadrant to filter other blocks (Context's session map does that; this block does not), a zoom, lasso or brushing.
- Another vertical measure, a switch between measures, or a cost-per-tool-call ratio.
- Coloring dots by outcome, source or model. The page is one project: dots take its hue.
- The block on any page but Project.

## Decisions

### 1. The vertical axis is tool calls; a commit is a filled dot

Tool calls, the count of tool calls the session made in the view, are the vertical axis. They count what a session did, not what it produced, and the hint says so: "Done" counts tool calls, not results.

Why, from the measurements:

- **Commits leave most dots on the floor.** 41% to 62% of a view's sessions have none, and the median is 0 in 9 of 10 views: the guide line would lie on the axis and the "little done" half would be every session without a commit. Four to six distinct values stack the rest in rows.
- **Lines changed are not true for all three sources.** Only Claude Code writes them, in run lines or in `/insights` session-meta rows. A Codex or Grok session would read "0 lines" when it changed hundreds.
- **Prompts are what the user asked, not what the session produced**, and with six values a third of the sessions sit on the median line.
- **Tool calls** are recorded for every source, never 0 in any measured view, and spread over 19 to 59 values, so the medians split the dots cleanly. They are the agent's actions: reads, edits, commands, searches. That is "what the session did", not "what it achieved", and the names say so (decision 2).

Commits still answer "did little": a session that made a commit is drawn as a filled dot, one that made none as a hollow ring. Shape, not color, so it holds under forced colors. The sentence and tooltip give the count.

Tool calls follow cost (Spearman 0.72 to 0.83): most dots lie along the diagonal, and the two off-diagonal quadrants hold the sessions the reader looks for (9% to 12% each).

### 2. Guides at the medians; four quadrant names

Two dashed lines, at the median cost and the median tool calls of the sessions shown. Medians, not means: one $20 session moves a mean and not a median, and a log scale does not move a median.

A session is **costly** when its cost is above the median cost, else **cheap**; **much done** when its tool calls are above the median, else **little done**. A session on a line counts as cheap or as little done. The names, in the corners they name:

| | Cheap (left) | Costly (right) |
|---|---|---|
| Above the median of tool calls | Cheap, much done | Costly, much done |
| At or below it | Cheap, little done | Costly, little done |

"Done" names tool calls, which the axis says; no name claims a result the data does not hold ("win", "waste").

- **On the plot**: each name in its quadrant's outer corner, 6px × s from the plot's edges, with a 3px halo in the surface ink, when its estimated width (0.6em a character at 11px × s) fits its quadrant's width less 12px × s. A name that does not fit is not drawn.
- **Always under the plot**: a list named "Sessions per quadrant" of the four names, each with its count ("Costly, little done 8"), in the table's order of the corners (top left, top right, bottom left, bottom right). So a name that does not fit on the plot is still on screen, and a screen reader gets the counts in the label too.

### 3. Scales: log on both axes, a zero lane, fixed extents

- **Cost: log.** 2.7 decades on the demo store, max ÷ median up to 13: on a linear axis half the dots would sit in the first tenth of the width.
- **Tool calls: log.** The demo's tool calls are not heavy-tailed (max ÷ median under 3), but the demo is synthetic; a real store holds long autonomous sessions of hundreds or thousands of calls beside 20-call ones, which a linear axis would crush to the floor. On a narrow spread a log axis is still readable (1 to 85 is two decades), so one rule fits both (open question 1).
- **Extents.** Each axis runs from the 1, 2 or 5 times a power of ten at or below the smallest positive value to the one at or above the largest (`roundDown`/`roundUp` as `SessionMap.tsx` has them, rewritten in the model: that module is not imported, another team owns its future). Equal ends: the top is ten times the bottom. An axis with no positive value (every shown session at 0) takes a fallback decade, $0.01 to $0.10 or 1 to 10, with a lane. Set as `min` and `max`; ECharts keeps them (measured).
- **Zero lane.** A 0 cannot be drawn on a log axis (measured: `±Infinity`). When a shown session is at $0, or at 0 tool calls, that axis gets a lane at its start, measured from `t`, the power of ten at or below the lowest value: ECharts ticks a log axis at its ends and at the powers of ten, so `t` is the smallest tick over the lane. The axis `min` moves down so the stretch below `t` is `L` px, and every 0 is drawn at the new `min`: `min = max(t × (t / hi) ^ (L / (P − L)), t / 10)`, P the plot's length (at least 2L). The lane spans at most one decade: a longer one would hold another power of ten, whose tick would hide the lane's label. Capped, the tick at the lane's `min` is that power of ten, and it reads "$0" or "0" too. The min label reads "$0" on the cost axis and "0" on the tool-call axis. `L` is 30px × s across (half a "$0.01" label beside "$0") and 16px × s up (one line: measured, "0" and "1" both shown at 19px apart at 11px, and at 31px at 22px). In a 343px box at 32px text the cost lane's "$0" gives way to the next tick's label (`hideOverlap`), while the tool-call axis's "0" is drawn. No lane when no session is at 0. A median on 0 is drawn at the lane's `min`.
- **Cost unknown.** A session whose `cost` is null (every request unpriced) is no dot: it cannot be placed. The block counts it (decision 9). A session with a cost and some unpriced requests is a dot at its known cost; its sentence says "at least".
- **Ticks.** ECharts' log ticks, at the powers of ten and the ends, `hideOverlap: true`. Labels: cost `$` + the value (`$0.1`, `$1`, `$10`), tool calls `num()`. Measured at 343px: five labels at 11px and at 22px.
- **Overlap.** No jitter: it would move a session off its figures. Dots are 4px radius, filled at 0.7 opacity with a 1px surface ring, so a pile reads darker. The pointer reads the nearest dot; its tooltip says how many other dots sit within 4px ("and 2 more sessions here"); the keys reach each one; the table lists all.

### 4. Drawing: custom series on a grid with two log axes

Way (b): a grid with `outerBoundsMode: "none"`, a log x axis and a log y axis, and two custom series: the guides and corner names, and the dots. All of it is already registered.

Why:

- **Budget.** 0 kB on the ECharts chunk against +1.7 kB for `ScatterChart` and +5.6 kB for `MarkLineComponent`. The two earlier graphs of this series added nothing either; a treemap is still to come.
- **Exact pixels.** With `outerBoundsMode: "none"` ECharts maps a value to the same pixel as the model's formula (measured, to 1e-13). The reading (decision 6) needs the pixels of the dots, and it computes them from the same fit, before the chart has loaded and when it fails. With ECharts' default bounds the two disagree by up to 9.5px at 32px text (measured).
- **Axes for free.** ECharts draws the ticks, the grid lines, the labels and the axis names, so the graph has no axis code of its own.

Rules: `echarts.ts` is not edited; every series is `silent: true`; the option sets `animation: false` in every mode.

### 5. Data: titles on the usage payload's `sessions` rows

`usage()` builds `recent` (the newest 300 sessions) and `top` (the 50 costliest) and names both with one lookup: `titles.with_titles(cur, recent + top, prompts=True if project else [ids of top])`. A title is the stored custom or agent title, else one made from the first prompt. The first-prompt fallback reads raw lines per session and is not saved, so `titles()` and `with_titles()` take `prompts` as True, False or the ids whose first prompt may be read: on a request for one project (the Project page) every `sessions` row may fall back to its first prompt; on a request for all projects only the `top_sessions` rows may, and the other `sessions` rows take a stored title or None. `SessionRow.title`'s comment says so: "A stored title, else one from the first prompt; set on sessions, top_sessions and /api/sessions rows. On a sessions row the first prompt is read only for one project's view or a top_sessions row; else it is a stored title or null."

Why: a dot's sentence and tooltip start with the session's name. Without it, 46% of atlas-api's dots on the demo store would be "#demo-000" ids: the cheap sessions, exactly the ones the reader looks for. Cost: 17 ms of 340 ms and 10.3 KB on the demo store for all 300 rows, measured before the fallback was kept to one project; the session sheet's title cache (`UsageSheets.tsx`) reads these rows and gets the names too.

Alternatives:

- **Titles from `top_sessions` only, and `sessName()`'s id for the rest.** No server change, but nearly half the dots unnamed. Rejected.
- **`/api/sessions?project=…`, which has titles.** A second request with its own loading, error and cache, and a page of 100 that is not the same 300 rows. Rejected.

Everything else is on the rows: `cost`, `unpriced`, `tool_calls`, `commits`, `first_ts`. No `source` is needed. The range, source and automated filters are the usage request's own, so the block follows them as every usage block does.

**The 300 cap.** `sessions` is the newest 300 of the view. When `totals.sessions` is larger, the dots and the medians are those of the newest 300, and the block says so (decision 9). A project of more than 300 sessions in one view is a long all-time range; a 30-day view of one project rarely reaches it.

### 6. Reading: the graph's own, dot by dot along cost

**Why not the wrapper's** (measured, way (a)): its pointer reads the x axis value as a point index, so on a cost axis it reads "point 1.42" or nothing; its key tooltip and band go to the pixel of the index as a cost. Neither can be fixed from outside: no prop sets the pointer test or the place of a point. So the wrapper draws and the graph reads, as the calendar and the cost flow do: `<EChart>` gets `points={0}`, `read={() => ""}`, and no `tip`, `onActivate`, `status`, `onEscape` or `zoom`. It leaves keys and pointer alone (measured by the cost flow) and keeps the focusable `role="group"` box, its label, the lazy load, the environment, the resize and the "could not be drawn" text.

It is a smaller reading than theirs: one order, one pointer test, no Up or Down.

- `quadrant.ts`, pure: `quadrantModel(rows, totalSessions)`, `quadrantFit(model, width, s)`, `dotAt(fit, x, y)` (the nearest dot within 12px, or null; ties to the costlier), `stepDot(order, at, key)` (the dot a key reads, or undefined), the sentences, the tooltip's rows, the group's label and the notes.
- `SessionQuadrant.tsx`: the state `{ id, keyed, text, n } | null` (`n` makes the live region say a sentence again) and the session whose sheet a dot opened, the handlers on a `div.quad-box` around the wrapper's box, the tooltip, the mark and the live region.

**Order.** Cheapest first; equal costs by tool calls, fewer first; then by start, then by id. A session at $0 is first.

**Keys**, on the focused box:

| Key | Reads |
|---|---|
| Right, Left | the next, the previous dot in the order; stops at the ends, and says the reading again |
| Home, End | the cheapest, the costliest dot |
| Right with nothing read | the cheapest; Left with nothing read: the costliest |
| Enter | opens the read dot's session sheet (decision 7) |
| Escape | ends the reading; with nothing read, left to the page |

Up and Down are left to the page (it scrolls); a key with Alt, Ctrl, Meta or Shift is the browser's (`modified()`). Blur ends the reading. Escape ends a reading the pointer opened from anywhere: a capturing `keydown` listener on the document while a reading is open, as the wrapper has it. The listener is attached in a layout effect, before the paint, so an Escape pressed as the tooltip shows finds it.

**Pointer.** `mousemove`, `mouseleave` and `click` on `div.quad-box`; the position is the client position less the plot's. `dotAt` reads the nearest dot centre within 12px (`SessionMap.tsx`'s `PICK_PX`); outside every dot nothing is read. A click on a dot reads and opens it. The cursor is a hand over a dot (a class on `div.quad-box`), the default elsewhere.

**The mark.** A ring around the dot read, `<svg class="quad-mark" aria-hidden="true">` over the plot: radius 8px, 2px line in `--text-primary`; `Highlight` under forced colors. HTML, so it works before the chart has drawn.

**The tooltip.** A `div.tip` with `role="tooltip"`. The app's stylesheet hides a `.tip` until its chart shows it, so the component shows its own with an inline `display: block`. It is placed with `tipAt()` beside the pointer, or beside the dot for a key; when beside would cover the dot or its neighbours, or leave the box, it sits above the dot (below it at the window's top), inside the box. A long session name wraps (at most 18rem wide). Rows: the name (bold), "Started" with the start as `when()` writes it in the browser's locale, "Est. cost $4.20" (with "at least" and the graph's own `Unpriced` chip when some requests are unpriced), "Tool calls 12", "Commits 0", the quadrant's name, and "and 2 more sessions here" when other dots' centres are within 4px.

**The live region.** One `div.sr` with `aria-live="polite"` in the component; the wrapper's stays empty. Sentences:

| Case | Sentence |
|---|---|
| A dot, 3 sessions or more | "Add rate limiting to the /orders endpoint, started Nov 3, 02:20 PM: $4.20, 12 tool calls, no commit. Costly, little done." |
| With commits | "Fix the flaky invoice export test, started Nov 2, 09:05 AM: $0.85, 41 tool calls, 2 commits. Cheap, much done." |
| Some requests unpriced | "#demo-012, started Nov 1, 04:40 PM: at least $1.10, 30 tool calls, 1 commit. Costly, much done." |
| At $0 or 0 tool calls | as above, with "$0" or "no tool call" |
| A positive cost under a cent | "under $0.01" ("<$0.01" in the tooltip and the table); with unpriced requests, "more than $0" |
| Fewer than 3 sessions | the same, without the quadrant |

The name is `sessName()`; the start is `when(first_ts)`, whose time follows the browser's locale (an en-US browser writes "09:05 AM"); the cost `usd0()`, so a true zero reads "$0"; counts `plural()`.

- A key that cannot move says the sentence again, so it is not met with silence.
- Newer data keeps the reading: it is held by session id. It ends with a new view, and quietly (no sentence) when newer data no longer holds that session. A reading a key made is said again when newer data changes its words; the pointer's is not (the wrapper's rule).

**The group's label**, on the wrapper's box: "Sessions of atlas-api by estimated cost and tool calls, both on log scales: 93 sessions, split at the medians of $1.42 and 23 tool calls. (A median of an even count can be a half: "22.5 tool calls".) Costly, little done: 8; cheap, much done: 8; costly, much done: 38; cheap, little done: 39. Filled dots made a commit. Use the left and right arrow keys to step from the cheapest session to the costliest, Home and End for the ends, Enter to open one." With fewer than 3 sessions the second and third sentences become "2 sessions: too few to split at a median."

**The visible lines.** Block title: "Sessions by cost and tool calls". Hint: "Each dot is a session: cost across, tool calls up, both on log scales. Dashed lines mark the medians; a filled dot made a commit. "Done" counts tool calls, not results."

### 7. Enter and click: the session's sheet

Enter on the read dot, or a click on a dot, calls `openSessionSheet(id)`, as a row of the Sessions block does. The reading ends, but not its place; the sheet takes the focus and is announced by its own name, so the live region says nothing more (no status sentence). Closing the sheet puts the focus back on the plot, with nothing said; Right and Left then go on from the dot opened (checked in step 4.1).

### 8. Colors, forced colors, dark and motion

- **Dots** in the project's hue, `useColors()(project)` (`--proj-N` or `--proj-other`), handed to `quadrantOption` as its third argument and resolved through `env.color`: one project, one hue, as everywhere on the page. Filled: the hue at 0.7 with a 1px `ink.surface` ring. Hollow: `ink.surface` fill with a 1.5px ring in the hue.
- **Guides** 1px dashed (`[5, 4]`) in `ink.muted`. Corner names in `ink.secondary` at 11px × s, weight 600, with a 3px `ink.surface` halo. Axis labels `ink.muted`, axis names `ink.secondary`, split lines `ink.grid`: every color set (measured: an unset one is `#54555a`).
- **Color is never alone.** Quadrants are told by place and named in words; a commit is told by fill, not hue; every figure is in the sentence and the table.
- **Forced colors.** `env.ink` is the system set: dots `CanvasText` (filled) or `Canvas` with a `CanvasText` ring (hollow), guides and labels `CanvasText`, split lines `GrayText`, the mark `Highlight`, the halo `Canvas`. Measured: ECharts writes system color names as given. The graph redraws when forced colors turns on or off: the wrapper's environment changes.
- **Dark.** The tokens carry both schemes; the wrapper redraws on a theme or scheme change. The mark's `--text-primary` turns light.
- **Reduced motion, and in every mode.** `animation: false`: a dot sliding in would read as a session changing.

### 9. Few sessions, cut-offs and empty cases

| The view | The block shows |
|---|---|
| No request (`totals.requests` 0) | "No requests in this view." (the page's other usage blocks' line) |
| Sessions, none with a known cost | "No session in this view has a known cost, so none can be placed." No plot. |
| 1 or 2 dots | The dots, no guides, no corner names, no quadrant list, and the line "1 session: too few to split at a median." (or "2 sessions: …") |
| 3 dots or more | The split |
| `totals.sessions` > 300 | Above the plot: "The newest 300 of 412 sessions in this view; the medians are theirs." |
| Sessions with no known cost | Under the plot: "2 sessions with no known cost are left out." |

Three is the smallest count with a middle: one dot sits on both lines and counts as cheap and little done, the other two fall on either side. Two dots split at a median would put each in its own corner by construction.

### 10. Place: the right column, after Sessions

A new `Block` ("Sessions by cost and tool calls", id `quadrant`), in `blocks.tsx` as `QuadrantBlock`, rendered by `ProjectPage.tsx` between `SessionsBlock` and `InsightsBlock`. Its link: "Open in Activity", to Activity filtered to the project, as Sessions. It reads usage alone, so it loads, fails, retries, dims and lands with the other usage blocks, through `Block`.

Why there: Sessions lists the eight costliest; this block puts them among the rest. The right column is about 570px wide at 1440px, room for the plot. Narrow screens stack it in the same order.

### 11. Sizes and the option

`quadrantFit(model, width, s)`, pure; `s` is the text scale, read once per render.

| Name | Value |
|---|---|
| Plot height | 210px |
| Margins | left 58px × s (labels to "1,000" and the rotated axis name), right 14px × s, top 10px × s, bottom 44px × s (labels and the axis name) |
| Box height | 210 + 54 × s, rounded: 264px at 16px text, 278px at 20px, 318px at 32px |
| Dot | radius 4px; mark radius 8px |
| Zero lanes | 30px × s across, 16px × s up, only when needed |

At 343px and 16px text the plot is 271px wide; at 32px text, 199px.

```ts
{
  ...baseOption(env), animation: false,
  grid: { left: fit.plot.x, top: fit.plot.y, width: fit.plot.w, height: fit.plot.h, outerBoundsMode: "none" },
  xAxis: { type: "log", min: fit.x.min, max: fit.x.max, name: "Estimated cost (log scale)", nameLocation: "middle",
           nameMoveOverlap: false, nameGap: 26 × s, nameTextStyle: { color: ink.secondary, fontSize },
           axisLabel: { color: ink.muted, fontSize, margin: 6 × s, hideOverlap: true, formatter }, splitLine: { show: true, lineStyle: { color: ink.grid } },
           axisLine: { show: false }, axisTick: { show: false } },
  yAxis: { type: "log", …the same, name: "Tool calls (log scale)", nameGap: 42 × s, nameRotate: 90 },
  series: [
    { type: "custom", id: "guides", silent: true, data: [[median cost, median calls]] or [], encode: { x: 0, y: 1 }, renderItem: two dashed lines and the corner names that fit },
    { type: "custom", id: "dots", silent: true, z: 3, data: dots as [x, y, filled], encode: { x: 0, y: 1 }, renderItem: a circle at api.coord },
  ],
}
```

- The grid is the fit's plot, given by its left, top, width and height (not bottom: the box's height is rounded, the plot's is not). `QuadrantFit` holds that rectangle as `plot` and has no `grid` field.
- `nameMoveOverlap: false` keeps each axis name where its gap puts it, inside the box: ECharts 6 would move a name past a label it comes near ("1,000" up), and the tool-call axis's name was once drawn 1px outside the box.
- The guides' `renderItem` places the lines with `api.coord` at the medians; the dots are drawn at `api.coord` of their values (0 already moved to the lane's `min` by the fit).
- `quadrantOption(fit, env, hue)` in `quadrantOption.ts`, types only from the runtime; `hue` is the project's color as CSS. `baseOption()` from `option.ts` as it is.
- **The view key**, given to the wrapper and to the reading: the page's query string (`scope.search`: the project, the range, the source and the automated filter). Not the figures.

### 12. The data table, tests and the browser check

"Show data table" under the plot, through `ChartTable` and `Table`, closed on every load. Name: "Sessions on the plot" (the block's region has the block's title). One row per dot, costliest first. Columns: Session (its name as a button, as `SessionMap.tsx`'s table has it, with a `pick` that opens the sheet), Started, Est. cost, Tool calls, Commits, Quadrant (empty with fewer than 3 dots). Sessions with no known cost are not rows: they have no place.

| Where | What | Catches |
|---|---|---|
| `tests/test_metrics.py`, `SessionTitlesTest` | 52 sessions, two outside `top_sessions`: over all projects a `sessions` row past the cut takes a stored title or None; for one project it takes its first prompt | The payload change and the first-prompt cost |
| `quadrant/quadrant.test.ts` | model, fit, lanes, medians, quadrants, order, `dotAt`, `stepDot`, sentences | Every rule of decisions 1 to 3, 6, 9 and 11 |
| `quadrant/quadrantOption.test.ts` | the option with a stubbed `api` | Log axes and extents, lanes' labels, colors and forced colors, `animation: false`, silent series |
| `quadrant/SessionQuadrant.test.tsx`, fake runtime | What a user reaches: label, hint, keys, pointer, tooltip, sentence, Enter, Escape, few and empty cases, notes, table | Wiring and wording |
| `ProjectPage.test.tsx` | the existing layout test: the right column's ids; one test that the block plots the payload's sessions and opens the one read on Enter | The place and the wiring |
| `quadrant/SessionQuadrant.real.test.tsx`, real ECharts | one dot path per session, the zero-lane dot at the fit's pixel; filled and hollow told apart; the two dashed guides at the medians, none under three dots; the lanes' "$0" and "0" and a tick on each axis as text; no stale path after newer rows; under forced colors every dot `CanvasText`. Nothing logged (test-setup fails a test on it). The geometry of every dot and the forced colors of the guides and split lines are the model's, the option's and the browser check's | An option ECharts refuses or draws elsewhere |
| `tools/demo/chartfit/quadrant.mjs`, Chromium | what jsdom cannot show (below), 69 lines | Layout, real text, real events |

The fake runtime draws nothing, and the reading does not use the chart: a graph that draws no dot passes every fake test. The real test and the browser check are the ones that see the drawing.

Only a browser shows: real label widths at 16px and 32px (the corner names' fit, the tick labels' overlap, the zero lane's labels); that the mark sits on the drawn dot within 1px; that `mousemove` and `click` reach `div.quad-box` through zrender's svg, and a touch tap; the hand cursor; the focus after the sheet closes; forced colors; dark and the OS flip; no sideways scroll at 375px and at 32px text.

Net test lines, estimated: Python 6, model and reading 140, option 45, component 110, page 2, real 60: about 360, under the 400-line advice. As built: 611 (Python 26, model and reading 172, option 102, component 205, page 17, real 89); `verification.md` says why.

### 13. Bundle

As built, on the build rebased on main `036b4131` (gzip -9, as `check-bundle.mjs` prints it):

- `echarts-*.js`: unchanged, 176.5 kB of 195. No part registered: the chunk did not grow.
- `ProjectPage-*.js`: 9.0 kB (4.4 kB at the base). A limit of 11 kB is added to `check-bundle.mjs` (it had none), so a later static import of ECharts into the page fails the check.
- **The shared chart chunk.** The Project page draws with `<EChart>` but does not zoom, so the build moves the wrapper out of `zoomReset-*.js` into a shared `EChart-*.js` chunk (6.3 kB), which Cost, Activity, Errors and Project load, and leaves `zoomReset-*.js` at 1.2 kB. `check-bundle.mjs` adds `EChart` to `LIMITS` (8 kB) and to `SINGLE`, and lowers `zoomReset`'s limit from 9 to 3 kB, with comments that say what each chunk holds. `check-bundle.mjs` is not one of the wrapper's files.
- `index-*.js`: 109.9 kB of 130; `CostPage-*.js` 12.1 of 20, `ActivityPage-*.js` 23.7 of 28, `ErrorsPage-*.js` 21.0 of 26 (main's).

## For the owner of the shared chart component

Not tasks of this change. With these, a scatter could use the wrapper's own reading and drop `dotAt`, `stepDot`, the tooltip, the mark and the live region (about 120 lines and their tests):

1. **A pointer test.** `locate={(x, y) => index | null}` in place of the band of x axis 0 under the pointer. A value or log x axis gives values, not indexes (measured: "point 1.42").
2. **The place of a point.** `where={(i) => [x, y]}` for a key's tooltip and the mark, in place of `convertToPixel({ xAxisIndex: 0 }, i)` and the axis pointer's band, which on a value axis go to the pixel of the index as a value.
3. **A mark that is not a band.** A ring on the point read (or `onRead(i | null)`, so the chart draws its own).

With 1 to 3, a scatter's points can stay one ordered list: the wrapper's keys (Left, Right, Home, End), Enter, Escape, blur and live region already fit it. This change relies on `points={0}` meaning "the wrapper draws and reads nothing", as the calendar and the cost flow do; no comment or test of the wrapper says so.

## Risks / Trade-offs

- **Tool calls are activity, not results.** A session can run 200 calls and achieve nothing. → The names say "done", not "won"; the filled dot shows commits; the sheet is one Enter away. Open question 1 asks the owner to check the choice on a real store.
- **A log y axis on a store whose tool calls are narrow.** → Two decades still read; the medians do not depend on the scale.
- **The reading rules now exist four times**: the wrapper, the calendar, the cost flow and here. → This one copies the wrapper's where they apply (Escape, blur, a key's reading said again), and the section above lists what would remove the copy.
- **The dots and the mark are drawn by two renderers.** → Both read one fit; `outerBoundsMode: "none"` makes ECharts' pixels the fit's (measured); the real test pins the dots, the browser check the mark.
- **Every page that reads usage pays for 300 titles.** → 17 ms and 10 KB on the demo store, in a 340 ms request; the first-prompt fallback, which reads raw lines, runs for every `sessions` row only on one project's view.
- **The chunk split moves bytes Cost, Activity and Errors already load** into a chunk the Project page shares. → Measured on the rebased build: `EChart` 6.3 kB and `zoomReset` 1.2 kB, and both chunks have limits.
- **Accepted limits.** A browser text-size change is picked up at the next render, as on Activity's chart. In a 343px box at 32px text the cost lane's "$0" label gives way to the next tick's. The tooltip below a dot at the bottom of the plot runs over the list under the plot.

## Open Questions

1. **The vertical measure on a real store.** The measurements come from the synthetic demo store and the fixtures: the plan never opens a real store. On the owner's own store (a copy, as `AGENTS.md` says), are commits as sparse and tool calls as spread as the demo shows? If tool calls turn out to be 0 for many sessions, the y lane holds them; if commits turn out common, the axis could be commits instead, at the cost of decision 1's reasons.
2. **Place.** After Sessions in the right column, as planned, or its own full-width row under both columns, where the plot would be twice as wide?
