# Changelog

All notable changes to AI Ledger are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-11-11

### Added

- `ai-ledger` opens Activity in your browser when it starts. `--no-open` skips it. Nothing opens when the app runs without a terminal, or on Linux without a display.

## [0.1.1] - 2026-11-11

### Changed

- A shorter README, with GIFs of every page, Live and Insights included, in light and dark mode. Its links work on PyPI.

## [0.1.0] - 2026-11-11

First release on PyPI.

### Added

- Six pages: Activity, Cost, Errors, Limits, Insights and Live.
- Two sources, Claude Code and Codex, in the same tables, with a source filter on every page.
- The `ai-ledger` package and command: run it with `uvx ai-ledger`, or install it with `uv tool install ai-ledger`. It
  keeps the `serve`, `ingest` and `rebuild` commands and adds `--version` and `--port`.
- The package carries the built pages and the price table, so it runs without Node or a checkout.
- MIT license.

### Changed

- The store lives in the per-user data folder: `~/Library/Application Support/ai-ledger/` on macOS,
  `$XDG_DATA_HOME/ai-ledger/` (or `~/.local/share/ai-ledger/`) elsewhere. A source checkout's `data/ai-ledger.duckdb`
  moves there on the first start.

[0.1.2]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.2
[0.1.1]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.1
[0.1.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.0
