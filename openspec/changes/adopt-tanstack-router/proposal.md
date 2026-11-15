# Proposal

## Why

The web app keeps its URL model in `web/src/hash.ts`: the page is the path and every piece of view state is a key in the hash, typed as one loose record (`HashPatch` accepts any string key, and page-only keys such as the Errors page's `sub`, `noise` and `gran` sit in an untyped `raw` map). Each new page, filter or overlay adds keys to shared lists in that one module, every component that reads the hash re-renders on any hash change, and the hash cannot be used for what it is for, a link to a section. The app is growing (a Context page, a tool filter, a Grok source, and a modal window are planned), so that cost recurs.

`adopt-tanstack` rejected TanStack Router (its design decision 9). The user asked for that verdict to be tested again and, with the evidence in `design.md` of this change, chose to adopt Router in full: Router owns the path and the history, and the view state moves from the hash to validated search parameters.

## What Changes

- **Adopt TanStack Router** (`@tanstack/react-router`, code-based routes, no Vite plugin and no generated route tree) as the app's one owner of the URL and the browser history. The seven pages become seven lazy routes under one root route that holds the navigation and the palette.
- **BREAKING (URL form): the view moves from the hash to the query string**, with the same keys and the same values: `/usage#project=foo&range=30&session=abc` becomes `/usage?project=foo&range=30&session=abc`. `>copy link`, the Errors "copy link" and every in-app link write the new form.
- **Every link in the old hash form keeps opening the same view.** The app turns it into the new form in place, without a reload and without a new history entry, for as long as the app exists. This covers bookmarks, links copied before this change and the Errors permalinks `#ex=<id>` and `#cat=<type>`.
- **Typed, validated search per route.** Each page declares the keys it owns and their types; the shared keys (`project`, `range`, `source`, `auto`) and the sheet keys are declared once. A component reads only the keys it uses.
- **What stays written by hand, in one small module:** which keys add a history entry and which replace, the count of sheet entries that lets Close go back past every sheet the app opened, and the rule that Activity's selected day is dropped when the view changes. These are specified behaviour that Router has no option for.
- **Navigation behaviour that Router brings**, each a spec delta: a page switch is animated with a view transition where the browser has them and motion is allowed; the scroll position is restored on Back and Forward; pointing at a page's tab starts loading that page's code and its main payload.
- **A placeholder while a page first loads.** A page with nothing to show yet, because its code or its first data is loading, shows gray blocks with a moving sheen in place of today's "Loading…" heading over an empty page. A page that already shows data keeps it on screen while new data loads, as today.
- **Remove from `adopt-tanstack`:** its phase 5 (task 5.1, `startTransition` and view transitions in `hash.ts`) is replaced by this change, and issue #69 and the scroll restoration follow-up move here. That change is archived with these edits made (PR #81).
- **No change** to the server, its routes, the payloads, the store or any figure. The server already serves the page for a path whatever its query string.

Out of scope, each a later change that this one makes possible: the modal window, section links in the hash, detail pages at their own path (which would need a server catch-all), list or object values in the URL.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the view is kept in the query string; links in the old hash form still open; a page switch is animated; scroll is restored on Back and Forward; a page starts loading when the user points at its tab; a page shows a placeholder while it first loads. The Errors permalink requirement and the scenarios that name a URL take the new form.
- `errors-dashboard`: the permalink requirements name the URL's query keys instead of the hash, and an old `#ex=<id>` link still opens its example.
- `command-palette`: the scenarios that name a URL take the new form; `>copy link` copies the new form.
- `insights-dashboard`: the scenario that names a URL takes the new form.

## Impact

- **Dependencies** (`web/package.json`, exact versions): `@tanstack/react-router` 1.170.46 and, in development only, `@tanstack/react-router-devtools` 1.167.3. Router brings `@tanstack/router-core`, `@tanstack/history`, `@tanstack/react-store` (0.11.2, alpha), `@tanstack/store`, `seroval`, `seroval-plugins`, `cookie-es` and `isbot`. Measured on a prototype built with this repo's Vite 8.3.6 and React 19.3.1: +76 kB minified, +26.7 kB gzipped, in the entry chunk (77.9 kB gzipped today).
- **Code**: `web/src/hash.ts` is replaced by a router module, a route tree and a small URL policy module; `App.tsx` becomes the root route's component; `main.tsx` mounts the router; 54 call sites in about 20 files change how they read and write the view (`Nav`, `Filters`, the sheets, the palette and its `resolve.ts`, and the seven pages with `errors/view.ts` and `insights/drill.ts`); `testing.tsx` gains a router per test; about 335 lines in 14 test files that set or assert `location.hash` or `history` move to the test router; the build in `src/ai_ledger/web/` is committed with each phase.
- **Outside `web/src`**: `tools/demo/record.mjs` (six `#range=30` URLs), `README.md` and `CHANGELOG.md`. One Python test is added to pin that a page path with a query string is served; no server code changes.
- **Other changes**: starts after `adopt-tanstack` phase 4 merges, because both rewrite the same test files and this change's preloading uses that change's `queries.ts`. `adopt-tanstack` drops its phase 5. Issue #69 is closed by this change.
