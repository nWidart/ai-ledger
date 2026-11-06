# Proposal

## Why

The dashboards follow the operating system's light or dark setting, with no way to choose another one. Someone who keeps their OS dark but wants a light dashboard (or the reverse, or a different choice per browser) can't have it. The stylesheet already has light and dark overrides that nothing switches on, so adding the control is cheap.

## What Changes

- A theme button in the shared navigation, on every page, steps through three states: **System** (follow the OS), **Light** and **Dark**. Its icon and accessible name show the current state.
- The choice is saved in the browser. Back on System, the saved choice is removed and the page follows the OS again, including live OS changes.
- A saved theme is applied before the page first paints, so a page saved as dark doesn't flash light while it loads.
- Other open tabs of the app switch to a new choice without a reload.
- README documents the button.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: adds requirements for choosing the color theme from the shared navigation, keeping it per browser, and applying it with no flash on load.

## Impact

- `web/index.html`: a small inline script that applies the saved theme before the app bundle loads.
- `web/src/components/Nav.tsx`, `Nav.css`, `Nav.test.tsx`: the button, its styles and its tests.
- `web/src/theme.css`: unchanged. Its existing `data-theme` overrides are what the button drives.
- `web/dist/`: rebuilt.
- `README.md`: Pages section.
- No server, API, store or payload change.
