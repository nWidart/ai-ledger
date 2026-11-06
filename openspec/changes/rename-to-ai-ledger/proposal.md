# Proposal

## Why

The app is about to ingest transcripts from more coding-agent CLIs than Claude Code (OpenAI's Codex CLI next, then xAI's Grok CLI), and the name `claude-errors-dashboard` already undersells it: it serves Activity and Cost as well as Errors. Renaming it to **AI Ledger** first keeps the multi-source change about data, not naming, and gets the risky parts of a rename (the store file, the repository folder) done while there is still one source.

## What Changes

- The app's name becomes **AI Ledger** (slug `ai-ledger`): the Python package, the web package, the page titles, the navigation brand (today "Claude ledger"), the README and the spec Purposes.
- The store file moves from `data/claude.duckdb` to `data/ai-ledger.duckdb`. On start, an existing store at the old path is moved to the new path, with its write-ahead log, and no empty store is ever created next to it. The store holds lines whose source transcripts no longer exist, so losing it is not recoverable.
- The repository folder is renamed from `claude-errors-dashboard` to `ai-ledger`. Sessions run in the old folder and in the new one belong to the same project, `ai-ledger`, through a project alias, so this repository's history does not split in two.
- Claude Code keys its per-project memory by folder path, so the memory folder is carried to the new path as a documented manual step.
- Unchanged: names that describe Claude itself (Claude tool names in `categorize.py`, `claude-*` models in `prices.json`, the `~/.claude/projects` transcript root, Claude Code wording on Activity and Cost), URLs and hash state, and the browser localStorage keys, so applied-fix markers and saved views survive.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transcript-store`: the store lives at `data/ai-ledger.duckdb` and an existing store at the old path is moved, never replaced; renamed repositories keep one project through an alias.
- `dashboard-app`: pages are titled and branded AI Ledger; saved browser state from before the rename is kept.

## Impact

- Code: `store.py` (default path, move on open, project aliases), `pyproject.toml` and `uv.lock`, `web/package.json` and `web/package-lock.json`, `web/index.html`, `web/src/App.tsx`, `web/src/components/Nav.tsx`, the committed `web/dist/` build, `README.md`, `.gitignore`, tests in `tests/test_store.py`.
- Specs: Purpose lines of all four specs; requirement deltas for `transcript-store` and `dashboard-app`.
- Outside the repository, done by the user after the code change lands: renaming the folder, moving the Claude Code memory folder, and repointing anything that opens the old path (T3 Code project, shell aliases). No git remote exists, so nothing changes on a host.
- Not affected: the API, URLs, ingest behavior, metrics.
