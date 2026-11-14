# Proposal

## Why

A Chrome modern-web-guidance audit of the web dashboard (accessibility, CSS and performance) turned up findings, each one checked against the code. The accessibility ones are gaps a keyboard or screen reader user meets: the Refresh button drops focus while it runs, the palette acts on keys meant for an input method, the charts claim roles they do not need, the Live stream is silent about new events, a page has no `<main>` and no skip link, and explanations sit behind `title=` that only a mouse reaches. The CSS ones are contrast and theming gaps: inputs and Live tool text under their contrast minimum, no forced-colors support, three copies of the dark palette. The performance ones are work the page does for nothing: polls in a hidden tab, every row of a stream re-rendered each second, every page and the palette loaded up front, a chart re-rendered whole on each hover.

## What Changes

**Accessibility, components**
- **Refresh** stays focusable while it runs: it is `aria-disabled` and ignores clicks, so focus is not lost.
- The **palette input** ignores Enter, Tab and the arrow keys while an input method (IME) is composing text.
- The palette's "Link copied" message is a polite status. The **Search** button's accessible name includes its visible "Search". Each export button names its table.
- **Escape** dismisses the tooltip of the Cost, Work and Errors-rate charts.
- Interactive chart boxes are a labelled `role="group"`, not `img` or `application`.
- The **Live stream** is a log, with a polite "N new events" status while Follow is off. The Live wall is a list of tiles under `h2` group headings.

**Accessibility, pages**
- Every page's content sits in `<main>`, and a **skip link** is the first focusable element.
- After the user picks a navigation tab, **focus moves to the page heading**.
- Loading states keep `aria-busy` and are not announced through a live region.
- The Cost "+?" chip carries text for screen readers.

**Accessibility, tables and tooltips**
- Explanations that were hover-only `title=` (column headers, filter labels, facets, the Live agent panel) become **toggletips** a keyboard reaches, or visible hints.
- Data tables have an accessible name and `th scope`. Scrollable table wrappers are focusable, named regions.
- A drawer's title is a real heading, not an `h2` inside its `summary`.
- The Cost and Work charts get a **data table** as a text alternative.
- Sheet and insight titles wrap instead of being cut with no way to read the rest.

**CSS and theming**
- Inputs and selects get a border at 3:1 or better against the page, the palette input a focus ring, and Live tool text a darker ink (it was 4.30:1 in light mode).
- A `forced-colors` block keeps pressed, selected and current states and bars visible in Windows high contrast.
- Jumping to a section or focusing a field never leaves it under the sticky navigation and section index.
- Internal: one `light-dark()` token set replaces three duplicated dark blocks; scrim and sheet-shadow tokens replace hard-coded values; unprefixed `line-clamp`; a `--ledger-cols` variable; inline layout styles move to classes.

**Performance**
- Live and the navigation's status poll **pause while the tab is hidden** and fetch again on return. Background polls use fetch priority `low`.
- Live stream rows are memoized, only running rows tick each second, and one cached `Intl.DateTimeFormat` formats times.
- Pages and the command palette load on demand (`React.lazy`).
- Chart hover re-renders only the hover marker (Timeline, Work chart, Cost chart). The Errors page memoizes its context, and a toggle re-renders only its row.
- The landing animation forces no layout per element, the Palette landing observer is scoped to `main`, `SectionIndex` uses an `IntersectionObserver`, and the Errors examples share one `ResizeObserver`.
- Closed drawers do not render their tables, and long lists use `content-visibility: auto`.

Out of scope:
- **Server hardening** is the separate change `harden-local-server`.
- **TanStack migration** is the change `adopt-tanstack`. It absorbs fetch abort, cache eviction and route-level transitions, so this change adds none of them.
- **Follow-up GitHub issues**, not this change: `rem` font sizes, container queries, CSS nesting and `@layer`, dialog animations and view transitions.

## Impact

- `web/src/components/` (`Nav.tsx`, `refresh.ts`, `Filters.tsx`, `Sheet.tsx`, `Drawer.tsx`, `Ledger.tsx`, `ExportButtons.tsx`, `SectionIndex.tsx`, `InsightCard.tsx`, `useLanding.ts`, `facets.tsx`, `palette/`, and their CSS), `web/src/App.tsx` and `main.tsx` (landmarks, skip link, lazy routes), `web/src/pages/` (`cost/`, `activity/`, `errors/`, `live/`, `limits/`, `insights/`), `web/src/theme.css` and `base.css`.
- The build in `src/ai_ledger/web/`, committed with the `web/src` change.
- Tests for the components and pages above, and the page-test fixtures only if a payload changes (none is planned).
- No store or server change.

## Capabilities

### Modified Capabilities
- `dashboard-app`: landmarks, skip link, focus after navigation, Refresh while busy, loading states, toggletips, table names and regions, drawer headings, chart roles and Escape, forced colors, contrast and focus rings, scroll padding, hidden-tab pause of the status poll.
- `live-dashboard`: pause while the tab is hidden, the stream as a log that announces new events, the wall as a list.
- `command-palette`: IME composition, the "Link copied" status, the Search button's name.
- `cost-dashboard`: the chart's data table, the "+?" chip's text.
- `usage-dashboard`: the work chart's data table.
- `errors-dashboard`: the chart box as a labelled group.
- `session-titles`: sheet and card titles wrap.
