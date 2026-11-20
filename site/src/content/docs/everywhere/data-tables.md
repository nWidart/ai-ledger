---
title: Data tables
description: Read any chart as a table, and sort and scroll the tables on every page.
spec: [dashboard-app, usage-dashboard, cost-dashboard, context-dashboard]
---

Pages show their figures as charts and as tables. This page describes the controls the tables share.

## Drawers

A drawer is a table folded behind its title, at the foot of a page. Every drawer is closed when a page loads, after a reload too. A page shows one open drawer at a time: opening a drawer closes the open one. A section index link, a card action or a chart click that opens a drawer also scrolls to it.

## How measured

A section's hint is one line. When there is more to say about how a figure is measured, a **How measured** link ends the hint. It is a toggletip: it shows the method on hover and on activation, and closes on Esc or a click outside it.

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

No other chart has this button, the Errors chart and the Limits chart included. Read their points with the arrow keys (see [Keyboard and screen reader](/ai-ledger/everywhere/keyboard-screen-reader/)); Errors lists the same figures by type in its type table.

## Sorting

A sortable column header holds a button. The first press sorts by that column, most first (A to Z first for text columns). A second press reverses the direction. An arrow in the header shows the direction, and the header exposes `aria-sort`. Only the sorted header carries it. Rows with no value for the column come last in either direction.

A column whose meaning needs a note has a toggletip beside its header. The toggletip shows its text on hover, and on activation from the keyboard.

Errors' type table also has a "Filter types…" field that lists the types whose label or id contains the text, and announces "N of M types".

## Export

The Cost page's project table and session table have **Download CSV** and **Copy** buttons. Download CSV saves the rows as shown as a `.csv` file. Copy puts the same rows, tab-separated, on the clipboard and reads "Copied" or "Copy failed".

## Names and scrolling

Every table has an accessible name, such as "Cost by project", and each header cell declares its scope. A table wider than its wrapper scrolls sideways inside a named region that takes keyboard focus: Tab to the region, then use the arrow keys.
