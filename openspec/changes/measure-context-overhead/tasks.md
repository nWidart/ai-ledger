# Tasks

## 1. Store

- [x] 1.1 Add `context_snapshots` and `context_parts` to the derived schema and `DERIVED`.
- [x] 1.2 Derive them in the Claude deriver from `system` / `local_command` lines with `contextUsage`; skip lines without `categories`.
- [x] 1.3 Test with `tests/fixtures/claude/context-command.jsonl`: one snapshot, its parts, its project, no requests for the session, and the same rows after a rebuild.

## 2. Payload

- [x] 2.1 Add `overhead` to the Context payload when a project is set: the latest snapshot's time, model, version, window, categories with state, and the five largest MCP servers, memory files and skills; null otherwise.
- [x] 2.2 Test it and type it in `web/src/api.ts`.

## 3. Measure now

- [x] 3.1 Add `POST /api/context/measure`: validate the project, pick folder and model from the store, run `claude -p "/context"` with a timeout and one run at a time, then ingest.
- [x] 3.2 Test project validation, folder and model choice, 409, 503 and a successful run with a stub `claude` on `PATH`.

## 4. Grid

- [x] 4.1 Split the starting cells by the snapshot's overhead categories with largest-remainder rounding, plus "First prompt and other"; handle overhead larger than the median start.
- [x] 4.2 Show the snapshot's date, model and deferred total in the legend, and the largest MCP servers, memory files and skills in a disclosure.
- [x] 4.3 Add Measure now with its note, busy state and errors; refresh the block after a run.
- [x] 4.4 Test the split, the overflow case, no snapshot, and Measure now.

## 5. Wrap-up

- [x] 5.1 Regenerate the page-test fixtures and the web build.
- [x] 5.2 Update `README.md` (Measure now, `claude -p "/context"`, rebuild) and `CHANGELOG.md`.
