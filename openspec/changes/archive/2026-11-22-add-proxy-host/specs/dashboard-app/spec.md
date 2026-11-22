## ADDED Requirements

### Requirement: Answer a proxy's host by name
`ai-ledger serve` SHALL take `--proxy-host HOST[:PORT]`, repeatable. Every route and method SHALL accept a `Host` header equal to one of those values, ignoring case, as it accepts `127.0.0.1:<port>`. A value that is not a host name with an optional port SHALL be refused at start. Without the option, every other host SHALL keep getting `403 forbidden host`. The app SHALL keep listening on `127.0.0.1` only.

#### Scenario: Through tailscale serve
- **WHEN** the app runs with `--proxy-host box.example.ts.net:8445` and a proxy sends `GET /usage` or `GET /api/status` with `Host: box.example.ts.net:8445`
- **THEN** the answer is 200

#### Scenario: Not named
- **WHEN** the app runs with `--proxy-host box.example.ts.net:8445` and a request carries `Host: box.example.ts.net` or `Host: example.com`
- **THEN** the answer is 403

### Requirement: Refuse other sites behind the proxy
A request for a `--proxy-host` host SHALL be refused with `403 forbidden cross-site request` when another site sent it, as for `127.0.0.1:<port>`. When the browser sends no `Sec-Fetch-Site`, the request's `Origin` SHALL be `https://<host>` or `http://<host>`.

#### Scenario: A change from the proxied page
- **WHEN** a browser without `Sec-Fetch-Site` posts to the app through that proxy with `Origin: https://box.example.ts.net:8445`
- **THEN** the app handles the request

#### Scenario: Another site through the proxy
- **WHEN** a request through that proxy carries `Origin: https://evil.example` or `Sec-Fetch-Site: cross-site`
- **THEN** the answer is 403
