# Tasks

## 1. Kept lines and the active list

- [x] 1.1 Add `live.Lines` (design D1, D5, D6): an `OrderedDict` keyed by `raw_lines.key` with entries of `items`, `ordinal` and named values; one lock, with the fetch done outside it; least-recently-used eviction at `KEPT_BYTES` and `KEPT_LINES`. Verify with a test in `tests/test_live.py` that patches the bounds low, then checks that a dropped line is fetched again and the answer is unchanged.
- [x] 1.2 Make `assemble` read items and ordinal through `Lines`, from rows that carry no JSON or JSON a caller already read (D1, D2). Verify that the existing Live tests in `tests/test_live.py`, `tests/test_grok_live.py` and the Codex Live cases pass unchanged, and that a second `assemble` over the same kept lines equals the first.
- [x] 1.3 Rewrite `recent` to rank lines without their JSON and to fill rows from `Lines` (D2). Add `lines=None` to `sessions`, `states` and `session`. Verify with the tests for the spec scenarios "Active list after new lines" (exactly the 3 new lines are parsed, counted by wrapping the `Lines` fetch; the answer equals a call with nothing kept), "Line stored late" and "Line moved to another session", each added to the test that already builds that fixture.

## 2. Turn marks and forked threads

- [x] 2.1 Rewrite `turn_mark_rows` to select candidates by column and to read Codex mark values through `Lines`, choosing the newest start and end per session and file in Python, `before` included (D3). Verify that the Codex and Grok turn-state tests pass unchanged, and that the Codex fixture's `turn_mark_rows` output with kept lines equals its output with nothing kept, for `starts=True` with a `before` cut too.
- [x] 2.2 Rewrite `forked` to select `session_meta` subagent candidates by column and to read `subagent_history_start_ordinal` through `Lines` (D3). Verify that the forked-history tests ("Skip a forked subagent's copied history") pass unchanged, with one assertion that a repeated call with kept lines fetches nothing.

## 3. App wiring

- [x] 3.1 Create one `live.Lines` in `App.__init__`, and pass it from `/api/live`, `/api/live/session`, `live_waiting` and the `/metrics` gauges (D4). Verify with one assertion in the existing `tests/test_app.py` route test that wraps `live.sessions`: two requests pass the same `Lines` object. Also verify the spec scenario "Session state after new lines" through `live.session` with kept lines.
- [x] 3.2 Add a line under `[Unreleased]` in `CHANGELOG.md`: the Live page no longer keeps the app busy while many sessions run. Verify by reading the section.

## 4. Integration checks

- [x] 4.1 Run `uv run ruff check`, `uv run pytest` and `openspec validate --specs --strict`. Verify that all pass.
- [x] 4.2 Time `/api/live` on a copy of the store with an app started by `uv run ai-ledger --db <copy> --port <free port>`, never on the live store. Measure the first request and later requests with active sessions, against `main` on the same copy. Verify that later requests stay under 100 ms. Record the numbers in the PR body.
- [x] 4.3 With a Live page open on that app while sessions run, check its CPU with `ps -o %cpu`. Verify that it stays well under one core, against several cores on `main`.

## Workflow follow-up

- Archive the change after review, in its worktree, then remove the worktree.
