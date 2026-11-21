# Design

## Context

Context grew one panel at a time and now scrolls about 4,000 px under a 9-pill section bar. The page answers three questions: what a session carries before work starts and how close it gets to the limit, what makes it grow, and what the cache saves or wastes. The tabs follow those questions. The cache chart, the session map and the tips each hid the figure a user acts on; this change brings that figure to the front.

## Decisions

### Tabs, not a section bar

Three tabs, in the URL as `tab` (`overhead` is the default and is not written; `growth`, `cache`). Changing the tab replaces the history entry, as a filter does, so Back leaves the page rather than stepping through tabs. Only the selected panel renders, so a tab's charts measure their width when shown. The tabs follow the WAI-ARIA tabs pattern: a `tablist` of `tab` buttons with roving `tabindex`, arrow keys, Home and End. Activation is automatic, since a panel draws from the payload already loaded. Each `tabpanel` is labelled by its tab and takes focus.

The drawers go with their figures: Largest tool results under Growth and bloat, Sessions where caching broke under Cache health. The tip's sessions drawer stays under the tips strip, outside the tabs, because a tip can be about any tab.

`useLanding` fades the tips, the drawers and the selected panel's sections on a new view, as before.

Alternatives rejected: keeping the section bar with collapsed panels (still one long page, and the bar's scroll spy fights collapsed sections); one tab per panel (seven tabs is the section bar again).

### Tips strip

Firing tips show as one list of short items: a severity mark (shape and text, not only colour), the tip's title, and a disclosure button. At most four items show, most severe first. A "Show N more" button reveals the rest. One item opens at a time; its evidence, advice and "N sessions" action open in a region under the strip. A closed strip is one line at 1440 px, so the tablist and the first chart's top stay within 900 px. A real browser test (`tools/demo/firstscreen.mjs`) checks this with six firing tips, the most the rules give. A unit test checks the cap and the single open item.

### Cache chart: waste first

Reads are 90% or more of prompt tokens and the cheapest, so on one stacked axis they hid the costly part. One SVG with three tracks shares one `dayAxis`, so slots line up:

| Track | Height | Content |
|---|---|---|
| Waste | 180 px | Uncached input (`--accent`) at the base, cache write (`--series-1`) above; left token axis. Title "Tokens not read from the cache". |
| Breaks | 48 px | Breaks by cause stacked per slot: model switch, expired, other. Title "Cache breaks", and the most in a day or week on the right. |
| Hit ratio | 44 px | A line with dots, domain from `lo` to 100%, where `lo` is the lower of 90% and the lowest ratio rounded down to 10%. Both ends are labelled. Title "Cache-hit ratio", with the view's ratio on the right. |

- **Cache reads on request.** A legend button "Cache reads" (`aria-pressed`, off by default, not in the URL) adds reads as a light segment on top of each bar and rescales the axis to prompt tokens. The track title then reads "Prompt tokens". Waste keeps its baseline, so it stays comparable. The tooltip, readout and table always carry reads, so no reader depends on the toggle.
- **Contrast.** Adjacent fills cannot reach 3:1 with each other in both themes, so every stacked segment after the first is inset 1 px. The gap shows the surface, which is at least 4.3:1 to each fill. The light-theme break colours darken: model switch is `--series-3` mixed 75% with black, expired is `--warning-text`. Today's `--series-3` and `--warning` fall under 3:1 on the light surface. A nonzero segment is at least 2 px tall.
- **Forced colors.** Segment rects keep their fills with a `CanvasText` stroke. Reads fill `Canvas`, and the ratio line and dots use `CanvasText`. The toggle's pressed state shows as `Highlight`.
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

Each label sits in its corner of the plot. A group of four toggle buttons under the map names each quadrant with its count of sessions on the map. A click on the plot away from any dot selects the quadrant under the pointer, and a click on a dot still opens its session. While a quadrant is selected:

- its dots stay full and the others dim;
- the pressure bars count only its sessions on the map, with a note saying so;
- a list shows its 20 newest sessions.

Escape on the map or the buttons, Clear, or a second press clears it. The selection is local state: it narrows a chart, it is not a view to share. The pressure bars over a quadrant count map points, the newest 1,000, which the note says.

### Window grids

`contextGrid` (Project page) splits into `typicalGrid({ start, startShare, peak, peakShare, window, sessions })`, which builds the 200-cell model, and the overhead split it applies with a snapshot. Context builds one model per project from `starting.by_project` and the new `growth.peak.by_project`. It shows the six projects with the most sessions that have a known start and peak share, as compact `ContextGrid`s: cells, the project, and start, median peak and free as figures. With a project selected it shows the full `ContextGrid` with the snapshot, as the Project page does. `ContextGrid`'s rules move from `project.css` into its own `ContextGrid.css`, scoped to `.ctx-grid`, so both pages load them.

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
- A pre-change link to `#pressure` and similar anchors no longer scrolls. The tab that holds an anchor id is selected when the URL hash names it.
