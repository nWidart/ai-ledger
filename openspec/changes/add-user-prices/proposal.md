# Proposal

## Why

When a request uses a model missing from the packaged price table, the Cost page names the model and says "Add them to `prices.json`". That file sits inside the installed package: editing it is lost on the next upgrade, and most users cannot find it. A new model's cost stays unknown until a release ships its price.

## What Changes

- **A user prices file**: `prices.json` in the app's data folder, next to the store (the `--db` file's folder). Same shape as the packaged file. Its models add to the packaged ones, or replace one with the same name.
- **Every page that prices requests uses it** (Cost, Activity, Limits, Live). Costs are computed when a page loads, from the stored token counts, so a new price applies on the next page load. No `rebuild` is needed.
- **A bad file is reported and ignored**: invalid JSON, no `models` object, or an entry without a number for each price makes the app use the packaged prices alone, and the Cost page shows a banner with the file's path and the reason.
- **The unpriced-models banner names the file's full path** and says the next page load uses it.

Out of scope: editing prices in the app, automatic price updates, re-pricing anything at ingest.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: the unpriced-models banner names the user prices file; a bad file is reported.
- `distribution`: prices come from the package, overridden by a user file next to the store.

## Impact

- `src/ai_ledger/metrics.py`: `USER_PRICES`, `user_prices`, `prices_file`; `load_prices` merges the user file; the usage payload gains `prices_file`.
- `src/ai_ledger/app.py`: points `USER_PRICES` at the `--db` folder.
- `web/src/pages/cost/CostPage.tsx`, `web/src/api.ts`: the banners.
- `README.md`: document the file.
