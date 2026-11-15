# Design

## Context

The app is one React app with a route per page (`web/src/router.tsx`, `App.tsx`'s `ROUTES`). The view is the query string: `project`, `range`, `source`, `auto` are shared and travel between pages (`url.ts`). Each page reads one payload through `queries.ts`, keyed by the view, and Query keeps it between visits. The project sheet (`components/sheets/ProjectSheet.tsx`) reads `queries.usage` with the project as the filter.

Every payload the overview needs already takes the project:

| Block | Query | Project scope |
| --- | --- | --- |
| Summary, Cost, Sessions | `queries.usage(v)` | server-side filter |
| Errors | `queries.errors` (one key for every filter) | client-side, `pages/errors/model.ts` |
| Context | `queries.context(v)` | server-side filter |
| Insights | `queries.insights(v)` | server-side filter |
| Limits | `queries.limits(v)` | `value.projects` filtered; `windows[].used.projects` is the top three of every project |
| Active now | `queries.liveList(v)` | server-side filter |

## Goals / Non-Goals

**Goals**
- One page that answers "how is this project doing?" with figures equal to those of the other pages.
- A link from every block to its page, filtered to the project.
- No new backend query and no payload change.

**Non-Goals**
- New metrics, a projects index, a comparison of projects.
- Replacing the project sheet or the project filter.
- A wide sheet for sessions and tools.

## Decisions

### D1. A page at `/project`, with the project in the query string
`/project?project=foo&range=30`. The project stays the shared `project` key, not a path segment, so the tabs, the filters, the palette and `setSearch` work unchanged: from the Project page, the Cost tab opens Cost filtered to the project.

Rejected: `/project/<name>` (a second place for the project, and every link and the nav's carry-over would need to translate between the two); a centered modal (no path, no Back target, no scroll restoration, and it stacks badly with the session sheet).

### D2. No project, no page
The route's `beforeLoad` redirects to `/usage` with the search kept when the validated view has no project, as unknown paths do. It runs on every navigation, so clearing the project on the page (the chip's ✕, the picker's "All projects") lands on Activity. The redirect replaces the entry.

A project with no use in the view is not an error: the page shows its heading and filters, and says there is no use in this view.

### D3. Compose the existing queries
The page calls the six queries above. Reasons: the figures cannot drift from the other pages; a visit warms the caches the tabs then use, and the other way round; no Python, no fixture change.

Cost: up to six requests on a cold visit. They run in parallel, each block draws when its own lands, and a failed block shows its own error with Retry without blocking the others. The route's loader prefetches `queries.usage` only, the query above the fold.

Rejected: a new `/api/project` payload. It would duplicate six queries' SQL or call them all server-side, and every figure would need a parity test against its page.

### D4. Blocks and their figures
In page order. Each block's heading carries a link "Open in <Page>" to that page with the shared view (`sharedSearch`), through `appLink`.

1. **Heading and filters.** `h1` is the project name with its dot (`ProjectName`). `Filters` with the project picker, range, source and automated toggle. Picking another project stays on the page.
2. **Summary.** The eight facts of the project sheet, through `Facts`. Under them, when `liveList` has sessions: "N sessions active now", a link to Live. Hidden at zero and while loading.
3. **Cost.** `ChangeDetail` (exported from `ProjectSheet.tsx`), then `ModelLedger` with `by="cost"`. All-time view: no change block.
4. **Sessions.** The eight most expensive (`top_sessions`), the sheet's table; a row opens the session sheet.
5. **Errors.** From `makeModel` and `filtered`/`typeRows`/`compare` of `pages/errors/model.ts`, with Errors' default view for this project, range and source (`DEFAULT_VIEW`: day granularity, subagents in, noise shown): errors, error rate, and the top five types with count, rate and change. A type links to Errors on that type (`errorsHref`). The Errors page always counts automated sessions; the block says so when the automated toggle is off.
6. **Context.** `starting.median`, `starting.window_share`, `growth.added_per_prompt`, `growth.to_compaction.turns`, and `totals.near_limit` from usage.
7. **Insights.** `coverage.analysed` of `coverage.claude_sessions`, `outcomes` as ledger rows, the top three `friction_families`. Tagged model-judged as on Insights. With no analysed session: one line saying so, with the link.
8. **Limits.** Per open window whose `used.projects` names the project: its share and points. Per limit in `value.projects`: commits per point. The block is left out when both are empty.

Pure derivations (the errors view, picking limit rows) live in `pages/project/project.ts` with unit tests; the blocks are thin.

### D5. Sheets
The page mounts `UsageSheets` with the usage payload, so the session, tool and project sheets open over it as on Activity. `resolve.ts`'s `HOSTS_SHEETS` gains `/project`.

### D6. Entry points
- Project sheet: an "Open project page" link in its actions, before "Open its errors". It navigates to `/project` with the sheet's project and the page's range, source and automated toggle, and closes the sheet.
- Navigation chip: the project name is a link to `/project` with the shared view. On `/project` it is the current page (`aria-current="page"`).
- Palette: one more page suggestion, "Project", offered only when the palette's chips or the current view name a project. `>project #foo` opens `/project?project=foo`.
- Project names in tables keep opening the sheet: the sheet is the quick look, the page the full view.

### D7. Not a tab
`PAGES` in `Nav.tsx` is unchanged, so the tabs and the palette's page list keep their seven entries. `ROUTES` gains `/project` with the title "Project · AI Ledger". The server's `PAGES` gains `/project`.

## Risks / Trade-offs

- **Six requests on a cold visit** → parallel, cached, each block independent; the errors payload is the one the Errors tab loads anyway.
- **Errors counts automated sessions, the other blocks follow the toggle** → the block states it, as the palette spec already does for its error counts.
- **Limits shows only the top three projects of a window** → the block is silent for a project outside them rather than showing a wrong zero.
- **A redirect in `beforeLoad` on a search change** → covered by a router test: clearing the project on `/project` lands on `/usage` with range and source kept, and Back does not return to a project-less `/project`.

## Open Questions

None blocking. A projects index and a session page are possible later changes.
