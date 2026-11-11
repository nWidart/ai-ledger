# Spec Delta

## ADDED Requirements

### Requirement: Open the browser on start
When `serve` starts listening, it SHALL open `http://127.0.0.1:<port>/` in the default browser, unless `--no-open` is passed, standard output is not a terminal, or the app runs on Linux with neither `DISPLAY` nor `WAYLAND_DISPLAY` set. The app SHALL print the URL in every case.

#### Scenario: Start in a terminal
- **WHEN** the user runs `ai-ledger` in a terminal
- **THEN** the default browser opens Activity

#### Scenario: Opt out
- **WHEN** the user runs `ai-ledger --no-open`
- **THEN** the app serves and opens no browser

#### Scenario: No terminal
- **WHEN** the app runs with standard output redirected, as in CI
- **THEN** the app opens no browser
