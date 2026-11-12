# Tasks

## 1. Payload

- [x] 1.1 Add `meta` to the Insights payload beside `FACETS` (`METAS`, `session_figures`, `language_tally` in `insights.py`), and each listed session's `meta`. Tests in `tests/test_insights.py`.
- [x] 1.2 Regenerate the page fixtures (`tests.test_web_fixtures`); check `tools/demo/seed.py` still gives the page what it needs.

## 2. Page

- [x] 2.1 Update the types in `web/src/api.ts`.
- [x] 2.2 Add the "Session figures" drawer, its section index entry and its styles. Tests in `InsightsPage.test.tsx`.
- [x] 2.3 Add the measured line to each session card. Tests in `InsightsPage.test.tsx`.

## 3. Docs and verify

- [x] 3.1 Add the line to `CHANGELOG.md` under `[Unreleased]`; extend the Insights bullet in `README.md`.
- [x] 3.2 Run `openspec validate insights-session-meta --strict`, then archive.
- [ ] 3.3 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build.
