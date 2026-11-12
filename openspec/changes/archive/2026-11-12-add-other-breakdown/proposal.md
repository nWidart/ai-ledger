# Proposal

## Why

The Cost page's chart stacks the busiest projects in their own colors and sums every other project into one grey "Other" series. A day's Other can hold many projects, and the chart shows only their total, so the user cannot see what is in it without leaving the chart. GitHub issue #3 asks for the top two or three Other projects in the tooltip.

## What Changes

- **Other's projects in the tooltip.** Under the Other row of a day's cost tooltip, the three costliest projects inside Other show with their cost, indented and muted. More than three add a "+ N more" line. One project inside Other shows that project alone.
- **Screen-reader text.** The day's text on the chart lists the same projects, for example "Other $12.40 (foo $8.00, bar $3.10, baz $1.00, and 2 more)".
- The token tooltip does not change. The chart's bars, legend and stacking do not change.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: a new requirement that the day's cost tooltip breaks Other down by project.

## Impact

- `web/src/pages/cost/cost.ts`: `costDays` fills `other` on each day when Other is stacked. Frontend only; the payload (`daily_projects`) already carries every project's cost per day.
- `web/src/pages/cost/CostChart.tsx`: the cost tooltip and the day's screen-reader text.
- `web/src/pages/cost/cost.css`: indent and muted style for the Other rows.
- No Python change, no payload change, no fixture change.
