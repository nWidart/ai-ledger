# Tasks

## 1. Store

- [x] 1.1 `ALTER` and the backfill in one transaction; tests for the atomic path and the rule after opening.

## 2. Chart

- [x] 2.1 One `bare` condition for the render and the keys; one `idle` predicate for the band, the legend key, the reading and the tooltip. Tests in `ErrorsPage.test.tsx`.

## 3. Docs and verify

- [x] 3.1 `PARITY.md`, the log comment, the specs.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
