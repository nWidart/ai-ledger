# Proposal

## Why

Activity's Sessions table has 13 columns, one sort key and no way to put two sessions side by side. A reader who cares about three figures scans past ten others; a sort by Failed leaves hundreds of ties in an order the reader did not choose; and comparing two runs of the same task means opening two sheets in turn and remembering the first. Every table now draws through one shared `Table` component, so these three extras can be added to this one table without a second table implementation.

## What Changes

The extras go on the Activity Sessions table only. Every other table keeps what it has.

- **Column chooser.** A **Columns** button beside the search opens a list of checkboxes, one per column except Session. Unticking hides a column; ticking a column the window's width hides keeps it shown at every width. **Reset columns** returns to the automatic columns. The choice is kept in the browser, not in the URL.
- **Sorted columns always show.** A column in the sort shows whatever the chooser or the width says, and hiding a column takes it out of the sort, so the order on screen is always explained by a header on screen.
- **Multi-sort.** Sessions sorts by up to three columns. A **Sort by several columns** checkbox makes a header press add its column to the sort (press again to reverse it, a third time to remove it); Shift with a press does the same without the checkbox. Sorted headers show their direction and, with several keys, their rank. The first key's header carries `aria-sort`; the others say their rank and direction in their button's name. The hint says the whole order.
- **`/api/sessions` takes several sort keys.** `sort` accepts up to three keys, comma-separated, each with a leading `-` for descending (`sort=-cost,prompts`). The earlier `sort=cost&desc=1` keeps working. Ties after the last key keep the list's own order, then the session id, so pages never repeat or skip a row. The server answers 400 for an unknown key, a repeated key, an empty key (a blank `sort=` included, which gave the default order before), more than three keys, or `desc=1` with anything but one bare key.
- **Selection.** Each row starts with a checkbox named after its session. A click on it selects the row and does not open the session sheet. Up to four sessions can be selected; there is no select-all. The selection survives Show more, a sort, a search or near-limit change, a refresh and a tab change; it clears when the project, range, source, automated toggle or selected day changes. While the rows on screen still belong to the view before such a change, their checkboxes are disabled, so no figure of another view enters the selection.
- **Compare.** With two or more sessions selected, **Compare** shows a comparison table above the Sessions table: one column per selected session, one row per figure of the Sessions table, in the same formats and with the scope each figure has in the list, "–" where a session records no value. A refresh updates the figures, and a session that then leaves the list keeps the refreshed ones. Each session's name opens its sheet, and each column has a Remove button. The selection and the comparison are not kept in the URL.
- **Shared code.** `pickRow` ignores clicks on form controls and labels. `Table` accepts a list of sort keys beside today's single sort. No table other than Sessions changes what it draws.

Not in this change: reordering or resizing columns, a sort kept in the URL, more than three sort keys, select-all, a comparison link, marks for the best or worst value, and figures that only the session sheet has (tool time, lines changed, model mix, judgment).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Sessions gains a column chooser, a sort by up to three columns (server and page), and a selection of up to four sessions with a comparison table. "Sort Sessions over the whole list" changes: several keys, their validation and the tie-break.

## Impact

- `src/ai_ledger/metrics.py`: `session_list` parses and validates the sort list and adds the tie-break. `src/ai_ledger/app.py`: the handler keeps an explicit blank `sort` so it can answer 400. No derived table changes, so no rebuild; the payload keeps its shape, so no fixture changes.
- `web/src/components/Sort.tsx`, `Sort.css`, `web/src/components/table/Table.tsx`: a list of sort keys, the rank mark, the next-sort rule.
- `web/src/components/sheets/session.ts`: `pickRow` ignores form controls and labels (every pick row, no visible change today: no pick row holds one).
- `web/src/pages/activity/`: `SessionsPanel.tsx`, `ActivityPage.tsx`, `activity.css`, and new files for the chooser, its stored choice and the comparison.
- `web/src/api.ts`, `web/src/queries.ts`: `sessionsUrl` and `sessionPages` send the sort list.
- Browser storage: one new key, `ai-ledger-sessions-columns`.
- `README.md`, `site/src/content/docs/pages/activity.mdx`, `site/src/content/docs/everywhere/data-tables.md`, `site/src/content/docs/everywhere/keyboard-screen-reader.md`, `CHANGELOG.md`.
- No new dependency: the chooser uses the installed Base UI popover; TanStack Table stays as it is used today.
