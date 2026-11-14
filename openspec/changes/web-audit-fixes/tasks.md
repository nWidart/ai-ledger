# Tasks

## 1. Accessibility, components

- [ ] 1.1 Keep the Refresh button focusable while busy: `aria-disabled` instead of `disabled`, and ignore clicks.
- [ ] 1.2 Make the palette input ignore Enter, Tab and the arrow keys during IME composition.
- [ ] 1.3 Give the palette's "Link copied" message `role="status"`.
- [ ] 1.4 Make the Search button's accessible name include "Search".
- [ ] 1.5 Name the table in each export button's accessible name.
- [ ] 1.6 Dismiss the Cost, Work and Errors-rate chart tooltips with Escape.
- [ ] 1.7 Replace `role="img"` and `role="application"` on the interactive chart boxes with a labelled `role="group"`.
- [ ] 1.8 Make the Live stream `role="log"` with a polite "N new events" status.
- [ ] 1.9 Draw the Live wall as `ul` and `li`, with `h2` group headings.

## 2. Accessibility, pages

- [ ] 2.1 Put every page's content in `<main>`.
- [ ] 2.2 Add a skip link as the first focusable element.
- [ ] 2.3 Move focus to the page heading (`#lede`) after navigation by a nav tab.
- [ ] 2.4 Stop announcing loading states through live regions; keep `aria-busy`.
- [ ] 2.5 Give the Cost "+?" chip screen-reader text.

## 3. Accessibility, tables and tooltips

- [ ] 3.1 Turn hover-only `title=` explanations into keyboard-reachable toggletips or visible hints: column headers, filter labels, facets, the Live agent panel.
- [ ] 3.2 Give data tables an accessible name and `th scope`.
- [ ] 3.3 Keep drawer titles as real headings: no `h2` inside `summary`.
- [ ] 3.4 Add a data-table alternative to the Cost and Work charts.
- [ ] 3.5 Make scrollable table wrappers focusable, named regions.

## 4. CSS and theming

- [ ] 4.1 Replace the three duplicated dark blocks with one `light-dark()` token set.
- [ ] 4.2 Add a `--control-border` token at 3:1 or better and use it for inputs and selects.
- [ ] 4.3 Give the palette input a focus ring.
- [ ] 4.4 Darken the series-1 text ink so Live tool text reaches 4.5:1 in light mode.
- [ ] 4.5 Replace hard-coded scrim and sheet-shadow values with tokens.
- [ ] 4.6 Add a `forced-colors` block that keeps pressed, selected and current states and bars visible.
- [ ] 4.7 Set one `scroll-padding-top` for the sticky nav and the section index.
- [ ] 4.8 Use unprefixed `line-clamp`.
- [ ] 4.9 Add a `--ledger-cols` variable for the ledger's columns.
- [ ] 4.10 Let sheet and insight titles wrap instead of truncating.
- [ ] 4.11 Move inline layout styles to classes.

## 5. Performance

- [ ] 5.1 Pause Live and the nav status poll while the tab is hidden, and refetch on return.
- [ ] 5.2 Send background polls with fetch priority `low`.
- [ ] 5.3 Memoize Live stream rows, tick only running rows each second, and use one cached `Intl.DateTimeFormat`.
- [ ] 5.4 Load pages and the command palette on demand with `React.lazy`.
- [ ] 5.5 Re-render only the hover marker on chart hover: Timeline, Work chart, Cost chart.
- [ ] 5.6 Memoize the Errors page context so a toggle re-renders only its row.
- [ ] 5.7 Run the landing animation without a forced layout per element.
- [ ] 5.8 Scope the Palette landing observer to `main`.
- [ ] 5.9 Use an `IntersectionObserver` in `SectionIndex`.
- [ ] 5.10 Share one `ResizeObserver` across the Errors examples.
- [ ] 5.11 Do not render the tables of closed drawers.
- [ ] 5.12 Apply `content-visibility: auto` to long lists.

## 6. Docs and verify

- [ ] 6.1 Add the user-visible changes to `[Unreleased]` in `CHANGELOG.md`.
- [ ] 6.2 Update `README.md` where behavior a user sees changed.
- [ ] 6.3 Regenerate the page-test fixtures with `uv run python -m unittest tests.test_web_fixtures` if a payload changed.
- [ ] 6.4 Run `cd web && npm run check`, `uv run python -m unittest discover -s tests` and `openspec validate --all --strict`; commit the build in `src/ai_ledger/web/`.
