# Proposal

## Why

The palette's highlight is a position in the list. Session results arrive after a pause and can rank above rows already shown, so they push those rows down under the highlight. A user who types `jobdesk`, arrows down to "jobdesk · open project page" and presses Enter as the sessions land opens a session instead.

## What Changes

- Once the user moves the highlight with the arrow keys or the mouse, it stays on that suggestion when suggestions load later or change order. It falls back to its position only when that suggestion is gone.

## Impact

- `web/src/components/palette/Palette.tsx` and its test.
- The build in `src/ai_ledger/web/`.
- No payload, store or server change.

## Capabilities

### Modified Capabilities
- `command-palette`: the highlight follows the suggestion, not its position.
