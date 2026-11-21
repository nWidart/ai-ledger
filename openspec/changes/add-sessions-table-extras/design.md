# Design

## Context

See `proposal.md` for the motivation. What the code does today, and what constrains the design:

- **`Table`** (`web/src/components/table/Table.tsx`) draws native `<table>` markup from a `columns` array. It maps that array itself for the head, the cells, the `colgroup` and the empty row; TanStack Table only sorts the rows. Its `sort` prop is one `SortBy` (or null) with `onSort`; `manualSort` leaves the rows in the order given and only marks the headers. `SortTh` (`components/Sort.tsx`) draws a sortable header and computes the next `SortBy` on a press.
- **Sessions** (`pages/activity/SessionsPanel.tsx`) has 13 columns: Session, Project and 11 figures. Project does not sort. Columns hide by width through classes: `opt2` under 78.75em (Tokens, Compactions), `opt1` under 66em (Model, Tok/s), `opt` under 43.75em (Active, Prompts, Failed, Commits, Tests). Est. cost and Peak context never hide. The sorted column carries `sorted`, which shows it at any width. The Session header is a custom `th` only to keep `sorted` off its cells.
- **The server sorts and pages.** `metrics.session_list` takes `sort` (one of `SESSION_SORTS`) and `desc`, orders the list its own way first (newest first; nearest the limit with `near`; costliest with `day`, all rows on one page), then applies one stable Python sort with no-value rows last. `app.py` turns a `ValueError` into a 400. Rows with the same `first_ts` have no tie-break: their order is whatever the SQL returned.
- **The rows go inert while stale.** A new query keeps the old rows on screen with `inert` on the `tbody`; focus moves to the search field first.
- **The page keeps the last answer while a new view loads.** `Overview` reads `/api/usage` with `keepPrevious` and gives `SessionsPanel` the scope of the response on screen (`d.project`, `d.range`, `d.automated`, `d.source`), not the URL's. Until the new response lands, the sessions query key does not change, so the earlier view's rows stay on screen and are not inert.
- **The handler drops a blank value.** `app.py` builds its parameters with `parse_qs(url.query)`, which leaves out a key with an empty value, so `sort=` reaches `session_list` as no sort. `parse_span` reads `days` with `keep_blank_values=True` for the same reason.
- **Rows open the sheet.** `pickRow` (`components/sheets/session.ts`) puts one click handler on the `tr`. It ignores clicks on links and during a text selection, and runs the pick with the row's first `button`. A checkbox in the row would toggle and open the sheet (left open on PR #168).
- **Where view state lives.** The URL holds what makes a view (project, range, source, tab, `q`, `near`, `day`, `week`) and every open sheet, sheets as pushed entries so Back closes them. Browser storage holds display preferences: the chart metric, Cost's hidden token kinds, the sheet width. Page state holds ways of reading a table: every table sort, the Sessions sort included ("The sort SHALL NOT be kept in the URL").
- **Guards.** `web/src/css.test.ts` allows no raw colors, only scale tokens for sizes, radii and spacing, and no new `:is(.pg-…)` page lists. At most two bars stick to the top.

## Goals / Non-Goals

**Goals:**

- Three extras on the Sessions table, each shippable alone.
- The smallest general addition to `Table`: nothing for the chooser and the selection, a list of sort keys for multi-sort.
- No change to what any other table draws.

**Non-Goals:**

- Virtual rows, a second table implementation, or TanStack's column or selection features.
- Column reordering or resizing; a sort, a selection or a comparison in the URL.
- New endpoints. The comparison reads the rows the list already holds.

## Decisions

### 1. Column chooser

**1.1 Every column but Session can be hidden.** Session is the row header and holds the row's button, the keyboard target of the row and the element `pickRow` hands to the sheet. The selection column (decision 3) is a control, not data, and is not offered either.

**1.2 A button that opens a list of native checkboxes.** "Columns" sits in the tools row after "Near context limit only". It opens a Base UI `Popover` (already used by `Toggletip` and the page chooser): a non-modal dialog named "Columns" with one `<label class="chk">` checkbox per column in the table's order, then "Reset columns". The trigger carries `aria-expanded`; focus moves into the list on open; Escape and an outside click close it and return focus to the button. The list stays open while boxes change.

Rejected:
- *A `role="menu"` of `menuitemcheckbox`.* It needs arrow-key roving and its own Space and Enter handling, and a menu is expected to close on a choice. Native checkboxes need no key handling and read their state on every screen reader.
- *The native `popover` attribute.* It gives light dismiss for free, but jsdom does not implement it, so the page tests could not open the list.
- *A sheet or a settings page.* Too heavy for twelve checkboxes, and it takes the table out of view while choosing.

**1.3 The choice is kept in browser storage.** Key `ai-ledger-sessions-columns`, a JSON object from column id to boolean: `false` hides the column, `true` keeps it shown at every width, no entry means automatic. Read once with `try/catch` as `sheetWide.ts` does; a blocked storage keeps the choice for the page view; unknown ids and non-boolean values are dropped on read.

Rejected:
- *The URL.* Which columns show is not part of the view: a shared link should open at the receiver's own columns, as the sheet width does. It would also add a key to every Activity link.
- *Page state only.* A chooser that forgets on reload is not worth its button.
- *Syncing across open tabs.* The chart metric does not; left out.

**1.4 A choice beats the width rule; no choice keeps it.** Each column is in one of three states:

| State | Stored | Drawn |
| --- | --- | --- |
| Automatic | no entry | With its `opt` class: the page CSS hides it by width, as today. |
| Hidden | `false` | Not in the `columns` array given to `Table`. |
| Kept | `true` | With class `keep`, which shows it at any width, as `sorted` does. |

A checkbox is ticked when the column shows now: it is in the sort, or kept, or automatic and not hidden by the width. Unticking stores `false`. Ticking stores `true` when the width hides the column now, and removes the entry otherwise, so hiding and showing a column on a wide window does not pin it on a phone.

The page needs to know which priorities the width hides now. The three widths are declared once in TypeScript beside the columns and read with `matchMedia` through `useSyncExternalStore`, as `ScopeBar`'s `useNarrow` does. A test reads `activity.css` and fails when its three `max-width` values differ from them. The CSS classes stay the mechanism that hides; the script only reads the width.

A kept column that does not fit makes the table wider than its box. The Sessions region already scrolls sideways and takes focus, so nothing new is needed.

Rejected:
- *Two states (hidden or not) with the width rule always applied.* On a phone the list would show Tokens ticked and not shown, and the user could not bring it back except by sorting.
- *Any choice turns the width rule off for the whole table.* Unticking one column at 390px would show the other eleven at once.
- *Reading `getComputedStyle` of each header when the list opens.* No duplicated widths, but jsdom applies no media queries, so the tests could not cover a narrow window.

**1.5 A sorted column always shows; hiding a column takes it out of the sort.** The Output speed vital sorts by Tok/s; if the user hid Tok/s the order would have no visible cause. So a column in the sort is drawn whatever its stored choice, and the choice applies again when the sort leaves it. Unticking a sorted column stores `false` and removes its key from the sort in the same step, so the box does what it says.

Rejected:
- *Disable the checkbox of a sorted column.* A disabled box is skipped by Tab and gives no reason.
- *Let a hidden column stay in the sort.* It breaks the rule the table already keeps for widths: the order on screen is explained by a header on screen.

**1.6 Reset.** "Reset columns" removes the stored key. It stays in the list and keeps focus. The button reads "Columns, N hidden" while N columns are hidden, so a missing column has a visible cause.

**1.7 `Table` needs nothing.** The panel passes a filtered `columns` array and sets `keep` through the column's `className`, as it sets `sorted` today. `Table` already draws head, cells, `colgroup` and the empty row from that array.

Rejected: *TanStack's `columnVisibilityFeature`.* `Table` does not draw through TanStack's column model, so the feature would add state and bundle weight to do what `columns.filter` does.

The chooser and the stored choice live in `pages/activity/`, not in `components/table/`: one table uses them, and the page CSS scopes their styles under `.pg-activity`.

### 2. Multi-sort

**2.1 The endpoint takes a list in `sort`.** `sort=-cost,prompts`: one to three keys, comma-separated, each from `SESSION_SORTS`, a leading `-` for descending. `sort=cost&desc=1` keeps its meaning: `desc=1` applies to one key without a `-`. The server answers 400 for an unknown key, a repeated key, an empty item, more than three keys, and `desc=1` beside a list or a `-` key. The parsing is in `metrics.session_list`, which already raises `ValueError` for an unknown sort.

A blank `sort=` is an empty key and answers 400, but `session_list` cannot see it: the handler's `parse_qs` drops a blank value, and `sort=""` is the function's "no sort" for its Python callers, which stays. So the handler tells the two apart, as `parse_span` does for `days`: it reads `sort` from `parse_qs(url.query, keep_blank_values=True)`, raises `ValueError` when the key is there with an empty value, and passes `""` only when the key is absent. An item left empty inside a value (`sort=cost,`) is refused by `session_list`. `desc=1` with no `sort` is ignored, as today.

Rejected:
- *Repeated parameters (`sort=cost&desc=1&sort=prompts`).* The handler reads one value per key, and pairing each `desc` with its `sort` depends on order.
- *`sort=cost:desc,prompts:asc`.* Longer, and a second way to say what `-` says. The leading `-` is a common convention.
- *Ignoring `desc` when it does not apply.* A caller would get an order it did not ask for, silently. The endpoint already answers 400 for every other bad value.

**2.2 Stable order, stable pages.** The list is first put in its own order with the session id as the last tie-break. Then one stable sort per key, from the last key to the first, each with the existing rule (rows with a value sorted, rows without one appended). Ties after the last key therefore keep the list's own order, as they do today, and two requests over the same data page the same way. The sort stays in Python: the rows' context share and run figures are computed there.

**2.3 Three keys.** After three, the hint sentence stops being readable and a fourth key almost never breaks a tie. At the cap, a new key replaces the last one: the first keys, which shape the list, stay.

Rejected: *Drop the first key at the cap* (TanStack's rule). It reorders the whole list when the user only wanted to refine ties.

**2.4 A checkbox and Shift add a key.** "Sort by several columns" is a `<label class="chk">` checkbox in the tools row, off on load, kept in the panel's state. While ticked, a header press adds the column as the last key in its first direction; a second press reverses it; a third removes it. Shift with a press (click, or Shift+Enter) does the same with the box unticked. Without either, a press sorts by that column alone: it reverses the column when it is the only key, else starts it in its first direction. Removing the last key returns the list to its own order.

The checkbox is the way for keyboard, touch and screen reader users; Shift is the pointer shortcut. The sort button prevents the default of a Shift mousedown so a Shift-click does not extend a text selection.

Rejected:
- *Shift-click alone.* Not available on touch, and not discoverable.
- *An "add to sort" button in every header.* Twelve more tab stops in a header row that already holds toggletips.
- *A sort editor (a popover of selects for column and direction).* A second place to do what the headers do, and the most to build.

**2.5 Headers.** ARIA asks for `aria-sort` on one header per table. The first key's header carries it. With several keys, each sorted header shows its arrow and rank ("↓1", "↑2", hidden from assistive technology) and its button's name ends with visually hidden text (class `sr`): ", sort 1 of 2" on the first, ", sort 2 of 2, descending" on the others. With one key the markup is today's, byte for byte, so the tests that compare `Table` with `SortTh` and with hand-written tables keep passing.

Rejected: *`aria-sort` on every sorted header.* It goes against the ARIA advice, and screen readers give no order between them.

**2.6 The hint says the order.** The panel's `ORDER` table already has a phrase per key and direction. The hint joins them: "250 sessions, costliest first, then most prompts first." It is the existing polite live region, so a sort change is announced with no new region.

**2.7 The page URL holds no sort.** The Sessions sort stays page state, as decided in `improve-activity-ux` ("a way of reading a table, not a view to share") and as the spec says. So there is no page URL shape to design; the backward compatibility is the API's (2.1). The app sends today's request for one key (`sort=cost&desc=1`) and the list form for several, so one-key requests, their cache keys and their tests do not change.

**2.8 `Table` takes a list of keys.** The `sort` prop gains a second form beside today's:

```ts
type TableSort<K> =
  | { sort: SortBy<K> | null; onSort: (s: SortBy<K>) => void }                      // today, unchanged
  | { sort: readonly SortBy<K>[]; onSort: (s: SortBy<K>[]) => void;
      /** A header press adds its column to the sort (the caller's checkbox); Shift does it whatever this says. */
      sortAdd?: boolean;
      /** The most keys; a key added beyond it replaces the last. Default 3. */
      sortMax?: number }
  | { sort?: undefined; onSort?: undefined };
```

An array selects the new form. `Table` computes the next list with one pure function in `Sort.tsx`, `nextSort(list, key, descFirst, add, max)`, tested on its own, and hands it to `onSort`. `SortTh` gains what it needs to draw a rank and to report Shift; its single-sort output does not change. A custom header cell still receives the first key as `sort`. Without `manualSort` the list sorts in the browser too: TanStack's `SortingState` is already a list.

Rejected:
- *Leave `Table` alone and let the panel draw custom headers for every column.* The rank mark, the name and the Shift handling would live outside the shared header.
- *TanStack's own toggle handler.* It would route every table's header press through TanStack and bring its cap rule (2.3).

The Session column becomes an ordinary sortable column: its custom `th` goes. `sorted` on a session cell has no effect, since that column has no `opt` class.

### 3. Selection and compare

**3.1 A checkbox column, first in the row.** Its cell is `<td><label><input type="checkbox" aria-label="Select {session name}"></label></td>`, the label filling the cell so a near miss still toggles the box and the target is at least 24px. Its header holds visually hidden "Select". The column is an ordinary `Column` with `rowHeader: false`; Session sets `rowHeader: true`. A selected row gets a class through `rowProps`. No `aria-selected`: it is not allowed on a row of a plain table, and the checkbox says the state.

**3.2 `pickRow` ignores form controls and labels.** Its guard becomes `closest("a, input, label")`. This is the fix asked for on PR #168, made where the click is handled, so any later control in a pick row is covered. The row's button is found as before (`querySelector("button")`): the checkbox is an `input`.

Rejected: *`stopPropagation` on the checkbox.* Every later control would need the same line, and the context menu and other row listeners would lose the event.

**3.3 No select-all; at most four.** Compare takes four sessions: four columns still read side by side on a laptop, and more stops being a comparison. Select-all over a paged list of hundreds has no use under a cap of four. At four, the other rows' checkboxes are `disabled` and the bar says why.

Rejected: *Enabled checkboxes that refuse a fifth.* A box that does not tick when pressed reads as broken.

**3.4 The selection is page state: held rows, stamped with their scope.** It lives in `Overview` beside `sessSort`, so it survives a tab change. It is `{ scope, rows }`: `rows` maps a session id to its row, in the order selected, and `scope` is the scope those rows were counted in.

A scope is six values: `project`, `range`, `automated`, `source`, and the selected `day` and `days`.

- *The requested scope* is the URL's: the view `Overview` already builds as `want` (`viewOf(h)`), and the URL's day or week.
- *The rows' scope* is the one the panel queried with: the `view` prop (the four values of the `/api/usage` response on screen) and the `day` and `days` of that query. Rows shown as placeholder data belong to an earlier query and have no scope.

`Overview` passes the panel the requested view beside the `view` it passes today. The panel compares `project`, `range`, `automated` and `source` of the two, each with `===`, and needs `isPlaceholderData` to be false. Its `day` and `days` already come from the URL, so they differ from the rows on screen only while those are placeholder data. When all of this holds, the rows are *in scope*. Three rules follow:

- **Read.** A selection whose `scope` is not the requested scope reads as empty. So a change of project, range, source, automated toggle, day or week clears it with no effect to run and nothing to race: the figures would be counted over other days or other sessions, and a comparison would mix scopes.
- **Write.** A tick is accepted only while the rows are in scope, and it stamps the selection with the requested scope. While they are not, the row checkboxes are disabled.
- **Refresh.** Whenever the rows are in scope, each selected session found among them replaces its held row (when the row object differs). The comparison draws from the held rows alone, so a session keeps its newest figures after a search or a sort moves it off the loaded pages.

The write rule closes a gap the read rule leaves. A range change empties the selection at once, but the earlier range's rows stay on screen, not inert, until the new `/api/usage` response lands (see Context). A session ticked then would carry the earlier range's figures into the new range's comparison. The refresh rule has the same guard for the same reason.

- The selection survives Show more, a sort, a search or near-limit change, a refresh, a tab change and a sheet: none of them changes a figure's scope.
- A selected session the list no longer shows stays selected. The bar counts it, and the comparison's Remove button or Clear selection unselects it.

Rejected:
- *Clear the selection in an effect when the view changes, with no scope on it.* It leaves the gap above, and a tick made in it lands after the clear.
- *Make the rows inert while `/api/usage` loads.* It closes the gap but changes what the table does today for every user: rows open their sheet during that load.
- *Draw each session from its loaded row, else from the row held at tick time.* A session that refreshed (0 to 2 commits) and then left the loaded pages would fall back to the older row and read 0 again.
- *TanStack's `rowSelectionFeature`.* Its state belongs to the rows the table holds; this selection must outlive them.
- *Ids only, figures fetched on demand.* It needs a new server parameter (`ids=`) or four heavy `/api/session` requests; see 3.6.

**3.5 The bar and the comparison are in the page, not in a sheet.** While a session is selected, a bar between the hint and the table shows the count (`role="status"`), "Compare" from two sessions on, and "Clear selection". Compare is a disclosure button (`aria-expanded`, `aria-controls`), as "Show data table" is: it shows a "Session comparison" table under the bar and keeps focus. The Sessions region scrolls inside its own 520px box, so the bar and the comparison stay close while the user ticks rows.

Rejected:
- *A sheet.* Every sheet in the app is named in the URL as a pushed entry, so Back closes it. A comparison sheet in the URL must load sessions the list may not hold (a reload, another filter), which needs the server work of 3.4. A sheet outside the URL would be the one sheet Back does not close. A modal also hides the rows while the user is still choosing them.
- *A bar stuck to the window.* The app keeps two bars at the top and none at the bottom, and a stuck bar can cover the focused row.
- *A drawer.* Drawers sit at the foot of a page, far from the table, and one closes when another opens.

**3.6 The comparison shows the list's figures.** One column per selected session, one row per figure, in the table's order: Project, Start, Active, Model, Tok/s, Prompts, Tokens, Est. cost, Peak context, Failed, Compactions, Commits, Tests. It is drawn by `Table` with the figures as rows, and each figure reuses the Sessions column's own `cell` and `cellProps`, so format, "bad" marks and titles cannot drift from the table. Hidden columns still have their row: the comparison is the place to read every figure.

The comparison uses each figure's scope from the Sessions list. Start is the session's actual start, and Active covers the whole session unless a day or week is selected. Model, Tok/s, Peak context and Compactions are whole-session figures. Prompts, Tokens, Est. cost, Failed, Commits and Tests count the view's range, or the selected days. No request is made. This is how `metrics.sessions()` builds a row (`s.first_ts`; `active_cte` clipped only with a day; the counts limited by the view), so the comparison never disagrees with the row beside it, and a session that starts before a 7-day view reads the same Start and Active in both.

Rejected: *The session detail endpoint.* It has more (tool time, lines changed, model mix, judgment) but every figure of it is whole-session, so the counts would differ from the table on a selected day or a short range, and it sends each session's full timeline.

**3.7 Headers, removal and focus.** Each session column's header is a custom `th` with the session's name as a `SessionCell` button (it opens the session sheet; the sheet returns focus to it) and a "Remove {name} from the comparison" button. Removing moves focus to the next column's Remove button, else the previous one's. Below two sessions the comparison closes and focus goes to Clear selection. Clear selection moves focus to the search field, as stale rows do.

**3.8 Left out of the first version.** A comparison link or URL key; more than four sessions; select-all and Shift range selection; marks for the best, worst or differing values; charts or timelines side by side; the sheet-only figures; export; a context menu or palette entry for "add to comparison"; a selection kept across a reload.

### 4. Cross-cutting

**4.1 Missing values.** A missing figure reads "–", as the table shows it (`usd`, `num` and the Model and Tok/s cells already do). When a compared session has no model time, one line under the comparison says: "– : the session records no model time (Codex and older Claude Code sessions)." The list rows carry no `source`, so the note cannot name the agent per column; the session sheet does. On a selected day, Model, Tok/s, Peak context and Compactions keep the table's "Whole-session figure" toggletip on their row header.

**4.2 Stale and inert.** Only the `tbody` goes inert, so the row checkboxes go with it. The tools row, the headers, the bar and the comparison stay usable: the comparison draws from held rows and needs no loaded page. Rows of an earlier view that are on screen and not inert (decision 3.4) keep opening their sheet; only their checkboxes are disabled.

**4.3 At 390px.** The tools row already wraps; the two new controls take their own lines. The popover uses fixed positioning with collision padding and a `max-height` with scroll. The selection column has no `opt` class. Sorted and kept columns show and the region scrolls sideways. The comparison is a `Table` in its own named scroll region.

**4.4 Styles.** New rules go in `activity.css` under `.pg-activity #sessions`, with theme colors and scale tokens. `keep` joins `sorted` in the one rule that shows a column at any width. The rank mark reuses `.sortmark` in `Sort.css`. No new allow-list entry in `css.test.ts`.

**4.5 Tests.**

- `tests/test_metrics.py`: two and three keys in both directions; no-value rows last per key; ties keep the list's order, then session id (two sessions with identical start timestamps: the list sorts on milliseconds); pages of a fully tied list hold every session once; the earlier form equals the list form; each 400. Through the HTTP handler: a list, a 400, and a blank `sort=` (400) beside an omitted `sort` (the default order).
- `Sort.test.tsx`: `nextSort` (replace, reverse, add, remove, cap); `SortTh` rank mark and name.
- `Table.test.tsx`: the list form marks headers, keeps one `aria-sort`, sorts in the browser by two keys, calls `onSort` with the next list, adds on Shift and on `sortAdd`; the single form draws the same DOM as before; a pick row with a checkbox does not open, a label neither, a plain cell still does.
- `ActivityPage.test.tsx`: the chooser (open, hide, storage, reset, blocked storage, unreadable value, focus return, narrow width through a mocked `matchMedia`, hide a sorted column, a vital shows a hidden column); multi-sort (checkbox, Shift, request URL, hint, cap, actions clear it); selection (no sheet, cap, survives Show more, sort, search and refresh, clears on range and day, bar, Clear focus; with the new range's `/api/usage` response held pending, the earlier rows' checkboxes are disabled and nothing enters the selection); comparison (figures and their scopes, "–" and its note, remove and focus, closes under two, opens a sheet; a refresh followed by a search that leaves the session out keeps the refreshed figures).
- A test that the TypeScript widths equal `activity.css`'s.
- By hand on the demo store at 390, 1000 and 1440px, light and dark, with a screen reader for the header names and the status.

**4.6 Docs.** `README.md` (the Activity row), `site/src/content/docs/pages/activity.mdx` (Sessions: Controls), `site/src/content/docs/everywhere/data-tables.md` (Sorting; new Columns and Selection sections), `site/src/content/docs/everywhere/keyboard-screen-reader.md` (Tables), and `CHANGELOG.md` `[Unreleased]`. Each feature's step updates them for that feature; site content is written with the `doc-coauthoring` skill.

### 5. Delivery

Seven steps, each one pull request that ships alone. Tiers are the project's: Sonnet for simple, well-defined work; Opus for standard building; Fable for a design choice that spreads.

| Step | Files | After | Tier | Risk |
| --- | --- | --- | --- | --- |
| 1 Column chooser | `pages/activity/` (`SessionsPanel.tsx`, new chooser and choice files, `activity.css`, tests), docs | – | Opus | Medium: the width rule read in two places |
| 2 Sort list on the server | `metrics.py`, `app.py` (the blank `sort`), `tests/test_metrics.py`, `CHANGELOG.md` | – | Sonnet | Low: exact rules, no payload change |
| 3 Sort list in `Table` | `Sort.tsx`, `Sort.css`, `Table.tsx`, their tests | – | Opus | High: every table draws through these |
| 4 Multi-sort on Sessions | `api.ts`, `queries.ts`, `SessionsPanel.tsx`, `ActivityPage.tsx`, tests, docs | 1, 2, 3 | Opus | Medium |
| 5 Selection | `sheets/session.ts`, `Table.test.tsx`, `SessionsPanel.tsx`, `ActivityPage.tsx`, `activity.css`, tests, docs | 4 | Opus | Medium: `pickRow` serves every pick row |
| 6 Comparison | new `Comparison.tsx`, `SessionsPanel.tsx`, `activity.css`, tests, docs | 5 | Opus | Low |
| 7 Integration | none (checks only) | 6 | Sonnet | Low |

Steps 1, 2 and 3 touch no common file and can run in parallel. Steps 4, 5 and 6 all edit `SessionsPanel.tsx` and run in order. No step needs Fable: the choices that spread are made here. Escalate step 3 to Fable only if the single-sort DOM cannot be kept identical.

Checks: `cd web && npm run check` for every web step; `uv run ruff check` and `uv run python -m unittest discover -s tests` for step 2; `cd site && npm run check` when `site/` changes; `openspec validate --specs --strict` after the specs are synced.

## Risks / Trade-offs

- [A change to `SortTh` or `Table` shifts the markup of another table] → The single-sort form keeps its DOM byte for byte; `Table.test.tsx` already compares it with `SortTh` and with a hand-written table, and step 3 adds no markup unless the list has two keys.
- [`pickRow` now ignores `input` and `label` in every pick row] → No pick row holds one today; step 5 checks with a search of the pick rows and the full web tests.
- [The width rule is declared in CSS and in TypeScript] → One test compares them; the CSS stays the only thing that hides.
- [A kept or sorted column makes the table wider than a phone] → The region scrolls sideways and takes focus; Reset columns undoes it.
- [One more tab stop per row] → Accepted for native markup: 100 rows mean 100 more stops for a keyboard user who tabs through the table. The search field and the sort reach a session faster than Tab does.
- [A selected session that is no longer listed shows figures as last listed] → Stated in the spec; every in-scope row updates its held row, so "last listed" is the newest the list ever showed, and the figures refresh as soon as the list holds the session again.
- [A session ticked while an earlier view's rows are still on screen brings that view's figures into the comparison] → Ticks and held-row updates are taken only from rows in the requested scope (decision 3.4); a test holds the new `/api/usage` response pending.
- [A blank `sort=` now answers 400, where it gave the default order] → The app never sends it (`qs` leaves out an empty value); a script that did gets a clear error.
- [A mode checkbox for multi-sort may be missed] → Its label says what it does, the docs name Shift, and single sort works as before for anyone who never ticks it.
- [`desc=1` beside a list now answers 400] → No such request could be made before: a list in `sort` was already a 400.

## Migration Plan

No data migration and no rebuild. Each step merges on its own; reverting a step's pull request removes its feature. A browser that holds `ai-ledger-sessions-columns` after a revert keeps an unused key.

## Open Questions

None. The owner accepted these product defaults on review of the proposal:

1. The sort holds at most three keys, and a fourth replaces the last (2.3).
2. At most four sessions compare (3.3).
3. Hiding a sorted column takes it out of the sort (1.5).
4. A column ticked on a narrow window stays shown at every width (1.4).
5. The comparison shows the list's figures, each with the scope it has there, not the sheet's (3.6).
6. The Sessions sort stays out of the URL (2.7).
7. The comparison is in the page and not in the URL (3.5).
8. Each row gains one tab stop, its checkbox (Risks).
9. The three extras are one change.
