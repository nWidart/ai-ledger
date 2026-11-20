# Design

## Context

`Drawer.tsx` keeps the ids of open drawers in `localStorage` (`claude-usage-open`), one list for every page. `SessionsDrawer` reads it through `savedOpen` to decide whether to fetch. `openDrawer(id)` opens a drawer by id through a module-level map of mounted drawers. Section-index links, the Activity attention actions, Cost actions and the Context tip link all go through it.

`Toggletip` is a Base UI popover with a visible label option, hover opening and a polite live region for screen readers.

## Decisions

- **One open drawer, kept in the drawer registry.** The registry map that `openDrawer` uses also gets each drawer's close function. When a drawer opens, it closes every other registered drawer. Only one page is mounted at a time, so the registry is the page's drawers. No context provider is needed. A drawer that closes calls its own `onToggle(false)`, so the Context tip drawer still clears the tip from the URL when another drawer replaces it.
- **No persisted state.** Drawers start closed. A key left in `localStorage` by an earlier version is ignored, not deleted; it is harmless.
- **How measured is a Toggletip.** A popover keeps the hint to one line and costs no height. A `<details>` element would push the page down when open and needs its own styles. `HowMeasured` passes the label "How measured" and an accessible name that says which section it explains.
- **Activity order.** The attention summary stays directly under the lede, as the spec requires. The work chart moves above the vitals, so the chart starts inside the first screen.
- **Prompts by hour in a drawer, not removed.** The heatmap filters nothing, so it leaves the default flow, but its figures stay one click away and the spec keeps its keyboard rules.
- **Contributors absorbs the per-tool tables.** It gains Calls and Largest columns, so dropping `FillTable` loses no figure. Sorting uses `sortRows` and `SortTh`, as Activity's tables do. The top ten and the Other row follow the current sort.

## Risks / Trade-offs

- Users who kept a drawer open now have to open it again on each load. This is the point of the change.
- Method text behind a popover is less visible. Each hint keeps one line that says what the figure is.
