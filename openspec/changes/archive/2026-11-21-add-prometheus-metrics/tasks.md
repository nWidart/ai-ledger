# Tasks

## 1. The endpoint

- [x] 1.1 Add `src/ai_ledger/prom.py`: the counter and histogram queries over the derived tables (cost from `metrics.requests_cte`, the automated rule from `metrics.automated_session`), the gauges from `live.states`, the open limit windows and `App.state`, and the text rendering with escaping.
- [x] 1.2 Workloads: read `workloads.json` beside the store (as `metrics.user_automated` reads its file), match each session's first prompt once, keep the map on `App` keyed by the file's mtime and size.
- [x] 1.3 Route `GET /metrics` in `app.py`; keep the rendered counters on `App` keyed by the change count and the user files' stats under their own lock; keep `payload["windows"]` from `refresh_alert`; answer 500 with the error type on failure.
- [x] 1.4 Tests: the rendered text of a test store (families, labels, escaping, cost, unpriced, automated, workload, histogram buckets, no transcript text), the workloads file (match, none, malformed, edited), the cache (no rebuild without a change, rebuild after one), and the route with its host check. `promtool check metrics` (prom/prometheus v3.15.1) passes on the test store's output and on a copy of a real store's.
- [x] 1.5 `--metrics-host HOST[:PORT]`, repeatable: `GET /metrics` also accepts that `Host`; every other route keeps refusing it. Verify with `test_app.py` ("test_host_check_on_the_default_and_a_custom_port").

## 2. The dashboard

- [x] 2.1 Add `contrib/grafana/ai-ledger.json` with a data source variable, the `instance`, `source`, `project`, `workload` and `automated` variables, and the panels the spec lists. Loaded in Grafana 13.2.5 by provisioning and by import.

## 3. Docs

- [x] 3.1 README: a "Prometheus and Grafana" section: the scrape config for one and for two machines (`tailscale serve` and `--metrics-host`), the workloads file, the metric list, the first-scrape step, what leaves the store.
- [x] 3.2 Docs site: a page on the metrics, the workloads file and the dashboard, written with the `doc-coauthoring` skill.
- [x] 3.3 `CHANGELOG.md` `[Unreleased]`: the endpoint, `--metrics-host`, the workloads file and the dashboard.
