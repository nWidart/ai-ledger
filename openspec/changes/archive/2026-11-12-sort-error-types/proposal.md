# Proposal

## Why

GitHub issue #4 (Errors page UX review, one item): "Sortable type table (by change, by didn't-recover, by rate) with a text filter." The type table lists the view's types by error count only. A user cannot bring the types that got worse, or that agents fail to recover from, to the top, nor find a type by name in a long list.

## What Changes

- **Sortable headers.** Every data column of the type table sorts: Type (A to Z first), Errors, Time lost, Rate, Didn't recover, Share and Change. The rate trend does not. The default is Errors, most first. A second click flips the direction; only the sorted header has `aria-sort`; ties keep the default order. The page's `SortTh` and `sortRows` do the work.
- **Two new columns**, each a field of `TypeRow` computed once in `typeRows`. Rate: the type's errors per 100 tool calls in the view. Didn't recover: the percent of the type's incidents whose outcome is not `recovered`, with "N of M incidents" in the title. Both follow the selected chart bucket (the bucket's errors, and for Rate the bucket's calls).
- **Change sorts by its percent.** `Delta` gains the number the cell shows (`pct`). A cell that shows counts or "–" has none and sorts last in either direction.
- **A text filter** in the table card ("Filter types…"): the rows whose label or id contains the text, case-insensitive. "3 of 14 types" shows and is announced. No match shows an empty row with a "Clear filter" button. The filter leaves the summary, the chart, Where to start and the open type alone.
- **Page state.** The sort and the filter text live in the Errors page (like the search `q`), not in the URL and not saved: they survive view changes and the detail moving into the sheet, and reset on reload.
- **Narrow screens.** The new columns stay (their values appear nowhere else); the table scrolls in `.tscroll`, the trend also hides at mid widths, and a sort scrolls the sorted header into view.

Out of scope: saving the sort or filter, sorting the detail's lists, a column chooser, any backend or payload change, any other issue item.

## Impact

- `web/src/pages/errors/` (`model.ts`, `TypeTable.tsx`, `ErrorsPage.tsx`, `context.ts`, `errors.css`, `PARITY.md`), tests, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: the type table sorts, shows Rate and Didn't recover, and filters by name.
