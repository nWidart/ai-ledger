---
title: Data files and storage locations
description: Where the store and the configuration files live on macOS and Linux.
spec: [transcript-store, distribution]
---

AI Ledger keeps everything in one folder per user, outside the installed code. An upgrade keeps the store and every stored line.

## Data folder

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/ai-ledger/` |
| Linux | `$XDG_DATA_HOME/ai-ledger/`, or `~/.local/share/ai-ledger/` when `XDG_DATA_HOME` is unset or empty |
| With `--db <file>` | The folder of that file |

The app creates the folder on first start, readable by your user only.

## Files

| File | Holds | Created by |
| --- | --- | --- |
| `ai-ledger.duckdb` | The store: a DuckDB database with every transcript line verbatim, and the tables derived from them. Only your user can read or write it. | The app, on first start. |
| `ai-ledger.duckdb.wal` | DuckDB's write-ahead log of the store, and its temporary files. They hold transcript text too. | DuckDB. |
| `prices.json` | Model prices and plan prices. See [Configuration](/ai-ledger/reference/configuration/#pricesjson). | You, optional. |
| `automated.json` | Extra automated projects. See [Configuration](/ai-ledger/reference/configuration/#automated-projects). | You, optional. |

With `--db <file>`, the configuration files are `prices.json` and `automated.json` next to that file, and the app uses that file as the store.

## What the store holds

- Every line of every transcript the app has read, from Claude Code (`--projects`) and Codex (`--codex`), as written. A deleted, truncated or rewritten source file does not remove or change the stored lines.
- The tables derived from those lines: sessions, requests, tool calls and prompts, each linked to its project and session. Both sources map onto the same tables.
- Claude Code's `/insights` usage data, plan-limit snapshots and the `/context` snapshots that Claude Code records in transcripts.
- The Errors page's marks (fix days and muted types). They come from your actions, not from transcripts. `ai-ledger rebuild` leaves them as they are.

The store holds full transcript content, **including any secrets** that appeared in a session. Do not share it or commit it. See [Privacy and security model](/ai-ledger/concepts/privacy-security/).

## Not in the data folder

| What | Where |
| --- | --- |
| Claude Code transcripts (read) | `~/.claude/projects` |
| Claude Code `/insights` usage data (read) | `~/.claude/usage-data` |
| Codex sessions (read) | `~/.codex` |
| Theme and sheet width | Your browser's local storage, per browser |

The app never writes to the transcript roots.

## Earlier locations

A source checkout that kept its store in `data/ai-ledger.duckdb`, or in the earlier `data/claude.duckdb`, has it moved to the data folder, with its log, the first time the app opens the default store. The app never replaces an existing store. When the two are on different disks, the app exits with the message "cannot move the store … they are on different disks" and names both paths; move the file by hand or pass `--db <old path>`.

## Use a copy

To try a store without touching the live one, copy the `.duckdb` file (and its `.wal` file, if any) while the app is stopped, and serve the copy on another port:

```bash
ai-ledger --db <copy> --port 8766
```
