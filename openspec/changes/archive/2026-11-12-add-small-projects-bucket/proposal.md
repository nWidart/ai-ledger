# Proposal

## Why

GitHub issue #3 (Cost page UX review, item "Group or hide throwaway projects"): scratch and ad-hoc directories fill the project picker and the Cost by project table, burying the projects that matter.

## What Changes

- **Search the project picker.** When the picker lists more than 12 projects, a "Search projects" box sits next to it and narrows its options to the names containing the typed text (case-insensitive). "All projects" and the selected project always stay listed, clearing the box restores the list, and "No project matches" shows when nothing matches. With 12 projects or fewer the picker is unchanged. The picker stays a native select, so keyboard and screen reader behavior is the browser's own.
- **Small projects bucket.** In Cost by project, projects too small to compare (under 2% of the view's cost and under 10 prompts, the floor the medians already use) fold into one "Small projects (N)" row with their summed cost, tokens and commits, and a button to show or hide them. It folds only with at least 3 small projects and at least 1 big one. The selected project and the outlier ringed by "Compare projects" are never hidden: the bucket opens for them. The open state resets when the view changes, as the sort does.
- **Export** still holds every project, in the order they show expanded.

## Impact

- Frontend only: `web/src/components/Filters.tsx`, `web/src/pages/cost/drawers.tsx`, `web/src/pages/cost/CostPage.tsx`, styles. No payload change, no new dependency.
- The built page in `src/ai_ledger/web/` is rebuilt.
- Stacked on the project table sort and the table export changes.
