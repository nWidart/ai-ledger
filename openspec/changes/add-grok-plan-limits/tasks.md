# Tasks

## 1. Backend
- [x] 1.1 Read the Grok credential (`~/.grok/auth.json` or `GROK_HOME`/`GROK_AUTH`): unknown account returns nothing, expired token skips
- [x] 1.2 Fetch the billing endpoint with fixed-text failures
- [x] 1.3 Parse a stored poll into one snapshot (`grok_rows`), register it in `POLL_PARSERS`
- [x] 1.4 Add the `grok` provider (5-minute poll, fixed windows); a poll that returns nothing leaves the poller untouched
- [x] 1.5 Remove `plan_limits` from the Limits payload
- [x] 1.6 Tests: parser, credential cases, poller outcomes, payload with Grok snapshots

## 2. Web
- [x] 2.1 Remove `plan_limits` and the "reports no plan limits" line; Grok cards render like the others
- [x] 2.2 Regenerate fixtures; update tests; `npm run check`

## 3. Docs
- [x] 3.1 README, CHANGELOG `[Unreleased]`
- [x] 3.2 Docs site: limits, windows, privacy-security, first-tour, compare-sources, configuration
