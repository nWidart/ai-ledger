# Proposal

## Why

The Errors type table and "Where to start" rank error types by count (GitHub issue #4). A type with many cheap failures outranks one that burns long retry loops, so the page points at the wrong fix first.

## What Changes

- **Time lost**: the cost of a type in the view is the sum, over the view's incidents of that type, of each incident's span, from its first failure's start to its last failure's end. A one-failure incident spans that one call. An incident counts whole when at least one of its failures is in the view; the span is not clipped to the filtered failures.
- **Type table**: a "Time lost" column after "Errors", with a tooltip that says what it measures. A type whose incidents have no measurable span shows "–". The table keeps its order by error count.
- **Where to start**: the open types with a ready-made fix rank by time lost, most first, error count breaking a tie, and each shows its time lost next to its count. "Rising fastest" is unchanged.
- **Type detail**: the incident sentence adds the type's total time lost.

Out of scope: sorting or filtering the table, a muted state, tokens (the store does not attribute tokens to a tool call), any payload or backend change.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: the page states each type's time lost and ranks open fixes by it.

## Impact

- `web/src/pages/errors/` (`model.ts`, `TypeTable.tsx`, `Detail.tsx`, `PARITY.md`), `src/ai_ledger/web/` (build), `README.md`, `CHANGELOG.md`.
