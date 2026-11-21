# prometheus-metrics Specification

## Purpose

Serve the store's figures to Prometheus, so a self-hosted Grafana can chart and alert on spend, tokens, sessions, tool calls and plan limits for every machine that runs AI Ledger, with no transcript text leaving the store.

## Requirements

### Requirement: Serve metrics in the Prometheus text format
The app SHALL answer `GET /metrics` on its listener with the Prometheus text exposition format, version 0.0.4, content type `text/plain; version=0.0.4; charset=utf-8`. Every metric name SHALL start with `ai_ledger_`. Every family SHALL have a `# HELP` and a `# TYPE` line. Label values SHALL be escaped as the format requires. Samples SHALL carry no timestamps. The route SHALL apply the same host check as every other route, except for the names `--metrics-host` adds.

#### Scenario: Local scrape
- **WHEN** a client sends `GET /metrics` with `Host: 127.0.0.1:8765` to an app on port 8765
- **THEN** the answer is 200 with the text format, and `promtool check metrics` reports no error on it

#### Scenario: Other host
- **WHEN** a client sends `GET /metrics` with `Host: example.com`
- **THEN** the answer is 403, as for every other route

#### Scenario: Label escaping
- **WHEN** a project's name holds a double quote
- **THEN** its label value escapes the quote with a backslash

### Requirement: Accept a proxy's host on /metrics only
`ai-ledger serve` SHALL take `--metrics-host HOST[:PORT]`, repeatable. `GET /metrics` SHALL accept a `Host` header equal to one of those values, ignoring case, as well as `127.0.0.1:<port>`. Every other route and every other method SHALL keep refusing it. A value that is not a host name with an optional port SHALL be refused at start. The app SHALL keep listening on `127.0.0.1` only.

#### Scenario: Through tailscale serve
- **WHEN** the app runs with `--metrics-host mac.example.ts.net` and a proxy sends `GET /metrics` with `Host: mac.example.ts.net`
- **THEN** the answer is 200 with the metrics

#### Scenario: Pages stay closed
- **WHEN** the same proxy sends `GET /usage` or `GET /api/status` with `Host: mac.example.ts.net`
- **THEN** the answer is 403

#### Scenario: Not given
- **WHEN** the app runs without `--metrics-host` and a client sends `GET /metrics` with `Host: mac.example.ts.net`
- **THEN** the answer is 403

### Requirement: Counters are totals of the store
Every `_total` family SHALL be the total over the whole store at scrape time. Every counter family SHALL carry `source`, `project` and `workload` labels, and an `automated` label that is `true` exactly for the sessions the pages leave out when "Include automated sessions" is off. A label set with no rows SHALL have no sample.

#### Scenario: Automated session
- **WHEN** a session has no prompt
- **THEN** its requests count under `automated="true"`

#### Scenario: Restart
- **WHEN** the app restarts with an unchanged store
- **THEN** every counter has the value it had before the restart

### Requirement: Label sessions by workload
The app SHALL read an optional user workloads file, `workloads.json` beside the store, holding `{"workloads": [{"name": …, "prompt_prefix": …}, …]}`. A session's workload SHALL be the name of the first entry whose `prompt_prefix` starts the session's first human prompt, else `default`. A missing, unreadable or malformed file SHALL give every session `default`; a bad file SHALL be reported on stderr once per change. Only the entry's name SHALL leave the store.

#### Scenario: Review agents
- **WHEN** the file holds `{"name": "pr-review", "prompt_prefix": "You work on pull request #"}` and a session's first prompt starts with `You work on pull request #12`
- **THEN** that session's series carry `workload="pr-review"`, and a session started by hand carries `workload="default"`

#### Scenario: No file
- **WHEN** there is no workloads file
- **THEN** every series carries `workload="default"`

#### Scenario: Malformed file
- **WHEN** the file is not valid JSON
- **THEN** every series carries `workload="default"` and stderr says why, once

#### Scenario: File edited
- **WHEN** the user adds an entry to the file while the app runs
- **THEN** the next scrape works out every session's workload again with the new entry

### Requirement: Count requests, tokens and cost
The app SHALL expose `ai_ledger_requests_total`, `ai_ledger_unpriced_requests_total`, `ai_ledger_cost_usd_total` and `ai_ledger_tokens_total`, each also labelled `model`. Tokens SHALL also be labelled `kind`: `input`, `output`, `thinking`, `cache_read`, `cache_5m` or `cache_1h`. Cost SHALL follow the pages' rule: a request's reported cost, else its list-price estimate. A request with neither SHALL add nothing to cost and SHALL count in `ai_ledger_unpriced_requests_total`.

#### Scenario: Cost matches the Cost page
- **WHEN** the store holds a Claude Code request on a priced model and a Grok request with a reported cost of 0.02 USD, both in project `web`
- **THEN** `ai_ledger_cost_usd_total{source="claude",project="web",…}` is the Claude request's estimate as the Cost page computes it, and the Grok series is 0.02

#### Scenario: Unpriced model
- **WHEN** a request's model has no price and its source reported no cost
- **THEN** it counts in `ai_ledger_requests_total` and `ai_ledger_unpriced_requests_total` for its labels and adds nothing to cost

### Requirement: Count sessions and their work
The app SHALL expose `ai_ledger_sessions_total`, `ai_ledger_prompts_total`, `ai_ledger_compactions_total`, `ai_ledger_commits_total`, `ai_ledger_model_seconds_total`, and `ai_ledger_test_runs_total` labelled `result` (`passed` or `failed`). Model time SHALL be the figure the session sheet shows, so a session without one adds nothing.

#### Scenario: Session without model time
- **WHEN** a Codex session has no model time
- **THEN** it counts in `ai_ledger_sessions_total` and adds nothing to `ai_ledger_model_seconds_total`

#### Scenario: Test runs
- **WHEN** a session ran tests twice, once passing and once failing
- **THEN** `ai_ledger_test_runs_total` is 1 for `result="passed"` and 1 for `result="failed"`

### Requirement: Count tool calls
The app SHALL expose `ai_ledger_tool_calls_total` labelled `tool` and `result` (`ok` or `error`), and `ai_ledger_tool_errors_total` labelled `category`, the error category the Errors page gives the call.

#### Scenario: Tool errors
- **WHEN** a session made three `Bash` calls and one failed with category `test-failure`
- **THEN** `ai_ledger_tool_calls_total` is 2 for `result="ok"` and 1 for `result="error"`, and `ai_ledger_tool_errors_total{category="test-failure",…}` is 1

### Requirement: Histogram of tool-call durations
The app SHALL expose `ai_ledger_tool_call_duration_seconds`, a histogram labelled `source`, `workload` and `tool`, over every tool call with both a start and an end time, with buckets 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600 seconds and `+Inf`, and its `_sum` and `_count`.

#### Scenario: Durations
- **WHEN** a `Read` call took 0.3 s and another 7 s
- **THEN** the `Read` series has `le="0.5"` at 1, `le="10"` at 2, `_count` at 2 and `_sum` at 7.3

#### Scenario: Running call
- **WHEN** a call has no end time
- **THEN** it is in no bucket

### Requirement: Gauge active sessions
The app SHALL expose `ai_ledger_active_sessions`, labelled `source`, `project`, `workload` and `state`, worked out at each scrape: the count of sessions the Live page lists as active, automated sessions included, by the state Live gives them. A label set with no active session SHALL have no sample.

#### Scenario: Waiting session
- **WHEN** one Claude Code session waits for the user's next prompt and one Codex session runs a tool
- **THEN** each has a sample of 1 under its own source and state

### Requirement: Gauge open limit windows
The app SHALL expose `ai_ledger_limit_used_ratio` (0 to 1) and `ai_ledger_limit_resets_timestamp_seconds` (Unix time), labelled `provider`, `limit` and `window`: `limit` is the stored limit id, with `/<scope>` when the limit has a scope, and `window` the name the Limits page gives the window, such as `5-hour`; one sample per open plan-limit window the Limits page shows, as of the app's last full cycle.

#### Scenario: Open window
- **WHEN** the Claude 5-hour window is 42% used and resets at 15:00 UTC
- **THEN** its `ai_ledger_limit_used_ratio` is 0.42 and its reset gauge is 15:00 UTC as Unix time

#### Scenario: No limit poll
- **WHEN** no provider's limits were ever polled
- **THEN** the limit families have no sample

### Requirement: Gauge the app's state
The app SHALL expose `ai_ledger_last_ingest_timestamp_seconds`, the Unix time of the last ingest, with no sample before the first; `ai_ledger_ingest_failed`, 1 when the last ingest failed, else 0; and `ai_ledger_build_info`, 1, labelled `version`.

#### Scenario: Failed ingest
- **WHEN** the last ingest raised an error
- **THEN** `ai_ledger_ingest_failed` is 1 and `ai_ledger_last_ingest_timestamp_seconds` keeps the time of the last ingest that finished

### Requirement: Rebuild counters only after data changed
The app SHALL work out the counters again only when an ingest or a limit poll stored something, or the workloads, prices or automated file changed, since they were last worked out; a scrape in between SHALL reuse them. Concurrent scrapes SHALL work them out once. A scrape SHALL NOT take the store lock. When working them out fails, the answer SHALL be 500 with the error's type only, and the next scrape SHALL try again.

#### Scenario: Two scrapes, no ingest
- **WHEN** two scrapes arrive with no ingest between them
- **THEN** the second runs no counter query and gives the same counter values

#### Scenario: Ingest in between
- **WHEN** an ingest stores a new request between two scrapes
- **THEN** the second scrape's `ai_ledger_requests_total` for its labels is one higher

### Requirement: Expose no transcript content
No sample or label SHALL hold a session id, prompt, command, tool input, error message, file path or any other text from a transcript. Label values SHALL come only from source, project, model, workload name, tool, error category, test result, live state, limit names and the app version.

#### Scenario: Error message
- **WHEN** a failed tool call's error text holds a secret
- **THEN** the secret appears nowhere in `/metrics`; only the call's category does

### Requirement: Ship a Grafana dashboard
The repository SHALL ship `contrib/grafana/ai-ledger.json`, a Grafana dashboard over these metrics that picks its Prometheus data source from a variable and filters by instance, source, project, workload and automated flag. It SHALL show spend per day, tokens by kind, cache hit share, requests by model, tool error rate, tool-call p95 duration, active sessions by state, open limit windows and the time since the last ingest.

#### Scenario: Import
- **WHEN** a user imports the file into Grafana with a Prometheus that scrapes the app
- **THEN** every panel's query names only `ai_ledger_` metrics and the chosen data source
