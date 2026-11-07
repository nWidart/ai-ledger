# Design

## Context

See proposal.md for why. Specs: `session-insights`, `insights-dashboard`, and the `dashboard-app` delta.

Current state that shapes the approach:

- `store.py` has two layers.
  - Raw: `files`, `raw_lines`, `projects_by_cwd` and `limit_polls`. Kept verbatim, never deleted.
  - Derived: the tables in `DERIVED`, rebuilt by `rebuild()`. `limit_snapshots` is re-derived from `limit_polls` by `limits.rederive_polls(cur)` at the end of `rebuild()`; that is the model for a raw table that is not transcript lines.
  - `ingest(con, roots)` walks `SOURCES` (`claude`, `codex`) and skips a root that is not a directory. It records `(size, read_offset, mtime)` per file in `files`.
  - `Projects.get(cur, cwd)` resolves a cwd to a project once, through `resolve_project` (git common dir, worktree layouts, aliases), and caches it in `projects_by_cwd`.
- `~/.claude/usage-data/` (checked 2026-11-07, keys and value types only; contents not read):
  - `facets/<session_id>.json`, 150 files. Keys: `session_id`, `underlying_goal`, `goal_categories {name: count}`, `outcome`, `user_satisfaction_counts {signal: count}`, `claude_helpfulness`, `session_type`, `friction_counts {category: count}`, `friction_detail`, `primary_success`, `brief_summary`.
  - Values seen. Outcome: `fully_achieved` 117, `mostly_achieved` 24, `partially_achieved` 7, `not_achieved` 1, `unclear_from_transcript` 1. Session type: `multi_task`, `iterative_refinement`, `single_task`, `quick_question`. Helpfulness: `essential`, `very_helpful`, `moderately_helpful`, `slightly_helpful`, `unhelpful`. Satisfaction signals: `likely_satisfied`, `satisfied`, `dissatisfied`, `unclear`, `unsure`.
  - `session-meta/<session_id>.json`, 586 files. Every facet has a meta file with a `project_path`. Meta also holds `transcript_mtime`, which suggests `/insights` rewrites meta when a transcript changes.
  - `report*.html`: the narrative report. Not read (see proposal).
- Most session-meta fields are already derived from transcripts: tokens (`requests`), tool counts and errors (`tool_calls`), commits (`tool_calls.is_commit`), user messages and interruptions (`prompts`), start time (`sessions.first_ts`), first prompt. Not in the store: `lines_added`, `lines_removed`, `files_modified`, `git_pushes`, `languages`, `permission_mode`, `user_response_times`, `destructive_command_count`, `bash_would_prompt_count`.
- Pages: React under `web/src/pages/<page>/`, routed in `App.tsx` `ROUTES` and `Nav.tsx` `PAGES`; the palette's `>` page destinations come from `Nav.tsx` `PAGES`, so `>insights` needs no palette code. Server page paths are in `app.py` `PAGES`. Errors already links a session to Activity with `sessionHref` (`/usage#session=<id>&range=…`).
- The Cost page already has "insights": `pages/cost/insights.tsx` and `components/InsightCard.tsx`, its findings cards. The new page reuses the word because it mirrors the `/insights` command. New code lives under `pages/insights/` and does not reuse `InsightCard`, to keep the two apart.
- `add-usage-limits` is applied but not archived and has no `dashboard-app` delta, so the main spec's navigation requirement still lists three pages. This change's delta names Limits as well, matching the app.

## Goals / Non-Goals

**Goals:**
- One reader for both directories, wired into `ingest` and `rebuild`, that never raises out of ingest.
- Derived tables keyed by `session_id`, so every page query is a join on `sessions`.
- An `/api/insights` payload computed in Python and tested against synthetic fixtures, like `/api/limits`.

**Non-Goals:**
- Parsing `report*.html` or reproducing its narrative.
- Generating suggestions with `claude -p`, or starting `/insights` from the app (proposal: planned follow-up).
- Showing session-meta figures on Activity or Cost. This change stores them; using them elsewhere is later work.
- Keeping every past version of a facet. The latest judgment replaces the earlier one.
- Normalizing friction or goal category names. They are free-form model labels and are shown as written, with underscores turned into spaces.

## Decisions

### 1. One raw table for usage-data files

- New raw table `usage_files (path VARCHAR PRIMARY KEY, kind VARCHAR, session_id VARCHAR, size BIGINT, mtime DOUBLE, json VARCHAR USING COMPRESSION zstd, ingested_at TIMESTAMP)`. `kind` is `facet` or `meta`.
- A changed file replaces its row (`ON CONFLICT (path) DO UPDATE`). A deleted file keeps its row.
- Keying on `path` and not on `(kind, session_id)` keeps "has this file changed" a single lookup, the way `files` works. `session_id` comes from the JSON, and the file name is the fallback.
- Alternative rejected: storing usage-data files in `files` and `raw_lines`. Those tables assume line-oriented transcripts with a deriver per source, and `rebuild()` would try to replay them through `SOURCES`.
- Alternative rejected: keeping each version as a new row. `/insights` re-judges sessions, and the page needs only the latest judgment. History can be added later without a schema break, by widening the key.

### 2. A separate reader, not a third source

- New module `insights.py` with `ingest(cur, root, projects)`, `derive(cur, rows)`, `rederive(cur)` and `payload(...)`.
- `store.ingest` calls `insights.ingest` after the transcript sources, with `roots.get("insights")`. That way, a session whose transcript arrives in the same ingest is in `sessions` before its facet is derived. Its stats join the ingest result: `usage_files`, `usage_skipped`.
- `store.rebuild` calls `insights.rederive(cur)` after `limits.rederive_polls(cur)`.
- `app.py` gains `--usage-data` (default `~/.claude/usage-data`, `store.DEFAULT_USAGE_DATA`), passed as `roots["insights"]`. The background loop and **Refresh** pick it up with no other change.
- Alternative rejected: adding an entry to `SOURCES`. A source is a transcript format with a deriver, a line key and a `files` row per file; usage data has none of these, and `source` values are what the source filter offers.

### 3. Incremental and fault-tolerant reading

- For each `facets/*.json` and `session-meta/*.json`: stat it, and skip it when `(size, mtime)` matches its `usage_files` row.
- Otherwise read and parse it. A file that cannot be read, is not a JSON object, or has no `session_id` (in the JSON or as the file name) is counted in `usage_skipped`. It goes into the module-level `unreadable` map that `store.py` already uses for transcripts, so it is not retried until it changes. Nothing is written for it.
- All writes of one ingest run in one transaction, after the transcript sources commit. An exception inside the reader is caught, logged to stderr with the path and the exception type (never the content), and counted. Ingest goes on.
- A missing directory gives zero counts and no log line.

### 4. Derived tables

Added to `DERIVED` and `DERIVED_SCHEMA`:

- `session_facets (session_id PK, outcome, helpfulness, session_type, underlying_goal, brief_summary, friction_detail, primary_success, file_mtime TIMESTAMP)`.
- `facet_counts (session_id, kind, name, n, PRIMARY KEY (session_id, kind, name))`. `kind` is `goal`, `friction` or `satisfaction`. The three `{name: count}` maps share one long table, so "friction by category over a view" is a plain `GROUP BY`. A count that is not a positive integer is dropped.
- `session_meta (session_id PK, project_path, project, start_time TIMESTAMP, duration_minutes, lines_added, lines_removed, files_modified, git_pushes, languages VARCHAR (JSON), permission_mode, response_p50_s DOUBLE, destructive_commands, bash_would_prompt)`. The median replaces the list of response times.
- Re-deriving one session deletes its rows in `facet_counts` and replaces its `session_facets` or `session_meta` row, so a rewritten facet leaves no stale counts.

### 5. Project attribution

- A query takes the project as `coalesce(sessions.project, session_meta.project, '(unknown)')`.
- `session_meta.project` is resolved at derive time with `Projects.get(cur, project_path)`, so worktree paths such as `../ai-ledger-add-insights-page` map to `ai-ledger` by the same rule as transcripts, and the cache in `projects_by_cwd` keeps it stable.
- The session's start time for the range filter comes from `sessions.first_ts`, then from `session_meta.start_time`.
- `sessions.source` is `claude` for every facet's session. Codex sessions have no facet by construction.

### 6. The `/api/insights` payload

`insights.payload(cur, project, range_days, source, automated, today)` reuses `metrics.scope()` and `metrics.view()` for the project, range, automated and source rules. Those filter an alias `s` with `project` and `source`, so the facet queries run them over a subquery `s` built from `session_facets` left-joined to `sessions` and `session_meta`. That subquery exposes the coalesced `project`, a `source` of `claude`, and the start time. Orphan facets then filter like any other. It raises `ValueError` for an unknown source, which `app.py` turns into a 400 like other endpoints. Shape:

- `coverage`:
  - `claude_sessions`, `analysed`, `not_analysed`: Claude Code sessions in the view.
  - `codex_sessions`: Codex sessions in the view, not analysed.
  - `orphans`: facets in the view whose session is not in `sessions`.
  - `newest_facet`: the newest facet's file time, over the whole store.
  - `dir`: the directory read.
- `outcomes`, `helpfulness`, `session_types`: `[{name, n}]`, in a fixed order for known values, then unknown values by count.
- `satisfaction`, `friction`, `goals`: `[{name, n, sessions}]`, by `n` descending.
- `sessions`: up to 200 rows, newest first. Each row: `session_id`, `project`, `start`, `outcome`, `helpfulness`, `brief_summary`, `friction_detail`, `friction` (the category names), `in_store`. The friction-only toggle filters these on the client. 200 covers today's 150 facets; past that, the payload says `truncated`.
- With `source=codex`, the payload has only `coverage` and empty lists, and the page shows the Codex message.
- `underlying_goal` and `primary_success` are stored but not sent. The page has no use for them yet, and leaving them out keeps transcript-derived text off the wire.

### 7. The page

- `pages/insights/InsightsPage.tsx` uses the shared `Filters` bar (project, range, source, automated), `useApi` and `useHashState` like Limits.
- Order:
  1. A lead: "N of M Claude Code sessions analysed", with the coverage line and the `/insights` hint.
  2. Outcomes.
  3. Satisfaction and helpfulness.
  4. Friction.
  5. Goals and session types.
  6. The session list.
- A "Model-judged" tag sits on every facet section heading and in the page kicker. A title on the tag explains that `/insights` asks a model to read the transcript.
- Category names are shown with underscores turned into spaces; the raw name goes in the title attribute.
- A session row links with the Errors page's `sessionHref` pattern to `/usage#session=<id>`, with `range=0` (all time), so an old session is inside the range. Rows with `in_store: false` have no link.

## Risks / Trade-offs

- [Facets are a model's opinion and can be wrong] → Labelled on every section. Counts are shown next to rates, so 1 of 2 is not read as 50% of a trend.
- [`/insights` analyses a subset (150 of 586 meta files), so "not analysed" stays large even right after a run] → The coverage line states counts, not a pass or fail, and shows the newest facet time. That way the user can tell "not run lately" from "run, but sampled".
- [The usage-data format is undocumented and can change] → Unknown keys are ignored. Unknown outcome or rating values are shown raw. A file without `session_id` is skipped and counted. The raw text is kept, so a parser fix plus `rebuild` recovers data.
- [Summaries and friction detail are transcript-derived text] → They are stored only in the local store, which is already `0600`, inside a `0700` directory. The page shows them only on `127.0.0.1`. Logs carry paths and exception types, never content. Fixtures and the demo store are synthetic, and a test checks that no fixture holds a real session id from `~/.claude/usage-data`.
- [Name clash with the Cost page's insight cards] → Separate directory and components. The nav label and route make the page's meaning clear.

## Migration Plan

- `open_store` creates the new tables in an existing store (`CREATE TABLE IF NOT EXISTS`). The next ingest, at app start or by `uv run app.py ingest` with the app stopped, fills them. No `rebuild` is needed.
- Rollback: drop the tables. Nothing else reads them.

## Open Questions

- Whether `/insights` ever deletes facets for sessions it no longer samples. If it does, the store keeps them (spec: keep after deletion). The page could later mark facets whose file is gone; that would change no table.
