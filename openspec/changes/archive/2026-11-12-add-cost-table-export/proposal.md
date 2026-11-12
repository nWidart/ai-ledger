# Proposal

## Why

GitHub issue #3 (Cost page UX review, item "CSV or copy export"): the project and session tables are the figures people take into expense reports and month comparisons, and today they can only be read on screen.

## What Changes

- **Download CSV.** "Cost by project" and "Most expensive sessions" each get a "Download CSV" button above the table. The file holds exactly the rows the table shows, in the order shown, with the same figures rounded to 4 decimals. Empty cells stand for values the table shows as n/a or –. Files are named `ai-ledger-cost-projects-<date>.csv` and `ai-ledger-cost-sessions-<date>.csv`; the sessions file uses the selected day's date when a day is selected.
- **Copy.** A "Copy" button on each table puts the same rows on the clipboard as tab-separated text, which pastes into a spreadsheet as columns. The label reads "Copied" (or "Copy failed") for about 2 seconds, announced politely.
- **Formula safety.** Text cells that start with `=`, `+`, `-` or `@` get a leading apostrophe in both formats, so a spreadsheet does not run them as formulas.
- The buttons are hidden when the table has no rows. Sorting, tinting and the columns are unchanged.

## Impact

- Frontend only: `web/src/components/export.ts` (CSV, TSV, download, clipboard), `web/src/components/ExportButtons.tsx`, `web/src/pages/cost/drawers.tsx`. No payload change, no new dependency.
- The built page in `src/ai_ledger/web/` is rebuilt.
