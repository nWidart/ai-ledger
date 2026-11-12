# Tasks

## 1. Store and API

- [x] 1.1 Add `muted BOOLEAN DEFAULT false` to `error_marks`, with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` when a store opens, and `set_error_muted` in `store.py`. Test: a store without the column gains it, the two upserts touch only their own column, `rebuild` and reopening keep it.
- [x] 1.2 Add `error_muted`, `error_marks` and `muted` in the payload to `metrics.py`.
- [x] 1.3 Add `POST /api/errors/mute` and `GET /api/errors/marks`, drop `GET /api/errors/fixes`, answer the fix and import writes with the whole marks object. Test: every answer, every refusal, the host check, a mute that waits for a running ingest.

## 2. Page

- [x] 2.1 Generalize the hook to marks (`marks.ts`, `useMarks`): one queue, a mute as an optimistic write, `GET /api/errors/marks` as the resync. Test: mute and unmute post and show at once, a failed write restores from the store and reports, a mute and a fix queue in order.
- [x] 2.2 Effective noise in `model.ts` (`Model.muted`, `withMuted`, `isNoise`) for `filtered` and `errorDays`; Where to start leaves muted types out. Test in `model.test.ts`.
- [x] 2.3 Rename the toggle, add the "Muted" chip and dimmed row, the mute button and its sentence, the note for fixed noise types. Test: the chip, the toggle hiding a muted type and the rate changing, the open type closing with focus in the table, no button for fixed noise, a linked example of a muted type.

## 3. Docs and verify

- [x] 3.1 Update `README.md`, `CHANGELOG.md`, `PARITY.md`; regenerate the page-test fixtures.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
