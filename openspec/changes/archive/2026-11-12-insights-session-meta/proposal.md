# Proposal

## Why

GitHub issue #6 (item "Use the stored session-meta"): `/insights` writes session meta (lines added and removed, files modified, duration, languages, pushes, response time) for more sessions than it judges. The app ingests it into `session_meta` and shows it nowhere.

## What Changes

- **Insights payload** gains `meta`: the view's session figures, counted by `/insights` from each transcript. It covers Claude Code sessions with a session-meta row, filtered like facets (project, range, source, automated). Each listed session gains its own `meta`, or null without a row.
- **Insights page** gains a "Session figures" drawer (closed by default, not model-judged): lines added and removed, files modified, pushes, median session duration, median response time (the median of session medians), and a Languages ledger.
- **Session cards** gain one quiet line of measured figures, such as "+120 −30 lines · 4 files · 35m · 1 push".

Out of scope: `permission_mode`, `destructive_commands`, `bash_would_prompt`; the Activity session sheet; any change to ingest or the `session_meta` table (no rebuild needed).

## Impact

- `src/ai_ledger/insights.py`, `web/src/api.ts`, `web/src/pages/insights/`, their tests, the page fixtures, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: the page shows the session figures and a measured line per session.
