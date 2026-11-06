# Design

## Context

`web/src/theme.css` defines every color as a token on `:root`, with dark values under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`. The same pattern covers the `--type-*` tokens. No code sets `data-theme`, so the page always follows the OS. No other stylesheet reads `prefers-color-scheme`, and charts are SVG painted with `var(--…)`, so flipping the attribute repaints everything with no JS redraw. The server sends no Content-Security-Policy, so an inline script in `index.html` is allowed. Per-viewer settings already live in `localStorage`, with every read and write wrapped in try/catch (`Drawer.tsx`, `CostPage.tsx`).

## Goals / Non-Goals

**Goals:**
- Drive the existing `data-theme` hooks; don't touch the tokens.
- One owner for the theme logic in the app; the pre-paint script is the only copy outside it.

**Non-Goals:**
- New palettes, or retuning the dark colors.
- Syncing the choice across browsers or devices (it is per browser, like the other view settings).
- Dark-mode demo GIFs.

## Decisions

**Attribute, not a class or React context.** System = no `data-theme` attribute, Light = `data-theme="light"`, Dark = `data-theme="dark"`. `theme.css` already gives exactly these semantics, including "System follows live OS changes" for free through the media query. A React context would re-render every page for a pure CSS concern.

**A small `web/src/theme.ts` module owns the state.** It exports the `Theme` type (`"system" | "light" | "dark"`), `getTheme()` (reads the attribute, which the pre-paint script already set), `setTheme(t)` (sets or removes the attribute, writes or removes storage, notifies subscribers), `nextTheme(t)` and a `useTheme()` hook built on `useSyncExternalStore`, the same shape as `colors.ts`. It also listens for the `storage` event on its key and applies the new value, which gives tab sync. Nav only renders the button. Putting it in Nav directly was the alternative; a module keeps Nav about navigation and keeps the logic testable without rendering the bar.

**Storage key `ai-ledger-theme`, values `"light"` or `"dark"` only.** System removes the key. Any other value reads as System. The older `claude-*` keys are legacy names kept for the rename (see the "Keep browser state through the rename" requirement); a new key takes the app's name.

**Pre-paint inline script in `<head>` of `web/index.html`.** It is a few lines: inside try/catch, read the key; if it is `light` or `dark`, set `document.documentElement.dataset.theme`. It is a classic script (not a module), so it runs before the stylesheet applies to the body. Vite copies inline classic scripts through unchanged. Setting it from `main.tsx` was the alternative: it runs after the bundle loads and causes a flash. The key and the allowed values are repeated in this script; a test reads `web/index.html` and checks that the script uses the same key as `theme.ts`, so the two can't drift.

**Button placement and look.** An icon-only button after Refresh, so it is the last item on every page and on phones (where Refresh already takes `margin-left: auto`). Icons are inline SVG drawn with `currentColor`: a monitor for System, a sun for Light, a moon for Dark. The accessible name is `Theme: system`, `Theme: light` or `Theme: dark`. The `title` adds what a click does next ("Theme: system. Click for light."). It reuses the `.appnav button` size so the bar height doesn't change.

## Risks / Trade-offs

- [The inline script and `theme.ts` repeat the key] → The test above fails on drift.
- [A stale `data-theme` attribute leaks between tests, since the test setup clears storage but not the attribute] → Theme tests reset `document.documentElement` in their own `afterEach`. Cross-tab sync is tested by dispatching a `StorageEvent`.
- [jsdom can't prove there is no flash] → Check it by hand: build, save Dark with the OS light, reload with network throttling, and watch the first frame.
- [`web/dist/index.html` must carry the script, and `tests/test_web_build.py` already includes `index.html` in its staleness check] → Rebuild and commit `web/dist/` with the change.
