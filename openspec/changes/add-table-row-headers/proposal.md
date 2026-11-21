# Proposal

## Why

Four tables have no row header: every cell is a plain data cell. A screen reader user who moves down a column hears each value with no name for its row. The tables are Activity's "Error loops" and "Failed test runs", Limits' "Closed windows" and Errors' "Error types".

## What Changes

- Every data table row has a row header cell scoped to the row. The spec states this in "Name data tables and their headers".
- Error loops and Failed test runs: the session cell is the row header. The first column ("When") stays a data cell.
- Closed windows: the Window cell is the row header.
- Error types: the Type cell is the row header.
- The new header cells look exactly like the data cells they replace.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: "Name data tables and their headers" requires a row header in every data table row.

## Impact

- `web/src/pages/activity/tables.tsx`, `web/src/pages/limits/LimitsPage.tsx`, `web/src/pages/errors/TypeTable.tsx` and the CSS that styles these cells.
- Page tests that assert these cells' markup.
- No payload or API change.
