# Design

## Context

`CostChart.tsx` draws the tokens metric as a stacked daily bar of the six token kinds, in the same SVG as the cost metric. `TokensDrawer` (`drawers.tsx`) shows four vitals and then a `<dl>` with one entry per billed kind: cost, share of cost, tokens and share of tokens.

`ProjectPage.tsx` starts six requests (usage, errors, context, insights, limits, live) and passes each state to a block. `Block` already handles one request's loading and failure. The page still reads `usage` for the skeleton, for the "no use in this view" state and for the filters' project list, and every block sits as a direct child of `main`, in one column.

No payload change is needed. Both parts read data that is already in the usage payload.

## Goals / Non-Goals

**Goals:**
- Read each token kind's daily share, with the same keyboard, screen-reader and table support as the other modes.
- Show a kind's token share and dollar share side by side.
- A two-column Project page that adds figures the sheet does not show.
- A request that fails or is slow affects its own block only.

**Non-Goals:**
- The Project page in the navigation.
- New endpoints, new payload fields, new chart helpers or palette tokens.
- The plan gauge, the cost heading and the project table.

## Decisions

**Share is a scale of the tokens metric, not a third metric.** The metric switch stays Cost | Tokens. Under Tokens a second switch, "Scale", offers Volume | Share, as "Stack by" does under Cost. It is kept in `localStorage` like the metric and the stack. *Alternative:* a third metric button. Rejected: Share is the same data on another scale, and it would make "Chart metric" mix units and scales.

**Share reuses the bars.** `shares()` in `cost.ts` turns a day's values into fractions of the shown kinds' total. The bar code already draws any value against `a.yMax`, so Share passes the fractions and an axis of 0 to 100%. `dayAxis` rounds its maximum up to a nice step, so the share axis overrides `yMax`, `step` and `y` on the returned axis rather than changing the shared helper. Hidden kinds leave the total, so the bar always reaches 100% while any kind shows. A day with no tokens has no bar.

**Share leaves out the average and the peak.** Both describe the day's total, which a 100% bar does not show. The hint and legend drop them. The tooltip, the screen-reader text and the data table give each kind's share and the day's total tokens, so the volume is not lost.

**The butterfly is HTML and CSS, not SVG.** It has four rows and two bars each. A grid of divs with the label in the middle column is simple, wraps on phones (label above two bars), and reuses the ledger's bar style (`--track` behind a filled `span`). The bars use the existing series colors, which meet 3:1 on the surface in both themes (see `theme.css`). Each side is its own 0 to 100% scale, so equal bar lengths mean equal shares. Every share is also text beside its bar, so color and length are never the only carrier. In forced colors the bars keep their own colors inside a `CanvasText` outline, as the plan gauge and the project table's change bars do.

**Four kinds, not five.** Input, Output (with thinking, as billed), Cache write, Cache read. The 5-minute and 1-hour cache writes are priced differently but a reader comparing token share with dollar share wants one cache write row. Their token counts and costs stay in the table as a note on the row. The kind order is by cost, biggest first, as before; an unpriced view orders by tokens.

**Exact numbers sit in a table under the chart,** in the same "Show data table" disclosure as the daily chart. The visual rows are `aria-hidden`; the table is the accessible reading. A one-sentence summary above the chart ("Cache read is 66.7% of tokens and 5.1% of estimated cost.") is live text for everyone.

**The Project page keeps the blocks, changes the frame.** `ProjectPage` renders its heading and filters at once from the URL's project, and the blocks in two column `div`s inside one wrapper. `Block` already isolates a request. The page-level skeleton is removed; each block says "Loading…". The only page-level state left is "no use in this view", which needs a usage answer, so it shows only when usage succeeded with no request. A failed usage request leaves the usage blocks in their error state and the rest working. The filters' project list falls back to another payload's `projects` while usage is missing.

**Activity replaces Summary.** The eight tiles repeated the sheet's. Activity shows eight others from the same `totals`: prompts, commits, active days, requests with the main-thread count, the median session, cost per prompt, turns per prompt and the interrupted share. The block's link still goes to Activity. *Alternative:* keep Summary and drop it from the sheet. Rejected: the sheet is the quick look; the page is the one that should go deeper.

**Cost adds the token-share chart.** The Cost block shows the change, the models by cost and the same butterfly chart as the drawer, built from the project's own `totals`. One component serves both places.

## Checked, not changed: the plan gauge

A review claimed the plan gauge compares Codex-only data with the Claude plan. It does not. `gaugeFigures()` (`cost.ts`) counts only the agents with a listed plan (`run_rate.by_source` filtered by `plans[].provider`), takes the plan price from those plans alone, and names the counted agents when another agent also spent. `cost.test.ts` covers one plan, two plans, an uncovered agent and no plan. `view_plans()` lists a provider's plan only from that provider's own limit snapshots, so a Codex-only view never gets the Claude plan. No change is made.

## Risks / Trade-offs

- [Merging 5m and 1h cache write hides the lifetime split in the drawer] → The table keeps both counts and costs; the vitals above still give the 1-hour share.
- [`ProjectPage` tests and the spec's "same figures as the sheet" scenario change] → The Activity block's figures are checked against `totals`; the shared tiles' format helper `Facts` stays shared.
- [A usage failure now leaves a Project page with a heading and no project list in the picker] → The picker falls back to `projects` from the other payloads.
- [`fix-shipped-design-gaps` edits neighbouring files] → This change touches none of `Lede.tsx`, `ProjectTable.tsx`, the unpriced text in `drawers.tsx`, or the shared components.
