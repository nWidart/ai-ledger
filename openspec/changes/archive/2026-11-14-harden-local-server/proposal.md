# Proposal

## Why

The app binds to `127.0.0.1` and checks the Host header, but a page on another site can still send requests to it from the user's browser: `POST /api/refresh` needs no body, so a cross-site form or no-cors `fetch` can start ingests as often as it likes. The server also sends no security headers, so the page can be framed, its responses sniffed, and any injected script would run unchecked. The page itself is cached without a validator, so every visit downloads it again.

## What Changes

- **Cross-site requests to `/api` are refused with 403**: GET, POST and the Live event stream. The server reads `Sec-Fetch-Site` (`cross-site` and `same-site` are refused); when a browser sends no such header it falls back to `Origin`, and accepts only the app's own origin. Requests with neither header (curl, the command line) and page navigations pass.
- **Every response carries security headers**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off the device features the app does not use.
- **The page carries a Content Security Policy**: scripts from the app's own origin plus the one inline theme script, named by a hash the server works out from the `index.html` it serves, so a rebuild cannot leave it behind. Inline styles stay allowed (React sets style attributes), Google Fonts stays the one outside origin, framing and `<base>` are off. `require-trusted-types-for` is left out: the React DOM bundle assigns strings to `innerHTML`.
- **The page is served with `Cache-Control: no-cache` and an ETag**, and answers `If-None-Match` with 304. `/api` and the event stream stay `no-store`; hashed assets stay immutable.
- **Table export guards a cell that starts with a tab or carriage return**, as it guards `=`, `+`, `-` and `@`, so a spreadsheet does not read it as a formula.

Out of scope: self-hosting the font, a token for the API, masking secrets in transcript text.

## Impact

- `src/ai_ledger/app.py`, `tests/test_app.py`, `web/src/components/export.ts` and its test, and the build in `src/ai_ledger/web/`.
- The Vite dev server (port 5173) serves its own page without this policy; its `/api` proxy still works, because a browser marks those requests same-origin.

## Capabilities

### Modified Capabilities
- `dashboard-app`: the app refuses cross-site requests, sends security headers and a content policy, and lets the browser revalidate the page.
- `cost-dashboard`: an exported cell that starts with a tab or carriage return is guarded too.
