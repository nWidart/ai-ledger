# Proposal

## Why

The shared navigation does three jobs at once: it moves between pages, it shows the current project filter, and it reports and runs ingest. All of them get the same weight, so at about 1000px the bar wraps to a second row, and what falls to that row depends on the length of a project name. The two widest items are the project chip (about 260px) and the ingest status text (about 210px). The chip repeats the project picker that every page shows in its filter row. The status text reports an ingest that already runs on its own every minute.

## What Changes

- **Project link moves to the filter row.** The navigation no longer shows the project chip. With a project filter set, the filter row shows "Project page →" and a clear button next to the project picker. The Project page itself shows the clear button but not the link.
- **Search shows the scope.** With a project filter set, the palette button shows the project's color dot and name in place of its "Search" label, so the filter stays visible after the filter row scrolls away. Its accessible name still includes "Search".
- **One freshness control.** The status text and the Refresh button become one split control:
  - The left half is Refresh, with the same id, name, Retry state and busy behavior as today.
  - The right half is a toggletip that shows the time of the last ingest as a clock time ("8:00 PM"), not as an age. It opens the details: exact time, new lines, last data change, the interval, and the full error.
  - The control says "Stale" when the last ingest is older than three intervals, "Failed" after an ingest error, and "Offline" when the app does not answer.
  - "+N lines" shows just below the control for a few seconds after an ingest stores new lines.
- **The ingest time leaves the live region.** Timed ingests are no longer announced. Only the result of a manual refresh is.
- **One row at every width.** Narrower windows hide the wordmark, shrink Search to its icon and tighten the tabs. Below a breakpoint set in `rem`, a page chooser replaces the tabs. It is a button naming the current page ("Pages" on the Project page) that opens a list of the same page links, and it carries the Limits alert dot. No tab ever moves into a "More" menu.

Not in this change: the command palette's behavior, the theme button, the Live page, and the API. `/api/status` already sends `interval` and `last_change`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the shared navigation's entries can sit in a page chooser, and the navigation stays one row. The ingest time becomes a clock time in a freshness control with Stale, Failed and Offline states and a details toggletip. The Limits alert dot and its name also go on the page chooser. Timed ingests stop being announced.
- `project-page`: the Project page is reached from the filter row instead of the navigation chip, and the page chooser marks no page as current on it.
- `command-palette`: the palette button shows the project filter while one is set.

## Impact

- `web/src/components/Nav.tsx`, `Nav.css`, `refresh.ts`, `Filters.tsx`, `Filters.css`, and `Toggletip.tsx` if it needs a variant. Possibly a small `PageChooser` component.
- Tests: `Nav.test.tsx`, `router.test.tsx` (`#navFilter`), `Filters.test.tsx`, `queryClient.test.ts` (status text), `Palette.test.tsx` (button name).
- `tools/demo/record.mjs` clicks `.appnav-go`; the README GIFs need re-recording.
- `README.md`, `CHANGELOG.md`, and the build in `src/ai_ledger/web/`.
- No payload, store or API change.
- Sequencing: `respect-text-size`, in progress on `feat/respect-text-size`, rewrites the font sizes in `Nav.css` and `Filters.css` to `rem`. Apply this change after it merges, so the breakpoints here use the same units. Issue #67 (container queries) does not block it.
