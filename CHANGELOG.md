# Changelog

All notable changes to AI Ledger are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Run `ai-ledger rebuild` once after upgrading (with the app stopped): error types, test runs and Codex tool timing are stored when transcripts are read.

### Added

- A `prices.json` next to the store adds or overrides model prices. The Cost page names the file when a model has no price.
- Activity shows thinking time and, per session, test runs passed of run.
- Limits forecasts use the open window's own recent pace as well as your usual pace, and say when a limit is already reached.
- Activity sorts its Sessions, Project metrics and Tools tables by column, lists failed test runs, shows the change against the previous period, charts errors per 100 calls, stacks the work chart by project, groups long ranges by week, adds a prompts-by-hour heatmap, and narrows Tools, MCP & hooks and Error loops to a selected day. The Sessions filters are kept in the URL.
- An `automated.json` next to the store lists more projects to treat as automated. Activity names the file when it cannot be used.
- New error types: "Command too complex for worktree check", "Network / DNS unreachable", "Browser automation failed" and "MCP tool error".
- Live groups sessions by who needs you first: approval?, your turn, working, idle, ended. A session keeps its place in its group until its state changes.
- Live shows how long a session has been on your turn or thinking, and the tab title counts the sessions that need you: `(2) Live · AI Ledger`.
- Live shows a Claude Code session you closed as ended. Codex records no close, so a Codex session goes idle.
- Live filters the stream: failed calls only, main thread only, or without the calls that only read, except a failed one.
- Live links the stream to the session sheet on Activity, and shows the date on times from another day.

### Changed

- Days follow the local clock on every page, so totals and charts agree.
- Session duration is active time: pauses over 20 minutes are left out.
- Helper sessions (no prompt, or one prompt in a temporary directory) count as automated and are hidden by default. Active days count days with a prompt.
- An error incident belongs to one agent and ends after more than two successful calls of that tool in between.
- A test run is a test, build or lint command, not any command that mentions a tool name.
- Pages refetch only when new data is stored, and update without replaying their animations.
- Insights caps long lists at the top 12, lists sessions by title, and reports coverage as "N of M sessions analysed".
- Live, with Full text off, sends tool inputs cut to 300 characters and an agent call's description instead of its prompt.
- Live shows a shell call's description as its row text and on its wall tile, with the command in the opened row.
- Live folds a finished subagent, shows the last 5 calls of a running one, and gives each subagent's cost, model and errors in its header.
- Live, when paused, says Paused and shows no live dot.
- The nav's "Last ingest" keeps up with Live while it is open.

### Fixed

- Cost: a day's sessions show that day's cost and add up to the bar; an unknown previous cost is no longer shown as $0.
- Errors: trends on a store with a thin start, the error-rate scale, and one "Change" comparison across the page.
- Live: subagent lanes no longer vanish after an update, late-written events are no longer missed, and running subagents carry their name.
- Limits: "Left unused" counts only full-length windows; "Points used" counts use inside the limit's own windows.
- Activity: the error-loops count, the Sessions table after a refresh, table layout at narrow widths, and the chart start.
- Project colours on a direct load of Insights, Live and Limits; the missing page icon; Back after closing a sheet.
- Live: a shell call with a timeout above 2 minutes no longer reads as "approval?".
- Live: the page reconnects on its own when the events stream fails with an HTTP error.
- Live: a finished Codex subagent folds as any other.
- Live: the rail's footer counts a session waiting for approval as waiting for you, not as working.
- A failed Refresh keeps its Retry until you retry; the status the nav polls no longer clears it.

## [0.1.3] - 2026-11-11

### Changed

- Releases carry provenance on PyPI: each file links to the commit and workflow that built it.

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

[0.1.3]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.3
[0.1.2]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.2
[0.1.1]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.1
[0.1.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.0
