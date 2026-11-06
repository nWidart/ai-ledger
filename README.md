# AI Ledger

A local ledger of your Claude Code and Codex transcripts, with four dashboards: Activity, Cost, Errors and Limits.

![Tour of the four pages](docs/tour.gif)

## Why

Coding agents leave a full record of their work on disk, then delete or archive it. That record answers questions their own UIs don't:

- **What did the agents get done, and where did they struggle?** Commits, prompts, sessions, error loops, flaky tools.
- **What did it cost, and why did that change?** An estimate at API list prices, compared with the period before.
- **Which errors keep coming back, and how do I stop them?** Failed tool calls grouped by cause, each with a fix to paste into `CLAUDE.md`.
- **Will I hit my plan limit before it resets?** A forecast per limit window, and which provider has room left.

Goals:

- **Local and private.** Everything stays on your machine. The server listens on `127.0.0.1` only.
- **Permanent.** The store keeps every transcript line, even after the agent deletes or archives the file.
- **One view of both agents.** Claude Code and Codex map onto the same tables, so every page filters by source.
- **Linkable.** Filters, open sheets and single errors live in the URL, so you can paste a view into an agent prompt.

## Run

Needs [uv](https://docs.astral.sh/uv/); it installs Python 3.14.

```bash
uv sync
uv run app.py               # http://127.0.0.1:8765/ (use 127.0.0.1, not localhost)
```

The first start reads every transcript (about 4 minutes for 3.4 GB). After that the app reads new lines every 60 seconds. Click **Refresh** to read them now.

Stop the app before you run these commands, because the app keeps the store open:

```bash
uv run app.py ingest        # read new transcript lines once
uv run app.py rebuild       # recompute the derived tables, e.g. after a parser change
```

Options: `--projects <dir>` (default `~/.claude/projects`), `--codex <dir>` (default `~/.codex`), `--db <file>` (default `data/ai-ledger.duckdb`).

## Pages

**Activity**: what got done and what needs attention. Select a day to list its sessions. Open a session to see its context timeline. Click a tool to open the tool inspector.

![Activity](docs/activity.gif)

**Cost**: estimated cost against the period before, with each project's share of the change. Also: spend per day, by model and per session. Prices come from `prices.json`. The page names models missing from it and leaves them out of the totals.

![Cost](docs/cost.gif)

**Errors**: failed tool calls by type, the error rate over time, and a suggested fix for each type. Mark a fix as applied to compare the error rate before and after it. Each error type and each example has a permalink.

![Errors](docs/errors.gif)

**Limits**: usage of each plan limit window, with a forecast to its reset. Below: capacity left unused, past windows, and what 1% of a limit buys.

![Limits](docs/limits.gif)

Where the limit figures come from:

- **Codex** writes its limits into its session files.
- **Claude Code** writes none. Every 5 minutes, the app asks Anthropic's usage endpoint (`api.anthropic.com/api/oauth/usage`). This endpoint is undocumented and can change without notice. The request uses the OAuth token that Claude Code keeps in the macOS Keychain. The app sends the token only to that endpoint and never stores or logs it. Off macOS, the app does not poll Claude limits.
- Between readings, the page estimates usage from the transcripts and labels those figures as estimated.

## Privacy

`data/ai-ledger.duckdb` holds full transcript content, including any secrets that appeared in a session. It is git-ignored. Do not share it.

## Files

- `app.py`: the HTTP server, the background ingest, and the CLI commands.
- `store.py`, `codex.py`: the store, and the parsers for Claude Code and Codex.
- `categorize.py`: error types and their fixes. Add a rule when an error pattern shows up under "Other", then run `rebuild`.
- `metrics.py`, `limits.py`: the queries and forecasts behind the pages.
- `web/`: the React pages. `web/dist/` is the committed build that the app serves.
- `tools/demo/`: the recorder that makes the GIFs above.
- `openspec/specs/`: how each page behaves in detail.

## Develop

```bash
uv run python -m unittest discover -s tests
cd web && npm install && npm run dev    # http://127.0.0.1:5173, /api proxied to the running app
cd web && npm run check                 # typecheck, tests and build: run before committing
```

Commit `web/dist/` with every `web/src` change. A test fails when the build is stale.

To record the GIFs again, run these from the repository root. The recorder writes them to `docs/`, using only made-up data:

```bash
uv run tools/demo/seed.py                     # synthetic store in tools/demo/demo.duckdb
uv run tools/demo/serve.py                    # serves it on 127.0.0.1:8799, with no ingest and no polling
# in a second terminal:
cd tools/demo && npm install && npx playwright install chromium-headless-shell && npm run record    # needs gifski: brew install gifski
```
