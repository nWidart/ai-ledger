# Proposal

## Why

The project picker is two controls: a native select and, over 12 projects, a search box beside it. Typing in the box narrows the select, but the result shows only after the user opens the select. The "No project matches" message appears beside the box, so the controls after it move while the user types.

## What Changes

- **One filterable dropdown** replaces the select and the search box, on every page with the project picker. The field shows the selected project with its color dot. Typing in it lists the matching projects below it at once, in a popup that floats over the page, so no other control moves.
- The field has a fixed width, whatever the project names.
- "All projects" is always listed: first in the full list, after the matches while the user types, so Enter selects the first match. When the typed text matches no project, the popup says "No project matches".
- The 12-project threshold goes: every picker filters, short or long.
- Keyboard: arrows move through the options, Enter selects, Escape closes and puts the selected project back in the field. The name in the field is selected, so typing replaces it.
- Selecting a project writes the URL as before.
- The dropdown uses Base UI's Combobox (`@base-ui/react`), the web app's first runtime dependency besides React. It is unstyled, so the field and popup use the app's own tokens, and it supplies the popup positioning, keyboard handling and ARIA roles. The alternatives: `downshift` leaves popup positioning to the app, `react-aria-components` and `@headlessui/react` bring their own styling conventions, `@ariakit/react` is still 0.x.

Out of scope: the picker's project order and labels, the other filters.

## Impact

- `web/package.json` (new dependency), `web/src/components/Filters.tsx`, `web/src/theme.css`, the tests that select a project, and the build in `src/ai_ledger/web/`, which grows by the Combobox code.
- No payload or store change.

## Capabilities

### Modified Capabilities
- `dashboard-app`: the project picker is one filterable dropdown.
