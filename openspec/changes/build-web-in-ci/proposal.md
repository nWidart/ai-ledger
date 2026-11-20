# Proposal

## Why

The repository tracks the Vite build in `src/ai_ledger/web/`. Each `web/src` change rewrites `source-hash.txt`, `index.html` and the hashed asset names, so any two branches that touch the frontend conflict on files nobody edits by hand. Replaying the 105 merge commits in the local history: 29 conflicted, 25 of them on the build, and 10 on nothing but the build and `README.md` or `CHANGELOG.md`. The fix is always the same: rebuild.

`CHANGELOG.md` is the other frequent conflict: every branch adds lines at the top of `[Unreleased]`.

## What Changes

- Git stops tracking `src/ai_ledger/web/` and ignores it.
- CI builds the frontend once per run, from `web/` at that commit, and hands the build to the Python tests and to the package job. The package job fails when the wheel holds no build. The release workflow already runs CI on the release commit, so the published wheel ships a build made from that commit.
- The stale-build check goes: `web/scripts/stamp.mjs`, `source-hash.txt`, `test_build_matches_sources` and the CI step that diffs the build. A build made in CI cannot be stale. The test that the build ships no devtools stays.
- A source checkout needs `cd web && npm ci && npm run build` before `uv run ai-ledger` or the Python tests. Without it, pages already answer 503 with that hint.
- `.gitattributes` sets `merge=union` on `CHANGELOG.md`, so local merges keep both sides' lines.

## Impact

- `.gitignore`, `.gitattributes`, `.github/workflows/ci.yml`.
- `web/package.json`, `web/scripts/stamp.mjs` (removed), `tests/test_web_build.py`, comments in `src/ai_ledger/app.py` and `tests/test_app.py`.
- `AGENTS.md`, `CONTRIBUTING.md`, the recording steps in `tools/demo/record.mjs` and `serve.py`, and task 3.3 of the open `add-grok-source` change.
- `merge=union` applies to local merges and rebases only. GitHub's merge buttons ignore it, so a pull request can still show a `CHANGELOG.md` conflict until `main` is merged into it locally.
- No change to the app, the payloads, the store or the published package's contents. Installing from a git URL (`uv tool install git+…`) no longer gets a frontend; the README does not offer it.
- Open branches that changed the build hit one modify/delete conflict on `src/ai_ledger/web/` when they take this change; `git rm -r --cached src/ai_ledger/web` resolves it.
- The tasks of open changes that say "commit the rebuilt `src/ai_ledger/web/`" no longer apply; run `npm run check` instead.

## Capabilities

### Modified Capabilities
- `distribution`: CI builds the frontend; the repository holds no build; the stale-build check goes.
