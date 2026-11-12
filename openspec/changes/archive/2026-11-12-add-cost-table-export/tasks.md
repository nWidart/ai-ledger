# Tasks

## 1. Export helpers

- [x] 1.1 Add `toCsv`, `toTsv`, `download` and `copyText` in `web/src/components/export.ts`, with RFC 4180 quoting, CRLF for CSV, LF for TSV, and the formula guard on text cells.
- [x] 1.2 Unit-test quoting, null cells, plain numbers, the formula guard and line ends in `export.test.ts`.

## 2. Buttons in the cost drawers

- [x] 2.1 Add `ExportButtons` with "Download CSV" and "Copy", the 2-second "Copied" or "Copy failed" label and an `aria-live="polite"` status.
- [x] 2.2 Export the sorted project rows in `ProjectCostDrawer` and the shown session rows in `TopSessionsDrawer`, with the day's date in the sessions file name when a day is selected. Hide the buttons when there are no rows.

## 3. Verify

- [x] 3.1 Add page tests: the downloaded project CSV follows the sorted order, Copy writes tab-separated text and shows "Copied", no buttons without rows, and the session CSV.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests` and `cd web && npm run check`; commit the build.
