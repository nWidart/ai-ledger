# Design

## Endpoint

`GET https://cli-chat-proxy.grok.com/v1/billing?format=credits`, header `Authorization: Bearer <token>`. The endpoint is undocumented; T3 Code uses it. A response, with its non-limit keys left out:

```json
{"config": {"currentPeriod": {"type": "USAGE_PERIOD_TYPE_WEEKLY", "start": "2026-11-19T21:27:03.738+00:00", "end": "2026-11-26T21:27:03.738+00:00"},
            "creditUsagePercent": 10.0,
            "productUsage": [{"product": "GrokBot", "usagePercent": 10.0}]}}
```

## Credential

The Grok CLI keeps its logins in `$GROK_HOME/auth.json` (default `~/.grok/auth.json`), a JSON object keyed by issuer. The grok.com login is the entry `https://auth.x.ai::b1a00492-073a-47ea-816f-4c329264a828`, or the older `https://accounts.x.ai/sign-in`. Its `key` is the access token and `expires_at` its expiry (ISO time).

As T3 Code does, the app treats the account as unknown, and polls nothing, when:
- `XAI_API_KEY` is set, or the login's `auth_mode` is `api_key`: the CLI bills an API key, which has no subscription credits;
- any of the CLI's auth or endpoint overrides is set (`GROK_OIDC_*`, `GROK_OAUTH2_*`, `GROK_AUTH_PROVIDER_COMMAND`, `GROK_LOCAL_AUTH`, `GROK_CLI_CHAT_PROXY_BASE_URL`, `GROK_MODELS_BASE_URL`, `GROK_CONFIG`, `GROK_CONFIG_PATH`), or `config.toml`, `managed_config.toml` or `requirements.toml` under the Grok home or `/etc/grok` sets `auth`, `grok_com_config` or `endpoints`: the CLI then uses another account or endpoint;
- the file or the entry is missing, or the entry has no `key`.

`GROK_AUTH`, when set, holds the file's content in place of the file.

"Unknown" is not a failure. The poll returns nothing, sends no request and leaves the poller's state untouched. Freshness leaves out a polled provider with no snapshot and an untouched state, so a machine without Grok shows no Grok card, no freshness line and no error. It is checked again at the next interval. An `expires_at` in the past skips the poll as stale (`PollSkipped`), as an expired Claude token does. The refresh token is never read.

## Snapshot

One snapshot per poll:
- provider `grok`, limit id the period type without its `USAGE_PERIOD_TYPE_` prefix, lowercased (`weekly`, `monthly`; `credits` when the type is missing); scope `""`. The limit id is also the label (`Provider.named`), so a monthly window is "monthly" every month, not "744-hour";
- minutes: the period's end minus its start, in whole minutes, when both read; else 10080 for `WEEKLY`; else none;
- reset: the period's end; percent: `creditUsagePercent`; plan: none (the response names no plan); reached when the percent is 100 or more.

A response without a percent that reads (0 to 100, not a bool) or without an end that reads has no limit, so the poll fails with the existing "no recognizable limit" message. `productUsage` is not read.

A monthly period's length varies by month; its windows are still told apart by their resets.

## Provider

`PROVIDERS["grok"] = Provider("grok", "Grok", grok_poll, POLL_SECONDS, fixed=lambda minutes: True)`. The Grok period runs on the billing schedule.

## Payload

`plan_limits` existed only for a source with no provider. Every source now has one, so the flag and the page's one-line notice are removed rather than kept always true.
