# Tasks

## 1. Theme state

- [x] 1.1 Add `web/src/theme.ts`: the `Theme` type, `getTheme`, `setTheme`, `nextTheme`, `useTheme` and a `storage` event listener on `ai-ledger-theme`, with every storage access in try/catch. Verify with `web/src/theme.test.ts`: the cycle order; set/remove of the attribute and the key; an unknown stored value reads as system; storage that throws still switches the attribute; a dispatched `StorageEvent` applies the new value. Reset `document.documentElement` after each test.
- [x] 1.2 Add the pre-paint script to the `<head>` of `web/index.html`, so it runs before the stylesheet link. Verify with a test in `theme.test.ts` that reads `web/index.html` and checks the script uses the same key as `theme.ts`.

## 2. Nav button

- [x] 2.1 Add the theme button after Refresh in `web/src/components/Nav.tsx`, with monitor, sun and moon SVG icons, the `Theme: <state>` accessible name and a `title` that names the next state. Style it in `Nav.css` so the bar height stays the same at desktop width and at 520px or less. Verify with a test in `Nav.test.tsx`: three clicks give light, dark, then system (attribute and storage), and the accessible name follows.
- [x] 2.2 Document the theme button in the Pages section of `README.md`, and verify the text matches the behavior.

## 3. Build and check

- [x] 3.1 Run `cd web && npm run check` and `uv run python -m unittest discover -s tests`. Verify both pass and `web/dist/index.html` contains the pre-paint script.
- [x] 3.2 Check by hand on a copied store and a free port: choose Dark with the OS light, reload with network throttling, and confirm the first frame is dark. Confirm System follows an OS switch live, the choice carries across all four pages and into a second tab, and the phone-width bar stays one row.
- [x] 3.3 Run `openspec validate add-theme-toggle --strict` and verify it passes.
