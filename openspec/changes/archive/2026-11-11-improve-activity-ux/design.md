# Design

## Context

Activity loads one `/api/usage` payload and renders the headline, tiles, work chart and five drawers from it. Sessions in the drawer come from `/api/sessions`, paged by 100. `daily_work` has one row per day with sessions, prompts, commits and failed calls. `previous` carries the prior period's tokens, cost, requests, sessions and active days. Cost already shows a prices-file banner and a stacked chart with an Other remainder.

## Decisions

### Sort where the rows are
Project and Tool rows are all in the payload, so the browser sorts them; a header click toggles descending and ascending, and the sorted header carries `aria-sort`. Sessions are paged, so a browser sort would order one page only. `/api/sessions` takes `sort` (one of `SESSION_SORTS`) and `desc=1`, sorts the whole matching list (rows with no value last), then pages it; an unknown `sort` answers 400. Today's order (newest first, nearest the context limit first with `near`, costliest first with `day`) is the default when `sort` is absent. The Sessions sort lives in page state: it is a way of reading a table, not a view to share. The "near limit" attention action and a day picked on the chart set the list's own order, so they clear the sort; a sort change loads the first page again. Projects default to sessions, descending. The table shows no cost column, because cost belongs to Cost.

### Failed tests are rows, not a count
`failed_tests` holds the newest 50 failed test or build runs: `id`, `session_id`, `title`, `project`, `source`, `command`, `ts`. The `id` is the tool call id the Errors page already opens, so each row links to its error. "See tests" opens drawer `d-tests` instead of focusing the tile. The drawer's count is the total of failed runs in the view (`totals.tests_failed`); a capped list says "Showing the N newest of M".

### Deltas come from `previous`
`previous` gains `prompts`, `commits`, `calls`, `errors`, `test_runs`, `tests_passed`, `interrupted`, `sub_tokens` and `median_session_seconds`, computed by the same scope and the same day window as the view. The page derives each change from `totals` and `previous`: commits, sessions and active days on the headline; errors per 100 calls, test pass rate, interrupted rate, subagent share and median session on the tiles. For the All range `previous` is null and nothing shows. A figure that formats the same in both periods reads "unchanged". The worse direction is errors per 100 calls up, test runs passed down, prompts interrupted up; the other tiles show a change without judging it.

### Rate on its own axis
Failed calls track how busy the day was. The chart line becomes errors per 100 calls (`failed_calls / calls`), drawn against its own right-hand axis so it does not share a scale with the bars. Work rows gain `calls`. Days with no calls draw no point. A view with no tool calls in any bucket draws no line, right axis or legend entry. The tooltip keeps the failed count beside the rate.

### Automated projects file
`automated.json` sits next to the store: `{"projects": ["name", ...]}`. `scope()` reads it, like `user_prices()`, and adds its names to `AUTOMATED_PROJECTS`; `usage()` reads it once and passes the projects through, so one payload leaves out the same projects throughout. A project named by the filter is still let in. A file that cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string is ignored whole. The payload carries `automated_file: {path, error, projects}` (`error` is null when the file was read or is absent; `projects` is the list in use). Activity shows a banner on an error, as Cost does for prices, and the "Include automated" toggle's tooltip names the file's path.

### Hours and stacking from the server
`work_hours` is `{dow, hour, prompts}` with `dow` 1 (Monday) to 7 (Sunday), `hour` 0 to 23, both on the machine's local clock, nonzero cells only. The heatmap fills the empty cells. It is a table, so each cell reads with its weekday and hour, and a text summary names the busiest hour and day (and the ties for them) and the total. The table is one tab stop; the arrow keys move between cells.

`work_projects` is `{day, project, sessions, prompts, commits, calls, failed_calls}`, one row per bucket (day or week) and project. The chart stacks as the Cost page does (`projectKinds`, `hasHue`): the projects that have a colour of their own, most of the chosen metric first, then Other for every other project and for sessions with no project. A view with one project, or with no coloured project, draws plain bars. The server buckets these rows by the same rule as `work` (`work`, `work_bucket` in `metrics.py`), so the browser sums nothing.

### Day view
`/api/day?project&range&automated&source&day=YYYY-MM-DD` returns `{day, tools, mcp, skills, hooks, error_loops, error_loops_total}` for that day, with the same scope as `/api/usage`. Selecting a day fetches it. The Sessions drawer already limits figures to the day through `/api/sessions`; Active becomes that day's active time. Peak context and compactions stay whole-session, and a tooltip says so. Tools, MCP & hooks and Error loops read from the day payload. Projects, the headline and attention stay range-wide. Clearing the day restores the range figures.

### Buckets decided on the server
When the span from the first work day to the range end is over 60 days, the server sums work rows by week, Monday start, on the local clock. Otherwise it keeps days. `work_bucket` is `"day"` or `"week"`; `work` holds the bucketed rows (`day` is the week's Monday). `daily_work` keeps one row per day for its other consumers. Summing `work` gives the totals, sessions included: a session that ran in two weeks counts once in each, the way the daily rows count it per day, so `sessions` is a count of sessions with a request in that bucket. The week that holds the range end reads "so far"; a first week cut by the range start reads "from <date>". Week bars cannot be selected, and a hint says to choose a shorter range to pick a day.

### Filters in the hash
The Sessions drawer writes `day` (YYYY-MM-DD), `q` and `near` ("1") to the hash with replace, not push, so typing does not fill the history. They are read on load; an impossible date in `day` reads as no day. `day` is dropped by one rule in `applyPatch` (`hash.ts`), in the same write as any change of project, range or source (the filters, the command palette, a sheet's filter button, the nav's clear button), since the day may be outside the new view; Back then restores the earlier entry with its day.

## Risks

- `previous` grows by nine figures and each needs the same scope as the view; a test compares each against `usage()` on the prior window.
- A week bucket's `sessions` is not a distinct count across weeks; the spec states that totals sum buckets.
- Reading `automated.json` per request costs one small file read.
- A day query repeats the tool, hook and loop queries with a day window; they share the existing queries, parameterised by window.
