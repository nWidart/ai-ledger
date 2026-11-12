# Tasks

## 1. Picker

- [x] 1.1 Add `@base-ui/react` to `web/package.json` at an exact version.
- [x] 1.2 Replace the select and the search box in `Filters.tsx` with one Combobox field; keep `#fProject` on the field, the color dot, the hash's project when the list leaves it out, and the hash writes.
- [x] 1.3 Style the field and popup in `theme.css` with the app's tokens, in both themes and at 520px; drop `.pick-search`.
- [x] 1.4 Rewrite the picker tests in `Filters.test.tsx` and fix the project selection in `ActivityPage.test.tsx`.

## 2. Docs and verify

- [x] 2.1 Update `README.md` and `CHANGELOG.md`.
- [x] 2.2 Run `cd web && npm run check`, `uv run python -m unittest discover -s tests`, `openspec validate --all --strict`; commit the build.
