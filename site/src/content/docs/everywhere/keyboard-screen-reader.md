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
| Plus (or `=`) | The focused Cost daily chart, in a view of 14 days or more | Zoom in: halve the days shown, around the day you are reading, down to 7 days. |
| Minus | The focused Cost daily chart, in a view of 14 days or more | Zoom out: double the days shown, up to every day. |
| Enter (Space on Errors) | A focused chart that selects a bucket | Select or clear the point you are reading. |
| Left, Right, Home, End | A focused tab on Activity's workbench or on Context | Move to the previous, next, first or last tab, wrapping. Context selects it at once; on Activity, Enter or Space selects it. |
| Tab | A focused tab | Move to the selected tab's panel. |

Charts with this keyboard reading: the Activity work chart and hours grid, the outcome trend of Activity's Judgments view, the Cost chart, the Errors chart, the Context charts and the Limits chart. A tooltip that a chart opens closes with Esc without changing the selected point.

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
| Chart | A `group` with a label that says what the chart shows and how to read it, with a live region that reads the point you move to. |
| Toggletip | A button named for the term it explains. It exposes `aria-expanded`, opens on activation (and on hover), and closes on Esc, on a second activation and on a click outside it. When its text ends with a **Learn more** link, Tab from the open button reaches the link, and Esc on the link closes the toggletip and returns focus to the button. |
| A link to these docs | Its visible text, then where it goes and that it opens a new tab: "Docs, Cost page documentation, opens in a new tab", "Learn more, How cost is estimated documentation, opens in a new tab". |

## Tables

Every data table has an accessible name, and every header cell declares its scope. A table wider than its wrapper sits in a named region that takes keyboard focus; the arrow keys scroll it. See [Data tables](/ai-ledger/everywhere/data-tables/).

## Display

- Forced-colors (Windows high contrast) modes are supported. Pressed buttons, the selected tab and sort header, the current page, the selected chart bucket, focus rings and chart bars stay distinguishable using system colors.
- Input borders have a contrast of at least 3:1 against the page, and the palette input shows a focus ring of at least 3:1, in both themes. Text on the series-1 color has at least 4.5:1.
- A page switch animates with a view transition when the browser supports it. With reduced motion requested, the page switches at once.
- The theme follows the operating system (System), or stays Light or Dark. The choice is saved in your browser and applies before the page first paints.
- Text follows the browser's default font size, and chart labels scale with it; nothing is cut off at 200%. In Chrome and Edge 146 or later, the dashboard also follows the operating system's text scale.
