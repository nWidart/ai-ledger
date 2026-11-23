# Tasks

Each group is one builder's work. Dependencies: 2 needs 1. 3 needs the payload types of 2 (it can start from the `LiveAgent` type in `design.md`, decision 2, and a hand-written list, then switch to the fixture of 6). 4 and 5 need 3 and can run side by side. 6 needs 2. 7 needs 3, 4 and 5. 8 needs 1 and 2.

Test rules (`AGENTS.md`): add an assertion to the test that already builds the fixture, payload or render before adding a test; test a rule once, at the layer that owns it; do not repeat a shared code path once per source.

## 1. Store and parsers: threads and spawn calls

- [x] 1.1 In `store.py`, add `lane VARCHAR` to `tool_calls` and `requests` (in `DERIVED_SCHEMA` and as `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `open_store`), add the `spawns` table of `design.md` decision 1 to `DERIVED_SCHEMA` and `DERIVED`. Verify: the test in `tests/test_store.py` that opens an older store asserts that it opens with the new columns and table, empty.
- [x] 1.2 Give `Deriver` its file's lane (`SOURCES[source].lane(path)` when `sub`, else none) and write it on every call and request row, in `store.py`, `codex.py` and `grok.py`. Verify: one assertion per deriver in the test that already derives a subagent file (`tests/test_derive.py`, `tests/test_codex.py`, `tests/test_grok.py`): the subagent's call and request carry its lane, the main thread's carry none.
- [x] 1.3 Record spawn calls in `spawns` for Claude Code (`Agent`, `Task`; `agent` from the result's `toolUseResult.agentId`), with the description cut to 300 characters and no prompt, through one upsert that takes the call and the naming line in either order. Verify: `tests/test_derive.py` covers a subagent of a subagent (the row's `lane` is the parent subagent, its `agent` the child), a call with no result (no `agent`) and the call and its result in two ingests.
- [x] 1.4 Record spawn calls for Codex (a `function_call` named `spawn_agent`, with `task_name`; `agent` from the `SubAgentActivity` start item; no `tool_calls` row added) and for Grok (`spawn_subagent`; `agent` from the `SubagentCompleted` result). In `GrokDeriver.adopt`, move the child's `spawns` rows and set the child's id as `lane` on its moved rows that have none. Verify: assertions in the Codex and Grok tests that already derive a spawned thread; the Codex tool counts of those tests do not change.
- [x] 1.5 Record delegation calls (`mcp__t3-code__delegate_task`): `description` from `title`, `provider` and `model` from `target`, else from the result, `status` from Claude Code's `mcpMeta.structuredContent.status`. Before writing the Codex and Grok branches, read the keys (not the values) of one real delegation result line of each source, and store a status only where the line states one. Never store or print `task`. Verify: `tests/test_derive.py` covers target in the input, status and model from the result, and a call with no result; the Codex and Grok tests assert the title and the model.
- [x] 1.6 Check that a forked Codex thread's copied history gives the copy no request of its parent's lane: the request keeps the lane of the thread that made it. Verify: an assertion in the test in `tests/test_codex.py` that already derives a forked thread.
- [x] 1.7 Run `uv run ai-ledger rebuild --db <copy of the live store>` (never the live store; the app stopped or a copy used) and verify with a count query that `spawns` has rows of both kinds and that subagent calls carry a lane. Run `uv run ruff check` and `uv run pytest`.

## 2. `live.py`: agents in the list payload

- [x] 2.1 Add `agents` to `live.sessions()` behind a parameter, and `agents=1` to `/api/live` in `app.py`: the three grouped queries of `design.md` decision 2, the flat `LiveAgent` list with `parent`, and nothing added when not asked. Verify: `tests/test_live.py` asserts, on the fixture that already has subagent lanes, each agent's parent, name, description, tools, errors, cost and model, and that the answer without the parameter has no `agents` key and is otherwise equal.
- [x] 2.2 Tell a subagent's status by the three rules of decision 3, reusing `started_by()` over the session's recent rows for a running Claude Code subagent, and the recent rows' turn marks for Codex and Grok. Verify: `tests/test_live.py` covers a nested running Claude Code subagent named by its `meta.json`, a Codex thread by its turn mark, and a subagent with no starting call before and after 5 minutes.
- [x] 2.3 Add delegations as agents with their status (`pending`, `started`, `done`, `failed`), and no session id or thread id of the child. Verify: one test in `tests/test_live.py` with the four statuses.
- [x] 2.4 Cap a session's agents at 200, unfinished first, then newest start first, with `agents_more`. Verify: one test with more agents than the cap.
- [x] 2.5 Make `live.lanes()` read `requests.lane`. Verify: its existing tests in `tests/test_live.py` pass unchanged, and 2.1 asserts that a lane's cost and model equal its agent's.
- [x] 2.6 Verify the text rule: an assertion in 2.1 that `agents=1&text=1` sends no description above 300 characters and no `task` text. Run `uv run ruff check` and `uv run pytest`.

## 3. Tree view shell

- [x] 3.1 Add `LiveAgent`, `agents` and `agents_more` to `web/src/api.ts`, an `agents` option to `liveUrl` and `queries.liveList` (in the query key), and an `agents` argument to `useLive`, true only in the Tree view. Verify: `LivePage.test.tsx` asserts that the list request carries `agents=1` in the Tree and not in the Stream view or on the Wall.
- [x] 3.2 Extend `search.ts`: `view` takes `tree`, `layout` takes `org` and is kept only with `view=tree`. Verify: cases added to the existing `search.test.ts` test of `validateSearch`.
- [x] 3.3 Add the Tree button to the View group and the layout toggle (Outline, Org chart) in `LivePage.tsx`; switching the layout replaces the history entry; Full text and Follow do not show in the Tree, and the Tree's requests ask for no text. Verify: `LivePage.test.tsx` covers the toggle's pressed state, the URL after each switch, and one connection across Stream, Wall, Tree and a layout switch.
- [x] 3.4 Write `web/src/pages/live/tree.ts`: the tree of one session from its flat agents (parents, order, orphans and cycles under the session), which nodes are over, the fold node and its label, the visible nodes given the fold state, and each node's text for assistive technology. Verify: `tree.test.ts` covers nesting three deep, the order, an orphan, a done parent of a running child, the 10-minute rule for a delegation, and the fold labels.
- [x] 3.5 Keep the fold state in `LivePage` (fold nodes closed, others open; kept while the page is open, shared by both layouts) and render the groups under `h2` headings with the empty state. Until 4 and 5 land, draw each node as a plain nested list. Verify: `LivePage.test.tsx` asserts the groups and that a fold opened in one layout is open in the other.
- [x] 3.6 Open a node in the Stream: `pick`, the lane's fold opened in `LaneChoices`, and the `reveal` value of `design.md` decision 8 consumed by `Stream.tsx` (scroll, focus, Follow off; dropped when the events do not hold the lane or the call). Mark the URL's session as current in the Tree. Verify: `LivePage.test.tsx` covers a session node, a done subagent's node (lane unfolded, focus on its header, Follow off), a delegation node, and Back to the Tree in its layout.
- [x] 3.7 Show "N older agents not shown" with the session sheet link when `agents_more` is above zero. Verify: an assertion in the 3.5 test. Run `cd web && npm run check`.

## 4. Outline layout

- [x] 4.1 Write `Outline.tsx`: one `role="tree"` per group named by its heading, rows with level, place and expanded state, children in `role="group"`, the columns on a shared grid, the description cut with an ellipsis and whole on hover. Verify: one render test asserts the roles, levels and the accessible name of a session row, a subagent row and a delegation row.
- [x] 4.2 Add the keys: Up, Down, Left, Right, Home, End, Enter and Space, with a roving `tabindex` that starts on the URL's session. Verify: one test walks a session with a nested subagent and a fold row by keyboard, and selects with Enter.
- [x] 4.3 Keep the focus on a node that moves group or goes into a fold (to the fold row when the fold is closed). Verify: one test where a focused running subagent finishes.
- [ ] 4.4 Style the Outline in `live.css`, with the two-line row and the smaller indent below 721 pixels. Verify in the running app at 1440x900 and 390x844 (`uv run ai-ledger --db <copy> --port <free port>`): columns line up, no sideways scroll, a third-level row is at least 195 pixels wide on the phone. Run `cd web && npm run check`.

## 5. Org chart layout

- [x] 5.1 Write `OrgChart.tsx`: nested lists per session under the group's `h2`, each card a button named from the node's text, the fold a button with its expanded state, connectors in CSS only. Verify: one render test asserts the list nesting, the tab order parent then children, and a card's accessible name.
- [ ] 5.2 Arrange children in a row for 5 or fewer and in a column for 6 or more, and in a column for every parent below 721 pixels; let a wide chart scroll inside its box. Verify: one test asserts the class for 5 and for 6 children; in the running app at 1440x900, 1280x800 and 390x844, check the connectors, 8 children in a column, and no sideways scroll of the page.
- [x] 5.3 Keep the focus on a card that moves, as 4.3, through the shared key lookup of 3. Verify: an assertion added to the 4.3 test for the Org chart layout, or the same test run for both layouts. Run `cd web && npm run check`.

## 6. Fixtures

- [x] 6.1 Extend the store that `tests/test_web_fixtures.py` builds with a nested subagent and a delegation call, and add one fixture, `web/src/__fixtures__/live-agents.ts`, for the list with `agents=1`. Regenerate with `uv run python -m unittest tests.test_web_fixtures`. Verify: the regenerated `live.ts` has no `agents` key, `live-agents.ts` has a nested agent and a delegation, and `cd web && npm run check` passes.
- [x] 6.2 Point the Tree tests of groups 3 to 5 at `live-agents.ts` where they used a hand-written list. Verify: `cd web && npm run check`.

## 7. README, changelog and docs site

- [ ] 7.1 Update the Live row of `README.md` and its Privacy note on Live (the Tree shows descriptions and delegation titles, never prompt text). Verify: the row names the Tree and both layouts.
- [ ] 7.2 Add to `[Unreleased]` in `CHANGELOG.md`: the Tree view, `/api/live`'s `agents=1` with `agents` and `agents_more`, the new store fields, and the note to run `ai-ledger rebuild` once for sessions that span the upgrade. Verify: the entries are under Added and Changed.
- [ ] 7.3 With the `doc-coauthoring` skill, update `site/src/content/docs/pages/live.mdx` (the Tree, its layouts, folds, what a delegation node says and why "started" says no more), `everywhere/keyboard-screen-reader.md` (the Outline's keys), `start/upgrade.md` (the rebuild note) and `reference/storage.md` if it lists the derived tables. Verify: `cd site && npm run check`.

## 8. Demo store (optional)

- [ ] 8.1 In `tools/demo/seed.py`, give one live session a subagent with a subagent of its own, two finished subagents and a delegation call. Verify: `tools/demo/serve.py` shows them in the Tree, in both layouts, with one fold row.
- [ ] 8.2 If the Live GIF in the README should show the Tree, add the step to `tools/demo/record.mjs` and record it again. Verify: the GIF plays the Tree in light and dark.

## 9. Integration check

- [ ] 9.1 On a copy of the live store, with a real session that runs subagents: compare the Tree's nodes with the lanes of the same session's stream (same subagents, same tool counts, cost and model), in both layouts, with a screen reader on one group. Run `uv run ruff check`, `uv run pytest`, `cd web && npm run check`, `cd site && npm run check` and `openspec validate add-live-tree --strict`.

## Workflow follow-up

- Ask for a Sol review on the pull request that builds this change, not on the one that archives it.
- Archive the change in its own worktree and sync the three specs.
