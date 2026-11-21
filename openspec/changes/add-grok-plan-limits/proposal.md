# Proposal

## Why

Limits shows no Grok window and says that Grok reports no plan limits. That is no longer true. A Grok subscription (SuperGrok, X Premium) has a weekly credit allowance, and the Grok CLI's chat proxy reports it: `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` answers the percent of the period's credits used and the period's type, start and end. T3 Code already shows this figure. The user's account reports a weekly period at 10% used.

## What Changes

- **Grok poll.** While serving, the app asks the Grok billing endpoint for the credit usage at most once every 5 minutes, with the access token of the Grok CLI's grok.com login (`~/.grok/auth.json`). Each successful poll is kept in `limit_polls` and becomes one snapshot: provider `grok`, its period type as the limit (`weekly`), no scope, the period's length, its end as the reset and `creditUsagePercent` as the percent. Polls survive a rebuild like Claude's.
- **Credential handling.** The token is read on each poll, sent only to the Grok billing endpoint, never stored, logged or shown, and never refreshed (the Grok CLI refreshes it). An expired token skips the poll and marks Grok stale. Without a grok.com login (no Grok, an API key, or a custom auth or endpoint configuration), the app sends nothing and shows nothing for Grok.
- **Fixed schedule.** A Grok period starts and ends on the billing schedule, not on first use, so Grok's windows are fixed.
- **Limits.** Grok gets windows, a card with its chart and forecast, history, unused capacity and value, like Claude Code and Codex. The "Grok reports no plan limits" line and the payload's `plan_limits` flag go: every source now has plan limits.

## Capabilities

### Modified Capabilities
- `plan-limits`: a Grok poll and its credential rules.
- `limits-dashboard`: source Grok shows Grok's windows.

## Impact

- `limits.py`: a `grok` provider (credential, fetch, `grok_rows` parser), `POLL_PARSERS["grok"]`, and no `plan_limits` in the payload.
- `web/src/pages/limits/`, `web/src/api.ts`: the "reports no plan limits" line and `plan_limits` go; fixtures regenerate.
- Tests: the Grok parser, credential reading, poller outcomes and the payload.
- Docs: README, CHANGELOG, and the docs-site pages that say Grok reports no plan limits, including what the app sends and where (privacy).
- One new outbound request, to `cli-chat-proxy.grok.com`, only when a Grok login exists.
