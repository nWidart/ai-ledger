# Proposal

## Why

A project is the unit the user reasons about, but its picture is split over seven pages. The project sheet (640px, opened from a project row) shows only what the usage payload holds: cost, sessions, models and the most expensive sessions. To see the project's errors, context use, session judgments or limit share, the user sets the project filter and visits each page in turn. No place answers "how is this project doing?" at once.

A larger modal was considered and rejected: an overview of this size is a page, and a modal has no path of its own, no scroll restoration and no place in the navigation. The app already keeps the page in the path and the view in the query string, and the project filter already travels between pages, so a page fits what is there.

## What Changes

- **Project page.** A new page at `/project?project=<name>`, with the shared range, source and automated filters. It shows one project across the dashboards, each block with a link to its page filtered to the project:
  - *Summary*: estimated cost, sessions, tokens, cache hit, subagent share, cost per commit, errors per 100 calls and error loops, and the sessions active now.
  - *Cost*: the change against the previous period, cost per day over both periods, and models by estimated cost.
  - *Sessions*: the most expensive sessions, which open in the session sheet.
  - *Errors*: the error rate and the top error types with their change.
  - *Context*: starting context, its share of the window, tokens added per prompt and turns to the first compaction.
  - *Insights*: how many sessions `/insights` analysed, their outcomes and the top friction.
  - *Limits*: the project's share of each open window that lists it, and its commits per percentage point.
- **No new endpoint.** The page reads the payloads the other pages already ask for, with the project as the filter, so the figures are the ones those pages show and their caches are shared.
- **Entry points.** The project sheet gains "Open project page"; the project name in the navigation's filter chip links to the page; the palette opens it with `>project` when a project is set. The sheet stays the quick look from a row.
- **Not a navigation tab.** The page needs a project, so it has no tab; no tab is marked current on it.
- Without a project the page has nothing to show: `/project` with no project opens Activity, and so does clearing the project while on it.

## Capabilities

### New Capabilities
- `project-page`: the Project page: its route and filters, its blocks and where each figure comes from, its links to the other pages, the sheets it hosts, how it is reached, and what it shows for a project with no use in the view.

### Modified Capabilities
- `dashboard-app`: the served routes include `/project`.
- `command-palette`: `>project` opens the Project page for the project in the palette's chips or the current view.

## Impact

- `src/ai_ledger/app.py`: `/project` in `PAGES`. No payload change, so no fixture is regenerated.
- `web/src/pages/project/`: the page, its blocks, a `project.ts` of pure helpers, styles and tests.
- `web/src/App.tsx`, `web/src/router.tsx`: the route, its title, its loader and the redirect without a project.
- `web/src/components/sheets/ProjectSheet.tsx`: the "Open project page" action; `ChangeDetail` exported for reuse.
- `web/src/components/Nav.tsx`: the chip's project name becomes a link; no tab is current on `/project`.
- `web/src/components/palette/`: the `>project` suggestion and its resolution.
- `src/ai_ledger/web/` is rebuilt.
- Tests: `tests/test_app.py` (the route), page, router, nav, sheet and palette tests in `web/src`.
- `README.md` ("What you get") and `CHANGELOG.md` (`[Unreleased]`).
- Out of scope: a wide mode for the session and tool sheets (its own change), a list of all projects, and any new metric.
