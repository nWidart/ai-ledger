# Tasks

Model per task in brackets. The lead integrates, reviews each diff and runs the final checks. Group 1 and group 2 can run in parallel. Group 3 needs 1.1, 1.3 and group 2. Group 4 needs 1.2.

## 1. Foundation

- [x] 1.1 [Opus] Spike the Base UI `ContextMenu` approach from design.md decision 2. Check four things in a throwaway test or story: a controlled root, the positioner `anchor` override for keyboard opening, `event.preventBaseUIHandler()` leaving `defaultPrevented` false outside subjects, and the popup showing above an open `<dialog>` sheet, where Escape closes only the menu. Verify: write the findings in a short note on this task. If any check fails, switch the design to the `Menu` fallback before 3.1 starts.
  - Findings: `ContextMenu` fits; no fallback. The bail-out needs `stopPropagation()` as well as `preventBaseUIHandler()`, because the trigger's `document` listener calls `preventDefault`. A passed `anchor` wins over the pointer. The popup portals into the open `<dialog>`. Base UI's Escape stops propagation. Long-press needs our own click guard. `aria-label` on `Popup` names the menu. design.md decision 2 records these. Still to check in a browser (6.1): top layer above a sheet, Escape not closing the sheet, and long-press on a device.
- [x] 1.2 [Lead] Add `resumeCommand({source, session_id, cwd})` per design.md decision 4. Verify: unit tests cover Claude Code, Codex, no `cwd`, a space in `cwd` and a `'` in `cwd` (`'\''`), and `cd 'x' && ` shows only when `cwd` is set.
- [x] 1.3 [Opus] Add `menuItems(subject, ctx)` in `web/src/components/menu/items.ts` per design.md decision 3. Build navigation hrefs through the palette's `resolve()`. Verify: unit tests cover each subject's items and order; that Open project page is absent on that project's page; the filter toggle label and patch; that the sheet item is absent where the page hosts none; that Open session on Live goes to Activity; that Copy working directory is absent without `cwd`; the "Loading…" and "Not available" reasons; and that mute is absent off Errors and for `infra` and `user_denied`.

## 2. Mark subjects

- [x] 2.1 [Sonnet] Give `pickRow` a subject-kind argument that sets `data-subject`, and pass the right kind at all 19 call sites. Leave the "Other" and long-tail rows unmarked. Verify: `npm run typecheck` passes, and a test renders one row of each kind and checks `data-subject` and `data-v`.
- [x] 2.2 [Sonnet] Mark the subjects outside `pickRow`: `ProjectName` (project), the Errors type rows (category), and the Live rail and wall buttons (session). Verify: tests on Errors and Live find `data-subject` on a type row and on a wall tile, and existing page tests still pass.

## 3. The menu

- [x] 3.1 [Opus] Build `<SubjectMenu>` per design.md decisions 1, 2 and 7, and mount it once in the app root. It covers delegation, the browser-menu passthrough (no subject, selected text, Shift), pointer and long-press opening, Shift+F10 and the ContextMenu key, the "<subject> actions" name, focus return, `go(href)` for navigation, and the polite copy status. Verify with tests for the context-menu spec scenarios:
  - right-click on a row opens the menu and not the sheet;
  - a nested session row wins over its project;
  - a heading, selected text and Shift leave `defaultPrevented` false;
  - long-press opens the menu without the sheet;
  - Shift+F10 then Escape returns focus and keeps the sheet open;
  - an item adds one history entry and Back restores the view;
  - a refused clipboard announces the failure.
- [x] 3.2 [Opus] Load session details when a session menu opens, per design.md decision 5. Verify: tests show "Loading…" first, then the item becoming available with the menu still open, and "Not available" on a failed `/api/session`, with Copy session ID still working.
- [x] 3.3 [Opus] Expose the Errors mute toggle to the menu through a context that only the Errors page provides, per design.md decision 6. Verify: an Errors test mutes a type from the menu and sees the same "Saving…" feedback and request as the detail button. A test on another page sees no mute item.

## 4. Session sheet

- [x] 4.1 [Sonnet] Show the working directory, when known, and `resumeCommand(...)` at the session sheet's foot next to the id, each with a Copy button and a polite status, per the usage-dashboard delta. Verify: sheet tests cover a Claude Code session with `cwd` and a Codex session without one.

## 5. Docs and build

- [x] 5.1 [Lead] Describe the right-click menu in `README.md` and `docs/guide.md` and add it to `[Unreleased]` in `CHANGELOG.md`. Verify: both files mention the four subjects and the Shift+right-click escape.
- [x] 5.2 [Lead] Rebuild and check:
  - run `cd web && npm run check`;
  - commit the rebuilt `src/ai_ledger/web/`;
  - run `uv run python -m unittest discover -s tests`, `uv run ruff check` and `openspec validate --strict`.
  - Verify: everything passes, including `tests/test_web_build.py`.

## 6. Integration

- [x] 6.1 [Lead] Run the app against a copy of the store on a free port, with `uv run ai-ledger --db <copy> --port <port>`. In a browser, check the menu on each covered place: Activity, Cost and Context tables, the Errors type rows, the Live rail and wall, the three sheets, and the Project page. Check keyboard opening and that the browser's menu still shows outside subjects. Verify: each spec scenario behaves as written. The live store stays untouched.
  - Result (Chrome): menus open on Activity, Errors, sheets and the Project page. Show on Errors carries the filters with one history entry. The menu renders inside the open sheet and is the top hit. Escape closes only the menu. Shift+F10 opens it anchored under the row, with focus on the first item, and focus returns to the row. Headings and Shift+right-click keep the browser's menu. The Live wall had no sessions in the copy, so unit tests cover it. Long-press still needs a check on a touch device. Fix: a session's menu no longer offers Open project page on that project's page.

## Workflow follow-up

- Archive the change in its worktree after review, then remove the worktree.
