# Tasks

Group 1 has no dependency. 2 needs 1. 3 needs 2 (it links to the page). 4 needs 2 and 3.

## 1. Route and shell

- [x] 1.1 `src/ai_ledger/app.py`: add `/project` to `PAGES`. Verify in `tests/test_app.py`: `GET /project?project=foo` serves the page.
- [x] 1.2 `web/src/App.tsx`: add `/project` to `ROUTES` (title "Project · AI Ledger", lazy `pages/project/ProjectPage`). `web/src/router.tsx`: the route with `viewLoader(v => queries.usage(v))` and a `beforeLoad` that redirects to `/usage` (search kept, `replace`) when `parseView(search).project` is empty (design D2).
- [x] 1.3 `pages/project/ProjectPage.tsx`: `main#content`, `h1` with `ProjectName`, `Filters` (project picker, range, source, automated), the empty state for a project with no use, and `UsageSheets` with the usage payload. Use `useLanding` and the page skeleton as the other pages do.
- [x] 1.4 Router tests: `/project?project=foo` shows the page; `/project?range=7` lands on `/usage?range=7`; clearing the project on the page lands on `/usage` with range and source kept, and Back does not return to `/project` without a project; the Cost tab from the page keeps the project.

## 2. Blocks

- [x] 2.1 `components/sheets/ProjectSheet.tsx`: export `ChangeDetail`. No behavior change.
- [x] 2.2 Summary, Cost and Sessions blocks from `queries.usage` (design D4.2 to D4.4), with the "active now" line from `queries.liveList`. Verify against `__fixtures__/usage.ts`: the eight facts equal the project sheet's for the same payload; a session row opens the session sheet; all time shows no change.
- [x] 2.3 `pages/project/project.ts`: `errorsBlock(model, view)` returning errors, rate and the top five `typeRows` under Errors' default view for the project, range and source; `limitsBlock(payload, project)` returning the open-window rows and commits-per-point rows, or null when both are empty. Unit tests for both, on `__fixtures__/errors.ts` and `__fixtures__/limits.ts`, including the equality with `typeRows` and the null case.
- [x] 2.4 Errors block: figures, type rows linking with `errorsHref`, the automated note, the no-errors state.
- [x] 2.5 Context block from `queries.context`, with `totals.near_limit` from usage; a null figure reads "n/a".
- [x] 2.6 Insights block from `queries.insights`: coverage, outcomes as `Ledger` rows, top three friction families, the model-judged tag, the nothing-analysed line.
- [x] 2.7 Limits block from `queries.limits`, left out when `limitsBlock` is null.
- [x] 2.8 Every block: its own loading placeholder and its own error with Retry; a heading link "Open in <Page>" with the shared view through `appLink`. Page test: one failing query leaves the other blocks drawn.
- [x] 2.9 `pages/project/project.css`, with the tokens and grid of the other pages; check light, dark and forced colors, and a 390px viewport.

## 3. Entry points

- [x] 3.1 Project sheet: "Open project page" in `.actions`, before "Open its errors". Sheet test: it navigates to `/project` with the sheet's project and the page's range and source, with `inspect` cleared.
- [x] 3.2 `Nav.tsx`: the chip's project name is a link to `/project` + shared search, `aria-current="page"` on `/project`; no tab is current there. Nav test for both.
- [x] 3.3 Palette: `suggest.ts` offers a "Project" page (texts `project`) only when a project chip or the view's project is set; `resolve.ts` resolves it to `/project` and adds `/project` to `HOSTS_SHEETS`. Tests for the three scenarios of the command-palette delta.

## 4. Ship

- [x] 4.1 `README.md` ("What you get") and `CHANGELOG.md` (`[Unreleased]`).
- [x] 4.2 `cd web && npm run check`, commit the rebuilt `src/ai_ledger/web/`; `uv run ruff check`; `uv run python -m unittest discover -s tests`; `openspec validate --specs --strict`.
- [ ] 4.3 Run against a copy of the real store (`uv run ai-ledger --db <copy> --port <free port>`): compare each block's figures with its page for two projects and two ranges.
