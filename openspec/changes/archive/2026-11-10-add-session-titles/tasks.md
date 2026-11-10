# Tasks

Privacy for every group: `data/` holds full transcript content. Never copy a real transcript line, title or Codex index line into `tests/`, `web/src/__fixtures__/`, `tools/demo/` or a commit, and never print one. Every fixture below is synthetic. Measure against a copy of the store only, as `AGENTS.md` describes.

## 1. Derive agent titles

- [x] 1.1 Add the derived table `session_titles(session_id PRIMARY KEY, custom VARCHAR, agent VARCHAR)` to `DERIVED_SCHEMA` and `DERIVED` in `store.py`. Give `Deriver` a `titles` dict, upserted in `flush()` with "newest non-null wins" per column (design Decision 1). `Deriver.add` records `custom-title` → `custom` and `ai-title` → `agent` only when `not self.sub`, and skips lines whose title is not a non-empty string. Verify with `test_store` cases on synthetic lines for the `Choose a session's title` and `Ignore subagent titles` scenarios: an AI title then a custom title, a custom title before an AI title, two renames, an `ai-title` in a subagent file, and a title line split across two ingests. Also check that a title line creates no `sessions` row.
- [x] 1.2 Verify `Keep titles through rebuild` with a `test_store` case: ingest a synthetic file with title lines, delete the file, run `rebuild`, and check that `session_titles` holds the same rows.

## 2. Codex thread names

- [x] 2.1 In `codex.py` (design Decision 3), `files()` adds `<root>/session_index.jsonl` when it exists. `key()` gives index lines `codex-index:<id>:<updated_at>`. `fields()` returns `id` as the session id. `subagent()` is false for the index. `CodexDeriver.add` records `thread_name` as `agent`. Verify with `test_codex` cases on a synthetic index for every `Read Codex thread names` scenario: a rename where the later line wins, the index read before its rollout, a name for a session never stored (no `sessions` row and no dashboard entry), and no index file. Add one case where the index is rewritten whole and each line is still stored once.
- [x] 2.2 Check the rollback note in design.md: on `main`'s `codex.py`, give a stored index line to `CodexDeriver.add` and confirm it adds no rows. Record the result in design.md and remove the open question. Verify by the case passing, or by a recorded fix if it fails.

## 3. Resolve titles once

- [x] 3.1 Add `metrics.titles(cur, sids)`, returning `{sid: (title, "agent" | "prompt")}` (design Decision 2). Take `coalesce(custom, agent)` from `session_titles`, then fall back to `prompt_title(first_prompts(...))` only for sessions with neither. Split the whitespace-collapse and 80-character cut out of `prompt_title()` so every source shares them. Verify with `test_metrics` cases: priority order, the 80-character cut with an ellipsis (`Keep titles short`), whitespace collapse, and that `first_prompts` is not queried for sessions that have an agent title (patch it and count calls).
- [x] 3.2 Switch `with_titles()` and the session sheet's `title` (`metrics.py` around line 604) to `titles()`. Add `title` to error-loop rows (`error_loops`) and to tool-sheet recent calls. Verify that the existing `test_metrics` and `test_codex` title tests still pass, updated where a title now comes from a title line, and add a case for the error-loop and recent-call rows carrying `title`.

## 4. Live payloads

- [x] 4.1 `live.sessions()` and `live.session()` add `title` and `title_from`. A `"prompt"` title is sent as `null` unless `text`. `/api/live` accepts `text=1` in `app.py`. Verify with `test_live` cases for every `Title each live session` scenario and for the modified `Default request` scenario. That case asserts a sentinel string from the synthetic first prompt is absent without `text` and present with it. Add a `test_app` case for `/api/live?text=1`.
- [x] 4.2 Extend the Live payloads in `tests/test_web_fixtures.py`. The active list gets one session with an agent title, one with only a prompt title, and one with none. Add the same list with text. Run `uv run python -m unittest tests.test_web_fixtures`. Verify that the fixtures change only by the new fields and hold only synthetic text.

## 5. Live page

- [x] 5.1 Add `title` and `title_from` to the Live types in `web/src/api.ts`. `useLive` passes `text` to the list URL and refetches the list when Full text changes. Verify with a `useLive` unit test: turning Full text on refetches the list with `text=1`.
- [x] 5.2 Wall tile: add a one-line title row under `.top`, cut with an ellipsis and with the full title in its `title` attribute, left out when there is no title. Base `aria-label` on the title or the project. Rail entry: the title becomes the main line with an ellipsis, and the project, state and source move to `.sub`, without the branch. With no title, the entry keeps today's layout. Stream header: the title goes in an `h2` above the chips. Styles go in `live.css`. Verify with `LivePage.test.tsx` cases for the `Show active sessions in a rail`, `Show all sessions on a wall` and `Title the stream` scenarios, including the prompt-title case under Full text. Run `cd web && npm run check`.
- [x] 5.3 Check the fit by eye on a served copy of the store, with `--db <copy>` and a free port: the Wall at 1 to 6 tiles, the rail at its narrowest width, long titles and missing titles, light and dark. Verify that no line wraps or overflows in the rail or on a tile. Record any CSS fix in this task.
  - Checked on a rebuilt copy of the store (9 active sessions, 8 titled): Wall at 1280, 1000 and 600 px, light and dark, rail at 220 px and 250 px and the narrow horizontal rail, stream header. Every title and second line stays on one line; long ones end with an ellipsis and carry the full title on hover. No page scrolls sideways. No CSS fix needed. At 220 px the rail's second line is often cut after the project, so the state tag can be hidden there; the stream and the Wall still show it.

## 6. Titles where pages show a bare id

- [x] 6.1 Activity error-loops drawer (`web/src/pages/activity/tables.tsx`) and tool sheet recent calls (`ToolSheet.tsx`): switch the session cell to the `when sess` pattern from `SessionsDrawer`. That is a `cellbtn` with `sessName`, a `title` attribute and the short id in the small line. In the tool sheet's error-loop sentence, the label becomes `sessName` with the full title on hover. Add the `title` field to the matching types in `api.ts`. Verify with page tests covering the `Name sessions by their title` scenarios: a titled loop shows the title and the short id, and an untitled recent call shows the short id. Run `cd web && npm run check`.
- [x] 6.2 Check the fit by eye on the served copy: the error-loops drawer and the tool sheet's recent calls with long titles. Verify that the Project and Input columns keep their width and the table does not scroll sideways because of the session cell.
  - Error-loops drawer: 50 titled rows, single-line cells, no sideways scroll. Tool sheet recent calls: a long title widened the Session column to 230 px and narrowed Input to 232 px. Fix: `dialog.sheet table.recent td.sess { max-width: 160px }` in `sheets.css`. The Session column is now 160 px, the same as with short ids, and Input is 302 px.

## 7. Docs and build

- [x] 7.1 Update `README.md`. Say that sessions are named by the agent's own title, then the first prompt. Say that Live shows first-prompt titles only with Full text on. Say that a store from before this change needs one `uv run app.py rebuild` to title past Claude Code sessions. Verify that the README describes the behavior as built.
- [x] 7.2 Rebuild and commit `web/dist/` with the `web/src` changes. Verify that `tests/test_web_build.py` passes, and that the full suite passes with `uv run python -m unittest discover -s tests`.
- [x] 7.3 Integration check on a copy of the real store. Run `rebuild`, then compare titled against untitled sessions for both sources, and record the counts (no titles). Open Live while a Claude Code session runs, and record how long its `ai-title` takes to appear after the first prompt. Verify that the titled share is close to the 300-of-300 sample from exploration.
  - Rebuilt copy, then one ingest: Claude Code 2,381 of 2,470 sessions have an agent title (334 custom). The newest 300 Claude Code sessions with requests: 300 agent titles. Codex: 28 of 71 sessions have a thread name; the index names only 28 ids. The rest fall back to the first prompt: of the newest 67 Codex sessions, 26 agent and 41 prompt titles, none untitled. No `session_titles` row lacks a session. `ai-title` lag, measured from stored lines rather than by watching Live (title lines have no timestamp, so the next timed line bounds when it was written): median 8 s, p90 22 s after the first prompt, over 1,711 sessions from the last 30 days.

## Workflow follow-up

- Archive the change in its worktree after review, sync the specs, merge `feat/add-session-titles` into `main`, and remove the worktree.
