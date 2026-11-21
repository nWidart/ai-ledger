# Design

## Context

Context grew one panel at a time and now scrolls about 4,000 px under a 9-pill section bar. The page answers three questions: what a session carries before work starts and how close it gets to the limit, what makes it grow, and what the cache saves or wastes. The tabs follow those questions. The cache chart, the session map and the tips each hid the figure a user acts on; this change brings that figure to the front.

## Decisions

### Tabs, not a section bar

Three tabs, in the URL as `tab` (`overhead` is the default and is not written; `growth`, `cache`). Changing the tab replaces the history entry, as a filter does, so Back leaves the page rather than stepping through tabs. Only the selected panel renders, so a tab's charts measure their width when shown. The tabs follow the WAI-ARIA tabs pattern: a `tablist` of `tab` buttons with roving `tabindex`, arrow keys, Home and End. Activation is automatic, since a panel draws from the payload already loaded. Every tab has its own `tabpanel`, labelled by the tab and named by its `aria-controls`; the unselected panels are empty and `hidden`, and the selected one takes focus. On a narrow screen the strip scrolls sideways with no scrollbar, so the selected tab is scrolled into the strip (the strip only, not the page) whenever it changes, including from a direct link.

A link to a section from before the tabs (`#pressure`, `#d-breaks`) selects the tab that holds it, with `setSearch({ keepHash })` so the fragment survives and a reload opens it again. It scrolls to the section (or opens the drawer) without moving focus, as the app's direct-load rule requires. It runs once the page has figures and again on `hashchange`, so a fragment changed while on another tab works too.

The drawers go with their figures: Largest tool results under Growth and bloat, Sessions where caching broke under Cache health. The tip's sessions drawer stays under the tips strip, outside the tabs, because a tip can be about any tab.

`useLanding` fades the tips, the drawers and the selected panel's sections on a new view, as before.

Alternatives rejected: keeping the section bar with collapsed panels (still one long page, and the bar's scroll spy fights collapsed sections); one tab per panel (seven tabs is the section bar again).

### Tips strip

Firing tips show as one list of short items: a severity mark (shape and text, not only colour), the tip's title, and a disclosure button. At most four items show, most severe first. A "Show N more" button reveals the rest. One item opens at a time; its evidence, advice and "N sessions" action open in a region under the strip. A closed strip is one line at 1440 px, so the tablist and the first plotted mark (Starting context's first range bar) stay within 900 px; expanded, the six items take a second line and both still fit. A browser script (`tools/demo/firstscreen.mjs`) checks both layouts with six firing tips, the most the rules give. It runs locally against the demo server, not in CI, which has no demo store or browser. A unit test checks the cap and the single open item. The open item is always one of the items shown: when a new view moves it behind "Show N more", its details close with it.

### Cache chart: waste first

Reads are 90% or more of prompt tokens and the cheapest, so on one stacked axis they hid the costly part. One SVG with three tracks shares one `dayAxis`, so slots line up:

| Track | Height | Content |
|---|---|---|
| Waste | 180 px | Uncached input (`--accent`) at the base, cache write (`--series-1`) above; left token axis. Title "Tokens not read from the cache". |
| Breaks | 48 px | Breaks by cause stacked per slot: model switch, expired, other. Title "Cache breaks", and the most in a day or week on the right. |
| Hit ratio | 44 px | A line with dots, domain from `lo` to 100%, where `lo` is the lower of 90% and the lowest ratio rounded down to 10%. Both ends are labelled. Title "Cache-hit ratio", with the view's ratio on the right. |

- **Cache reads on request.** A legend button "Cache reads" (`aria-pressed`, off by default, not in the URL) adds reads as a light segment on top of each bar and rescales the axis to prompt tokens. The track title then reads "Prompt tokens" and its total counts every prompt token, so the figure always matches the bars drawn. Waste keeps its baseline, so it stays comparable. The tooltip, readout and table always carry reads, so no reader depends on the toggle.
- **Contrast.** Adjacent fills cannot reach 3:1 with each other in both themes, so every stacked segment after the first is inset 1 px. The gap shows the surface, which is at least 4.3:1 to each fill. The light-theme break colours darken: model switch is `--series-3` mixed 75% with black, expired is `--warning-text`. Today's `--series-3` and `--warning` fall under 3:1 on the light surface. A nonzero segment is at least 2 px tall.
- **Reading a bucket.** The bucket being read is outlined in `--text-primary` with a dashed cursor through the tracks. No bar dims, since dimming the others to 0.55 took them under 3:1.
- **Forced colors.** Segment rects keep their fills with a `CanvasText` stroke. Reads fill `Canvas`, and the ratio line and dots use `CanvasText`. The toggle's pressed state, the read bucket's outline and the cursor show as `Highlight`.
- **Narrow plots.** Each track's figure on the right falls back to a short form ("773.1M", "most: 12", "93%") when the title and the figure would not fit side by side, and each date label is kept inside the plot so the first never runs into the ratio track's bottom label in the margin.
- **Text.** The group's label states the waste total, its parts, the hit ratio and the breaks. The readout gives a slot's uncached input, cache write, cache read, ratio and breaks. The table columns are: day or week, uncached input, cache write, cache read, cache-hit ratio and the three causes.

Rejected: a log axis (stacks are unreadable on it); reads at the bottom of the stack (waste loses its baseline); break marks on the bars (they collide with tall bars and cannot show three causes); bars for the ratio (they need a zero base); a fourth track for reads (low value).

### Session titles on the map

`sessions_map` points carry `title`, through the same `titles.with_titles` call as the payload's other session rows. The map's tooltip, readout and table, and the pressure lists, name a session by `sessName` (its title, else its short id), with the short id under a title in tables.

### Quadrants

The 30k-start and 80%-peak lines cut four quadrants:

- **Lean**: light start, room left.
- **Heavy start**: heavy start, room left.
- **Grew full**: light start, peaked at 80% or more.
- **Heavy and full**: heavy start, peaked at 80% or more.

Each label sits in its corner of the plot, wrapped to the room between the plot's edge and the 30k line (and set smaller, down to 80%, when one word does not fit), so a phone-width map keeps every label off the line. The 80% line's label moves right of the 30k line when the left part is too narrow for it. A group of four toggle buttons under the map names each quadrant with its count of sessions on the map. A click on the plot away from any dot selects the quadrant under the pointer, and a click on a dot still opens its session. While a quadrant is selected:

- its dots stay full and the others dim;
- the pressure bars count only its sessions on the map, with a note saying so;
- a list shows its 20 newest sessions.

Escape on the map or the buttons, Clear, or a second press clears it. One Escape on the map dismisses a reading and clears the quadrant together, so the bars never stay narrowed behind a dismissed reading. Clear unmounts with the selection, so it hands focus to the quadrant's button first. A button's name says its count once ("Lean 3 sessions, …"): the visible number is hidden from the name. In forced colors the pressed button fills with `Highlight`, which reads apart from the focus ring. The selection is local state: it narrows a chart, it is not a view to share. The pressure bars over a quadrant count map points, the newest 1,000, which the note says.

### Window grids

`contextGrid` (Project page) splits into `typicalGrid({ start, startShare, peak, peakShare, window, sessions })`, which builds the 200-cell model, and the overhead split it applies with a snapshot. Context builds one model per project from the new `grids` rows. Each row comes from one population: the project's sessions with a measured start, a known window and a peak (the session map's), with their count, most common window, and median start and peak in tokens and as shares of each session's window. Ranking, cells and figures all describe those sessions, so a project with many measured starts but few eligible sessions ranks by the few. It shows the six projects with the most such sessions, as compact `ContextGrid`s: cells, the project, and start, median peak and free as figures. `typicalGrid` draws the peak from the start up and states the free share as what the cells leave free, so the figures match the cells even when a median peak is under the median start (the Project page's grid, whose start and peak still come from different populations). With a project selected it shows the full `ContextGrid` with the snapshot, as the Project page does. `ContextGrid`'s rules move from `project.css` into its own `ContextGrid.css`, scoped to `.ctx-grid`, so both pages load them.

### Source-aware advice

Each rule's advice takes the sources of the sessions it matches (`SELECT DISTINCT source` over the rule's own condition).

| Tip | Claude Code | Codex | Both |
|---|---|---|---|
| Compactions | `/clear` and `/compact` | `/new` and `/compact` | each named, for its agent |
| Long tier | `/compact` or a new session | `/compact` or `/new` | each named, for its agent |
| Large start | `.mcp.json` / `claude mcp list` | `~/.codex/config.toml` / `codex mcp list` | each named, for its agent |

Both agents have an equivalent, so no advice is dropped.

## Risks

- Titles for 1,000 map points can read up to 1,000 first prompts when sessions have no agent title. `titles.with_titles` does that in one query, already shared with the other rows.
- A pre-change link to `#pressure` and similar anchors no longer scrolls. The tab that holds an anchor id is selected when the URL hash names it, and the hash is kept.
