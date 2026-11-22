# Design

## Context

See `proposal.md` for the motivation. The reader's question is "when do I work with agents, and which days stand out". Every open choice below is settled from that reader's side.

"The wrapper" is `<EChart>` in `web/src/components/echart/EChart.tsx`. Its files (`EChart.tsx`, `option.ts`, `stack.ts`, `testing.ts`, `zoomReset.tsx`, and `realTesting.ts` on another branch) belong to another team. **This change edits none of them.** Everything the calendar needs is in `web/src/pages/activity/calendar/`.

**Facts checked in the code** (base `4de1da48`).

- `/api/usage` answers the page's range only. `metrics.usage()` builds `daily_work` with `daily_work(cur, rq, rp, W, fp)`: one row per day with `sessions`, `prompts`, `commits`, `calls`, `failed_calls`, and no row for a day with none. The route takes any integer range of 0 or more; the UI offers 7, 14, 30, 90 and 0 (`RANGES` in `web/src/url.ts`).
- The work chart's switch offers Commits, Prompts and Sessions (`METRICS` in `work.ts`). All three are per-day figures of `daily_work`. `ActivityPage.tsx` holds the choice and keeps it in `localStorage`.
- A work chart pick writes `day=` (or `week=`) with `setSearch(…, { push: false })`, clears `q` and `near`, and resets the Sessions sort. `/api/day` and `/api/sessions` clip a day to the range (`on_day()`): a day before the range's start counts nothing.
- `applyPatch()` in `url.ts` drops `day` and `week` in any write that changes the project, the range or the source. One write cannot set a new range and a day.
- `dashboard-app` requires that at 1440×900 the work chart starts and the workbench tab list ends in the first 900px. The archived `echart-activity` design measured the tab list ending at 842px, and at 870px with the zoom slider: 30px are free.
- The wrapper's keys are `ArrowLeft`, `ArrowRight`, `Home` and `End`, each a step of one point (`STEPS`). Its pointer reads `convertFromPixel({ xAxisIndex: 0 }, offsetX)` inside `containPixel({ gridIndex: 0 })`. Its band is the axis pointer of x axis 0, and a key's tooltip sits at the top of grid 0. Nothing outside the wrapper can set or learn the point being read.

**What a spike measured** (ECharts 6.1.0, the SVG renderer, in vitest and jsdom, through the real wrapper with `vi.unmock` of `components/echart/load`; `npm run build` and `node scripts/check-bundle.mjs` for sizes; a seeded demo store of 10,583 requests for timings; the spike files are deleted). No browser was used: what only a browser shows is listed under decision 12 and checked in step 4.1.

| Question | Result |
|---|---|
| Way (a): `CalendarComponent` added to `echarts.ts`, cells by the custom series | ECharts chunk 180.1 kB gzip, from 176.5: +3.6 kB |
| Way (b): `HeatmapChart`, `CalendarComponent` and `VisualMapPiecewiseComponent` | 189.7 kB: +13.2 kB, 5.3 kB under the 195 kB limit |
| Way (c): a custom series with `coordinateSystem: "none"`, cells placed by a pure layout, no grid, no axis | Chunk unchanged, 176.5 kB. 182 cells of 26 weeks drawn in a 343px box, each at the layout's pixel: first cell at 30, 18, last at 330, 90, 10px square, right edge at 340 of 343. No error, no warning. The same on a hidden grid. |
| Text drawn by a custom series (`type: "text"` in a group) | Drawn as `<text>` at the given x and y, `font-size` 11px, and 22px at a 32px root font size |
| The wrapper with `points={26}` (a week per point): Up and Down? | Not handled: the key is left to the browser and the reading stays where it was. Left, Right, Home and End move a week. |
| The wrapper's pointer over two rows of one column | The same point both times: the reading knows the column only |
| The wrapper with `points={0}` | Every key is left alone (not prevented, nothing read). A pointer move and a click read nothing and log nothing, with a grid in the option and with none. |
| A custom series that is not `silent`, with `emphasisDisabled` on its shapes | zrender sets the `pointer` cursor over a cell and `default` over the margin. No fill changes under the pointer. |
| Forced colors (`env.forced`), 10px cells | An empty day as an unfilled 10px square with a 1px stroke; steps as centred filled squares of 3, 5, 8 and 10px, all in `CanvasText`; labels in `CanvasText` |
| Motion: does a custom rect animate on the first drawing? | No. With `animation` on, the first frame already holds each path whole, with no opacity or transform. |
| The calendar's queries against `usage()` | `/api/calendar`'s four queries: 17.8 ms. `usage()`: 198 ms at range 0, 219 ms at 30, 229 ms at 371. The calendar's rows equal `usage(range=0).daily_work` on every shared day. |

## Goals / Non-Goals

**Goals:**

- A year of days at a glance on a desktop, half a year on a phone, with no sideways scroll.
- One figure per cell that the reader already knows: the work chart's measure.
- A day reached by pointer, by touch and by keyboard, and selected as the work chart selects it.
- Nothing new in the ECharts chunk. Three more graph types are coming and 18.5 kB are left.
- No edit to the wrapper's files.

**Non-Goals:**

- Any change to the work chart, its switch, its selection or its zoom, or to the outcome trend.
- A free time range, a zoom, or a way to page back past 53 weeks.
- A strip per project, a calendar on the Project page, or a calendar on Judgments.
- Cost, tokens or error rate as the shade.
- A legend that filters.

## Decisions

### 1. Draw with the custom series on no coordinate system

Way (c). The cells, the labels and the selection frame are custom series with `coordinateSystem: "none"`. A pure layout gives every pixel.

Why: it costs 0 kB of the ECharts chunk (measured: 176.5 kB), against 3.6 kB for the calendar component and 13.2 kB for the heatmap way. It loses nothing for the reader: the spike drew every cell at the layout's pixel. It also gives what the calendar component cannot: the layout is known without the chart, so the pointer test, the reading mark and the tooltip work before the drawing code has loaded and when it fails to load, as `dashboard-app` requires of a chart.

Alternatives: the calendar component (a) would place the cells itself, and its `cellSize` and month labels would have to be made to agree with the pointer test. The heatmap way (b) adds a visual map that draws its own legend, which the house style replaces with an HTML key.

Rules that follow:

- `web/src/components/echart/echarts.ts` is not edited. No registration line.
- The option holds no `grid`, `xAxis`, `yAxis` or `dataZoom`. The wrapper adds `axisPointer: { triggerOn: "none" }` and `dataZoom: []`; the spike drew such an option with no warning.
- The option sets `animation: false`. A cell does not grow, and the spike shows a custom rect draws whole at once in any case.

### 2. Span: 53 weeks from the server, the recorded weeks that fit on screen

- The server answers the 53 weeks that end with the current week: from the Monday 52 weeks before this week's Monday to today, 365 to 371 days. A whole year is always there, so the reader sees the same date last year.
- The chart shows the newest weeks that hold recorded days: from the week of the first recorded day to this week, at least 13 and at most the `weeks` that fit (`shown = min(weeks, 53, max(13, recorded weeks))`; with no recorded day, `min(weeks, 53)`). `calendarModel()` owns the rule, so the hint, the label, the month labels, the table, the reading and the view key all follow one number. A store 11 weeks old would otherwise fill a fifth of a desktop box, with months labelled over empty columns; the floor of a quarter keeps a store a week old from being a sliver. The cells keep the fit's size and the block stays at the left margin, so a short history is a narrower block, not larger cells.
- `weeks` and the cell size come from the box's width and the text scale, by one pure function, `calendarFit(width, textScale)`:

| Name | Value |
|---|---|
| Left margin (weekday labels) | 30px × text scale |
| Top margin (month labels) | 18px × text scale |
| Right, bottom margin | 2px |
| Smallest pitch (a cell and its gap) | the larger of 12px and `ceil(0.6 × 11px × text scale)` |
| Largest pitch | 20px |
| Gap | 2px, and 3px from a pitch of 16px |

```
plot  = width − left − right
fit   = floor((plot + 2) / 53)
weeks = 53, pitch = min(20, fit)                      when fit ≥ smallest pitch
weeks = floor((plot + 2) / smallest), pitch = smallest   otherwise
height = top + 7 × pitch − gap + bottom
```

| Box | Text | Weeks | Pitch, cell | Height |
|---|---|---|---|---|
| 1174px (a 1440px window: `.wrap` 1240px, the panel's padding and border) | 16px | 53 | 20px, 17px | 157px |
| 800px (jsdom's fallback width) | 16px | 53 | 14px, 12px | 116px |
| 343px | 16px | 26 | 12px, 10px | 102px |
| 309px (a 375px window, inside the panel) | 16px | 23 | 12px, 10px | 102px |
| 343px | 32px | 20 | 14px, 12px | 134px |
| 1174px | 32px | 53 | 20px, 17px | 175px |

- The phone case is fewer weeks, never a scroll: the block is at most `plot` wide by construction (26 weeks × 12px − 2px = 310px in a plot of 311px).
- The cells keep their size at a larger text size, as the work chart's bars keep their height. Only the smallest pitch grows a little, so two weekday labels two rows apart (1.2 × the font size) never touch.
- The component measures its own box with `useWidth()` from `components/chart.ts`, in a layout effect: the box has its final height before the first paint. Nothing sits under the calendar (decision 9), so a later resize moves no content.
- The cells do not stretch to fill the box. On a 1174px box the block is 1057px wide and starts at the left margin.
- Labels. Weekdays: "Mon", "Wed", "Fri" on rows 0, 2 and 4, right-aligned 6px × text scale before the first column. Months: the short month name over the first column whose Monday is in that month, left-aligned on the column. A month label is left out when the next label starts less than 28px × text scale after it, or when it would end past the box. The first, cut month is the one usually left out.

Alternative: one fixed span of 26 weeks at every width. Rejected: a desktop column would show half of what fits. Alternative: 53 weeks at every width with smaller cells. Rejected: a 343px box gives a 5.9px pitch.

### 3. Data: a new endpoint, `/api/calendar`

```
GET /api/calendar?project=&source=&automated=
→ { project, automated, source, start, end, first, days: DailyWorkRow[] }
```

- `start`: the Monday 52 weeks before the Monday of the week of `end`. `end`: the local today. `first`: the first day with a request under the same filters, over all time, or null. `days`: `daily_work()` over `start` to `end`, the same function and the same filter the work chart's rows come from, so a day's figure is the same on both charts (measured equal).
- `metrics.calendar(cur, project="", today=None, automated=False, source="")`: `view(project, span, {}, today, automated, source)` for the rows, `view(project, 0, …)` for `first`. No prices are read. A bad source raises `ValueError`, which the route answers with 400, as the other routes do.
- The filters apply as on every Activity figure: the project, the source and the automated-sessions filter, through `scope()`. Nothing is source-specific: Claude Code, Codex and Grok sessions are rows of the same derived tables.
- It takes no `range`. The query key is `["calendar", { project, automated, source }]`, so a change of range requests nothing. An ingest or Refresh invalidates it with the rest (`isData`).
- Cost: four aggregate queries (sessions, prompts and tool calls per day over at most 371 days, and one `min`). Measured at 17.8 ms where `usage()` takes 198 to 229 ms. On a large store it scales as the three `daily_work` queries that every `/api/usage` already runs, bounded by 371 days whatever the store's age.

Alternatives:

- A second `/api/usage` request with `range=371`. Rejected: it runs every query of the page (sessions, tools, models, loops, the previous period) for three columns: 229 ms measured against 17.8 ms, and it would refetch with nothing to gain on every range change if keyed like the page's.
- A `calendar` field on the `/api/usage` payload. Rejected: Cost and the Project page request the same payload and would pay for it; every usage fixture would change; and the field would be refetched with each range.

### 4. Measure: the shade follows the work chart's switch

The cell's shade is the measure chosen on the work chart: Commits, Prompts or Sessions. Each is a per-day figure, so none needs a fixed stand-in. The calendar has no switch: one control, one state, in one place. Its heading line and its key name the measure, and its hint says where the switch is. The tooltip and the live sentence always give all three figures.

### 5. Scale: at most four steps, cut by rank, with a text key

- The values are the measure of every recorded day of the payload with a value above 0, all 53 weeks, whatever the box shows: a day has the same shade at every width.
- Cuts by nearest rank: `cut(p)` is the value at position `ceil(p × n)` of the `n` sorted values. The upper bounds are the distinct values of `cut(0.5)`, `cut(0.8)` and `cut(0.95)`. When the largest value is above the last bound, one more step is open-ended.
- A step covers the values above the bound before it up to its own bound; the first starts at 1.

| Steps in use | Shades, lightest to darkest of four |
|---|---|
| 1 | 3 |
| 2 | 2, 4 |
| 3 | 1, 3, 4 |
| 4 | 1, 2, 3, 4 |

| Values with any | Steps |
|---|---|
| 1, 1, 1, 2, 2, 3, 5, 8, 13, 40 | 1–2, 3–8, 9–40 |
| every day 1 | 1 |
| 40 days, the two largest 30 and 44, `cut(0.95)` 21 | …, up to 21, 22+ |
| none | no step: the key says "No commits yet" |

Why rank cuts: agent work is bursty. With equal-width steps up to the maximum, one day of 80 commits puts every other day in the lightest step, and "when do I work" is lost. With quartiles a quarter of the active days share the darkest step, and "which days stand out" is lost. The median, the 80th and the 95th percentile keep both: the darkest step holds about one active day in twenty.

- The key is HTML, in the legend row: "No commits", then one swatch and its numbers per step ("1–2", "3–8", "9+"; one number when a step holds one value). The key's swatches are hidden from assistive technology with the rest of the legend; the group's label and each reading carry the figures.
- The shades are four new color tokens in `theme.css`, `--heat-1` to `--heat-4`, each a `light-dark()` pair of plain colors as `--series-1` is, so `resolveColor()` gives an `rgb()`. Starting values: light `#a8c7ec`, `#6a9fe0`, `#2a78d6`, `#153f77`; dark `#26466b`, `#2d5b93`, `#3987e5`, `#8fc0f8`. In dark, more is lighter. An empty day is `ink.grid`. The rule the values must meet, checked in a browser (step 4.1): each shade has a luminance contrast of at least 1.3:1 with the next, and the first with the empty cell, in both themes. The builder changes the values, not the rule.
- A reading in the top step, when three steps or more are in use, ends with "Among the busiest days for commits." A reader who cannot see the shades still learns which days stand out.

### 6. Reading: the calendar's own, in two directions

**What the wrapper lacks** (measured, see the spike):

1. Keys. `STEPS` is fixed: Left and Right move one point, Home and End go to the ends. Up and Down are not read, and no prop gives a key its step.
2. Pointer. The point is the band of x axis 0 under `offsetX`. The row under the pointer is not read.
3. Place. The reading mark is the axis pointer's band over a whole column, and a key's tooltip sits at the top of grid 0. Neither can sit on one cell.
4. No prop tells a chart which point is read, and none lets it set one.

With a week as the wrapper's point, Enter could not name a day. With a day as its point, Left and Right would move one day down a column, and the pointer would read the wrong day in six rows of seven. Workarounds around the wrapper's own reading were weighed and dropped: each needed a synthetic key event, a `flushSync` in a capture handler, or a probe component in `tip` to learn the point read, and each left the live region holding the wrong day after a pointer move inside one column.

**So the wrapper draws and the calendar reads.** `<EChart>` gets `points={0}`, no `tip`, no `onActivate`, no `status`, no `onEscape`, and `read={() => ""}`. Measured: with `points={0}` the wrapper leaves every key and every pointer event alone and says nothing. The wrapper still gives the focusable `role="group"` box with its label, the lazy load, the environment, the resize and the "could not be drawn" text.

The reading lives in two files of the calendar's folder:

- `gridReading.ts`, pure: `moveDay(at, key, n)`, the index a key reads, and `cellAt(fit, x, y)`, the column and row under a pixel.
- `ActivityCalendar.tsx`: the state `{ day, keyed, text } | null`, the handlers on a `div.cal-box` around the wrapper's box, the tooltip, the mark and the live region.

**Keys**, on the focused box (the event bubbles from the wrapper's box to `div.cal-box`, which prevents it). `n` is the number of readable days, oldest first: from the later of the first shown Monday and the first recorded day, to today.

| Key | With a day read | With nothing read |
|---|---|---|
| Right | 7 days later, or the last day | the first day |
| Left | 7 days earlier, or the first day | the last day |
| Down | the next day, or the last day | the first day |
| Up | the day before, or the first day | the last day |
| Home, End | the first day, the last day | the same |
| Enter | selects the day (decision 7) | left to the browser |
| Escape | ends the reading | clears a selection (decision 7) |

- Left and Right move a week because a column is a week; Up and Down move a day because a row is a weekday. Down from a Sunday reads the Monday of the next week: the keys never stop inside the span, so every day is reachable by Up and Down alone.
- Left and Right stop at the first and the last day, also when that day is another weekday. A reader who holds Left always ends on the first day.
- Up and Down are prevented, so the page does not scroll under the focused calendar. A key with Alt, Ctrl, Meta or Shift is the browser's (`modified()` in `components/keys.ts`).
- Blur ends the reading. Escape ends it from anywhere when the pointer opened it: a capturing `keydown` listener on the document, added while a reading is open, as the wrapper has it.

**Pointer.** `mousemove`, `mouseleave` and `click` on `div.cal-box`. The position is the event's client position less the box's; `cellAt` gives the cell, and its gap to the right and below counts as the cell, so the tooltip does not flicker between cells. A cell with no readable day, a margin or a label reads nothing. A click reads and then activates. A touch reaches the box as the browser's compatibility `mousemove` and `click`.

- The hand cursor is zrender's: the cells' series sets `silent` only while the calendar takes no pick. Measured: `pointer` over a cell, `default` over the margin. Every cell shows the hand, idle ones included, as on the work chart.

**The tooltip.** A `div.tip` with `role="tooltip"` inside `div.cal-box`, placed with `tipAt()` from `components/chart.ts`: beside the pointer, or, for a key, at the right edge and the middle of the cell. Rows: the weekday and date; Commits, Prompts and Sessions, the chosen one keyed by its shade; "No activity" for an idle day; and for a day outside the page's range, "Outside the last 30 days. Selecting it sets the range to the last 90 days."

**The live region.** One `div.sr` with `aria-live="polite"` in the component. It holds one of: a reading's sentence, or a status (decision 7). The wrapper's own region stays empty.

| Case | Sentence |
|---|---|
| A busy day | "Tuesday, Nov 4, 2026: 12 commits, 40 prompts, 6 sessions." |
| A day with work and none of the measure | "Friday, Nov 7, 2026: 0 commits, 3 prompts, 1 session." |
| An idle day | "Sunday, Nov 9, 2026: no activity." |
| In the top step, with three steps or more | the day's sentence, then " Among the busiest days for commits." |
| Outside the page's range | the day's sentence, then " Outside the last 30 days; selecting it sets the range to the last 90 days." |

- "No activity" follows `busy()` in `work.ts`: no session, prompt, commit or failed call.
- A reading a key made is said again when newer data changes its words. The pointer's is not; its tooltip shows the newer figures. This is the wrapper's rule.
- Newer data keeps the reading: it is held by the day, not by an index. It ends when the day is no longer shown.

**The group's label**, on the wrapper's box:

- With work: "Commits per day as a calendar, 26 weeks from May 25, 2026 to Nov 22, 2026, in columns from Monday to Sunday. 84 days with commits, the most 31 on Tuesday, Oct 6, 2026. Use the arrow keys to read a day: left and right move a week, up and down a day, Home and End go to the first and last day. Enter selects the day and Escape clears the selection."
- With days and none of the measure: "… from Monday to Sunday. No commits yet. Use the arrow keys …"
- With no recorded day: "… from Monday to Sunday. No activity yet."

**The visible lines.** Heading: "Activity calendar". Hint: "Commits per day, last 26 weeks. The shade follows the measure chosen on the work chart. Select a day to narrow the tabs." with a "How measured" toggletip (docs `reference/glossary#activity`): weeks start on Monday; how the steps are cut; a day before the first recorded day has no cell; the keys. When the first recorded day is inside the weeks shown, the legend row ends with "Recording starts Sep 8, 2026".

### 7. Selection: the work chart's, plus a range that holds the day

Enter on the day read, or a click on a cell:

| The day | What happens |
|---|---|
| Idle (`busy()` is false) | Nothing. The reading stays, as on the work chart. |
| Busy, inside the page's range | The page writes `day=`, clears `week`, `q` and `near`, and resets the Sessions sort: the work chart's own pick. |
| Busy, outside the page's range | The page first sets the range to the smallest of 7, 14, 30, 90 days that holds the day, or all time, then writes the day as above. |
| Any, while a new view or newer calendar figures load | Nothing: the component gets no `onPick`, as the work chart. |

- Why widen the range and not decline: the reader came to ask about that day. Without a range that holds it the tabs would count nothing (`on_day()` clips to the range), and the reader would have to find the range control, guess a range and come back. The tooltip and the reading say what the pick will do before it is made, and the status says what it did.
- Two URL writes, in this order: `setSearch({ range })`, which pushes a history entry and drops the earlier `day` and `week` (`applyPatch`); then `setSearch({ day, week: null, q: null, near: null }, { push: false })`. Back returns to the earlier range with its earlier selection. One write would lose the day.
- `rangeFor(day, end, range)` in `calendarDays.ts`: the page's range when it holds the day; else the smallest of 7, 14, 30, 90 whose first day is on or before it; else 0.
- After a pick the page brings the workbench into view and moves the focus to the selected tab's panel, by the mechanism the vitals use (`goal` in `ActivityPage.tsx`). The tab does not change. The tabs are above the calendar (decision 9): without this a pick would change nothing on screen.
- The work chart shows the selection as ever: its chip names the day, and a chart by day frames its bar.
- Escape on the calendar with nothing read clears a selection, as on the work chart.

**Status**, said once by the calendar's live region, in place of a reading:

| What happened | Status |
|---|---|
| A day inside the range is selected | "Nov 4, 2026 selected; the tabs show its figures." |
| A day outside the range is selected | "Mar 3, 2026 selected; the range is now the last 90 days, and the tabs show its figures." (or "… is now all time, …") |
| Escape clears a selection | "Selection cleared; the tabs show the whole range." |
| The selection changes from outside the calendar | Nothing: a held status is dropped |

Selecting the day already selected writes nothing and still brings the tabs into view.

### 8. Marks, forced colors, dark and motion

- **The selected day**: a frame on its cell, a custom series with `id: "selected"` over the cells. Theme: a 1.5px line in `ink.accent`, inset by half the line, no fill, so the shade stays readable. Forced colors: 2px in `ink.accent`, which is `Highlight`. A selected week (`week=`, from a weekly work chart) is one frame around that column's cells. A selection outside the weeks shown draws nothing.
- **The day being read**: a ring around its cell, 1px off it: an `<i class="cal-cursor" aria-hidden="true">` in `div.cal-box`, placed from the same layout as the cells, with a 2px outline in the text color and `Highlight` in forced colors. It is HTML so that reading redraws nothing and works before the chart has drawn. The two marks differ by place, not by hue alone: the frame is on the cell's edge, the ring is outside it. A day selected and read shows both.
- **Forced colors.** A shade is not a system color and its steps have no sure contrast on the user's `Canvas`. A cell is then: an empty day, an unfilled square with a 1px edge in `ink.grid` (`GrayText`; the spike drew it in `CanvasText`, which made the empty days louder than the days with work); a step, a centred filled square in `ink.text` (`CanvasText`) whose side is the cell × shade / 4, 3px at least. The key's swatches are the same squares, by a `forced-colors` rule in `calendar.css`. The labels are `CanvasText`.
- **Dark.** The four tokens carry both schemes; the wrapper redraws on a theme or scheme change.
- **Reduced motion.** Nothing animates in either mode (`animation: false`). The page's scroll to the tabs after a pick is `smooth` only with motion on (`motion()`), as the vitals' is.

### 9. Place: the last section of Overview

The section comes after the workbench tabs.

Why: above the tab list it would add its head and 102 to 157px to a first screen with 30px free, and break "Show the main chart in the first screen". It is a second question, asked after "what got done in this range", and it does not follow the range that every section above it follows. A pick still reaches the tabs (decision 7).

`usage-dashboard`'s "Order the Activity page" names the new last place. The first-screen check needs no new line; step 4.1 runs it to show the first screen did not move.

### 10. The option and the view

```ts
{
  ...baseOption(env), animation: false,
  series: [
    { type: "custom", id: "cells", coordinateSystem: "none", silent: !pick, data: [[0], [1], …],   // one item per day shown
      renderItem: (_, api) => cell(api.value(0)) },                                                 // a rect, emphasisDisabled
    { type: "custom", id: "labels", coordinateSystem: "none", silent: true, data: [0],
      renderItem: () => ({ type: "group", children: [...weekdayTexts, ...monthTexts] }) },
    // with a selection in the weeks shown:
    { type: "custom", id: "selected", coordinateSystem: "none", silent: true, z: 3, data: [0], renderItem: () => frame },
  ],
}
```

- `baseOption()` is imported from `option.ts` as it is; the labels use its font, at 11px × text scale, in `ink.muted`.
- `calendarModel(payload, metric, weeks, selection)` holds the weeks shown, the readable days (each with its column, row, figures, step and shade), the steps, the peak, the number of active days, the selection's place and the view key. `calendarOption(model, fit, env)` draws it. Both pure, types only from the runtime.
- The view key given to the wrapper: the project, the source, the automated filter, the measure, the first shown Monday and the number of weeks. Not the range, the selection or the figures. The wrapper reads nothing, so the key only tells it a new option is the same chart.
- The text scale is read once per render in the component and handed to the fit and the option, as `WorkChart.tsx` does.

### 11. The data table

"Show data table" under the chart, through `ChartTable` and `Table`, closed on every load and not rendered while closed. Name: "Commits per day, by week". One row per week shown, oldest first: "Week of Nov 2, 2026" (", so far" for the current week), a column per weekday from Mon to Sun, and Total. A day with no cell (before the first recorded day, or after today) shows a dash. The table follows the measure.

### 12. Tests and the browser check

| Where | What | Catches |
|---|---|---|
| `tests/test_metrics.py`, `tests/test_app.py` | `calendar()` and its route | The span, the filters, `first`, a bad source |
| `calendarDays.test.ts` | `calendarFit`, the steps, `calendarModel`, `calendarOption` with a stubbed `api`, `rangeFor` | Geometry, the scale, forced colors, labels left out |
| `gridReading.test.ts` | `moveDay`, `cellAt` | The key table and the pointer test |
| `ActivityCalendar.test.tsx`, on the fake runtime | What a user reaches: the label, a reading by keys and by pointer, the tooltip, Enter, Escape, the statuses, the key, the table | Wiring and wording |
| `ActivityPage.test.tsx` | One test: a pick inside and outside the range | The two URL writes and the focus |
| `ActivityCalendar.real.test.tsx`, real ECharts | The cells drawn at the layout's pixels, in the tokens' colors, the frame, the labels | An option ECharts refuses or draws elsewhere |
| `tools/demo/chartfit/calendar.mjs`, Chromium | What jsdom cannot show (below) | Layout, colors, real events |

The fake runtime draws nothing, and the calendar's reading does not use it: a calendar that draws no cell passes every fake test. The real test and the browser check are the ones that see the drawing.

Only a browser shows these; step 4.1 checks each: the labels' real widths at 16px and 32px (jsdom estimates 0.6em a character); the contrast rule of decision 5; that the ring sits on the drawn cell within 1px; that a `mousemove` and a `click` reach `div.cal-box` through zrender's svg, and a touch tap too; the hand cursor; that Up and Down do not scroll the page; the forced-colors squares; no sideways scroll at 375px and at 32px text.

Net test lines, estimated: Python 45, model and option 170, reading rule 30, component 130, page 40, real 60: about 475. That is over the 400-line advice. The reason: the reading is the calendar's own (decision 6), so its keys, pointer, Escape and statuses are tested here and nowhere else. The work splits into two pull requests if the owner wants each under 400: the endpoint (step 1.1, about 45 lines) and the graph.

### 13. Bundle

- `echarts-*.js`: unchanged, 176.5 kB against 195 kB. No part is registered.
- `ActivityPage-*.js`: 23.7 kB against 28 kB at the base. The calendar adds its model, option, reading and component to this chunk, an estimated 3 to 4 kB. If the built chunk is over 28 kB and at most 30 kB, step 3.3 raises the limit to the built size plus 2 kB and says the size in the pull request. A chunk over 30 kB stops the step.
- `index-*.js`: `api.ts` and `queries.ts` grow by a type and one query: under 0.2 kB.

## For the owner of the shared chart component

Not tasks of this change. With these three additions a calendar could give `points` its days and drop `gridReading.ts`, its own tooltip, mark and live region (about 150 lines and their tests):

1. **A step per key.** `keys={{ steps: { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 } }}`: the wrapper reads Up and Down when given, and prevents them.
2. **A pointer test in two directions.** The reserved `locate` prop with a form such as `locate={{ by: "cell", at: (x, y) => index | null }}`, in place of the band of x axis 0.
3. **The place of a point.** `where={(i) => ({ x, y, width, height })}` for a key's tooltip and for a mark on one cell, in place of the axis pointer's band; or `onRead(i | null)`, so the chart draws its own mark.

Also: this change relies on `points={0}` meaning "the wrapper draws and reads nothing". It is true today and measured, but no comment or test of the wrapper says so. A test there would keep it.

## Risks / Trade-offs

- **The reading rules exist twice**, in the wrapper and here. → The calendar copies the wrapper's rules word for word where they apply (Escape, blur, a key's reading said again), and the section above lists what would remove the copy.
- **The ring and the cells are placed by two renderers.** → Both read one `calendarFit`; the real test pins the cells to it and the browser check pins the ring to the cells.
- **A pick moves the focus away from the calendar.** → It is the vitals' pattern, and the panel the focus lands on names the day and offers "Show the whole range". The owner may prefer the other place (open question 1).
- **A pick can change the range.** → Said before (tooltip, reading) and after (status); Back undoes it.
- **A 10px cell is a small target.** → The same holds for a day bar of the work chart at 90 days. Every day is reachable by keyboard, and the table has every figure.
- **Rank cuts move when the data moves.** → A day's shade can change after an ingest. The key always gives the current numbers.

## Open Questions

1. **Place.** Last, as planned, keeps the first-screen rule. The other choice is between the vitals and the tabs, which needs that rule relaxed for the tab list. Only the owner can trade one for the other.
2. **The `ActivityPage` limit.** May step 3.3 raise it, to at most 32 kB, if the built chunk is over 28 kB, or must the calendar become a lazy chunk of its own?
3. **`points={0}`.** Does the wrapper's team accept a chart that draws through the wrapper and reads by itself until the additions above exist?
