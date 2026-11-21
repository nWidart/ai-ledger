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
- provider `grok`, limit id the period type without its `USAGE_PERIOD_TYPE_` prefix, lowercased (`weekly`, `monthly`; `credits` when the type is missing); scope `""`;
- minutes: 10080 for `WEEKLY`, else none. A monthly period runs 28 to 31 days, so repeating one observed length would put the next reset, and estimated earlier windows, on wrong dates. With no length, the app neither steps a reset on nor back, and the label is the limit id ("monthly");
- reset: the period's end; percent: `creditUsagePercent`; plan: none (the response names no plan); reached when the percent is 100 or more.

A response without a percent that reads (0 to 100, not a bool) or without an end that reads has no limit, so the poll fails with the existing "no recognizable limit" message. `productUsage` is not read.

## Provider

`PROVIDERS["grok"] = Provider("grok", "Grok", grok_poll, POLL_SECONDS, fixed=lambda minutes: True, one_limit=True)`. The Grok period runs on the billing schedule. Each poll reports the one current period (`one_limit`), so only the limit of the newest poll has an open window: a period whose type changed is not shown twice. Older limits keep their history.

## Signed out, expired, redirected

- A poll that finds no account resets the poller's state to `absent`. Limits then shows no open Grok window and no Grok freshness line, and keeps Grok's history. The next poll that sends a request clears it.
- An expired token flags "token expired" and marks the Grok figures estimated, not measured.
- Any change in a poller's state, not only a new reading, tells open pages to refetch.
- The bearer token is an unredirected header, for Grok and Claude alike: a redirect never carries it.
- Config files are parsed as TOML (`tomllib`) and their top-level keys checked, so quoted or escaped keys count. A config that does not parse counts as another account.

## Payload

`plan_limits` existed only for a source with no provider. Every source now has one, so the flag and the page's one-line notice are removed rather than kept always true.
