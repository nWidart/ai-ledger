# Proposal

## Why

The Tokens and cache drawer shows token shares only, and cache reads dominate them. The cost split by kind (cache read, cache write, output, input) is what tells a user where to save. GitHub issue #3, item "Cost by token kind".

## What Changes

- The server prices each request per kind (input, output, cache read, 5-minute write, 1-hour write) with the same rates and the same long-prompt tier choice as the request's cost, so the parts add up to it. The payload totals carry the sum per kind.
- The Tokens and cache drawer lists the billed kinds biggest cost first, each with its estimated cost, its share of the estimated cost, and its tokens with their share. Thinking tokens are billed as output, so Output and thinking show as one row with one cost.
- An unknown cost shows as a dash.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: new requirement to show estimated cost by token kind.

## Impact

`requests_cte` in `metrics.py`, `usage()` totals, `TokensDrawer`, payload types and fixtures. Existing figures do not change (cost sums differ from before by float rounding only).
