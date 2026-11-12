# Proposal

## Why

GitHub issue #3 (Cost page UX review). The "Cost by project" table sorts only through "Compare projects", and its medians cover every project. In a real store many one-prompt scratch projects with near-zero cost pull the per-prompt and per-commit medians down, so every real project is tinted "worse". The two cost-per-commit insights and the table also took their median over different sets of projects.

## What Changes

- **Sortable table.** Every column of "Cost by project" sorts by click or keyboard, with `aria-sort`, cost highest first by default. Projects with no value (n/a) come last in either direction. The sort resets when the view changes.
- **"Compare projects" folds into it.** It sorts by cost per commit, highest first, rings the outlier and shows the note; the note's button returns to the default sort. Sorting another column drops the ring and the note.
- **Median floor.** The cache-hit, per-prompt and per-commit medians cover only projects that hold at least 2% of the view's estimated cost or have at least 10 prompts (per-commit keeps its 3+ commits rule). Smaller projects show their values untinted. The tone key says which projects the median covers and how many. Fewer than 3 such projects: no tinting.
- **One median per commit.** The Biggest spender insight, the Cost-per-commit insight and the table take the median cost per commit from one helper, over the same comparable projects.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: "Show cost per outcome" says which projects the median covers; new requirement "Sort cost by project".

## Impact

- `web/src/pages/cost/` (`drawers.tsx`, `insights.tsx`, `CostPage.tsx`, tests), `web/src/components/tone.tsx` (an optional note on the key). No payload change.
