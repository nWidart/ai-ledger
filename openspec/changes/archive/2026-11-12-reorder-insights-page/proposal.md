# Proposal

## Why

GitHub issue #6 (Insights page review, one item): "Reorder the page: lede, vitals, outcomes and friction, sessions, then goals and session types (collapsed), with a section index like Activity." Today Goals and Session types sit beside Friction, above Outcomes, and the analysed sessions come last. The questions the page answers (did sessions reach their goal, what got in the way) are not first, and there is no way to jump between sections.

## What Changes

- **New order** when the view has figures: lede, vitals, one row of Outcomes and Friction categories, Satisfaction and helpfulness, Analysed sessions, then Goals and Session types.
- **Goals and Session types become drawers**, closed by default, using the shared `Drawer`. Their content is unchanged.
- **A section index** like Activity's, using the shared `SectionIndex`: Overview, Outcomes, Friction, Satisfaction, Sessions, then the drawers Goals and Session types. A jump to a drawer opens it. It is not shown when the page shows no figures.
- Existing ids (`#lede`, `#coverage`, `#friction`, `#outcomes`, `#log`) stay.

Out of scope: any payload or Python change, the content of a section, session rows, filters, any other issue item.

## Impact

- `web/src/pages/insights/` (`InsightsPage.tsx`, `insights.css`, test), `web/src/components/SectionIndex.css` (the index styling also applies to `.pg-insights`), the build in `src/ai_ledger/web/`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: the page order, a section index, and Goals and Session types as closed drawers.
