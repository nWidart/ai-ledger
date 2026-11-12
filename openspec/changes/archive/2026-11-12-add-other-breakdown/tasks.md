# Tasks

## 1. Data

- [x] 1.1 `costDays` fills `other` on each day when Other is stacked: the projects not named in the stack with a cost above zero, costliest first; a project with no name is "(no project)". Verify: `web/src/pages/cost/cost.test.ts`.

## 2. Chart

- [x] 2.1 The cost tooltip lists the top three of the day's Other under its row, then "+ N more" when there are more. Verify: `web/src/pages/cost/CostChart.test.tsx` (top three and "+ 1 more").
- [x] 2.2 The day's screen-reader text carries the same list in the Other part. Verify: `web/src/pages/cost/CostChart.test.tsx`.
- [x] 2.3 Style the Other rows in `cost.css`.

## 3. Checks

- [x] 3.1 `cd web && npm run check` passes, and the build in `src/ai_ledger/web/` is committed.
- [x] 3.2 `CHANGELOG.md` `[Unreleased]` names the change.
