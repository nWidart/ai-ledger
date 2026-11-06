# Tasks

## 1. Sources in the store

- [x] 1.1 Raise `requires-python` to `>=3.14` in `pyproject.toml`, run `uv sync`, and note the version in the README setup. Verify that `uv run python -c "import compression.zstd"` succeeds.
- [x] 1.2 Add `source` (default `claude`) to `files` and `sessions` on open. Use `ALTER ... ADD COLUMN IF NOT EXISTS`, with copy-and-swap in one transaction as a fallback. Add a test that opens a store created by the current schema and finds every file and session marked `claude` with unchanged counts. Run the migration on an instant copy of the real store in the scratchpad, and check that line and session counts match.
- [x] 1.3 Add the source registry (files, line key, deriver per source). Change `ingest(con, roots)` to take `{source: dir}`, write `files.source` and `sessions.source`, and skip a source whose root is missing. Update `app.py` (`--codex`, default `~/.codex`) and existing callers and tests. Verify that the Claude test suite passes unchanged, and that a test with a missing Codex root ingests the Claude files.
- [x] 1.4 Make `rebuild` replay each file with its source's deriver. Verify with a test that ingest-then-rebuild produces identical derived rows for a store holding both sources.

## 2. Codex parser

- [ ] 2.1 Build Codex test fixtures in `tests/` from trimmed real lines of CLI 0.139, 0.153 and 0.166. They cover `session_meta`, `turn_context`, `token_usage_record`, `token_count`, `item_completed` (MCP ok and failed, command ok and failed with exit code 1, `git commit`, file change, web search, user message, injected `<environment_context>` and `<heartbeat>`, agent message), `turn_aborted` and `compacted`. Remove any personal data. Verify that the fixtures parse as JSONL and contain no paths under the real home.
- [ ] 2.2 Add Codex file discovery and keys: `sessions/**/rollout-*.jsonl` read incrementally, `archived_sessions/*.jsonl.zst` read whole, and key `codex:<thread>:<ordinal>`. Verify with tests that a live file, then its `.zst` copy, store each line once, and that a `<session>_<thread>` file keeps its overlapping ordinals and maps to the parent session.
- [ ] 2.3 Implement `CodexDeriver(Deriver)` for sessions (cwd, branch, entrypoint, version, compactions) and requests (`response_id`, token normalization, model and effort per turn, peak context). Reload the turn context for incremental chunks. Verify the spec scenarios with tests: 25,707 / 13,440 / 182 gives input 12,267 and total 25,889; `token_count` is not counted; a model change between turns; no effort shows `(none)`; a chunk that starts mid-turn keeps its model.
- [ ] 2.4 Implement Codex tool calls and errors from `item_completed`: MCP, `exec_command`, `apply_patch` and `web_search`, with `start_ts` from duration. Shell errors get the text `Exit code N` plus the output, `is_commit` and `is_test` come from `SHELL_TOOLS`, and agent messages are follow-ups. Verify with tests that a failed command gets a category from the existing rules, a `git commit` counts as a commit, and `exec` script calls create no tool rows.
- [ ] 2.5 Implement Codex prompts: typed user messages only, keyed by turn, with `turn_aborted` / `interrupted` marking the prompt. Verify with tests for injected context, heartbeat and the interrupted-turn scenarios.
- [ ] 2.6 Add the OpenAI models seen locally (`gpt-6-astra`, `gpt-6.1-sol`) to `prices.json` from OpenAI's pricing page. Record the URL and read date in `source`, map the cache-write rate to `cache_5m`, and set `cache_1h` to 0. Leave a model out if the page does not list it. Verify with a `test_metrics` case that prices a Codex request and leaves an unlisted model unpriced.

## 3. Source filter in metrics and API

- [ ] 3.1 Add `source` to `scope()` and thread it through `usage`, `session_list` and `session`. Add `src` to the errors payload and to its `calls` rows. Make `app.py` accept `source` on the APIs and reject unknown values with 400. Verify with `test_metrics` and `test_app` cases: the Claude-plus-Codex day total, the per-source totals, and a 400 for `source=grok`.
- [ ] 3.2 Extend the `test_metrics` fixture with a Codex session, and regenerate `web/src/__fixtures__/`. Verify that `tests/test_web_fixtures.py` passes and that a second run leaves the fixtures unchanged.

## 4. Dashboards

- [ ] 4.1 Add `source` to `SHARED_KEYS` and the hash parser, falling back to All on unknown values. Pass it in every API call (`useApi`), and filter the Errors page model by `src` in the browser. Verify with `hash.test.ts` (`source=grok` falls back) and `Nav.test.tsx` (the source travels between pages).
- [ ] 4.2 Add the All / Claude Code / Codex control to `Filters` on Activity, Cost and Errors. Verify with page tests that picking Codex narrows the figures and writes `source=codex`.
- [ ] 4.3 Make the empty-state headings and the Errors kicker source-neutral ("No agent activity", "Agent tool errors"), and update the page doc comments. Verify with page tests that the wording contains no "Claude" when the source is All.
- [ ] 4.4 Run `npm run check` in `web/`, commit the rebuilt `web/dist/`, and verify that `tests/test_web_build.py` passes.

## 5. Integration

- [ ] 5.1 Against an instant copy of the real store, run ingest with the real `~/.codex`. Verify that Codex lines and sessions appear (20 files), Claude totals are unchanged, and archived copies of live sessions add no duplicate requests. Then run `rebuild` and check that totals match.
- [ ] 5.2 Start the app with `--db` set to the copy. Port 8765 is fixed, so first ask before stopping the user's running app. Check in the browser: switch the source on all three pages, confirm the URL carries it across the nav, and confirm Codex errors appear on Errors. Update the README sections on what is ingested and on the `--codex` option.

## Workflow follow-up

- On archive, update the `transcript-store` Purpose: it says "today Claude Code's" and should name Claude Code and Codex.
- Stage 3 (Grok) is deferred. It needs a real Grok session with a few turns first.
