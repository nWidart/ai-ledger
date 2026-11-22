## MODIFIED Requirements

### Requirement: Accept a proxy's host on /metrics only
`ai-ledger serve` SHALL take `--metrics-host HOST[:PORT]`, repeatable. `GET /metrics` SHALL accept a `Host` header equal to one of those values, ignoring case, as well as `127.0.0.1:<port>`. Every other route and every other method SHALL keep refusing it, unless `--proxy-host` also names it. A value that is not a host name with an optional port SHALL be refused at start. The app SHALL keep listening on `127.0.0.1` only.

#### Scenario: Through tailscale serve
- **WHEN** the app runs with `--metrics-host mac.example.ts.net` and a proxy sends `GET /metrics` with `Host: mac.example.ts.net`
- **THEN** the answer is 200 with the metrics

#### Scenario: Pages stay closed
- **WHEN** the same proxy sends `GET /usage` or `GET /api/status` with `Host: mac.example.ts.net`
- **THEN** the answer is 403

#### Scenario: Not given
- **WHEN** the app runs without `--metrics-host` and a client sends `GET /metrics` with `Host: mac.example.ts.net`
- **THEN** the answer is 403
