# Tasks

## 1. Context menu subjects

- [x] 1.1 Spread `subjectAttrs("session", id)` on the session buttons of `LoopsList` and `TestsList` (`activity/tables.tsx`), SessionMap's quadrant list and PressureBars' band list.
- [x] 1.2 Spread `subjectAttrs("category", c)` on the Applied fixes rows (`errors/Detail.tsx`) and `subjectAttrs("tool", e.t)` on an example's tool button (`errors/Examples.tsx`).
- [x] 1.3 `Compact` takes the grid's project; the compact `ContextGrid` spreads `subjectAttrs("project", project)` on its card. Verify with `ActivityPage`, `SessionMap`, `PressureBars`, `ErrorsPage` and `Grids` tests.

## 2. Stacked bars

- [x] 2.1 WorkChart stacks with `stackHeights()` (1px minimum, 2px gap), as CostChart does. Verify with a `WorkChart.test.tsx` test: 1 commit over 1,000 draws at least 1px.
- [x] 2.2 CacheChart's `stack()` uses `stackHeights()` (2px minimum, 1px gap). Verify with a `CacheChart.test.tsx` test: a full-track stack with thin parts keeps its top at the track's top.

## 3. Project page

- [x] 3.1 The Errors block's Change cell uses `Toggletip` (as Errors' type table), with the dotted underline in `project.css`.
- [x] 3.2 Skip `queries.insights` with the source on Codex alone; the Session judgments block shows no kept figures and no Loading line then.
- [x] 3.3 Add `context.data?.projects` to the scope-bar fallback. Verify 3.1-3.3 with `ProjectPage.test.tsx`.

## 4. Filters and Errors

- [x] 4.1 Filters' project picker, clear button and source segment clear `sheet` too. Verify with a `Filters.test.tsx` test on `/live`.
- [x] 4.2 Drop the rule that hides `.chart-card .hint` under 32.5em in `errors.css`; the narrow-summary test checks no rule hides it.
- [x] 4.3 Drop `RECOVERED_NOTE` from the Incidents vital's note. Verify with `ErrorsPage.test.tsx`.

## 5. Docs and checks

- [x] 5.1 CHANGELOG `[Unreleased]` bullets.
- [x] 5.2 `cd web && npm run check`, Python tests, ruff, `openspec validate --specs --strict` and `openspec validate cross-page-consistency --strict`.
