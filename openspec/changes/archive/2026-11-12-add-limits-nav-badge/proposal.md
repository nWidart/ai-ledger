# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): a window can reach its limit, or be forecast to, while the user is on another page or has the tab in the background. Today the user finds out by opening Limits. A mark on the Limits tab, visible on every page, makes the dashboard useful at a glance.

## What Changes

- **The alert.** A pure function over the open windows of the Limits payload gives the one alert the navigation shows, or none. A window is in alert when it is at its limit, is forecast to reach 100% before it resets, or is at 90% used or more. The alert is the worst state any window is in: at its limit (the window that resets last, as the page's binding window is chosen), else runs out (the soonest), else high (the fullest). It names the window, the time that matters, and how many open windows are in alert.
- **Computed once per cycle.** The ingest loop works the alert out after each full cycle (the one that ingests and polls limits, not the fast Live-only passes) and keeps it. `/api/status` returns it as `limits_alert`. The payload scans the whole request history, and every open page polls status each minute, so it is not worked out per request. A failure leaves no alert and never stops the loop.
- **The badge.** The Limits tab shows a small dot while the latest status carries an alert: critical color for at its limit and runs out, warning color for high. The tab's accessible name and its title carry one sentence ("Codex weekly is at its limit until Sat, Nov 14, 12:00 PM", "… is forecast to run out …", "… is at 92%", with " (and N more)"), so color is never the only signal. The dot follows the existing status poll.

Out of scope: browser notifications (they need a permission prompt and the app open anyway), a setting or a configurable threshold, sounds, badges on other tabs, any change to the Limits page.

## Impact

- `src/ai_ledger/limits.py` (`alert_of`, `ALERT_PERCENT`; `binding_of` shares its two choices), `src/ai_ledger/app.py` (`App.refresh_alert`, the loop, `status()`), `tests/test_limits.py`, `tests/test_app.py`, `web/src/api.ts`, `web/src/components/` (`Nav`, `refresh`), `web/src/pages/limits/limits.ts` (`alertText`), the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. `/api/status` gains one field; no other payload changes and no `rebuild` is needed.

## Capabilities

### Modified Capabilities
- `plan-limits`: the alert's definition.
- `dashboard-app`: when the alert is worked out, how the status carries it, and the badge on the Limits tab.
