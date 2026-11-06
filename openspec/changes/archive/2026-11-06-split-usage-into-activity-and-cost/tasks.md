# Tasks

## 1. API: automated sessions and daily work

- [x] 1.1 Add `AUTOMATED_PROJECTS` and an `automated` flag to `metrics.view()`. Move `previous_period()` onto the same filter helper. Verify with a `tests/test_metrics.py` test where a fixture `observer-sessions` session is left out of totals, sessions, by_project, the previous period and changes by default, and counted with `automated=True`.
- [x] 1.2 Pass the flag through `project_list()` and `session_list()`, and leave automated projects out of `project_order()` always. Verify with tests that the project picker list and `/api/sessions` rows match the flag, and that `project_order` never lists `observer-sessions`.
- [x] 1.3 Read `automated=1` in `/api/usage` and `/api/sessions` in `app.py`. Verify that `curl '127.0.0.1:8765/api/usage?range=30'` and `…&automated=1` differ in `totals.sessions` by the observer-session count.
- [x] 1.4 Add `daily_work` (day, sessions, prompts, commits, failed_calls) to `usage()`. Verify with a test that a fixture day's counts match its sessions, prompts, successful commits and failed calls, and that the sums equal `totals`.

## 2. Frontend scaffold

- [x] 2.1 Create `web/` with `package.json` (React 19, TypeScript, Vite, Vitest, Testing Library), `tsconfig.json`, `vite.config.ts` (dev server on `127.0.0.1:5173`, `/api` proxied to `127.0.0.1:8765` with `changeOrigin`) and `index.html`. Add `web/node_modules/` to `.gitignore`. Verify that `npm install` and `npm run dev` serve an empty app that can fetch `/api/status` through the proxy.
- [x] 2.2 Add npm scripts `build` (Vite build plus a `dist/source-hash.txt` stamp over `src/**`, `index.html`, `package-lock.json` and `vite.config.ts`) and `check` (`tsc --noEmit`, `vitest run`, `build`). Verify that `npm run check` passes and writes the stamp.
- [x] 2.3 Add `tests/test_web_build.py`, which recomputes the source hash and compares it with `web/dist/source-hash.txt`. Verify that it passes after a build and fails after an edit to a file in `web/src/` with no rebuild.

## 3. Shared frontend foundation

- [x] 3.1 Copy `theme.css` to `web/src/theme.css` and import it once. Port the formatters (`usd`, `usd0`, `big`, `num`, `pct`, `dur`, `dayLabel`, `plural`, `mult`, `median`, `niceStep`) into `src/format.ts`. Verify with Vitest cases taken from the current pages' outputs.
- [x] 3.2 Write `useHashState()` over `location.hash` with push and replace semantics and the keys `project`, `range`, `session`, `inspect`, `ex`, `cat` and `auto`. Verify with Vitest that a pre-change URL parses to the same state, and that a filter change pushes while other changes replace.
- [x] 3.3 Port the project color slots from `nav.html` (top 6 hues by `project_order`, hashed slot with a step on clash, grey for the rest) into `src/colors.ts`. Verify with Vitest that a project keeps its hue when projects below it reorder.
- [x] 3.4 Write `src/api.ts` payload types and a `useApi(url)` hook with an in-memory cache that clears when `last_ingest` changes. Add a Python test that writes `usage()`, `session()` and `errors_payload()` output from the test fixture to `web/src/__fixtures__/`. Verify that `tsc` accepts the fixtures as the typed payloads.
- [x] 3.5 Build `Nav`: brand, Activity, Cost and Errors tabs with `aria-current`, client-side switching that keeps `project`, `range` and `auto`, the filter chip, ingest status, and Refresh with its failure state and phone layout. Verify with a Testing Library test that switching tabs keeps the hash filter and marks the current tab.
- [x] 3.6 Build `Filters` (project picker with color dot, range segments, include-automated toggle), `Drawer`, `Ledger`, `InsightCard` and the `Sheet` shell (dialog, Back, focus return, Escape). Verify with Testing Library tests for keyboard selection, the toggle writing `auto=1`, and the sheet returning focus to its opener.

## 4. Errors page port

- [x] 4.1 Write `web/src/pages/errors/PARITY.md` from the README, the `dashboard-app` spec and `dashboard_template.html`. It lists every behavior to keep: KPIs, rate chart with type colors and legend, the table, category detail with fix and snippet, incidents and recovery, examples with search, Show full with retry, Copy URL, `#ex` and `#cat` permalinks, applied-fix markers with the before and after rate, the mini chart, the phone sheet with pinned search, live-region announcements, and the `claude-errors-*` localStorage keys. Verify that each line names where the current page does it.
- [x] 4.2 Port the Errors data logic (filtering, buckets, series, `change`, incident grouping, type colors) into typed modules. Verify with Vitest against the errors fixture, including incident recovery and an anchor on `today`.
- [x] 4.3 Port the Errors page components on top of the shared foundation. Verify each PARITY.md line in `npm run dev` at desktop width and at 390px, and check it off in the file.
- [x] 4.4 Check that a fix marker saved by the old page shows on the new one. Verify by saving a marker on `127.0.0.1:8765/errors`, building, serving the new page on that origin through a temporary route, and seeing the marker and its before and after rate.

## 5. Shared session and project sheets

- [x] 5.1 Port `ProjectSheet` (summary, models, most expensive sessions, filter-to-project button) and `SessionSheet` (first prompt with Source and the whole prompt, timeline with context size, tool calls, failures, compactions and commits, events list with Show all, error-loop links to Errors, commits, models, tools). Verify with Testing Library tests rendered from the session fixture, and in the browser that keyboard reading of the timeline and event selection work.

## 6. Activity page

- [x] 6.1 Build the work lead and the attention summary from the `usage-dashboard` delta, with actions that open the matching drawer, including the near-limit sessions and the flaky-tools sort. Verify with Testing Library tests for the "error loops present" and "nothing found" scenarios, and that the lead has no cost figure.
- [x] 6.2 Build the work vitals and the work-per-day chart from `daily_work` (Commits, Prompts and Sessions segments, failed calls as a line, keyboard reading, selecting a day opens the Sessions drawer for that day). Verify with a Vitest series test and a Testing Library test of the day selection.
- [x] 6.3 Port the drawers: Sessions (search, near-limit filter, day chip, paging, cost column kept), Project metrics with work columns (sessions, tokens, subagents, tokens per prompt, commits, errors per 100, error loops), Tools (flaky first when asked), MCP/skills/hooks, and Error loops linking to Errors. Verify in the browser at desktop width and 390px that each opens, loads and opens the right sheet, and that Back retraces sheet changes.

## 7. Cost page

- [x] 7.1 Port the cost lead (count-up, windows with active days, thin-history chip), the sparkline and What changed (day strips, new chips, top 8 and Show all). Verify with Testing Library tests for the thirty-day, thin-history and new-project scenarios in the `cost-dashboard` spec.
- [x] 7.2 Port the insight cards (biggest spender, peak day, cost-per-commit outlier with Compare projects, cache and subagent cost share), the cost/tokens chart stacked by project with Other, where the spend went, and models and effort. Verify with tests for the outlier and no-commits scenarios and the unpriced-model chip.
- [x] 7.3 Build the drawers: Tokens and cache (tokens by kind, cache read and writes, cache hit and 1-hour share, per-prompt cost), Cost by project (cost, cost per commit, cost per prompt, cache hit, 1-hour writes, sorted by cost per commit when asked), and Most expensive sessions. Verify in the browser at desktop width and 390px, including the project and session sheets and Back.

## 8. Switch the app to the build

- [x] 8.1 In `app.py`, serve `web/dist/index.html` for `/usage`, `/cost` and `/errors`, and serve `web/dist/assets/` at `/assets/` with content types and immutable caching. Reject paths that leave the directory. Verify with `tests/test_app.py`: each page returns 200 HTML, an asset returns its type, `/assets/../app.py` returns 404, a foreign Host still gets 403, and `/` redirects to `/usage`.
- [x] 8.2 Delete `usage.html`, `dashboard_template.html`, `nav.html` and the root `theme.css`, and remove `page()` and `ASSETS`. Verify that `uv run python -m unittest discover -s tests` and `npm run check` pass and that nothing references the deleted files (`grep`).
- [x] 8.3 Update the README: the three pages, the automated-sessions toggle, the `web/` files, and a Develop section (`npm install`, `npm run dev` with the separate-origin note for fix markers, `npm run check` before committing, the committed `web/dist/`). Verify that the documented commands run as written.

## 9. Integration check

- [x] 9.1 Run the app from a shell with no Node on `PATH`. Verify that Activity, Cost and Errors load, that Refresh works, and that switching tabs keeps project, range and the automated toggle.
- [x] 9.2 Open URLs copied before the change (`/usage#project=…&range=…&session=…`, `/errors#ex=…`, `/errors#cat=…`). Verify that each opens the same view, that applied-fix markers still show, and that Back retraces filter and sheet changes on Activity and Cost.

## Workflow follow-up

- At archive, update the Purpose of `openspec/specs/usage-dashboard/spec.md` to describe the Activity page (work done and where Claude struggled), since a delta cannot change it.
- Archive the change once review passes, and check that `openspec validate --strict` passes on the archived specs.
