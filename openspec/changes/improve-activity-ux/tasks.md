# Tasks

## 1. Server and payload

- [ ] 1.1 Read `automated.json` next to the store in `scope()` and add its projects to the built-in list; ignore a malformed file; add `automated_file: {path, error, projects}` to `usage()`. Verify with a `test_metrics.py` case per failure (unreadable, invalid JSON, no `projects` list, non-string entry) and one with a valid file.
- [ ] 1.2 Add `sort` and `desc=1` to `session_list()` and `/api/sessions`, sorting the whole list before paging. Verify with a case where the top row on page 2 by cost is not the top row of the default order.
- [ ] 1.3 Add `failed_tests` (newest 50: id, session_id, title, project, source, command, ts) to `usage()`. Verify with 60 failed runs: 50 come back, newest first.
- [ ] 1.4 Add `prompts`, `commits`, `calls`, `errors`, `test_runs`, `tests_passed`, `interrupted`, `sub_tokens` and `median_session_seconds` to `previous_period()`. Verify against `usage()` over the same window; `previous` stays null for All.
- [ ] 1.5 Add `calls` to work rows, and add `work_hours` (local `dow` 1 to 7, `hour` 0 to 23, nonzero cells) and `work_projects`. Verify a prompt at 23:30 local lands on that local day and hour.
- [ ] 1.6 Add `work` and `work_bucket`: weekly (Monday start, local) when the span from the first work day to the range end is over 60 days, daily otherwise; `daily_work` stays daily. Verify the 60 and 61 day boundary and that summing `work` equals the totals.
- [ ] 1.7 Add `/api/day` returning `{day, tools, mcp, skills, hooks, error_loops, error_loops_total}` for one local day. Verify a call outside the day is left out and an invalid `day` is rejected.
- [ ] 1.8 Regenerate the page-test fixtures: `uv run python -m unittest tests.test_web_fixtures`.

## 2. Tables, drawers and URL filters

- [ ] 2.1 Add `Previous` fields, `FailedTest`, `WorkHourRow`, `WorkProjectRow`, `automated_file` and the new `calls` field to `web/src/api.ts`, with fetchers for `/api/day` and the `sort` params.
- [ ] 2.2 Make Project metrics and Tools sortable in the browser with `aria-sort` on the sorted header; open Projects by sessions descending; drop the cost column. Verify with a page test that clicking a header reorders rows and flips `aria-sort`.
- [ ] 2.3 Make Sessions sortable through `/api/sessions` with `sort` and `desc`, kept in page state. Verify the request carries them and the sort resets the page offset.
- [ ] 2.4 Add the `d-tests` drawer listing `failed_tests`, each row linking to its error on the Errors page; point "See tests" at it. Verify with a page test.
- [ ] 2.5 Keep `day`, `q` and `near` in the hash with replace, restore them on load, and clear `day` when project, range or source changes. Verify with a reload test.

## 3. Chart, stacking, weekly buckets and heatmap

- [ ] 3.1 Draw the errors-per-100-calls line on its own right-hand axis in place of failed calls; keep the failed count in the tooltip. Verify with a page test.
- [ ] 3.2 Stack bars by the top 5 projects plus Other in project colours, plain bars for one project, from `work_projects`.
- [ ] 3.3 Draw from `work` and `work_bucket`: week bars are not selectable and a hint says to choose a shorter range to pick a day.
- [ ] 3.4 Add the `hours` heatmap panel under the work chart with a text alternative. Verify the alternative names the busiest cell.
- [ ] 3.5 Make selecting a day fetch `/api/day`, narrow Tools, MCP & hooks and Error loops to it, show that day's active time in Sessions, and add the tooltip on peak context and compactions. Verify Projects, the headline and attention keep their range figures.

## 4. Headline deltas, automated-file banner and wiring

- [ ] 4.1 Show the change against the previous period on the headline (commits, sessions, active days) and the five tiles, nothing for All, marking errors up, pass rate down and interrupted up as worse.
- [ ] 4.2 Show a banner on Activity when `automated_file.error` is set, with the path and reason, as Cost does for the prices file.
- [ ] 4.3 Run `cd web && npm run check` and commit `src/ai_ledger/web/` with the source change.

## 5. README and archive

- [ ] 5.1 Document the automated projects file and the new Activity views in `README.md`.
- [ ] 5.2 Run `uv run ruff check` and the Python tests, then archive the change.
