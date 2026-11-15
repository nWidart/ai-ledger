# Design

## Context

See proposal.md for why. The state this design starts from (main at a83ba4c, `adopt-tanstack` phase 1 merged):

- **`web/src/hash.ts`** (149 lines) is the URL model. The page is the pathname; the view is the hash, parsed into `HashState` (typed shared and sheet keys, everything else in `raw`). `setHash(patch, { push })` pushes when a key in `PUSH_KEYS` changes and replaces otherwise, keeps a count in `history.state.sheets` so `closeSheets` can `history.go(-n)`, drops `VIEW_SCOPED` keys (`day`) when project, range or source change, and formats keys in a fixed order so links from before the React app still open. `go(href)` pushes and scrolls to the top on a page change. `useHashState()` and `usePathname()` subscribe through `useSyncExternalStore`.
- **`App.tsx`** maps the pathname to one of seven `React.lazy` pages, sets the title, and moves focus to the page heading after a page switch.
- **Keys in use.** Shared: `project`, `range`, `source`, `auto`. Sheets: `inspect`, `tool`, `mcp`, `skill`, `session`. Activity: `q`, `near`, `day`. Errors: `sub`, `noise`, `gran`, `cat`, `ex`, `at`, `etool`. Insights: `outcome`, `friction`, `help`, `goal`, `fr`, `goalf`, `frf`. Context: `tip`. Live: `view`.
- **Call sites.** 54 uses of `setHash`, `closeSheets`, `useHashState` and `sharedHash` outside tests, in about 20 files; about 335 test lines in 14 files set or assert `location.hash` or `history`; `test-setup.ts` resets the URL with `history.replaceState(null, "", "/")` after each test.
- **Server.** `app.py` serves `index.html` when `urlsplit(path).path` is in `PAGES` and 302s `/` to `/usage`; the query string plays no part. The CSP allows scripts from the app's origin and the inline theme script only, and `connect-src 'self'`.
- **Build.** JS is 228 kB gzipped over all chunks; the entry chunk is 77.9 kB gzipped.

Evidence gathered for this decision (2026-11-15), from the Router docs and a prototype built with this repo's versions (React 19.3.1, Vite 8.3.6, Vitest 5.1.0, jsdom 31):

| Claim | Result | Source |
|---|---|---|
| Size of Router | +76,354 B minified, +26,658 B gzipped over the same app without it; turning scroll restoration and view transitions off saves nothing | prototype build |
| Versions | `@tanstack/react-router` 1.170.46 (2026-10-22), peers `react >=18 \|\| >=19`; depends on `router-core` 1.171.39, `history` 1.162.5, `react-store` ^0.11.2, `isbot`; `router-core` on `seroval`, `seroval-plugins`, `cookie-es` | npm registry |
| A redirect from the old hash form works | A root `beforeLoad` redirect with `replace: true` and an empty hash rewrites `/usage#project=foo&range=30&auto=1&session=abc` in place; `history.length` stays 1 | prototype, jsdom |
| Default serializer quotes some strings | `ex=12345` is written `ex=%2212345%22`, `project=123` as `project=%22123%22`, `session=true` as `session=%22true%22` | prototype |
| A plain serializer fixes that | `parseSearch` and `stringifySearch` over `URLSearchParams`, about 7 lines; validated values keep their types (`range` a number) | prototype |
| `navigate({ search })` pushes by default; `replace: true` replaces | `history.length` 1 → 2, then unchanged | prototype |
| Router keeps the hash only when asked | `navigate({ to })` drops it; `hash: true` keeps it | prototype |
| Pushes made outside Router | Router observes them, but its own index is then lost (`__TSR_index: null`) and its next navigation overwrites `history.state` | prototype, jsdom |
| Page switch is not a concurrent render | Router calls `React.startTransition`, but React reads Router's state through `useSyncExternalStore`, which React renders synchronously | read from `Transitioner.js` and `@tanstack/react-store`; not measured |
| Scroll restoration | `scrollRestoration: true`; keyed by `history.state.__TSR_key`, falling back to the href; kept in `sessionStorage` (`tsr-scroll-restoration-v1_3`), written on `pagehide`; `resetScroll` defaults to `true` on every navigation | docs and source |
| View transitions | `defaultViewTransition` takes `{ types }`, a function of `{ fromLocation, toLocation, pathChanged, hrefChanged, hashChanged }` that may return `false` to skip | docs |
| Setup | Code-based routes need no plugin and no generated file; automatic code splitting needs the plugin and file-based routes | docs |
| Parallel routes | Not supported | comparison page |

Not verified: behaviour in a real browser (the prototype ran in jsdom), and Router's hash history (not used here).

## Goals / Non-Goals

**Goals:**
- Router is the one owner of the URL and the history. No module calls `history.pushState`, `history.replaceState` or reads `location.hash` except through it.
- The query-string form is today's hash with `?` for `#`: same keys, same values, no quoting.
- Every old hash link opens the same view, for good.
- Each phase ships alone, passes `cd web && npm run check` and the Python tests, and can be reverted alone.
- Specified behaviour is unchanged: which changes add a history entry, how sheets close, the dropped day, focus after a page switch, the loading states.

**Non-Goals:**
- No file-based routing, no Vite plugin, no generated route tree, no validation library.
- No route loaders that block rendering, no Suspense for data, no `pendingComponent` for data: the pages' loading states (`useLanding`, `aria-busy`) are specified and stay. Query stays the only data layer.
- No new paths, so no server change.
- No modal, no section anchors, no list values in the URL: later changes.

## Decisions

### 1. Adopt Router in full; not at all and "path only" are the alternatives

Three options were compared.

| | (a) keep `hash.ts` | (b) Router for the path, `hash.ts` for the hash | (c) Router, view in validated search |
|---|---|---|---|
| Old links | work | work | work through a client redirect that is kept for good |
| What breaks | nothing | Router's navigations drop the hash unless every call passes `hash: true`, and overwrite `history.state` (the sheet count); pushes made by `hash.ts` leave Router's index `null` | the form of copied links changes; the default serializer must be replaced |
| Migration | none | the nav and `App.tsx` | 54 call sites, about 335 test lines, four specs, README, the demo recorder |
| Server | none | none | none |
| What it buys | nothing new; each new page or overlay edits shared lists | `<Link>` and little else, at full size | typed search per route, narrow re-renders, a free hash, preload, a router per test, room for paths and nesting |

(b) is rejected: it pays the whole size for two owners of one URL. Between (a) and (c) the costs are one-time and the benefits recur with each new page, filter and overlay; the user weighed that and chose (c). `adopt-tanstack` decision 9 argued for (a); two of its claims did not survive the evidence: Router needs no server change while no path is added, and its size is 26.7 kB gzipped, not 30.3.

### 2. Code-based routes in one file, no plugin

`web/src/router.tsx` exports `makeRouter({ queryClient, history? })` and the route tree: a root route and seven page routes built with `createRoute`, each page loaded with `lazyRouteComponent(() => import(...), "ActivityPage")`, plus an index route `/` and a not-found handler that both redirect to `/usage` keeping the search (today's `history.replaceState(null, "", route + location.hash)` in `App.tsx`). `main.tsx` creates the router once and renders `RouterProvider` inside the `QueryClientProvider`. `declare module "@tanstack/react-router" { interface Register { router: ReturnType<typeof makeRouter> } }` gives the types.

Why not file-based routes: `@tanstack/router-plugin` brings Babel, `zod`, `chokidar` and a generated `routeTree.gen.ts` for seven static paths. Its one advantage, automatic code splitting, is what `lazyRouteComponent` already does here.

The root route's component is today's `App`: the skip link, `Nav`, `<Outlet />`, the palette. The title comes from the matched route's `staticData.title`; the focus move after a page switch keeps its effect, keyed on the matched pathname.

### 3. The search string is today's hash, written plainly

One pair of pure functions in `web/src/url.ts`, `parseSearch(str)` and `formatSearch(obj)`, is given to `createRouter({ parseSearch, stringifySearch })` and is also what the href builders use (`insightsHref`, `sessionHref`, the Limits link to Cost, the Errors "copy link", the palette's `resolve.ts`), so Router and every hand-built `href` agree by construction.

- Parse: `Object.fromEntries(new URLSearchParams(str))`. Every value is a string; validation gives it its type.
- Format: for each key, `true` is written `1`, a number as its digits, a string as it is; `undefined`, `null`, `""` and `false` are left out. No `JSON.stringify`: the default serializer would write `ex=%2212345%22`, which is not the same link.
- A key that is absent stays absent. Validation never fills in a default; the pages apply defaults when they read (`range ?? 30`), as `parseHash` does today. So `range=30` is in the URL only when something wrote it, which the Errors page relies on ("30 days, or the range the URL names").
- Key order is the old canonical order (`HEAD`, any other key, `TAIL`), kept in `formatSearch`. Changed during phase 1: the plan was to drop it, but keeping it makes every URL the app writes the old hash with `?` for `#`, character for character, so the old link and the new one are one string apart and every test expectation moved by one character. A URL spelled in another order is rewritten canonically by the next write, as `setHash` did.

Alternative considered: Router's default JSON serializer with `stripSearchParams` for defaults. Rejected: it changes the values in every link, not only the separator.

### 4. Validation: hand-written, per route, never throwing

- The root route validates the keys every page shares and the sheet keys (`project`, `range`, `source`, `auto`, `inspect`, `tool`, `mcp`, `skill`, `session`): the code is today's `parseHash` body, returning optional fields.
- Each page route validates its own keys in a `search.ts` beside the page (`pages/errors/search.ts` and so on), moved from where they are read today (`errors/view.ts`'s `readView`, `insights/drill.ts`, `sessOf` in `ActivityPage.tsx`, `h.raw.tip`, `h.raw.view`).
- A value that is not valid is dropped, not an error: an unknown `source` reads as all sources, an unknown `range` as absent. A validator that threw would put the route's error component in place of the page, for a mistyped link.
- A key no validator names is ignored: nothing reads it. It stays in the URL as written (changed in phase 2, below).

No validation library: seven small validators are less code than a schema dependency and its adapter, and Router accepts a plain function.

Phase 1 as built carries no route validator yet: the router's search is the record of strings `parseSearch` returns, which is what `hash.ts` called `raw`, and `parseView` (the old `parseHash`) reads it. Behaviour is the old behaviour with `?` for `#`, unknown keys carried along included. The typed validators arrive in phase 2, one page at a time.

Phase 2 as built:

- **Every validator accepts a value as the URL writes it or already typed**, because Router calls a route's validator both with the parsed URL and with the search a navigation passes.
- **A typed value is one `formatSearch` writes back as it was read.** Router lays the validated values over the search before it writes the URL. `formatSearch` drops `false`, so a flag whose URL text is `0` stays the string `"0"` (Errors: `sub`, `noise`); a flag whose URL text is `1` is `true`; ids and names stay strings. `router.test.tsx` opens each page with every key it reads and asserts the URL is unchanged.
- **Unknown keys and values that are not valid stay in the URL as written.** The plan was to drop unknown keys from the next write. Router does not do this: it spreads the validated values over the keys as they are, so a route match's search holds the typed values plus the rest as strings. Dropping them would need `setSearch` to know every route's validator, for a key nothing reads. A loader that reads a match's search (phase 4) must take its fields through the validator, not trust the record.
- **A value that is not valid reads as absent, everywhere.** Two small differences from `hash.ts` follow. On Errors, a key with a bad value no longer counts as "the URL names a view", so the saved view can fill in, and a link to an example with a bad `range` opens all time, as a link with no range does. An empty `range=` reads as 30 days, not all time.
- **Cost and Limits have no page-only key**, so they have no `search.ts`.

### 5. The old hash form redirects in the root route's `beforeLoad`

```ts
beforeLoad: ({ location }) => {
  if (location.hash.includes("=")) throw redirect({ to: location.pathname, search: parseSearch(location.hash), hash: "", replace: true });
}
```

It runs for the first load and for every later location change, so it also catches an old link typed into an open tab (a hash-only navigation, no reload). The hash is never sent to the server, so this can only be done in the client; it needs no server change and is the one piece of this migration that is never removed. A hash with no `=` is an anchor and is left alone, which keeps the hash free for section links later. When a URL has both a query string and an old-form hash, the hash wins whole: an old link names a complete view.

The redirect's search passes through the route's validation like any other, so an old link with a bad value lands on the same clean view as a new one.

### 6. The URL policy stays hand-written, in `url.ts`

Router has no option for three specified rules, so one module keeps them, over `router.navigate`:

```ts
setSearch(patch, { push }?)   // was setHash
closeSheets(patch)            // unchanged meaning
sharedSearch(search)          // was sharedHash: the four shared keys, for a link to another page
```

- `setSearch` computes the next search with `applyPatch` (kept as it is, with its tests, `VIEW_SCOPED` included), decides push or replace from `PUSH_KEYS` as today, and calls `router.navigate({ to: ".", search: next, replace: !push, resetScroll: false, state })`. `resetScroll: false` matters: with scroll restoration on, Router scrolls a new entry to the top by default, and a filter change must not move the page.
- The sheet count moves from `history.state.sheets` to the same field passed through `navigate`'s `state`, which Router stores beside its own keys. `closeSheets` reads it from `router.state.location.state` and calls `router.history.go(-n)`, or replaces when there is no count.
- The module takes the router from a setter called by `makeRouter` (`bindRouter(router)`), so `setSearch` stays a plain function that event handlers and non-component code (`drill.ts`, `session.ts`) can call, and each test's router binds itself.

Found while building phase 1, and now part of the module:

- **Writes are flushed.** Router's browser history updates its own location at once but writes to `window.history` in a microtask. `setSearch` and `go` call `router.history.flush()`, so `location` is current when they return, as it was with `pushState`.
- **The current URL is read from `router.history.location`**, not from Router's state, so two writes in one handler see each other.
- **A write that changes nothing still rewrites a URL spelled in another key order**, through `router.history.replace`: Router reads both spellings as one location and would write nothing. The Errors page relies on it when it writes its view back after loading.
- **`onNavigate(f)`** tells a page that the URL changed by a navigation (Back, Forward, `go`, an address typed in) and not by its own `setSearch`. The Errors page used `popstate` and `hashchange` for this, to restart its search and scroll to a linked example.

Alternative considered: search middleware on each route for the dropped day and `retainSearchParams` for the shared keys. Middleware runs when a link is built and cannot choose push or replace, so the policy would be split between two places; `sharedSearch` is five lines. Revisit if the shared keys ever differ by page.

### 7. Components read typed search, each only what it uses

- Every read comes from the router's location (`useRouterState({ select: s => s.location.search })`), not from a route match. Found while building phase 1: a match's search (`Route.useSearch()`) is committed after the route's load, a few microtasks after the write, and an input bound to the view (the Sessions search box) would then render its old value once and lose the caret's place. The location changes in the same task as the write. A real-browser check types in the middle of that box and passes.
- So a page reads its typed search through one hook over the location: `useSearchOf(validate, select?)` in `url.ts`, which applies a validator and an optional selector. Its result is compared deeply (Router's structural sharing), so a component re-renders only when what it selected changes. `h.raw.sub` became `search.sub`. `useView()` is `useSearchOf(parseView)`: the shared keys with their defaults. The route carries the same validator (`validateSearch`), so links and loaders are typed by it.
- Shared components read only what they show: `Filters` the four filter keys, `Nav` the shared query string and the project, the sheets the root keys. Opening a session sheet does not re-render `Filters` (a test counts its commits). The palette reads the whole record of keys, because it builds the next URL from the current one.
- `web/src/api.ts`'s `View` (project, range, automated, source) is built by `viewOf(rootState(search))`: `rootState` in `url.ts` applies the defaults, as `parseHash` does today.

### 8. Links

In phase 1 the navigation's tabs stay plain anchors that call `go(href)`, as before; they become `<Link>` in phase 4, where preloading needs it. Then the tabs are `<Link to={path} search={sharedOf(search)}>`: a real `href`, modified clicks left to the browser, `aria-current="page"` from `activeProps`, preload on intent (decision 11). Links whose `href` comes from data (a session's link to Activity, the Limits link to Cost) keep their builders over `formatSearch` and navigate with `router.navigate({ href })` in the existing `plain(e)` click handlers.

As built: the tabs are `<Link>` for the `href` and the preload, but a plain click still goes through `go(href)`: the tab's `onClick` prevents the default and `Link` then skips its own navigation. `go` holds the rules a page switch needs (scroll to the top only on a path change, the flushed history write, and `onNavigate`, which the Errors page depends on). `aria-current` is set by path alone, as before (`activeOptions={{ includeSearch: false }}`, no active class). `Link` adds `data-status="active"` to the current tab; nothing reads it.

### 9. View transitions, on a page change only

```ts
defaultViewTransition: { types: ({ pathChanged }) => pathChanged && !reducedMotion() ? ["page"] : false }
```

A filter or sheet change returns `false`, so only a page switch is animated; the reduced-motion check is the same `matchMedia` test `Drawer.tsx` uses. Browsers without `document.startViewTransition` ignore the option. This replaces `adopt-tanstack` task 5.1.

As built: the function also requires `fromLocation`. On the first load there is none and Router reports `pathChanged` as true, so every first load started a transition. The reduced-motion test is `motion()` from `components/chart.ts`, the one already exported. The navigation bar has its own `view-transition-name`, with its old snapshot hidden, so the bar does not fade with the page and the current tab switches at once. The crossfade is 150 ms. Checked in Chrome: one transition per page switch, none for a filter, a sheet or under reduced motion.

### 10. Scroll restoration

`scrollRestoration: true`. A page switch from the navigation is a new entry and starts at the top (Router's `resetScroll` default, today's `scrollTo(0, 0)` in `go()`); Back and Forward restore the entry's position; `setSearch` passes `resetScroll: false` (decision 6). On Back the page's data is normally still in the Query cache (`gcTime` 5 min, `staleTime: Infinity`), so the page has its full height when Router restores; after a longer absence the page loads again and the position can land short, which is accepted. Sheets are `<dialog>` elements that reset their own `scrollTop` on new content and are not registered.

As built: Router keys positions by history entry, so Activity visited twice keeps two positions. Turning the option on sets `history.scrollRestoration` to `manual`. Router makes one `scrollTo` after the entry renders and does not retry, so a page that is still loading lands short; a reload therefore starts at the top, because its data is not cached yet. Checked in Chrome: Activity scrolled to 500 px, Cost opened (starts at 0) and scrolled to 240, Back returns Activity at 500 and Forward returns Cost at 240. A filter change and a sheet make no scroll call.

### 11. Preload on intent, without blocking the page

`defaultPreload: "intent"` and `defaultPreloadStaleTime: 0`. Each page route except Live has a loader that starts its main query and does not wait for it:

```ts
loaderDeps: ({ search }) => viewOf(search),
loader: ({ context, deps }) => { void context.queryClient.prefetchQuery(queries.usage(deps)); },
```

Pointing at a tab loads the page's chunk and puts its payload in the Query cache; the page then mounts on data already there or in flight, and Query deduplicates the page's own `useQuery` onto it. The loader returns nothing and is not awaited, so navigation never waits for data and the pages keep their own loading states. Live has no loader: its queries are driven by the event stream and its pause rules. This needs `queries.ts` from `adopt-tanstack` phase 2.

Errors preloads its data too (the user left the choice to what serves the experience best, 2026-11-15). Its payload is the largest, but it has one query key for every filter (`["errors"]`) and is never stale until an ingest stores something, so pointing at the tab costs at most one request per ingest: the request the page would make on opening, made earlier. Preloading only its code would leave the app's slowest page as the one page that still opens on a wait.

As built:

- The loader's deps are the four view fields of the query key, read through the validators (`parseView`), so a sheet, a page-only key, or the automated toggle on Limits does not run it again. Cost starts Activity's query (`queries.usage`): the two pages share the payload.
- A loader also runs when a URL is opened, so the page's data request starts with its code instead of after it. In Chrome on a cold open of Cost, the chunk and `/api/usage` were requested 1 ms apart.
- A URL write that keeps the view does not run the loader again, so a page showing a failure and Retry is not asked again behind its back (a test pins this).
- The test harness's router for components rendered outside their route (`renderApp`) is built without loaders (`makeRouter({ loaders: false })`): those tests set any path, and a loader would fetch the data of a page that is not shown. `renderRouter`, the whole app, keeps them.

Alternative considered: awaited loaders with `pendingComponent`. Rejected: it would replace the specified landing and loading behaviour with Router's.

### 12. Issue #69

Issue #69 asks for page switches that do not block and for cached page models. This change gives it the view transition (decision 9), the page's code loaded before the switch commits (Router resolves the lazy component first, so there is no empty fallback), and data present at mount (decision 11). It does not make the new page's first render concurrent: React renders Router's state change synchronously (see the evidence table). Phase 3 measures the switch to the Errors page, the largest, against a copy of a real store; if the render is still a long task, caching the derived page model by payload identity (the issue's second proposal, independent of any router) becomes a follow-up issue. Issue #69 closes with this change either way, with the measurement recorded.

### 13. Tests: one router per test, over jsdom's history

Changed during phase 1. The plan was a memory history per test; the tests run on jsdom's browser history instead, as the app runs on the browser's. Reasons: it is the history type production uses, so the tests exercise the same code (the batched writes above were found this way); and the 400 lines that set the URL with `history.replaceState` and assert `location`, `history.length` and `history.back()` keep their meaning, moving only from `location.hash` and `#` to `location.search` and `?`. `test-setup.ts` destroys each test's routers and resets the URL, as it reset the URL before.

`testing.tsx` gives two ways to render:

- `renderApp(ui, client?)`, for a component or a page on its own: the Query client and the router's context, without the route tree's rendering. The component shows at once, so the 221 existing `renderApp` calls stay synchronous. The router still loads on every history change, so the old-hash redirect runs.
- `renderRouter(client?)`, for the whole app as `main.tsx` mounts it (`RouterProvider`): used by `App.test.tsx`, `visits.test.tsx`, `Nav.test.tsx` and the new `router.test.tsx`, which covers the seven paths, canonical URLs unchanged by loading, `/` and unknown paths, the old hash form, an unknown key, and scroll on a page switch.

`hash.test.ts` became `url.test.ts`: every case ported, plus cases for the flush, the canonical rewrite, `onNavigate` and a `useView` that follows a write in the same `act`.

### 14. Devtools

`@tanstack/react-router-devtools` is mounted in the root route under `import.meta.env.DEV` through a lazy import, beside the Query devtools. `tests/test_web_build.py` asserts that no built chunk contains `router-devtools`.

### 15. Server and CSP

No server code changes. Router in a client-only app adds no inline script and makes no request, so the CSP is unchanged. One Python test is added: `GET /usage?project=foo&range=7` answers the page with the same headers as `GET /usage`. That pins the property this design depends on.

### 16. Bundle

Expected: +26.7 kB gzipped (+76 kB minified) in the entry chunk, from 77.9 to about 105 kB gzipped before `adopt-tanstack`'s own additions; `hash.ts` and `App.tsx`'s route picking give back under 1 kB. The app is served from the loopback interface, so the cost is parse time and wheel size, not transfer. The close-out task records the measured figures here.

Measured after phase 1 (2026-11-15), all JS chunks, against `main` at 2572a72: 767,263 B minified and 249,677 B gzipped before; 841,842 B and 276,849 B after. That is +74,579 B minified and +27,172 B gzipped, in 22 chunks where there were 21.

### 17. A placeholder while a page first loads

The user asked for a loading animation of gray blocks (2026-11-15), shown whenever a page has nothing to show yet: while its code loads or while its first data loads. Today that state is a heading, "Loading activity…", over an empty page.

- One component, `components/PageSkeleton.tsx`, with its CSS: a heading line, a row of summary blocks, a panel and a few rows, in the page's own width. One outline for every page; seven hand-drawn outlines would be seven things to keep in step with seven pages.
- It is the router's `defaultPendingComponent` (code loading) and what each page renders while it has no data and no error (first data loading). Both render the same markup inside `<main id="content" aria-busy="true">`, so the change from "code loading" to "data loading" moves nothing on screen.
- No flash on a fast load: the blocks fade in through a CSS animation with a 150 ms delay, the threshold `useLanding` already uses for its "slow" look. No timer in JavaScript.
- The sheen is a moving background gradient; under `prefers-reduced-motion: reduce` it does not move; under `forced-colors: active` the blocks get a border, since backgrounds are dropped there. Colours come from the theme's tokens, for light and dark.
- The blocks are `aria-hidden`. The page heading stays in the document, visually hidden, with its "Loading activity…" text: it is where focus lands after a page switch, and it is what a screen reader reads.
- A page that already shows data keeps today's behaviour while new data loads (the old figures stay, dimmed after 150 ms). A failed first load replaces the blocks with the failure message and Retry.

As built: on a first load the blocks stand in for the page's header too (heading and filters), and the page does not take its dimmed "loading" look, which belongs to a page with figures on screen. Live keeps its heading and toolbar and shows the blocks below them. The blocks use the `--track` and `--border` tokens; no token was added. One limit: when a page's code takes longer than Router's pending delay (1 s), Router's pending component shows the blocks, and the page then mounts its own, whose fade-in starts again. On a normal load the code arrives well inside the delay and only the page's blocks show.

Alternative considered: a placeholder on every load. Rejected by the user in favour of first load only; it would replace the specified "old numbers stay on screen" behaviour on four pages.

## Edits made in `adopt-tanstack`

That change is archived (`openspec/changes/archive/2026-11-15-adopt-tanstack/`, PR #81). Before it was archived, its owner removed its phase 5 (task 5.1) and pointed its proposal and design decision 9 at this change. Page transitions, scroll restoration on Back and issue #69 belong to this change.

## Risks / Trade-offs

- [The redirect is the only thing keeping old links alive] → It is one `beforeLoad`, covered by tests for the four legacy shapes and by a real-history test, and a comment says it is never to be removed.
- [`resetScroll` forgotten on a search change scrolls the page to the top on every filter] → Only `setSearch` navigates within a page, it always passes `resetScroll: false`, and a test scrolls, changes a filter and asserts the position.
- [Router rewrites the URL on load, adding or reordering keys] → Validators add no defaults (decision 3); a round-trip test opens each page with a canonical URL and asserts the href is unchanged after load.
- [The sheet count is lost because Router owns `history.state`] → It travels in `navigate`'s `state`; the existing `closeSheets` tests (open two sheets, close, Back does not reopen) run against the router.
- [Two rewrites of the same tests] → This change starts only after `adopt-tanstack` phase 4 merges.
- [Preload asks the server for a payload the user never opens] → One request per page and view until the next ingest, deduplicated and cached by Query; Router waits 50 ms of hover before it starts. The Errors payload, the largest, is asked for at most once per ingest (decision 11).
- [Dependency surface] → Eight new runtime packages, one of them (`@tanstack/react-store`) alpha, in an app whose store holds secrets. Versions are exact, the CSP forbids any request off the origin, and upgrades are deliberate.
- [Router releases are frequent, and `history.state.key` is deprecated for v2] → Pin exact versions; the app reads only `__TSR_key` through Router's own API.
- [jsdom is not a browser] → The final verification walks every page, old links, Back and Forward, sheets and scroll in Chrome and Safari against a copy of a real store.

## Migration Plan

Each phase is one PR, passes `cd web && npm run check` and `uv run python -m unittest discover -s tests`, commits the build, and can be reverted alone.

1. **Router and the query string.** Dependencies, `router.tsx`, `url.ts` with the serializer, the root validator, the redirect and the policy functions; `main.tsx` and the root component; every call site moved from `hash.ts` to `url.ts` with the same shapes (`useView()` returns today's `HashState`-like object, `raw` included, built from the search); tests on `renderAt`; spec deltas; README, CHANGELOG, the demo recorder. The URL form changes for every page in this one phase, because the shared keys travel between pages and cannot be half moved. Revert: restore `hash.ts`, `App.tsx`, `main.tsx`.
2. **Typed search per page.** One page at a time: its `search.ts` validator on its route, `raw[...]` reads replaced by typed fields with selectors; `raw` is deleted when the last page is done. Revert per page.
3. **Navigation.** View transitions, scroll restoration, the #69 measurement. Revert: two router options.
4. **Preload.** `defaultPreload` and the loaders. Revert: remove them.
5. **Close-out.** Dead code, measured bundle sizes, final verification in real browsers.

## Open Questions

None. The two raised with the proposal were answered by the user on 2026-11-15: the Errors page preloads its data (decision 11), and a page shows a placeholder while it first loads (decision 17).
