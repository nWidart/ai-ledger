# Tasks

## 1. Tests

- [x] 1.1 `tests/test_limits.py`: `alert_of` for each kind and their precedence, the choice among windows of a kind (shared with `binding_of`), `count`, `None` when nothing is in alert and for a window with no reading.
- [x] 1.2 `tests/test_app.py`: `limits_alert` is `None` before a cycle and kept after one, cleared when no window is in alert, `None` when the payload raises (type-only log, the loop goes on), computed once per full cycle and not per fast pass, and returned by `/api/status`.
- [x] 1.3 Web: `alertText` for each kind and the "and N more" suffix; the nav's badge tone and accessible name per kind, none for null or a missing field, following later polls, kept when the app does not answer, and on the Limits page.

## 2. Backend

- [x] 2.1 `limits.py`: `last_to_reset` and `soonest_run_out` (taken out of `binding_of`), `ALERT_PERCENT`, `alert_of`.
- [x] 2.2 `app.py`: `App.limits_alert`, `App.refresh_alert`, called after each full cycle; `status()` returns `limits_alert`.

## 3. Nav

- [x] 3.1 `api.ts` (`LimitsAlert`, `Status.limits_alert`), `refresh.ts` (the alert in the shared state), `limits.ts` (`alertText`), `Nav.tsx`, `Nav.css`.

## 4. Docs and verify

- [x] 4.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`; commit the build; archive the change.
