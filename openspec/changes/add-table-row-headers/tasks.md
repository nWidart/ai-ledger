# Tasks

## 1. Row headers

- [x] 1.1 List every `Table` under `web/src` with no row header (verify: each column list checked for `rowHeader: false` with no other header column).
- [x] 1.2 Make the session cell the row header of Error loops and Failed test runs (verify: page test finds one `th[scope=row]` per row, holding the session).
- [x] 1.3 Make the Window cell the row header of Closed windows (verify: page test finds one `th[scope=row]` per row, holding the window name).
- [x] 1.4 Make the Type cell the row header of Error types (verify: page test finds one `th[scope=row]` per row, holding the type).
- [x] 1.5 Keep the look: the new header cells get the same weight, size, color, padding, alignment and wrapping as the data cells they replace (verify: CSS rules read against the replaced `td` rules; `web/src/css.test.ts` green).

## 2. Checks and notes

- [x] 2.1 Update the tests that assert these cells are `td` and add a row header test per table (verify: `cd web && npm run check`).
- [x] 2.2 Add a line to `CHANGELOG.md` under `[Unreleased]`; check `README.md` and `site/` for text this makes wrong (verify: diff read).
- [x] 2.3 Run `uv run python -m unittest discover -s tests`, `openspec validate --specs --strict` and `openspec validate add-table-row-headers --strict` (verify: all pass).

## Workflow follow-up

- Archive the change after its PR merges.
