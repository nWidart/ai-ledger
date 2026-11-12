# Proposal

## Why

The Cost chart stacks each day's cost by project only. A rise in spend can come from a model (Opus instead of Sonnet) or from an agent (Claude Code or Codex), and the chart cannot say which without leaving the page. GitHub issue #3 asks for a switch to stack the chart by model or by agent.

## What Changes

- **Stack by.** In the Cost metric, a "Stack by" switch with Project, Model and Agent sits beside the metric switch. Project is the default and the current stacking. The choice is kept in the browser with the metric. The switch does not show in the Tokens metric.
- **Model stacking.** The models with the most cost in the view get one series color each, up to six; the rest sum into Other in grey. The day's tooltip and screen-reader text list the three costliest models inside Other, as they list projects today. Labels drop the `claude-` prefix.
- **Agent stacking.** One series per agent (Claude Code, Codex), no Other.
- **Legend.** A project key still filters the page to that project. An agent key filters the page to that agent through the source filter, and when a source is set it is the way back, as the project key is. A model key is a plain key.
- **Words.** The heading (except under Project), the hint, the chart's label and the day's screen-reader text name the stacking.
- Today's hatched bar and the 7-day average that leaves today out work in every stacking.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: a new requirement for the stacking switch; Other's breakdown applies to models as well as projects.

## Impact

- `src/ai_ledger/metrics.py`: the requests view carries the session's source; the usage payload gets `daily_models` (day, model, cost) and `daily_sources` (day, source, cost), priced requests only, so a day's rows sum to the day's cost.
- `web/src/pages/cost/cost.ts`: `costKinds` and `costDays` serve the three stackings through one code path (a key prefix per stacking, and the rows to read).
- `web/src/pages/cost/CostChart.tsx`, `CostPage.tsx`, `cost.css`, `web/src/api.ts`, and the page-test fixtures.
