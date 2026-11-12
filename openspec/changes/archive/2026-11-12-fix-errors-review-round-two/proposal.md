# Proposal

## Why

A second review round of the Errors page fixes found two Medium and four Low items.

## What Changes

- The chart's keys do nothing when no SVG is drawn (no calls, or no errors left to draw), where they dereferenced a missing element after the last visible type was muted out. The render and the keys share one condition.
- "No activity" means no calls and no errors, in the drawn band, the legend key, the reading and the tooltip, through one predicate. A bucket with errors and no calls draws its bars with no band.
- The store adds `fix_decided` and backfills it in one transaction, so a crash between them cannot leave a column that later opens skip. The spec says what the backfill does for a row left by a mute then an unmute, instead of calling it an undo's row.
- The marks endpoints' log comment says what is true. `PARITY.md` stops describing `role=img` and a sortable Share, and the behaviors not seen in a browser move to `[ ]` lines.

## Impact

- `src/ai_ledger/store.py`, `src/ai_ledger/app.py` (a comment), `web/src/pages/errors/` (`RateChart.tsx`, `model.ts`, `PARITY.md`), tests, the build.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: the chart's no-activity reading, and keys without a drawn chart.
- `transcript-store`: the backfill of the fix decision.
