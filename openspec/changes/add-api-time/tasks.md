# Tasks

## 1. Store: derive session runs

- [x] 1.1 Add `session_runs(session_id, start_ms, api_ms, tool_ms, lines_added, lines_removed, PRIMARY KEY (session_id, start_ms))` to `DERIVED_SCHEMA` and `DERIVED` in `store.py`. Verify with a `test_store.py` test: opening a store that predates the table adds it empty and leaves the line, session, request and tool call counts unchanged.
- [x] 1.2 In `Deriver.add`, read `cost-state` lines from main files into a per-run dict, keeping the largest value of each figure. Skip a line whose `sessionId` or `startTime` is missing, or whose figures are not integers. In `Deriver.flush`, upsert the runs with `greatest()` on each figure. Add trimmed `cost-state` fixture lines and verify with `test_derive.py` tests for one run, two snapshots of one run (the larger wins), two runs (summed), a line read twice, a copy in another file, a malformed line, and a Codex session (no rows).
- [x] 1.3 Verify that rebuild fills the table: a `test_store.py` test ingests fixture lines, drops `session_runs`, runs `rebuild`, and gets the same rows back.

## 2. Metrics: payload figures

- [x] 2.1 In `metrics.sessions()`, LEFT JOIN a per-session sum of `session_runs` and the session's whole output tokens from `requests`, adding `model_ms`, `tool_ms` and `timed_output` (NULL when the session has no runs). Verify with a `test_metrics.py` test where a session is cut by the range: its output still counts in full.
- [x] 2.2 Add `model_ms`, `tool_ms`, `timed_sessions`, `timed_output` and `output_per_s` (None when there is no model time) to the usage totals and to `previous_period()`. Verify with `test_metrics.py` tests for the spec's "Model and tool time", "Output speed" and "Nothing recorded" scenarios.
- [x] 2.3 In `session_detail`, add the session's `model_ms`, `tool_ms`, `lines_added`, `lines_removed` and `output_per_s` to `info`, or None when it has no runs. Verify with a `test_metrics.py` test for a timed Claude session and a Codex session.
- [x] 2.4 Regenerate the page-test fixtures with `uv run python -m unittest tests.test_web_fixtures` and verify the new fields appear in `web/src/__fixtures__/usage*.ts` and `sessions.ts`.

## 3. Web: Activity and the session sheet

- [ ] 3.1 Add the new fields to the `UsagePayload` totals and previous types and to the session detail types in `web/src/api.ts`. Verify that `cd web && npm run check` typechecks.
- [ ] 3.2 In `ActivityPage.tsx` `Vitals`, add the model and tool time to the "Median session" note when `timed_sessions > 0`. Add an "Output speed" vital (`tok/s`, `worse: "down"`, compared with the previous period) whose note reads not available, with the reason, when no session is timed. Verify with `ActivityPage.test.tsx` cases for a timed view and an untimed (Codex) view.
- [ ] 3.3 In `SessionSheet.tsx`, show model time, tool time, output speed and `+added / −removed` lines next to `active`. Add a Toggletip saying the figures come from Claude Code and include subagents. Leave out each missing figure. Verify with a sheet test for a timed session and a Codex session.
- [ ] 3.4 Run `cd web && npm run check`, then commit the rebuilt `src/ai_ledger/web/`. Verify that `tests/test_web_build.py` passes.

## 4. Docs

- [ ] 4.1 Update `README.md` where it describes Activity and the session sheet. Verify that it names model time, tool time, output speed and lines changed, and says they need Claude Code's `cost-state` line.
- [ ] 4.2 Update `site/src/content/docs/pages/activity.mdx` with the `doc-coauthoring` skill. Verify with `cd site && npm run check`.
- [ ] 4.3 Add an `[Unreleased]` entry to `CHANGELOG.md` that names the new figures and tells existing users to run `ai-ledger rebuild`. Verify that the entry is under `[Unreleased]`.

## 5. Integration

- [ ] 5.1 Copy the live store, run `uv run ai-ledger rebuild --db <copy>`, then serve it with `uv run ai-ledger --db <copy> --port <free port>`. Verify on Activity and in a session sheet that model time, tool time and output speed show, and that speed is near the 98 tok/s measured in planning. Delete the copy afterwards.
- [ ] 5.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests` and `openspec validate --specs --strict`, and verify that all pass.

## Workflow follow-up

- Archive the change in this worktree after merge, then remove the worktree.
