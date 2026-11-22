# Design

## Context

Live has three reading surfaces: the rail (Stream view, left), the Wall's tiles, and the status strip above a stream. Each grew by adding facts. With real data the long fields (titles, latest actions at 200 characters, MCP tool names with JSON targets, 32-character branches) push out the short ones that matter most: the state, the errors and the context. The strip also carries account facts (plan limits) and session facts that belong to the session sheet (directory, resume command).

## Goals / Non-Goals

**Goals:** each surface shows few facts, at fixed heights, with the state never cut; the strip is about the current conversation only; nothing moves on hover; one way to filter to failed calls; Follow that comes back when the user returns to the bottom; readable prompt and reply bodies.

**Non-Goals:** no change to session states, the list payload, lanes, Pause, pins or the session sheet. The Limits page keeps plan limits; the session sheet and the context menu keep the directory and the resume command.

## Decisions

### Rail card: two lines

| Line | Left | Right |
| --- | --- | --- |
| 1 | Title, else project, ellipsis | `✕N` when N > 0 |
| 2 | State tag (never shrinks) · project when titled (shrinks first) | Context % as text, warning colour above near-full; nothing when unknown |

Dropped: cost (the footer total stays), source, latest action, the meter, branch. The latest action and the source are in the stream once a session is open; the branch is in the stream head. The card's accessible name carries what it shows, the state detail through `StateNote` and errors in words ("2 errors").

### Wall tile: four lines

1. State tag · `✕N` when N > 0 · the pinned mark.
2. Title, clamped to two lines (project when untitled), full title on hover.
3. Muted, one line: project when titled · model without its `claude-` prefix (the helper the session sheet uses).
4. Context meter and percent.

Tiles in a row share one height (grid `align-items: stretch`, fixed line boxes). `tileText` drops the same fields as the tile.

### Strip: two rows, one subject

Row 1: state pill and detail | Cost · Tools · Errors · Cache read `?`. Errors is a number in the `bad` colour above zero, not a button: the filter row owns filtering.

Row 2: two equal columns. Context: `119.5k / 1.0M · 12%` (`· N compactions` when N > 0) above an 8px meter with compaction marks. Last 10 min: the pulse at the column's width, about 40px tall. Below 721px and in a pinned stream, the columns stack.

Plan limits go: they are account-wide, not about this conversation, and the Limits page shows them in full. `live.py` drops the `plan_limits` call from `session()`, and the payload its `limits` field. The directory and Copy resume go: the session sheet and the context menu offer both. Nothing else reads the Live payload's `cwd` (the menu and the sheet read the session detail), so `cwd` goes too. `resumeCommand` stays for those callers.

The pulse draws in a `viewBox` with `preserveAspectRatio="none"` for the line and fixed-size marks, so it fills its column without distorting the ticks. Its name and keyboard readout do not change.

### Toggletip as one inline box

Base UI adds focus guards and a portal host as siblings of the trigger. In a flex row with `gap`, each becomes a flex item, so the text beside the `?` moves by the gap when the popup opens. The component wraps trigger and host in one inline `span`, so every caller sees one item. This is a fix at the component, not per caller.

### Follow comes back at the bottom

On a scroll event, Follow turns on when the list is within 2px of its bottom and its scroll height has not changed since the previous scroll event. The second check tells a user scroll from a resize or new content. Clearing Follow while at the bottom does not re-enable it at once: only a later scroll by the user that reaches the bottom does. It does what Jump to latest does, including emptying the new-events status.

### One failed-calls filter

The filter row gains "Failed calls only" (` (N)` when N > 0), a checkbox like Main thread only and Hide read-only. The "N errors" chip, its hint, and the strip's Errors button go, with their `failedOnly` props. A finished lane with a failed row still opens under that filter.

### Full text in the Stream view

The checkbox and its warning show only in the Stream view, as Follow does. The Wall's requests go without full text, whatever the Stream view's setting, so a hidden setting never fetches secrets. The setting itself is kept for the return to Stream. The warning closes after 6 seconds; the timer pauses while the pointer is over it or focus is inside it, and closing on time moves no focus. Dismiss stays.

### Markdown bodies

`markdown-to-jsx` (pinned exact version, at least two weeks old) renders prompt and reply bodies when Full text is on. It is small, has no `dangerouslySetInnerHTML` path when `disableParsingRawHTML` is set, and supports GFM tables. Overrides:

- `a`: only `http:`, `https:` and `mailto:` hrefs; others render as text. Links open in a new tab with `rel="noreferrer noopener"`.
- `img`: a link to its source with its alt text, so the page makes no image request.
- Raw HTML: shown as text.

The component renders inside the memoized event row, so a stream update does not re-parse old bodies. Code blocks scroll sideways inside `.body`. Tool output stays plain text: it is rarely Markdown and often holds characters Markdown would eat.

## Risks / Trade-offs

- [Dropping the payload's `limits` and `cwd` breaks a client that reads them] The page is the only client; the Limits API and the session detail still give both.
- [The rail hides cost and latest action] Both are one click away in the stream; the footer still totals cost.
- [Markdown changes how a body reads] Only with Full text on, where the user asked to read the text; word counts with it off do not change.
