# Tasks

## 1. Model

- [x] 1.1 `change` returns the percent it shows (`Delta.pct`, null for counts and "–"); `typeRows` adds `rate`, `inc`, `bad` and `unrec` per type, under the selected bucket. Test in `model.test.ts`, with and without a bucket.

## 2. Page

- [x] 2.1 Sort and filter state in `ErrorsPage` and the context; `TypeTable` with `SortTh` headers, the two columns, the filter, its count, its empty row; `tableFocus` finds type buttons only. Test in `ErrorsPage.test.tsx`: each key, direction flip and `aria-sort`, null last for Change, the filter, state across a view change, focus after a sort.
- [x] 2.2 `errors.css`: the new columns on narrow screens.

## 3. Docs and verify

- [x] 3.1 Update `README.md`, `CHANGELOG.md`, `PARITY.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
