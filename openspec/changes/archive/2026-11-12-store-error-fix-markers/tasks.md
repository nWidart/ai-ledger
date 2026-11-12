# Tasks

## 1. Store and payload

- [x] 1.1 Add `error_marks(category PRIMARY KEY, fixed_on DATE)` to the base schema, outside `DERIVED`, and `set_error_fix` (set, replace, remove) in `store.py`.
- [x] 1.2 Add `error_fixes` to `metrics.py` and `fixes` to `errors_payload`. Test: the table survives rebuild and reopening, the payload carries the fixes.

## 2. Endpoint

- [x] 2.1 Add `POST /api/errors/fix` in `app.py`: host check, `application/json` only, 4096-byte cap, validation, the write under `app.lock`, the full map as the answer.
- [x] 2.2 Add `POST /api/errors/fixes/import`: the same validation shared, invalid entries skipped, a marker only for a type with no fix day, in one statement under `app.lock`.
- [x] 2.3 Test set, replace, remove, every refusal, the host check and a write that waits for a running ingest.

## 3. Page

- [x] 3.1 Type `fixes` in `api.ts`; add `useFixes` in `fixes.ts` (payload markers, the store's last answer plus the writes on their way, one queue, the one-time import from localStorage) and use it in `ErrorsPage`, `Detail` and the context.
- [x] 3.2 Test: the page reads payload markers, marks and undoes by posting, a failed write leaves the page as the store has it and says so, the import (store wins at write time, an undo during it, key kept on failure, retried), a late payload never overrides the last answer.

## 4. Docs and verify

- [x] 4.1 Update `README.md`, `CHANGELOG.md`, `PARITY.md`; regenerate the page-test fixtures.
- [x] 4.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --all --strict`; commit the build.
