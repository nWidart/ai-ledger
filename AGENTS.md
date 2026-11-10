# AI Ledger

Local DuckDB store of Claude Code and Codex transcripts, served as dashboards (Activity, Cost, Errors, Limits, Insights, Live). See `README.md` for goals and setup, and `openspec/specs/` for page behavior. `tools/demo/` records the README GIFs from a synthetic store.

## Commands

- `uv sync` — install Python 3.14 and dependencies.
- `uv run app.py` — serve on `http://127.0.0.1:8765/` (use `127.0.0.1`, not `localhost`).
- `uv run python -m unittest discover -s tests` — Python tests.
- `cd web && npm run check` — typecheck, web tests and build. Run it before committing any `web/src` change.
- `uv run app.py rebuild` — regenerate derived tables after a parser or `categorize.py` change.

## Rules

- `ingest` and `rebuild` need the app stopped: the app owns the store. To test against real data, copy `data/ai-ledger.duckdb` and pass `--db <copy>` with a free port; never touch the live store.
- `data/` holds full transcript content, including secrets. Never commit, print or paste it.
- Commit `web/dist/` with every `web/src` change. `tests/test_web_build.py` fails when the build is stale.
- After a payload change, regenerate the page-test fixtures in `web/src/__fixtures__/`: `uv run python -m unittest tests.test_web_fixtures`.
- Both sources (Claude Code, Codex) map onto the same derived tables. A parser change in `store.py` or `codex.py` must keep that shape.
- Plan features as OpenSpec changes in `openspec/changes/`; current specs live in `openspec/specs/`.
- Give each OpenSpec change its own git worktree, on its own branch from `main`. Propose, apply and archive the change in that worktree, never in the main checkout or another change's branch. After archiving, remove the worktree.
- Update `README.md` when user-visible behavior changes.
