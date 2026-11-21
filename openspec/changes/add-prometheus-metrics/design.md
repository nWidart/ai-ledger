# Design

## Context

The app serves its pages and JSON from one `ThreadingHTTPServer` on `127.0.0.1`. `checked_host` refuses any `Host` but `127.0.0.1:<port>`; `same_site_only` refuses cross-site `/api` requests. `App` ingests every `INTERVAL` seconds under `App.lock` and records `state["last_change"]` when an ingest stored anything. Routes read with a fresh cursor and no lock. `refresh_alert` builds `limits.payload` once per full cycle for the nav pill.

The figures the pages show come from SQL over the derived tables: `metrics.requests_cte` gives each request its project, source and cost (reported cost, else the list-price estimate, else NULL); `metrics.scope` and `HELPER_SESSIONS` decide which sessions are automated; `live.sessions` derives each active session's state.

The first deployment is a headless home server where the agent CLIs, AI Ledger and Prometheus run side by side; Prometheus scrapes `127.0.0.1` targets with host networking.

## Goals / Non-Goals

**Goals**

- Any Prometheus on the same machine can scrape the figures with a plain `static_configs` target.
- The numbers match the pages: same cost rules, same automated rule, same sources.
- A scrape every 15 to 30 seconds costs about nothing between ingests.

**Non-Goals**

- No history backfill, no push, no OpenTelemetry, no second listener.
- No per-session or per-prompt series.
- No OpenTelemetry `gen_ai_*` names: the Cloud app that reads them cannot run self-hosted, and those families are per-call histograms that a total from the store cannot reproduce honestly.

## Decisions

### Counters are totals of the store, not events seen by the process

Each counter is a `count`/`sum` over the whole store at scrape time. The store only grows during normal running, so the values only go up, which is what a Prometheus counter needs. `ai-ledger rebuild` can lower a value (a parser fix that drops rows); Prometheus treats a lower value as a counter reset, and `rate()` stays right after it.

- *Why not count what each ingest adds, in memory?* A restart would start every counter at 0, and Prometheus would read the restart as a reset anyway. The store total survives restarts and matches the pages.
- *Cost:* the first scrape shows the whole history as one step. `increase()` over a window that holds the first scrape overstates that window. The docs say so.

### Labels

- `source`: `claude`, `codex` or `grok`.
- `project`: the session's project, as the pages name it.
- `model`: the request's model, on request, token and cost families only.
- `automated`: `true` or `false`, the rule the pages' "Include automated sessions" toggle uses (`AUTOMATED_PROJECTS`, the user automated file, `HELPER_SESSIONS`). A label, not a filter, so the dashboard can show both.
- `workload`: a name from the user workloads file, else `default` (see below).
- `kind` on tokens: the store's token columns, `input`, `output`, `thinking`, `cache_read`, `cache_5m`, `cache_1h`.
- `tool` and `result` (`ok`, `error`) on tool calls; `category` on tool errors.

No label holds a session id, a prompt, a command, an error message, a path or any transcript text. Project, model, tool and error-category names do leave the store; the docs say so.

Cardinality is projects × models × kinds × sources: a few thousand series for heavy personal use. Tool names are as the store has them, MCP tools included.

### Workloads: a user rule on the first prompt

The first deployment runs pull-request review agents next to sessions started by hand, in the same repositories and the same T3 worktree layout. Project, cwd, branch and entrypoint do not tell them apart; the first prompt does, since every review brief starts with the same line (`You work on pull request #…`). So a user file, `workloads.json` beside the store like `automated.json` and `prices.json`, names workloads by a prefix of the first prompt:

```json
{"workloads": [{"name": "pr-review", "prompt_prefix": "You work on pull request #"}]}
```

First match wins; no match is `default`. The prefix stays on the machine; only the name becomes a label.

- `App` keeps `{session_id: workload}` with the file's mtime and size. A session's first prompt does not change, so only sessions not in the map are read (`titles.first_prompts`, in batches), and a changed file clears the map.
- *Why not reuse `automated.json`?* That file decides what the pages hide; a workload hides nothing, it only names a group. Review sessions have prompts and are not automated by the pages' rule.
- *Why not a cwd or branch rule?* Review threads and hand-started threads share both on the box.
- *Cost:* a new user file format. It holds one key per entry and can grow keys later without breaking.

### Cost

`ai_ledger_cost_usd_total` sums `requests_cte`'s `cost`: the reported cost (Grok), else the list-price estimate. Requests with neither add nothing to cost and are counted in `ai_ledger_unpriced_requests_total`, so a dashboard can say the cost is partial.

### Cache by last change

`App` keeps the rendered counter text with the key it was built for: a count of the changes an ingest or a limit poll stored (`last_change` has a one-second resolution), and the mtime and size of the workloads, prices and automated files. A scrape compares the current key with it and rebuilds the counters only when they differ; the check and the rebuild run under a lock of their own (as `live_waiting` does), so concurrent scrapes build once. Gauges (active sessions, limit windows, ingest state, build info) are cheap and are rendered on every scrape.

- Limit windows: `refresh_alert` already builds `limits.payload` once per full cycle. It keeps `payload["windows"]` on `App`, and the scrape reads that list. No second payload build.
- Active sessions: `live.states` (the states `live.sessions` gives, without titles or figures) over the store with the time of the scrape, grouped by source and state.

### One listener, same host check

`/metrics` sits on the existing listener behind `checked_host`. Prometheus sends the target's `host:port` as `Host`, which is `127.0.0.1:<port>` for a local target, so the check passes. It is a GET outside `/api`, so `same_site_only` lets it through, and it is not under `/api`, so no page code depends on it.

- *Why not an opt-in listener on another address?* The first deployment needs none, and a second bind address is a new exposure to secure. A remote Prometheus can scrape through an SSH tunnel or a reverse proxy that sets `Host`.

### No dependency

The text format is a few lines per family: `# HELP`, `# TYPE`, then `name{labels} value`. `prom.py` writes it by hand, escaping label values (`\`, `"`, newline) as the format requires. `prometheus_client` would add a dependency for that and would want counters held in process.

### Errors

If a query fails, `/metrics` answers 500 with the exception type only (the message could carry stored text), and the previous cached counters stay for the next try. Prometheus records the target as down for that scrape.

## Risks / Trade-offs

- A store of millions of requests makes the counter rebuild slower. It runs at most once per ingest that changed data, on a scrape thread, not on the ingest thread.
- The active-session gauge reads the newest lines of each active session at every scrape (`live.states`, the read the Live page and the nav badge use): about 1.6 s on a store of 3,900 sessions with several active, nothing when none is. A faster `live.recent` would help Live as much; it is left for later.
- The step at the first scrape distorts `increase()` for that window. Acceptable; a backfill can come later.
- Clock: values carry no timestamps. Prometheus stamps them at scrape time, so a request appears in Prometheus up to one ingest interval plus one scrape interval after it happened.
