# Tasks

## 1. Tests

- [x] 1.1 `LimitsPage.test.tsx`: the strip renders one chip per open window with its percent and "resets in"; an at-limit window's chip says "at limit"; a window with a forecast hit says "runs out"; no strip with no windows.

## 2. Page

- [x] 2.1 `LimitsPage.tsx`: `StatusStrip` under the lede, before the suggestion; warning tone and text markers; estimated marker; renders nothing with no windows.
- [x] 2.2 `limits.css`: strip layout, warning tone with the existing warning variables, wrapping on narrow screens.

## 3. Docs and verify

- [x] 3.1 Update `README.md` and `CHANGELOG.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`; commit the build; archive the change.
