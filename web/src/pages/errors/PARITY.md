# Errors parity checklist

Every behavior of the old Errors page (`dashboard_template.html`, "L" = its line numbers) that the React port keeps. Sources:
the README "Errors" paragraph, the `dashboard-app` spec delta, and the old page itself. A line is checked once it was seen
working in `npm run dev` at desktop width (1280px) and at 390px; a line that only applies at one width (the wide sticky
header, the sheet) was checked at that width, and the sheet's pinned search at 800px. Numbers were compared with the old page
on the live store for the same view (lede, vitals, table, legend, selection panel, detail text: identical). "Port:" names
where the new code does it.

## Loading

- [x] L259, L292–309: "Loading errors…" status card until `/api/errors` answers. Port: `ErrorsPage` (`#load`).
- [x] L296–302: a failed load turns the card into an alert ("Couldn't load errors. HTTP 500. Check that the app is running.") with Retry, and focuses Retry. Port: `ErrorsPage`.
- [x] L303–304, L1079: Retry shows "Loading errors…" again; once loaded after a retry, focus goes to the lede and `#pageLive` says "Errors loaded". Port: `ErrorsPage` layout effect.
- [x] L311, L847, L969: project colors come from `project_order` (same hues as the other pages). Port: `setOrder` in `ErrorsPage`, `ProjectDot`/`useColors`.

## Filters and URL state

- [x] L246–255: header row: "Claude tool errors" kicker, project picker with color dot, range 7/14/30/90/All, Day/Week, "Include subagents", "Hide noise (harness, user rejections)"; "Include " and the noise note hide on phones (L51). Port: `Filters` + children in `ErrorsPage`.
- [x] L959–970: the picker lists every project with errors or tool calls, busiest first, as "name — N errors (all time)", plus the selected project even with no data. Port: `makeModel().projects`, `ErrorsPage` `projects`.
- [x] L326–337: the hash holds the view: `project`, `range` (always written), `sub=0` (no subagents), `noise=0` (noise hidden), `gran=week`, then `ex` (linked example) or else `cat` (open type), in that order. Port: `view.ts` `viewPatch`, `viewHash`.
- [x] L339–349: reading the hash: any view key makes the hash the whole view (missing keys take defaults); a bare `#ex=` link means all time; `#ex` opens that example's type; an unknown `cat` or `range` falls back (no type, 30 days). Port: `view.ts` `readView`.
- [x] Added since: a click on a chart bucket (Enter or Space on the focused chart's current point) selects it, `at=<bucket key>` in the hash, pushed to history and left out of `claude-errors-view`. The type table (Time lost too) and the open type's errors, counts, time lost and lists narrow to it; the vitals, chart, sparklines and Change stay range-wide. A chip by the table heading clears it. It clears when it is no longer a selectable chart point (`settle`: another granularity, outside the chart's span, folded). Port: `RateChart` `toggle`, `TypeTable`, `model.ts` `inBucket`, `settle`.
- [x] L320–321, L997: `claude-errors-view` (`{project, range, gran, sub, noise, cat}`) is written on every view change and fills an empty hash on load. Port: `ErrorsPage` effect, `readView`.
- [x] L351–354, L1030–1034: filter, range, granularity and type changes push a history entry; Back and Forward retrace them; mark/undo fix and mode changes replace. Port: `update(patch, push)` over `setHash`.
- [x] L1045–1047: Back, Forward and hash links re-read the hash, clear the example search, and scroll a linked example into view. Port: `ErrorsPage` popstate/hashchange listener + layout effect.
- [x] L683: a type with no errors under the new filters closes (unless an example is linked), and drops out of the hash. Port: `model.ts` `settle`, hash write-back.
- [x] L374–384, L385–387: filtering: range ends on the payload's `today`; all time starts at the first day with tool calls; project, subagent and noise (`infra`, `user_denied`) filters; call counts follow the subagent toggle. Port: `model.ts` `rangeStart`, `filtered`, `nCalls`.

## Briefing and vitals

- [x] L438–459: the lede: "N failed tool calls (r%), ↓/↑d% vs previous N days. <Top type> is x% of them." with the project (dot and name) when filtered; "flat" under 1%; "No failed tool calls … out of N." and "No tool calls … in this period." variants. Port: `Summary`, `model.ts` `summary`.
- [x] L442–453: the comparison is the previous equal period (from `error_days`), or for All time the second half against the first. Port: `model.ts` `summary`. Changed since: `compare` splits All time at the day that halves its calls and needs 200 calls a side (define-error-incidents).
- [x] L1003–1004: the date line: "Oct 8, 2026 to Nov 6, 2026 · Ingested <time>" or "All time to …". Port: `Summary` `#gen`.
- [x] L463–469: four vitals: Error rate, Change (green/red past ±1%), Incidents (with the "didn't recover" share, the recovered note and the type count), Fixes applied (with how many open types have a ready-made fix). Port: `Summary`.
- [x] L42–45, L264, L1048–1052: on phones only the first two vitals show; "More summary" / "Less summary" (aria-expanded, aria-controls `kpis gen`) shows the rest and the date line. Port: `Summary`, `errors.css`.

## Rate chart

- [x] L505–559: two panels on one time axis: error rate line above (own % scale), failed calls per day/week stacked by type below (own scale), axis titles, date labels thinned to fit, gridlines from `niceStep`. Port: `RateChart`.
- [x] L543–551: buckets without tool calls get a faint band, labeled "no activity" when wide enough; the rate line bridges them with a dotted line, never a lone dot (L573–583). Port: `RateChart`, `model.ts` `linePath`.
- [x] L412–421, L427–434: type colors: the all-time top-5 types keep their `--type-N` slot in every view; other top types fill free slots; the rest are "Other" grey; a selected type outside the top 5 gets its own layer in `--type-sel`. Port: `model.ts` `typeColors`, `viewTypes`.
- [x] L652–660: the legend: a pressed-state button per type (label, count) that selects or clears it; keys for "Other types", "Error rate"/"Overall rate", the selected type's rate, and "No activity". Port: `RateChart` `legend()`.
- [x] L639–651: selecting a type dims the other layers and fix markers, draws its own rate line in its color over a muted overall line, and renames the chart "Errors by type · <type> selected". Port: `RateChart`.
- [x] L661–671: the selection panel under the legend: count, share of errors, share of tool calls, incidents, and "Clear selection" (which closes the type and focuses the first table row). Port: `RateChart` `selOut()`.
- [x] L585–590: applied fixes draw a dashed green line with "✓ <type>" on their date. Port: `RateChart` `drawn.fx`.
- [x] L605–629: hovering shows a tooltip (date or "Week of", rate, errors, calls, per-type rows with the selected one bold, the selected type when it sits in Other; "No activity" for empty buckets) with a highlight band and a dot on the line; it flips left near the window's edge. Port: `RateChart` `tip()`.
- [x] L271–272, L630–637: the chart is focusable (`role=img` with instructions); Left/Right/Home/End read each point into `#chartLive`; blur hides the reading. Port: `RateChart` `key`.
- [x] L529–532: no tool calls in the range: "No tool calls in this range." instead of the chart. Port: `RateChart`.
- [x] L1044: resizing redraws the chart at the new width (debounced). Port: `RateChart` ResizeObserver.
- [x] L73, L87–95, L525: bars grow and the line draws in when the data changes (not on resize or selection); layers fade on selection; share bars grow in. Port: `errors.css`, `RateChart` (`svg` keyed by data).
- [ ] L73, L88, L801, L1007: none of that motion (nor the smooth scroll of Back to types, nor the detail fade) under `prefers-reduced-motion: reduce`. Port: `errors.css`, `reduced()` in `ErrorsPage` and `Detail`.
  Not verified: the preview browser can't emulate `prefers-reduced-motion: reduce`. Checked instead that every `.pg-errors` animation and transition rule sits inside `@media (prefers-reduced-motion: no-preference)` (CSSOM, no ungated rule) and that the JS paths check `matchMedia("(prefers-reduced-motion: reduce)")`.

## Error types table

- [x] L677–700: one row per type by count: swatch in its chart color, label button (aria-expanded, aria-controls `detail`), "✓ Fix applied <date>" chip, count, share bar with a tick under 3%, rate trend sparkline, half-on-half change (arrow past ±5%, "New", "–" with a title when a half has no calls). Port: `TypeTable`, `model.ts` `typeRows`, `change`. Changed since: a Time lost column (the sum of the type's incident spans, "–" with none); Change uses the summary's comparison, shows counts under 5 errors a side and no "New".
- [x] L696: empty states: "No tool calls recorded for <project>.", "No errors in this range 🎉", "No tool calls in this range.". Port: `model.ts` `emptyTypes`.
- [x] L697–700, L130: a click anywhere on a row (or Enter/Space on its button) opens the type, selected row tinted; clicking the open type closes it; opening moves focus to the detail title. Port: `TypeTable`, `pick`.
- [x] L123: Share and Rate trend columns hide on phones. Port: `errors.css`.
- [x] L702–716: sparklines: bands where no tool calls ran, dotted bridges across them. Port: `Spark`.

## Detail: where to start

- [x] L720–740: with no type open: "Where to start" (top 4 open types with a ready-made fix and no marker, by time lost then count, each with its time lost) and "Rising fastest" (top 4 types up more than 10% half on half with at least 5 recent errors, "New" for types from zero, "· noise", "Check the fix" when fixed); each opens its type and focuses it; the ingest/markers footnote. Port: `Detail` `WhereToStart`, `model.ts` `whereToStart`. Changed since: the summary's comparison, biggest rate gain first, counts under 5 errors.

## Detail: a type

- [x] L776–779: header (title, "Back to types", ✕ "Close detail"), why text with its three busiest tools, and the incident line ("N errors in K incidents, x% didn't recover (…). Largest: n attempts over t.") with its explanatory title. Port: `Detail` `TypeDetail`.
- [x] L780–786, L805: potential fix, the CLAUDE.md snippet and "Copy CLAUDE.md line" ("Copied ✓"; now "Copy instruction line", as Codex reads AGENTS.md). Port: `TypeDetail`.
- [x] L783–784, L806–808: "Applied on" date (default and max today), "Mark fix applied" (a future or incomplete date shows the browser's message), focus moves to Undo; Undo removes it and focuses Mark; "Applies to all projects". Port: `TypeDetail` `mark`/`undo`.
- [x] L319, L807: applied fixes live in `claude-errors-fixes` as `{"<type id>": "YYYY-MM-DD"}`; a value saved by the old page shows as a marker. Port: `view.ts` `loadFixes`, `ErrorsPage` `setFixes`.
- [x] L746–770: before/after the fix (all time, project and subagent filters only): two figures with their errors and calls and a verdict ("Rate lower/higher/unchanged", or "Not enough calls yet" until max(200, calls for 5 errors at the old rate) calls since the fix). Port: `Detail` `FixResult`, `model.ts` `beforeAfter`.
- [x] L853–863, L788: the mini rate chart (with the fix marker and peak) shows only while the main chart is out of view or the detail is in the sheet. Port: `Detail` `MiniRate`, `ErrorsPage` IntersectionObserver.
- [x] L842–852, L798: "By project" (only without a project filter): stacked share bar in project colors, top five as buttons that filter to that project, "N more: M errors". Port: `Detail` `ByProject`.
- [x] L801: "Back to types" scrolls the type's table row into view (smooth unless reduced motion) and focuses it. Port: `TypeDetail` `back`.
- [x] L800: ✕ closes the type (Back reopens it). Port: `TypeDetail`.
- [x] L1007: a newly opened type fades in (not under reduced motion). Port: `ErrorsPage` layout effect.

## Incidents and examples

- [x] L473–502, L771–772: failures grouped by the server's incidents (one tool, one session, one type, within `incident_gap_minutes`), counting only failures that pass the filters, sorted by attempts, then span, then latest. Port: `model.ts` `incidentsOf`, `byWeight`, `incSummary`.
- [x] L878–899: an incident row: attempts, project, tool, subagent, outcome badge ("Next call OK" with its title, "Failed again", "Gave up"), time span and duration, successful calls in between, chevron; opening it shows its failures in order and how it ended (the recovering call's input and delay, gave up, or failed again with the gap). Port: `Examples` `Incident`, `IncBody`.
- [x] L900–908: incident rows toggle open and closed (aria-expanded, aria-controls). Port: `Incident`.
- [x] L793–795, L832–836: "Incidents" / "Every error, newest first" switch; the choice persists in `claude-errors-mode` (`"inc"` or `"flat"`) and focus stays on the pressed button. Port: `TypeDetail` `setMode`, `view.ts` `loadMode`.
- [x] L809–831: the search ("Filter by command, error or project…") matches input, error, follow-up, project and tool; count line ("N in range, newest first", "N of M match", "… most attempts first"); "No incidents match." / "No examples match."; each keystroke is announced through `#detailLive`. Port: `TypeDetail`, `model.ts` `exList`.
- [x] L810, L837–840: lists show 20 incidents or 30 errors, then "Show more" adds a page and focuses the first new item. Port: `TypeDetail` `showMore`.
- [x] L864–876: an example: time, project, tool, "subagent", session link (to Activity with range, session and project), 🔗 Link and Copy URL; input, error (red), follow-up quote, "(summary as recorded)" for fields cut when recorded. Port: `Examples` `Example`.
- [x] L161–169, L942–948: long bodies are clamped; "Show full" appears only when a body is cut off, the payload cut the input (400 chars), or the example is open; "Show less" closes and scrolls back if the top went off screen (L1059–1063). Port: `Example`.
- [x] L911–939: "Show full" on an example with an id loads `/api/error?id=` once ("Loading…", aria-busy), shows the full text open, and announces it; a failure shows "Couldn't load full text · Retry" and announces it. Port: `Examples` `loadFull`.
- [x] L1065–1069: Copy URL copies the page URL with this example's permalink and shows "Copied ✓" for 1.5s. Port: `Example` `copy`.
- [x] L1071–1074, L1016–1020: a plain click on Link, or anywhere on an example (not a link, no text selected), selects it: highlight, `#ex=` pushed, list order unchanged. Modified clicks on Link open normally. Port: `Example` `click`, `ErrorsPage` `select`.

## Permalinks

- [x] L1021–1027, L1077: opening `#ex=<tool_use_id>` opens its type, puts its incident first and open (or the example first in the flat list), scrolls it to the center and focuses it. Port: `ErrorsPage` layout effect, `pin`.
- [x] L774, L790–792, L804: a linked example outside the filters shows in an "Outside current filters" note; "Clear filters" resets project, range (all), subagents and noise and focuses the example. Port: `TypeDetail`.
- [x] L335, L1031: `#cat=<type>` opens that type. Port: `readView`.

## Layout, sheet and focus

- [x] L216–222, L949–952: wide screens: the type header sticks under the nav and the example bar (count, mode, search) under it; examples scroll in below both. Port: `errors.css`, `TypeDetail` ResizeObserver (`--dhead-h`, `--exbar-h`).
- [x] L972–983, L225–233: up to 900px an open type shows in a modal sheet (`dialog#sheet`, labelled by the title); opening scrolls it to the top and focuses the title; the detail's header sticks in the sheet; "Back to types" is hidden there. Port: `ErrorsPage` placement, `errors.css`.
- [x] L231–237: in the sheet the example bar with the search stays pinned under the header between 521 and 900px; on phones (≤520px) only the header sticks. Port: `errors.css`.
- [x] L1036–1043: Esc, the backdrop and ✕ close the sheet; closing it closes the type (a history entry) and focuses that type's table button. Port: `ErrorsPage` close listener.
- [x] L978, L1035, L1040: crossing 900px moves an open detail between the page and the sheet, keeping focus on its title. Port: `ErrorsPage` placement.
- [x] L940–941, L285, L978: `#detailLive` (polite) gets short announcements via `say()` (cleared, then set on the next frame) and moves into the sheet with the detail. Port: `ErrorsPage` `say`.
- [x] L991–1014: a re-render never leaves focus on a removed control: it finds the same control again, else the open type's title, else the closed type's row button. Port: `ErrorsPage` layout effect (`focusKey`).
- [x] L212, L221, L233, L237: scroll targets (title, examples, incidents) clear the sticky nav, header and example bar. Port: `errors.css`.
- [x] Every Errors style is under `.pg-errors`; keyframes are prefixed `err-`. Port: `errors.css`.

## Differences from the old page

Deliberate, small, and noted here so a reviewer can undo any of them:

- A type id the rules don't list (or a null one) gets a category named by its id. The old page threw on it (the test fixture has one).
- The session link says "Open session … in Activity", and a plain click switches pages without a reload (modified clicks open a tab as before).
- "Couldn't load full text · Retry" stays until retried; the old page reset it to "Show full" on its next render.
- The table's rows mount again only when the filters change, so share bars grow in then, not on every click as the old innerHTML redraw did.
- The summary's "Uncategorized" line (the share of errors in the catch-all types Other, Other non-zero exit and MCP tool error, split by agent when the view shows several) is new; the old page had no such line. Port: `Summary`, `model.ts` `uncategorized`.
- Before the data arrives only the header and the load card show; the old page showed empty card shells.
- New data after an ingest (the nav's status poll clears the API cache) re-renders the page in place; the old page loaded once.
- Keys the Errors page doesn't own (`auto`, set by Activity and Cost) stay in the hash, so they carry on to the other pages.
- The saved view's `cat` must name a known type.
- After a re-render, focus first looks for the same control inside the container it was in; the old page could land on the legend button that shares a table button's `data-c`.
- "Show more" resets when the view, mode, search or fixes change; the old page reset it on any render.
- The chart redraws from a ResizeObserver on its box (debounced 120ms) instead of the window's resize event.
- The sheet is the page's own `<dialog>`, not the shared `Sheet` component: the detail keeps its own sticky header and pinned search bar, closing returns focus to the type's table button (not to whatever opened it), and widening past 900px moves the detail back beside the table with focus on its title.
