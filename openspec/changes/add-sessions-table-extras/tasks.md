# Tasks

Each group is one pull request that ships alone. Groups 1, 2 and 3 share no file and can run in parallel; 4, 5 and 6 follow in order (they all edit `SessionsPanel.tsx`). The model tier and the risk of each group are in `design.md`, decision 5. Every web group ends with `cd web && npm run check`.

## 1. Column chooser (Opus)

- [ ] 1.1 Add the stored choice (`ai-ledger-sessions-columns`: id to boolean, `false` hidden, `true` kept, no entry automatic) in `pages/activity/`, read once with `try/catch`, unknown ids and non-boolean values dropped. Verify with a unit test: round trip, unreadable JSON, unknown id, blocked storage keeps the choice in memory.
- [ ] 1.2 Declare the three hide widths once in TypeScript and read which priorities the window hides with `matchMedia` and `useSyncExternalStore`. Verify with a test that the widths equal the `max-width` values of the `opt2`, `opt1` and `opt` rules in `activity.css`.
- [ ] 1.3 Build the Columns button and its popover (Base UI `Popover`, a dialog named "Columns", one `label.chk` checkbox per column except Session in table order, "Reset columns", "Columns, N hidden" on the button). Verify with `ActivityPage.test.tsx`: opens with focus inside, Space toggles and the list stays open, Escape closes and returns focus to the button, the list has the 12 columns and no Session.
- [ ] 1.4 Apply the choice in `SessionsPanel`: pass `Table` the columns that are not hidden, add `keep` to kept columns, and tick a box when its column shows now (decision 1.4). Add `keep` to the rule that shows `sorted` in `activity.css`. Verify with `ActivityPage.test.tsx`: unticking removes the header and cells; with a mocked narrow `matchMedia`, Tokens reads unticked and ticking it adds `keep`; untick then tick on a wide window leaves no stored entry; reload restores the choice; Reset clears the key.
- [ ] 1.5 Keep a sorted column shown and take a hidden column out of the sort (decision 1.5), with today's single sort. Verify with `ActivityPage.test.tsx`: with Tok/s hidden, the Output speed vital shows it sorted and it hides again when the sort moves; unticking the sorted column asks `/api/sessions` with no `sort`.
- [ ] 1.6 Check 390, 1000 and 1440px on the demo store, light and dark: the tools row wraps, the popover stays in the viewport and scrolls, no sideways page scroll. Verify `css.test.ts` passes with no new allow-list entry.
- [ ] 1.7 Document the chooser: `README.md` (Activity row), `site/src/content/docs/pages/activity.mdx` (Sessions controls), a Columns section in `site/src/content/docs/everywhere/data-tables.md` (write site content with the `doc-coauthoring` skill), and `CHANGELOG.md` `[Unreleased]`. Verify with `cd site && npm run check`.

## 2. Sort list on the server (Sonnet)

- [ ] 2.1 Parse `sort` in `metrics.session_list` as one to three comma-separated keys with a leading `-` for descending; keep `sort=<key>&desc=1`; raise `ValueError` for an unknown, repeated or empty key, more than three keys, and `desc` beside a list or a `-` key. Verify with `tests/test_metrics.py`: each refusal, and `sort=cost&desc=1` equals `sort=-cost`.
- [ ] 2.2 Order the list its own way with the session id as the last tie-break, then apply one stable sort per key from the last to the first, rows with no value last for that key. Verify with `tests/test_metrics.py`: two and three keys in both directions, a no-value row under the second key, ties in the list's order then by session id, and pages of a fully tied list holding every session once.
- [ ] 2.3 Verify through the HTTP handler that `/api/sessions?sort=-tokens,cost` answers the ordered rows and `sort=cost,cost` answers 400 (`tests/test_metrics.py`, beside the existing `/api/sessions?sort=tokens&desc=1` test). Run `uv run ruff check` and `uv run python -m unittest discover -s tests`.
- [ ] 2.4 Add the endpoint's new `sort` form to `CHANGELOG.md` `[Unreleased]`. Verify the entry names the list form, the cap and that the earlier form still works.

## 3. Sort list in `Table` (Opus)

- [ ] 3.1 Add `nextSort(list, key, descFirst, add, max)` to `components/Sort.tsx` (decision 2.4 and 2.3). Verify with `Sort.test.tsx`: replace, reverse the only key, add, reverse an added key, remove on the third press, replace the last key at the cap, empty list after removing the only key.
- [ ] 3.2 Let `SortTh` draw a rank and a later key: the arrow with its rank when the sort has several keys, the visually hidden ", sort N of M[, direction]" in the button's name, `aria-sort` on the first key only, and Shift reported on a press (default prevented on a Shift mousedown). Verify with `Sort.test.tsx`, and that a single sort draws the same markup as before.
- [ ] 3.3 Give `Table` the list form of `sort` (`readonly SortBy<K>[]`, `onSort(list)`, `sortAdd`, `sortMax`) beside the single form (decision 2.8). Verify with `Table.test.tsx`: headers marked for two keys with one `aria-sort`; rows sorted in the browser by two keys, no-value rows last per key; `onSort` gets the next list on a press, on Shift and with `sortAdd`; `manualSort` leaves the rows; the type refuses a list without its `onSort`; every existing test passes unchanged, the DOM comparisons included.
- [ ] 3.4 Run the whole web suite and confirm no other table's markup changed: `cd web && npm run check` passes with no snapshot or DOM assertion edited outside `Sort.test.tsx` and `Table.test.tsx`.

## 4. Multi-sort on Sessions (Opus)

- [ ] 4.1 Send the sort list: `sessionsUrl` and `queries.sessionPages` take a list of keys, sending today's `sort=<key>&desc=1` for one key and `sort=-a,b` for several. Verify with a unit test of `sessionsUrl` and that the existing one-key URL assertions in `ActivityPage.test.tsx` pass unchanged.
- [ ] 4.2 Hold the Sessions sort as a list in `ActivityPage` (the near-limit and chart actions empty it, the Output speed vital sets output speed alone) and pass `Table` the list form; make Session an ordinary sortable column (drop its custom header). Verify with `ActivityPage.test.tsx`: the existing sort tests pass, and the actions clear a two-key sort.
- [ ] 4.3 Add the "Sort by several columns" checkbox to the tools row and pass it as `sortAdd`. Verify with `ActivityPage.test.tsx`: ticked plus Enter on a header adds a key and keeps focus; Shift-click adds with the box unticked; a third press removes; a fourth column replaces the third; an unticked press sorts by one column; the request URL holds the list.
- [ ] 4.4 Say the whole order in the hint and keep every sorted column shown, the chooser's rule included for each key. Verify with `ActivityPage.test.tsx`: "…, costliest first, then most prompts first."; each key's cells carry `sorted`; unticking a second key's column removes that key only.
- [ ] 4.5 Check with a screen reader on the demo store that a two-key sort reads one sorted header and the rank and direction of the other, and at 390px that three sorted columns show and the region scrolls sideways.
- [ ] 4.6 Document multi-sort: `README.md`, `activity.mdx` (Sessions controls: several columns, the cap, Shift), the Sorting section of `data-tables.md`, `keyboard-screen-reader.md` (Tables), `CHANGELOG.md`. Verify with `cd site && npm run check`.

## 5. Selection (Opus)

- [ ] 5.1 Make `pickRow` ignore clicks inside `a, input, label` (`components/sheets/session.ts`). Verify with `Table.test.tsx`: a checkbox and a label in a pick row do not open it, a plain cell and the row's button still do; and confirm by search that no other pick row holds an input or a label.
- [ ] 5.2 Hold the selection in `ActivityPage` as a map from session id to its row, in the order selected, cleared when the project, range, source, automated toggle, day or week changes. Verify with `ActivityPage.test.tsx`: it survives a tab change, Show more, a sort, a search and a refresh; a range change and a chart day clear it.
- [ ] 5.3 Add the selection column to Sessions (first column, `rowHeader: false`, a label filling the cell, the checkbox named "Select {session}", a hidden "Select" header, a class on selected rows; Session becomes the row header explicitly). Verify with `ActivityPage.test.tsx`: a click and Space select without opening a sheet or changing the URL; the cost cell still opens the sheet; the session cell is still the row header; a fifth checkbox is disabled at four selected.
- [ ] 5.4 Add the selection bar (count as a polite status, "Select 1 more to compare." at one, the four-session note at four, Clear selection moving focus to the search field). Verify with `ActivityPage.test.tsx`, and that the bar and Clear work while the rows are stale.
- [ ] 5.5 Check 390px on the demo store: the selection column shows, the label target is at least 24px, no sideways page scroll; `css.test.ts` passes with no new allow-list entry.
- [ ] 5.6 Document selection: `activity.mdx` (Sessions controls), a Selection section in `data-tables.md`, `keyboard-screen-reader.md`, `CHANGELOG.md`. Verify with `cd site && npm run check`.

## 6. Comparison (Opus)

- [ ] 6.1 Build the comparison as a `Table` named "Session comparison": figures as rows (Project, Start, then the Sessions figures in table order, each reusing the column's own `cell` and `cellProps`), one column per selected session with a custom header (the session's name as a button that opens its sheet, and "Remove {name} from the comparison"). Verify with a component test: scopes, names, formats equal to the Sessions cells, a hidden column still has its row.
- [ ] 6.2 Add Compare to the bar from two sessions on, as a disclosure (`aria-expanded`, `aria-controls`) that keeps focus and shows the comparison between the bar and the table; draw each session from its current row when the list holds it, else from the held row. Verify with `ActivityPage.test.tsx`: opens and closes; a fourth ticked row adds a column; a refresh updates a listed session's figures; a session a search leaves out keeps its figures.
- [ ] 6.3 Handle removal and focus: Remove unselects and moves focus to the next Remove button, else the previous; under two sessions the comparison closes and focus goes to Clear selection; closing a sheet opened from a name returns focus to it. Verify with `ActivityPage.test.tsx`.
- [ ] 6.4 Show missing values: "–" as the table does, the note under the comparison when a compared session records no model time, and the whole-session toggletip on Model, Tok/s, Peak context and Compactions on a selected day. Verify with `ActivityPage.test.tsx` using a Codex row, a Grok row with model time and an unpriced row.
- [ ] 6.5 Check 390 and 1440px on the demo store: four sessions scroll inside the comparison's region at 390px and fit at 1440px; light and dark; `css.test.ts` passes.
- [ ] 6.6 Document the comparison: `README.md` (Activity row), `activity.mdx` (a Compare sessions part under Sessions, with what it leaves out), `data-tables.md`, `CHANGELOG.md`. Verify with `cd site && npm run check`.

## 7. Integration (Sonnet)

- [ ] 7.1 Run every check on the merged work: `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `cd site && npm run check`, `openspec validate add-sessions-table-extras --strict`. Verify all pass.
- [ ] 7.2 Walk the three extras together on a copy of a real store (`uv run ai-ledger --db <copy> --port <free port>`, never the live store): hide two columns, sort by three, select four, compare, load more, search, refresh, change the range. Verify each scenario of the spec delta that names more than one extra ("Hide a sorted column", "Three keys on a phone", "Sort while loading", "A phone").
- [ ] 7.3 Confirm no other table changed: open Cost, Context, Errors, Limits and the Project page and compare their tables with `main` at 1440px and 390px. Verify no visible difference.

## Workflow follow-up

- Sync the spec delta into `openspec/specs/usage-dashboard/spec.md` and run `openspec validate --specs --strict`.
- Archive the change in its worktree once every group has merged and the review requirements are met, then remove the worktree.
