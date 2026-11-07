# AI Ledger

A local ledger of your Claude Code and Codex transcripts, with five dashboards: Activity, Cost, Errors, Limits and Insights.

![Tour of the pages](docs/tour.gif)

## Why

Coding agents leave a full record of their work on disk, then delete or archive it. That record answers questions their own UIs don't:

- **What did the agents get done, and where did they struggle?**
- **What did it cost, and why did that change?**
- **Which errors keep coming back, and how do I stop them?**
- **Will I hit my plan limit before it resets?**

Everything stays on your machine: the server listens on `127.0.0.1` only. The store keeps every transcript line, even after the agent deletes the file. Claude Code and Codex share the same tables, so every page filters by source. Filters and open sheets live in the URL.

## Run

Needs [uv](https://docs.astral.sh/uv/); it installs Python 3.14.

```bash
uv sync
uv run app.py               # http://127.0.0.1:8765/ (use 127.0.0.1, not localhost)
```

The first start reads every transcript (about 4 minutes for 3.4 GB). After that the app reads new lines every 60 seconds, or when you click **Refresh**.

Stop the app before you run these commands, because the app keeps the store open:

```bash
uv run app.py ingest        # read new transcript lines and /insights data once
uv run app.py rebuild       # recompute the derived tables, e.g. after a parser change
```

Options: `--projects <dir>` (default `~/.claude/projects`), `--codex <dir>` (default `~/.codex`), `--usage-data <dir>` (default `~/.claude/usage-data`), `--db <file>` (default `data/ai-ledger.duckdb`).

## Pages

**Activity**: what got done and what needs attention, per day, session and tool.

![Activity](docs/activity.gif)

**Cost**: estimated cost at API list prices against the period before, per project, day, model and session. Prices come from `prices.json`.

![Cost](docs/cost.gif)

**Errors**: failed tool calls by type, the error rate over time, and a fix to paste into `CLAUDE.md` for each type.

![Errors](docs/errors.gif)

**Limits**: usage of each plan limit window, with a forecast to its reset.

![Limits](docs/limits.gif)

Codex writes its limits into its session files. For Claude Code, the app polls Anthropic's undocumented usage endpoint every 5 minutes, using the OAuth token from the macOS Keychain. The token goes only to that endpoint and is never stored or logged. Off macOS, the app does not poll. Between readings, the page estimates usage from transcripts and labels it as estimated.

**Insights**: how Claude Code's `/insights` command judged your sessions: outcomes, satisfaction, friction, goals. These are model judgments, not measurements. Run `/insights` in Claude Code to analyse more sessions, then **Refresh**.

## Command palette

Press **Cmd+K** (**Ctrl+K** elsewhere) to build a view in one step. Type `#` to filter and `>` to go somewhere or run a command:

- `#` filters: a project, a source (`#claude`, `#codex`), a range (`#7d`, `#30d`, `#all`) or `#automated`.
- `>` destinations: a page (`>errors`), an inspector (`>bash`, an MCP server, a skill, a session), or a command (`>refresh`, `>copy link`).

Examples:

- `>errors #myproject` opens Errors filtered to `myproject`.
- `#myproject >bash` opens the Bash inspector on the current page, for `myproject`.
- `#myproject #codex #7d >cost` opens Cost with those three filters.
- `>errors >bash` opens Errors with the Bash inspector over it.

## Privacy

`data/ai-ledger.duckdb` holds full transcript content, including any secrets that appeared in a session. It is git-ignored. Do not share it.

## Develop

```bash
uv run python -m unittest discover -s tests
cd web && npm install && npm run dev    # http://127.0.0.1:5173, /api proxied to the running app
cd web && npm run check                 # typecheck, tests and build: run before committing
```

Commit `web/dist/` with every `web/src` change. A test fails when the build is stale.

To record the GIFs again from made-up data:

```bash
uv run tools/demo/seed.py                     # synthetic store in tools/demo/demo.duckdb
uv run tools/demo/serve.py                    # serves it on 127.0.0.1:8799
# in a second terminal:
cd tools/demo && npm install && npx playwright install chromium-headless-shell && npm run record    # needs gifski
```
