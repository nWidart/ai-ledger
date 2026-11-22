# Design

## Context

See `proposal.md` for the motivation. Three archived designs hold what this one builds on, and all are true to the code:

- "The foundation": `openspec/changes/archive/2026-11-21-echart-foundation/design.md`, the wrapper's contract (decisions 5 and 8).
- "The Activity design": `openspec/changes/archive/2026-11-21-echart-activity/design.md`, `status`, `onEscape` and the `view` keys of the work chart and the outcome trend (decision 7).
- "The Errors design": `openspec/changes/archive/2026-11-22-echart-errors/design.md`. Its decision 8 and its risks record the limit this change removes.

This section holds only what shapes this change.

**The wrapper today** (`web/src/components/echart/EChart.tsx`, 540 lines).

- The point being read is `reading.i`, an index. The zoom window is `zoomed`, a `Shown { from, to }` of indexes.
- A chart passes a `view` key. While it is the same, a new option function is newer data of the same chart: it is drawn, and both indexes stay. When it changes, the reading ends, every point shows and the live region is emptied.
- "Within a view a point keeps its index, and new points come at the end" (the comment on `view`). So each chart puts in its key what fixes the first point.
- One chain of branches runs in the render, one branch a render: a new view, the `zoom` prop, a reading past the last point, a key's reading whose words changed, a zoom sentence that is no longer true, a new `status`. Each sets state, so React renders again and the next branch sees what this one left.
- After each drawing of the same view, `keep()` puts the window back on the indexes it showed: ECharts keeps a dragged window as a share of the points.
- A layout effect places the tooltip when the reading changes. The band effect, after the draw effect, moves the band to the point read and places a key's tooltip with it.

**The four callers today.**

| Chart | `view` holds | Points |
|---|---|---|
| Cost's daily chart (`CostChart.tsx`) | range, **first day**, project, source, automated filter, metric, stacking, scale | Days |
| Activity's work chart (`workTracks.ts`) | range, bucket, **first bar's day**, project, source, automated filter, measure | Days or weeks |
| Outcome trend (`OutcomeTrend.tsx`) | the Judgments view on screen, **and every week's date** | Weeks with a session |
| Errors' rate chart (`rateTracks.ts`) | range, granularity, project, source, subagent toggle, noise toggle, **first point, each fold as its first and last bucket** | Days or weeks, with a folded stretch as one point |

**The fault.** In four cases the scope is the same and the point read is still drawn, yet the bold parts change, so the reading and the zoom are dropped:

1. Older calls are ingested on an all-time range: the first point is earlier.
2. A rolling range moves on a day at midnight: the first point is the next day.
3. A backfill lands inside the range. On Cost and Activity only one that moves the first day matters. On the outcome trend any week that joins does. On Errors a call in a folded stretch opens the fold.
4. On Errors a fold appears, grows or opens for any other reason (a muted type, a day without calls at the end of the range).

On Errors a selection keeps the reading on its point so that Space clears it (the Errors design, decision 6). After such a redraw nothing is read, and Space does nothing. The hand-written chart kept its key cursor by bucket key, with a test: "keeps the current point when new data shifts the chart's points" (`git show 2acd7666:web/src/pages/errors/ErrorsPage.test.tsx`).

**Constraints.**

- `openspec validate --strict` rejects a requirement text over 500 characters.
- A test fails on anything logged to `console.error` or `console.warn` (`web/src/test-setup.ts`).
- React forbids reading or writing a ref during render. What the render compares is state (`drawing`).
- The Context page is migrated by another change, which builds on this contract. This change touches no file of it.

**What a spike measured.** ECharts 6.1.0 and zrender 6.1.0 from `web/node_modules`, the SVG renderer, in vitest 5.1.0 with jsdom 31.0.0, as the `*.real.test.tsx` tests run. A chart of 30 points `d0` to `d29` on a category axis, 800 by 300px, with `zoomSlider()`. P1 to P3 ran on ECharts alone. P4 to P8 ran a throwaway copy of `EChart.tsx` with a draft of this design (see "The draft the spike ran"). P9 ran the same draft on the fake runtime. The spike code is deleted. Each decision cites the result it rests on.

| # | Question | Result |
|---|---|---|
| P1 | 2 points join at the front (`setOption` with `replaceMerge`). What window does ECharts hold before the wrapper sends one, and does the window sent then land on the remapped indexes? | It depends on how the window was made. Made by values (a zoom key): ECharts keeps the indexes, so other days. 10–19 stays 10–19, which was `d10`–`d19` and is now `d8`–`d17`. Made by percent (a slider drag): it keeps the share. 10–19 becomes 11–20, 0–9 becomes 0–10, 20–29 becomes 21–31, 23–29 becomes 25–31. In both, a silent `dataZoom` action with `startValue` and `endValue` then lands exactly: 12–21, 2–11, 22–31 (the axis end), 25–31 (the minimum, at the end), 2–8 (the minimum, at the start). With 1 point more: 11–20. With 30 more: 40–49. |
| P2 | The same for a point that joins in the middle, and for points that leave. | A point joins at 15, window 10–19: held 10–19 (by values) or 10–20 (by percent); sent 10–20 lands on 10–20. A point joins at 5, window 16–25: sent 17–26 lands. 2 points leave at the front, window 10–19: held 10–19 or 9–18; sent 8–17 lands. Indexes past the end are clamped with the span kept: 23–29 on 27 points is held as 20–26, 20–29 on 14 points as 4–13. A window under the minimum is widened as S7 of the Errors design found: 0–5 of 29 gives 0–6, and 23–26 of 27 gives 20–26. 5–29 after the 5 first points leave is held as 0–24, every point (0% to 100%). |
| P3 | The band, and a point's pixel, through a remap. | A redraw drops the band (no band path after `setOption`), as the foundation found. Zoomed to 10–19 with the band on point 14 at 383.00px: after 2 points join at the front and before the window is sent again, point 16 (the same day) is at 531.00px. After the window 12–21 is sent it is at 383.00px, and an `updateAxisPointer` action there draws the band in the same box (left 346, width 74). Not zoomed, the same day moves from 407.67px to 431.56px, and the band is drawn there (left 420, width 23.1). |
| P4 | The draft, a key's reading of `d22` in the window `d15`–`d29`, 2 points join at the front. | The reading is on `d22` at index 24, the window is 17–31, `onZoom` is called once with `{ from: 17, to: 31 }`, the band keeps its box (left 395.33, width 49.33), the live region still holds "d22 read" and nothing is said. The next Left reads `d21`. |
| P5 | Where is the tooltip written during that redraw? | With the layout effect placing the remapped reading, the tooltip's `left` is written twice: `504.67px`, then `406px`. The first is index 24 asked of the chart before it has drawn the new points, which is `d24`, 98.7px (two bands) to the right. With that placement left to the band effect it is written once, `406px`, where it was. |
| P6 | The draft, a pointer's reading. | Not zoomed, the pointer at 400px reads `d14`, 2 points join at the front: the reading stays on `d14`, nothing is said, and the band moves to 420–443px, off the pointer. Left alone, the tooltip stays at `386px`, beside the pointer and off the band. With the rule of decision 5 it moves to `417.56px`, over the band. Zoomed to `d15`–`d29`, the pointer at 400px reads `d22`: the band and the tooltip (`386px`, `90px`) do not move, and the tooltip is written once. |
| P7 | The draft, a slider drag in progress. Mouse events on zrender's root: `mousedown` on the left handle (at 436.26px for the window 15–29), two moves to 120px left. | The steps are heard: `onZoom` 13–29, then 10–29, and the handle is at 316.26px, under the pointer. Then 2 points join at the front, the button still down: the wrapper sends 12–31 (the same days), `onZoom` is called once with it, and the handle is drawn at 339.95px, 23.7px right of the pointer. A move of 1px moves the handle 1px (338.95px): the drag goes on, from the window sent, by the pointer's movement. A move to 180px left gives 9–31. The release says "Showing d7 to d29, 23 of 32." once. Nothing is said before it. |
| P8 | The draft, windows that lose points. | (a) Window `d2`–`d8`, the minimum; `d0` leaves and `d30` comes: indexes 1–7, the same days drawn, `onZoom` once, the sentence "…7 of 30." stays, nothing said. (b) Window `d0`–`d6`, read on `d0`; `d0` leaves: the reading ends, the window is `d1`–`d7` (indexes 0–6 again, so `onZoom` is not called), and the sentence, no longer true, is dropped with nothing said. (c) Window `d15`–`d29`; the 15 days before it leave: every point shows, `onZoom(null)`, "Showing all 15." said once. (d) The same with 10 days leaving: indexes 5–19, the same days. (e) A point joins inside the window: 15–30, the same first and last day. (f) Window `d0`–`d6`; the 10 first days leave: every point shows, "Showing all 20." said once. |
| P9 | The draft on the fake runtime: can a wrapper test see P5? | Yes. After the redraw the chart's calls are `setOption`, `dataZoom 17-31`, `convertToPixel(24)`, `updateAxisPointer`, `convertToPixel(24)`. With the layout effect placing the remapped reading, a `convertToPixel(24)` comes first, before `setOption`, and answers 293.33px where the point is at 240px. A list of another length than `points`, and a list with a key twice, end the reading and the zoom. |
| P10 | What does comparing the keys cost at 400 points? | Node 26.13.1 on this machine, 400 ISO days, the mean of 20,000 runs: the same array, 0.02µs; another array with the same keys, 2.0µs; building the key-to-index map, 11.9µs. |

**Not measured.** Whether a browser paints the frame between the two writes of P5 (jsdom paints nothing; the write order is the fact). A drag with a real pointer, and with touch. The pointer at rest in a real browser. Each is a browser line of step 3.1. A browser spike was not needed: P7 saw the drag in vitest. Step 3.1 then measured all three, in Chromium's headless shell on the demo store (decision 11): no frame noted with the tooltip off its bar, 0.0px at worst over 109 frames, the per-frame reader proven by a correction held back on purpose, which it saw at 158px; a real drag, the handle 28.9px off the pointer after the backfill, then following the pointer; a pointer at rest, the tooltip over the band, 0.3px at worst. Mouse events only: touch is still not measured.

## Goals / Non-Goals

**Goals:**

- A reading and a zoom stay on the same points when newer data of the same view moves them.
- One rule, in the wrapper, that the four charts use the same way and Context can build on.
- Nothing said for it, by the rules the live region already has.

**Non-Goals:**

- Any change to the Context page, or to a chart not yet on the shared component.
- Keeping a reading or a zoom across a change of view. A range, a filter, a measure and the granularity still reset both.
- Keeping a reading on a point that is gone, by moving it to a neighbour.
- A zoom stored in the URL, or kept by date across views.
- A change to the zoom's keys, its words, its minimum or the slider.
- The reserved wrapper props no chart needs yet: `locate`, `onMiss`, `keys.shiftStep`, `keys.start`.

## Visible differences

What a user will see or meet that differs from today. Each line names the decision that explains it.

1. On Cost, Activity and Errors, the reading and the zoom stay when older data arrives, when a rolling range moves on a day, and when a backfill lands. Today both are dropped (decisions 2 and 6).
2. On Errors, they stay too when a folded stretch appears, grows or opens, unless the point read is itself folded away. Space still clears the selection after it (decision 6).
3. On the outcome trend, the reading stays when a week joins or leaves the trend, and when a new newest week comes (decision 6).
4. "Show all days" stays, with a focus on it, through such a redraw. Today the zoom resets and the focus moves to the chart (decision 2).
5. A zoom at the old end of a rolling range loses the day that leaves. At the fewest days a zoom shows, it takes the next day in, so seven still show (decision 2, P8b).
6. A zoom that such a redraw leaves with none of its points, or with every point in it, ends, and the chart says "Showing all 15 days." once. Today a first point that moves says nothing (decisions 2 and 4). The slider stays over every point while the view has 14 points or more. On Errors a new fold can leave fewer: then the caller turns `zoom` off, the slider goes, and the end is said once all the same (decision 7).
7. After a redraw that moves the point read from under a pointer at rest, the tooltip sits over that point, with the band. Today it stays beside the pointer. This holds for every redraw, also a resize and a new point at the end (decision 5).
8. A slider handle being dragged when such a redraw lands jumps to its window's new place, off the pointer by as much as the points moved, and the drag goes on from there (decision 5, P7).

Not different: the zoom's keys, words and minimum; what a view change does; what a selection does; every tooltip, reading and label; the data tables; the URL.

## Decisions

### 1. The prop

```ts
/** Each point's key, in order: one per point, each once. A day, a week's first day, a session's id. With keys a
 *  point is its key, not its index. When a redraw of the same view brings other keys, the reading and the zoom stay
 *  on the keys they were on. A point read that is still drawn is read at its new index. The points shown run from the
 *  first to the last of the points shown before that are still drawn, and are never fewer than a zoom shows
 *  (MIN_SHOWN). A reading on a key that is gone ends. A zoom with none of its points left, or with every point in it,
 *  ends, and that is said once, as when any zoom ends with no one asking. Nothing else is said.
 *  With keys, `view` holds only what the user chose: not the first point, nor anything else that fixes where a point
 *  sits. It still holds what gives a key another meaning: a day and a week can share one.
 *  A list the wrapper cannot go by (another length than `points`, or a key twice) keeps nothing through a redraw that
 *  changes the keys: the reading ends and every point shows, and the console names the fault. It names it too at
 *  mount, with a new view, and when `points` changes under the same keys. */
pointKeys?: readonly string[];
```

The comments on three other props change with it, and nothing else of `EChartProps`:

- `view`: its second paragraph becomes "Within a view a point keeps its index, and new points come at the end, unless the chart gives `pointKeys`. Without keys, the key must also hold what fixes the first point (a rolling range's first day): when that moves, it is another view."
- `points`: gains "With `pointKeys`, the two lists have one length."
- `onZoom`: its first sentence gains ", or a redraw that moved the points shown to other indexes". Its second sentence becomes "A redraw of the same view that keeps the points shown at their indexes is not a change." As built it gains one more: "Turn `zoom` off in the render whose option draws no slider: with it on, a redraw that moves the points shown and drops the slider tells of the moved window, then of null, since the wrapper learns that the slider is gone only from the drawing." (decision 7).

Each choice, with its reason:

- **The name.** `pointKeys`, as the Errors design named it. It pairs with `points`, and says what the list holds.
- **The type.** `readonly string[]`. Every key the charts have is a string: a day, a week's Monday, a bucket key, and later a session or request id. Keys are compared with `===`. A chart with numbers maps them to strings.
- **A separate prop, not `points: number | readonly string[]`.** One prop would make a wrong length impossible. But `points` is read as a number in about twenty places of the wrapper and by every caller, and a prop named for a count that holds keys reads wrong. The length is checked instead.
- **The lengths must agree, and each key comes once.** Each caller makes both from one list (`pts.length`, `pts.map(p => p.k)`), so a fault is a bug in the caller, or a duplicate in the data.
- **A list the wrapper cannot go by keeps nothing.** With such a list the wrapper cannot say which point a key names. Guessing would read another day, which is the fault this change removes. So a redraw whose keys differ, to or from such a list, ends the reading and shows every point: what a new view did before this change, minus the emptied region (decision 4). The same holds when the keys appear or go in the same view (`undefined` on one side).
- **The console names the fault**, with `console.error`, naming the chart's label and the fault. As built it is sent from an effect, once per change that meets it: at mount, with a new view, with other keys, and when `points` changes under the same keys. A fault met where nothing is kept through it (the mount, a new view, another count) says that the next change of keys will end the reading and the zoom; one met by a change of keys says that they end. Under StrictMode's second run of the mount's effects it is still sent once. A test then fails by the rule of `test-setup.ts`, so a caller's fault cannot pass its page test. It is not thrown: a duplicate that comes from the data would take the page down for a chart that can still be read.
- **Compared by identity, then by content.** The wrapper keeps the last list in its `drawing` state, with the count it was checked against and its fault (why the wrapper cannot go by it, or null), and the faults the last check met, for the console. Another array with the same keys is the same points, and the kept list is not replaced, so a caller that makes a new array each render costs one comparison and no extra render. P10: 0.02µs for the same array, 2.0µs for an equal one, at 400 points. The map is built only when the keys differ: 11.9µs.
- **In state, not in a ref.** The render compares it, as it compares `view`, `zoom` and `status`.

Alternative: a count, "n points joined at the front". Rejected: a fold that opens, and a week that joins the trend, move only the points after them.

Alternative: the wrapper reads the keys from the option's first x axis. Rejected: the axis holds what the chart wants drawn there, the option is a function of the environment, and the wrapper would run it in the render.

### 2. The remap rule

Two pure functions in `EChart.tsx`, not exported. `at` maps this drawing's keys to their indexes; `was` is the last drawing's list.

- **The reading.** Its key is `was[reading.i]`. Its new index is `at.get(key)`. With none, the reading ends.
- **The window.** From the first to the last point of the old window whose key is still drawn: walk up from `from` and down from `to`. Then:
  1. With none left, every point shows.
  2. With the first after the last (the keys changed their order), every point shows.
  3. With fewer than `MIN_SHOWN` points, it is widened to `MIN_SHOWN` as the slider widens it: the start is kept, unless the end would then pass the last point; then the window ends on the last point (P2, and S7 of the Errors design).
  4. When it then covers every point, every point shows.

Why each part:

- **Keys, not a shift.** See decision 1.
- **The points still drawn, not "an end that is gone shows every point".** The brief for this change proposed the second. A rolling range drops its first day each midnight. A zoom on the oldest days of that range would then reset each midnight, which is one of the four cases this change is for. With the first rule the window loses that one day (P8a, P8b). The cost is two short loops.
- **The wrapper widens, not ECharts.** Sent a window of six points, ECharts widens it by the same rule (P2), and `keep()` would read it back. But the render in between would hold the narrow window: `onZoom` would be called twice, once with a window no user can make. Widened in the remap, the window sent is the window held, and `keep()` finds nothing to correct. `zoomAround()` already knows `MIN_SHOWN` for the same reason.
- **A window of the same indexes over other points is the same window to the wrapper.** In P8b the window `d0`–`d6` becomes `d1`–`d7`: indexes 0 to 6 both times. `setZoomed` and `onZoom` see no change, and `keep()` sends the chart a window only if the chart holds another.
- **Inside the window, nothing is kept by key.** A point that joins between the first and the last key is shown (P8e): the window is a stretch of time, not a list of points.
- **A reading outside the remapped window cannot happen.** A key's reading moves the window to include its point, and the slider ends a reading it leaves out, so the point read is inside the old window. If it is still drawn, it lies between the first and the last point still drawn. If the wrapper ever holds a reading outside its window (a pointer's reading over a window ECharts clamped), the remap keeps both as they are: it adds no new rule for it.

### 3. Where the branch runs

Second in the chain, right after a new view:

```
drawing.view !== shows          a new view: everything is cleared, and the new keys are kept
keys differ from drawing.keys   the remap (this change)
the same keys, another count    the list is checked again, for the console (this change, as built)
drawing.zoom !== zoom           the zoom prop
reading.i >= points             a reading past the last point
a key's reading, other words    said again, alone
a zoom sentence, no longer true dropped
drawing.status !== status       the status, said alone
```

- **After the view.** A new view is another chart: nothing is carried over, and the branch keeps the new list so that the next render compares against it.
- **Before every other branch.** Each of them reads a point by index, or counts the points: `reading.i >= points`, `read(reading.i)`, `readZoom(shown)`. Run first, they would ask the caller for another point's words (`read(22)` is `d20` once two days joined), say them, and end a reading that the remap would have kept (a reading on index 29 of 30 when one point leaves at the front).
- **The same keys, another count.** Built after the plan, for the console only: a list of the right length can become one of the wrong length when `points` changes and the caller's keys do not. Nothing moves; the list is checked again, so the console names the fault and the next change of keys goes by the answer.
- **One branch a render, as now.** The remap sets state and React renders again. The later branches then see true indexes and do what they do today (decision 4).
- **The render that runs the remap is thrown away.** React renders again before it commits, so the tooltip is never rendered for a stale index.
- **It needs no chart.** Before the runtime has loaded, the reading is remapped the same way, and no zoom exists.

### 4. What the live region says

The remap itself says nothing. The existing rules say the rest, each in its own later render:

| Case | Said | By |
|---|---|---|
| A key's reading, moved to its new index, same words | Nothing | No branch matches |
| A key's reading whose words the newer data changed | The reading again, alone, unless the zoom ends too (below) | The words branch, the render after |
| A pointer's reading, moved or not, words changed or not | Nothing; the tooltip shows the newer figures | The words branch reads only a key's reading |
| A reading whose key is gone | Nothing. Its own sentence is dropped, with a zoom sentence said after it; a status or a zoom sentence that took the region since stays | The remap, as the branch for a reading past the last point does |
| A zoom sentence the region holds, no longer true (other days, another count) | Nothing: the sentence is dropped | The zoom-sentence branch, the render after |
| A zoom sentence that is still true (P8a) | Nothing: it stays | No branch matches |
| The zoom ended: none of its points left, every point in it, or a list the wrapper cannot go by | `readZoom(null)`, once; after a key's reading whose words the same redraw changed, both at once, the reading first | The remap, as the `zoom` branch does |
| A new `status` in the same render as any line above | The status, alone | The status branch, last, as now |

- **Why the zoom's end is said.** It is the wrapper's standing rule: "a zoom that ends with no one asking is said once, so no one goes on believing the chart shows fewer days" (the foundation, decision 5). A view change says nothing because the user made it; this one they did not make.
- **Why here and not in `keep()`.** `keep()` says the end when the chart drops the window. Here the render already knows, and saying it there keeps the status rule in one place: the status branch runs after it and takes the region alone.
- **A reading that ends leaves the region as today's "point gone" branch leaves it**, so one rule covers both.
- **On Errors, a backfill while zoomed empties the region.** After plus the region holds "Showing Oct 11 to Oct 25, 15 of 30 days."; once older calls bring six points to the front, it names the wrong count, so the zoom-sentence branch drops it and nothing new is said (the Errors zoom test in `ErrorsPage.test.tsx`). The same holds on every chart whose zoom sentence names the count.

### 5. The tooltip, the band, the pointer and a drag

**A key's tooltip is placed after the drawing, never before it.** The layout effect that places the tooltip runs when the reading changes, before the draw effect. For a remapped reading it would ask the chart, which still draws the old points, where the new index is: another point (P5: 98.7px to the right, then back). So the layout effect skips a reading the remap moved, and the band effect, which runs after the draw and after `keep()`, places it. Until then the tooltip stays over the old drawing's point, which is what the screen still shows. The test is the order of the chart's calls (P9).

As built there is no `moved` mark (the draft's). A ref, `drawnKeys`, holds the keys the chart was last drawn with, set by the draw effect. The layout effect skips placing a reading while `drawing.keys` is not `drawnKeys`: the keys changed since the chart last drew. It skips it also when the index stays, since the old drawing has another number of bands, so the chart would answer for another pixel. Before the chart exists it places as ever, at the point's share of the box. `drawing.keys` is among the draw effect's dependencies, so new keys are drawn, once, with their option. Newer data under the same keys, or with none, keeps each point at its index, and its reading is placed in the layout effect, before the paint, as before this change.

**The band.** No new rule. The band effect runs after each drawing and each zoom, and moves the band to `drawnAt(chart, at)`. After the remap `at` is the new index, the draw effect has drawn, and `keep()` has sent the window (P3: the same pixel when the window keeps its points; the point's new place when not zoomed).

**A pointer's tooltip follows the point when the point leaves the pointer.** A pointer's reading is placed beside the pointer (`pointer.current`). Not zoomed, a redraw can move the point read from under a pointer at rest (P6: 24px for two days of thirty; a backfill of a hundred days moves it across the plot). The band then sits on the point and the tooltip, naming that point, beside a pointer that rests on another. So, in the band effect, before the tooltip is placed: when `convertFromPixel(X_AXIS, pointer.current.x)` is not the point read, the pointer's place is forgotten, and the tooltip goes over the point, as a key's does. The next pointer move reads the point under it, as ever.

- Zoomed with a window that keeps its points, nothing moves (P6).
- The rule is in the band effect, so it holds for every redraw and zoom: also a resize, and a new point at the end that squeezes the others. Today those leave the tooltip beside the pointer and off the band by a little.
- The foundation states the aim for a key: "the two never sit over different days". This gives a pointer's reading the same.

Alternative: end the pointer's reading. Rejected: the point is still drawn, and the tooltip would close with no one asking.

Alternative: read the point now under the pointer. Rejected: it would say a sentence with no one asking.

**A slider drag in progress.** Nothing changes in the wrapper.

- ECharts keeps the drag: zrender goes on sending the pointer's movement to the slider, which applies it to the window it last drew (P7). The window the wrapper sends becomes that window. So the handle jumps off the pointer by as much as the points moved (23.7px in P7), then follows the pointer's movement.
- `pressed` and `unsaid` are untouched: the view is the same, so the release still says the points shown, read from the chart then (P7: once, in the new drawing's words).
- A drag step after the remap reports true indexes: `onSlide` reads the chart.

Alternative: end the drag. Rejected: ECharts has no action for it, and the user's hand is still down.

### 6. `view` and the keys of the four callers

`view` is what the user chose. It still holds the granularity: a day and a week can have the same key (`2026-11-02` is a Monday), so without it a switch from Day to Week would move a reading on Nov 2 to the week of Nov 2, and put a zoom on other points.

| Chart | `view` afterwards | `pointKeys` |
|---|---|---|
| Cost's daily chart | range, project, source, automated filter, metric, stacking, scale | Each day: `pts.map(p => p.day)` |
| Activity's work chart | range, bucket (day or week), project, source, automated filter, measure | Each bar's day: `buckets.map(b => b.day)` |
| Outcome trend | the Judgments view on screen (the prop it gets) | Each week: `weeks.map(w => w.week)` |
| Errors' rate chart | range, granularity, project, source, subagent toggle, noise toggle | Each point's first bucket: `chartData()`'s `keys` |

- Each list is made where the points are made (the model, or a `useMemo` on them), so it keeps its identity while the points do.
- **The outcome trend is included.** It has no zoom. Its reading ends today when a week joins or leaves, and once a week when a new newest week comes. The same prop removes the list of weeks from its key, and the four charts then follow one rule.
- **Errors: a folded stretch's key is its first bucket**, the `k` it already has, as a day's is.

| What happens to a fold | The reading | A window that starts or ends on it |
|---|---|---|
| It grows at its end (days without calls at the end of the range) | Stays on it; a key's reading is said again, since its words name the last day | Stays |
| It opens (a call lands inside it) | Goes to its first day, now a point of its own; a key's reading is said again | Starts on that day; a window that ended on the fold now ends on that day |
| Its first day gets a call | Stays on that day; the fold starts a day later, as another point | The same |
| A day read is folded away (a run of days without calls reaches eight, and the day is not its first) | Ends: the point is gone | Loses that end, and keeps the points still drawn |

- Why the first bucket, and not a key of its own for a fold: a fold is a stretch of time that starts on a day. With its own key, a fold that opens would end the reading and cut a window that started on it, which is the fault again.
- **Space after a backfill.** The selection is `v.at`, a bucket key, and the model finds its index in each drawing. With the reading kept on that point, Space activates it, and `activate` clears the selection. The `status` is derived from the selection's key, as now.

### 7. `onZoom`

A remapped window is a change the caller hears of: `onZoom({ from: 17, to: 31 })` after `{ from: 15, to: 29 }` (P4).

- `Shown` is indexes. A caller that keeps what it was told would hold indexes of other points.
- It costs nothing today: the one caller, `useZoomReset()`, reads only whether the window is null, and `setZoomed(true)` again renders nothing.
- A window whose indexes stay over other points (P8b) is not reported. The indexes a caller holds are still the window.
- The effect that calls it compares by value, as now. No code changes there; the comment on the prop does (decision 1).
- **A redraw that moves the window and drops the slider**, with `zoom` still on: the remap moves the window, the caller hears it, then the draw effect finds no slider and the caller hears null. The wrapper learns that the slider is gone only from the drawing. So the callers turn `zoom` off in the render whose option draws no slider (each passes `zoom` from its own count of points), and the `onZoom` comment says so (decision 1). Then the `zoom` branch ends the zoom in the same render chain, and the caller hears null once.

### 8. What a caller draws by index

A caller owns its marks. Each one is worked out from the data of the drawing it is in, and none is kept from a render before:

| Chart | Mark or handler | Where its index comes from |
|---|---|---|
| Errors | The selection's frame | `rateModel`: the index of the point whose key is `v.at` |
| Errors | Fix markers, no-activity bands | `rateModel`: found in the points of this drawing |
| Errors | `status` | The selection's bucket key (`status.of`), never an index |
| Activity | The selection's frame | `workModel`: `buckets.findIndex` on the selected day |
| Activity | `status` | `pickKey`, the selected day |
| Cost | The peak's label, today's hatch, the 7-day average | `costDaily`: worked out per model |
| All four | `tip(i)`, `read(i)`, `onActivate(i)` | Called with an index of the drawing on screen |
| `useZoomReset()` | The button | Whether the window is null |

So no caller changes for its marks. Step 2.1 to 2.3 each confirm it for their chart.

### 9. The fake runtime and the real tests

The lesson of the earlier changes: the fake draws nothing and has hidden real faults. So each thing this change relies on in ECharts was measured first, and has a test on real ECharts and a line in the browser check.

| Reliance | Measured | Fake runtime | Real ECharts in jsdom | Browser |
|---|---|---|---|---|
| A window sent by values after the points changed lands on those indexes, at the ends and at the minimum too | P1, P2 | Already so (`moveWindow`) | `EChart.real.test.tsx`: the first and last day labels drawn | Step 3.1: the days drawn |
| What ECharts holds before the wrapper sends the window: other points, by values or by percent | P1, P2 | Holds the indexes, as ECharts does by values. The percent mode is **not modelled** | The test runs a window made by a key and one made by a drag | Step 3.1: after a drag |
| The band is drawn at the point's new place, after the drawing and the window | P3 | Already so: `band` is the point under the action's pixel, worked out when the action is sent | The band's box before and after | Step 3.1: the band over the bar |
| Asked before the new drawing, the chart answers for the old points | P3, P5 | Already so: `convertToPixel` reads the option the chart holds (P9) | The tooltip's `left`, each write | Step 3.1: the tooltip, each frame |
| A drag in progress goes on from the window sent | P7 | **Not modelled**: the fake has no drag, `zoomTo()` sets a window | Mouse events on zrender's root, as P7 | Step 3.1: a real drag |
| A window under the minimum is widened | P2, S7 | Already so (the Errors design, decision 9) | The seven days drawn in P8b's case | — |

- **The fake gains no behavior.** Every wrapper test of the remap passes or fails on it for the right reason: the fake holds a window by index, so a wrapper that sends no window after a remap shows other points and the test fails.
- **Why the percent mode is not added.** The wrapper sends the window whenever the chart's differs from its own, whichever way the chart came to hold it. No line of the wrapper depends on the mode. The real test covers both.
- **The header comment of `testing.ts` gains two lines** under "It is simpler than ECharts in what it does not model": what the chart holds between a `setOption` that changes the points and the next `dataZoom` action when a drag made the window (ECharts keeps the share: 10–19 of 30 is 11–20 of 32), and a slider drag in progress through a `setOption`.

**`web/src/components/echart/EChart.real.test.tsx`** (new; the first real test of the wrapper alone). It unmocks `./load`, draws a 30-day chart with `categoryAxis()` and `zoomSlider()`, and checks, with `realTesting.ts`'s readers:

1. A key's reading in a window a key made; 2 days join at the front: the first and last day labels drawn are the same, the band's box is the same, the tooltip's `left` is written once and to the same place, the live region does not change.
2. The same with a window a drag made (mouse events on the handle).
3. Not zoomed, a pointer's reading; 2 days join: the band is on the same day at its new place, and the tooltip is over it.
4. A drag in progress; 2 days join: the next move moves the handle by the pointer's movement, and the release says the points shown once.
5. The window `d0`–`d6`; `d0` leaves: seven days are drawn, `d1` to `d7`.

### 10. Tests

| Layer | What it proves |
|---|---|
| `EChart.test.tsx` | The remap rule, once: the cases below |
| `EChart.real.test.tsx` | Decision 9's five checks |
| `CostChart.test.tsx` | Wiring: the two tests that expect a reset now expect the days kept |
| `workTracks.test.ts`, `WorkChart.test.tsx` | The key no longer holds the first bar; one wiring assertion |
| `Judgments.test.tsx` | The test that ends the reading when a week joins now keeps it |
| `rateTracks.test.ts`, `ErrorsPage.test.tsx` | The key no longer holds the first point or a fold; a backfill keeps the reading and the zoom, and Space clears the selection |
| `tools/demo/chartfit/` | A real browser: step 3.1 |

**The wrapper's cases**, in the `EChart zoom` block, on its `viewed()` fixture with a list of days. Where an existing test already builds the state, the assertion joins it (`AGENTS.md`, "Tests"):

- Points join at the front, with a window and a key's reading: the reading's index, the tooltip's content, the band, the window, `onZoom` once with the new indexes, nothing said, and the next Left reads the day before. The chart's first call after the redraw is `setOption` (P9).
- A point joins in the middle, before the point read; a point leaves at the front.
- The point read leaves: the reading ends, the tooltip closes, `read` is never asked for it; a status the region holds stays.
- The window loses its first point (the same count), loses points down to under the minimum (widened, the start kept, and at the axis end), loses every point, and ends up holding every point: the two last say `readZoom(null)` once, and a status that arrives in that render is said alone.
- A key's reading whose words changed is said again, alone, with the new index's words; a pointer's is not.
- A zoom sentence the remap makes untrue is dropped; one still true stays.
- A list of another length, a key twice, and keys that appear in the same view: the reading ends, every point shows, and `console.error` is called (the test mocks it).
- Another array with the same keys changes nothing and draws nothing more.
- A new view with other keys clears as a new view does, and the keys compared next are the new view's.
- Before the runtime has loaded: a reading is remapped.
- A drag under a remap: `mousedown`, a step, the redraw, a step, the release: the points shown are said once.
- A pointer's tooltip: beside the pointer while its point is under it; over the point after a redraw moves the point away.

**What happens to existing tests.**

| Test today | Fate |
|---|---|
| `EChart.test.tsx`, "keeps the window and the cursor on their points when the view gains a point at its end" | Kept unchanged: a chart without keys |
| `EChart.test.tsx`, "ends a reading whose point is gone, shows every point when the window no longer fits…" | Kept unchanged: a chart without keys |
| `EChart.test.tsx`, "leaves the pointer's tooltip beside the pointer after a redraw" | Kept; gains the redraw that moves the point away |
| `CostChart.test.tsx`, "shows every day again when a rolling range moves on a day, and moves the focus…" | Rewritten: the days shown stay, and the focus stays on "Show all days". The focus move stays tested by "…when the view falls under 14 days and loses its slider" |
| `CostChart.test.tsx`, "shows every day again when an all-time view gains an earlier first day…" | Rewritten: the same days stay shown |
| `workTracks.test.ts`, "keeps the view through a new last bar or a selection, not through another measure, bucket or first bar" | The first bar moves to the kept side; the model's keys are asserted with it |
| `Judgments.test.tsx`, "keeps the week read when newer figures of the same weeks arrive, and ends it when a week joins" | Its last part is turned around: the week stays read |
| `rateTracks.test.ts`, "keeps the view through the type, the selection, the fixes and a new last point, not through what moves the points" | An earlier first point and a fold that opens move to the kept side; the keys are asserted with it |
| `ErrorsPage.test.tsx`, "keeps the point read, with its tooltip, through newer data of the same view" | Gains the backfill, the zoom and Space |

**The 400-line advisory.** Estimate, net: `EChart.test.tsx` 120 to 150, `EChart.real.test.tsx` 90 to 100, `ErrorsPage.test.tsx` and `rateTracks.test.ts` 25, `WorkChart.test.tsx` and `workTracks.test.ts` 12, `CostChart.test.tsx` 5, `Judgments.test.tsx` 3. In all 250 to 300, under the advisory 400. Not counted: the browser check, which runs locally and not in CI.

As built (`git diff --numstat main HEAD -- '*.test.ts' '*.test.tsx'`), added and removed:

| File | Added | Removed | Net |
|---|---|---|---|
| `EChart.test.tsx` | 222 | 1 | 221 |
| `EChart.real.test.tsx` | 148 | 0 | 148 |
| `ErrorsPage.test.tsx` | 42 | 13 | 29 |
| `CostChart.test.tsx` | 9 | 15 | −6 |
| `rateTracks.test.ts` | 7 | 4 | 3 |
| `WorkChart.test.tsx` | 6 | 1 | 5 |
| `Judgments.test.tsx` | 6 | 5 | 1 |
| `workTracks.test.ts` | 4 | 3 | 1 |
| In all | 444 | 42 | 402 |

Two over the advisory. The real test is 148 lines, not 90 to 100: driving a drag on real ECharts needs its own mouse events and a handle reader, and each write of the tooltip's `left` is read as it is made. `EChart.test.tsx` is 70 lines over its estimate: the cases of decision 2's window rule are one table of seven rows, and the console's cases cover the mount, a new view and another count, which the plan did not have. No test line was cut to offset them: every one carries a rule no other test checks.

**Tests that changed otherwise than the table above says.**

- `EChart.test.tsx`, the pointer test is renamed "leaves the pointer's tooltip beside the pointer after a redraw, and puts it over the point once one moves the point away". The new cases are "keeps a key's reading and the window on their days when days join at the front, and says nothing", whose tooltip places are read at each commit through a React `Profiler` (what the next paint shows), "moves the reading and the window by a day that joins before them, and by a day that leaves", "ends a reading whose day leaves, without asking for its words, and leaves a status the region holds", the table "puts the window on its days still drawn when it …", "says a status alone when it arrives in the render whose keys end the zoom", "names a list it cannot go by at mount, with a new view, and when the points change under it, once each", "takes another list with the same keys for the same days, and renders and draws nothing more", "clears on a new view, which may bring keys where the last had none, and compares the keys after it with its own", "moves a reading by its key before the runtime has loaded", "says the days a drag shows once, on release, when days join under it" and "says a key's reading again, in its new index's words, when they changed, and leaves a pointer's unsaid".
- `CostChart.test.tsx`, the rolling-range test lost its second half (with the focus elsewhere, the zoom resets and the focus stays there): the zoom no longer resets, so there is nothing to see there. It is "keeps the days shown, and the focus on 'Show all days', when a rolling range moves on a day"; the all-time one is "keeps the zoom on its days when an all-time view gains an earlier first day, as after an ingest of older transcripts".
- `Judgments.test.tsx` now joins an older week, before the week read. A newer week at the end keeps the reading's index, so it passes without keys too. The test is "keeps the week read when newer figures of the same weeks arrive, and when a week joins".
- `ErrorsPage.test.tsx`, the zoom test is rewritten at range 90, where the chart starts on the first call, so older calls add points at its front; a 30-day range never does. It is renamed "keeps the zoom and the point read through a selection, older calls and a type, clears with Space after them, and ends both at Week". The fold that opens joined "can't select a folded stretch without calls, says so in other words the second time, and reads its first day when it opens".

**Spec scenarios with no test at any layer but the browser, or none at all.**

- `errors-dashboard`, "The day read is folded away": no test. It is the wrapper's rule for a key that is gone (`EChart.test.tsx`, "ends a reading whose day leaves, …"), and a fold's key is its first bucket (`rateTracks.test.ts`). A page test would build eight days without calls at the end of the range only to replay that rule.
- `errors-dashboard`, "A fold leaves fewer than 14 points": no test on Errors. It is the wrapper's `zoom` branch (`EChart.test.tsx`, "shows every point again when zoom turns off, …"; Cost's "moves the focus from 'Show all days' to the chart when the view falls under 14 days and loses its slider"), with Errors' `zoom` from its count of points (`rateTracks.ts`).
- `cost-dashboard`, "Older days arrive while reading"; `usage-dashboard`, "The range moves on a day"; `insights-dashboard`, "A new newest week": a browser line of `tools/demo/chartfit/` only (decision 11). The page tests hold the same wiring through another scenario of the same chart.

### 11. The browser check

One shared check in `tools/demo/chartfit/checks.mjs`, `backfill`, which each page's module runs with its own payload. A page's descriptor gains `fewer(payload, n)`: the payload without its first `n` points. The check opens the page on `fewer`, then answers the next request with the whole payload (`newerOn`), so the points join at the front.

Its lines, for each of Cost, Activity and Errors:

- A key's reading and a zoom a key made, then the backfill: the band is over the same bar, the tooltip names the same point and sits beside the band, the first and last labels drawn are the same days, "Show all" is still shown, and the live region says nothing.
- The tooltip's left edge, read on each animation frame through the redraw, is never more than half a band from the band's.

For the outcome trend: a week joins before the week read; the band and the tooltip are on the same week, and nothing is said.

Once, on Cost, since the rule is the wrapper's:

- A window a drag made, then the backfill: the same days.
- A real drag with the button down through the backfill: the next move changes the days drawn, and the release says the points shown once.
- A pointer at rest, not zoomed, then the backfill: the tooltip is over the band.

On Errors, as its own checks:

- A bucket selected with Space, then the backfill, then Space: the selection is cleared, the URL loses `at`, and the chart says "Selection cleared: …" once.
- A fold that opens under a key's reading: the reading is on the fold's first day.

Each new line is first shown to fail: the builder runs it with the page's `pointKeys` taken out, pastes the failing line, and puts the prop back. The runner's header comment names the check.

**As built: 15 lines**, every one ok in a run of 444 lines on the combined tree.

- `backfill`, on each of the four charts, prints two lines. The first: the points that joined are drawn (every column, or with a zoom the slider's handles move, since the same days are a smaller share), the band is over the point's bar, the tooltip names it beside the band, and nothing is said; with a zoom, the first and the last label drawn stay and "Show all" stays. The second: on each animation frame the tooltip names the point and points within half a band of the band's centre; with a zoom the band does not move, and without one it is on the point's column, counting the points not yet drawn. The outcome trend runs it by one older week.
- Activity: a rolling range that moves on a day, zoomed by plus (the first bar leaves, today's comes): the bars shown keep their days, the band its bar, "Show all days" stays, and nothing is said.
- Judgments: a new newest week while a week is read: the band, the tooltip and the readout stay on it, at its new place, on every frame, and nothing is said. It fails only with the trend's old `view` key, which held every week, and not without `pointKeys`: a week at the end leaves the indexes of the weeks before it alone.
- Cost: a window a drag made, then the backfill: the same days are drawn. A real drag with the button down through the backfill: the days drawn stay, the next move changes them and moves the handle by the pointer's movement, and the release says the days shown once (the handle 28.9px off the pointer after the backfill, then it follows). A pointer at rest, not zoomed: the band moves to the day's new place, off the pointer, and the tooltip names it over the band, on every frame (0.3px at worst).
- Errors: a day selected with Space, then the backfill, then Space: the selection is cleared, the URL loses `at`, and "Selection cleared: …" is said once. A fold that opens under a key's reading: the reading is on the fold's first day, now a day of its own.
- Cost's `fewer` moves the view's `start` on a range of 30 days, which the server never sends: a rolling range moves its 30 days on together. It is the way an all-time view's first day moves when older transcripts are ingested, and to the chart the two are one case, since its `view` leaves out the first day.

The per-frame reader runs first in each animation frame: zrender stops its own loop after 10 still frames, and the redraw or the band's action starts it again after the reader has asked for its next frame. So a note holds the tooltip as that frame paints it, and the band and the bars as the frame before painted them: in the notes the band reaches its new place one frame late. Through every backfill no frame was noted with the tooltip off its bar (0.0px at worst over 61 to 109 frames). The reader was proven with a correction held back on purpose, which it saw at 158px, and the column rule by reading the wrong column by hand, which failed both lines of the outcome trend ("the band on column 3 of 4, column 4 of 5, not week 4's"). Each read of what is said waits first for the band and the tooltip to be on the point, then 400ms, so a late sentence under load is not missed.

### 12. Docs

Short bullets in `CHANGELOG.md`, `[Unreleased]`, under Changed:

- In the existing "Errors:" list: "The rate chart keeps the point you are reading and the zoom when older data arrives or a folded stretch changes, so Space still clears the selection."
- A new bullet for the other three: "Cost's daily chart and Activity's work chart keep the day you are reading and the zoom when older days arrive or a rolling range moves on a day. The outcome trend keeps the week you are reading when a week joins it."

The sentences that become untrue, each rewritten with the `doc-coauthoring` skill:

| File | Sentence today |
|---|---|
| `site/src/content/docs/pages/cost.mdx`, "Zoom" | "It also resets when the view's first day moves: a range moves on a day at midnight, or older days arrive. If the focus was on **Show all days**, it moves to the chart." |
| `site/src/content/docs/pages/activity.mdx`, "Zoom" | "The zoom resets when the view changes: the measure, the range, project, source or Include automated sessions, or the first bar moves." |
| `site/src/content/docs/pages/errors.mdx`, "When the zoom resets" | "…or when the first point moves or a folded stretch appears, grows or opens." |
| `web/src/pages/errors/PARITY.md`, "Rate chart" | "Changed since (echart-errors): the reading ends, and the zoom resets, when the view's first point or a fold moves." |

`README.md` has no sentence on this. No image changes: nothing is drawn differently at rest.

As written:

| File | Sentences now |
|---|---|
| `cost.mdx`, "Zoom" | "The zoom stays on its days when the view's first day moves, because a range moves on a day at midnight or older days arrive; the day you are reading stays read, and the focus stays on **Show all days**. A zoom at the old end of a range loses the day that leaves. A zoom that has no day left, or now holds every day, ends, and the chart says "Showing all 30 days." once, with the count of the view." |
| `activity.mdx`, "Zoom" | "The zoom resets when the view changes: the measure, the range, project, source or Include automated sessions. … It stays too when older bars arrive or the range moves on a day: the bars shown keep their days, and the bar you are reading stays read. A zoom at the old end of a range loses the bar that leaves; at 7 bars, the fewest a zoom shows, it takes in the next one." |
| `errors.mdx`, "When the zoom resets" | "It resets when the view changes: the range, Day / Week, the project, the source, **Include subagents** or **Hide noise and muted**. … It stays too when the first point moves or a folded stretch appears, grows or opens, and so does the point you are reading, unless a fold hides that point; Space then still clears the selection. The zoom ends when a new fold folds away every point it shows: the chart says "Showing all 30 days." once, with the count of the view, and the slider stays, over every point. It ends the same way when a new fold leaves fewer than 14 points, and the slider goes." |
| `insights.mdx`, "Figures" | Its last sentence, which this decision said was not there, said the reading stays "when new data arrives for the same weeks". It is widened: "When new data arrives, the week you are reading stays read while the chart still shows it, also when other weeks join or leave the trend or a newer week comes." |
| `PARITY.md`, "Rate chart" | The entry keeps its text and gains "Changed since (echart-point-keys): …" with the rule and its port (`rateTracks.ts` `keys`, `EChart` `pointKeys`). |

## The draft the spike ran

Not the final code: the builder writes it, with its comments. It is here because P4 to P9 measured this, and no other form. What was built differs in three places, each checked again by the tests and the real test: no `moved` mark, but the ref `drawnKeys` (decision 5); `indexed()`, which says why a list cannot be gone by, in place of `indexOf()`; and the last list's fault kept in `drawing`, with a branch for another count under the same keys (decisions 1 and 3).

```ts
const differ = (a?: readonly string[], b?: readonly string[]) =>
  a !== b && (!a || !b || a.length !== b.length || a.some((k, i) => k !== b[i]));
/** Each key's index, or null for a list the wrapper cannot go by. */
function indexOf(keys: readonly string[] | undefined, n: number) {
  if (!keys || keys.length !== n) return null;
  const at = new Map(keys.map((k, i) => [k, i]));
  return at.size === n ? at : null;
}
function windowOn(w: Shown, was: readonly string[], at: Map<string, number>, n: number): Shown | null {
  let a = w.from, b = w.to;
  while (a <= b && !at.has(was[a]!)) a++;
  while (b >= a && !at.has(was[b]!)) b--;
  if (a > b) return null;
  let from = at.get(was[a]!)!, to = at.get(was[b]!)!;
  if (from > to) return null;
  if (to - from + 1 < MIN_SHOWN) { from = Math.max(0, Math.min(from, n - MIN_SHOWN)); to = Math.min(n - 1, from + MIN_SHOWN - 1); }
  return from <= 0 && to >= n - 1 ? null : { from, to };
}

// In the render, after the branch for a new view (which also keeps `keys: pointKeys`):
} else if (differ(drawing.keys, pointKeys)) {
  setDrawing({ ...drawing, keys: pointKeys });
  const was = drawing.keys, at = was ? indexOf(pointKeys, points) : null;
  const i = reading && at && was ? at.get(was[reading.i]!) : undefined;
  if (reading && i == null) {
    setReading(null);
    if (said?.reading != null) setSaid(null);
  } else if (reading && i !== reading.i) setReading({ ...reading, i: i!, moved: true });
  const next = zoomed && at && was ? windowOn(zoomed, was, at, points) : null;
  if (!same(next, zoomed)) {
    setZoomed(next);
    if (!next && readZoom) setSaid({ reading: null, zoom: readZoom(null) });
  }
}

// The layout effect: the band effect places a reading the remap moved, after the draw.
// As built: `if (!chart || drawnKeys.current === drawing.keys) place(i)`, with `drawnKeys` set by the draw effect.
useLayoutEffect(() => { if (at != null && !reading?.moved) place(at); }, [reading, at]);

// The band effect, before the band's action and place(at):
if (pointer.current && Number(chart.convertFromPixel(X_AXIS, pointer.current.x)) !== at) pointer.current = null;
```

Not in the draft, and the builder's to add:

- The `console.error` for a list the wrapper cannot go by.
- Whether the last list was one it could go by. The draft checks the new list only, so a redraw from a list of a wrong length to a good one is remapped through the wrong one. `drawing` keeps the answer with the list.
- The comments.

## Defaults the owner may flip

Each is a choice where the brief gave another answer, or none. Flipping one changes the lines named, and nothing else.

| # | Default chosen | The other way | What flips |
|---|---|---|---|
| F1 | A window keeps the points still drawn, from its first to its last | A window with an end that is gone shows every point (the brief's proposal) | Decision 2, differences 5 and 6, two loops of the draft, the scenarios on a range that moves on a day |
| F2 | The outcome trend passes keys too | It keeps its list of weeks in `view` | Decision 6, difference 3, the `insights-dashboard` delta, part of step 2.3 |
| F3 | A pointer's tooltip goes over its point when a redraw moves the point from under the pointer | It stays beside the pointer, as today | Decision 5, difference 7, one line of the draft, one test, one scenario |
| F4 | A folded stretch's key is its first bucket | A fold has a key of its own, so one that opens ends the reading | Decision 6's fold table, one scenario |
| F5 | A list the wrapper cannot go by keeps nothing, and logs | It throws | Decision 1 |
| F6 | `onZoom` reports a remapped window | It stays silent while the same points show | Decision 7, the comment on `onZoom` |
| F7 | The zoom's end by a remap is said once | Nothing is said, as for a new view | Decision 4, difference 6 |

## What later changes inherit

A chart whose points can move inside a view gives `pointKeys`, made where its points are made, and keeps in `view` only what the user chose, plus what gives a key another meaning. A key is what the point is to the user: a day, a week, a session. A chart draws its marks from the data of each drawing and holds no index between renders. The wrapper never asks the chart where a point is between a change of its points and the drawing of them.

For Context: its charts read sessions and requests, whose ids are keys as they are. A reading that skips empty slots is still a wrapper rule to design there.

## Risks / Trade-offs

- **The remap runs before the chart has drawn the new points.** Any question to the chart in between answers for the old ones (P5). → The layout effect skips a remapped reading; the test is the order of the chart's calls on the fake (P9), each write of the tooltip on real ECharts, and each frame in the browser.
- **A caller that still holds the first point in `view`.** It would keep resetting, with no test failing. → Each caller step asserts the kept reading on a backfill, which fails while the key holds the first point.
- **A caller whose keys and points disagree.** → The wrapper logs, and a logged error fails the caller's test.
- **Keys that are not unique across a change the user did not choose.** A day and a week share keys. → The granularity stays in `view` (decision 6); the Errors and Activity steps assert a reset on it.
- **The pointer rule changes every chart.** A tooltip moves from beside the pointer to over its point after a resize or a squeeze. → It is the foundation's aim for a key, given to the pointer; one wrapper test and one browser line; F3 flips it.
- **The handle jumps under a drag.** → Rare: a refetch lands about once a minute, and only one that moves the points does it. The drag goes on and says its window once (P7).
- **The fake holds a dragged window by index.** → Stated in its header; the real test runs a dragged window; the wrapper has no line that depends on it.
- **A window that keeps its indexes over other days says nothing** (P8b). The seven oldest days of a rolling range are still the seven oldest. → The stale sentence is dropped, never said again with other words, as the foundation rules.

## Migration Plan

1. Land the wrapper prop with its tests and the real test (group 1). No chart passes keys yet, so no chart changes.
2. Land the callers, in parallel (group 2). Each is one commit that passes the keys and shortens the `view` key together: either alone would be wrong (keys with the first point still in `view` change nothing; a `view` without it and no keys reads other days).
3. Land the browser check and the docs (group 3).
4. Rollback: revert a caller's commit to give that chart today's behavior. The wrapper prop is inert without keys.

## Open Questions

- Whether a zoom should also survive a change of range when its days are in both. It would need the window by date in the caller, not in the wrapper. Not in this change.
- Whether the handle should be put back under the pointer after a remap under a drag. ECharts offers no action for it.
