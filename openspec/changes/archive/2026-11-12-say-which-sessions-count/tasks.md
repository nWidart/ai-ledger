# Tasks

## 1. Page

- [x] 1.1 Append the start-time sentence to the Insights subtitle (`Sub`, `InsightsPage.tsx`). Test in `InsightsPage.test.tsx`.
- [x] 1.2 Add the request-in-range sentence as a `<p className="hint">` at the top of the Sessions drawer (`SessionsDrawer.tsx`). Test in `ActivityPage.test.tsx`.

## 2. Docs and verify

- [x] 2.1 Add the line to `CHANGELOG.md` under `[Unreleased]`.
- [ ] 2.2 Run `openspec validate say-which-sessions-count --strict`, then archive.
- [ ] 2.3 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build.
