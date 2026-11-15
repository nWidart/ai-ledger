# Proposal

## Why

The "?" toggletips that replaced hover titles in the accessibility audit show nothing. Their popup is portaled into the nearest dialog, and outside a dialog the container is `null`, which Base UI reads as "wait for a container": the popup never renders. Only the button's `aria-expanded` and the screen-reader status change. They also never opened on hover, so a pointer user who hovers a column header's "?" the way they hovered its old title sees no explanation.

## What Changes

- A toggletip outside a dialog portals its popup to the body, so it shows on every page and not only in sheets.
- A toggletip also opens on hover, after a short delay, and closes when the pointer leaves. A click while it is open pins it open until a second click, Escape or a click outside.

## Impact

- `web/src/components/Toggletip.tsx` and its test, and the rebuilt `src/ai_ledger/web/`.
- Every toggletip: column headers, filter labels, facets, the session and project sheets, the Live agent panel.

## Capabilities

### Modified Capabilities

- `dashboard-app`: adds "Open toggletips on hover".
