# Proposal

## Why

An Errors permalink names one example by its tool call id (`/errors#...&ex=<tool_use_id>`). When the store no longer holds that error (a rebuild, another store, a mistyped link), the page shows the view without it and says nothing. A bare `#ex=` link falls back to All time, so the user cannot tell the link is dead (GitHub issue #4).

## What Changes

- **Detect a dead link**: the view reads `dead` when the hash names an example the loaded store does not hold. Before the payload loads, nothing is dead.
- **Say so**: a notice above the summary, `role="status"`, says the linked error is gone and the view shows without it. Dismiss removes it and moves focus to the page heading. The page's status region says it once.
- **Keep the range the hash names**: a dead bare `#ex=` link uses the default 30 days, not All time. A live one keeps All time.
- The notice lives in page state, because the page writes the hash back without `ex` and would otherwise lose it.

Out of scope: any backend or payload change, any change to live permalinks, and other issue items.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: a permalink to an example that is no longer in the store shows a notice.

## Impact

- `web/src/pages/errors/view.ts`: `readView` returns `dead`, and takes no model before the payload loads.
- `web/src/pages/errors/ErrorsPage.tsx`: the notice, its state and its focus.
- `web/src/pages/errors/ErrorsPage.test.tsx`, `web/src/pages/errors/model.test.ts`: tests.
- `web/src/pages/errors/PARITY.md`, `CHANGELOG.md`.
