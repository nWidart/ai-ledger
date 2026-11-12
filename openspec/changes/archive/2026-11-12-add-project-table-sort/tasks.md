# Tasks

## 1. Median helper

- [x] 1.1 Add `projectMedians` to `insights.tsx`: the comparable projects (2% of cost or 10 prompts), the cache-hit, per-prompt and per-commit medians over them, none under 3 projects. Use it in both insights and the table.

## 2. Sortable table

- [x] 2.1 Sort every column of `ProjectCostDrawer` with `SortTh` and `sortRows`, cost highest first by default. Fold "Compare projects" into it, and reset the sort with the view.
- [x] 2.2 Untint projects below the floor and name the median's projects in the tone key.

## 3. Verify

- [x] 3.1 Add page tests for sorting, n/a last, "Compare projects", and tinting against the real projects. Run `uv run ruff check && uv run python -m unittest discover -s tests && (cd web && npm run check)`.
