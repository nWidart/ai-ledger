# Design

## Context

See `proposal.md` for the motivation. The reader's question is "where does my money go". Every open choice below is settled from that reader's side.

"The wrapper" is `<EChart>` in `web/src/components/echart/EChart.tsx`. Its files (`EChart.tsx`, `option.ts`, `stack.ts`, `testing.ts`, `zoomReset.tsx`, and `realTesting.ts` on another branch) belong to another team. **This change edits none of them**, and does not edit `echarts.ts`. Everything the graph needs is in `web/src/pages/cost/flow/`.

**Facts checked in the code** (base `4de1da48`).

- `/api/usage` (`metrics.usage()`) has no project × model × token kind figure. It has one-dimension totals (`totals.cost_input`, `cost_output`, `cost_cache_read`, `cost_cache_5m`, `cost_cache_1h`, `by_project`, `models` by model × effort × fast, with no kinds) and splits per day (`daily_projects`, `daily_models`, `daily_sources`). No pair of them can be joined into the cross-tab.
- Every cost figure comes from `requests_cte()`: per request `cost_<kind>` = tokens × the rate of the tier chosen once per request (fast, long prompt or base) / 1e6, NULL when the model has no rates or the source reported a cost; `cost` = `coalesce(reported_cost, Σ cost_<kind>)`. Thinking is billed as output. So the kinds of a view add up to its cost less the reported part, which has no split. `TokenPairs.tsx` reads the reported part as `totals.cost − kindCost(totals)` and names it when it is a cent or more.
- `cost-dashboard` requires one Output + thinking kind with one cost ("Price token kinds like the request"), and the drawer joins both cache write lifetimes into one Cache write (`tokenPairs()` in `cost.ts`). The page's kind names: Input, Output + thinking, Cache write, Cache read.
- Unpriced requests: `cost IS NULL`. `usage()` lists them in `unpriced` (model, requests, tokens). `daily_models` and `daily_sources` leave them out, "as they add no cost". The page shows a banner, and `Unpriced` in `drawers.tsx` is the "+?" chip with its screen-reader text.
- Colors. A project's color is `color(project)` in `colors.ts`: a `--proj-N` hue for the six all-time busiest projects, `--proj-other` grey for the rest. The daily chart stacked by model gives the six costliest models of the view `--series-1` to `--series-6` and the rest grey (`costKinds(d, "model")` in `cost.ts`). The drawer colors the kinds `--series-1`, `-2`, `-5` and `-4`: the same tokens as the models.
- Selecting a project elsewhere on Cost opens its sheet without filtering: `openProjectSheet(name)` in `components/sheets/session.ts`, as the project table does. `cost-dashboard` "Filter by time range and project" requires it.
- The wrapper's keys are `ArrowLeft`, `ArrowRight`, `Home` and `End`, one point each (`STEPS`). Its pointer reads `convertFromPixel({ xAxisIndex: 0 }, offsetX)` inside `containPixel({ gridIndex: 0 })`. Its mark is the axis pointer's band of x axis 0. No prop reports or sets the point read, and the caller gets no handle on the ECharts instance (`EChartHandle` has `reset()` and `focus()` only).
- Bundle at the base: `echarts-*.js` 176.5 kB gzip (limit 195), `CostPage-*.js` 12.1 kB (limit 20), `index-*.js` 109.1 kB (limit 130).

**What a spike measured** (ECharts 6.1.0, the SVG renderer, in vitest and jsdom, with `vi.unmock` of `components/echart/load`, through `init()` and through the real wrapper; `npm run build` and `node scripts/check-bundle.mjs` for sizes; a synthetic store built with `store.insert` as the Python tests build theirs, 200,000 requests in 4,000 sessions over 60 projects, 12 models and 365 days, a third of them Grok sessions with reported costs. The spike files are deleted.) No browser was used: what only a browser shows is listed under decision 12 and checked in step 4.1.

| Question | Result |
|---|---|
| Way (a): `SankeyChart` added to `echarts.ts` | `echarts-*.js` 187.3 kB gzip, from 176.5: +10.8 kB. With the planned treemap (about +13 kB) the chunk would be about 200 kB, over its 195 kB limit. |
| Way (b): a prototype of the pure fold, layout, band paths, pointer test, key rule, sentences and option (about 150 lines), imported by `CostPage.tsx` | `CostPage-*.js` 14.4 kB, from 12.1: +2.3 kB. `echarts-*.js` unchanged, 176.5 kB. |
| ECharts' sankey at 343 × 320, 6 projects, 4 models, 5 kinds | Drawn (62 paths). Every label is start-anchored right of its node: the first column's labels sit over the bands, and "Output + thinking" starts at x 279 and runs past the 343px box. No label is truncated. A link of value 0 puts its target in the last column (justify alignment) with a 0px node and a label. Links default to `#86878c` at 0.2 opacity. The layout is computed inside the chunk; the component cannot read it, since the wrapper exposes no instance. |
| Custom series, `coordinateSystem: "none"`, a `path` with `shape.pathData` of two cubic curves | Drawn as `<path d="M100 20C160 20 160 60 220 60L220 90C160 90 160 50 100 50Z">`, exactly the data given. `style.opacity: 0.45` is written as `fill-opacity="0.45"`. |
| Custom `text` with `width: 80, overflow: "truncate", ellipsis: "…"` | "atlas-api-very-long-project-name-for-wrapping" drawn as "atlas-api-very…" (jsdom's width estimate). |
| Custom `text` with `stroke` and `lineWidth: 3` | `stroke-width="3" paint-order="stroke"`: the stroke is drawn under the fill, a halo. |
| Custom `text` at `fontSize: 22` | `font-size: 22px`. |
| The prototype through the wrapper, 343 × 260 | 59 paths: 44 bands, 15 node bars. Projects' labels end at x 89, models' start at 179.5 (nodes at 168 and 242), kinds' at 254. "Output + thinking" truncated to "Output + thin…" in its 80px room by jsdom's 0.6em estimate. |
| The wrapper with `points={0}` and an option of custom series only | ArrowDown not prevented, the live region empty, nothing logged, the path drawn. |
| The flow's query against `usage()` on the synthetic store | `usage()`: 315 ms at 30 days, 609 ms all time. One query by project and model with the five kinds: 12.9 ms and 28.5 ms, 602 and 720 rows, 125 KB and 171 KB of JSON. The `GROUPING SETS` query of decision 3: 18.2 ms and 36.2 ms on a busier run where `usage()` took 691 and 1,139 ms; its pairs are 38 KB and 48 KB, its model rows 2.6 KB. |
| Do the flow's sums equal the page's? | Σ pairs = `totals.cost` to the cent in both ranges; each kind's Σ equals `totals.cost_<kind>` (difference 0.0); each project's Σ equals its `by_project` cost within 1.4e-12. |

## Goals / Non-Goals

**Goals:**

- One picture of where the period's money went, from project to model to token kind, whose total is the page's total.
- Every node and band reached by pointer, by touch and by keyboard, with its dollars and shares in words.
- Nothing new in the ECharts chunk: a treemap of about 13 kB is still to come and 18.5 kB are left.
- No edit to the wrapper's files.

**Non-Goals:**

- Any change to the daily chart, its stackings or its zoom, the project table, the drawers or Models and effort.
- Tokens as band width, a switch between cost and tokens, or a session column.
- A model or token kind filter (the page has none), dragging nodes, or a zoom.
- A flow on the Project page or on Activity.

## Decisions

### 1. Draw with the custom series on no coordinate system

Way (b). The bands, the nodes and the labels are custom series with `coordinateSystem: "none"`. A pure layout gives every pixel: node rectangles, and bands as closed paths of two cubic curves.

Why:

- **Budget.** 0 kB on the ECharts chunk against 10.8 kB for `SankeyChart`, which would leave 7.7 kB for the treemap's 13 kB. The cost moves to the Cost chunk: the prototype measured +2.3 kB; the built graph, with its component and table, is estimated at +4 to +5 kB, so about 17 kB of 20.
- **The reader.** Three fixed columns need no layout iterations: nodes stack in a column by cost, bands stack at a node in the order of the nodes they reach. ECharts' sankey reorders nothing useful here, puts labels over bands and past the box (measured), and its layout is unknown to the component.
- **Reading.** The wrapper reads one axis only (decision 6), so the graph owns its reading. That needs the geometry: the pointer test, the mark and the key tooltip are computed from the same layout as the drawing, and they work before the drawing code has loaded and when it fails to load, as `dashboard-app` requires of a chart.

Cost on the other side: about 250 lines of layout, paths and hit testing in the Cost folder, each pure and tested without a chart.

Rules that follow:

- `web/src/components/echart/echarts.ts` is not edited. No registration line.
- The option holds no `grid`, `xAxis`, `yAxis` or `dataZoom`. The wrapper adds `axisPointer: { triggerOn: "none" }` and `dataZoom: []`; the spike drew such an option with no warning.
- The option sets `animation: false`, in every mode (decision 8).
- Every series is `silent: true`: the graph's pointer test is its own (decision 6).

### 2. Columns, kinds and band width

- **Columns.** Project, Model, Token kind. A band is the estimated cost, in dollars, that flowed from one node to the next. Width is cost, never tokens: the reader asks about money, and a cache read band sized by tokens would be the widest for the cheapest kind.
- **The kinds.** Input, Output + thinking, Cache write (both lifetimes), Cache read: the four the drawer bills, with its names, so the two views agree. Thinking is not split from output: the spec bills it as one kind with one cost, and a thinking band would be an allocation, not a price. The lifetimes are joined as in the drawer; the drawer and the table keep them apart.
- **Reported.** A fifth kind node, "Reported", holds the cost an agent reported with no split by kind, per model: the model's `cost` less its kinds. It is drawn when above 1e-9 (the float guard of `costDays()`), so the kinds column adds up to the total. Its reading says "not split by kind".
- **One project selected: two columns**, Model and Token kind. Why: the page heading already says "on atlas-api", and a lone project node would be one bar of 100% that takes a third of the width from the bands that carry the answer. The section's heading says the project.
- **One model, or one project in an unfiltered view**: the column stays, a single node. It is a true answer ("all of it went to Opus"), and the shape of the graph does not change with the data.
- **Order.** In each column, nodes by cost, largest at the top, Other and Reported last; ties by name, A to Z. At a node, its bands leave in the order of the nodes they reach and arrive in the order of the nodes they come from, so no two bands of one node cross each other.
- **A $0.00 node.** A name whose cost in the view is 0 (a model priced at zero rates) is no node and no band, and is not counted in Other. The table lists its flows at $0.00. A cost above 0 that rounds to $0.00 is a node, drawn at least 2px tall (decision 5), and reads "$0.00", as the page writes it.

### 3. Data: a `cost_flow` field on the usage payload

```
GET /api/usage?…   (unchanged parameters)
→ { …, cost_flow: { pairs: FlowPair[], models: FlowModel[] } }
FlowPair  = { project: string | null, model: string, cost: number }
FlowModel = { model: string, cost: number, cost_input, cost_output, cost_cache_read, cost_cache_5m, cost_cache_1h: number | null }
```

In `usage()`, on the view's `rq` and `rp`, with the `costs` text it already builds for `tot`:

```sql
{rq} SELECT project, model, grouping(project) AS whole, sum(cost) AS cost, {costs}
FROM rq WHERE cost IS NOT NULL
GROUP BY GROUPING SETS ((project, model), (model))
ORDER BY whole, cost DESC, project, model
```

`pairs` are the rows with `whole = 0` (project, model, cost); `models` the rows with `whole = 1` (model, cost and the five kinds). `grouping(project)` tells a model's total row from a pair whose project is NULL.

- **Prices.** Nothing is priced again. The kinds are the `cost_<kind>` columns of `requests_cte()`, the tier chosen once per request, so a pair's cost and a model's kinds are sums of the same numbers as `totals`, `by_project` and `daily_models`. The web derives Reported as `cost − Σ kinds` per model, as `TokenPairs.tsx` does for the view.
- **Unpriced.** `WHERE cost IS NOT NULL`, as `daily_models`: an unpriced request adds no row. A reported-only model has a row with its five kinds NULL.
- **Filters.** The view's own: range, project, source, automated, through `view()`. Nothing is source-specific: Claude Code, Codex and Grok requests are rows of the same derived tables.
- **Equal to the page.** Σ `pairs.cost` = Σ `models.cost` = `totals.cost`; Σ `models.cost_<kind>` = `totals.cost_<kind>`; Σ of a project's pairs = its `by_project` cost. Measured equal to the cent (Context). Proven by the Python test of step 1.1 on the stores of `MetricsTest`, `ReportedCostTest` and `SourceFilterTest`, which hold priced, long-tier, fast, reported, unpriced and no-project requests; the web side by step 2.1 (every column of the model adds up to its input's total) and by step 3.1 (the section's total reads as the heading's).
- **Cost.** One scan grouped two ways: 18 ms of 691 ms at 30 days, 36 ms of 1,139 ms all time, on 200,000 requests, about 3% of `usage()`. Payload: 38 KB at 30 days and 48 KB all time on 60 projects × 12 models, every pair used, the worst case; a store whose projects use three or four models each sends about a third of that.

Alternatives:

- **A new endpoint, `/api/cost-flow`.** Rejected. The owner asks that the graph's total equal the page's to the cent. Two requests answer from two moments: an ingest between them, every minute while a session runs, makes the graph and the heading disagree. A second request also brings its own loading, error and retry states into one section of the page. Its gain, sparing Activity and the Project page 18 to 36 ms and the bytes, is small against the 300 to 1,100 ms they already pay.
- **A parameter on `/api/usage`, sent by Cost only.** Rejected: Cost's and Activity's usage queries share one cache key today (`["usage", view, session]`), so a visit to one page serves the other. A parameter splits that cache.
- **One query by project and model, with the kinds on every pair.** Same scan time, but 125 KB to 171 KB in the worst case, three times the pairs alone, for kinds per pair that no column shows.

### 4. Fold small projects and models into Other

For the project column and the model column alike:

- Names with a cost above 0, costliest first (ties A to Z).
- A name keeps its own node when it is among the first five and holds at least 1% of the view's cost.
- The rest go to one node, "Other (N)", last in the column, in `--proj-other` grey.
- When only one name would go to Other, it keeps its own node instead: Other always holds two names or more.
- The kinds column never folds: it has five nodes at most.

So a column has at most six nodes, at every width. Why:

- **Six fits.** At 343px and the default text size, six nodes of one or two label lines fit a 222px plot with 8px gaps; at 1174px the bands get longer, not the nodes taller. A wider box holding more nodes would put a project in Other on a phone and not on a desktop, and the same view would read two ways; the same rule at every width keeps one answer, as the activity calendar keeps a day's shade at every width.
- **Five and Other match the colors.** Five named models get `--series-1` to `--series-5`, the colors the daily chart gives them stacked by model (`costKinds(d, "model")` ranks the same way, by cost), and a sixth named model, when Other would hold one, gets `--series-6`.
- **1% keeps slivers out.** A 1% node is 1.8px of a 182px column: a label cannot sit there, and a reader cannot point at it. The 1% floor and the top-five cap fold the long tail, and Other's reading names its three largest.
- **By cost, not by color.** The daily chart folds the projects without an all-time hue, because a stack tells its series apart by color only. Here every node has a label, so a big project of this range that owns no hue keeps its node, grey, named. A project's node is in its own hue when it has one, so a color still means one project on the whole page.

Other's reading and tooltip list its three costliest names with their cost, and "and N more", as the daily chart's Other does. The data table lists every name.

### 5. Layout

`flowFit(width, textScale, columns)` and `flowLayout(model, fit)`, pure, in `flow/flowModel.ts` (not `costFlow.ts`: on a case-insensitive file system `./costFlow` would also resolve to `CostFlow.tsx`, as `costDaily.ts`'s header says of `costChart.ts`). `s` is the text scale.

| Name | Value |
|---|---|
| Column titles (top margin) | 18px × s: "Project", "Model", "Token kind", muted, over each column of nodes |
| Plot height | the larger of 222px and 172px × s + 40px (six nodes of two 14.3px × s lines, five 8px gaps) |
| Box height | top margin + plot height + 2px, rounded up: 242px at 16px text, 280px at 20px, 422px at 32px |
| Node bar | 8px wide |
| Gap between nodes | 8px |
| Outer label room (left of the first column, right of the last) | 28% of the width, at most 200px × s |
| Middle label room (right of the middle bars) | the band gap less 12px × s |

```
xs (three columns)  = [L, (width − bar) / 2, width − L − bar]       L = min(200·s, round(0.28 × width))
xs (two columns)    = [L, width − L − bar]
k                   = min over columns of (plot − gap × (nodes − 1)) / total
node.h, band.h      = value × k            (stacking: exact)
node.y              = top + Σ (h + gap) of the nodes above it
```

| Box | Text | Outer room | Band gap | Middle room |
|---|---|---|---|---|
| 1174px (a 1440px window) | 16px | 200px | 375px | 363px |
| 800px (jsdom's fallback width) | 16px | 200px | 188px | 176px |
| 343px | 16px | 96px | 63px | 51px |
| 343px | 32px | 96px | 63px | 39px: the middle labels go to the key |
| 1174px | 32px | 329px | 246px | 222px |

- **One scale for every column**, the smallest that fits: a band is as thick at both ends. A column with fewer nodes ends higher.
- **Thin things.** The stacking uses exact heights. Only the drawing rounds a node up to 2px and a band up to 1px, centred on its exact place, so a cost above 0 is always seen (as Cost's "Keep a thin segment visible"). With the 1% fold this rounding moves nothing by more than 1px.
- **Bands.** From the right edge of the source bar at its stacked y to the left edge of the target bar at its stacked y: `M x0 y0 C cx y0 cx y1 x1 y1 L x1 y1+h C cx y1+h cx y0+h x0 y0+h Z`, `cx = (x0 + x1) / 2`. Drawn largest first, so a thin band is never under a wide one.
- **Labels.** Outer columns: outside their bars, right-aligned before the first column, left-aligned after the last, 4px × s from the bar. Middle column: left-aligned 4px × s after its bars, over the bands, with a 3px halo in the surface ink (measured: `paint-order="stroke"`). Line 1, the name, in the text ink; line 2, its cost (`usd`), muted, only when the node is at least two lines tall. Both at 11px × s, the charts' font.
- **Truncation.** A name longer than its room is cut with "…" by zrender (`overflow: "truncate"`). The full name is in the tooltip, the reading, the key and the table. A model's name drops `claude-` as on the daily chart.
- **Collisions.** In each column, in order of cost, a label is kept when its line box does not overlap a kept one. A node with no label is still read, by pointer and keys, and is in the table.
- **A column with no room**: when a column's label room is under 40px × s (six characters), its labels are not drawn, and an HTML key under the graph names that column's nodes in order, each with its swatch and cost. At 343px and 32px text that is the model column. The key wraps; it never scrolls sideways.
- **Width.** The component measures its box with `useWidth()` from `components/chart.ts`. The graph never draws past its box, so the page never scrolls sideways. Nothing under the section moves when it draws: the box has its height from the first render (the wrapper's rule).

### 6. Reading: the graph's own, along the bands

**What the wrapper lacks** (checked in the code, and measured with `points={0}`):

1. Keys. Left and Right move one point of one axis, Home and End go to its ends. Up and Down are not read; no prop gives a key its meaning.
2. Pointer. The point is the band of x axis 0 under `offsetX`, inside grid 0. A graph with no grid and shapes that are not columns reads nothing.
3. Place. The mark is the axis pointer's band, and a key's tooltip sits at the top of grid 0.
4. No prop tells a chart which item is read, and none lets it set one. No handle gives the ECharts instance.

**So the wrapper draws and the graph reads**, as the activity calendar does. `<EChart>` gets `points={0}`, `read={() => ""}`, and no `tip`, `onActivate`, `status`, `onEscape` or `zoom`. Measured: it then leaves every key and pointer event alone and says nothing. It still gives the focusable `role="group"` box with its label, the lazy load, the environment, the resize and the "could not be drawn" text.

The reading lives in two files of `flow/`:

- `flowReading.ts`, pure: `moveFlow(at, key, model)`, the item a key reads; `flowAt(layout, x, y)`, the node or band under a pixel.
- `CostFlow.tsx`: the state `{ at, keyed, text } | null`, the handlers on a `div.flow-box` around the wrapper's box, the tooltip, the mark and the live region.

**What can be read.** A node, or a band. A band read by a key remembers the end it was entered from (`{ band, from: "source" | "target" }`), so Up and Down move among the bands of that node.

**Keys**, on the focused box:

| Key | On a node | On a band entered from its source | On a band entered from its target | Nothing read |
|---|---|---|---|---|
| Down, Up | the next, the previous node of the column; stops at the ends | the next, the previous band leaving the source; stops | the next, the previous band reaching the target; stops | Down: the first node of the first column; Up: the first node of the last column |
| Right | the node's first band out (its top one) | the band's target node | the band's target node | the first node of the first column |
| Left | the node's first band in (its top one) | the band's source node | the band's source node | the first node of the last column |
| Home, End | the first, the last node of the column | the first, the last band leaving the source | the first, the last band reaching the target | the first, the last node of the first column |
| Enter | a named project: opens its sheet (decision 7); anything else: nothing, the reading stays | nothing, the reading stays | the same | left to the browser |
| Escape | ends the reading | the same | the same | left to the page |

- Right on the last column's node and Left on the first column's stay where they are: there is no band out or in. The reading is said again, so the key is not met with silence.
- Why this walk: the reader follows a dollar. Right, Right, Right goes project, its top band, that model, its top band, a kind. Up and Down on a band compare the flows out of one node, which is "where did atlas-api's money go". Every node and band is reachable: every band leaves a node of an earlier column.
- Up and Down are prevented, so the page does not scroll under the focused graph. A key with Alt, Ctrl, Meta or Shift is the browser's (`modified()` in `components/keys.ts`).
- Blur ends the reading. Escape ends it from anywhere when the pointer opened it: a capturing `keydown` listener on the document while a reading is open, as the wrapper has it.

**Pointer.** `mousemove`, `mouseleave` and `click` on `div.flow-box`. The position is the event's client position less the box's. `flowAt` tests the nodes first, each widened by 4px on either side so a thin bar can be hit, then the bands, last drawn first: a point is in a band when its x is between the band's ends and its y is between the top curve and the top curve plus the band's height at that x. On a band's curve `x(t) = x0 + (x1 − x0)(1.5t − 1.5t² + t³)` rises with t, so t is found by bisection (24 steps, under 1e-7 of the span), and `top(t) = y0 + (y1 − y0)(3t² − 2t³)`. A label, a column title or an empty place reads nothing. A click reads and then activates. A touch reaches the box as the browser's compatibility `mousemove` and `click`.

- The cursor is a hand over a named project node, and the default elsewhere: a class on `div.flow-box` set from `flowAt`, not zrender's, since every series is silent.

**The mark.** The item read is outlined by an `<svg class="flow-mark" aria-hidden="true">` over the plot, from the same layout: a band's path, or a node's rectangle grown by 2px. Theme: a 2px line in `--text-primary` and a fill of it at 8%. Forced colors: a 2px line in `Highlight`, no fill. It is HTML, so reading redraws nothing in ECharts and works before the chart has drawn, as the calendar's ring does.

**The tooltip.** A `div.tip` with `role="tooltip"` in `div.flow-box`, placed with `tipAt()` from `components/chart.ts`: beside the pointer, or, for a key, at the right end of the node or the middle of the band. Rows: for a node, its column and name, its cost and its share of the total, then up to three of its bands (out of a project, in to a kind, both sides of a model) with their cost and "+ N more"; for Other, its three costliest names; for a band, "From", "To", its cost, its share of the total and its share of the source.

**The live region.** One `div.sr` with `aria-live="polite"` in the component. The wrapper's own region stays empty. Sentences, with the costs in the page's `usd` and the shares to one decimal:

| Read | Sentence |
|---|---|
| A project | "Project atlas-api: $60, 28.6% of $210. To opus-4-5 $24, sonnet-4-5 $18, gpt-5.1-codex $12 and 1 more." |
| Other projects | "Other, 4 projects: $30, 14.3% of $210; the largest delta $12, echo $10, foxtrot $5. To opus-4-5 $12, sonnet-4-5 $9 and 2 more." |
| A model | "Model opus-4-5: $84, 40.0% of $210. From atlas-api $24, beacon $20, comet $16 and 3 more. To Output + thinking $34, Input $17, Cache read $13 and 2 more." |
| A model, one project selected | "Model opus-4-5: $34, 56.7% of $60. To Output + thinking $14, Input $7, Cache read $5.10 and 1 more." |
| A kind | "Cache read: $13, 6.0% of $210. From opus-4-5 $8.40, sonnet-4-5 $4.20." |
| Reported | "Reported, not split by kind: $0.75, 0.4% of $210. From grok-4.7-build $0.75." |
| A band out of a project | "atlas-api to opus-4-5: $24, 11.4% of $210 and 40.0% of atlas-api." |
| A band into a kind | "opus-4-5 to Cache read: $8.40, 4.0% of $210 and 10.0% of opus-4-5." |
| A key that cannot move | the reading's sentence again |

- "$210" is the view's total, as the heading writes it (`usd`).
- A reading a key made is said again when newer data changes its words; the pointer's is not, and its tooltip shows the newer figures (the wrapper's rule).
- Newer data keeps the reading: it is held by the node's or the band's id (`p:<project>`, `m:<model>`, `k:<kind>`, the Other ids, `<from>|<to>`), not by an index. It ends when that id is gone, and with a new view.

**The group's label**, on the wrapper's box:

- Three columns: "Estimated cost from project to model to token kind, $210 in all: 6 projects, 4 models and 5 kinds, each band as wide as its cost. Use up and down to move in a column, right and left to follow a band to the next column, Home and End for the first and last. Enter on a project opens its summary."
- Two columns: "Estimated cost on atlas-api from model to token kind, $60 in all: 4 models and 5 kinds, each band as wide as its cost. Use up and down to move in a column, right and left to follow a band to the next column, Home and End for the first and last."
- With unpriced requests, after the first sentence: "12 requests from unpriced models are not drawn: their cost is unknown."

**The visible lines.** Heading: "Where the cost goes". Hint, one line at 1440px: "From project to model to token kind, each band as wide as its cost; small ones in Other. Arrow keys follow the bands." (one project: "From model to token kind on atlas-api, …"), with a "How measured" toggletip (docs `pages/cost` until step 3.2 adds the anchored entry `pages/cost#where-the-cost-goes` to `DOCS` in `docs.ts` with the site's heading): the kinds and Reported; the fold rule; unpriced models are left out; the total equals the heading's.

### 7. Enter and click: a project's sheet

Enter on a named project node, or a click on it, opens that project's sheet with `openProjectSheet(project)`, as a row of the project table does. The filter does not change; the sheet offers to filter to the project. The reading stays, and the sheet takes the focus as it does from the table.

- Other, "(no project)", a model, a kind and any band decline: nothing happens and the reading stays, as the daily chart declines an empty day.
- Why not filter: `cost-dashboard` requires that selecting a project outside the filter controls opens its sheet without changing the filter. Why not nothing: the sheet is the drill-down the reader asks for next ("what is atlas-api spending on"), one call that already exists, and its "Filter to atlas-api" turns the graph into atlas-api's two columns.
- One project selected: the graph has no project column, so nothing opens a sheet; the label leaves out the Enter sentence.

### 8. Colors, forced colors, dark and motion

- **A band's color is its source node's**, at opacity 0.4: a project's hue (or grey) from the projects to the models, a model's series color from the models to the kinds. The reader follows a project's color into the models, and a model's color into the kinds.
- **Nodes.** Projects: `color(project)`, Other `--proj-other`. Models: their color in `costKinds(d, "model")` (named in the daily chart's model stacking), Other `--proj-other`. Kinds and Reported: `--text-secondary`, neutral: their bands carry the models' colors, and the drawer's kind colors are the same series tokens as the models', which in one graph would say "this kind is that model".
- **Color is never alone.** Every node has a label or a key entry, every band is read by pointer and keys, and the table has every figure. The node colors are the validated `--proj-*` and `--series-*` tokens; a band, at 0.4, carries no figure alone.
- **Forced colors.** A hue is not a system color. Nodes are filled in `ink.text` (`CanvasText`). Bands are unfilled outlines, 1px in `ink.text`: overlapping bands stay apart by their edges, not by a shade. Labels are `CanvasText` with a `Canvas` halo. The mark is `Highlight` (decision 6). The key's swatches follow by a `forced-colors` rule in `flow/flow.css`. The graph switches when forced colors turns on or off: the wrapper's environment changes and the option is drawn again.
- **Dark.** The tokens carry both schemes; the wrapper redraws on a theme or scheme change. The mark's `--text-primary` turns light in dark.
- **Reduced motion.** Nothing animates in any mode (`animation: false`): a growing band would be read as a change in cost.

### 9. Place: after the project table

The section comes after the project table, before the insights and Models and effort; with one project selected, there is no project table and it follows the daily chart.

Why: the project table answers "which project"; the flow answers "and on what". It is a second look after the daily chart, not the first screen. `cost-dashboard`'s "Put the daily chart near the top" is untouched: the daily chart keeps its place, and step 4.1 runs the first-screen check to show it did not move.

### 10. The option and the view

```ts
{
  ...baseOption(env), animation: false,
  series: [
    { type: "custom", id: "bands", coordinateSystem: "none", silent: true, data: [[0], [1], …],   // one item per band, largest first
      renderItem: (_, api) => band(layout.bands[api.value(0)]) },                                 // a path, emphasisDisabled
    { type: "custom", id: "nodes", coordinateSystem: "none", silent: true, z: 2, data: [0],
      renderItem: () => ({ type: "group", children: [...bars, ...labels, ...titles] }) },
  ],
}
```

- `baseOption()` from `option.ts` as it is; labels at its font and size.
- `flowModel(d)` holds the columns, the nodes (id, column, label, full name, value, color token, Other's members), the bands (id, from, to, value) and the total. `flowLayout(model, fit)` places them. `flowOption(layout, env)` draws them. All pure, types only from the runtime.
- The view key, given to the wrapper and to the component's reading: the range, the first day, the project, the source and the automated filter. Not the figures. A new view ends the reading.
- The text scale is read once per render in the component and handed to the fit, as `CostChart.tsx`'s option reads it from the environment.

### 11. Empty and edge cases

| The view | The section shows |
|---|---|
| No request | "No usage in this view, so no cost to follow." No graph, no table. |
| Requests, all unpriced (`totals.cost` null) | "No request in this view is priced, so there is no cost to follow." and the unpriced line. No graph. |
| Priced requests costing $0.00 | "The priced requests in this view cost $0.00, so there is no cost to follow." No graph. |
| Some unpriced | The graph, and under it: "Not drawn: 12 requests from unpriced models (m-unknown, m-new), whose cost is unknown." The total in the label and the How measured text carry the `Unpriced` chip. |
| One project in an unfiltered view, one model | One node in that column, at the full height. |
| A name at $0.00 | No node (decision 2); its flows are in the table at $0.00. |
| Only reported cost (a Grok-only view) | Models to one kind node, "Reported", at 100%. |

The words of the first three follow the Tokens and cache drawer's sentences, so the two say the same thing about the same view.

### 12. The data table

"Show data table" under the graph, through `ChartTable` and `Table`, closed on every load and not rendered while closed. Name: "Estimated cost from project to model to token kind". Columns: Step ("Project to model", "Model to token kind"), From, To, Est. cost (to the cent, as the drawer's table), Share of cost (one decimal). One row per flow, **unfolded**: every project and model pair of `cost_flow.pairs`, then every model and kind (Reported included), each step costliest first. Other is not a row: its names are. Each step's rows add up to the total. With one project selected the table has the second step only.

### 13. Tests and the browser check

| Where | What | Catches |
|---|---|---|
| `tests/test_metrics.py` | `cost_flow` on the existing stores | The sums of decision 3, NULL project, reported and unpriced rows, the filters |
| `flow/flowModel.test.ts` | `flowModel`, `flowFit`, `flowLayout`, `flowOption` with a stubbed `api` | Fold, kinds, conservation, geometry, labels, forced colors |
| `flow/flowReading.test.ts` | `moveFlow`, `flowAt` | The key table and the pointer test |
| `flow/CostFlow.test.tsx`, fake runtime | What a user reaches: label, hint, keys, pointer, tooltip, live sentences, Enter, Escape, empty states, unpriced line, table | Wiring and wording |
| `CostPage.test.tsx` | One test: the section's place and its total equal to the heading's | Wiring, the to-the-cent promise on the page |
| `flow/CostFlow.real.test.tsx`, real ECharts | Bands and nodes drawn at the layout's pixels in their colors, labels, forced outlines | An option ECharts refuses or draws elsewhere |
| `tools/demo/chartfit/flow.mjs`, Chromium | What jsdom cannot show (below) | Layout, colors, real events |

The fake runtime draws nothing, and the reading does not use it: a graph that draws no band passes every fake test. The real test and the browser check are the ones that see the drawing.

Only a browser shows these; step 4.1 checks each: the labels' real widths at 16px and 32px (jsdom estimates 0.6em a character) and which columns go to the key; that the mark sits on the drawn band within 1px at its ends and middle; that `mousemove` and `click` reach `div.flow-box` through zrender's svg, and a touch tap too; the hand cursor; that Up and Down do not scroll the page; the forced-colors outlines; dark and the OS flip; no sideways scroll at 375px and at 32px text.

Net test lines, estimated: Python 45, model, layout and option 170, reading rule 60, component 140, page 20, real 60: about 495. That is over the 400-line advice. The reason: the reading is the graph's own (decision 6), so its keys, pointer and sentences are tested here and nowhere else. The work splits into two pull requests if the owner wants each under 400: the payload (step 1.1, about 45 lines) and the graph (about 450; the reading rule's 60 could follow in a third).

### 14. Bundle

- `echarts-*.js`: unchanged, 176.5 kB against 195 kB. No part is registered.
- `CostPage-*.js`: 12.1 kB against 20 kB at the base; the prototype measured +2.3 kB; the built graph is estimated at 16 to 17.5 kB. If it is over 20 kB the step stops: the folder becomes a lazy chunk, not a raised limit (open question 2).
- `index-*.js`: `api.ts` grows by a type: under 0.1 kB.

## For the owner of the shared chart component

Not tasks of this change. With these additions a graph of nodes and bands, and the calendar, could drop their own reading code (here `flowReading.ts`, the tooltip, the mark and the live region: about 200 lines and their tests):

1. **A key map.** `keys={(at, key) => next | undefined}`: the wrapper asks the chart what a key reads, and prevents the keys it answers, Up and Down included.
2. **A pointer test.** The reserved `locate` prop as `locate={(x, y) => item | null}`, in place of the band of x axis 0.
3. **The place of an item.** `where={(item) => ({ x, y, width, height } | path)}` for a key's tooltip and for the mark, in place of the axis pointer's band; or `onRead(item | null)`, so the chart draws its own mark.
4. **Items that are not indexes.** `points` counts an axis; a graph's items are ids. A `read(item)` keyed by any value would carry newer data by id.

This change relies on `points={0}` meaning "the wrapper draws and reads nothing", as the calendar does. It is measured, but no comment or test of the wrapper says so.

## Risks / Trade-offs

- **The reading rules exist three times**: in the wrapper, the calendar and here. → The flow copies the wrapper's rules word for word where they apply (Escape, blur, a key's reading said again), and the section above lists what would remove the copies.
- **The mark and the bands are drawn by two renderers.** → Both read one `flowLayout`; the real test pins the bands to it and the browser check pins the mark to the bands.
- **The payload grows for every page that reads it.** → 18 to 36 ms and up to 48 KB on a 200,000-request store with every pair used; a third of that on a typical store. Measured against a second request, which would break the to-the-cent promise.
- **Other hides names.** → Its reading and tooltip name its three largest, and the table lists every flow.
- **Three palettes meet**: project hues, model series colors, neutral kinds. → Each column has one palette, and every node is labelled or keyed.
- **A middle label over the bands can hide a thin band's start.** → The halo is 3px, the band is still read by the pointer and the keys, and the browser check looks at it.

## Open Questions

1. **Place.** After the project table, as planned, or right after the daily chart, above the table? Both keep the first-screen rule; the second puts the flow before the table that holds the same projects.
2. **The `CostPage` chunk.** If the built chunk is over 20 kB, may the flow become a lazy chunk of its own (the plan's choice), or may the limit be raised?
