# Tasks

## 1. Sheets

- [x] 1.1 Add Insights and Live to `HOSTS_SHEETS` in `palette/resolve.ts`; write and clear the session sheet under `sheetKey(path)`; the project sheet item in `menu/items.ts` clears the page's key. Verify with `resolve.test.ts` and `items.test.ts` tests: Insights and Live keep the sheet over the page, Live keeps `session`, Limits still goes to Activity.
- [x] 1.2 Make `sessionLink(id)` return the link's props (click, `data-session`, session subject) and spread it on Errors', Insights' and Live's session links; `twin()` matches any `[data-session]`.
- [x] 1.3 `Sheet` shows "← Back" when it opens over another open dialog. Verify with an `ErrorsPage.test.tsx` test at narrow width: the tool sheet stacks over the type sheet, Back closes it alone and focus returns to the link. Probe in Chrome at 800 px: Escape and the backdrop close the top sheet first.

## 2. Shared components

- [x] 2.1 Toggletip: portal the popup into a span right after the button, `role="tooltip"`, fixed positioning, no live region, no `aria-hidden`, no `aria-haspopup`. Update the tests that read the old status region.
- [x] 2.2 Cost, Errors (uncategorized share, incident line) and Limits use `HowMeasured`; remove the `details.how` styles.
- [x] 2.3 `Drawer` exports `onDrawerToggle`; `SectionIndex` subscribes; pills `nowrap` with sideways scroll and the marked pill kept in view. Verify with a `Drawer.test.tsx` test: opening a drawer re-reads the sections.
- [x] 2.4 `format.ts` `dur()` picks its unit after rounding; Errors uses it. Verify with `format.test.ts` cases at 59.6 s, 3,590 s and 35,990 s.
- [x] 2.5 `/api/status` carries `automated_file`; `useLastStatus()`; `AutomatedFileWarning` in the app shell; `Filters` reads the path; drop `autoFile` from every page. Verify with a `test_app.py` test and `App.test.tsx` tests: the banner shows once on Cost, Insights, Errors and Activity, and the toggle names the file.

## 3. Pages

- [x] 3.1 Limits: line styles by dash at full contrast; visible "estimated" chip and costs; toggletips for a missing pace and a strip's summary; warning style for the scenario line; toggle hidden when only capped windows have a scenario; past-window data table; What a point buys names its range. Update `LimitsPage.test.tsx`.
- [x] 3.2 Context: cut the ten largest by total whatever the sort, scale bars to named rows, no bar for Other; `SortTh` `after` holds the scale. Verify with `Contributors.test.tsx`.
- [x] 3.3 Cost: Sort by cost again focuses Spend; a polite status says each sort; the unpriced chip's screen-reader text. Verify with `CostPage.test.tsx`.
- [x] 3.4 Low calls: `FEW_CALLS` in `chart.ts`; Errors' `pointText` takes `low`; forced-colors rule for `.lowc` and its keys; weekly How measured says "per week". Verify with `model.test.ts`, `theme.test.ts` and `WorkChart.test.tsx`.
- [x] 3.5 Headings: Errors' skeleton replaces its header and a failed load names the page; Insights' lede is the `h1` and the kicker a `p`; Live's `h1` keeps `#lede`. Verify with Errors, Insights and Live tests.
- [x] 3.6 Live's wall pluralizes errors; Errors' Where to start too. Activity's Output speed names Codex on a Codex-only view.

## 4. Specs, docs and build

- [x] 4.1 Delta specs for every modified capability; `openspec validate --specs --strict`.
- [x] 4.2 Docs site pages for Activity, Context, Cost, Errors, Insights, Limits, filters, data tables, context menu, palette and two playbooks; `CHANGELOG.md` `[Unreleased]`. README unchanged: its line on How measured still holds.
- [x] 4.3 Rebuild `src/ai_ledger/web/`; run `npm run check` in `web/` and `site/`, `uv run ruff check` and the Python tests.
- [x] 4.4 Regenerate the docs-site screenshots and the README GIFs of the pages that look different: Cost, Context, Errors, Limits.
