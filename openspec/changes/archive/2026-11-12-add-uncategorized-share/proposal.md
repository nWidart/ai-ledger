# Proposal

## Why

Some error types are catch-alls: Other, Other non-zero exit and MCP tool error take the errors no specific rule matched. When their share grows, the Errors page has a blind spot, because nothing shows it (GitHub issue #4).

## What Changes

- **Show the share**: the Errors summary gains an "Uncategorized: N% of errors" line, computed from the view's errors, with its title saying which types count and what they are.
- **Split by agent**: when the view is not filtered to one source and more than one source has errors, the line adds each source's share, e.g. "(Claude Code 9%, Codex 31%)".
- The shares are computed on the client from the errors the page already has. No payload or backend change.

Out of scope: any change to categorization rules, the type table, or other issue items.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: the summary shows the catch-all share of errors, split by source when it applies.

## Impact

- `web/src/pages/errors/model.ts`: `CATCH_ALL` and `uncategorized`, used by `summary()`.
- `web/src/pages/errors/Summary.tsx`: the line.
- `web/src/pages/errors/PARITY.md`, `README.md`, `CHANGELOG.md`.
