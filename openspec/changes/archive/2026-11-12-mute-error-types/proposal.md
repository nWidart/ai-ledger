# Proposal

## Why

GitHub issue #4 (Errors page UX review, one item): the Errors page has a fixed noise set (`infra`, `user_denied`) that "Hide noise" leaves out. Other types are expected for a given user, for example `search_empty` (a grep that exits 1). They inflate the headline error rate, and the user cannot say "I know, this one is expected".

## What Changes

- **A muted state per error type**, kept in the store beside the fix markers: `error_marks` gains `muted BOOLEAN DEFAULT false`. A store from before this change gains the column when it opens. `store.set_error_muted(cur, category, muted)` is an upsert that touches only `muted`; `set_error_fix` still touches only the fix day, so a mute keeps the fix day and a mark or undo keeps the mute. `rebuild` keeps the table, as today.
- **One shape for the marks.** `/api/errors` carries `fixes` (as today) and `muted` (a sorted list). Every marks endpoint answers with the whole object `{fixes: {type: day}, muted: [type]}`: `POST /api/errors/fix` and `POST /api/errors/fixes/import` change their answer to it, `POST /api/errors/mute` with `{"category": string, "muted": boolean}` is new (same lock, host check, content type, size cap and category validation as the fix endpoint; `muted` must be a JSON boolean), and `GET /api/errors/fixes` is replaced by `GET /api/errors/marks`. These endpoints are unreleased, so nothing keeps the old ones.
- **The page's marks hook** (`fixes.ts` becomes `marks.ts`, `useFixes` becomes `useMarks`) holds `{fixes, muted}` and keeps its one write queue and its rules: the payload seeds until the first queue step completes, then only queue answers and the resync (now `GET /api/errors/marks`) change the copy, "Saving…" shows while a write is pending, `say` announces. A mute is one more kind of queued write with an optimistic update.
- **Effective noise** is the fixed `NOISE` set plus the muted types (`Model.muted`, `isNoise`). `filtered` and `errorDays` use it, so with the toggle on the rate, chart, table, comparison and uncategorized share all leave muted types out. The toggle's text becomes "Hide noise and muted" (id `fNoise` and hash key `noise` stay) with an updated title.
- With the toggle off, a muted type still shows in the type table with a "Muted" chip and a dimmed row. Where to start never suggests a muted type, whatever the toggle says.
- **The type detail** has a button "Mute this type" / "Unmute" and a sentence saying what muting does. `infra` and `user_denied` show a note that they are always noise instead. Muting the open type while the toggle is on closes it (the existing `settle` rule), moves focus to the type table and announces it.
- Known and accepted: muting creates the type's row, so a later import of browser-kept fix markers skips that type. The import is the first write of a page load, so this needs a mute from another tab before this browser ever loaded the new page.

Out of scope: per-project muting, muting individual messages or tools, any change to the categorization rules, sorting the table, any other issue item.

## Impact

- `src/ai_ledger/store.py` (column, `set_error_muted`), `metrics.py` (`error_muted`, `error_marks`, payload), `app.py` (`/api/errors/mute`, `/api/errors/marks`, the answers).
- `web/src/pages/errors/` (`marks.ts`, `model.ts`, `ErrorsPage.tsx`, `Detail.tsx`, `TypeTable.tsx`, `context.ts`, `errors.css`), `web/src/api.ts`; the build in `src/ai_ledger/web/` and the page-test fixtures are regenerated.
- A store from before this change gains the column when opened. No rebuild needed.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: types can be muted; muted types are noise; the marks endpoints answer with the whole marks object.
- `transcript-store`: the store holds the muted flag in `error_marks`; a store without the column gains it.
