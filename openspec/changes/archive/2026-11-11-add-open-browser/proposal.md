# Proposal

## Why

`ai-ledger` prints a URL and waits. The user then copies it into a browser, every time.

## What Changes

- **`serve` opens Activity in the default browser** once the app listens.
- **`--no-open`** turns this off.
- **The app opens nothing when no one can see a browser**: when standard output is not a terminal (CI, a service, a pipe), or on Linux with no display.

Out of scope: detecting a tab left open from an earlier run. An earlier draft waited for such a tab to reconnect, which delayed the browser by seconds on every start.

## Capabilities

### Modified Capabilities
- `distribution`: the `serve` command opens the browser, with `--no-open` to skip it.

## Impact

- `src/ai_ledger/app.py`: `can_open`, the browser call in `serve`, `--no-open`.
- `README.md`: mention the browser opening and `--no-open`.
