---
title: How AI Ledger works
description: Where the data comes from, how ingest and the derived tables work, and when to rebuild.
---

AI Ledger is a local app that keeps its own copy of your coding agents' transcripts and computes every page from that copy. It reads the files Claude Code and Codex already write, stores each line in a DuckDB file on your machine, and derives the sessions, requests and tool calls the pages show. This page explains why it works that way and what follows from it.

## Why keep a copy

Coding agents write a transcript for every session, and they delete old ones. A dashboard that reads the transcripts each time loses history as the agent cleans up, and rescans gigabytes on every load.

AI Ledger reads each line once and keeps it. The store never deletes or changes a line because its source file was deleted, cut short or rewritten. Months of history stay countable after the agent has removed the files.

## Where the data comes from

AI Ledger reads four kinds of data:

| Data | Where | What it gives |
| --- | --- | --- |
| Claude Code transcripts | `~/.claude/projects/<project>/<session>.jsonl`, and subagent transcripts in `<session>/subagents/` | Prompts, API requests and their tokens, tool calls and their results, compactions, `/context` results. |
| Codex transcripts | `~/.codex/sessions/`, one rollout file per thread, compressed to `.jsonl.zst` once old, and `~/.codex/archived_sessions/` | The same, plus the plan limits Codex reports. |
| `/insights` data | `~/.claude/usage-data` | How Claude Code's `/insights` judged each session. |
| Claude Code's plan limits | Anthropic's usage endpoint, on macOS only | The percent used of each limit window. |

The `--projects`, `--codex` and `--usage-data` options point AI Ledger at other folders; see [CLI and options](/ai-ledger/reference/cli/). How the Claude Code token for the usage endpoint is handled is in [Privacy and security model](/ai-ledger/concepts/privacy-security/).

## Two layers: raw lines and derived tables

The store has two layers.

The **raw layer** holds every transcript line as written, with the file it came from. A line that is not valid JSON is kept too, marked unparsed. Resumed and forked sessions copy earlier lines into new files; the store keeps each such line once, by its id. The raw layer also keeps every plan-limit response the app polled and every `/insights` file it read.

The **derived tables** hold what the pages count: sessions, requests, tool calls, prompts, hooks, plan-limit snapshots, `/insights` judgments, session titles and `/context` snapshots. Ingest writes them as it reads each line. A few rules shape them:

- **One shape for both agents.** Claude Code and Codex lines map onto the same tables, and token columns mean the same thing whatever the source: uncached input, output (thinking included), cache read and cache write. A day's total is the sum of both agents, with nothing counted twice.
- **Usage once per response.** Claude Code writes one line per content block of a response. The tokens of that response count once.
- **One project per repository.** A session belongs to the project of its folder. A session in a git worktree belongs to the repository's main checkout, and sessions in temporary folders go under `(temp)`.

Some things are not in the derived tables:

- **Costs.** The app prices the stored token counts each time a page loads. A new price table, or your own `prices.json`, applies on the next page load. See [How cost is estimated](/ai-ledger/concepts/cost-estimates/).
- **Configuration.** `prices.json` and `automated.json` are read on every page load as well. See [Configuration](/ai-ledger/reference/configuration/).
- **The Errors page's marks.** Fix markers and muted error types are your input, not transcript data. They have a table of their own that a rebuild leaves alone.

## Ingest

An ingest reads every transcript file under the folders above and stores what is new. It reads only the bytes added since the previous ingest, and only complete lines: a line the agent is still writing waits for the next ingest. When a file is now shorter than what was read, the file is read again from the start, and the store skips the lines it already holds.

The app ingests when it starts and then every 60 seconds. While a [Live](/ai-ledger/pages/live/) page is open, it reads transcripts every second, so Live follows a session as it runs; `/insights` data and plan limits stay on the 60-second cycle, and Claude Code's limits are polled at most once every 5 minutes. **Refresh** in the navigation bar runs an ingest at once. An open page loads its data again only when an ingest stored something new.

The first ingest reads every transcript on the machine. It takes about 5 minutes for a month of heavy use. The app serves its pages from the start, and the navigation bar says **Ingesting…** until that first ingest is done. Later ingests read only new lines.

### One owner

Only one process can write to the store. While the app runs, it owns the store, and the `ai-ledger ingest` and `ai-ledger rebuild` commands exit with:

```text
the app is running and owns the store; use Refresh in the dashboard
```

This keeps two writers from corrupting the store. To ingest while the app runs, use **Refresh**. To run `ingest` or `rebuild`, stop the app first.

## When a rebuild is needed

Each derived row is written by the version of AI Ledger that read its line. When a new version derives more from a line, such as a new column, a new error type or a fixed parser, the lines read before the upgrade keep the old derivation. New lines get the new one.

`ai-ledger rebuild` closes that gap. It drops the derived tables and replays every stored line, file by file, through its own agent's parser. It reads no transcript file, so sessions whose files the agent has deleted are rebuilt too. It derives the plan-limit snapshots again from the stored polls, and the `/insights` judgments from the stored files. The Errors page's marks stay as they are.

A rebuild is needed only when a version's release notes ask for one. The [Changelog](/ai-ledger/changelog/) says so at the top of that version's section, and the Context page shows a notice while its figures still need one. New prices and changes to the configuration files never need a rebuild. [Upgrade and rebuild](/ai-ledger/start/upgrade/) walks through it.

## Trade-offs

- **The store only grows.** Keeping every line is what makes history survive, and it means the store holds every secret that ever appeared in a session. See [Privacy and security model](/ai-ledger/concepts/privacy-security/).
- **Polling, not watching.** A fixed 60-second cycle keeps the app simple and its load predictable; the one-second pass runs only while Live needs it.
- **A one-time cost on upgrade.** Deriving at ingest makes pages fast, at the price of an occasional rebuild when derivation changes.

## Related

- [Data files and storage locations](/ai-ledger/reference/storage/): where the store and its configuration files are.
- [CLI and options](/ai-ledger/reference/cli/): `serve`, `ingest`, `rebuild` and their options.
- [Upgrade and rebuild](/ai-ledger/start/upgrade/).
