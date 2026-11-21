# Proposal

## Why

A design re-review of `main` at 011c938b found places where one page does what the others do not: session, tool, type and project controls the context menu does not know, two stacked charts that skip the shared stacker, a hover-only title on the Project page, a request the Project page makes for nothing, a filter change that leaves Live's sheet open, and an Errors hint and note that differ from the rest.

## What Changes

- **Context menu.** The session buttons of Activity's Error loops and Failed test runs, Context's quadrant list and window pressure list, the rows of Errors' Applied fixes, an Errors example's tool name and Context's small window grids carry their subject, as `sessionLink()` and the other rows do.
- **Stacked bars.** Activity's work chart and Context's cache chart stack with the shared `stackHeights()`: a thin segment keeps its minimum, and a stack stays its own height.
- **Project page.** The Errors block explains a type's change in a toggletip, not a hover title. With the source on Codex alone the page asks for no judgments. The scope bar's picker also falls back to Context's projects.
- **Filters.** Picking or clearing a project, or picking a source, closes Live's session sheet (`sheet`) too.
- **Errors.** The rate chart's hint shows on a phone. The Incidents vital no longer repeats what recovered means.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `context-menu`: more places that show subjects.
- `usage-dashboard`: a thin work chart segment stays visible.
- `context-dashboard`: the cache chart's stacks stay in their tracks.
- `project-page`: change toggletip; no judgments request on Codex alone; picker fallback.
- `dashboard-app`: filter changes close Live's session sheet.
- `errors-dashboard`: chart hint at every width; recovered explained once.

## Impact

Web only: `web/src` components, pages and tests. No payload or API change.
