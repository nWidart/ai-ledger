# AI Ledger

See what your coding agents did, what it cost, and where they got stuck. AI Ledger turns your Claude Code and Codex transcripts into six local dashboards.

<picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/tour-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/tour.gif" alt="Tour of the pages"></picture>

```bash
uvx ai-ledger    # opens http://127.0.0.1:8765/ in your browser
```

Needs [uv](https://docs.astral.sh/uv/). macOS and Linux. Nothing leaves your machine except the Limits check under [Privacy](https://github.com/nWidart/ai-ledger#privacy).

## What you get

- **Activity**: what got done per day, session and tool, and what needs attention.
- **Cost**: estimated spend at API list prices, per project, model and session, against the period before.
- **Errors**: failed tool calls by type, with a fix to paste into `CLAUDE.md` or `AGENTS.md`.
- **Limits**: each plan limit window, with a forecast to its reset.
- **Insights**: how Claude Code's `/insights` judged your sessions.
- **Live**: every active session as it runs: prompts, tool calls, subagents, context and cost.

Your agents delete old transcripts. AI Ledger keeps every line, so the history stays. Press **Cmd+K** to jump anywhere: `>errors #myproject #7d`.

The pages leave out sessions a tool started: claude-mem's `observer-sessions`, sessions with no prompt, and the one-prompt helpers apps run in temporary folders (session titles and the like). **Include automated** shows them. An active day is a day with a prompt.

Live lists the sessions that wrote in the last 10 minutes, grouped by who needs you first: **approval?** (a shell call pending for more than 30 seconds, likely waiting for your approval), **your turn**, **working**, **idle**, **ended**. A session keeps its place in its group until its state changes. A session on your turn shows how long it has waited, and the tab title counts the sessions that need you: `(2) Live · AI Ledger`. A Claude Code session you closed reads ended; Codex records no close, so a Codex session goes from your turn to idle.

In the stream, a shell call shows the description the agent gave it, with the command in the opened row. A finished subagent is folded, a running one shows its last 5 calls, and each header gives the subagent's cost, model and errors. The filters under the stream head keep only the failed calls, hide subagents, or hide the calls that only read. A paused page says Paused and shows no live dot; a lost connection says it is reconnecting, and retries on its own.

<table>
<tr><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/activity-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/activity.gif" alt="Activity"></picture></td><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/cost-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/cost.gif" alt="Cost"></picture></td></tr>
<tr><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/errors-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/errors.gif" alt="Errors"></picture></td><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/limits-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/limits.gif" alt="Limits"></picture></td></tr>
<tr><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/insights-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/insights.gif" alt="Insights"></picture></td><td><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/live-light.gif"><img src="https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/live.gif" alt="Live"></picture></td></tr>
</table>

## Install

```bash
uv tool install ai-ledger
ai-ledger                   # serve on http://127.0.0.1:8765/ and open it
uv tool upgrade ai-ledger   # new version and new prices
```

The app opens Activity in your browser; `--no-open` skips it. The first start reads every transcript, about 4 minutes for 3.4 GB. After that the app picks up new lines every 60 seconds.

| Option | Default |
| --- | --- |
| `--port` | `8765` |
| `--no-open` | off |
| `--projects` | `~/.claude/projects` |
| `--codex` | `~/.codex` |
| `--usage-data` | `~/.claude/usage-data` |
| `--db` | `~/Library/Application Support/ai-ledger/ai-ledger.duckdb` (macOS), `~/.local/share/ai-ledger/ai-ledger.duckdb` (Linux) |

With the app stopped, `ai-ledger ingest` reads new lines once and `ai-ledger rebuild` recomputes the derived tables.

### Prices

Cost uses the API list prices shipped with each version (`uv tool upgrade ai-ledger` brings new ones). To price a model the Cost page lists as unpriced, or to change a price, create `prices.json` next to the store: `~/Library/Application Support/ai-ledger/prices.json` on macOS, `~/.local/share/ai-ledger/prices.json` on Linux, or the `--db` file's folder. It takes the shape of the [packaged file](src/ai_ledger/prices.json), in USD per million tokens:

```json
{"models": {"my-model": {"input": 3, "output": 15, "cache_read": 0.3, "cache_5m": 3.75, "cache_1h": 6, "context": 200000}}}
```

Its entries add to the packaged prices, or replace a model of the same name, and survive upgrades. Costs are computed from the stored token counts on every page load, so reload the page; no `rebuild` is needed. If the file cannot be used, the app ignores it and the Cost page says why.

## Privacy

- The server listens on `127.0.0.1` only.
- The store keeps every transcript line, **including any secrets** that appeared in a session. Only your user can read it. Do not share it.
- On macOS, the Limits page sends your Claude Code OAuth token from the Keychain to Anthropic's undocumented usage endpoint every 5 minutes. The token goes nowhere else and is never stored or logged. Off macOS, Limits estimates from transcripts.
- Live shows word counts, shortened tool inputs and subagent descriptions by default. **Full text** puts transcript content on screen, secrets included: turn it off before you share your screen.
- Your browser loads the font from Google Fonts. No transcript data goes with it.

## Contributing

Needs uv and Node.

```bash
uv sync
uv run ai-ledger --db <copy> --port 8766   # run on a copy of the store
uv run ruff check                          # lint Python
uv run python -m unittest discover -s tests
cd web && npm install && npm run dev       # http://127.0.0.1:5173, /api proxied to the app
cd web && npm run check                    # typecheck, lint, test and build; run before committing
```

Commit the build in `src/ai_ledger/web/` with every `web/src` change. [`tools/demo/`](https://github.com/nWidart/ai-ledger/tree/main/tools/demo) records the GIFs from synthetic data. Maintainer notes, including releases, are in [AGENTS.md](https://github.com/nWidart/ai-ledger/blob/main/AGENTS.md).

## License

[MIT](https://github.com/nWidart/ai-ledger/blob/main/LICENSE)
