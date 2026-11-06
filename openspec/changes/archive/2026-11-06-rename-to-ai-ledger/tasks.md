# Tasks

## 1. Store file move

- [x] 1.1 Change `DEFAULT_DB` to `data/ai-ledger.duckdb` and, in `open_store`, move `data/claude.duckdb` and its `.wal` to the new path before connecting, only when the path is the default and the new file is missing. Finish an orphan WAL move when the new file exists but its WAL does not and `claude.duckdb.wal` does. Log and move nothing when both store files exist. Verify with `tests/test_store.py` tests (pointing the default paths at a temp dir) for: old file only (lines kept, old path gone), old file plus WAL (lines committed only to the WAL survive), both files (old untouched), explicit `--db` (nothing moved), orphan WAL, and mode `0600` on the moved file.
- [x] 1.2 Update the default path in `README.md` (options and the files list) and in `tests/test_store.py`. Verify with `git grep -n "claude.duckdb"`, which lists only the earlier-path constant and its tests.

## 2. Project alias

- [x] 2.1 Add `PROJECT_ALIASES = {"claude-errors-dashboard": "ai-ledger"}` to `store.py` and apply it to every result of `resolve_project`. Verify with tests that a missing `cwd` `~/Sites/projects/claude-errors-dashboard` and its `.claude/worktrees/x` both resolve to `ai-ledger`.
- [x] 2.2 On `open_store`, rewrite aliased names in `projects_by_cwd` and `sessions`, idempotently. Verify with a test that a store holding `claude-errors-dashboard` sessions reports only `ai-ledger` after opening, that a second open changes nothing, and that `rebuild` keeps `ai-ledger`.

## 3. App identity

- [x] 3.1 Rename the Python package to `ai-ledger` in `pyproject.toml` (description "Local store and dashboards for AI coding-agent transcripts") and refresh `uv.lock` with `uv lock`. Verify that `uv run app.py --help` runs.
- [x] 3.2 Rename the web package to `ai-ledger-web` in `web/package.json` and `web/package-lock.json`. Set `web/index.html` `<title>` to `AI Ledger`, the route titles in `web/src/App.tsx` to `Activity · AI Ledger`, `Cost · AI Ledger` and `Errors · AI Ledger`, and the brand in `web/src/components/Nav.tsx` to "AI **Ledger**". Leave every localStorage key unchanged. Update `Nav.test.tsx` for the new titles and add a test that the brand reads `AI Ledger`. Verify with `npm run check` in `web/`.
- [x] 3.3 Rebuild and commit `web/dist/`. Verify that `tests/test_web_build.py` passes and that `/usage`, `/cost` and `/errors` show the new titles in a browser, with an applied-fix marker and a saved Activity metric from before the change still showing.
- [x] 3.4 Rename the README heading to "AI Ledger", reword its opening to "a local ledger of your AI coding-agent transcripts (today Claude Code)", and add a "Renamed from claude-errors-dashboard" section with the steps from design.md's Migration Plan. Replace `claude-errors.html` in `.gitignore` only if that file is still produced. Verify by reading the rendered README and with `git grep -n "claude-errors-dashboard"`, which lists only the alias, its tests, the README note and archived changes.
- [x] 3.5 Update the Purpose lines of `openspec/specs/transcript-store/spec.md` (keep "Claude Code" while it is the only source, and name the store generically), plus `dashboard-app`, `usage-dashboard` and `cost-dashboard` where they name the app. Verify with `openspec validate --specs --strict`.

## 4. Integration

- [x] 4.1 Run `uv run python -m unittest` and `npm run check`, then start the app against a copy of the real store at the old path. Verify that the app opens `data/ai-ledger.duckdb` with the same `raw_lines` count as before, and that the project picker shows `ai-ledger` and no `claude-errors-dashboard`.

## Workflow follow-up

- After the change lands, the user renames the folder and moves the Claude Code memory folder, following the README steps.
- Archive the change, then start the multi-source change (Codex CLI) in the renamed repository.
