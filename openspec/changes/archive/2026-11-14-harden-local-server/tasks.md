# Tasks

## 1. Server

- [x] 1.1 Send the security headers on every response and on the event stream.
- [x] 1.2 Send a Content Security Policy with the page, with the inline script's hash worked out from the served `index.html`.
- [x] 1.3 Refuse cross-site `/api` requests and cross-site POSTs with 403, by `Sec-Fetch-Site`, then `Origin`.
- [x] 1.4 Serve the page with `no-cache` and an ETag; answer `If-None-Match` with 304.

## 2. Export

- [x] 2.1 Guard a leading tab or carriage return in `export.ts`, with test cases.

## 3. Docs and verify

- [x] 3.1 Add tests in `tests/test_app.py`: headers, the hash, 403 and pass cases, ETag and 304.
- [x] 3.2 Update `CHANGELOG.md` and `README.md`.
- [x] 3.3 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
