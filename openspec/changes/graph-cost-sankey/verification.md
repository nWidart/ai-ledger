# Verification

Step 4.3's record: where each scenario of the two spec deltas is proven, the net test lines, and the bundle sizes. "flow.mjs N" is the line of `tools/demo/chartfit/flow.mjs` that prints the check, run in a browser in step 4.1. Test names are given as they are in the files. A scenario with no proof says so.

## cost-dashboard

### Show where the cost goes

| Scenario | Proof |
|---|---|
| Three columns | `CostFlow.test.tsx` "names the three columns, the total and the keys, and what unpriced requests leave out"; flow.mjs 353 (every node and band of the payload drawn, in light) |
| The same total as the heading | `CostPage.test.tsx` "follows the cost after the project table to the heading's total, and opens a project's sheet from it"; `flowModel.test.ts` "adds every column up to the priced cost, and every node's bands in up to its bands out"; flow.mjs 373 and 379 |
| A source filter | `tests/test_metrics.py` `SourceFilterTest.test_all_sources_add_up` (with `source="codex"`, only the Codex request's cost in the pairs and the model rows) |
| Priced and reported requests from three agents | `CostPage.test.tsx` "follows the cost after the project table to the heading's total, …" on the `usage-sources` fixture (priced Claude Code and Codex requests, Grok's reported ones); `test_metrics.py` `MetricsTest.test_cost_by_kind` and `ReportedCostTest.test_reported_cost_beside_an_estimate_and_an_unpriced_request` for the sums |

### Place the cost flow after the project table

| Scenario | Proof |
|---|---|
| All projects | `CostPage.test.tsx` "follows the cost after the project table to the heading's total, …" (after the project table, before the `split` block). The daily chart's place at the top: `tools/demo/firstscreen.mjs`, run in step 4.1; no line of flow.mjs |
| One project | **No proof.** No test checks the section's place in a one-project view; flow.mjs 769 checks its two columns and its table, not its place |

### Drop the project column for one project

| Scenario | Proof |
|---|---|
| One project | `flowModel.test.ts` "drops the project column for one project"; `CostFlow.test.tsx` "names the project and two columns with one project selected, and leaves out Enter"; flow.mjs 769 |
| One project in all projects | By the rule only: `flowModel.test.ts` "uses one scale for every column, the tallest stack filling the plot". No test draws a lone project node in an unfiltered view |

### Name the token kinds of the cost flow as the drawer does

| Scenario | Proof |
|---|---|
| Thinking is output | `flowModel.test.ts` "names the kinds as the drawer bills them, and Reported last" (one Output + thinking node from `cost_output`, which the server bills thinking into) |
| Reported cost | `flowModel.test.ts` "names the kinds as the drawer bills them, and Reported last" (the reported-only model's one band to Reported); `test_metrics.py` `ReportedCostTest.test_reported_cost_beside_an_estimate_and_an_unpriced_request`. The sentence "Reported, not split by kind": flow.mjs 412, which reads every drawn node with its sentence on the demo store's Grok sessions; no vitest asserts it |

### Fold small projects and models into Other in the cost flow

| Scenario | Proof |
|---|---|
| A long tail of projects | `flowModel.test.ts` "folds: a long tail: the five costliest, then Other" |
| One name would fold | `flowModel.test.ts` "folds: one name that would fold keeps its node" (on the project column; both columns fold by the same `fold()`) |
| Other's names | `CostFlow.test.tsx` "opens a project's sheet on Enter, and on a model, Other or a band does nothing and keeps the reading" (Other's sentence names its costliest projects with their cost). Partly: that Other holds two names, so no test shows "and N more" for Other, and no test reads Other's tooltip rows |
| Same fold on a phone | `flowModel()` takes no width. flow.mjs 353 (1440px) and 692 (a 343px box) each match the drawing to the graph computed from the payload |
| A big project without a hue | `flowModel.test.ts` "adds every column up to the priced cost, …" (comet and echo, with no all-time hue, keep their nodes) and "hands env.color only declared color tokens" (their nodes are `--proj-other`). Partly: no test makes such a project the second costliest |

### Name what the cost flow leaves out

| Scenario | Proof |
|---|---|
| Some unpriced | `CostFlow.test.tsx` "names the three columns, the total and the keys, and what unpriced requests leave out" |
| Unpriced only | `flowModel.test.ts` "says why there is no flow: only unpriced requests"; `CostFlow.test.tsx` "says why there is no flow: No request in this view is priced, …" |
| Priced at zero | `flowModel.test.ts` "says why there is no flow: priced at zero"; `CostFlow.test.tsx` "says why there is no flow: The priced requests in this view cost $0.00, …" |
| No usage | `flowModel.test.ts` "says why there is no flow: no request"; `CostFlow.test.tsx` "says why there is no flow: No usage in this view, …" |

### Read the cost flow along its bands

| Scenario | Proof |
|---|---|
| Follow the money | `flowReading.test.ts` "moveFlow" table; `CostFlow.test.tsx` "reads the costliest project on Right, …" and "follows a band to its model, and Down compares the bands of the same project"; flow.mjs 517 |
| Compare a project's models | `CostFlow.test.tsx` "follows a band to its model, and Down compares the bands of the same project" (the scenario's sentence) |
| At the last column | `flowReading.test.ts` "moveFlow" table (Right on a last-column node returns it); flow.mjs 517 (Right on a kind stays). That the sentence is said again rests on `read()` renewing the live region's span; no test asserts the second saying |

### Say what a node or band of the cost flow holds

| Scenario | Proof |
|---|---|
| A model's sentence | `CostFlow.test.tsx` "follows a band to its model, and Down compares the bands of the same project" (sonnet-4-5's sentence) |
| Pointer over a band | `flowReading.test.ts` "reads a band between its edges, the topmost where two cross"; `CostFlow.test.tsx` "reads a band under the pointer, ends the reading when the pointer leaves, and reads a tiny node where it is drawn"; flow.mjs 426 and 412 |
| Newer figures | `CostFlow.test.tsx` "keeps the item read through newer figures and says its new sentence, and ends quietly on newer figures without it"; flow.mjs 670 |
| Newer figures without the item read | The same `CostFlow.test.tsx` test; flow.mjs 680 |

### Open a project's sheet from the cost flow

| Scenario | Proof |
|---|---|
| Enter on a project | `CostFlow.test.tsx` "opens a project's sheet on Enter, …"; `CostPage.test.tsx` "follows the cost after the project table to the heading's total, and opens a project's sheet from it" (the URL keeps `range=30`); flow.mjs 553 |
| Enter on a model | `CostFlow.test.tsx` "opens a project's sheet on Enter, and on a model, Other or a band does nothing and keeps the reading"; flow.mjs 541 |

### Fit the cost flow to its box

| Scenario | Proof |
|---|---|
| A view change | No band grows or moves: `flowModel.test.ts` "draws on no coordinate system, silent and still" (`animation: false`); flow.mjs 796 and 799. Partly: the section's fade is `useLanding()`'s, tested on other pages (`ActivityPage.test.tsx`, `ProjectPage.test.tsx`); no test sees the flow's section fade |
| Phone | `flowModel.test.ts` "labels a column only with room for six characters, and lists the others for the key" (all three columns labelled at 343px); `CostFlow.real.test.tsx` "draws the bands and nodes at the layout's pixels and the labels as text, …" (the long name cut with "…"); flow.mjs 727 and 738 |
| Larger text on a phone | `CostFlow.test.tsx` "names the models in a key in a 343px box at a text scale of 2"; `flowModel.test.ts` "sets the box's height at text scale 2" and "draws the labels with an ellipsis in their room, and the titles" (22px); flow.mjs 727 |
| Full name | flow.mjs 412, where the first project has a name too long for any label room and the pointer reads it with its whole name. No vitest uses a name cut on the graph |

### Offer the cost flow as a table

| Scenario | Proof |
|---|---|
| A project inside Other | `CostFlow.test.tsx` "lists every pair of a project folded into Other in the data table, to the cent" |
| One project | flow.mjs 769 checks the table's name only. **No proof** that its rows are the model to token kind rows only; `flowModel()` builds no pair rows with a project selected, and no test asserts it |

### Serve the cost flow with the usage payload

| Scenario | Proof |
|---|---|
| A request with no project | `test_metrics.py` `ReportedCostTest.test_cost_flow_keeps_a_session_with_no_project_apart_from_the_model_row` |
| A reported cost | `test_metrics.py` `ReportedCostTest.test_reported_cost_beside_an_estimate_and_an_unpriced_request` |

## dashboard-app

### Read a chart of nodes and bands along its bands

| Scenario | Proof |
|---|---|
| From a node to its band | `flowReading.test.ts` "moveFlow" table; `CostFlow.test.tsx` "follows a band to its model, …" |
| Reading before the chart has drawn | `CostFlow.test.tsx` "reads the costliest project on Right, with its sentence, its tooltip and the mark on its bar", on the fake runtime, which draws nothing |

### Mark the item read on its own shape

| Scenario | Proof |
|---|---|
| Marking a band | `CostFlow.test.tsx` "follows a band to its model, …" (one mark path); flow.mjs 412 and 517 (the mark within 1px of the band drawn) |
| Forced colors | flow.mjs 697 |

### Draw bands as outlines under forced colors

| Scenario | Proof |
|---|---|
| Cost flow in high contrast | `flowModel.test.ts` "outlines the bands and fills the nodes in the text ink under forced colors"; `CostFlow.real.test.tsx` "draws under forced colors"; flow.mjs 692 |
| Turning forced colors off | Partly: the wrapper gives a new environment when forced colors changes (`tokens.test.ts` "gives a new env when (forced-colors: active) fires change"), and `flowOption` draws from it. No test or flow.mjs line turns forced colors off on the flow |

## Net test lines

Against `origin/main` (`036b4131`), added minus removed in `*.test.*` files and `tests/`: 710 added, 9 removed, **701 net**.

| File | Net |
|---|---|
| `tests/test_metrics.py` | 42 |
| `web/src/pages/cost/CostPage.test.tsx` | 19 |
| `web/src/pages/cost/flow/flowModel.test.ts` | 258 |
| `web/src/pages/cost/flow/CostFlow.test.tsx` | 175 |
| `web/src/pages/cost/flow/flowReading.test.ts` | 111 |
| `web/src/pages/cost/flow/CostFlow.real.test.tsx` | 96 |

`tools/demo/chartfit/flow.mjs` (804 lines) is the browser check, run by hand, not a test file, and is not counted.

That is over the repo's advice of 400 lines. The shared chart wrapper reads along one axis only: its keys move one point of x axis 0 and its pointer reads the band of that axis under it (design decision 6). A graph of nodes and bands has no such axis, so the flow owns its keyboard and pointer reading, its tooltip, its mark and its sentences, and they are tested here and nowhere else: `flowReading.test.ts` and the reading tests of `CostFlow.test.tsx`, about 190 lines. The rest is the layout's geometry (the fit table, one scale, the stacking, the drawn minimums, the labels) and the money sums that keep the graph's total equal to the heading's, on the server and in the model. Each rule is tested once, at the layer that owns it. If the wrapper gains the additions listed in `design.md` ("For the owner of the shared chart component"), the reading and its tests move there.

## Bundle

`cd web && npm run build && node scripts/check-bundle.mjs` on the rebased tree, as printed:

```
ok   index-MRI4wFYG.js  109.9 kB gzip  (limit 130 kB)
ok   CostPage-Dnj0h5Sb.js  18.3 kB gzip  (limit 20 kB)
ok   ActivityPage-DVMm-51C.js  23.7 kB gzip  (limit 28 kB)
ok   ErrorsPage-Dy0hThsR.js  21.0 kB gzip  (limit 26 kB)
ok   zoomReset-C2mHne84.js  7.1 kB gzip  (limit 9 kB)
ok   echarts-CZ7cuwNT.js  176.5 kB gzip  (limit 195 kB)
```

`origin/main` built the same way: `index-*.js` 109.9 kB, `CostPage-*.js` 12.1 kB, `ActivityPage-*.js` 23.7 kB, `ErrorsPage-*.js` 21.0 kB, `zoomReset-*.js` 7.1 kB, `echarts-CZ7cuwNT.js` 176.5 kB (the same file). The flow adds 6.2 kB to the Cost chunk, over the plan's 16 to 17.5 kB and under its 20 kB limit; the ECharts chunk did not grow.
