---
title: Prometheus metrics and Grafana dashboard
description: Scrape AI Ledger with Prometheus, name workloads, read every metric, and import the Grafana dashboard.
spec: [prometheus-metrics]
---

The app serves its figures in the Prometheus text format at `GET /metrics`, on the same listener as the pages (`127.0.0.1`). Any Prometheus can scrape it and any Grafana can chart it. This adds no dependency and no setting: the endpoint is always on.

## Scrape on the same machine

Add the app as a target. Prometheus sends `127.0.0.1:8765` as the `Host`, which the app accepts.

```yaml
scrape_configs:
  - job_name: ai-ledger
    scrape_interval: 30s
    static_configs:
      - targets: ["127.0.0.1:8765"]
        labels: {instance: laptop}
```

If Prometheus runs in a container, give it host networking so that `127.0.0.1` is the machine's.

To check the endpoint by hand:

```bash
curl http://127.0.0.1:8765/metrics
```

## First scrape and what the counters mean

Every `_total` family is the total over the whole store at scrape time, not a count of what the running app saw. The values survive a restart and match the pages.

- **The first scrape is one step.** Prometheus sees the whole history appear at once. `increase()` over a window that holds the first scrape overstates that window. `rate()` and `increase()` are right from the second scrape on. The dashboard's "Spend all time" panel reads the totals directly.
- **`ai-ledger rebuild` can lower a counter** when a parser fix drops rows. Prometheus reads a lower value as a counter reset, and `rate()` stays right.
- **A new label set starts at its total.** A project's first sample is its baseline.
- **A request shows up late.** Prometheus stamps values at scrape time, so a request appears up to one ingest interval (60 seconds) plus one scrape interval after it happened.
- **Scrapes are cheap.** The counters are worked out again only after an ingest or a limit poll stored something, or after `workloads.json`, `prices.json` or `automated.json` changed. A scrape in between reuses them. A scrape never takes the store lock.
- **A failed scrape answers 500** with the error's type only. The next scrape tries again.

The app loads no history into Prometheus beforehand. There is no OpenTelemetry export, no push and no remote write.

## A second machine

Run one AI Ledger per machine, each on its own store, and let one Prometheus scrape them all. The `instance` label tells them apart. The app keeps listening on `127.0.0.1` only. To reach it from the tailnet, publish its `/metrics` path with `tailscale serve`:

```bash
tailscale serve --bg --https=8766 --set-path=/metrics http://127.0.0.1:8765/metrics
```

This exposes `/metrics` and nothing else on the tailnet. The proxy passes `Host: <machine>.<tailnet>.ts.net:8766`, which the app refuses by default. Start the app with `--metrics-host` to accept that name on `GET /metrics`:

```bash
ai-ledger --metrics-host <machine>.<tailnet>.ts.net:8766
```

`--metrics-host HOST[:PORT]` is repeatable and matches without case. Pages, `/api` and every other method keep the strict host check. A value that is not a host name with an optional port makes the app exit at start. See [Privacy and security model](/ai-ledger/concepts/privacy-security/#how-the-server-is-guarded).

On the Prometheus machine, scrape the tailnet name over HTTPS and set an `instance` label for each machine:

```yaml
  - job_name: ai-ledger-laptop
    scheme: https
    static_configs:
      - targets: ["<machine>.<tailnet>.ts.net:8766"]
        labels: {instance: laptop}
```

A laptop that sleeps shows as a down target, and the dashboard has a gap. Nothing is lost: the counters are store totals, so the next scrape catches up.

## Name workloads

A workload is a named group of sessions. Use it to tell apart sessions that start the same way, such as pull-request review agents that run beside sessions you start by hand, in the same projects. Project, folder and branch do not tell them apart; the first prompt does.

Add `workloads.json` to the folder that holds the store (see [Configuration](/ai-ledger/reference/configuration/#workloads)):

```json
{"workloads": [{"name": "pr-review", "prompt_prefix": "You work on pull request #"}]}
```

A session's workload is the `name` of the first entry whose `prompt_prefix` starts the session's first prompt. A session with no match, or with no prompt, is `default`. Every series carries the `workload` label. The prefix stays on your machine; only the name becomes a label.

## Metric reference

Every name starts with `ai_ledger_`. Samples carry no timestamps. A label set with no rows has no sample.

### Labels

| Label | Values |
| --- | --- |
| `source` | `claude`, `codex` or `grok`. |
| `project` | The session's project, as the pages name it. `(unknown)` when the store has none. |
| `automated` | `true` for the sessions the pages leave out when **Include automated sessions** is off, else `false`. A label, so a dashboard can show both. |
| `workload` | A name from `workloads.json`, else `default`. |
| `model` | The request's model, as the transcript records it. `(unknown)` when it has none. |
| `kind` | `input`, `output`, `thinking`, `cache_read`, `cache_5m` or `cache_1h`. |
| `tool` | The tool's name as the store has it, MCP tools included. |
| `result` | `ok` or `error` on tool calls; `passed` or `failed` on test runs. |
| `category` | The error category the Errors page gives a failed call; `other` when it has none. |
| `state` | The state the Live page gives an active session. |
| `provider`, `limit`, `window` | A plan-limit window: the provider, the limit's id (with `/<scope>` when it has a scope) and the window's name on Limits, such as `5-hour`. |
| `version` | The app's version. |

### Counters

Each counter carries `source`, `project`, `automated` and `workload`, plus the labels listed.

| Family | Extra labels | Meaning |
| --- | --- | --- |
| `ai_ledger_requests_total` | `model` | Model requests. |
| `ai_ledger_unpriced_requests_total` | `model` | Requests with no reported cost and no list price. They add nothing to cost. |
| `ai_ledger_cost_usd_total` | `model` | Cost in USD: the reported cost (Grok), else the list-price estimate, as on [Cost](/ai-ledger/concepts/cost-estimates/). |
| `ai_ledger_tokens_total` | `model`, `kind` | Tokens by kind. |
| `ai_ledger_sessions_total` | | Sessions. |
| `ai_ledger_prompts_total` | | Human prompts. |
| `ai_ledger_compactions_total` | | Context compactions. |
| `ai_ledger_commits_total` | | Commits that succeeded. |
| `ai_ledger_model_seconds_total` | | Model time in seconds, as the session sheet shows it. A session with no model time adds nothing. |
| `ai_ledger_test_runs_total` | `result` | Test and build runs. |
| `ai_ledger_tool_calls_total` | `tool`, `result` | Tool calls that have a result. A running call counts once it ends. |
| `ai_ledger_tool_errors_total` | `category` | Failed tool calls by error category. |

### Histogram

`ai_ledger_tool_call_duration_seconds` times every tool call with a start and an end. It carries `source`, `workload` and `tool` only. The buckets are 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300 and 600 seconds, plus `+Inf`, with `_sum` and `_count`. A running call is in no bucket.

### Gauges

Gauges are worked out at each scrape.

| Family | Labels | Meaning |
| --- | --- | --- |
| `ai_ledger_active_sessions` | `source`, `project`, `workload`, `state` | Sessions the Live page lists as active, automated ones included, by state. |
| `ai_ledger_limit_used_ratio` | `provider`, `limit`, `window` | Used share of each open plan-limit window, 0 to 1, as of the app's last full cycle. |
| `ai_ledger_limit_resets_timestamp_seconds` | `provider`, `limit`, `window` | Unix time each open window resets. |
| `ai_ledger_last_ingest_timestamp_seconds` | none | Unix time of the last ingest that finished. No sample before the first. |
| `ai_ledger_ingest_failed` | none | 1 when the last ingest failed, else 0. |
| `ai_ledger_build_info` | `version` | Always 1. |

The limit gauges have no sample until a provider's limits were polled once.

## The Grafana dashboard

[`contrib/grafana/ai-ledger.json`](https://github.com/nWidart/ai-ledger/blob/main/contrib/grafana/ai-ledger.json) is a dashboard over these metrics. In Grafana, open Dashboards, New, Import, upload the file and pick your Prometheus data source. To provision it, point a file provider at the folder that holds it. Every query names only `ai_ledger_` metrics and the chosen data source.

### Variables

| Variable | Filters |
| --- | --- |
| Data source | The Prometheus that scrapes the app. |
| Instance, Source, Project, Workload, Automated | Every panel that carries the label. |
| Group by | `source`, `project`, `workload` or `model`, for Spend per day. |

Tool-call durations filter by instance, source and workload only. Active sessions include automated sessions, so Automated does not apply to them. Limit windows and ingest health filter by instance only.

### Panels

| Row | Panels |
| --- | --- |
| Overview | Spend in range, Spend all time, Requests in range, Cache hit share in range, Unpriced requests in range, Active sessions now, and a note on how to read the figures. |
| Cost & tokens | Spend per day by the Group by label, Tokens by kind, Cache hit share, Requests by model. |
| Tools | Tool error rate, Tool error rate by tool, Tool errors by category, Tool-call p95 duration by tool. |
| Sessions & limits | Active sessions by state, Active sessions by workload, Open limit windows, Limit windows reset in, Limit windows used over time. |
| Health | Time since last ingest, Last ingest (failed or not), Version, Ingest lag. |

Cost is an estimate at list prices for Claude Code and Codex, and the reported cost for Grok. When "Unpriced requests in range" is above 0, the cost is partial.

## What leaves the store

The names of projects, models, tools, error categories and workloads, the states and limit names, and the app's version. No label or sample holds a session id, a prompt, a command, a tool input, an error message, a path or any other transcript text. A secret in a failed call's error text appears nowhere in `/metrics`; only the call's category does.

Anyone who can reach the endpoint reads those names. See [Privacy and security model](/ai-ledger/concepts/privacy-security/#metrics-when-something-scrapes-them).

## Related

- [CLI and options](/ai-ledger/reference/cli/): `--metrics-host`.
- [Configuration](/ai-ledger/reference/configuration/#workloads): `workloads.json`.
- [How cost is estimated](/ai-ledger/concepts/cost-estimates/).
