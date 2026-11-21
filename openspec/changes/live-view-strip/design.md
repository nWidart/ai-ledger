# Design

## Context

The Stream view is a three-column grid: the rail (15.625rem), the stream, and the agent panel (18.125rem). At 1440x900 the stream box is 798px wide and its top is at 255px. The agent panel holds five sections: Doing now, Context window, This session, Tokens, Plan limits. `useLive` keeps one notice stream (`EventSource` on `/api/live/events`) and two queries, the list and the selected session, each refetched at most one at a time per notice.

## Goals / Non-Goals

**Goals:** give the stream the panel's width; keep every figure the panel showed, or drop it for a stated reason; a pulse that shows work, not cache rereads; watch two sessions beside the Wall; less height above the first event; a phone layout where the stream shows on the first screen.

**Non-Goals:** no change to the stream's rows, lanes, filters or Follow; no new notice type; no change to the session sheet.

## Decisions

### Where each agent panel figure goes

| Panel figure | In the new page |
| --- | --- |
| Doing now: state and detail | Strip, first item: the state tag and its detail. |
| Doing now: why it is inferred | Strip: the state's "(inferred)" is a toggletip that holds the reason, so the keyboard reaches it. |
| Context window: tokens of window, meter, compaction marks, % used, compaction count | Strip: a 6rem meter with the marks, then "55k / 1M · 62% · 2 compactions". Unknown window: "55k tokens · window not known". |
| Cost, Tool calls, Errors | Strip. Errors stays a toggle of the failed-calls filter, as in the panel. |
| Cache read | Strip, with a toggletip that says what it is. |
| Model | Already in the stream head as a chip. Dropped from the strip: it would show twice. |
| Requests | **Dropped.** It is the least read figure and the session sheet's Models table gives requests per model, one click away (Session sheet link in the head). |
| Tokens · last minute | **Replaced** by the pulse (below). The per-minute figure counted cache reads, which is the problem this change fixes. |
| Plan limits: label, %, warning above 80%, reset time | Strip: one item per open limit, "5h 42%", with a warning color and a "near" word above 80%. The reset time moves to the item's hover text and screen-reader text; the Limits page has every window in full. |

The strip adds what the panel lacked: the working directory (`cwd`, cut from its start so the end of the path shows) and Copy resume, the same command as the session sheet's (`resumeCommand`).

### Strip layout

The stream head keeps one line: title (or project), project, branch, source, model, Session sheet. The strip is the next line, a wrapping flex row of small items separated by gaps; at 1440 it takes two lines at most. The filter bar follows. The page loses a line: the connection status moves into the top bar, after the spacer.

At most two sticky page bars: the nav and the filter bar. The status strip is part of the stream pane. It sits at the top of the stream column, above the stream's own scroll box, and is never a full-width bar stuck to the page top; a pinned stream on the Wall has its own strip in its own pane.

### Pulse

`/api/live/session` returns `pulse`: `start` (now minus 10 minutes), `context` (each main-thread request since `start`, with its context, plus the last one before `start` as the starting level) and `ticks` (each tool call that ended since `start`, with whether it failed). The page draws it in 10 one-minute buckets on a 160x28 box:

- the context as a step line, scaled from the window's lowest to its highest value, so growth shows even in a large window; the readout gives the numbers;
- a tick per call along the bottom: a short upright line for a success, a taller ✕ for a failure. The two differ in shape, not only in color.

The chart is a focusable group, as the other charts with a readout (Context's Starting context): its name is the text alternative ("Last 10 minutes: context 40k to 62k tokens, 18 tool calls, 2 failed"), Left, Right, Home and End move one minute at a time, Escape dismisses, and the readout ("10:04 to 10:05: context 52k, 3 calls, 1 failed") is in a polite live region beside it. The line uses `--text-primary` and failures `--critical-text`, both at least 3:1 against the surface in both themes. Under forced colors the line and success ticks take `CanvasText` and failures `Highlight`, and meters take `Highlight` on a `CanvasText` frame.

A client-side pulse from the events was rejected: the events hold no request context, and a session's first load can start after the window.

### Rail rows

A third line in the entry's grid, `.75rem` high: a 2.5rem meter with the percent, the latest action (the Wall tile's text, cut with an ellipsis) and, when above zero, "✕ N" with "N errors" for screen readers. The entry's padding goes from 8px to 4px, its row gap from 2px to 0, and a group heading's padding loses 2px, so the line costs about 3px per entry. With the connection status moved into the bar, the rail is 26px taller. Eight sessions in five groups take 769px of the 771px rail at 1440x900, as they took 743px of 745px before (`tools/demo/livefit.mjs`).

### Wall pins

Selecting a tile toggles its pin (`aria-pressed`), so the Wall stays. Pins sit beside the tiles: with pins, the Wall is a grid of the tiles' column (one tile wide, scrolling) and one column per pin; below 1100px the pins go under the tiles. A pin is a region named for its session, with its head (title, state, Open in Stream, Unpin) and its own stream with its own filters and Follow, on when pinned. Lane choices are shared, as they are keyed by lane.

At most 2 pins: pinning a third drops the oldest, and a polite status says "Pinned graft. Unpinned notes: 2 pins at most." Unpin moves focus to the pin's tile.

The URL keeps them as `pin=a,b`, oldest first. It is a page key, like `view`: it replaces the history entry rather than pushing one, so Back does not walk through pins. Ids with a comma, or more than 2, are dropped by `validateSearch`.

### One connection

`useLive` takes the pins as a third kind of fetch beside the list and the selected session. Each pin has its own observer through `useQueries`, and its "one request at a time, one more after" state in the same map as the list's and the session's, keyed `pin:<id>`. The refetch functions are read from a ref, so `refresh` and the notice effect keep their identity and the `EventSource` is not reopened when pins change. A notice that names a pinned session refetches it; the recheck timer covers pins too. In the Wall view no stream session is fetched: the selected one is not on screen.

### Full text warning

The banner went between the bar and the grid, so turning Full text on pushed the stream down. The warning is now a note positioned under the bar's right end, over the page, with a Dismiss button. It never takes layout space, so nothing moves when it opens or closes. While Full text is on, the checkbox keeps a warning tint, so the state stays visible after a dismiss. It opens again each time Full text is turned on.

Inline text in the bar was rejected: on a narrow window it wraps the bar and moves the stream as the banner did.

### Narrow screens

Below 721px the rail is one row: every group's entries side by side in one scroller, the group headings kept for screen readers only, each entry 12rem wide with its first two lines. The row is about 70px high, so the stream starts on the first screen at 390x844, and the page has no sideways scroll; only the rail row scrolls sideways, inside itself.

## Risks / Trade-offs

- [The strip wraps to three lines in a narrow pinned stream] The pinned stream's strip leaves out the working directory and Copy resume, which Open in Stream reaches.
- [A pinned session's two fetches per notice] Two pins at most bound it; the Wall view no longer fetches the stream's session.
- [The pulse's min-to-max scale exaggerates small growth] The readout and the strip's meter give the true size.
