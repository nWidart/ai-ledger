# Design

## Where the sheets are mounted

`UsageSheets` stays mounted by each page, and Insights and Live mount it too. Mounting it once in the app shell (`App.tsx`) was the other choice. It was not taken, for three reasons:

- Activity, Cost and the Project page pass their payload, so a sheet can name a session and know the page's project before its own data arrives. Errors passes `automated`, because it always shows automated sessions. A shell mount would need a context or a registry to get these from the page, which is more code than the one line each page has today.
- Page tests render a page alone, not the whole app. Tests that open a sheet would then need the shell.
- Live needs a different URL key for the sheet (below). A page-level mount keeps that rule next to the page that needs it.

## The sheet key on Live

Live uses `session` for the session the stream follows, and a rail pick writes it. If the sheet also used `session`, opening any session's sheet would change the stream, and picking a session in the rail would open a sheet. On Live the session sheet uses `sheet` instead. `sheetKey(path)` in `url.ts` names the key for a page, and every writer of the session sheet's key reads it: the open functions in `session.ts`, the sheets' Close and ← Back, and the history count of sheet entries.

The history count of sheet entries uses the same keys. On Live, `session` is not a sheet key, so a rail pick does not count as a sheet entry, and closing a sheet goes back over the sheet alone, not over earlier rail picks.

## Links

Each session link has a real href: the current page in its view, with the sheet's key added. A plain click opens the sheet with `setSearch`, as Activity's session buttons do, so the push is counted and Close goes back. A modified click (middle-click, Cmd or Ctrl) is left to the browser.

## Not changed

- The command palette and the context menu still send a session from Insights or Live to Activity. They follow the palette's list of pages that host sheets. Adding Insights and Live to that list is a separate change.
