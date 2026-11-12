# Tasks

## 1. Picker search

- [x] 1.1 Add a "Search projects" input to `Filters` for more than 12 projects, narrowing the native select and keeping "All projects" and the selected project, with a "No project matches" status.
- [x] 1.2 Test the narrowing, the kept selection, the restore on clear, the hash update, the no-match state and the absence of the box at 12 projects.

## 2. Small projects bucket

- [x] 2.1 Fold the projects outside `projectMedians(rows).big` into a "Small projects (N)" row in `ProjectCostDrawer` with summed cost, tokens and commits and an `aria-expanded` toggle; fold only for 3+ small and 1+ big; keep big projects first whatever the sort.
- [x] 2.2 Open the bucket for the selected project and the ringed outlier; reset the open state with the view in `CostPage`.
- [x] 2.3 Keep the export on every project in expanded order.
- [x] 2.4 Test the fold and its sums, expand and collapse, a small selected project, fewer than 3 small projects, sort order and the export.

## 3. Verify

- [x] 3.1 Run `uv run ruff check`, `uv run python -m unittest discover -s tests` and `cd web && npm run check`; commit the build.
