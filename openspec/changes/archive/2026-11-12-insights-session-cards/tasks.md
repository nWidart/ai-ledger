# Tasks

## 1. Page

- [x] 1.1 Write the tests first: card content, expander closed by default and absent without detail, each sort order, outcome filter from and to the URL, combined with the friction checkbox, unknown outcome in the URL.
- [x] 1.2 Replace the table in `Sessions` with a list of cards (`SessionCard`); add the sort and outcome selects; keep the filter state read from the hash in one place.
- [x] 1.3 Restyle in `insights.css`: card layout, one rule set for phone and desktop.

## 2. Docs and verify

- [x] 2.1 Update `README.md` and `CHANGELOG.md`.
- [x] 2.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build.
- [x] 2.3 Validate with `openspec validate insights-session-cards --strict`, archive, then `openspec validate --specs --strict`.
