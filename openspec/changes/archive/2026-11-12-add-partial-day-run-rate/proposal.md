# Proposal

## Why

The Cost chart's last bar is today, a day still in progress. It looks like a cheap day, and it drags the 7-day average line down. The page also says nothing about where the month is heading. GitHub issue #3 asks to hatch today's bar, leave it out of the average and show a run rate.

## What Changes

- **Today so far.** The bar for today is hatched, in the cost and the tokens chart, over each segment's own color. The legend gets a "Today so far" key. The tooltip, the peak label and the screen-reader text say "so far" for that day.
- **Average of complete days.** The 7-day average at a day is the mean of the 7 complete days ending at that day. Today has no average point: the line ends yesterday. The chart's hint says the average covers complete days.
- **Run rate.** The heading's second line adds "On pace for about $X this month": the month's cost up to yesterday, plus the mean daily cost of the last 7 complete days times the days left in the month, today counted. It shows only with 7 complete days of history and a priced projection.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: new requirements for today's partial bar and the month's run rate; the 7-day average leaves today out.

## Impact

- `src/ai_ledger/metrics.py`: `run_rate()` and a `run_rate` field on the usage payload. It uses the view's scope (project, source, automated) but not its range, because a 7-day view does not hold the month so far.
- `web/src/api.ts`, `web/src/pages/cost/CostChart.tsx`, `Lede.tsx`, `web/src/components/chart.css`, and the page-test fixtures.
