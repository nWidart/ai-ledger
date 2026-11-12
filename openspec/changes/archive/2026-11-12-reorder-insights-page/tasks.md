# Tasks

## 1. Page

- [x] 1.1 Tests in `InsightsPage.test.tsx`: section order, drawers closed by default, section index with figures and without, jump opens a drawer.
- [x] 1.2 `InsightsPage.tsx`: reorder, `Goals` and `SessionTypes` in `Drawer`, `SectionIndex`; `useLanding` selector matches the new blocks. `insights.css` and `SectionIndex.css`: layout.

## 2. Docs and verify

- [x] 2.1 `CHANGELOG.md`.
- [x] 2.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
