# Tasks

## 1. Accessibility, components

- [x] 1.1 Keep the Refresh button focusable while busy: `aria-disabled` instead of `disabled`, and ignore clicks.
- [x] 1.2 Make the palette input ignore Enter, Tab and the arrow keys during IME composition.
- [x] 1.3 Give the palette's "Link copied" message `role="status"`.
- [x] 1.4 Make the Search button's accessible name include "Search".
- [x] 1.5 Name the table in each export button's accessible name.
- [x] 1.6 Dismiss the Cost, Work and Errors-rate chart tooltips with Escape.
- [x] 1.7 Replace `role="img"` and `role="application"` on the interactive chart boxes with a labelled `role="group"`.
- [x] 1.8 Make the Live stream `role="log"` with a polite "N new events" status.
- [x] 1.9 Draw the Live wall as `ul` and `li`, with `h2` group headings.

## 2. Accessibility, pages

- [x] 2.1 Put every page's content in `<main>`.
- [x] 2.2 Add a skip link as the first focusable element.
- [x] 2.3 Move focus to the page heading (`#lede`) after navigation by a nav tab.
- [x] 2.4 Stop announcing loading states through live regions; keep `aria-busy`.
- [x] 2.5 Give the Cost "+?" chip screen-reader text.

## 3. Accessibility, tables and tooltips

- [x] 3.1 Turn hover-only `title=` explanations into keyboard-reachable toggletips or visible hints: column headers, filter labels, facets, the Live agent panel.
- [x] 3.2 Give data tables an accessible name and `th scope`.
- [x] 3.3 Keep drawer titles as real headings: no `h2` inside `summary`.
- [x] 3.4 Add a data-table alternative to the Cost and Work charts.
- [x] 3.5 Make scrollable table wrappers focusable, named regions.

## 4. CSS and theming

- [x] 4.1 Replace the three duplicated dark blocks with one `light-dark()` token set.
- [x] 4.2 Add a `--control-border` token at 3:1 or better and use it for inputs and selects.
- [x] 4.3 Give the palette input a focus ring.
- [x] 4.4 Darken the series-1 text ink so Live tool text reaches 4.5:1 in light mode.
- [x] 4.5 Replace hard-coded scrim and sheet-shadow values with tokens.
- [x] 4.6 Add a `forced-colors` block that keeps pressed, selected and current states and bars visible.
- [x] 4.7 Set one `scroll-padding-top` for the sticky nav and the section index.
- [x] 4.8 Use unprefixed `line-clamp`.
- [x] 4.9 Add a `--ledger-cols` variable for the ledger's columns.
- [x] 4.10 Let sheet and insight titles wrap instead of truncating.
- [x] 4.11 Move inline layout styles to classes.

## 5. Performance

- [x] 5.1 Pause Live and the nav status poll while the tab is hidden, and refetch on return.
- [x] 5.2 Send background polls with fetch priority `low`.
- [x] 5.3 Memoize Live stream rows, tick only running rows each second, and use one cached `Intl.DateTimeFormat`.
- [x] 5.4 Load pages and the command palette on demand with `React.lazy`.
- [x] 5.5 Re-render only the hover marker on chart hover: Timeline, Work chart, Cost chart.
- [x] 5.6 Memoize the Errors page context so a toggle re-renders only its row.
- [x] 5.7 Run the landing animation without a forced layout per element.
- [x] 5.8 Scope the Palette landing observer to `main`.
- [x] 5.9 Use an `IntersectionObserver` in `SectionIndex`.
- [x] 5.10 Share one `ResizeObserver` across the Errors examples.
- [x] 5.11 Do not render the tables of closed drawers.
- [x] 5.12 Apply `content-visibility: auto` to long lists.

## 6. Docs and verify

- [ ] 6.1 Add the user-visible changes to `[Unreleased]` in `CHANGELOG.md`.
- [ ] 6.2 Update `README.md` where behavior a user sees changed.
- [ ] 6.3 Regenerate the page-test fixtures with `uv run python -m unittest tests.test_web_fixtures` if a payload changed.
- [ ] 6.4 Run `cd web && npm run check`, `uv run python -m unittest discover -s tests` and `openspec validate --all --strict`; commit the build in `src/ai_ledger/web/`.
