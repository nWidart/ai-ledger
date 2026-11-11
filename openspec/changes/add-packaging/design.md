# Design

## Context

See proposal.md for why. The current state:

- `pyproject.toml` sets `[tool.uv] package = false`. The eight modules sit at the repository root and import each other as top-level modules (`import store`).
- `store.HERE` is the checkout root. `store.DEFAULT_DB` is `<checkout>/data/ai-ledger.duckdb`. `store.open_store` already moves the earlier `data/claude.duckdb` to the new name on first open (`move_earlier_store`).
- `app.WEB` is `<checkout>/web/dist`, the committed Vite build. `metrics.load_prices` reads `<checkout>/prices.json`.
- `tests/` put the checkout on `sys.path` and patch targets by module name (`patch("limits.subprocess…")`). `tools/demo/serve.py` does the same.
- `tests/test_web_build.py` and `web/scripts/stamp.mjs` hash `web/src` and compare it with `web/dist/source-hash.txt`.
- The only runtime dependency is `duckdb`. The repository has no CI.

## Goals / Non-Goals

**Goals:**
- A wheel that runs on macOS and Linux with `uvx ai-ledger`, built and published only by CI.
- One code path for a checkout and an installed package: the same paths, the same store default.
- No new runtime dependency.

**Non-Goals:**
- Windows. The data folder falls back to the XDG path there, and nothing tests it.
- Running from a zip import. The app reads its files from disk.
- Lowering `requires-python` below 3.14. uv fetches 3.14 for `uvx` users.

## Decisions

### Package layout: `src/ai_ledger/` with relative imports
Move the modules and `prices.json` into `src/ai_ledger/`, and add `__init__.py` (empty) and `__main__.py` (calls `app.main`). Imports between modules become `from . import store`. `[project.scripts] ai-ledger = "ai_ledger.app:main"`. Drop `package = false`, so `uv sync` installs the project in editable mode. Contributors run `uv run ai-ledger`.

- *Alternative: keep the flat layout and list the modules in the wheel config.* That publishes eight top-level modules named `store`, `live` and `metrics` into users' environments, where they clash with other packages. Rejected.
- *Alternative: keep a root `app.py` shim.* That keeps two ways to run the app and a second import path for the tests. Rejected. The README and `AGENTS.md` change instead.

### Build backend: `uv_build`
`uv_build` ships with uv, which the project already requires. It puts every file under the module folder into the wheel, so the frontend build and `prices.json` need no include rules. Pin it to the minor range of the uv in use (`uv_build>=0.13,<0.14`), as uv's docs recommend.

- *Alternative: hatchling with `force-include` of `web/dist`.* That works for the wheel, but an editable install still has no `web/dist` inside the package, so a checkout and an installed package would find the build in different places. Rejected.

### The frontend build goes into the package
Vite writes to `src/ai_ledger/web/` (`outDir: "../src/ai_ledger/web"`). `stamp.mjs` writes `source-hash.txt` there, and `tests/test_web_build.py` reads it from there. The build stays committed, as today. `app.WEB` becomes `os.path.join(HERE, "web")`, where `HERE` is the package folder.

Paths stay `__file__`-based rather than `importlib.resources`. The server opens files by path and checks `realpath` against the assets folder. Both need real files, and every wheel installer unpacks to disk.

### Data folder without `platformdirs`
A small function in `store.py` returns the data folder: `~/Library/Application Support/ai-ledger` when `sys.platform == "darwin"`, otherwise `$XDG_DATA_HOME/ai-ledger`, or `~/.local/share/ai-ledger` when that variable is unset or empty. `DEFAULT_DB` is `ai-ledger.duckdb` in that folder. The existing `open_store` already creates the folder with mode `0700`.

- *Alternative: `platformdirs`.* It is correct, but it adds a dependency for two lines of logic on the two supported platforms. Rejected.

### Moving the store out of a checkout
`HERE` is `src/ai_ledger/`, so the checkout root is two folders up. It counts as a checkout only when a `pyproject.toml` there names the project `ai-ledger`. In a `site-packages` install no such file exists, so nothing moves. The earlier paths, in order, are `<checkout>/data/ai-ledger.duckdb` and then `<checkout>/data/claude.duckdb`. `move_earlier_store` grows from one earlier path to this list. The rules stay the same: move only when the default is missing, move the `.wal` file too, and log when both exist.

The move uses `os.replace`, which is atomic on one file system. When the data folder is on another disk, `os.replace` raises `OSError` with `EXDEV`. The app then exits with a message naming both paths. Copying several gigabytes on start, with no progress, risks a half-written store if the copy is interrupted.

`tools/explore-copy.sh` uses the same data folder. It works out the path the same way: macOS, then `XDG_DATA_HOME`.

### Version from package metadata
`pyproject.toml` holds the version. `--version` reads it with `importlib.metadata.version("ai-ledger")`, and `argparse` handles the flag before the store opens. The release checks that the tag without its `v` equals the version that `uv version --short` prints.

### Tests import the package
Tests drop their `sys.path` inserts and use `from ai_ledger import store, metrics, …`. Patch targets gain the package prefix (`ai_ledger.limits.subprocess`). The subprocess test in `test_store.py` that imports `store` from a path imports `ai_ledger.store` with `src/` on its path. `tests/test_web_fixtures.py` keeps importing its sibling test modules. The commands stay `uv run python -m unittest discover -s tests`.

### CI: two workflows
- `ci.yml` runs on every push to `main` and every pull request:
  - `npm ci` and `npm run check` in `web/`, then `git diff --exit-code src/ai_ledger/web` to catch a stale committed build;
  - `uv sync --locked` and the unit tests;
  - `uv build`.
- `release.yml` runs on tags `v*`. Each job waits for the one before:
  1. **check**: the same steps as `ci.yml`, then the tag-and-version check, then `uv build`, and upload of `dist/` as an artifact.
  2. **smoke**: on `macos-latest` and `ubuntu-latest`, `uvx --from dist/<wheel> ai-ledger --version`. Then it starts `serve` with `--db`, `--projects`, `--codex` and `--usage-data` all under a temporary folder, waits for the port, fetches `/`, one built asset and `/api/usage` (the Activity payload), and stops the server. On macOS CI the Keychain lookup finds no token, so the Limits poller stays idle, as it does for any user without Claude Code.
  3. **publish**: `environment: pypi` with `permissions: id-token: write`, then `uv publish` with trusted publishing. No token is stored.
  4. **github-release**: extracts the version's section from `CHANGELOG.md` and runs `gh release create v<version> dist/* --notes-file <section>`.

The workflows pin `actions/checkout`, `actions/setup-node` and the artifact actions to a major version. `astral-sh/setup-uv` publishes no major tags, so it is pinned to a commit SHA, as its README recommends. `setup-uv` installs the uv version that `uv_build` is pinned for.

- *Alternative: `pypa/gh-action-pypi-publish`.* It works, but `uv publish` supports trusted publishing and keeps the toolchain to uv. Rejected for now.

### README on PyPI
PyPI renders `README.md` but cannot resolve relative image paths. The GIFs move to absolute `https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/…` URLs, so they show on both GitHub and PyPI.

### CHANGELOG format
Keep a Changelog: one `## [x.y.z] - YYYY-MM-DD` section per release. The release job's extraction is an `awk` range from one `## [` heading to the next.

## Risks / Trade-offs

- [A contributor's 3 GB store moves on their first start after upgrading] → The move is a rename on the same disk, so it is instant. The README's upgrade note names the old and new paths.
- [`--db data/ai-ledger.duckdb` in someone's scripts or habits now points at a moved file] → The note says so. `--db` still works with any path.
- [The `ai-ledger` name is taken on PyPI before the first publish] → It was free on 2026-11-11. Register the project with a pending trusted publisher before the release work merges.
- [The undocumented usage endpoint changes and Limits breaks for everyone at once] → This risk exists today, but it now reaches more users. The README says the endpoint is undocumented and that Limits falls back to estimates. A fix ships as a patch release.
- [`prices.json` goes stale between releases] → Prices update with each release, and the README says so. A user override file is out of scope.
- [Python 3.14 only] → `uvx` fetches 3.14. `pipx` users need 3.14 installed. The README gives the uv commands.

## Migration Plan

1. Merge the change. Contributors run `uv sync` and then `uv run ai-ledger`. The first start moves `data/ai-ledger.duckdb` into the data folder.
2. On PyPI, add a pending trusted publisher for project `ai-ledger`: repository `nWidart/ai-ledger`, workflow `release.yml`, environment `pypi`. On GitHub, create the `pypi` environment.
3. Tag `v0.1.0` and push the tag. The release publishes 0.1.0.
4. Rollback: yank the version on PyPI. To return to an older checkout, move the store back to `data/ai-ledger.duckdb`, or pass `--db` with the data-folder path.
