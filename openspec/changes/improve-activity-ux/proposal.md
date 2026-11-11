# Proposal

## Why

A review of Activity against a real store (GitHub issue #2) found ten places where the page shows a number but not what to do with it. Projects are ordered by a cost column the table does not show, and no table can be sorted. "See tests" only focuses a tile that repeats the number. The headline and tiles give no sense of change. The chart's failed-calls line mostly tracks how busy the day was. Helper projects other than the built-in ones cannot be left out. Work cannot be split by project, hour or weekday. The day drill-down shows each session's whole-range figures. A 90-day or All chart is mostly empty. Sessions filters are lost on reload.

## What Changes

- **Sortable columns.** Sessions, Project metrics and Tools sort by a column. Projects and Tools sort in the browser, since every row is loaded. Sessions sort on the server, since the list is paged: `/api/sessions` takes `sort` and `desc=1`. The sorted header carries `aria-sort`. The Sessions sort lives in page state, not the URL. Projects open ordered by sessions, descending, and show no cost column.
- **Failed test runs.** The payload gains `failed_tests` (the newest 50 failed runs). "See tests" opens a drawer `d-tests` that lists them, each linking to its error on the Errors page.
- **Change against the previous period** on the headline (commits, sessions, active days) and the five tiles. `previous` gains the figures this needs. Nothing shows for the All range. A change in the worse direction (errors up, pass rate down, interrupted up) is marked as worse.
- **Failure rate on the chart.** The chart line is errors per 100 calls on its own right-hand axis, replacing the raw failed-calls line. The tooltip keeps the failed count. Work rows gain `calls`.
- **Automated projects file.** A hand-edited `automated.json` (`{"projects": [...]}`) next to the store, like `prices.json`, adds projects to the built-in detection. It is read on each request. The payload gains `automated_file: {path, error, projects}`. Activity shows a banner when the file has an error. A malformed file is ignored.
- **Hour and weekday view.** A 7x24 heatmap of prompts by local weekday and hour, panel `hours`, under the work chart. The payload gains `work_hours`. It has a text alternative.
- **Chart by project.** Bars stack the top 5 projects by the chosen metric plus Other, in project colours. A view with one project gets plain bars. The payload gains `work_projects`.
- **Real day view.** Selecting a day shows that day's own figures per session and narrows Tools, MCP & hooks and Error loops to that day, through a new `/api/day`. Projects, the headline and attention stay range-wide.
- **Weekly buckets.** When the span from the first work day to the range end is over 60 days, the server buckets work by week (Monday start, local time). The payload gains `work_bucket` and `work`; `daily_work` keeps its daily meaning. Week bars are not selectable.
- **Sessions filters in the URL.** The Sessions drawer keeps `day`, `q` and `near` in the hash, written with replace, restored on reload. `day` clears when project, range or source changes.

Out of scope: a settings screen for the automated list (the file is edited by hand), a cost column in Project metrics, a sort in the URL.

## Capabilities

### Modified Capabilities
- `usage-dashboard`: "Lead with the period's work", "Lead with what needs attention", "Show work per day" and "Link to a project or session" change; new requirements cover sortable tables, change against the previous period, hours, chart by project, the day view and weekly buckets.
- `dashboard-app`: "Exclude automated sessions by default" counts the projects in the automated projects file; a new requirement reports a bad file.

## Impact

- `src/ai_ledger/metrics.py`: `usage()` payload (`failed_tests`, `previous`, `work`, `work_bucket`, `work_hours`, `work_projects`, `automated_file`), work rows with `calls`, `session_list()` sort, a day query, automated projects read from the file in `scope()`.
- `src/ai_ledger/app.py`: `/api/sessions` params `sort` and `desc`, new `/api/day`.
- `web/src/api.ts` and `web/src/pages/activity/`: tables, drawers, chart, heatmap, headline, banner, hash state. `src/ai_ledger/web/` rebuilt. Page-test fixtures regenerated.
- `README.md`: the automated projects file and the new Activity views.
