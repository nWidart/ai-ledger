# Proposal

## Why

Session links on Errors, Insights and Live leave the page for Activity to show the session sheet. The user loses what they were looking at: the open error type and its examples, the Insights filters, and on Live the stream and its live connection. Activity, Cost, Context and the Project page already open the sheet over the page.

## What Changes

- **Errors.** An example's session link opens the session sheet over Errors. Errors already hosts the sheet; only the link went to Activity.
- **Insights.** A session card's title opens the session sheet over Insights, with the page's filters kept.
- **Live.** The stream head's "Session sheet" link, the note on older events and the "no session is active" link open the session sheet over Live. The stream and its live connection stay open. Live already uses `session` for the session the stream follows, so its sheet uses the `sheet` key: `/live?session=s1&sheet=s1`.
- **URL and history.** The URL names the open sheet, so a link opens it and Back closes it, as on Activity. Each link keeps a real href to the current page with the sheet open, so middle-click and open in a new tab work. Focus returns to the link when the sheet closes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: session links open the session sheet over the current page.
- `errors-dashboard`: an example's session link opens the sheet over Errors.
- `insights-dashboard`: "Link analysed sessions to their sheets" opens the sheet over Insights.
- `live-dashboard`: the "no session is active" link and "Link the stream to the session sheet" open the sheet over Live, under the `sheet` key.

## Impact

- `web/src/url.ts`: the `sheet` key, and `sheetKey(path)`, which names the session sheet's key on a page. On Live, `session` no longer counts as a sheet key, so closing a sheet goes back over the sheet alone.
- `web/src/components/sheets/session.ts` and `UsageSheets.tsx`: the open functions and the sheets read the key of the current page; `sessionSheetHref` and `sessionLink` build and handle the links.
- `web/src/pages/errors`, `insights` and `live`: the session links, and `UsageSheets` mounted on Insights and Live.
- Tests: web tests for the three pages and `url.test.ts`. `src/ai_ledger/web/` is rebuilt.
- Docs: `README.md`, the docs site, and `CHANGELOG.md` `[Unreleased]`.
