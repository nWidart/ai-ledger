# Proposal

## Why

The repository is public, but it has no license, and running it means cloning it and starting it from the checkout. The app stores its data inside that checkout too. Before AI Ledger is shared officially, people need one command to install and run it, a license that lets them use it, and a release they can trust and update.

## What Changes

- **MIT license.** Add `LICENSE` and declare it in the package metadata.
- **PyPI package `ai-ledger` with an `ai-ledger` command.** `uvx ai-ledger` runs the app. `uv tool install ai-ledger` installs it. The command keeps today's subcommands (`serve`, `ingest`, `rebuild`) and options, and gains `--version` and `--port` (default 8765), so a user whose port is taken can still run it. `python -m ai_ledger` works too.
- **The package carries the frontend build and `prices.json`.** An installed app serves every page with no Node and no checkout.
- **BREAKING: The store moves to a per-user data folder.** The default is `~/Library/Application Support/ai-ledger/ai-ledger.duckdb` on macOS, and `$XDG_DATA_HOME/ai-ledger/ai-ledger.duckdb` elsewhere (`~/.local/share/ai-ledger` when `XDG_DATA_HOME` is unset). When the app runs from a source checkout and the new file does not exist, the first start moves the checkout's `data/ai-ledger.duckdb` (or the earlier `data/claude.duckdb`) there. It never creates an empty store while an old one exists. `--db` still overrides the default.
- **BREAKING for contributors: `uv run app.py` becomes `uv run ai-ledger`.** The Python modules move into `src/ai_ledger/`.
- **Release on tag.** Pushing a tag `v*` runs the web check and the Python tests, then builds the wheel and the source archive. It smoke-tests the built wheel with `uvx` on macOS and Linux, publishes to PyPI with trusted publishing, and creates a GitHub release from `CHANGELOG.md`.
- **README for users first.** The README leads with `uvx ai-ledger`, says where the store lives, and states plainly what the app reads and sends: the store holds full transcripts, secrets included; and on macOS the Limits page reads the Claude Code OAuth token from the Keychain to call Anthropic's undocumented usage endpoint. The from-source steps move to a contributor section.
- **Version `0.1.0` and `CHANGELOG.md`.**

Out of scope: Docker, a Homebrew formula, a single-file binary, Windows support, an update check, and opening the browser on start.

## Capabilities

### New Capabilities
- `distribution`: how AI Ledger is licensed, packaged, installed, run as a command, versioned and released.

### Modified Capabilities
- `transcript-store`: the default store file moves to the per-user data folder, and a store in a source checkout moves there on first start. The privacy requirement no longer depends on the store's folder being git-ignored.
- `dashboard-app`: the app serves its pages from the files that ship with it, in a checkout or an installed package.

## Impact

- **Code layout:** `app.py`, `store.py`, `codex.py`, `categorize.py`, `insights.py`, `limits.py`, `live.py`, `metrics.py` and `prices.json` move into `src/ai_ledger/`. Imports between them become package imports. The Vite build writes to `src/ai_ledger/web/` instead of `web/dist/`.
- **`pyproject.toml`:** the project becomes a package with a build backend, a console script, a license, a readme, classifiers and project URLs.
- **Tests and tools:** `tests/` and `tools/demo/` import from `ai_ledger`. `tests/test_web_build.py` checks the new build folder. `tools/explore-copy.sh` finds the store in the data folder.
- **New files:** `LICENSE`, `CHANGELOG.md`, `.github/workflows/release.yml`, and a CI workflow for pushes and pull requests.
- **Docs:** `README.md` and `AGENTS.md` commands and paths.
- **Outside the repo:** one-time setup of the `ai-ledger` project on PyPI with a trusted publisher for this repository's release workflow, and a `pypi` environment on GitHub.
