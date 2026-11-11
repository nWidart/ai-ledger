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
- **Errors**: failed tool calls by type, with a fix to paste into `CLAUDE.md`.
- **Limits**: each plan limit window, with a forecast to its reset.
- **Insights**: how Claude Code's `/insights` judged your sessions.
- **Live**: every active session as it runs: prompts, tool calls, subagents, context and cost.

Your agents delete old transcripts. AI Ledger keeps every line, so the history stays. Press **Cmd+K** to jump anywhere: `>errors #myproject #7d`.

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

## Privacy

- The server listens on `127.0.0.1` only.
- The store keeps every transcript line, **including any secrets** that appeared in a session. Only your user can read it. Do not share it.
- On macOS, the Limits page sends your Claude Code OAuth token from the Keychain to Anthropic's undocumented usage endpoint every 5 minutes. The token goes nowhere else and is never stored or logged. Off macOS, Limits estimates from transcripts.
- Live shows word counts by default. **Full text** puts transcript content on screen, secrets included: turn it off before you share your screen.
- Your browser loads the font from Google Fonts. No transcript data goes with it.

## Contributing

Needs uv and Node.

```bash
uv sync
uv run ai-ledger --db <copy> --port 8766   # run on a copy of the store
uv run python -m unittest discover -s tests
cd web && npm install && npm run dev       # http://127.0.0.1:5173, /api proxied to the app
cd web && npm run check                    # run before committing
```

Commit the build in `src/ai_ledger/web/` with every `web/src` change. [`tools/demo/`](https://github.com/nWidart/ai-ledger/tree/main/tools/demo) records the GIFs from synthetic data. Maintainer notes, including releases, are in [AGENTS.md](https://github.com/nWidart/ai-ledger/blob/main/AGENTS.md).

## License

[MIT](https://github.com/nWidart/ai-ledger/blob/main/LICENSE)
