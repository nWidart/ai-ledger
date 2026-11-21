# Design

## Context

Errors is the one page ported from a standalone HTML template. Activity and Cost settled the app's patterns since: page-level filters in the top bar, chart options in the chart's header, `.panel` sections, a `ChartTable` disclosure under each chart, vitals two to a row on a narrow screen, and copy without contractions. This change brings Errors onto those patterns and adds two triage views. No payload, store or server change: everything here is computed from what `/api/errors` already returns.

## Decisions

### Controls where they act

- **Top bar**: `Filters` with no page children: project, range and source. The parallel `regroup-nav-and-judgments` change trims `Filters` itself; this change only stops passing children, so the two do not touch the same lines.
- **Day / Week**: a `.seg#fGran` (`role="group"`, "Granularity") in a `.chart-head` row beside the chart's title and hint, the markup Activity and Cost use. The `.chart-head` rule in `components/chart.css` is scoped to Activity and Cost, so Errors gets its own copy in `errors.css` rather than a change to a shared file.
- **Include subagents, Hide noise and muted**: in a `.ttools` toolbar above the type table, after the filter box. They still filter the whole page (summary, chart, table), as before; the table is where their effect shows, rows coming and going. The toolbar shows even when the filter box hides (no type in the view), so a view emptied by "Hide noise and muted" can be undone where it was done.
- The ids (`fGran`, `fSub`, `fNoise`), URL keys (`gran`, `sub`, `noise`) and the saved view are unchanged.

### Four columns that fit

The master pane at 1280px is 568px of table: the 1240px wrap less 16px gutters, split 1.05 : 1 with a 16px gap, less the panel's 20px padding and 1px border. The table uses `table-layout: fixed` with a `colgroup`: figure columns of 7.5rem, 8rem and 7.5rem (368px), leaving the type 200px. A fixed layout cannot grow past its container, so no width scrolls sideways. Widths are in rem, so they follow the browser's text size and the breakpoints (in em) take over at larger text.

- Mid widths (901–1100px) and phones narrow the figure columns and drop the sparkline drawing, never a column: every column holds a sort. Phones stack the share's percent under its bar and let headers wrap.
- **Two figures, one header.** A column of two sortable figures (Errors · Rate, Time lost · Not recovered) has a header with two sort buttons, one per line. `aria-sort` sits on the header while either sorts the table; the arrow marks the button in use, and `aria-pressed` says it to a screen reader, as `aria-sort` reads the same for Errors and Rate. One toggletip explains the column.
- **Wide figures wrap.** `td.num` is `nowrap` page-wide; the Errors cell's first line is not, so a rate that does not fit beside its count wraps under it. The count breaks only after a thousands separator (a `<wbr>` there), so 1,000,000 fits a phone's 4.5rem column.
- **Change is a toggletip.** The rates behind "2 → 9", or the reason for "–", were screen-reader text only. The figure itself is now a `Toggletip` (named "Change: 2 → 9"), so the keyboard and the pointer reach it too; a wrapping span stops its click from opening the row. Trend's header is a label, then the Change sort button. This is a local `SortCol` in `TypeTable.tsx`; the shared `SortTh` stays a one-key header.
- **Share** loses its column and becomes a bar under the count, with its percent (and "of errors" for a screen reader). It still sorts with Errors.
- **Not recovered** replaces "Didn't recover": the uncontracted name, as a subline of Time lost ("37% not recovered"), with "N of M incidents" as screen-reader text. The hover title goes: it was hover-only.
- **Fix tick**: the sparkline's existing `marks` draw a green dashed tick at the bucket of the recorded fix day; a screen-reader note in the cell says the trend marks the fix. The sparkline spans the range from its first day (`f.start`), not from the view's first call (`f.from`, where the chart starts), so a fix recorded before that call keeps its bucket, and every row shares one axis. Where the sparkline is hidden (mid widths, phones) the note hides with it; the Fix applied chip still names the day.

### Chart data table

`ChartTable` + `DataTable`, as under Activity's and Cost's charts: one row per chart point (folded stretches as their span), with tool calls, failed calls, the rate the line draws (the selected type's when one is, with "too few calls for a steady rate" for a hollow point), then the failed calls of each type layer and Other. Absent when the chart shows a message instead of its drawing.

### Applied-fixes scorecard

A table under Rising fastest in Where to start: Type (with the fix day), Before, Since and Verdict for every recorded fix, newest first. It calls `beforeAfter`, the same statistically gated model the type detail uses (all time, under the project, source and subagent filters, a verdict only once the calls since the fix are enough for the old rate to have produced 5 errors and at least 200), so the scorecard and the detail never disagree. A type with errors in the view is a button that opens it. Hidden when no fix is recorded. It sits outside the "no errors in this range" branch: fixes are judged over all time.

### Retry attempt strip

`attemptStrip(g)` in `model.ts` turns an incident into marks and a text; `AttemptStrip` in `Examples.tsx` draws them as a small SVG in the incident button.

- The payload has each failure's start time, the recovering call's time, and only a count of the successful calls in between. So the strip draws failures at their times and the recovery once; the calls in between stay in the row's text.
- **Length is the cue.** The strip's length grows with the failures' span on a square-root scale, 20 to 120 units over 0 to 3,600 seconds. Failures sit at their times along it. Three failures in 4s make a 27-unit strip whose marks touch; three over 10 minutes a 70-unit strip with marks 25 units apart. A per-incident scale would make both look the same.
- The ✓ follows the last plotted failure at a fixed 12 units over a dotted step, a zero span included (every failure at the strip's start): a recovery 30 minutes later must not stretch a tight loop. The text says when it came.
- **Text alternative**: "3 failed attempts over 4s, 2s apart on average, then the next call succeeded 2s later" (or "then no further call", "then the next call failed too") in a visually hidden span; the SVG is `aria-hidden`. It joins the incident button's name, so a screen reader hears the pattern with the row.
- Sized in rem, so it follows the text size. Colors are `--critical` and `--good-text` strokes, with the shapes (✕, ✓) carrying the meaning beyond color. `--good` drops to 2.92:1 on the row's `--surface-2` hover in light mode; `--good-text` keeps well over 3:1.

### Legacy fix markers

Markers an older page kept in localStorage are read once and imported. `loadFixes` keeps only real calendar days (`isDay`, moved from Activity's search to `url.ts` to share it): the marks hook shows the browser's markers before the import runs, and a malformed day ("not-a-day") would make `beforeAfter` throw in the scorecard on the first render. A malformed marker is dropped with the key after the import.

### Rate chart role

The chart box is `role="group"` with no `aria-roledescription`, as the Errors spec requires: a custom role name would replace "group" in what a screen reader says.

### Narrow-screen summary

The summary drops its fold: the date line, the uncategorized share and all four vitals show at every width, vitals two to a row below 900px, as Activity, Cost and Insights do. The lede and gaps tighten on a phone. The rest of the page already sits below the summary, and the vitals are four short tiles.

### Copy and dropped lines

Every user-facing "Couldn't", "didn't", "can't" and "doesn't" in the page becomes "Could not", "did not", "cannot" and "does not", in the page, the marks' messages and their tests. The date line no longer appends "Ingested …", and Where to start's footnote keeps only the sentence about fix markers living in the store.

## Testing

jsdom has no layout, so the 1280px fit is tested on the stylesheet's budget: the test reads `table-layout: fixed`, the three rem widths outside any media query and the numbers the pane rests on (`.wrap`, `.panel`, `.grid2`), and asserts the type column keeps at least 12rem. A rule that hides a column fails it. The layout was also checked in Chromium at 1280, 901 and 390px against the demo store: no cell overflows and the table's scroll width equals its width.

The budget cannot see a figure that spills out of its cell, so `tools/demo/typefit.mjs` checks that in a real browser: against the demo server, it gives the first row the widest figures the page shows (1,000,000 errors at 100.00%, 23h 59m lost, ▲ +1,000%), then measures every element of each cell at 1280, 1000 and 390px, and exits 1 naming any that leaves its cell or a table that scrolls sideways.

## Risks

- The parallel `regroup-nav-and-judgments` change edits `Filters`, the nav and the `UsageSheets` mount in `ErrorsPage.tsx`. This change only removes the children passed to `Filters` and its `Toggletip` import; a merge touches neighbouring lines at most.
- Both changes may modify `dashboard-app`; this one modifies only "Put method text behind How measured".
