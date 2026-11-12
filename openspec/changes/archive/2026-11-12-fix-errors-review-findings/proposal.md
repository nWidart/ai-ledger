# Proposal

## Why

Three independent reviewers read the nine Errors page features of GitHub issue #4 (bucket selection, tool and agent breakdowns, time lost, fix markers and muted types in the store, the uncategorized share, the sortable table, By message, the dead-link notice). Their accepted findings are fixed here. The features are unreleased, so no release has the bugs.

## What Changes

- **Data loss in the import.** A store row with no fix day meant both "the fix was undone" and "only muted". `error_marks` gains `fix_decided`: set by a mark and by an undo, never by a mute. The import adds a marker for every type with no row or an undecided one, and leaves a decided one. A store file from before the column gets it when opened, backfilled once: a row with a fix day, or with no fix day and not muted, is decided; a muted row with no fix day stays undecided.
- **Filters that undid an action.** "Clear filters" on the "Outside current filters" note resets the agent too. Opening a type from the chart legend or Where to start clears a selected bucket that has none of its errors, and says so; the palette's type-open patch always clears the bucket. "Back to types" falls back to `tableFocus()` when the type filter hides the row.
- **Table sorting.** Share is a plain header (it orders as Errors, and its header hides on narrow screens), so the `c-on` exemption goes. A type with no measurable time lost sorts last either way. Change sorts by the change in error rate in points (`Delta.pts`, replacing `pct`), counts cells included; only "–" sorts last.
- **Numbers and copy.** The summary's count of open fixes leaves out muted types, as Where to start does. The table hint names the columns that follow a bucket. A chart point with errors and no calls says so, not "no activity". Open By message groups are kept per type and message.
- **Chart accessibility.** The chart box is `role="application"` with `aria-roledescription="chart"`, as it takes arrow keys, Enter and Space.
- **Server.** The marks endpoints answer 500 `{"error": "internal error"}` on an unexpected error, and log its type and message to stderr, never the request body.
- **Tests and docs.** The normalizer cost test takes equal samples for both lengths. `PARITY.md` marks the nine features' entries as tested in jsdom only, and drops its references to `fixes.ts` and "three busiest tools".

Out of scope: a page-wide tool filter, the uncategorized share under muted types, moving the normalizer to its own file, renaming `lostData.ts`, the palette's `ERRORS_KEYS`, request timeouts, the 400 message wording.

## Impact

- `src/ai_ledger/store.py`, `src/ai_ledger/app.py`; `web/src/pages/errors/`, `web/src/components/palette/resolve.ts`; tests; the build in `src/ai_ledger/web/`; `README.md`, `CHANGELOG.md`. No payload change.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: the import, the table sort, the bucket, the muted count, the chart's role, and new requirements for the fixes above.
- `transcript-store`: `error_marks` holds whether the fix marker is decided.
