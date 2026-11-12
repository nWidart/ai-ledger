# Tasks

## 1. Tests

- [x] 1.1 `tests/test_limits.py`: the parser on a full response and on responses without the keys, with nulls, with a bad `limit_index`, with percents out of range or not numbers and with rows that are not a list (none raise); `payload()` gives a scoped window its share and the unscoped weekly window its surfaces, none to Codex, none for a poll of another window, an estimated window, an older poll or no poll.
- [x] 1.2 `limits.test.ts`: `shareText` and `surfacesText` (one surface at 100, a mix, all 0, none). `LimitsPage.test.tsx`: each line only on a card with its field.

## 2. Backend

- [x] 2.1 `limits.py`: `claude_limit` (one limit item, shared with `claude_rows`), `claude_extras`, `POLL_EXTRAS`; `payload()` reads the provider's newest poll and attaches `weekly_share` and `surfaces` to the open windows it describes. Add a Claude poll with both to the page-test fixture store and regenerate the fixtures.

## 3. Page

- [x] 3.1 `api.ts`, `limits.ts` (`shareText`, `surfacesText`), `LimitsPage.tsx` (the two lines under the forecast lines), `limits.css`.

## 4. Docs and verify

- [x] 4.1 Update `CHANGELOG.md` under `[Unreleased]` and the Limits bullet of `README.md`.
- [x] 4.2 Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests`; commit the build; archive the change.
