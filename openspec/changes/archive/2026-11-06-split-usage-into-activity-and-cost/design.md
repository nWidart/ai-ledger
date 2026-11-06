# Design

## Context

- `app.py` serves two hand-written pages. `page()` reads `usage.html` or `dashboard_template.html` from disk on every request and replaces `<!--NAV-->` with `nav.html`. `theme.css` is the one shared asset (`ASSETS`).
- `nav.html` carries a script that the pages reach through `window.appnav`: project color slots (`setOrder`, `color`, `dot`, `hasHue`), the shared `#project=…&range=…` hash, and Refresh with ingest status.
- Both pages hold all their state in the URL hash and `history`, with Back retracing filter and sheet changes. Errors keeps three localStorage keys: `claude-errors-fixes` (applied-fix markers), `claude-errors-view` and `claude-errors-mode`.
- Charts are hand-written SVG with keyboard reading, tooltips and live-region announcements; motion follows `prefers-reduced-motion`.
- `/api/usage` returns one payload for the whole Usage page. Every usage query filters through `metrics.view()`, except `previous_period()`, which builds its own project and date clause. `/api/errors` returns every error, and Errors filters on the client.
- The app is Python with `uv`, one dependency (`duckdb`), no build step. Tests are `unittest` in `tests/`.

## Goals / Non-Goals

**Goals:**
- One frontend codebase where navigation, filters, URL state, project colors, formatters, sheets and charts exist once and all three pages use them.
- Same behavior on Errors, and on everything Activity and Cost take over from Usage, including keyboard, screen reader, phone layout and reduced-motion behavior.
- The app keeps running from a clone with only Python and `uv`.

**Non-Goals:**
- Redesigning Errors. It is ported as is.
- Splitting `/api/usage` into per-page endpoints. Both pages read the same payload.
- Server-side rendering, a router library, a CSS framework or a chart library.
- Changing the store schema.

## Decisions

### React 19, TypeScript and Vite, in `web/`
`web/` holds `package.json`, `vite.config.ts`, `tsconfig.json`, `src/` and the build output `dist/`. Vite gives TypeScript, JSX, CSS imports and hashed assets with almost no configuration.
- *Alternative: Preact or Lit, which are smaller.* The pages are local and bundle size barely matters. React has the widest component and testing support.
- *Alternative: keep vanilla JS and share ES modules.* This removes the copied code without a framework, but the pages render by rebuilding `innerHTML` strings and re-binding handlers (`onPick`, `data-act` indexes). That pattern is where most of the code and the bugs are. Components fix the pattern, not just the duplication.

### One single-page app with three pages, no router library
Vite builds one `index.html`. `app.py` serves it for `/usage`, `/cost` and `/errors`. `App` picks the page from `location.pathname`. The nav links switch pages with `history.pushState`, so the `/api/usage` payload stays in memory between Activity and Cost, and switching tabs needs no reload. A full load of any of the three URLs works the same way.
- *Alternative: three Vite entry points (a multi-page app).* Each tab switch reloads and refetches. Shared code still works, but we lose the shared payload.
- *Alternative: React Router.* Three fixed paths and hash state do not need it.

### URL state as one hook over the hash
`useHashState()` reads and writes `URLSearchParams` on `location.hash`. It uses `pushState` for changes that Back should retrace (filter, sheet open or close) and `replaceState` for the rest, as today. It keeps the existing keys (`project`, `range`, `session`, `inspect`, `ex`, `cat`) and adds `auto` for automated sessions. The nav carries `project`, `range` and `auto` across pages. Copied URLs from before the change keep working.

### Data: plain `fetch` behind a small cached hook
`useApi(url)` returns `{data, error, loading, retry}` and caches responses in memory by URL. Refresh and the 60-second ingest status poll clear the cache when `last_ingest` changes. Payload types are written by hand in `src/api.ts` from `metrics.py`.
- *Alternative: TanStack Query.* It would do the same with more features we do not use. We can add it later if the hook grows.
- *Alternative: types generated from Python.* There is no schema to generate from. A small hand-written file is cheaper, and drift shows up as a type error where the field is used.

### Styling: `theme.css` as global tokens, plain CSS per component
`theme.css` moves to `web/src/theme.css` unchanged and is imported once. Page and component styles move into `.css` files next to their components. Class names stay as they are, so the port is mostly mechanical.
- *Alternative: CSS modules or Tailwind.* Either one rewrites every selector for no change in behavior.

### Charts stay hand-written SVG components
The cost chart, the Errors rate chart, the session timeline, sparklines and the new work chart become components over shared helpers: day series, `niceStep` scales, tooltip and keyboard reading. This keeps today's accessibility behavior, which a chart library would not match without the same amount of work.

### Committed build, with a guard against a stale build
`npm run build` writes `web/dist/` and a `web/dist/source-hash.txt` stamp: a hash of `web/src/**`, `index.html`, `package-lock.json` and the Vite config. `web/dist/` is committed. A Python test recomputes the hash and fails if it does not match the stamp, so `uv run python -m unittest` catches a commit with changed sources and no rebuild.
- *Alternative: build at startup or git-ignore the build.* Either one makes Node a runtime requirement, which the user ruled out.

### Serving the build from `app.py`
`PAGES` maps `/usage`, `/cost` and `/errors` to `web/dist/index.html`. `/assets/<name>` serves files from `web/dist/assets/` with a content type by extension. Names are resolved inside that directory, and `..` or absolute paths get a 404. The host check and `no-store` on pages and the API stay as they are. Hashed assets get `Cache-Control: max-age=31536000, immutable`. `page()`, `nav.html` and the `<!--NAV-->` injection go away.

### Development server
`npm run dev` runs Vite on `127.0.0.1:5173` and proxies `/api` to `127.0.0.1:8765` with `changeOrigin`, so `checked_host` sees its own host. Dev runs in another origin, so fix markers saved there are separate from the app's. The README says so.

### Automated sessions: one exclusion clause in `metrics.py`
`AUTOMATED_PROJECTS = ("observer-sessions",)` is a constant in `metrics.py`. `view()` gains an `automated=False` argument and adds `AND (? OR s.project NOT IN (…))` to the filter that every usage query uses. `previous_period()` is changed to build its filter from the same helper, so the comparison excludes the same sessions. `project_list()` and `session_list()` take the same flag, so the project picker and the sessions table match. `project_order()` always leaves automated projects out, so they never take one of the six project hues. `/api/usage` and `/api/sessions` read `automated=1`. Errors is not filtered: observer sessions make almost no tool calls.
- *Alternative: detect automation by session shape (no tool calls, one prompt).* That also catches short manual sessions. A named list is explicit and easy to extend.
- *Alternative: drop the sessions at ingest.* That loses data. The store keeps everything.

### Daily work counts in `/api/usage`
`usage()` gains `daily_work`: one row per day with `sessions` (distinct sessions with a request that day), `prompts`, `commits` (same rule as `totals.commits`) and `failed_calls`. Each comes from its own grouped query through the same `W` filter, merged by day in Python. Activity's work chart and "select a day" use it. The existing `/api/sessions?day=` serves the day list.

### Page composition
- **Activity** (`/usage`): work lead, attention summary, work vitals, work-per-day chart, then the drawers: Sessions, Project metrics (work columns), Tools, MCP/skills/hooks, Error loops.
- **Cost** (`/cost`): cost lead with sparkline and windows, What changed, insight cards (biggest spender, cost per commit, peak day, cache and subagent cost), cost/tokens chart, where the spend went, models and effort, then the drawers: Tokens and cache (today's All totals), Cost by project, Most expensive sessions.
- **Shared**: `Nav`, `Filters` (project picker, range, automated toggle), `ProjectSheet`, `SessionSheet` (timeline, events, first prompt), `Ledger`, `Drawer`, `InsightCard`, project color slots, and formatters (`usd`, `big`, `pct`, `dur`, `dayLabel`, `plural`).

The mockup that set this split is in the exploration notes. The specs set what each page must show.

## Risks / Trade-offs

- [Errors loses behavior in the port: phone sheet, Show full, incidents, fix markers, mini chart, focus handling] → Port Errors first, against a written parity checklist taken from the README, the `dashboard-app` spec and the current page. Check it in the browser at desktop and 390px before Activity and Cost start.
- [The committed build drifts from its sources] → The source-hash test, and `npm run check` (typecheck, Vitest, build) listed in the README and in the tasks before each commit.
- [A big-bang switch breaks the app part way through] → The old pages stay on their routes until every new page passes its parity check. The route switch and the file removal are one last commit that can be reverted alone.
- [Hand-written API types drift from `metrics.py`] → A Python test dumps one `usage()` and one `errors_payload()` from the test fixture to `web/src/__fixtures__/`. Vitest type-checks the fixtures against `api.ts` and renders each page from them.
- [Excluding observer sessions hides real cost] → Their cost is small ($4 in 30 days). The toggle is on every page, and the state is in the URL.
- [Node becomes a contributor requirement] → It is needed only for UI changes. The README splits "run" from "develop".

## Migration Plan

1. Scaffold `web/` and its shared modules. The old pages keep serving.
2. Port Errors and check it against the parity list in `npm run dev`.
3. Build Activity and Cost, and add the `metrics.py` changes (each has tests).
4. In one commit, point `/usage`, `/cost` and `/errors` at the build, add `/assets/`, and delete `usage.html`, `dashboard_template.html`, `nav.html` and the root `theme.css`.
5. Rollback: revert that last commit. The old pages come back, and the API additions stay compatible with them.

Fix markers and the other localStorage keys keep their names. The origin stays `127.0.0.1:8765`, so saved state carries over.

## Open Questions

- Whether "What changed" should get an Activity version (commits or failures by project). It can be added later without changing this split.
