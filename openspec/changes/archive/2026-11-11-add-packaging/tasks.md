# Tasks

## 1. License and package metadata

- [x] 1.1 Add `LICENSE` with the MIT text, `Copyright (c) 2026 Nicolas Widart`, and verify GitHub detects it as MIT (`gh repo view --json licenseInfo` after push, or `licensee` locally)
- [x] 1.2 In `pyproject.toml`, drop `[tool.uv] package = false` and add `[build-system]` with `uv_build>=0.13,<0.14`, plus `license = "MIT"`, `license-files = ["LICENSE"]`, `readme = "README.md"`, `authors`, `keywords`, classifiers (macOS, POSIX Linux, Python 3.14, MIT) and `[project.urls]` (Homepage, Issues, Changelog). Verify with `uv lock` and a clean `uv sync`.

## 2. Package layout

- [x] 2.1 `git mv` `app.py`, `store.py`, `codex.py`, `categorize.py`, `insights.py`, `limits.py`, `live.py`, `metrics.py` and `prices.json` into `src/ai_ledger/`. Add an empty `__init__.py` and a `__main__.py` that calls `app.main()`. Turn imports between the modules into relative imports. Verify `uv run python -c "import ai_ledger.app"` succeeds.
- [x] 2.2 Add `[project.scripts] ai-ledger = "ai_ledger.app:main"`, and add `--version` to the `argparse` setup from `importlib.metadata.version("ai-ledger")`. Update the `--db` help text and the module docstring's usage lines to `ai-ledger …`. Add a `test_app.py` case that `--version` prints `ai-ledger <version>` and exits 0 without opening a store. Verify `uv run ai-ledger --version` and `uv run python -m ai_ledger --version`.
- [x] 2.5 Add `--port` (default 8765). Pass it through `serve`, the Host check and the `localhost` redirect in place of the `PORT` constant, and name `--port` in the "cannot listen" message. Add `test_app.py` cases for a custom port's Host check and for the port-in-use message. Verify that `uv run ai-ledger --db <copy> --port 8766` serves while the live app holds 8765.
- [x] 2.3 Point the tests at the package: drop the `sys.path` inserts, import from `ai_ledger`, and prefix the patch targets (`ai_ledger.limits.subprocess`, `ai_ledger.insights.ingest`, …). Fix the subprocess script in `test_store.py`. Verify `uv run python -m unittest discover -s tests` passes with the same test count as on `main`.
- [x] 2.4 Point `tools/demo/serve.py`, `seed.py` and `replay.py` at the package, and update `tools/demo/` usage notes. Verify `uv run python tools/demo/seed.py` builds the demo store and `serve.py` serves it.

## 3. Frontend build inside the package

- [x] 3.1 Set Vite's `outDir` to `../src/ai_ledger/web`. Make `stamp.mjs` write `source-hash.txt` there and `tests/test_web_build.py` read it from there. Set `app.WEB` to the package's `web` folder. Delete `web/dist/` and commit the new build. Verify with `cd web && npm run check`, then `uv run python -m unittest tests.test_web_build`, and confirm the app serves `/` and an asset.
- [x] 3.2 Make `metrics.load_prices` read `prices.json` from the package folder. Verify `test_metrics` passes.
- [x] 3.3 Run `uv build`, list the wheel (`unzip -l dist/*.whl`), and confirm it holds the modules, `web/index.html`, `web/assets/*`, `prices.json` and `LICENSE`, with no `tests/`, `data/` or `web/src`. Install it into a fresh environment outside the checkout (`uv run --isolated --with dist/<wheel> ai-ledger serve --db <tmp> --projects <empty> --codex <empty> --usage-data <empty> --port 8766`). Confirm Activity, Cost, Errors, Limits, Insights and Live load.

## 4. Store in the per-user data folder

- [x] 4.1 Add the data-folder function to `store.py` (macOS Application Support, `XDG_DATA_HOME`, `~/.local/share`) and set `DEFAULT_DB` from it. Add tests for macOS, for `XDG_DATA_HOME` set, and for it unset or empty, patching `sys.platform`, the environment and the home folder.
- [x] 4.2 Detect a source checkout (a `pyproject.toml` two folders above the package that names `ai-ledger`). Grow `move_earlier_store` to the ordered list `data/ai-ledger.duckdb`, then `data/claude.duckdb`. On `EXDEV`, raise an error that `main` prints with both paths and the `--db` hint, and exit 1 without creating a store. Add `test_store.py` cases for every scenario in the transcript-store delta: a move from `data/ai-ledger.duckdb`, a move from `data/claude.duckdb`, the `.wal` file moving along, both files existing, a cross-device error (patch `os.replace` to raise `EXDEV`), `--db` moving nothing, and no checkout meaning no move.
- [x] 4.3 Make `tools/explore-copy.sh` use the data folder, and verify `sync` and `delete` against a copy.
- [x] 4.4 In a temporary clone of the branch, put a copy of the real store at its `data/ai-ledger.duckdb`, and set `HOME` (and `XDG_DATA_HOME` on Linux) to a temporary folder. Run `uv run ai-ledger --port 8766` and confirm the copy moved into the temporary data folder and every page loads. Never touch the live store.

## 5. CI and release

- [x] 5.1 Add `.github/workflows/ci.yml` for pushes to `main` and pull requests. It runs `npm ci`, `npm run check`, `git diff --exit-code src/ai_ledger/web`, `uv sync --locked`, the unit tests and `uv build`. Verify on a pushed branch that it passes, and that a deliberately stale build fails it.
- [x] 5.2 Add `.github/workflows/release.yml` on tags `v*`, with the four jobs `check`, `smoke`, `publish` and `github-release` from design.md. `check` fails when the tag differs from `uv version --short`. `smoke` runs on `macos-latest` and `ubuntu-latest` against a temporary store and fetches `/`, one asset and `/api/usage`. `publish` uses `environment: pypi`, `id-token: write` and `uv publish`. `github-release` uses the `CHANGELOG.md` section as notes. Verify the smoke and changelog-extraction steps locally with the same commands, and that `actionlint` reports nothing.
- [x] 5.3 Add `CHANGELOG.md` in Keep a Changelog format with a `## [0.1.0] - <release date>` section listing the six pages, both sources and the package. Verify that the release job's `awk` extraction prints exactly that section.

## 6. Docs

- [x] 6.1 Rewrite the top of `README.md`:
  - lead with `uvx ai-ledger` and `uv tool install ai-ledger` (and `uv tool upgrade ai-ledger`);
  - say where the store lives on macOS and Linux;
  - add a "What it reads and sends" section: full transcripts and secrets in the store; the Keychain token and the undocumented endpoint for Limits; listening on `127.0.0.1` only; prices that update with each release.

  Change the commands to `ai-ledger ingest` and `ai-ledger rebuild`. Move the from-source steps (`uv sync`, `uv run ai-ledger`, `npm run check`) into a Contributing section with the upgrade note on the moved store. Make the GIF links absolute `raw.githubusercontent.com` URLs. Add a license line. Verify every command in the README runs as written.
- [x] 6.2 Update `AGENTS.md`: `uv run ai-ledger` in place of `uv run app.py`, the store path in the data folder (and `--db` with a copy for testing), `src/ai_ledger/web/` in place of `web/dist/`, and the release steps. Verify no `app.py` or `web/dist` references remain (`grep -rn "app.py\|web/dist" AGENTS.md README.md tools`).

## 7. Integration

- [x] 7.1 From a clean clone of the branch, without Node on `PATH`, run `uv sync`, `uv run ai-ledger --version`, the unit tests and `uv build`, and confirm all pass. Then run `openspec validate add-packaging --strict` and confirm it passes.

## Workflow follow-up

- Before the first release: register `ai-ledger` on PyPI with a pending trusted publisher (repository `nWidart/ai-ledger`, workflow `release.yml`, environment `pypi`), and create the `pypi` environment on GitHub. Only the maintainer can do this.
- Archive the change, merge `feat/add-packaging` into `main`, and remove the worktree.
- Tag `v0.1.0` on `main`, push the tag, and confirm `uvx ai-ledger@0.1.0 --version` works from a machine with no checkout.
