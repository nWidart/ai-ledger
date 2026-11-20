# Proposal

## Why

A design review of `main` found bugs and accessibility gaps in six recently merged changes (`add-api-time`, `cost-project-matrix`, `fix-workchart-low-calls`, `limits-pace-cone`, `session-sheet-in-place`, `trim-page-density`). Some behavior differs from page to page where one shared component should own it; some text is only in hover titles; some lines and toggletips fail contrast or screen-reader use; and two specs drifted from the code.

## What Changes

- **Sheets in place.** The palette and the context menu open the session sheet over Insights and Live, which host the sheets since `session-sheet-in-place`. On Live the sheet uses the `sheet` key, so the followed session and the live connection stay. Every session link carries the session subject and `data-session`, so the context menu opens on it and focus returns to it.
- **Stacked sheets.** On a narrow screen, a session or tool sheet opened from Errors' type sheet stacks over it with "← Back". Escape, the backdrop, Close and Back close the top sheet first and return focus to the link.
- **One How measured.** Cost, Errors and Limits use the shared `HowMeasured` toggletip. Errors' uncategorized and incident method text moves out of `title` attributes into it.
- **Toggletips.** The popup renders right after its button, as normal content with `role="tooltip"`; no live region, no `aria-hidden`, nothing announced on hover.
- **Section bar.** It re-reads the sections when a drawer opens or closes (Drawer now notifies), and its pills stay on one line, scrolling sideways.
- **Limits.** Lines differ by dash and width at full contrast. Hover-only titles become visible text or toggletips. The scenario line uses the warning style. The "Last 24 h pace" toggle hides when only windows at their limit have a scenario. A picked past window gets a data table. "What a point buys" names its range.
- **Context.** Largest contributors keeps the ten largest by total whatever the sort, scales bars to the named rows, draws no bar for Other, and keeps the scale out of the sort button.
- **Cost.** "Sort by cost again" focuses the Spend header; sorts are announced; the unpriced chip's screen-reader text matches the spec; the spec drops the impossible "small project selected" scenario.
- **Durations.** `format.ts` `dur()` picks its unit after rounding, and Errors uses it.
- **automated.json.** `/api/status` carries `automated_file`. The app shell shows the warning on every page; Filters names the file from the status. No page wires it.
- **Low calls.** Errors' keyboard reading says "too few calls for a steady rate"; hollow points have a forced-colors rule; the weekly chart's How measured says "per week".
- **Headings.** Errors, Insights and Live follow the Activity pattern: one `h1#lede` while loading, after a failed load and with nothing to show.
- **Small text.** Live's wall pluralizes errors; Activity's Output speed says Codex records no model time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: How measured on every page; toggletips read in place; automated file warning on every page; stacked sheets; section bar follows drawers; one duration format; one page heading.
- `command-palette`: Insights and Live host the sheets; Live's session sheet key.
- `context-menu`: session links are subjects; Open session over Live.
- `cost-dashboard`: How measured toggletip; sort focus and announcement; folding spec matches the one-project rule.
- `context-dashboard`: the ten largest by total whatever the sort; bar scale.
- `errors-dashboard`: uncategorized share and incidents behind How measured; durations; low-call reading.
- `limits-dashboard`: line styles; toggletips; toggle visibility; past-window table; value range.
- `insights-dashboard`: the model-judged tag beside the page name, outside the lede heading.
- `live-dashboard`: the wall pluralizes errors.
- `usage-dashboard`: Output speed's reason on a Codex-only view.

## Impact

- `src/ai_ledger/app.py`: `status()` adds `automated_file`. Test in `tests/test_app.py`.
- `web/src/components`: `Toggletip`, `HowMeasured` users, `Sheet`, `Drawer`, `SectionIndex`, `Sort` (`after`, `data-sort`), `Filters`, new `AutomatedFileWarning`, `refresh.ts` (`useLastStatus`), `chart.ts` (`FEW_CALLS`), `palette/resolve.ts`, `menu/items.ts`, `sheets/session.ts`, `sheets/UsageSheets.tsx`.
- `web/src/pages`: Activity, Context, Cost, Errors, Insights, Limits, Live; the Project page only drops its `autoFile` prop.
- `web/src/format.ts`, `web/src/theme.css`, `web/src/base.css`.
- Tests across the web suite; `src/ai_ledger/web/` rebuilt; docs site, `CHANGELOG.md`, screenshots and README GIFs of Cost, Errors, Context and Limits.
