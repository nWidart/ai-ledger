# AI Ledger

Local DuckDB store of Claude Code and Codex transcripts, served as dashboards (Activity, Cost, Errors, Limits, Insights, Live). See `README.md` for goals and setup, and `openspec/specs/` for page behavior. `tools/demo/` records the README GIFs from a synthetic store.

## Commands

- `uv sync` — install Python 3.14 and dependencies.
- `uv run ai-ledger` — serve on `http://127.0.0.1:8765/` (use `127.0.0.1`, not `localhost`). The code lives in `src/ai_ledger/`.
- `uv run ruff check` — lint Python.
- `uv run python -m unittest discover -s tests` — Python tests.
- `cd web && npm run check` — typecheck, lint (oxlint; warnings do not fail it), web tests and build. Run it before committing any `web/src` change.
- `uv run ai-ledger rebuild` — regenerate derived tables after a parser or `categorize.py` change.

## Rules

- `ingest` and `rebuild` need the app stopped: the app owns the store. The live store is `~/Library/Application Support/ai-ledger/ai-ledger.duckdb` on macOS (`$XDG_DATA_HOME/ai-ledger/` or `~/.local/share/ai-ledger/` on Linux). To test against real data, copy it and run `uv run ai-ledger --db <copy> --port <free port>`; never touch the live store.
- The store holds full transcript content, including secrets. Never commit, print or paste it.
- Commit `src/ai_ledger/web/` (the build) with every `web/src` change. `tests/test_web_build.py` and CI fail when the build is stale.
- After a payload change, regenerate the page-test fixtures in `web/src/__fixtures__/`: `uv run python -m unittest tests.test_web_fixtures`.
- Both sources (Claude Code, Codex) map onto the same derived tables. A parser change in `store.py` or `codex.py` must keep that shape.
- Plan features as OpenSpec changes in `openspec/changes/`; current specs live in `openspec/specs/`.
- Give each OpenSpec change its own git worktree, on its own branch from `main`. Propose, apply and archive the change in that worktree, never in the main checkout or another change's branch. After archiving, remove the worktree.
- Update `README.md` when user-visible behavior changes.
- Add user-visible changes to the `[Unreleased]` section of `CHANGELOG.md`.
- Release: run the Release PR workflow on `main` (`gh workflow run release-pr.yml`; `-f bump=patch|minor|major` overrides the bump it picks). It opens a `release/v<version>` PR that sets the version and dates the `[Unreleased]` section; edit the notes on that branch if needed. Merging it runs `.github/workflows/release.yml`, which checks and smoke-tests the merge commit, then tags it, publishes to PyPI and creates the GitHub release. Never tag or publish by hand; to retry after a fix on `main`, run `gh workflow run release.yml -f tag=v<version>`. The workflow needs the `RELEASE_TOKEN` secret.
