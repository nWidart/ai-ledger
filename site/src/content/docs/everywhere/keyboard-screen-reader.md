---
title: Keyboard and screen reader
description: Use every page by keyboard and with a screen reader.
spec: [dashboard-app, command-palette, context-menu]
---

Every page works from the keyboard and with a screen reader. This page lists the shortcuts, the page structure assistive technology sees, and how each control announces itself.

## Shortcuts

| Key | Where | Action |
| --- | --- | --- |
| **Cmd+K** (macOS), **Ctrl+K** | Any page | Open the [command palette](/ai-ledger/everywhere/command-palette/). |
| **Shift+F10**, context-menu key | A focused project, session, tool, MCP server, skill or error type | Open its [context menu](/ai-ledger/everywhere/context-menu/). |
| Up, Down, Enter | An open menu | Move through the items, pick one. |
| Esc | An open menu, the palette, a sheet, a toggletip, a chart tooltip | Close it. Esc in a menu or on a chart tooltip does not close the sheet or the palette under it. |
| Left, Right | A focused chart | Read the previous or next point. |
| Home, End | A focused chart | Read the first or last point. |
| Left, Right | The focused Project plot "Sessions by cost and tool calls" | Read the previous or next session, from the cheapest to the costliest. With none read, Right reads the cheapest and Left the costliest. After a session sheet opened from the plot closes, they go on from that session. |
| Home, End | The focused Project plot | Read the cheapest or the costliest session. |
| Enter | The focused Project plot, with a session read | Open its session sheet. |
| Esc | The focused Activity work chart, with no bar being read | Clear the selected day or week. |
| Plus (or `=`) | The focused Cost daily chart, Activity work chart, Errors chart or Context cache chart, in a view of 14 or more days or weeks (on Errors, 14 points: a folded stretch is one) | Zoom in: halve the days or weeks shown, around the one you are reading (the newest when you read none), down to 7. |
| Minus | The focused Cost daily chart, Activity work chart, Errors chart or Context cache chart, in a view of 14 or more days or weeks (on Errors, 14 points) | Zoom out: double the days or weeks shown, up to every one. |
| Enter, and Space on Errors | A focused chart that selects a bucket | Select or clear the point you are reading. On Errors the reading stays, so the same key clears it. |
| Left, Right, Home, End | A focused tab on Activity's workbench or on Context | Move to the previous, next, first or last tab, wrapping. Context selects it at once; on Activity, Enter or Space selects it. |
| Tab | A focused tab | Move to the selected tab's panel. |
| Up, Down | The focused row of Live's Tree, in the Outline layout | Move to the previous or next row that shows. Each state group is one tab stop. |
| Right | The Outline | Expand a collapsed row, else move to its first child. |
| Left | The Outline | Collapse an expanded row, else move to its parent. |
| Home, End | The Outline | Go to the first or the last row of the group. |
| Enter, Space | The Outline | Select the row: a session or agent opens in the Stream view, a fold row such as "4 finished subagents" shows or hides its agents. |
| Left, Right | The focused Activity calendar | Read the day a week earlier or later; stop at the first and last day. |
| Up, Down | The focused Activity calendar | Read the day before or after, so Down from a Sunday reads the next Monday; stop at the first and last day. They do not scroll the page. |
| Home, End | The focused Activity calendar | Read the first or last day. |
| Enter | The focused Activity calendar, with a day read | Select a day with activity and move the focus to the tabs' panel. A day with none selects nothing. |
| Esc | The focused Activity calendar | End the reading. With none read, clear the selected day or week. |
| Up, Down, Left, Right, Home, End | The focused Cost flow ("Where the cost goes") | Follow the cost along its [bands](/ai-ledger/pages/cost/#where-the-cost-goes): Up and Down move in a column, Right and Left follow a band to the next column. Up and Down do not scroll the page. |
| Enter | The Cost flow, reading a named project | Open that project's sheet. |
| Left, Right | The focused session sheet's "Tool calls by thread" | Read the previous or next call of the thread, by start. At the end of a thread, the same call is read again. |
| Up, Down | The focused "Tool calls by thread" | Read the call of the thread above or below that started nearest in time. They do not scroll the sheet. |
| Home, End | The focused "Tool calls by thread" | Read the thread's first or last call. |
| Enter | "Tool calls by thread", with a call read | Open the call's [tool sheet](/ai-ledger/everywhere/sheets/#tool-mcp-server-and-skill-sheet). A call with no tool name opens nothing and says so. |
| Esc | "Tool calls by thread", with a call read | End the reading and keep the sheet open, even when a pointer opened the tooltip and the focus is elsewhere in the sheet. With none read, Esc closes the sheet. |
| Esc | The Cost flow, reading an item | End the reading. |

Charts with this keyboard reading: the Activity work chart, the outcome trend of Activity's Judgments view, the Cost chart, the Errors chart, the Context charts, the Limits chart, Live's 10-minute pulse and the Project page's [session plot](/ai-ledger/pages/project/#sessions-by-cost-and-tool-calls), which reads sessions and not points. A tooltip that a chart opens closes with Esc without changing the selected point. The session sheet's [Tool calls by thread](/ai-ledger/everywhere/sheets/#session-sheet) reads calls along their threads and not points, and says each one in a sentence such as "Bash on the main thread, 14:02:10 to 14:08:41, 7m, failed: npm test. 2 other calls ran during it."; its label gives the call count, the threads and the keys.

Charts and tab lists act on these keys only when you hold no Alt, Ctrl, Meta or Shift, so the browser's own shortcuts still work while they have focus: Alt+Left goes back, Ctrl+Home goes to the top of the page. The zoom keys follow the same rule, except that plus may take Shift, as it does on most keyboard layouts: Ctrl+plus and Ctrl+minus still zoom the page. The session sheet's timeline is the one exception for Shift: Shift+Left and Shift+Right move ten requests.

## Page structure

- The first Tab stop on every page is a **Skip to content** link, visible only while it has focus. Enter moves focus into the page's main content, past the navigation.
- Each page holds its content in one `main` landmark, after the navigation. Its heading and tables are inside it.
- The navigation's tabs are in two groups, each named for a screen reader: **Now** (Live, Limits) and **Review** (Activity, Cost, Context, Errors).
- On a narrow window (about 780px and below, or zoomed in), a page chooser button replaces the tabs. It is named for the current page, or "Pages" on the Project page, and opens a list of the pages in the same two groups. The list ends with the **Docs** link, which leaves the navigation at this width. Esc closes the list and returns focus to the button.
- Activity's view switch is a group named "Activity view" with two buttons, Overview and Judgments; the pressed one is the view shown. After a switch, focus stays on the switch.
- After you pick a page in the navigation, focus moves to that page's heading. Loading a page directly, changing a filter, and browser Back and Forward do not move focus.
- After the navigation, Tab reaches the [scope bar](/ai-ledger/everywhere/filters/#scope-bar): project, clear project, range, source, Include automated and Brief, in that order on every page. Then it enters the page.
- A section or field you jump to, or that takes focus, stays clear of the sticky navigation and the scope bar.
- A drawer's title is a heading in the page outline, and its toggle is a button.
- A sheet is a dialog named by its title. Esc closes it. Focus then returns to the control that opened it. When the page redrew that control, focus goes to the same item's control, and when there is none, to the page's heading.

## Announcements

| Element | What it says |
| --- | --- |
| Palette | The highlighted option with its kind, counts and position. Chip and footer changes are announced. |
| `>copy link`, a context-menu copy item | "Link copied", "Copied to clipboard." or the failure, as a polite status. |
| **Refresh** | The button stays focusable while a refresh runs and exposes `aria-disabled`. A second press does nothing. |
| Ingest result | Only the result of a manual refresh is announced: "Refreshed: 5 new lines" (an example), "Refreshed: nothing new", or the failure. A timed ingest is not announced. |
| A page that is loading | Its content area is `aria-busy`. Nothing about loading is announced. Only the result of an action, such as a failed refresh, is announced. |
| Live tab | The tab's name adds the sessions that wait for you: "Live 2 sessions waiting for you". With none, it reads "Live". The badge's number itself is hidden from a screen reader. |
| Limits tab | The tab's name adds what its pill shows: "Limits Highest open window: Codex weekly at 42%" ("at an estimated 42%" for an estimate). While a window is at its limit, forecast to run out, or at 90% or more, it reads "Limits alert: *sentence*". The alert's sentence is also announced once, when the alert appears. |
| Page chooser | Its name adds "Limits alert" and the pill's percent while a window is in alert, and the sessions that wait for you: "Cost, Limits alert, highest open window at 100%, 2 sessions waiting for you". |
| Judgments button | With Codex or Grok as the only source it is unavailable (`aria-disabled`), stays focusable, and is described by the reason shown beside it. |
| Theme button | Its name is "Theme: system", "Theme: light" or "Theme: dark". Each press steps System, Light, Dark, then System again. |
| Live's Tree | Each Outline group is a `tree` named by its state heading. A row reads its node in words (name, description, state, figures), its level, its place among its siblings and whether it is expanded. In the Org chart, each session is a list of nested lists with a button per card, in the order parent then children; the connectors are hidden. |
| Chart | A `group` with a label that says what the chart shows and how to read it, with a live region that reads the point you move to. |
| Toggletip | A button named for the term it explains. It exposes `aria-expanded`, opens on activation (and on hover), and closes on Esc, on a second activation and on a click outside it. When its text ends with a **Learn more** link, Tab from the open button reaches the link, and Esc on the link closes the toggletip and returns focus to the button. |
| A link to these docs | Its visible text, then where it goes and that it opens a new tab: "Docs, Cost page documentation, opens in a new tab", "Learn more, How cost is estimated documentation, opens in a new tab". |

## Tables

Every data table has an accessible name, and every header cell declares its scope. A table wider than its wrapper sits in a named region that takes keyboard focus; the arrow keys scroll it. See [Data tables](/ai-ledger/everywhere/data-tables/).

Activity's Sessions table sorts by up to three columns. Tick **Sort by several columns**, then press Enter or Space on each header to add it; focus stays on the header. Only the first column's header carries `aria-sort`. Each other sorted header's button ends its name with its rank and direction, such as "Prompts, sort 2 of 2, descending", and the first one's with its rank, such as "Est. cost, sort 1 of 2". The hint above the table says the new order as a polite status.

Each Sessions row starts with a checkbox named "Select" and the session's name, such as "Select Fix login". Space ticks it without opening the sheet; Tab then moves to the row's session button, which Enter opens. The count in the selection bar is a polite status, such as "1 selected. Select 1 more to compare." While the rows load they are inert, checkboxes included, but the bar and **Clear selection** stay usable. Clear selection moves the focus to the search field. See [Selection](/ai-ledger/everywhere/data-tables/#selection).

With two or more sessions selected, **Compare** is a disclosure button that keeps the focus as the "Session comparison" table shows or hides. A cell of the comparison reads with its figure's row header and its session's column header. **Remove** moves the focus to the next session's Remove button, or the previous one's; under two sessions the comparison closes and the focus moves to Clear selection. See [Comparison](/ai-ledger/everywhere/data-tables/#comparison).

## Display

- Forced-colors (Windows high contrast) modes are supported. Pressed buttons, the selected tab and sort header, the current page, the selected chart bucket, focus rings and chart bars stay distinguishable using system colors.
- Input borders have a contrast of at least 3:1 against the page, and the palette input shows a focus ring of at least 3:1, in both themes. Text on the series-1 color has at least 4.5:1.
- A page switch animates with a view transition when the browser supports it. With reduced motion requested, the page switches at once.
- The theme follows the operating system (System), or stays Light or Dark. The choice is saved in your browser and applies before the page first paints.
- Text follows the browser's default font size, and chart labels scale with it; nothing is cut off at 200%. In Chrome and Edge 146 or later, the dashboard also follows the operating system's text scale.
