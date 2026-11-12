# Tasks

## 1. Payload

- [x] 1.1 Tests in `tests/test_insights.py` for `coverage.by_project` and `coverage.runs`: gap rule, view filter, automated and Codex, cap.
- [x] 1.2 Add `by_project` and `runs` to `payload()` in `insights.py` (`RUN_GAP`, `RUNS`); update `InsightsPayload` in `web/src/api.ts`.

## 2. Page

- [x] 2.1 Page tests for the drawer, the index entry and the link in the coverage sentence.
- [x] 2.2 Add the Coverage drawer (`InsightsPage.tsx`), the index entry and the "by project and run" link.
- [x] 2.3 Regenerate the fixtures (`uv run python -m unittest tests.test_web_fixtures`).

## 3. Docs and verify

- [x] 3.1 Add the line to `CHANGELOG.md` under `[Unreleased]`, extend the Insights bullet in `README.md`.
- [x] 3.2 Run `openspec validate insights-coverage-breakdown --strict`, then archive.
- [x] 3.3 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build.
