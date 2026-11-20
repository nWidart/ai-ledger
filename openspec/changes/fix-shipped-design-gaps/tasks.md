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

## 4. Review fixes

- [x] 4.1 Errors: `showModalUnder()` keeps a session or tool sheet above the narrow type sheet on a deep link, a reload and a wide-to-narrow resize. Verify with an `ErrorsPage.test.tsx` test of the showModal order and Back.
- [x] 4.2 Activity: `totals.session_sources` decides Output speed's reason. Verify with `test_metrics.py` and `ActivityPage.test.tsx` (mixed sources with unpriced Claude Code, Codex only); regenerate the fixtures.
- [x] 4.3 Limits: the scenario follows its toggle's eligibility; Why no pace at the limit; percent line in contiguous runs; lines undimmed on a slow load; plan tier visible; pricing behind How measured; time at a limit in two units. Verify with `LimitsPage.test.tsx`, `LimitChart.test.tsx` and `limits.test.ts`.
- [x] 4.4 Section bar: reveal the marked pill on resize and on new links. Verify with `Drawer.test.tsx`.
- [x] 4.5 Cost: one status follows the table's sort, repeats included. Verify with `CostPage.test.tsx`.
- [x] 4.6 Palette: a commit that changes the project and opens a sheet keeps Live's `session`. Verify with `resolve.test.ts`.
- [x] 4.7 Toggletip: height capped to the available height, scrolling, a tab stop when it scrolls. Verify with `Toggletip.test.tsx`.
- [x] 4.8 Live: the project heads a stream with no title. Verify with `LivePage.test.tsx`.
- [x] 4.9 Tests: the context menu opens a session in place on Live and Insights and returns focus; the automated file warning is one node across pages; the Errors chart reads a quiet day by arrow key.
- [x] 4.10 Deltas: Limits (`estimated`, encodings with the scenario line, plan tier, pricing), Cost (reachable ringed-project scenario, sort announcements), forced-colors hollow points and the weekly How measured, the duration rule with Limits' spans, stacked sheets on a deep link, toggletip height, Live's heading, the palette on Live. README, `CHANGELOG.md` and the site.

## 5. Specs, docs and build

- [x] 5.1 Delta specs for every modified capability; `openspec validate --specs --strict`.
- [x] 5.2 Docs site pages for Activity, Context, Cost, Errors, Insights, Limits, filters, data tables, context menu, palette and two playbooks; `CHANGELOG.md` `[Unreleased]`. README: a line on Open session from Cmd+K and the context menu, and one on the shared automated file warning.
- [x] 5.3 Rebuild `src/ai_ledger/web/`; run `npm run check` in `web/` and `site/`, `uv run ruff check` and the Python tests.
- [x] 5.4 Regenerate the docs-site screenshots and the README GIFs of the pages that look different: Cost, Context, Errors, Limits.
