# Design

## Context

`Sheet` (`web/src/components/Sheet.tsx`) is a modal `<dialog>` from the right. Its width is fixed in `theme.css`: `dialog.sheet { width: min(640px, 100%) }`. `UsageSheets` picks the body from the URL: a session (`session`), a project (`inspect`) or a tool, MCP server or skill (`tool`, `mcp`, `skill`). A session opened from a project or tool sheet replaces its body and gets ← Back; `useBackTo` restores the scroll position and the row on return.

`Timeline` already sizes its SVG from its box: a `ResizeObserver` sets `width`, and `timelineModel(s, width)` lays out every x from it. The plot height is a constant (130px).

The URL rules (`url.ts`): every key in the query string is part of the view. `PUSH_KEYS` push a history entry. `closeSheets` goes back by the count of sheet-only entries, so Close leaves no entry that reopens a sheet.

## Goals / Non-Goals

Goals:
- The reader can widen and narrow the session sheet and the tool sheet.
- The wide sheet uses its room: a wider and taller timeline, tables with fewer wrapped lines, short sections side by side.
- Focus, Escape, backdrop close, ← Back and scroll restore behave as before.

Non-goals: a `/session/<id>` page, a wide project sheet, new metrics, a payload change.

## Decisions

### D1. The wide state lives in the browser, not in the URL

Saved in `localStorage` under `ai-ledger-sheet-wide` (`"1"` when wide, absent when narrow), in a small store shaped like `theme.ts`: `getSheetWide`, `setSheetWide`, `useSheetWide` (a `useSyncExternalStore`), with the `storage` event so other tabs follow. Blocked storage: the toggle still works for the page view.

Why not the URL:
- Width is how this reader reads on this screen, like the theme. It is not what the sheet shows. A shared link still opens the same sheet with the same content; the receiver sees it at the width that fits their screen and their choice. A sender's `wide=1` would do nothing on a receiver's small screen and would override the receiver's choice on a large one.
- The URL rules give two options and both are wrong here. As a push key, each toggle adds a history entry, so Back would narrow the sheet in place of closing it, and the sheet depth count (which only counts entries that opened sheets) would need a new case. As a replace key, the value sits on the sheet's entry: Close goes back past that entry and the value is lost, so the next sheet opens narrow. A choice that does not stick is the main cost the reader would notice.
- Reload keeps the wide sheet with either store.

### D2. One setting for both sheet kinds

The reason to widen is the screen, which is the same for a session and a tool. A session opened from a wide tool sheet stays wide, so the sheet does not jump when the body changes. Two settings would add a second key and a width change on every session opened from a tool sheet.

### D3. `Sheet` owns the toggle; the owner says whether the sheet offers it

`Sheet` gets one prop, `widen?: boolean`. With it, the head shows the toggle and the dialog gets the class `wide` when the saved choice is on. `UsageSheets` passes `widen` for a session and for a tool, MCP server or skill, and not for a project. `Sheet` reads the store itself: the owner has nothing to do with the value.

The toggle is `<button type="button" class="sheet-wide" aria-pressed>` with the constant name "Wide", placed before Close. The name does not change with the state; `aria-pressed` carries it. It keeps focus when pressed (the same element stays mounted). The sheet's content key does not change, so a toggle neither scrolls the sheet to the top nor moves focus to the title.

Pressed look: the accent-soft fill used for other pressed controls. In forced colors the pressed toggle joins the list in `theme.css` that outlines pressed states with `Highlight`.

### D4. Width: `min(1100px, 100%)`, no transition

`dialog.sheet.wide { width: min(1100px, 100%) }`. The width changes at once. A transition would resize the timeline's box on every frame, and each resize redraws the SVG (thousands of tick rectangles in a long session). With no transition there is no motion to guard for reduced motion.

### D5. Narrow screens: the toggle is hidden

At a viewport of 640px or less both widths are 100%, so the toggle would change nothing. It is `display: none` there (out of the tab order and the accessibility tree). The saved choice is kept, and applies again on a wider window. Between 640px and 1100px wide means the full viewport, which is still wider, so the toggle shows.

### D6. Wide layout: columns by available room, not by the wide flag

- **Timeline.** The SVG follows its box, so it spans the wide sheet with no change. `timelineModel` makes the plot 180px tall (from 130px) when the width is 900px or more, so a long session's context line has room in both directions.
- **Section pairs.** Short sections that read well side by side are wrapped in a `.pair`: a grid with `repeat(auto-fit, minmax(380px, 1fr))`. Two columns appear only when both fit, so the narrow sheet and a small window keep one column with no media or container query, and a pair with one section present gives it the whole width. Order in the DOM is reading order. Pairs:
  - tool sheet: Calls per day | Where; Failures by type | After a failure and Error loops.
  - session sheet: Models | Tools.
- **Full width.** The tool sheet's Inputs and Recent calls tables, the MCP Tools table, and the session's timeline, events, error loops and commits. In the wide sheet the Recent calls session column may take 340px (160px when narrow), since the Input column no longer needs protecting.

No two-column split of the whole body: sections differ much in height, and a split would put Recent calls (the longest) beside short ones and leave a blank column.

### D7. No payload change

Every figure is already in the session and tool payloads.

## Risks / Trade-offs

- A shared link does not carry the width. Accepted (D1): the content is the same.
- `auto-fit` pairs depend on the sheet's inner width: 1100px minus padding gives two 510px columns; a 900px window gives two 414px columns; under about 830px the pairs stack. That is the intended fallback.
- jsdom does no layout. Tests assert the class, the pressed state, the stored value and the structure; the layout is checked by hand in light, dark and forced colors, and at 390px.

## Open Questions

None.
