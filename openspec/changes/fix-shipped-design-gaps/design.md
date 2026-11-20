# Design

## Context

Fourteen findings from a design review, each checked in the code before the fix. Most come from a behavior that a shared component owns but a page re-implemented, or that a later change bypassed. The fixes go into the owning component.

## Decisions

### Sheets: one host list, the page's key

`HOSTS_SHEETS` in `palette/resolve.ts` is the list of pages that mount `UsageSheets`. Insights and Live mount it, and their session sheet already opens tool and project sheets in place, so they join the list for every sheet kind, not only sessions. The resolver writes a session chip under `sheetKey(path)` and clears that key (not `session`) when it opens another sheet, so Live keeps the followed session. The menu builds its links through the resolver, so it follows.

`sessionLink(id)` now returns the link's props (click handler, `data-session`, the session subject). Every in-place session link spreads it, so the context menu and `UsageSheets`' focus fallback (`twin()`, which now matches any `[data-session]`) work on every page without page wiring.

### Stacked sheets: stack, not replace

The browser's top layer already stacks two modal dialogs: Escape and a backdrop click close the top one, the one under it is inert, and `Sheet` returns focus to its opener. A probe in Chrome at 800 px confirmed the keyboard and focus path end to end. Replacing Errors' type sheet would lose its scroll and focus and need a second history model. What was missing was a cue that a sheet waits underneath: `Sheet` records, at open, whether another `dialog` is open, and then shows "← Back", which closes it.

The top layer stacks in open order, not document order. A deep link or reload of `/errors?session=…&cat=…` on a narrow screen opens the session sheet before Errors has loaded, and a wide window turning narrow opens the type sheet after it; either way the type sheet would land on top. Errors opens its type sheet with `showModalUnder()` (in `Sheet.tsx`): the dialogs already open close and reopen above it, keeping their scroll and focus, and get a `lifted` event that turns on their "← Back". `Sheet` skips the close that reopening fires: in a browser it arrives once the dialog is open again, in the test DOM while the dialog is marked as lifting.

The palette clears `session` when a commit changes the project or source. On Live that is the followed stream, so a commit that also opens a sheet keeps it: it asks for a sheet over the stream. A project change alone still starts the stream over, as before.

### Toggletips in place

The popup portals into a `display: contents` span right after its button, so it is the next content in reading order; it has `role="tooltip"`, no `aria-hidden`, and the trigger keeps `aria-expanded` and drops `aria-haspopup` (the modern-web-guidance toggletip pattern). The live region is gone, so hover announces nothing. Positioning is fixed, so a scrolling table or drawer does not clip it, and a sheet still contains it because the span is inside the dialog. Popup content stays phrasing content: multi-paragraph methods use `span.tt-p` blocks. The popup's height stops at Base UI's `--available-height`, and a popup that then scrolls takes `tabindex="0"`, so Tab from its button reaches it and the keyboard scrolls it; one that fits adds no stop.

### How measured everywhere

Cost's and Limits' `<details>` become `HowMeasured`. Errors gets two: the uncategorized share (moved out of `title`) and the incident line (out of `title`, with the recovered note). `SortTh` and Limits' strip summary already use toggletips.

### Section bar and drawers

`Drawer` exports `onDrawerToggle(f)`; each drawer calls the listeners in a layout effect after `open` changes, when the body is laid out. `SectionIndex` subscribes instead of listening for `toggle`, which no element fires since drawers stopped using `<details>`. The bar is `nowrap` with `overflow-x: auto` and scrolls the marked pill into view when the marked section changes, when the bar resizes (a `ResizeObserver`) and when its links change.

### Limits lines

Opacity made `.fc`, `.safe` and `.est` fall under 3:1. Each now draws at full opacity in a token that clears 3:1 on `--surface-1` in both themes (`--series-1`, `--text-muted`; the warm cone middle uses `--warning-text`, since `--warning` is 2.98:1 in light), and they differ by dash: measured solid, estimated `5 3`, forecast middle dotted `2 3`, safe pace thin `6 4`, last 24 h dash-dot.

The percent line is drawn as contiguous runs (`percentRuns`): a pair of neighbours is solid when both are measured, dashed otherwise, and runs share their joins. One dashed path for the whole series under one solid path through the measured points drew a solid bridge over an estimate between two readings. A measured point in no solid run is a dot.

A slow range change dimmed every section with `.55` opacity, which takes the lines under 3:1. Around a chart only what holds no chart dims, and in it only the labels, the cone's fill and the tooltip; the strokes keep full contrast.

The last-24-hours toggle shows while a window short of its limit has the scenario. The page derives what it draws from that: a refresh that takes the last such window to its limit turns the toggle off, so the line and the readout go with it, and the toggle comes back off.

`planName()` keeps the tier: a `_<n>x` tier reads as the multiplier ("max 20x"), another follows in brackets. The plan's hover titles go. What a point buys keeps its range in the hint and moves its pricing note behind How measured.

### Contributors

The cut takes the ten largest by total, then the sort orders them; Other stays last. Bars scale to the named rows and Other has no bar: a long tail summed into Other is not comparable to one tool. `SortTh` gains `after`, content in the header outside the sort button, for the scale.

### One duration formatter

`dur()` rounds before it picks a unit, so 59.6 s is "1m" and 3,590 s is "1h"; under 10 hours it keeps one decimal, dropping ".0". Errors uses it (milliseconds divided by 1,000) and writes "20m" where it wrote "20 min". Two formatters stay apart on purpose:

- Limits' `span` writes a countdown in two units, "1d 17h": one unit would hide a day's worth of hours in headroom and freshness. Time at a limit uses it too, in the bars, the panel's notes and the closed windows table, which used `dur()` and read "4.3h" beside "4h 15m".
- Live's `elapsed` writes a ticking timer, "3m 05s" with tenths under 10 s: it changes every second and needs a fixed width.

### automated.json from the status

The file is read on every request and is the same for every view, so it does not belong to a page payload. `/api/status` carries it; `useLastStatus()` reads the nav's polled status from the cache without fetching. `AutomatedFileWarning` in the app shell shows one banner, as a named region under the navigation, on every page; `Filters` names the file in the automated toggle's hint. Pages pass nothing. The page payloads keep their `automated_file` field: other tests and an older UI read it, and removing it is not needed for this fix.

### Headings

Errors shows `PageSkeleton` (with its visually hidden "Loading errors…" `h1`) in place of its header on first load, and an `h1#lede` "Errors could not be loaded." in the header after a failed one. Insights' lede is the `h1`, in every state; the kicker is a `p` and keeps the model-judged tag, outside the lede, whose live region would read the tag's popup. Live's "Live" heading stays `h1#lede` in every state; its skeleton keeps no title, as its heading is on screen and a second `h1` would repeat it.

### Smaller items

- Cost's project table announces each sort in a polite status ("Sorted by spend, highest first") and "Sort by cost again" focuses the header with `data-sort="cost"`. The status follows the `sort` prop, not the header clicks: every set is a new object, so Compare projects, Sort by cost again and a new view's reset are said too, and the text is cleared for a frame first, so a repeat is said again. The reset keeps a default sort as it is, so a range change says nothing when the sort does not change. The Compare projects note is no longer a second status.
- Activity's Output speed reason reads the sources of the view's sessions (`totals.session_sources`, new), not the priced requests by source: an unpriced Claude Code model adds no cost row, so a view with priced Codex work read as Codex-only.
- Live's stream heading is the project when the session has no title, as the spec said.
- The unpriced chip hides "+?" from screen readers and reads "plus an unknown cost for N requests from unpriced models".
- The spec scenario "A small project is selected" is dropped: a one-project view has no project table (`CostPage.tsx`), so it cannot happen. Its replacement keeps the ringed project visible, but Compare projects rings only a project from the medians' `big` set, which `foldMatrix` never folds; the one way there is a refresh of the same view that makes the ringed project small while the ring stays, and the scenario says so. The `forced` check stays for that case.
- `FEW_CALLS` in `chart.ts` is the one wording for low-call points; Errors' `pointText` takes `low`.

## Risks

- The toggletip popup now lives in the DOM next to its button. A toggletip inside an element with `aria-live` would read its popup into that region; Insights' tag moved out of its live lede for that reason, and no other toggletip sits in a live region.
- `/api/status` reads `automated.json` on each poll (every minute, every 3 s during an ingest). The file is small and the pages already read it on every request.
