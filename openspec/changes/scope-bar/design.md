# Design

## Context

Each page renders `<Filters>` in its header with its own flags: which filters it shows (`project`, `range`, `source`, `automated`) and the project list for the picker, which comes from the page's payload (Errors labels each project with its error count). The `regroup-nav-and-judgments` change set the rule that a page shows only the filters that change it. Cost and the Judgments view also mount `SectionIndex`, a sticky row of section links under the nav that sets `--secidx-h` for the scroll padding.

## Goals / Non-Goals

**Goals**

- The filters are in the same place on every page and in the same tab position.
- At most two bars stick to the top: the nav and the scope bar.
- The first screen loses no chart.

**Non-Goals**

- No new filter and no change to what a filter does, to its URL key or to the filter rules per page.
- No change to section-level controls (Limits' range, Errors' Day / Week and toggles, Cost's plan gauge).
- No replacement for the section index.

## Decisions

### The shell owns the bar; the path decides its filters

`App` mounts `<ScopeBar />` between `<Nav />` and the page. Which filters it shows is a pure function of the path and Activity's view, `scopeOf(path, judgments)`: Live has no range, Limits the source only, Errors no automated toggle, the Judgments view no source, every other page all four. Judgments is "`view=judgments` and not Codex alone", as `ActivityPage` decides it.

- *Why not let each page portal its own `<Filters>` into the bar?* The bar would be empty while a page's chunk or first request loads, then fill: the page would jump on every page switch. From the path, the bar is right from the first frame and keeps its height across pages.
- *Cost:* the rule "a filter shows only where it changes the page" now lives in one table, next to the bar, rather than in each page's props. That is where a reader looks for it.

### Pages hand over their project list

The picker's list still comes from the page's payload. A page calls `useScopeProjects(list)`: a small module store that the bar reads with `useSyncExternalStore`. The page sets it while mounted and clears it on unmount. The store compares the list by content, since pages build a new array on every render. Until the page has data, the picker lists the URL's project only, as it did before when a page had no payload.

- *Alternative: a new `/api/projects` endpoint for the bar.* It would lose Errors' per-project labels and Live's "projects running now", and add a request to every page.

### Brief, the project's link

`BriefLink` renders "Brief →" with a project picked, on every page with a project picker except the Project page. Its name is "Brief, <project> project page": it starts with the visible word and says where it goes. It is the bar's last control, after the automated toggle, pushed to the row's end. The narrow bar shows it beside the Filters button.

### Two bars, one height

The nav keeps `--appnav-h`. The bar sets `--scope-h` from a `ResizeObserver`, and `0px` when it unmounts. `base.css` adds `--bars-h: calc(var(--appnav-h) + var(--scope-h))`, and the scroll padding, Errors' type list, type header and example bar, and Live's fit-the-viewport height all use it. The bar is `position: sticky; top: var(--appnav-h)` as a sibling of the nav, so each is its own stuck element. A wrapper holding both would count as one, and the browser check could not tell a third bar from a wrapper.

The section index goes. Its sections keep their `h2` headings and ids, and `jumpTo` (now in `Drawer.tsx`) still serves the actions that open a drawer, such as the Judgments coverage link and Context's tip links. The index's mobile "Jump to" select goes with it. The palette lists no sections, so nothing moves there.

### Narrow: one button

Up to 56em (`matchMedia` in `ScopeBar.tsx`, the same step in `ScopeBar.css`), the bar renders a Base UI Popover trigger, "Filters", with a count badge of the shown filters off their default (project set, range other than 30 days, a source, automated on). Its name says the count ("Filters, 2 filters set"). The popup holds the same `<Filters>`, one per line. It is not modal: a filter change keeps it open and focus on the control, and Escape or a click outside returns focus to the button. Only one of the two forms is rendered, so the filter ids (`fProject`, `fRange`, `fSource`, `fAuto`) stay unique.

The step is where the wide row stops fitting. All four filters with Brief take about 1,010 px. Under 64em the "sessions" of "Include automated sessions" goes, and the project field can shrink to 8rem, so the row fits down to 56em. The popover's positioner sits at the project list's z-index (30), so the project list, portaled after it, opens over it.

### The first screen

The bar uses compact controls (5 px vertical padding, 0.8125rem), as the nav does, for a 41 px bar. `.wrap` top padding drops from 20 px to 12 px: the bar's border already marks the page's start. Activity's lede may now take 50ch, since its header has the whole row, so the all-time lede fits on one line. Live's stream page trims its top padding, toolbar margin and bottom padding so the rail keeps 8 sessions in 5 groups without scrolling at 1440×900.

Measured on the demo store at 1440×900 with `firstscreen.mjs` (before → after):

| Page | Before | After |
|---|---|---|
| Activity, 30 days: tab list ends | 888 px | 878 px |
| Activity, all time: tab list ends | 869 px | 859 px |
| Context: first plotted mark starts | 502 px | 534 px |
| Cost: daily chart starts | 519 px | 415 px |
| Errors: rate chart card starts | 443 px | 463 px |
| Limits: first window chart starts | 353 px | 386 px |
| Judgments: Outcomes starts | 578 px | 554 px |
| Live: first stream event starts | 278 px | 302 px |
| Live: rail height (8 sessions need 754 px) | 771 px | 756 px |

Cost and the Judgments view gain the most: their section index and stacked header filters are gone.

### Checks

- `tools/demo/sticky.mjs` loads every page and the Judgments view at 1440×900 and 390×844, scrolls, and counts elements that are sticky or fixed, stuck at their `top`, and at least 60% of the window wide. It fails above two, if the scope bar is not right under the nav, if the narrow bar is taller than the nav, or on sideways scroll. It then opens a type on Errors and checks that the type header sticks at the bars' bottom and the example bar at the header's. Errors' header and example bar are half the window wide at 1440, so they are not page bars.
- jsdom tests cover the filters per page (`Filters.test.tsx`, `ScopeBar.test.tsx`), Brief, focus and URL keys on change, the narrow count, the tab order through the shell, no section index on Cost and Judgments, and the CSS offsets (`theme.test.ts`).

## Risks / Trade-offs

- **Less room for the page under two sticky bars.** The bars take 89 px at 1440 and 92 px at 390, against 48 px and 51 px before on most pages, and 89 px on Cost and Judgments with their section index. The compact bar, the narrower page padding and the header room the filters left pay most of it back on the first screen.
- **Live is at its limit.** The rail fits 8 sessions with 2 px to spare at 1440×900 (17 px before). `livefit.mjs` checks it.
- **The section index helped on long pages.** Cost and the Judgments view are long. Their sections keep headings, which screen readers list, and drawers open from their actions. If users miss the index, a non-sticky one can come back in a later change.
