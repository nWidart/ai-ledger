---
title: Data tables
description: Read any chart as a table, and sort and scroll the tables on every page.
spec: [dashboard-app, usage-dashboard, cost-dashboard, context-dashboard]
---

Pages show their figures as charts and as tables. This page describes the controls the tables share.

## Drawers

A drawer is a table folded behind its title, at the foot of a page. Every drawer is closed when a page loads, after a reload too. A page shows one open drawer at a time: opening a drawer closes the open one. A card action, a link or a chart click that opens a drawer also scrolls to it.

## How measured

A section's hint is one line. When there is more to say about how a figure is measured, a **How measured** link ends the hint, on every page that has one: Activity (both views), Cost, Context, Errors and Limits. It is a toggletip: it shows the method on hover and on activation, and closes on Esc or a click outside it. A screen reader announces nothing on hover. Activate the link, and the method is the next thing to read after it. A method too long for the window scrolls; press Tab from the link to scroll it with the keyboard.

## Show data table

Under some charts, a **Show data table** button opens the chart's figures as a table. The button reads **Hide data table** while the table is open. The table is closed on every page load and is not rendered while closed. It follows the chart's current measure and stacking.

| Page | Chart | Table rows |
| --- | --- | --- |
| Activity | Work chart | One row per day or week: the chosen measure by project (with Other), its total, and errors per 100 tool calls. |
| Cost | Cost and tokens chart | One row per day: one column for each series in the current stacking (Project, Model or Agent, with Other) and the day's total. |
| Context | Growth chart | One row per turn: the median context, its 25th and 75th percentile, its sessions, and the median of each project drawn. |
| Context | Median starting context per week | One row per week: its start, the median tokens and the sessions. |
| Context | Cache chart | One row per bucket: the cache use the chart draws. |
| Context | Session map | One row per session on the map. |
| Context | Window pressure bars | The figures the bars draw. |
| Activity (Judgments) | Outcome trend | One row per week: sessions and each outcome's count and share. |
| Cost | Tokens and cache (and the Cost block of the Project page) | Each billed token kind's full token count, share of tokens, estimated cost and share of cost, with thinking and both cache-write lifetimes. |
| Errors | Rate chart (Errors by type) | One row per day or week: tool calls, failed calls, rate, and failed calls by type. |
| Limits | Open window chart (inside Details), past window curve, and Past windows | Open window and curve: times and percent used, plus the safe pace after now. Past windows: every closed window in the range. |

Live's 10-minute pulse has no data table. Read it with the arrow keys, one minute at a time (see [Keyboard and screen reader](/ai-ledger/everywhere/keyboard-screen-reader/)).

## Sorting

A sortable column header holds a button. The first press sorts by that column, most first (A to Z first for text columns). A second press reverses the direction. An arrow in the header shows the direction, and the header exposes `aria-sort`. Only the sorted header carries it. Rows with no value for the column come last in either direction.

Activity's Sessions table also sorts by up to three columns. Every other table sorts by one.

- Tick **Sort by several columns** beside the search, then press a header to add its column as the last key, most first. Press it again to reverse it, and a third time to remove it.
- Hold Shift as you press a header to do the same with the box unticked.
- At three columns, a new column replaces the third, so the first two keys stay.
- Without the box or Shift, a press sorts by that column alone, as in every table.

Each sorted header shows its arrow and its rank, such as "↓1" and "↓2". Only the first column's header carries `aria-sort`; the others say their rank and direction in their button's name, such as "Prompts, sort 2 of 2, descending". The hint above the table says the whole order, such as "costliest first, then most prompts first".

A column whose meaning needs a note has a toggletip beside its header. The toggletip shows its text on hover, and on activation from the keyboard.

Errors' type table also has a "Filter types…" field that lists the types whose label or id contains the text, and announces "N of M types".

## Columns

Activity's Sessions table lets you choose its columns. Every other table shows all of its columns.

Select **Columns** beside the search. A list opens with one checkbox per column, in the table's order. Session is not in the list: it always shows.

A box is ticked when its column shows in the window now. On a narrow window the table hides its least needed columns by width, and their boxes read unticked.

- **Untick** a box to hide its column at every width.
- **Tick** a column the width hides to keep it at every width. The table scrolls sideways in its region when its columns do not fit.
- **Tick** a column you hid, at a width that shows it, and it hides by width again, as before your choice.
- **Reset columns** drops every choice, so each column shows or hides by width.

The button reads "Columns, 2 hidden" while you hide two columns.

Every sorted column shows, even a column you hid. Your visibility choice applies again when a column leaves the sort. Unticking a sorted column hides it and removes its sort key. The table returns to its default order when the last key is removed.

The browser keeps the choice for every view and after a reload. The URL does not hold it: a shared link opens at the reader's own columns. When the browser blocks site storage, the choice lasts until you reload the page.

From the keyboard, press Enter on **Columns** to open the list and move the focus into it. Tab moves through the checkboxes and Space ticks or unticks one; the list stays open. Esc closes the list and returns the focus to the button. A click outside the list closes it too: a click on a control, such as the search field, leaves the focus there, and a click on plain text or the page background returns the focus to the button. A screen reader hears the button as collapsed or expanded, and the list as a dialog named "Columns".

## Selection

Activity's Sessions table lets you select up to four sessions. No other table has a selection.

Each row starts with a checkbox. Tick it, or click anywhere in its cell, to select the session; the session sheet does not open. The rest of the row opens the sheet as before. There is no select-all.

While a session is selected, a bar above the table says how many are selected:

- With one: "1 selected. Select 1 more to compare."
- With four: "4 selected. 4 is the most that compare." The other rows' checkboxes are disabled until you unselect one.

**Clear selection** in the bar unselects every session and moves the focus to the search field.

The selection lasts through Show more, a sort, a search, **Near context limit only**, a refresh and a tab change. A selected session that a search leaves out of the list stays selected and counted. The selection clears when the project, range, source, Include automated, or the selected day or week changes: its sessions' figures would then count other days or other sessions.

While another view loads, the rows of the view before stay on screen. Their checkboxes are disabled until the new rows arrive, so no session joins the selection with figures from the view before. The rows still open their sheet. If the new view fails to load, the checkboxes stay disabled until the view asked for and the rows shown agree again.

The URL and the browser keep no selection and no comparison: a reload or a shared link shows no session selected.

## Comparison

With two or more sessions selected, **Compare** in the selection bar shows the selected sessions side by side, in a table named "Session comparison" between the bar and the Sessions table. It is the Sessions table turned on its side: one row per figure, one column per session, in the order you selected them.

- Each figure reads as its Sessions cell does and keeps the scope it has there. [Compare sessions](/ai-ledger/pages/activity/#compare-sessions) on the Activity page lists each figure's scope.
- Every figure has its row, even a column you hid or the width hides.
- Ticking another row while the comparison shows adds its column.
- The comparison reads the rows the list has loaded and makes no request. A refresh updates the figures of each session the list holds; a session a search leaves out keeps its last figures.

**Compare** is a disclosure button: a screen reader hears it as collapsed or expanded, and the focus stays on it when the comparison shows or hides. Each figure's row starts with its name as a row header, and each session's column header holds the session's name, so a screen reader hears both with every cell. The name opens the session sheet, and closing the sheet returns the focus to it. **Remove** unselects its session and moves the focus to the next session's Remove button, or to the previous one's after the last. When fewer than two sessions stay selected, the comparison closes and the focus moves to **Clear selection**. While a new sort or search loads, Remove still works. On a narrow window the comparison scrolls sideways in its own region.

## Export

The Cost page's project table and session table have **Download CSV** and **Copy** buttons. Download CSV saves the rows as shown as a `.csv` file. Copy puts the same rows, tab-separated, on the clipboard and reads "Copied" or "Copy failed".

## Names and scrolling

Every table has an accessible name, such as "Cost by project", and each header cell declares its scope. A table wider than its wrapper scrolls sideways inside a named region that takes keyboard focus: Tab to the region, then use the arrow keys.
