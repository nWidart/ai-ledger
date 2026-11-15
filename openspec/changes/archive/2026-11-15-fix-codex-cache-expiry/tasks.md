# Tasks

## 1. Rule

- [x] 1.1 Add a failing test: a Codex break after 10 minutes is `other`, after 40 minutes `expired`; a Claude Code break after 10 minutes is `expired`.
- [x] 1.2 Add `CACHE_TTL_CODEX_S = 1800` beside `CACHE_TTL_S` in `context.py` and use it for Codex sessions in `session_breaks`, keeping the 1-hour rule first.

## 2. Text

- [x] 2.1 Name the lifetime in the cache-breaks tip's advice (per agent) and in the breaks drawer's hint (agent-neutral) (`web/src/pages/context/drawers.tsx`).
- [x] 2.2 Rebuild `src/ai_ledger/web/` and regenerate the page-test fixtures.

## 3. Release notes and checks

- [x] 3.1 Add a Fixed entry to `[Unreleased]` in `CHANGELOG.md`.
- [x] 3.2 Run `uv run ruff check`, the Python tests, `cd web && npm run check`, and `openspec validate` for the specs and the change.
