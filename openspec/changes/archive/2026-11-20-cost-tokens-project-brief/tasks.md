# Tasks

## 1. Cost: figures

- [x] 1.1 In `cost.ts`, add `shares()` (a day's values as fractions of the shown kinds' total, all zero for an empty day) and `tokenPairs()` (Input, Output, Cache write, Cache read with tokens, token share, cost, cost share and the cache write lifetimes, ordered by cost, null cost for an unpriced view). Verify with `cost.test.ts` cases: shares add to 1, hidden kinds leave the total, empty day, ordering, thinking inside Output, 5m and 1h joined, unpriced view.

## 2. Cost: tokens chart Share

- [x] 2.1 In `CostChart.tsx`, add the `scale` and `onScale` props and the "Scale" switch (tokens metric only). Draw Share with the existing bars on a 0 to 100% axis, leave out the average and the peak label, and update the title, hint, accessible name, tooltip, screen-reader text and data table. In `CostPage.tsx`, keep the scale in `localStorage`. Verify with `CostChart.test.tsx` cases for the values, the tooltip and screen-reader readout, hiding a kind, an empty day, and the table.

## 3. Cost: token and dollar share drawer

- [x] 3.1 Add `TokenPairs.tsx`: the butterfly chart, the summary sentence and the data table. Use it in `TokensDrawer` in place of the `<dl>`, keeping the requests figure. Style in `cost.css` for both themes, forced colors and phone width. Verify with `CostPage.test.tsx` cases for the rows' order and shares, the sentence, the table's exact figures and the unpriced view.

## 4. Project page

- [x] 4.1 Replace Summary with Activity in `blocks.tsx`; add the token share chart to Cost. Verify the Activity figures against `totals`.
- [x] 4.2 Rewrite `ProjectPage.tsx` to render the heading, filters and blocks at once, in two columns, with the no-use state only after usage answers; update `useLanding`'s selector and `project.css`. Verify with `ProjectPage.test.tsx` cases for the two columns' blocks, each block failing alone (including usage), a slow block, and the no-use state.

## 5. Docs

- [x] 5.1 Update `README.md`, the docs site Cost and Project pages (with the `doc-coauthoring` skill) and the demo's screenshot panels if they change; regenerate only the Cost and Project screenshots. Add `CHANGELOG.md` `[Unreleased]` entries.

## 6. Review fixes

- [x] 6.1 Cost: the drawer table gives full token counts and dollars to the cent (lifetime rows too); a zero share draws no fill; the chart wraps by its own width (container query on `.tpairs`); the sentence always names the widest gap; a known zero cost reads $0.00 and 0.0%, apart from an unknown one. A thin stacked segment keeps 1px. Verify with `cost.test.ts`, `CostPage.test.tsx` (exact cells, zero cost, close shares) and `CostChart.test.tsx` (segment heights above zero).
- [x] 6.2 Project: the no-use message sits above the blocks and hides none (usage blocks say "No requests in this view."); `aria-busy` and the slow-refresh dimming move from `main` to each block, with the blocks that read usage or Live for a line; the loading line is no live region; Activity says when Live failed, with Retry. Verify with `ProjectPage.test.tsx`: empty usage with a Context snapshot, empty usage with a failed Errors request, per-block `aria-busy`, a failed Live request.
- [x] 6.3 Docs and specs: active days are days with a prompt; the Project and Cost docs pages, `CHANGELOG.md` and both delta specs (cache-read scenario with every kind, exact-number values and precision, partial-day wording by mode, summary and zero-cost rules, no-use and per-block loading against the app-wide rules) follow.

## 7. Final review fixes

- [x] 7.1 Cost: `stackHeights()` gives each stacked segment a slot of at least its 1px and gap, so thin segments do not overlap and the bar keeps its height; the summary sentence treats gaps within 1e-9 as a tie. Verify with `cost.test.ts` (slots), `CostChart.test.tsx` (99.8 / 0.1 / 0.1 extents do not overlap) and `CostPage.test.tsx` (70/30 tokens, 60/40 cost names Input).
- [x] 7.2 Project: Context shows the snapshot without a grid; each block dims while any request it reads is slow and lands (grow, fade) on its own; a filter change keeps the same project's figures (`useKept`); Activity says "Checking for active sessions…" while Live is pending and Retry keeps focus on the line. Verify with `ProjectPage.test.tsx`: snapshot with null shares, slow range change, another project, Refresh with one payload changed, Live pending and Retry.
- [x] 7.3 Specs and docs: the delta states the Cost block's estimated cost as the exception to the sheet rule, the filter-change rule and the new scenarios; the Cost docs say the average and peak are Volume only; the Project docs follow. No Share screenshot: `tools/demo/record.mjs` has no Share step, and adding one means a new recording and regenerated images, beyond this round.

## 8. Verify

- [x] 8.1 `openspec validate --specs --strict`, `openspec validate cost-tokens-project-brief --strict`, `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `cd site && npm run check`.
