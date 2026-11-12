# Proposal

## Why

GitHub issue #4 (Errors page UX review, item "keep fix markers in the store"): a user marks an error type "fix applied" on a day, and the marker lives in the browser's localStorage. localStorage is per origin, so the marker vanishes on another port (`--port`), another browser or another profile. The fix is a fact about the user's setup, not about one browser tab.

## What Changes

- **A store table** `error_marks(category PRIMARY KEY, fixed_on DATE)` in the store's base schema, beside `files` and `raw_lines`. It is not derived from transcripts, so `ai-ledger rebuild` keeps it. Marks, not only fixes, because a later change adds a muted state to the same row.
- **The Errors payload carries `fixes`**: `{type: "YYYY-MM-DD"}`. The page reads its markers from it.
- **One write endpoint**, `POST /api/errors/fix` with `{"category": string, "day": "YYYY-MM-DD" | null}`; null removes the marker. It answers with the full `fixes` map. The body is validated at this boundary: host check, `application/json` only, at most 4096 bytes, a JSON object, a category of 1 to 100 characters, a real ISO date not after the server's today. Anything else is a 400 with `{"error": ...}`. The write takes the app's ingest lock, as the limit pollers do, so it never lands inside an ingest's work.
- **The page** shows a marker at once when marked or undone, posts it, and puts the type back with a visible message and a status announcement when the write fails. Writes go out one after another, so a quick Mark then Undo reach the store in that order.
- **One-time migration**: markers an older page left in localStorage (`claude-errors-fixes`) are sent for each type the store lacks (the store wins on a type both have). The key is removed only after every write succeeded. A failed move leaves the key, shows those markers meanwhile and retries on the next load.
- "Applies to all projects" stays true: a marker has no project.

Out of scope: a muted state, the other issue items, how a fix compares error rates before and after.

## Impact

- `src/ai_ledger/store.py` (table, `set_error_fix`), `metrics.py` (`error_fixes`, payload), `app.py` (endpoint).
- `web/src/pages/errors/` (`fixes.ts` new, `ErrorsPage.tsx`, `Detail.tsx`, `context.ts`, `view.ts`), `web/src/api.ts`; the build in `src/ai_ledger/web/` and the page-test fixtures are regenerated.
- A store from before this change gains the empty table when it is opened. No rebuild needed.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: fix markers live in the store and follow the user across ports and browsers.
- `transcript-store`: the store holds the Errors page's marks, and a rebuild keeps them.
