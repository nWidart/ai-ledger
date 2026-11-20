# Proposal

## Why

The Activity work chart draws errors per 100 tool calls as a line, with no guard for bars that hold few tool calls. One quiet day with 2 failed calls of 4 reads 50, and that one value sets the right-hand axis. The busy days, at 2 to 5 errors per 100 calls, then sit flat on the floor of the chart.

The Errors page already handles this. Its rate chart marks buckets with fewer than 50 calls as hollow dots and leaves them out of the rate scale.

## What Changes

- **Work chart, low-call bars.** A bar with fewer than 50 tool calls draws its rate as a hollow dot and does not set the rate axis. The line still runs through it. The rule applies only when at least one bar has 50 calls or more, as on the Errors page; a view where every bar is quiet scales to its own rates.
- **Say so.** The legend gains an "Under 50 calls" key when a bar is marked. The tooltip, the screen-reader text and the data table say "too few calls for a steady rate" for a marked bar. Its rate stays readable in all three.
- **Shared threshold.** The 50-call threshold and the rule move to one shared place for both charts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: "Show work per day" drops the quiet-day scenario; a new requirement, "Mark work chart bars with few tool calls", states the low-call rule for the rate line.

## Impact

- `web/src/components/chart.ts`: `LOW_CALLS` and `lowVolume`, shared by the work chart and the Errors rate chart.
- `web/src/pages/activity/WorkChart.tsx`, `web/src/components/chart.css`: the guard, hollow dots and legend key.
- `web/src/pages/errors/RateChart.tsx`, `model.ts`: use the shared rule; no change in behavior.
- `README.md`, `site/` need no change: they do not describe the rate line's scale.
