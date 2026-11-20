# Tasks

## 1. URL and sheets

- [x] 1.1 Add the `sheet` key and `sheetKey(path)` to `web/src/url.ts`, and count only the page's sheet keys as sheet entries. Verify with a `url.test.ts` test: on Live, opening a session sheet writes `sheet`, a rail pick counts as no sheet entry, and `sessionSheetHref` builds the link.
- [x] 1.2 Make `openSessionSheet`, `openProjectSheet`, `openToolSheet` and `UsageSheets` read the current page's key. Add `sessionSheetHref` and `sessionLink` to `session.ts`.

## 2. Pages

- [x] 2.1 Errors: the example's session link points at Errors with the sheet open and opens it in place. Verify with an `ErrorsPage.test.tsx` test: the URL stays on `/errors`, Close restores it, the page stays mounted and focus returns to the link.
- [x] 2.2 Insights: mount `UsageSheets`; the session card's link opens the sheet in place with the filters kept. Verify with an `InsightsPage.test.tsx` test inside the app: the path and title stay on Insights, the page stays mounted, and Close restores the URL and focus.
- [x] 2.3 Live: mount `UsageSheets`; the stream head, the older-events note and the "no session is active" link open the sheet under `sheet`. Verify with `LivePage.test.tsx` tests: the notice source stays the same and open, the stream stays mounted, and closing after rail picks keeps the followed session.

## 3. Docs and build

- [x] 3.1 Update `README.md`, the docs site and `CHANGELOG.md` `[Unreleased]`.
- [x] 3.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`, and `openspec validate --specs --strict`. Commit the rebuilt `src/ai_ledger/web/`.
