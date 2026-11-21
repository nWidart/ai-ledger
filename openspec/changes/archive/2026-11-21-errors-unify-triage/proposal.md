# Proposal

## Why

Errors was ported from a standalone template, and it still reads like one. Its top bar mixes page filters with chart and table options. It draws cards where the other pages draw panels, has no data table under its chart, words its messages with contractions, repeats the last ingest the navigation already shows, and folds its summary on a phone behind a "More summary" button that no other page has. Its type table has eight columns, so it scrolls sideways in the master pane. And two questions the page is for have no direct answer: did the fixes I applied work, and is this incident a tight retry loop or failures spread over time?

## What Changes

- **Controls where they act.** The top bar keeps only the page-level filters (project, range, source). Day / Week moves into the rate chart's header, as Activity and Cost place their chart options. "Include subagents" and "Hide noise and muted" move to the type table's toolbar. The URL keys (`gran`, `sub`, `noise`) and the control ids stay.
- **Same build as the other pages.** Panels instead of cards. A "Show data table" disclosure under the rate chart. Uncontracted copy ("Could not", "did not", "cannot"). No "Ingested …" in the date line and no ingest sentence under Where to start: the navigation shows the last ingest and owns Refresh. On a narrow screen the summary shows every line and vital, two vitals to a row, as on Activity, Cost and Insights; "More summary" goes.
- **A four-column type table** that fits the master pane at 1280px with no sideways scroll, and keeps all four columns at every width: Type (swatch, Muted and Fix applied marks); Errors and Rate (either sorts) with the share bar; Time lost with the share not recovered as a subline (either sorts); Trend (a sparkline with a tick on the recorded fix day) with Change (sorts). The six sorts the spec requires stay, each a header button with `aria-sort` on its header.
- **Applied-fixes scorecard** in Where to start: every recorded fix, newest first, with its rate before and since and the verdict of the existing gated before/after model. Hidden with no fix recorded.
- **Retry attempt strip** in each incident row: the failures (✕) on a time strip whose length grows with their span, then the call that recovered (✓). A tight loop is a short strip of crowded marks; spaced failures a long strip of separate ones. Its text alternative says the attempts, their span and spacing, and how the incident ended.

## Capabilities

### Modified Capabilities

- `errors-dashboard`: controls placement, the type table's columns and sorts, the chart's data table, the scorecard, the attempt strip, the narrow-screen summary, the copy and the dropped ingest lines.
- `dashboard-app`: the How measured scenario for Errors' uncategorized share no longer opens "More summary".

## Impact

- `web/src/pages/errors/`: `ErrorsPage.tsx`, `RateChart.tsx`, `TypeTable.tsx`, `Summary.tsx`, `Detail.tsx`, `Examples.tsx`, `model.ts`, `marks.ts`, `errors.css`, `PARITY.md` and the page and model tests.
- `tools/demo/record.mjs`: the types panel's selector.
- Docs: `site/src/content/docs/pages/errors.mdx`, the glossary and the tool-failures playbook; `README.md`; `CHANGELOG.md`.
- No payload, store or server change.
