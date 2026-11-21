# Design

## Context

Overview today, top to bottom: view switch, lede and filters, an 11-pill section index, the Needs attention card, the work chart (bars and a rate line on two y-axes), seven vitals, then seven closed drawers. At 1440×900 the chart starts in the first screen, but none of the tables do. Each table is two clicks away (a pill, then a drawer toggle), and a weekly chart cannot narrow anything.

## Goals / Non-Goals

**Goals:** one reading per track on the chart; every bar selectable; every tile a way in; the tables one tab press from the chart, inside the first screen.

**Non-Goals:** new figures (beyond the speed trend), a change to the Judgments view, or a change to shared components' behavior.

## Decisions

### Two tracks, one x-axis

The chart keeps one SVG and one x scale. The top track (about 170 px) holds the volume bars, with the left count axis, the peak label and the project stack. The bottom track (about 48 px) holds errors per 100 tool calls as a line with dots, and two ticks (0 and the top of its scale) on the left. The right-hand axis and its rotated title go. Both tracks share the hover band, the tooltip, the keyboard readout and the data table, so a reading still names one bucket.

The low-call guard is the one in `components/chart.ts` (`lowVolume`, `LOW_CALLS`, `FEW_CALLS`). The bottom track calls it as the line did. A bucket under 50 calls draws a hollow dot, is left out of the rate scale and clips at the track's top. Nothing is duplicated.

### Week drill-down

Week bars select the way day bars do: click, or Enter on the bar the arrow keys read. A selection is kept in the URL: `day=YYYY-MM-DD` for a day, as now, and `week=YYYY-MM-DD` (the Monday) for a week. Only one is set; writing one clears the other. `week` joins `day` in `url.ts`'s view-scoped keys, so a change of project, range or source drops it in the same write, and Back restores it.

The server takes a span instead of a second filter. `on_day()` takes `days` (1 or 7) and `/api/day` and `/api/sessions` pass it through. Any other `days`, a blank one, or `days` without `day` is a 400. `on_day()` clips the span to the range, from its start to today, and every figure of a selection uses those clipped days: requests, tool calls, prompts and active time alike. A first week cut by the start of the range covers only its days in the view, and a future-dated record stays out of the week that holds today. `/api/day` names the clipped days as `start` and `end`, and the panel note names them ("Oct 7 – Oct 11, 2026 only").

A `week=` must be a Monday; another day reads as none. A week the view does not reach is dropped from the URL once the view's own figures load. While a new view loads, the chart still shows the old one, and it takes no pick then: a pick would write the old view's bucket into the new view. The selection narrows every tab: Sessions (each session's figures for those days), Project metrics, Tools, MCP servers, skills and hooks, Error loops and Failed test runs. `/api/day` gains `by_project`, `failed_tests` and `tests_failed` for that. The lede, attention summary, chart and vitals keep the range's figures.

Project metrics used to keep the range's figures for a day. They now narrow too: a tab that ignored the chip would contradict it.

A pick keeps the active tab and the focus on the chart, so a keyboard reader can go on reading. As a day pick did before, it drops the session search, the near-limit filter and the Sessions sort, so the Sessions tab lists the bucket's sessions as such.

The selection chip sits in the chart header, beside the metric switch: "Week of Nov 9 ✕" or "Nov 4 ✕". Its button is named "Clear week of Nov 9, 2026". Escape on the chart, while no bar is being read, clears it too. Escape is handled on the chart only, never on the document, so closing a sheet never drops the selection. Each narrowed tab panel starts with a one-line note naming the days.

### Vitals

Five tiles, each one control:

| Tile | Note | Destination |
| --- | --- | --- |
| Sessions | active days, median session, active time in all, thinking | Sessions tab |
| Errors per 100 calls | failed of calls | Errors page, same view (a link) |
| Test runs passed | passed and failed | Loops and tests tab, focus on Failed test runs |
| Subagents | share of tokens | Projects tab, sorted by subagent share |
| Output speed, with a sparkline | model and tool time | Sessions tab, sorted by active time |

Prompts interrupted has no destination: no table lists interruptions, and the Judgments view is not there for Codex. It moves to a line under the lede, with its count ("1 of 3"), its turns and tool calls per prompt and its change. Median session folds into the Sessions note, with the total active time and the thinking time that the Median session tile used to give. The median's change against the previous period goes; the sessions and active days keep theirs. Thinking stays on the Sessions note, not the Output speed note: a view can record thinking but no model time, and Output speed is then "n/a" or absent.

A tile is a `<button>` (or an `<a>` for Errors). Its name is the figure, the label and the change as text, so the change is read. The sparkline is `aria-hidden`.

On a Codex-only view, the Output speed figure does not exist: Codex transcripts record no model time. The tile becomes a quiet note under the strip, "Output speed: Codex transcripts record no model time." On other views without model time, the tile stays and reads "n/a", as now.

The trend is `speed_trend` on the usage payload: one row per chart bucket that holds a timed session, `{day, output_per_s, sessions}`. A session counts in the bucket of its first request in the view, with its whole-session output and model time, the same figures as the total. The sparkline draws when at least two buckets have a value.

### Workbench tabs

A WAI-ARIA tab list named "Activity detail" follows the vitals: Sessions, Projects, Tools and MCP, Loops and tests. Sessions is the default. The tab is kept in the URL as `tab=projects|tools|loops` (none for Sessions), written without a history entry, as the session filters are. Switching to Judgments drops it.

Keyboard: the tab list is one tab stop (roving `tabindex`). Left and Right move focus and wrap, Home and End jump to the ends. Activation is manual (Enter or Space), so arrowing past Sessions does not fetch its list or write the URL. Each panel is a `tabpanel`, labelled by its tab, focusable. Inactive panels are not rendered, except that the Sessions query stays cached, so a return is instant.

An action that opens a tab (a tile, an attention action) activates it, scrolls it into view and moves focus to the panel, or to the Failed test runs heading, once: a later tab change moves nothing. A tile or attention action reports the range, so it also clears a selected day or week; the tab it opens then shows the figures it promised. Showing the selected week's figures on the tiles instead would mean a second set of totals per selection. The panel note's "Show the whole range" button moves focus to the chart, as the chip's button does, since clearing removes it.

The drawers map to tabs:

| Drawer | Lands in |
| --- | --- |
| Sessions | Sessions |
| Project metrics | Projects |
| Tools | Tools and MCP |
| MCP servers, skills and hooks | Tools and MCP, under Tools |
| Error loops | Loops and tests: five newest, "Show all N" |
| Failed test runs | Loops and tests: five newest, "Show all N" |
| Prompts by hour | Dropped, see below |

"Show all N" expands the list in place. When the view holds more than the payload carries (50), the button reads "Show the 50 newest" and the expanded list says "Showing the 50 newest of N". It is a button with `aria-expanded`. Error loops and failed test runs already link each row to its error on Errors. Errors has no list of only loops or only test runs, so the full view is the in-page list.

The section index goes, with no replacement: the tab list is the index of the tables, and the four sections above it fit in one screen. Neither the tab list nor the view switch is sticky. At most two sticky bars: the nav and the filter bar. A later change adds that filter bar; the Judgments view keeps its own section index until then.

### Attention

The attention summary stays above the chart, as the router into the tabs, but loses the card frame: one compact line per problem, with its action. Each action activates its tab.

### Work hours: removed

The heatmap goes, with `work_hours` on the payload. The brief offered median output speed by hour as the other choice, but the store cannot give it: model time is recorded per session run (`session_runs.api_ms`), not per request, so it cannot be split by hour. Spreading a session's model time over its hours would invent a figure. Prompts by hour filters nothing, and its one use in the docs (spotting a script by its hours) is better served by the Sessions tab sorted by prompts.

## Risks / Trade-offs

- [Tabs hide three tables that drawers let the reader stack] → Only one drawer could be open at a time already.
- [A link to `?tab=hours` or a drawer anchor stops working] → An unknown `tab` reads as Sessions.
- [A week of sessions is listed whole, as a day is] → A week holds tens of sessions on real stores; the costs then add up to the week's.
- [The first screen at 1440×900 must hold the chart and the tab list] → `tools/demo/firstscreen.mjs` measures it on the demo store.
