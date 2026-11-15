# Proposal

## Why

The web app fetches its data through a hand-written layer (`web/src/useApi.ts`, 90 lines) and four more fetch paths beside it (the Live page, the sessions drawer, the palette, the Errors marks). The audit of the web app found the problems that layer has grown:

- No request can be cancelled: `useApi`, the sessions drawer, Live and the palette all call `fetch` without an `AbortSignal`, so a filter changed three times sends three requests and the page waits for all of them.
- The cache never evicts. `useApi` keeps every URL's answer, and the JSON text of every answer, for the life of the tab, and compares each new answer to the old one with `JSON.stringify` on the main thread.
- The status poll (every 60 s) and the Live recheck (every 10 s) run in hidden tabs, at normal priority.
- Each of the five fetch paths has its own in-flight dedupe, stale-answer guard (`seq`, `my !== seq.current`, `sent`/`shown`), error state and retry, written by hand and tested by hand.

TanStack Query is the standard answer to exactly this set of problems: one cache with keys, stale-while-revalidate, cancellation, structural sharing, garbage collection, polling that pauses in the background, and mutations that invalidate. The user asked to adopt TanStack across the app; this change weighs each TanStack library against what the app has and adopts the ones that pay for themselves.

## What Changes

- **Adopt TanStack Query** (`@tanstack/react-query` 5.107.1, `@tanstack/react-query-devtools` in development only) as the one data layer. Every GET in the app becomes a query with a key; Refresh and the Errors marks become mutations that update or invalidate queries; the status poll becomes a query with `refetchInterval` that pauses while the tab is hidden; the Live page's change notices invalidate its queries. `useApi.ts`'s cache, the `seq` guards and the hand-written dedupe go.
- **Leave the URL model alone.** `hash.ts` and the URL model (page in the path, filters and sheets in the hash) are not changed by this change, so every link, bookmark and `>copy link` URL keeps working. The first plan rejected TanStack Router and did two navigation items in `hash.ts` (page switches in a React transition, view transitions). The user then approved a separate change, `adopt-tanstack-router`, which replaces `hash.ts` and does both; this change does neither. Route code splitting stays as #74 added it.
- **Reject** Table, Virtual, Form, Store, Pacer, Hotkeys, DB, Start, Charts and the rest for now; `design.md` gives each its reason and the condition under which to revisit.
- **User-visible changes** (spec deltas): the navigation does not poll the app's status while the tab is hidden and asks once when it is shown again; a page the user comes back to shows its last figures at once and refetches only when an ingest stored something or Refresh ran; a request the user navigated away from is abandoned.
- **No change** to the payloads, the server routes, the hash keys, the store or any figure.

Out of scope: replacing `hash.ts` with a router (the change `adopt-tanstack-router`), page transitions, virtualizing the Live stream or any table, server changes.

## Impact

- `web/package.json`: two dependencies, `@tanstack/react-query` and `@tanstack/react-query-devtools` (dev only in the bundle). The production JS bundle grows by about 13 kB gzipped (45 kB minified, Bundlephobia for 5.107.1), from 204 kB to about 216 kB gzipped; no other library is added.
- `web/src/useApi.ts` (replaced), `api.ts` (`getJson` takes a signal), new `queries.ts` and `queryClient.ts`, `main.tsx` (provider), `components/Nav.tsx`, `components/refresh.ts`, `components/useLanding.ts`, `pages/live/useLive.ts`, `pages/activity/SessionsDrawer.tsx`, `pages/cost/drawers.tsx`, `components/palette/Palette.tsx`, `components/sheets/SessionSheet.tsx`, `pages/errors/marks.ts`, `pages/errors/Examples.tsx`, every test that stubs `fetch` or reaches into the old cache, `test-setup.ts`, and the build in `src/ai_ledger/web/`.
- Specs: `dashboard-app` (status poll in hidden tabs, page data kept between visits). `live-dashboard` does not change: #74 already specified the Live page in a hidden tab, and this change keeps that behaviour.
- This change starts after `feat/web-audit-fixes` merges: that branch touches `App.tsx`, `hash.ts`, `Nav.tsx`, `useLive.ts`, `Stream.tsx` and the charts, and this one builds on its lazy routes and replaces its manual visibility pause for the polls.

## Capabilities

### Modified Capabilities
- `dashboard-app`: the status poll pauses in hidden tabs; a page's data is kept between visits and refetched only on change.
