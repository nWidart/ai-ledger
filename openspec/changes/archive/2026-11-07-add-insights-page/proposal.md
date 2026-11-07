# Proposal

## Why

Claude Code's `/insights` command asks a model to judge each analysed session: was the goal achieved, was the user satisfied, where did the session hit friction. It writes those judgments to `~/.claude/usage-data/`, then folds them into one narrative report for all projects. That report mixes projects together, so its advice is often wrong for the project at hand: it says "default branch is master", which holds for one repository and not for ai-ledger. The per-session judgments under the report are the useful part. The ledger already knows every session's project, so it can show those judgments per project, next to the measured figures on the other pages.

## What Changes

- **Ingest the `/insights` data.** `ingest` also reads `~/.claude/usage-data/`:
  - `facets/<session_id>.json`, one model judgment per analysed session.
  - `session-meta/<session_id>.json`, measured per-session figures. The store keeps only the fields it does not already derive from transcripts: lines added and removed, files modified, git pushes, languages, permission mode, user response times, and the project path.
  - Each file is kept verbatim in a raw table and read again only when its size or modification time changes.
  - A missing directory, an unreadable file or malformed JSON is skipped and counted. It never fails ingest.
  - `report-*.html` is not read.
  - `rebuild` re-derives the facet and meta tables from the raw rows.
- **Derived tables keyed by `session_id`**, joining to `sessions` and from there to the project. A facet whose session is not in the store takes its project from the session-meta `project_path`, through the same project resolution the store uses for a transcript cwd.
- **A new Insights page** at `/insights`, in the shared navigation, with the shared project, range, source and automated filters:
  - outcome rates (fully, mostly, partially, not achieved, unclear),
  - user satisfaction signals and Claude's helpfulness,
  - friction categories with counts,
  - goal categories and session types,
  - a list of analysed sessions with their brief summary and friction detail, each linking to the existing session sheet on Activity.
- **Facets are labelled as model-judged.** Every facet figure carries the label, so nobody reads it as measured.
- **Coverage and staleness.** The page shows how many Claude Code sessions in the view have no facet, with "run `/insights` to refresh", and when the newest facet was written.
- **Codex.** Codex writes no facets. With source All, the page counts Codex sessions as not analysed and keeps them out of every rate. With source Codex, the page says that `/insights` covers only Claude Code sessions.
- **Privacy.** Facets and session meta hold summaries of transcript content. They stay in the local store, like transcripts, and are never committed. Tests and the demo store use synthetic facets only.

### Planned follow-up (out of scope)

- **Per-project instruction suggestions.** Generate `CLAUDE.md` / `AGENTS.md` suggestions per project with `claude -p`, from that project's facets. Each suggestion is checked against the project's existing instructions and the global ones, conflicts are flagged, and each is tagged project or global. The user marks it accepted or dismissed, and the store keeps that state.
- **Start `/insights` from the app.** A button that runs the analysis. Nobody has checked whether `claude -p "/insights"` works headless; that has to be settled first.

## Capabilities

### New Capabilities
- `session-insights`: reading Claude Code's `/insights` facets and session meta into the store, incrementally and fault-tolerantly, and attributing each to a session and project.
- `insights-dashboard`: the Insights page, which shows model-judged outcomes, satisfaction, helpfulness, friction, goals and session types per view, the analysed-session list, and coverage.

### Modified Capabilities
- `dashboard-app`: the shared navigation, the served pages and the page titles gain Insights; the source filter reaches the Insights page.

## Impact

- `store.py`: a raw table for usage-data files and derived tables for facets and session meta. `ingest` and `rebuild` call the new reader. `open_store` creates the tables in existing stores; a one-time `ingest` fills them, and no `rebuild` is needed.
- New `insights.py`: reading, parsing, deriving and the `/api/insights` payload.
- `app.py`: a `--usage-data` option (default `~/.claude/usage-data`), the `/insights` page path and the `/api/insights` endpoint.
- `web/src`: a page under `pages/insights/`, routes in `App.tsx` and `Nav.tsx`, payload types in `api.ts`, the `>insights` palette destination, and a new fixture in `web/src/__fixtures__/`. `web/dist/` is rebuilt and committed.
- `tests/`: synthetic facet and meta fixtures; `tools/demo/seed.py` gains synthetic facets.
- `README.md`: the Insights page, the usage-data directory, and its privacy note.
- No new dependency.
