# Tasks

Privacy for every group: `~/.claude/usage-data/` and `data/` hold transcript summaries. Never copy a real facet or session-meta file into `tests/`, `web/src/__fixtures__/`, `tools/demo/` or a commit, and never print one. Every fixture below is written by hand and is synthetic.

## 1. Raw usage-data table and reader

- [ ] 1.1 Add `usage_files` to `RAW_SCHEMA` (design Decision 1), and add `DEFAULT_USAGE_DATA = ~/.claude/usage-data` to `store.py`. Verify with a `test_store` case that `open_store` on an existing store made before this change creates the table and leaves other tables unchanged.
- [ ] 1.2 Add synthetic fixtures under `tests/fixtures/usage-data/`:
  - three facets: one fully achieved with no friction, one partially achieved with two friction categories, one with an unknown outcome `abandoned`;
  - their session-meta files, one with a worktree `project_path` and one for a session that has no transcript fixture;
  - one malformed facet, one facet without `session_id`, and a `report.html`.
  Verify that the files parse as intended and hold no real path, session id or text: a test asserts that no fixture session id appears in `~/.claude/usage-data` file names when that directory exists.
- [ ] 1.3 Create `insights.py` with `ingest(cur, root, projects)`: stat `facets/*.json` and `session-meta/*.json`, skip unchanged `(size, mtime)`, store changed files verbatim, ignore `report*.html`, and count skipped files through the shared `unreadable` map (design Decision 3). Verify with `test_insights` cases: first ingest stores 3 facets and their meta and skips 2; a second ingest reads nothing; a rewritten facet replaces its row; a fixed malformed file is stored next time; a missing directory returns zero counts; a deleted file keeps its row; log output holds paths only, never file content (assert with a sentinel string in a fixture).
- [ ] 1.4 Call `insights.ingest` from `store.ingest` after the transcript sources, with `roots.get("insights")`, adding `usage_files` and `usage_skipped` to the stats. Add `--usage-data` to `app.py` and pass it as `roots["insights"]`. Verify with a `test_store` case that a reader exception does not fail transcript ingest, and a `test_app` case that `ingest` with `--usage-data` pointing at the fixtures prints the counts.

## 2. Derived facet tables and project attribution

- [ ] 2.1 Add `session_facets`, `facet_counts` and `session_meta` to `DERIVED` / `DERIVED_SCHEMA` (design Decision 4). Implement `insights.derive`, which replaces a session's rows on re-derive. Verify with `test_insights` cases: friction counts of a rewritten facet leave no stale rows; a non-integer count is dropped; the median response time is stored and the list is not.
- [ ] 2.2 Resolve `session_meta.project` through `Projects.get(cur, project_path)` and take the project as `coalesce(sessions.project, session_meta.project, '(unknown)')` (design Decision 5). Verify with `test_insights` cases for the spec scenarios: a stored session's project wins; a worktree path with no transcript maps to its repository (use a temporary git repository with a worktree); a facet with neither counts under `(unknown)`.
- [ ] 2.3 Call `insights.rederive(cur)` from `store.rebuild` after `limits.rederive_polls`. Verify with a `test_store` case that `rebuild` with the usage-data directory removed yields the same `session_facets`, `facet_counts` and `session_meta` rows as incremental ingest.

## 3. Insights payload and endpoint

- [ ] 3.1 Implement `insights.payload` with `coverage`, `outcomes`, `helpfulness`, `session_types`, `satisfaction`, `friction`, `goals` and `sessions` (design Decision 6), using `metrics.scope()` / `metrics.view()` over the facet subquery. Verify with `test_insights` cases for each spec scenario: the 117/24/7/1/1 outcome mix as 78/16/5/1/1%; an unknown outcome kept; satisfaction signals summed; helpfulness in fixed order; friction ranked with session counts; goals and session types; `project`, `range` and `automated` narrow every list; orphan facets are listed with `in_store: false`; coverage counts Claude Code and Codex sessions apart; `source=codex` returns coverage only; an unknown source raises `ValueError`; `underlying_goal` and `primary_success` are absent.
- [ ] 3.2 Wire `/api/insights` and the `/insights` page path in `app.py`. Verify with `test_app` cases: the page serves, the endpoint returns the payload for the fixture store, and `source=grok` returns 400.
- [ ] 3.3 Add the insights payload to `tests/test_web_fixtures.py` from a synthetic test store, then regenerate the page-test fixtures with `uv run python -m unittest tests.test_web_fixtures`. Verify that `web/src/__fixtures__/insights.ts` (and `insights-empty.ts` for a store without facets) are written, a second run leaves them unchanged, and they hold only synthetic text.

## 4. Insights page

- [ ] 4.1 Add `/insights` to `App.tsx` `ROUTES` (title `Insights · AI Ledger`) and `Nav.tsx` `PAGES` (label Insights), and add `insightsUrl` and the payload types to `api.ts`. Verify with `Nav.test.tsx` (Insights carries project, range and source from Cost) and a palette `suggest.test.ts` case that `>insights` is offered.
- [ ] 4.2 Build `pages/insights/InsightsPage.tsx` with the shared filter bar and the lead: analysed counts, the not-analysed count with "run `/insights` to refresh", the Codex count, the newest facet time, and the "no `/insights` data" state that names the directory. Verify with page tests on both fixtures and on a Codex-source render.
- [ ] 4.3 Build the outcome, satisfaction and helpfulness, friction, and goal and session-type sections, each with a "Model-judged" tag. Category names are shown with spaces and the raw name in the title. Verify with page tests: every facet section heading carries the tag; the unknown outcome row shows; "no friction reported" shows for a view without friction.
- [ ] 4.4 Build the session list, newest first, with the friction-only toggle. Each in-store row links to `/usage#session=<id>&range=0`, and orphans have no link. Verify with page tests: the toggle narrows the rows; a click opens Activity with the session sheet; an orphan row has no anchor. Also check the page in the light and dark themes and at phone width.
- [ ] 4.5 Run `cd web && npm run check`, commit the rebuilt `web/dist/`, and verify that `tests/test_web_build.py` passes.

## 5. Demo store and docs

- [ ] 5.1 Give `tools/demo/seed.py` synthetic facets and session meta for part of the Claude sessions it makes (made-up summaries and friction text, a mix of outcomes, some sessions left unanalysed). Verify that `uv run tools/demo/seed.py` and `uv run tools/demo/serve.py` show a populated Insights page with a non-zero "no facet" count.
- [ ] 5.2 Update `README.md`:
  - the Insights page in Pages and the tour list;
  - the `--usage-data` option;
  - that facets are model judgments from `/insights`, read from `~/.claude/usage-data`, and that only Claude Code sessions are covered;
  - the Privacy section: facets and session meta hold transcript summaries and stay in the git-ignored store;
  - `insights.py` in Files.
  Verify that the documented commands run as written.

## 6. Integration

- [ ] 6.1 Copy `data/ai-ledger.duckdb` to a scratch path. Run `uv run app.py ingest --db <copy>` (and never the live store). Verify that it reports about 150 facets and 586 meta files with 0 skipped. Then run `rebuild --db <copy>` and verify that the facet counts are unchanged. Print counts only, never facet text.
- [ ] 6.2 Serve the copy on a free port and check in the browser: `ai-ledger` facets include worktree sessions; the outcome counts for All match the totals in the design's Context; Codex shows its message; a session link opens its sheet on Activity.

## Workflow follow-up

- Propose the follow-up change for per-project `CLAUDE.md` / `AGENTS.md` suggestions with `claude -p` (checked against project and global instructions, conflicts flagged, tagged project or global, stored as accepted or dismissed). First check whether `claude -p "/insights"` runs headless, which the "start `/insights` from the app" idea depends on.
- On archive, update the `dashboard-app` Purpose to name the Limits and Insights pages.
- Re-record the README GIFs to include Insights, from the demo store.
