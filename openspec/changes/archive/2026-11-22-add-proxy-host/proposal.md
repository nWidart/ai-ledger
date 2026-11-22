# Proposal

## Why

A home server runs AI Ledger as a service on `127.0.0.1`. To open its pages from a laptop or phone on the same tailnet, the owner publishes the port with `tailscale serve`. The proxy passes the tailnet name as `Host`, and the app answers every route but `/metrics` (with `--metrics-host`) with `403 forbidden host`. The cross-site check also expects the origin `http://127.0.0.1:<port>`, while the proxied page's origin is `https://<tailnet name>`.

## What Changes

- **`--proxy-host HOST[:PORT]`**, repeatable, with the same validation as `--metrics-host`. Every route (pages, `/api`, every POST, the Live event stream, `/metrics`) accepts a request whose `Host` is one of those values, ignoring case.
- **Same-site check behind the proxy.** For such a host, a browser that sends no `Sec-Fetch-Site` is same-site when its `Origin` is `https://<host>` or `http://<host>`. A cross-site request is still refused.
- **No change without the option.** An unlisted host still gets 403; the app still listens on `127.0.0.1` only. `--metrics-host` keeps its narrower meaning.
- The localhost redirect and the `/` redirect stay as they are: the first goes to `127.0.0.1` only for `localhost`, and the second is relative. The web UI uses relative URLs, so it works under any origin. Settings the browser keeps per origin (theme, columns) start fresh on the proxied address; fix markers and mutes are in the store.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the host a proxy passes on, opted into by name.
- `prometheus-metrics`: a `--metrics-host` name stays limited to `/metrics` unless `--proxy-host` also names it.
- `distribution`: the port the app answers on, besides the names the options add.

## Impact

- `src/ai_ledger/app.py`: the option, the host check and the Origin check.
- `tests/test_app.py`: the host check test.
- `README.md`, the docs site and `CHANGELOG.md`: the option, how to use it with `tailscale serve`, and the warning that the pages show full transcripts with no login.
- No new dependency, no payload change, no stored data change.

## Out of scope

- A login or any access control in the app. The private network (a tailnet and its ACLs) is the access control.
- Trusting `X-Forwarded-Host` or other forwarded headers: any local client can send them.
