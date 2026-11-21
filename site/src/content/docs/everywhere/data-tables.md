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

The sorted column always shows, even a column you hid; your choice applies again when the sort moves to another column. Unticking the sorted column hides it and takes it out of the sort, so the list returns to its own order.

The browser keeps the choice for every view and after a reload. The URL does not hold it: a shared link opens at the reader's own columns. When the browser blocks site storage, the choice lasts until you reload the page.

From the keyboard, press Enter on **Columns** to open the list and move the focus into it. Tab moves through the checkboxes and Space ticks or unticks one; the list stays open. Esc or a click outside the list closes it and returns the focus to the button. A screen reader hears the button as collapsed or expanded, and the list as a dialog named "Columns".

## Export

The Cost page's project table and session table have **Download CSV** and **Copy** buttons. Download CSV saves the rows as shown as a `.csv` file. Copy puts the same rows, tab-separated, on the clipboard and reads "Copied" or "Copy failed".

## Names and scrolling

Every table has an accessible name, such as "Cost by project", and each header cell declares its scope. A table wider than its wrapper scrolls sideways inside a named region that takes keyboard focus: Tab to the region, then use the arrow keys.
