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
| Enter (Space on Errors) | A focused chart that selects a bucket | Select or clear the point you are reading. |

Charts with this keyboard reading: the Activity work chart and hours grid, the Cost chart, the Errors chart, the Context charts and the Limits chart. A tooltip that a chart opens closes with Esc without changing the selected point.

## Page structure

- The first Tab stop on every page is a **Skip to content** link, visible only while it has focus. Enter moves focus into the page's main content, past the navigation.
- Each page holds its content in one `main` landmark, after the navigation. Its heading and tables are inside it.
- After you pick a page in the navigation, focus moves to that page's heading. Loading a page directly, changing a filter, and browser Back and Forward do not move focus.
- A section or field you jump to, or that takes focus, stays clear of the sticky navigation and the section index.
- A drawer's title is a heading in the page outline, and its toggle is a button.
- A sheet is a dialog named by its title. Esc closes it.

## Announcements

| Element | What it says |
| --- | --- |
| Palette | The highlighted option with its kind, counts and position. Chip and footer changes are announced. |
| `>copy link`, a context-menu copy item | "Link copied", "Copied to clipboard." or the failure, as a polite status. |
| **Refresh** | The button stays focusable while a refresh runs and exposes `aria-disabled`. A second press does nothing. |
| A page that is loading | Its content area is `aria-busy`. Nothing about loading is announced. Only the result of an action, such as a failed refresh, is announced. |
| Limits tab | The tab's name reads "Limits alert: *sentence*" while a window is at its limit, forecast to run out, or at 90% or more. |
| Theme button | Its name is "Theme: system", "Theme: light" or "Theme: dark". Each press steps System, Light, Dark, then System again. |
| Chart | A `group` with a label that says what the chart shows and how to read it, with a live region that reads the point you move to. |
| Toggletip | A button named for the term it explains. It exposes `aria-expanded`, opens on activation (and on hover), and closes on Esc, on a second activation and on a click outside it. |

## Tables

Every data table has an accessible name, and every header cell declares its scope. A table wider than its wrapper sits in a named region that takes keyboard focus; the arrow keys scroll it. See [Data tables](/ai-ledger/everywhere/data-tables/).

## Display

- Forced-colors (Windows high contrast) modes are supported. Pressed buttons, the selected tab and sort header, the current page, the selected chart bucket, focus rings and chart bars stay distinguishable using system colors.
- Input borders have a contrast of at least 3:1 against the page, and the palette input shows a focus ring of at least 3:1, in both themes. Text on the series-1 color has at least 4.5:1.
- A page switch animates with a view transition when the browser supports it. With reduced motion requested, the page switches at once.
- The theme follows the operating system (System), or stays Light or Dark. The choice is saved in your browser and applies before the page first paints.
