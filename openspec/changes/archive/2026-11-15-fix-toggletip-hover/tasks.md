# Tasks

## 1. Toggletip

- [x] 1.1 Add failing tests: the popup text renders when the toggletip opens, hover opens it, leaving closes it, and a click pins it.
- [x] 1.2 Portal the popup to the body outside a dialog (`container={host ?? undefined}`) and open on hover (`openOnHover`, 150 ms delay).

## 2. Release notes and checks

- [x] 2.1 Add a Fixed entry to `[Unreleased]` in `CHANGELOG.md`.
- [x] 2.2 Run `cd web && npm run check` and `openspec validate` for the specs and the change; check hover in a browser on a page and in a sheet.
