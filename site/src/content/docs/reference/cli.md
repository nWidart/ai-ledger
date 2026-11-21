---
title: CLI and options
description: The ai-ledger commands and their options.
spec: [distribution, dashboard-app, transcript-store]
---

The package `ai-ledger` provides the `ai-ledger` command. `python -m ai_ledger` runs the same program.

```text
ai-ledger [command] [options]
```

`uvx ai-ledger` runs it without installing. `uv tool install ai-ledger` installs it, and `uv tool upgrade ai-ledger` upgrades it. AI Ledger needs [uv](https://docs.astral.sh/uv/) and runs on macOS and Linux.

## Commands

| Command | What it does |
| --- | --- |
| `ai-ledger` or `ai-ledger serve` | Serves the dashboards on `http://127.0.0.1:8765/` and opens the browser. Ingests at start and every 60 seconds, and every second while a Live page is open. |
| `ai-ledger ingest` | Ingests new transcript lines and `/insights` usage data once, prints a summary and `done in <seconds>s`, then exits. |
| `ai-ledger rebuild` | Regenerates the derived tables from the stored raw lines, then exits. It does not change the marks and muted types on Errors. |

`ingest` and `rebuild` need the app stopped. The app owns the store, and a second process that opens it exits with status 1 and the message "the app is running and owns the store; use Refresh in the dashboard". See [Troubleshooting and FAQ](/ai-ledger/reference/troubleshooting/).

While the app runs, **Refresh** in the navigation (or `>refresh` in the command palette) ingests at once.

`rebuild` reads no transcript root, so of the options below only `--db` applies to it.

A first ingest reads every transcript and takes about 5 minutes for a month of heavy use. After that, ingest reads only the lines added since the last one.

## Options

| Option | Default | Meaning | Used by |
| --- | --- | --- | --- |
| `--port <number>` | `8765` | The port to serve on, at `127.0.0.1`. | `serve` |
| `--no-open` | off | Serve without opening the browser. | `serve` |
| `--projects <path>` | `~/.claude/projects` | The Claude Code transcript root. | `serve`, `ingest` |
| `--codex <path>` | `~/.codex` | The Codex home. The app reads `session_index.jsonl`, `sessions/**/rollout-*.jsonl`, `sessions/**/rollout-*.jsonl.zst`, `archived_sessions/rollout-*.jsonl` and `archived_sessions/rollout-*.jsonl.zst` under it. | `serve`, `ingest` |
| `--grok <path>` | `~/.grok` | The Grok home. The app reads `sessions/*/*/updates.jsonl` under it. | `serve`, `ingest` |
| `--usage-data <path>` | `~/.claude/usage-data` | The directory of Claude Code's `/insights` usage data. | `serve`, `ingest` |
| `--db <file>` | The store in the [data folder](/ai-ledger/reference/storage/) | The database file. The configuration files are read from its folder. | all |
| `--version` | | Prints `ai-ledger <version>` and exits without opening the store. It works while the app runs. | |
| `-h`, `--help` | | Prints the usage and exits. | |

A transcript root that does not exist, such as a missing Codex or Grok home, is no error: ingest skips that source and still ingests the others.

## Behavior of `serve`

- The server listens on `127.0.0.1` only, at the chosen port.
- When the port is in use, the app exits with status 1 and a message that names the port and the `--port` option: `cannot listen on 127.0.0.1:<port>: <reason>; pass --port to use another port`.
- The app prints `serving http://127.0.0.1:<port>/ (ingest every 60s)`.
- The app opens the browser unless `--no-open` is given, standard output is not a terminal, or it runs on Linux with neither `DISPLAY` nor `WAYLAND_DISPLAY` set. It prints the URL in every case.
- A second instance on another store and port runs beside the first: `ai-ledger --db <copy> --port 8766`.
- A request with a `Host` of `localhost:<port>` is redirected to `127.0.0.1:<port>`. A request with any other host gets 403.

## Exit status

| Status | When |
| --- | --- |
| 0 | The command finished. |
| 1 | The store is held by another process, the default store cannot be moved from an earlier path (it is on another disk), or the port is in use. |
