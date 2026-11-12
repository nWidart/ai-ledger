# Proposal

## Why

Opened from "What changed", the project sheet shows only the project's current totals. The reader who clicked a project because its cost moved has to go back to the panel to see by how much, and cannot see on which days it moved (GitHub issue #3).

## What Changes

- The project sheet gains a "Change vs the previous N days" block when the view has a previous period and the project has usage in either period: the previous cost, this period's cost, the change with its sign, a "new" mark when the project had no usage before, and a daily cost sparkline over both windows with the split marked.
- An unknown cost (a period with only unpriced models) reads "–" with no change, as in What changed.
- The block shows however the sheet was opened, on Activity and Cost alike. The all-time view has no block.
- The sparkline is the one in the Cost page's lede, moved to `components/Spark.tsx` so both share it.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: the project sheet's change block.

## Impact

Web only. The sheet fetches the project's own usage payload, whose `previous`, `daily` and `changes` are already scoped to the project, so the backend needs no new field.
