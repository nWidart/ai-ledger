# Proposal

## Why

GitHub issue #6 (Insights review, item 8): the page shows judgments but does not say where they come from, how much one `/insights` run covers, or whether outcomes improve over time.

## What Changes

- **"How this works" drawer.** A closed drawer says what `/insights` is (a Claude Code command; a model reads each session's transcript and writes one judgment file per session; the app only reads those files and never calls a model), the directory the app reads, when the last run wrote, how many sessions the last runs each analysed (min, median, max), and how to get more coverage. It shows whenever the store has facets and the source is not Codex.
- **Outcome trend.** A panel under Outcomes and Friction shows, per week of session start, the share of analysed sessions fully or mostly achieved, with "A of N" as text. It shows with 2 or more weeks.
- **Payload.** `coverage.run_sizes` (`{runs, min, median, max}` over the newest 20 runs of the whole store, or null) and top-level `trend` (`[{week, n, achieved}]`, oldest first, at most 26 weeks).

## Impact

- `src/ai_ledger/insights.py`, `web/src/pages/insights/InsightsPage.tsx`, `web/src/api.ts`, page fixtures, README and CHANGELOG. The built page in `src/ai_ledger/web/` is rebuilt. No new dependency.
