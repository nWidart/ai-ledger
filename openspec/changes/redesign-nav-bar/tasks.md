# Tasks

Each group lists the model it suits. Groups 2 and 3 can run in parallel: they touch different files. Group 4 needs group 3, group 5 needs groups 2 and 4, and group 6 needs group 5. All four edit `Nav.tsx`.

## 1. Prepare (lead)

- [x] 1.1 Wait for `respect-text-size` to merge into `main`, then rebase `feat/nav-bar-redesign` onto `origin/main`. Verify that `git merge-base --is-ancestor origin/main feat/nav-bar-redesign` succeeds and that `cd web && npm run check` passes.

## 2. Freshness state in `refresh.ts` (Opus)

- [x] 2.1 Extend `RefreshState` with `kind`, `at`, `inserted`, `changedAt`, `interval` and `error`, keeping `text`. Add the Stale rule: older than 3 × interval, judged at `dataUpdatedAt`. Verify with new `queryClient.test.ts` cases for idle, busy, stale (at 5 min with a 60 s interval), not stale (at 70 s), failed, offline and retry, and the existing order: a running or failed manual refresh wins.
- [x] 2.2 Add the "+N lines" flash store beside `seen`: set it on a new `last_change`, or on a refresh answer with inserted > 0, and clear it after 4 s. Verify with fake-timer tests: shown at 5 lines and gone after 4 s, nothing for 0 lines, and nothing for the first status after load.
- [x] 2.3 Add the manual refresh result message: "Refreshed: N new lines", "Refreshed: nothing new", or the failure text. Set it on success or error and clear it when the next refresh starts. Verify with tests that a timed poll never sets it.

## 3. Project link and clear button move to the filter row (Opus)

- [x] 3.1 In `Filters.tsx`, with a project set, render a "Project page" link named "<project> project page" next to the picker (not on `/project`), and a "Clear project filter" button that clears `project` and `session` and focuses `#fProject`. Style both in `Filters.css`, phones included. Verify with `Filters.test.tsx` cases for the link's name and target with range and source kept, no link on `/project` or without a project, clear keeping focus on the picker, and clear on `/project` opening Activity.
- [x] 3.2 Remove the project chip (`#navFilter`, `.appnav-go`, `clear()`) from `Nav.tsx` and its rules from `Nav.css`. Move the `router.test.tsx` and `Nav.test.tsx` chip assertions to the filter-row link. Verify with `npm run check`.
- [ ] 3.3 Update `tools/demo/record.mjs` to click the filter-row link instead of `.appnav-go`. Verify that the script runs to the end against the demo store.

## 4. Search button shows the project (Sonnet)

- [x] 4.1 With a project set, show the project dot and the name, truncated in `ch` with an ellipsis, in place of "Search". Set the `aria-label` to "Search in <project>, open command palette (<shortcut>)" and the title to the full name. Keep the dot in the icon-only state. Verify with `Nav.test.tsx` cases for the name with and without a project, the dot present, and "Search" visible with no project. Verify with `Palette.test.tsx` that "click Search" still finds the button by its name.

## 5. Freshness control in the nav (Opus)

- [ ] 5.1 Replace `#navStatus` and the Refresh button with the split control: `#navRefresh`, icon-only, showing "Retry" as text on failure, and keeping `aria-disabled` while busy; and a `Toggletip` whose label is the state text ("8:00 PM", "Ingesting…", "Stale · 8:00 PM", "Failed", "Offline"), with the details popup and the "+N lines" flash. Verify with `Nav.test.tsx`: each state's visible text; details showing the exact time, lines, last change, interval and error; Escape keeping focus; Refresh focusable while busy; Retry flow unchanged.
- [ ] 5.2 Remove `aria-live` from the time. Add the separate `role="status"` region for the refresh result, keep the limits alert region as it is, and mark the flash `aria-hidden`. Verify with tests: a timed poll changes no live region text, a manual refresh sets the result once, and the limits region is unaffected.
- [ ] 5.3 Style the split control: one border, critical color for Failed, Offline and Retry, warning color for Stale, flash fade only under `prefers-reduced-motion: no-preference`, and forced-colors borders. Verify with contrast checked against `--surface-1` in both themes (3:1 for borders, 4.5:1 for text), and by inspecting the control at 1000px in both themes.

## 6. One row and the page chooser (Opus, Fable 5.2 if focus or layout bugs persist after one attempt)

- [ ] 6.1 Extract the tab links into a shared `PageLinks` that renders the same `Link`s, with preload, `go()`, the Limits dot and its hidden alert text, for both the tabs and the chooser. Verify that the existing tab, preload and alert tests pass unchanged.
- [ ] 6.2 Add the page chooser: a Base UI `Popover`, disclosure semantics, a trigger named for the current page or "Pages", with "Limits alert" and the dot while an alert is present. Close without returning focus on a link pick, return focus on Escape, and overlay without changing the nav's height. Verify with tests for:
  - a keyboard pick landing focus on `#lede`;
  - Escape returning focus to the trigger;
  - a Cmd-click leaving the page as it is;
  - "Pages" and no current link on `/project`;
  - the dot and the trigger name with an alert;
  - `--appnav-h` unchanged when the chooser opens.
- [ ] 6.3 Replace the phone `@media` block with the `rem` steps: wordmark, Search to icon, tab padding, then the chooser with the time hidden. Set `.appnav-in` to `flex-wrap: nowrap`. Measure the real bar against a copy of the store at 1280, 1000, 800, 640, 390 and 320px, at 100% and 200% zoom, and set the breakpoints from those measurements. Verify that the bar is one row with no sideways scroll at every width measured, and that a test asserts `nowrap`.

## 7. Docs, fixtures and build (Sonnet)

- [ ] 7.1 Update `README.md`: navigation, freshness control and Project page link. Re-record the README GIFs with `tools/demo/`. Verify that the README describes the new bar and that the GIFs show it.
- [ ] 7.2 Add the user-visible changes to `[Unreleased]` in `CHANGELOG.md`. Verify that the entry names the moved project link, the freshness control, the page chooser and the Search scope.
- [ ] 7.3 Regenerate the page-test fixtures if any payload moved (none expected): `uv run python -m unittest tests.test_web_fixtures`. Rebuild and commit `src/ai_ledger/web/`. Verify that `uv run python -m unittest tests.test_web_build` passes.

## 8. Integration (lead)

- [ ] 8.1 Review the whole diff against the specs. Run `cd web && npm run check`, `uv run ruff check`, `uv run python -m unittest discover -s tests` and `openspec validate --specs --strict`. Verify that all four pass.
- [ ] 8.2 Walk the flows on a copy of the store (`uv run ai-ledger --db <copy> --port <free port>`) in both themes:
  - page switches from tabs and from the chooser;
  - Refresh, Retry, Stale (by stopping ingest), Offline (by stopping the app);
  - a project filter set and cleared;
  - a limits alert on a phone width;
  - a screen reader pass on the chooser and the refresh result.

  Verify that every flow behaves as the specs say.

## Workflow follow-up

- Open a PR from `feat/nav-bar-redesign`, then archive the change in its worktree after merge and remove the worktree.
