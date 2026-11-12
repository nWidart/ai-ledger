# Proposal

## Why

GitHub issue #4 (Errors page UX review, item "keep fix markers in the store"): a user marks an error type "fix applied" on a day, and the marker lives in the browser's localStorage. localStorage is per origin, so the marker vanishes on another port (`--port`), another browser or another profile. The fix is a fact about the user's setup, not about one browser tab.

## What Changes

- **A store table** `error_marks(category PRIMARY KEY, fixed_on DATE)` in the store's base schema, beside `files` and `raw_lines`. It is not derived from transcripts, so `ai-ledger rebuild` keeps it. Marks, not only fixes, because a later change adds a muted state to the same row.
- **The Errors payload carries `fixes`**: `{type: "YYYY-MM-DD"}`. The page reads its markers from it.
- **Two write endpoints**: `POST /api/errors/fix` with `{"category": string, "day": "YYYY-MM-DD" | null}`; null removes the marker. It answers with the full `fixes` map. The body is validated at this boundary: host check, `application/json` only, at most 4096 bytes, a JSON object, a category of 1 to 100 characters, a real ISO date not after the server's today. Anything else is a 400 with `{"error": ...}`. The write takes the app's ingest lock, as the limit pollers do, so it never lands inside an ingest's work.
- **One import endpoint**, `POST /api/errors/fixes/import` with `{"fixes": {category: "YYYY-MM-DD"}}`: in one transaction it stores a marker only for a type that has no fix day at that moment, so the store wins at write time. An invalid entry is skipped, not an error; a body that is not an object of fixes, over 64 KiB or over 500 markers is a 400. It shares the single write's validation and answers with the full `fixes` map.
- **The page** shows what the store last answered with the writes still on their way applied in order, so marking and undoing show at once. A write that succeeds replaces the store's answer; one that fails just leaves the list, with a visible message and a status announcement. Writes go out one after another, and a payload that arrives while a write is pending is dropped, because the refetch after that write brings a newer one.
- **One-time migration**: markers an older page left in localStorage (`claude-errors-fixes`) go to the store in one import, the first entry of the write queue, so a later undo runs after it. The key and the browser's copy go only after the import succeeded; a failed import leaves both, shows those markers meanwhile and retries on the next load. A mark or undo that succeeds also drops its type from the key, so an undone marker cannot come back from it after a failed import.
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
