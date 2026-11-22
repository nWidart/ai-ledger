# Verification

The change as built at `de1513d9` (branch `feat/context-overhead-list`), checked in step 4.4. Steps 4.2 (bundle limit) and 4.3 (Context docs page) wait for `echart-context` to merge and are not part of this record.

## Scenarios

Each scenario of the two spec deltas, with the test that proves it (file, then the test's exact title) or the line of the browser check below. A Python title is `Class.method`; a web title is the `it` title, under its `describe`.

### `context-dashboard`: Draw each project's window as a grid

| Scenario | Proof |
|---|---|
| Several projects | `web/src/pages/context/Grids.test.tsx`, window grids: "draws a small grid for each of the busiest projects, at most six" |
| Ranked by the sessions drawn | `web/src/pages/context/Grids.test.tsx`, window grids: "ranks projects by the sessions the grid draws, not by measured starts" |
| Figures match the cells | `web/src/pages/context/Grids.test.tsx`, window grids: "states the figures the cells draw, even with a median peak under the median start" |
| One project | `web/src/pages/context/Grids.test.tsx`, window grids: "draws the one full grid, with its legend and the list of what loads before the first prompt, when a project is selected" |
| One project with a snapshot | The same test; browser line (9) |
| Another project selected | The same test (the list opened, another project rerendered, its list closed); browser line (12) |

### `project-page`: List what loads before the first prompt

| Scenario | Proof |
|---|---|
| Ranked categories | `web/src/pages/project/overhead.test.ts`, loadList: "ranks the fixture's categories by their share of what loads before the first prompt, with each one's items" |
| Closed on load | `web/src/pages/project/ProjectPage.test.tsx`: "splits the starting cells by the snapshot, with its date, model, deferred tools and largest items"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "is closed until asked; opened, a named list of categories in rank order, each row one sentence, its bar decoration" |
| Nothing counted before the first prompt | `web/src/pages/project/overhead.test.ts`, loadList: "says when the items hold more than their category, or when it counts none of them" |

### `project-page`: Write the overhead shares at either end

| Scenario | Proof |
|---|---|
| A share near none or all | `web/src/pages/project/overhead.test.ts`, loadList: "writes a share that would round to 0% or 100% as less or more, and ties keep the snapshot's order" |

### `project-page`: Keep the overhead list open for a new snapshot

| Scenario | Proof |
|---|---|
| A new snapshot of the same project | `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "makes a button only of a named server's and a skill's name, opening it by its call key, and none without an opener"; browser line (12) |

### `project-page`: Say when the overhead snapshot predates the view

| Scenario | Proof |
|---|---|
| An old snapshot | `tests/test_context.py`: `OverheadTest.test_latest_snapshot_of_the_project_whatever_the_range`; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "draws no bar where the items do not fit, no share where uncounted, and says so for an old snapshot" |
| A view of all time | `tests/test_context.py`: `OverheadTest.test_latest_snapshot_of_the_project_whatever_the_range` (`before_view` false for all time); `web/src/pages/project/overhead.test.ts`, loadList: "ranks the fixture's categories by their share of what loads before the first prompt, with each one's items" (`stale` false) |

### `project-page`: Rank the overhead items under their category

| Scenario | Proof |
|---|---|
| Many small skills | `web/src/pages/project/overhead.test.ts`, fold: "folds a seventh row and beyond into one, its tokens the hidden rows' sum" (214 rows: "209 more, 8.4k tokens", "Show all 214"); loadList: "counts its items: %s" (the count and median lines) |
| Show all | `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "folds each list after five rows and back, the focus kept on its one button, each list on its own"; browser line (7) |
| Two files of one name | `web/src/pages/project/overhead.test.ts`, loadList: "keys items by seq, ranks ties by name then seq, and keeps every name as it is"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "draws no bar where the items do not fit, no share where uncounted, and says so for an old snapshot"; browser line (14) |
| An item with no name | `web/src/pages/project/overhead.test.ts`, loadList: "keys items by seq, ranks ties by name then seq, and keeps every name as it is"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "makes a button only of a named server's and a skill's name, opening it by its call key, and none without an opener" |

### `project-page`: Tell apart MCP servers of one name

| Scenario | Proof |
|---|---|
| Two servers of one name | `web/src/pages/project/overhead.test.ts`, loadList: "groups MCP tools by their server key, named by detail, its calls counted by that key"; browser line (13) |

### `project-page`: Say how often each MCP server and skill was called

| Scenario | Proof |
|---|---|
| A called server | `tests/test_context.py`: `OverheadTest.test_calls_are_claude_codes_in_the_view` (main thread and subagent counted); `web/src/pages/project/overhead.test.ts`, loadList: "groups MCP tools by their server key, named by detail, its calls counted by that key" (the call text) |
| Another agent's calls | `tests/test_context.py`: `OverheadTest.test_calls_are_claude_codes_in_the_view` (Codex and Grok calls not counted); `web/src/pages/project/overhead.test.ts`, loadList: "ranks the fixture's categories by their share of what loads before the first prompt, with each one's items" ("not called by Claude Code in this view") |
| Open a server | `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "makes a button only of a named server's and a skill's name, opening it by its call key, and none without an opener"; `web/src/pages/project/ProjectPage.test.tsx`: "splits the starting cells by the snapshot, with its date, model, deferred tools and largest items"; browser line (6) |

### `project-page`: List MCP tools of no server under Unknown server

| Scenario | Proof |
|---|---|
| A tool with no server | `web/src/pages/project/overhead.test.ts`, loadList: "groups MCP tools by their server key, named by detail, its calls counted by that key"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "makes a button only of a named server's and a skill's name, opening it by its call key, and none without an opener" |

### `project-page`: Show overhead items that do not fit their category

| Scenario | Proof |
|---|---|
| MCP tools listed beyond what loads | `web/src/pages/project/overhead.test.ts`, loadList: "ranks the fixture's categories by their share of what loads before the first prompt, with each one's items"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "draws no bar where the items do not fit, no share where uncounted, and says so for an old snapshot"; browser line (8) |
| No category for the items | `web/src/pages/project/overhead.test.ts`, loadList: "says when the items hold more than their category, or when it counts none of them"; `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "draws no bar where the items do not fit, no share where uncounted, and says so for an old snapshot" |

### `project-page`: Fit the overhead list on any screen

| Scenario | Proof |
|---|---|
| A phone at large text | Browser lines (1) and (2) |
| A tiny item | Browser line (3) |
| Forced colors | Browser line (4) |
| A memory file on a phone | Browser line (14); `web/src/pages/project/OverheadList.test.tsx`, OverheadList: "is closed until asked; opened, a named list of categories in rank order, each row one sentence, its bar decoration" (the folder in the row's text) |

No scenario is left without a test or a browser line.

The server key that links a snapshot's MCP tool to its stored calls has its own test across the ingest and the payload: `tests/test_derive.py`: `ContextSnapshotTest.test_a_snapshot_tool_and_its_calls_have_one_server_key`. The payload's one transaction: `tests/test_context.py`: `OverheadTest.test_one_snapshot_for_the_whole_payload`.

## Net test lines

`git diff --numstat b414d690..de1513d9` over the test files:

| File | Added | Removed |
|---|---|---|
| `tests/test_context.py` | 84 | 10 |
| `tests/test_derive.py` | 17 | 1 |
| `web/src/pages/context/Grids.test.tsx` | 19 | 5 |
| `web/src/pages/project/OverheadList.test.tsx` | 130 | 0 |
| `web/src/pages/project/ProjectPage.test.tsx` | 17 | 7 |
| `web/src/pages/project/overhead.test.ts` | 203 | 0 |
| `web/src/pages/project/project.test.ts` | 2 | 2 |
| **Total** | **472** | **25** |

Net: **447** lines, over the 400-line advice (about 280 planned). Why: the model's test, the largest part, carries the rules that `design.md` left open and the build settled (shares under 0.1% and over 99%, "1 token", figures that read alike written in full, empty strings as missing, negative and NaN counts, two servers of one label, "Unknown server" last), one table-driven case per line of decision 8, and a guard against "NaN", "undefined" and "null" in any text. The ingest-to-payload test of the server key in `tests/test_derive.py` covers step 1.1's stated risk, which no other layer can see. No test repeats a rule at a second layer: the page tests assert the wiring once.

## Checks of step 4.4

Run at `de1513d9` with this step's document changes (no file under `web/src` or `src/` changed since step 4.1's run at `ea8ae5b4`):

| Check | Result |
|---|---|
| `uv run ruff check` | Pass: all checks passed |
| `uv run pytest -n 2` | Pass: 710 passed, 493 subtests passed |
| `npm run typecheck` (in `web/`) | Pass: no error |
| `npm run lint` (in `web/`) | Pass: 0 errors, 141 warnings, none in a file of this change |
| `npx vitest run --maxWorkers=2` (in `web/`) | Pass: 108 files, 2,397 tests |
| `npm run build` (in `web/`) | Pass |
| `node scripts/check-bundle.mjs` (in `web/`) | Pass: 8 chunks within their limits (`ContextGrid` has no limit until step 4.2) |
| `cd site && npm ci && npm run check` | Pass: drift check (19 theme tokens, 44 shots paired and listed), `astro check` 0 errors and 0 warnings, 42 pages built |
| `openspec validate context-overhead-list --strict` | Pass: valid |
| `openspec validate --specs --strict` | Pass: 22 passed, 0 failed |

Bundle as built, against the base `b414d690` (gzip): `ContextGrid-*.js` 6.21 kB (3.68 kB), `ProjectPage-*.js` 9.48 kB (9.47 kB), `ContextPage-*.js` 19.55 kB (19.54 kB), `index-*.js` 111.41 kB (111.40 kB; 347.59 kB raw at both), `echarts-*.js` 179.09 kB, the same file.

## Browser check (step 4.1)

Run on the synthetic demo store at commit `ea8ae5b4`; no file under `web/src` changed since.

```
(1) Project page, opened, at 1440px, 375px and 1280px with a 32px root font: no sideways scroll of the list and every row inside its column (the list and its side column measured, not the page's navigation): ok (1440px: 315 rows in a 554px column, page overflow 0px; 375px: 315 rows in a 317px column, page overflow 0px; 1280px at 32px: 315 rows in a 554px column, page overflow 233px)
(2) In a 343px box at 16px and 32px text the bar sits under the name: ok (308 bars, 0 beside their name; list 343px; 308 bars, 0 beside their name; list 343px)
(3) A 40-token skill's bar is 1px wide and present: ok (bar 1px, 0.41px unfloored, track 144px)
(4) Forced colors: every bar, items included, CanvasText in a bordered track; the summary and buttons readable: ok (CanvasText rgb(255, 255, 255); 308 bars, 302 of items; 0 off; 304 controls, lowest contrast 19.6)
(5) Dark and light, and an OS flip with no reload: ok (light bar rgb(42, 120, 214), dark bar rgb(57, 135, 229); same in both: none; flip off: none; lowest text contrast 5.7 light, 6.3 dark)
(6) Enter on a server name opens its tool sheet with the URL's filters kept, a click on a skill name its skill sheet, and closing either returns the focus to that name: ok (?project=atlas-api&range=30&mcp=caveman then focus on BUTTON "caveman"; ?project=atlas-api&range=30&skill=skill-005 then focus on BUTTON "skill-005")
(7) Show all and Show fewer keep the focus on the button: ok (focus on BUTTON "Show fewer", aria-expanded true, 300 rows; focus on BUTTON "Show all 300", aria-expanded false, 5 rows; Space: focus on BUTTON "Show fewer", aria-expanded true, 300 rows)
(8) The over category's items have no bar and its line is shown: ok (1 items, 0 bars; line "The 3 tools listed hold 805 tokens, more than the 619 this c…")
(9) Context page with atlas-api selected shows the same list in its one grid, and with no project selected none: ok (atlas-api: 1 lists, 1 in a full grid, "What loads before your first prompt · 34.0k tokens" (Project page the same); no project: 0 lists, 5 compact grids)
(10) Project page: Measure now still under the block's figures, the list not covering it (opened, every fold out): ok (figures end 753, list ends 557, button at 769, hit BUTTON)
(11) No CSP violation, console error or page error: ok (every page of checks (1) to (15); 0 connections dropped by the demo server)
(12) Context page: list and a server's tools opened for atlas-api, another project selected: its list closed; atlas-api again, list and tools opened, a newer snapshot: the list still open and the server's tools closed: ok (infra-scripts: list closed, tools closed; newer snapshot: list open, tools closed, "Measured Nov 21, 10:15 AM with…")
(13) Two servers with the same label read "github (plugin_gh_github)" and "github (github)", and Enter on each opens the sheet with its own call key in the URL: ok (github (plugin_gh_github) | github (github); ?project=atlas-api&range=30&mcp=plugin_gh_github | ?project=atlas-api&range=30&mcp=github)
(14) Nothing in the list reachable only by hover; a memory file's folder visible text at 375px without sideways scroll: ok (2 titles, 2 memory files; none hidden)
(15) Payload extremes (categories only, empty calls, a null skill name, a null MCP server, 1e12 tokens, right-to-left names, a 200-character name with no spaces): no "null", "undefined" or "NaN", no sideways scroll at 375px, no console or page error: ok (categoriesOnly: 0 bad words, page scroll 0px, 0 boxes outside, 0 errors; odd: 79 text nodes, 0 bad words, page scroll 0px, 0 boxes outside, 0 errors; summary "What loads before your first prompt · 1,000.00B tokens")
```

Notes:

- The 233px page overflow in (1) is the top navigation's known overflow at 1280px with a 32px root font, not the list: the list and its side column are measured on their own, and every row is inside its column.
- Images: `site/src/assets/shots/project-context.png` and `project-context-light.png` were recorded again on the demo store and show the new summary line. `project-layout*.png` were not recorded again: they crop above the list, so they do not change.
