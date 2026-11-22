## MODIFIED Requirements

### Requirement: Choose the port
The `serve` command SHALL accept `--port <number>`, default `8765`, and SHALL listen on `127.0.0.1` at that port and answer requests addressed to that port only, besides the host names `--proxy-host` and `--metrics-host` add. When the port is in use, the app SHALL exit with a message naming the port and the `--port` option.

#### Scenario: Second instance beside a running app
- **WHEN** the app serves on 8765 and the user runs `ai-ledger --db <copy> --port 8766`
- **THEN** the second app serves the copy at `http://127.0.0.1:8766/`

#### Scenario: Port in use
- **WHEN** another process holds port 8765 and the user runs `ai-ledger`
- **THEN** the app exits with status 1 and a message that names port 8765 and suggests `--port`
