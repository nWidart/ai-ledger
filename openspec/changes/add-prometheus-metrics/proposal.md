# Proposal

## Why

Grafana's Agent Observability shows coding-agent cost, tokens, sessions and tool calls, but only in Grafana Cloud: its views are a Cloud app that a self-hosted Grafana cannot install. A home lab that already runs Prometheus and Grafana has no way to chart the same figures next to its other dashboards, or to alert on them.

AI Ledger already holds those figures for Claude Code, Codex and Grok. Exposing them in the Prometheus text format lets any Prometheus scrape them and any Grafana chart them, with no new dependency and no transcript content leaving the store.

## What Changes

- **`GET /metrics`.** The app serves its figures in the Prometheus text exposition format on its existing listener (`127.0.0.1`, same host check). Prometheus on the same machine scrapes it like any other target.
- **Counters from the store.** All-time totals per source, project, model and automated flag: requests, tokens by kind, estimated cost, sessions, prompts, compactions, tool calls by result, tool errors by category, commits, test runs by result, model time. A histogram gives tool-call durations per source and tool.
- **Workloads.** An optional user file, `workloads.json` beside the store, names groups of sessions by the start of their first prompt, such as the pull-request review agents a server runs. Every series carries the session's `workload` label, `default` when no entry matches.
- **Gauges of now.** Active sessions per source and live state, each open plan-limit window's used share and reset time, the last ingest time, whether the last ingest failed, and the app version.
- **Cheap scrapes.** The counters are worked out again only after an ingest stored something; a scrape between two ingests reuses them. A scrape never takes the store lock.
- **A Grafana dashboard.** `contrib/grafana/ai-ledger.json`, ready to import or provision: spend, tokens, cache hit, requests by model, tool error rate and latency, active sessions, plan limits and ingest freshness, filtered by instance, source, project, workload and the automated flag.

## Capabilities

### New Capabilities

- `prometheus-metrics`: the `/metrics` endpoint, its metric families and labels, how often its values change, and what it never exposes.

### Modified Capabilities

None.

## Impact

- `src/ai_ledger/prom.py` (new): the metric queries over the derived tables and the text rendering.
- `src/ai_ledger/app.py`: the `/metrics` route and the cached counters on `App`; `refresh_alert` keeps the open limit windows it already works out.
- `contrib/grafana/ai-ledger.json` (new).
- `README.md`, the docs site and `CHANGELOG.md`: how to scrape and what each metric means.
- No new dependency, no payload change, no stored data change.

## Out of scope

- Loading past data into Prometheus (a backfill with `promtool tsdb create-blocks-from openmetrics`). On the first scrape, the whole history shows as one step; `rate()` and `increase()` are right from the second scrape on.
- OpenTelemetry export, push gateways and remote write.
- Listening on any address but `127.0.0.1`.
