# Proposal

## Why

GitHub issue #6 (item "Say which sessions each page counts"): Insights counts sessions by start time, Activity counts a session when it has a request in the range. For the same view the two totals differ slightly, and neither page says so.

## What Changes

- **Insights** adds one sentence to its subtitle: a session counts by its start time; Activity counts a session with a request in the range.
- **Activity** adds one sentence to the Sessions drawer: a session counts when it has a request in the range; Insights counts by start time.

Out of scope: any payload or Python change, changing how either page counts.

## Impact

- `web/src/pages/insights/InsightsPage.tsx`, `web/src/pages/activity/SessionsDrawer.tsx`, their page tests, the build in `src/ai_ledger/web/`, `CHANGELOG.md`.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: the page says how it counts sessions.
- `usage-dashboard`: the Sessions drawer says how it counts sessions.
