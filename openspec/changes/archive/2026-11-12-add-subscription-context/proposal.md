# Proposal

## Why

The Cost page shows an estimate at API list prices, a figure most plan users never pay (GitHub issue #3). Without a reference, "$3,429" has no meaning. The plan's monthly price is that reference.

## What Changes

- The packaged `prices.json` gains a `plans` table: per provider, a monthly USD price and a display label for each current consumer plan (Claude Pro, Max 5x, Max 20x; ChatGPT Plus, Pro 5x, Pro 20x). The user `prices.json` can add or override plans, with the same validation and error reporting as models.
- The usage payload carries `plans`: each provider in the view whose newest limit snapshot names a priced plan.
- The Cost heading adds one line: "You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan." The plan price is prorated to the view's days (30 to the month; all time counts from the first recorded day).

## Capabilities

### Modified Capabilities
- `cost-dashboard`: new requirement "Put the estimate next to the plan price"; "Report a bad user prices file" covers `plans`.

## Impact

`metrics.py` (`load_plans`, `read_user_prices`, `view_plans`, `usage`), `prices.json`, `web/src/pages/cost/` (`cost.ts`, `Lede.tsx`), `web/src/api.ts`, fixtures, README, CHANGELOG.
