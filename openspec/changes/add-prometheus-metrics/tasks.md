# Tasks

## 1. The endpoint

- [ ] 1.1 Add `src/ai_ledger/prom.py`: the counter and histogram queries over the derived tables (cost from `metrics.requests_cte`, the automated rule from `metrics.scope`'s parts), the gauges from `live.sessions`, the open limit windows and `App.state`, and the text rendering with escaping.
- [ ] 1.2 Workloads: read `workloads.json` beside the store (as `metrics.user_automated` reads its file), match each session's first prompt once, keep the map on `App` keyed by the file's mtime and size.
- [ ] 1.3 Route `GET /metrics` in `app.py`; keep the rendered counters on `App` keyed by `last_change` under their own lock; keep `payload["windows"]` from `refresh_alert`; answer 500 with the error type on failure.
- [ ] 1.4 Tests: the rendered text of a test store (families, labels, escaping, cost, unpriced, automated, workload, histogram buckets, no transcript text), the workloads file (match, none, malformed, edited), the cache (no rebuild without a change, rebuild after one), and the route with its host check. Run the output through `promtool check metrics` once by hand and record the result in the PR.

## 2. The dashboard

- [ ] 2.1 Add `contrib/grafana/ai-ledger.json` with a data source variable, the `instance`, `source`, `project`, `workload` and `automated` variables, and the panels the spec lists.

## 3. Docs

- [ ] 3.1 README: a "Prometheus and Grafana" section: the scrape config, the metric list, the first-scrape step, what leaves the store.
- [ ] 3.2 Docs site: a page on the metrics and the dashboard, written with the `doc-coauthoring` skill.
- [ ] 3.3 `CHANGELOG.md` `[Unreleased]`: the endpoint and the dashboard.
