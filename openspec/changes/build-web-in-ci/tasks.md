# Tasks

## 1. Repository

- [x] 1.1 Untrack `src/ai_ledger/web/` (`git rm -r --cached`) and add it to `.gitignore`.
- [x] 1.2 Add `.gitattributes` with `CHANGELOG.md merge=union`.

## 2. CI

- [x] 2.1 In `ci.yml`, run `web-build` on every run and upload `src/ai_ledger/web/` as the `web-build` artifact; drop the step that diffs the build.
- [x] 2.2 Download `web-build` in `python-tests` and `package`; fail `package` when the wheel lacks `ai_ledger/web/index.html` or a JS asset.

## 3. Stale-build check

- [x] 3.1 Remove `web/scripts/stamp.mjs`; the `build` script runs `vite build` only.
- [x] 3.2 Remove `test_build_matches_sources` from `tests/test_web_build.py`; keep the devtools test, failing with the build command when the build is missing.

## 4. Docs and verify

- [x] 4.1 Update `AGENTS.md`, `CONTRIBUTING.md` and the comments that call the build committed.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests` and `openspec validate --specs --strict`.
- [x] 4.3 Run `uv build` and check the wheel holds `ai_ledger/web/index.html` and the assets.
- [x] 4.4 In a clone with no build, check a page answers 503 with the build hint.
- [x] 4.5 Check that a merge of two branches that each add a `CHANGELOG.md` line keeps both lines.
