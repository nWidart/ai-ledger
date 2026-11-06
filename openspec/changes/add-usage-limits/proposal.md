# Proposal

## Why

Claude Code and Codex subscriptions cap use in rolling windows (5 hours, 7 days, sometimes per model). The ledger shows tokens and estimated cost but not how close each plan is to its cap. So the user cannot see whether a window will run out before it resets, or how much paid capacity expires unused. The data is already within reach: Codex writes its limit percentages into every rollout, and Claude Code's account answers a usage endpoint with the same numbers.

## What Changes

- Record plan-limit snapshots per provider: the window, the percent used, the reset time and the plan.
  - Codex: read the `rate_limits` block of `token_count` events, including all history already in the raw lines.
  - Claude Code: poll the account usage endpoint from the ingest loop, with the OAuth token Claude Code keeps in the macOS Keychain. The app only reads the token: it never refreshes, stores or logs it.
- Calibrate each window against the tokens the ledger already counts: estimated cost per 1% of the window. This rebuilds the curve for times with no snapshot, such as Claude history before the first poll, and estimates the percent between polls.
- Forecast each open window up to its reset:
  - Shape the forecast by the user's hour-of-day activity profile, pooled across providers and weighted toward recent weeks.
  - Show an uncertainty band.
  - Fall back to a flat rate for a provider without enough history.
- Add a Limits page at `/limits`:
  - Per window: used % and forecast, with "reaches 100% at …" or "resets first at about …%".
  - The binding window, i.e. the one that stops the user first.
  - Headroom until reset, pace (current rate against the rate that ends at exactly 100%), and a routing hint for which provider to use next.
  - History: past limit hits, the % left unused at each reset, and plan changes.
  - Value: tokens and estimated cost per 1% by model, and commits per 1% by project.
- Add Limits to the shared navigation.
- Model providers so that a new one adds only a snapshot reader. The page, calibration and forecast stay unchanged.

## Capabilities

### New Capabilities
- `plan-limits`: collecting, storing and calibrating plan-limit snapshots per provider and window, and forecasting each window to its reset.
- `limits-dashboard`: the Limits page, which shows each window's usage, forecast, headroom, history and value.

### Modified Capabilities
- `dashboard-app`: the shared navigation and the page routes gain Limits at `/limits`.

## Impact

- `store.py`: new raw table for polled snapshots (kept through rebuild) and a derived snapshot table. Codex snapshots derive from raw lines.
- `codex.py`: the deriver records `rate_limits` alongside its usage.
- New module for providers, polling, calibration and forecasting. It calls `security` and HTTPS from the ingest loop and adds no new dependency.
- `app.py`: poll in the ingest loop, new `/api/limits` endpoint, `/limits` route.
- `web/`: new Limits page, nav entry, route; committed build refreshed.
- Relies on an undocumented Anthropic endpoint, which may change or disappear. When it fails, the page falls back to calibrated estimates and says so.
- macOS only for the Claude token (Keychain). On other systems, Claude shows estimates only.
- Naming: Activity already lives at `/usage`, so the new page is called Limits to avoid two "usage" pages.
