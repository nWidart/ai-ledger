---
title: Install and first run
description: Install AI Ledger with uvx, run it for the first time and wait for the first ingest.
---

In this tutorial we start AI Ledger for the first time, let it read every Claude Code, Codex and Grok transcript on the machine, and read the first figure it gives us. It takes about 10 minutes, most of it spent waiting for the first ingest.

We need a Mac or a Linux machine where Claude Code, Codex or the Grok CLI has already run, and a terminal.

## Check that uv is installed

AI Ledger runs through [uv](https://docs.astral.sh/uv/). In a terminal, run:

```bash
uv --version
```

The terminal prints uv's version. If it says the command is not found, install uv with [its install guide](https://docs.astral.sh/uv/getting-started/installation/), open a new terminal and run `uv --version` again.

## Start AI Ledger

Run:

```bash
uvx ai-ledger
```

uv downloads AI Ledger and starts it. The terminal prints:

```text
serving http://127.0.0.1:8765/ (ingest every 60s)
```

The browser opens `http://127.0.0.1:8765/` on the **Activity** page. If no browser opens, open that address yourself.

Leave the terminal open. The app runs until we stop it there.

## Wait for the first ingest

The first start reads every transcript on the machine: Claude Code's in `~/.claude/projects`, Codex's in `~/.codex` and Grok's in `~/.grok`. While it reads, the navigation bar at the top of the page says **Ingesting…**, next to the **Refresh** button.

This takes a few minutes: about 5 minutes for a month of heavy use. The page fills in as it goes.

When the ingest is done, the terminal prints one line that counts what it read, for example:

```text
ingest: 2140 files, 812345 new lines, 96 usage-data files (0 skipped), 231.4s
```

The navigation bar now shows the time of the ingest, such as **8:00 PM**. Hover it or select it to see the details, with the number of new lines. The page loads the new figures by itself.

## Read the first figure

Look at the heading of the Activity page. It sums up the last 30 days, for example:

> 214 commits from 1,032 prompts in 96 sessions across 12 projects, 18 active days

That is what our coding agents got done this month. Below it, the **Needs attention** card lists what to look at first, such as error loops or sessions that filled their context window.

## Stop the app and install the command

Go back to the terminal and press **Ctrl+C**. The app stops, and the page can no longer reach it.

`uvx` runs AI Ledger without installing it. For every later start, we install the `ai-ledger` command:

```bash
uv tool install ai-ledger
```

Then start the app with it:

```bash
ai-ledger
```

The browser opens Activity again, with the same figures. This start is much faster: the store already holds every line, so the app reads only lines added since we stopped it.

## What we have now

AI Ledger keeps its own copy of every transcript line in a local store, and reads new lines every 60 seconds while it runs. Our agents can delete their old transcripts; the store keeps them.

Next, take the [15-minute first tour](/ai-ledger/start/first-tour/) of every page.

To learn more:

- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): ingest, the store and its derived tables.
- [Privacy and security model](/ai-ledger/concepts/privacy-security/): the store holds full transcripts, secrets included.
- [Data files and storage locations](/ai-ledger/reference/storage/): where the store is on disk.
- [CLI and options](/ai-ledger/reference/cli/): every command and option.
