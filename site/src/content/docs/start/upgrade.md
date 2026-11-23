---
title: Upgrade and rebuild
description: Upgrade AI Ledger, and when and how to run ai-ledger rebuild with the app stopped.
---

In this tutorial we upgrade AI Ledger to its newest version and, when its release notes ask for it, run `ai-ledger rebuild` once. It takes a few minutes.

We start from the `ai-ledger` command that [Install and first run](/ai-ledger/start/install/) installed with `uv tool install`.

## Note the version we run

In a terminal, run:

```bash
ai-ledger --version
```

It prints the version, for example `ai-ledger 0.3.0`. This works while the app is running.

## Stop the app

Go to the terminal where `ai-ledger` runs and press **Ctrl+C**. The app stops.

The app must be stopped for the rest of this tutorial: while it runs, it owns the store, and `ai-ledger rebuild` cannot open it.

## Upgrade

Run:

```bash
uv tool upgrade ai-ledger
```

uv installs the newest version. The upgrade also brings that version's model prices.

Check the version again:

```bash
ai-ledger --version
```

It prints the new version, for example `ai-ledger 0.4.0`.

## Read what the upgrade asks for

Open the [Changelog](/ai-ledger/changelog/) and read the sections of every version newer than the one we ran. A version that needs a rebuild says so at the top of its section, for example:

> Run `ai-ledger rebuild` once after upgrading, with the app stopped.

The version that added Live's Tree asks for it so that sessions that span the upgrade get their agents; a session that started after the upgrade needs no rebuild. If none of those sections asks for it, skip the next step. A rebuild that was not needed does no harm; it only takes time.

## Rebuild the derived tables

Run:

```bash
ai-ledger rebuild
```

The rebuild recomputes the sessions, requests, tool calls and the other figures the pages read, from the transcript lines the store already holds. It reads no transcript file. When it is done, it prints the number of transcript files it replayed and the time it took, for example:

```text
{'files': 2140, 'seconds': 95.3}
```

The rebuild keeps what we set on the pages: the Errors page's fix markers and muted types stay as they were.

## Start the app

Run:

```bash
ai-ledger
```

The browser opens Activity, as before. Select the **Context** tab. Its heading reads as usual, and no notice says "The store holds sessions from before this version." The Context page shows that notice while its figures still need a rebuild. Other figures a rebuild fixes show no notice, which is why we read the changelog first.

## What we did

We upgraded AI Ledger, rebuilt the derived tables when the changelog asked for it, and checked that the Context page no longer asks for a rebuild. The store kept every transcript line through the upgrade.

To learn more:

- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): the raw lines, the derived tables, and why a rebuild is sometimes needed.
- [CLI and options](/ai-ledger/reference/cli/): `ingest`, `rebuild` and their options.
- [Troubleshooting and FAQ](/ai-ledger/reference/troubleshooting/): when a command says the app owns the store.
