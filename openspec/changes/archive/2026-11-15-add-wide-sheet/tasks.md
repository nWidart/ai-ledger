# Tasks

Group 1 has no dependency. 2 needs 1. 3 needs nothing from 1 or 2 (its files are separate). 4 needs 1 to 3. 5 needs all.

## 1. Saved choice

- [x] 1.1 `web/src/sheetWide.ts`: `SHEET_WIDE_KEY = "ai-ledger-sheet-wide"`, `getSheetWide`, `setSheetWide`, `useSheetWide`, after `theme.ts` (in-memory value read from storage once, `storage` event, storage errors swallowed).
- [x] 1.2 `web/src/sheetWide.test.ts`: default narrow, set and read, the stored value, unknown value reads narrow, blocked storage still toggles, a `storage` event from another tab applies.

## 2. Toggle and width

- [x] 2.1 `Sheet.tsx`: prop `widen`; the Wide button (`sheet-wide`, `aria-pressed`, name "Wide") before Close; class `wide` on the dialog when `widen` and the choice is on.
- [x] 2.2 `theme.css`: `dialog.sheet.wide { width: min(1100px, 100%) }`. `Sheet.css`: the toggle's look, pressed look and focus ring; hidden at `max-width: 640px`. `theme.css` forced colors: the pressed toggle in the outlined list.
- [x] 2.3 `UsageSheets.tsx`: `widen` for a session and for a tool, MCP server or skill; not for a project.
- [x] 2.4 `Sheet.test.tsx`: no toggle without `widen`; toggle sets the class, the pressed state and the stored value and keeps focus; Escape, Close and the backdrop close a wide sheet and return focus.
- [x] 2.5 `sheets/wide.test.tsx` (through `UsageSheets`): session and tool sheets show the toggle, the project sheet does not and stays narrow with the choice on; the URL and history length do not change on toggle; a saved choice opens the sheet wide; ← Back from a session to a wide tool sheet restores the scroll position and the row focus (`useBackTo`); a session from a project sheet is wide and Back to the project is narrow.

## 3. Wide layout

- [x] 3.1 `session.ts` `timelineModel`: plot height 180 when the width is 900 or more, else 130. Test both.
- [x] 3.2 `ToolSheet.tsx`: `.pair` around Calls per day and Where, and around Failures by type and After a failure with Error loops (rendered only when one of them is). Same sections, order and figures.
- [x] 3.3 `SessionSheet.tsx`: `.pair` around Models and Tools.
- [x] 3.4 `sheets.css`: `.pair` grid (`repeat(auto-fit, minmax(380px, 1fr))`); `dialog.sheet.wide table.recent` session column up to 340px.
- [x] 3.5 `sheets.test.tsx`: the pairs hold the right sections; a tool with failure types only has one section in its pair; existing tests pass unchanged.

## 4. Docs

- [x] 4.1 `docs/guide.md`: the Wide toggle, under Everywhere.
- [x] 4.2 `CHANGELOG.md`: `[Unreleased]`, Added.

## 5. Verify

- [x] 5.1 `cd web && npm run check`; commit the rebuilt `src/ai_ledger/web/`.
- [x] 5.2 `uv run ruff check`; `uv run python -m unittest discover -s tests`.
- [x] 5.3 `openspec validate add-wide-sheet --strict`.
