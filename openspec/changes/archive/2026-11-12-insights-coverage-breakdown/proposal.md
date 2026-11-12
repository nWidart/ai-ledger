# Proposal

## Why

GitHub issue #6 (item 5): "Coverage by project and by run, so it is visible when the busiest projects have no judgments at all." The Insights page says how many of the view's Claude Code sessions are analysed, but not which projects they come from, nor how many facets each `/insights` run wrote.

## What Changes

- The Insights payload's `coverage` gains `by_project` (sessions and analysed sessions per project, busiest first) and `runs` (the `/insights` runs that wrote a facet in the view, newest first, at most 20). A run is a group of stored facets whose file times have no gap over one hour.
- Insights gains a closed "Coverage" drawer with a "By project" ledger and a "By run" ledger, a "Coverage" entry in the section index, and a "by project and run" link in the coverage sentence that opens it.

Out of scope: an outcome trend per run, a note on how `/insights` works, session-meta figures, any other section.

## Impact

- `src/ai_ledger/insights.py`, `web/src/api.ts`, `web/src/pages/insights/InsightsPage.tsx`, their tests, the page-test fixtures, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: coverage by project and by run.
