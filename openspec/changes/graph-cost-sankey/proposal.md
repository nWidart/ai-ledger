# Proposal

## Why

Cost answers "what did this period cost" and "why did it change". It answers "where does my money go" only in pieces: the daily chart stacks by project or by model, one at a time; the project table splits by project; Models and effort splits by model; the Tokens and cache drawer splits by token kind for the whole view. No figure on the page says how much of one project's spend went to one model, or what that model's spend was made of. A reader who wants to cut cost has to join three tables in their head.

A flow diagram is the form readers know for that question: the money enters on the left, split by project, crosses to the models it bought, and ends in the token kinds it paid for, each band as wide as its cost. A design round proposed it as "Token and cost flow Sankey" on Cost, drawn with Apache ECharts 6.1.0. This change plans it.

## What Changes

- **New section on Cost: "Where the cost goes".** Three columns, project, model and token kind; each band is as wide as its estimated cost in dollars. It sits after the project table, before the insights and Models and effort.
- **It follows the page's range, project, source and automated filters**, like every figure on Cost. Its total is the page's total, to the cent.
- **One project selected: two columns**, model and token kind. A single project column would be one bar of 100% that the heading already names.
- **The token kinds are the four the Tokens and cache drawer bills**: Input, Output + thinking, Cache write and Cache read, and a fifth, "Reported", for the cost an agent reported with no split by kind (Grok's today), so the kinds add up to the total.
- **Small projects and models fold into Other**: each column keeps its five costliest names of at least 1% of the cost, and Other holds the rest, at every width.
- **Unpriced usage is named, not drawn**: a line under the graph names the unpriced models and their requests, the graph's label says how many requests are not drawn, and the total in How measured carries the page's "+?" chip.
- **Reading along the bands.** Up and Down move within a column, Right and Left follow a band out of a node and on to the next node, Home and End go to the ends. The pointer reads the node or band under it. One tooltip and one polite sentence give its cost and shares. Enter or a click on a project opens its project sheet, as the project table does.
- **A data table with every flow**, unfolded, to the cent: every project and model pair, $0.00 ones too, and every model and kind with a cost.
- **Forced colors, dark, text size, reduced motion.** Under forced colors the bands are outlines in the system text color and the item read is marked in the system highlight color. The drawing never animates; the section fades in with the page's other panels, unless reduced motion is on. The labels grow with the text and the graph grows taller; a column whose labels have no room is named in a key under the graph.
- **The usage payload gains `cost_flow`**: the cost per project and model, and per model and token kind, from one grouped query over the same requests as every other cost figure.
- **No change to the daily chart, the project table, the Tokens and cache drawer, Models and effort, or the shared chart component.** No ECharts part is registered.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cost-dashboard`: Cost gains the flow section, its columns, fold, kinds, unpriced line, reading, project sheet, fit and table, and the usage payload's `cost_flow`.
- `dashboard-app`: a drawn chart of nodes and bands is read along its bands and marks the item read on its own shape; under forced colors its bands are outlines. Both are added requirements: no existing requirement of `dashboard-app` is modified, so this change does not collide with the chart migrations in progress.

## Impact

- **Server.** `src/ai_ledger/metrics.py`: `usage()` gains `cost_flow`, one `GROUPING SETS` query. No stored data changes, no `rebuild`.
- **Web.** A new folder `web/src/pages/cost/flow/`: the pure model, layout and option, the reading rule, the component and its styles. `web/src/api.ts` gains the payload type. `CostPage.tsx` renders the section. The Cost chunk grows from 12.1 kB to 18.2 kB gzip, under its 20 kB limit.
- **Shared chart component.** Not edited. `web/src/components/echart/echarts.ts` is not edited: the graph draws with the custom series already registered. The ECharts chunk stays at 176.5 kB gzip.
- **Dependencies.** None added.
- **Tests.** Python tests on `usage()`; tests of the pure model, layout, option and reading rule; component tests on the fake runtime; one smoke test on real ECharts; one Cost page test. The generated usage fixtures change.
- **Tooling.** `tools/demo/chartfit/flow.mjs` and its name in the runner. `web/scripts/check-bundle.mjs` keeps its limits.
- **Images and docs.** A new `cost-flow` shot; `CHANGELOG.md`, the Cost row of `README.md`, and the docs site's Cost, keyboard and glossary pages.
- **Open to the owner.** Two questions at the end of `design.md`, and three wrapper additions that would let this graph drop its own reading code ("For the owner of the shared chart component").
