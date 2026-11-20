# Tasks

## 1. Shared

- [ ] 1.1 In `Drawer.tsx`, drop the `localStorage` list and `savedOpen`; start every drawer closed. Register each drawer's close function, and close the others when one opens. Make `SessionsDrawer` start closed. Verify with `Drawer.test.tsx`: a reload starts closed, opening one closes the other, `openDrawer` closes the other.
- [ ] 1.2 Add `components/HowMeasured.tsx`, a `Toggletip` labelled "How measured". Verify with a test that its text shows on activation.

## 2. Activity

- [ ] 2.1 Lede: commits from prompts with the commits change. Add a Sessions vital (sessions, change, active days and projects). Move turns and tool calls per prompt into the Prompts interrupted note. Drop the sub line.
- [ ] 2.2 Order: lede, attention, work chart, vitals, drawers. Move `WorkHours` into a closed "Prompts by hour" drawer.
- [ ] 2.3 Sessions drawer: the counting rule behind How measured. Update `ActivityPage.test.tsx`.

## 3. Context

- [ ] 3.1 Lede: median start and window share. Method text behind How measured. Growth vitals show sessions compacted.
- [ ] 3.2 Tips as compact cards in a grid; the rules note behind How measured.
- [ ] 3.3 Hints of Starting, Growth, Pressure, Fills, Cost and the drawers cut to one line with How measured.
- [ ] 3.4 Drop the By tool and By MCP server tables. Contributors: Calls and Largest columns, sortable columns, "Show all N". Update `Contributors.test.tsx` and `ContextPage.test.tsx`.

## 4. Errors

- [ ] 4.1 Lede: failed calls and rate. Vitals: Change, Incidents, Top type, Fixes applied. Update `ErrorsPage.test.tsx`.

## 5. Insights

- [ ] 5.1 Judged tag in the heading only. Drop the Sessions analysed vital; orphans move to the coverage line. Sub line and family hint method text behind How measured. Update `InsightsPage.test.tsx`.

## 6. Verify and document

- [ ] 6.1 Update `LimitsPage.test.tsx` to open drawers by clicking.
- [ ] 6.2 `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`, `openspec validate --specs --strict`; commit the rebuilt `src/ai_ledger/web/`.
- [ ] 6.3 Measure screens and words per page on the demo store, before and after.
- [ ] 6.4 Update `README.md`, the docs site and `CHANGELOG.md` `[Unreleased]`.
