# Proposal

## Why

A design review found two weak spots.

**Cost, tokens view.** The tokens chart stacks each day's tokens by kind. Cache reads are about two thirds of all tokens, so they swamp every other kind. The chart's own hint says so ("Cache reads usually dwarf the rest"). A reader cannot tell whether output grew or shrank. The Tokens and cache drawer lists each kind as a plain `<dl>`. Its main point, that a kind's share of tokens and its share of dollars differ sharply (cache reads are most tokens and a small part of the cost), is buried in two small lines of text per kind.

**Project page.** `/project` is one column of seven full-width blocks. Its Summary, Cost and Sessions blocks repeat the project sheet figure for figure (the eight summary tiles, the change and the models, the eight most expensive sessions). The page decides its state from the usage request alone. While usage loads, a skeleton hides every block. When usage fails, the usage blocks fail and nothing in the layout says the other blocks loaded fine.

## What Changes

- **Share of tokens per day.** In the tokens metric the chart gets a Volume / Share switch. Share draws each day as a 100% stacked bar of the shown kinds, so each kind's daily share can be read. The axis, tooltip, keyboard and screen-reader readouts and the data table follow it. The choice is kept in the browser. The 7-day average and the peak label are left out in Share, since they describe the total.
- **Token share beside dollar share.** The Tokens and cache drawer replaces the `<dl>` with a butterfly chart: for Input, Output (with thinking), Cache write and Cache read, the share of tokens extends left and the share of estimated cost extends right of a center label. A sentence names the kind where the two differ most. A data table holds the exact tokens, cost and both shares. The two cache write lifetimes (5-minute and 1-hour) join into one Cache write row; their token counts stay in the table.
- **Project page, two columns.** On wide screens the left column holds Activity, Cost and Context; the right column holds Errors, Plan limits, Sessions and Session judgments. On narrow screens the blocks stack in the same order.
- **Project page adds depth.** Activity replaces Summary and shows figures the project sheet does not (prompts, commits, active days, requests, median session, cost per prompt, turns per prompt, interrupted prompts). Cost adds the token-share-beside-dollar-share chart for the project.
- **Independent blocks.** The heading, filters and every block render at once. Each block shows its own loading, error with Retry, and empty state. A failed usage request fails only the blocks that read it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cost-dashboard`: the cost-by-token-kind requirement (now paired shares) and a new requirement for the token share scale.
- `project-page`: the summary and cost blocks, the layout, and block loading.

## Impact

- `web/src/pages/cost/`: `CostChart.tsx` (scale switch, share rendering), `CostPage.tsx` (scale state), `cost.ts` (`shares()`, `tokenPairs()`), a new `TokenPairs.tsx` for the butterfly chart and its table, `drawers.tsx` (`TokensDrawer` body only), `cost.css`.
- `web/src/pages/project/`: `ProjectPage.tsx`, `blocks.tsx`, `project.css`.
- Rebuilt `src/ai_ledger/web/`. No payload change, so the fixtures stay as they are.
- Docs: `README.md`, the docs site Cost and Project pages and their screenshots, `CHANGELOG.md`.
- Out of scope: the nav entry for Project (a later change), `PlanGauge`, `Lede.tsx`, `ProjectTable.tsx` and the unpriced text (the `fix-shipped-design-gaps` change owns them).
