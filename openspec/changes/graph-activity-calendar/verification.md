# Verification

Each scenario of this change's two spec deltas, with the test or the browser check line that proves it. Test names are quoted as written; `calendar.mjs:N` is a `line(…)` call of `tools/demo/chartfit/calendar.mjs` (step 4.1). Paths are relative to the repository root; the calendar's own tests are in `web/src/pages/activity/calendar/`.

Checked on the tree rebased onto `origin/main` at `05a44407`.

## `usage-dashboard`

### Show a calendar of work per day

| Scenario | Proof |
|---|---|
| The range does not move it | **No test asserts it.** The query key holds no range (`queries.calendar` in `web/src/queries.ts`); no test changes the range and counts `/api/calendar` requests. The page test "follows the tabs, selects a day, widens the range…" changes the range (7 to 90 days) and keeps reading the same calendar, but does not assert that no request is made. |
| A project filter | `tests/test_metrics.py` `MetricsTest.test_calendar`: the rows and `first` of `foo` and `bar`. The source filter: `SourceFilterTest` (the `calendar()` lines added there). |
| Today is the last cell | `calendarDays.test.ts` "holds the readable days of the weeks shown, each in its cell, step and shade" (today, a Wednesday, is column 12, row 2, the last day); "shows the weeks of a store %s" (the newest cell is in the last column); `calendar.mjs:200`. |

### Fit the calendar's weeks to its box

| Scenario | Proof |
|---|---|
| Desktop | `calendarDays.test.ts` "lays %ipx at a text scale of %i…" (1174px: 53 weeks) and "shows the weeks of a store older than a year"; `calendar.mjs:197` (1440px: 53 columns). |
| Phone | `calendarDays.test.ts` "shows the weeks of a store 30 weeks old on a phone" (26 weeks); "keeps the block inside the plot at every width"; `calendar.mjs:197` (343px box: 26 columns), `calendar.mjs:262` (375px window: no sideways scroll). |
| Larger text on a phone | `calendarDays.test.ts` "lays %ipx…" (343px at a text scale of 2: 20 weeks) and "names the weekdays and the months…" (22px labels at twice the text); `calendar.mjs:273` (twice the size, inside the box, none overlapping, by real widths), `calendar.mjs:263`. |

### Show the calendar's recorded weeks

| Scenario | Proof |
|---|---|
| A short history | `calendarDays.test.ts` "shows the weeks of a store 11 weeks old on a desktop: two columns before it"; `ActivityCalendar.test.tsx` "names the span, the busiest day and the keys…" (hint "last 13 weeks"); `calendar.mjs:221`, `:225`, `:228`, `:234` (on the store's own payload). |
| A week old | `calendarDays.test.ts` "shows the weeks of a store begun this week" (13 weeks, the one readable day in column 12). |
| Never recorded | `calendarDays.test.ts` "shows the weeks of a store never recorded" (53 weeks, no day); `ActivityCalendar.test.tsx` "says when no day has the measure, when only weeks not shown have it, and when no day is recorded" ("No activity yet."). |
| The measure only in weeks not shown | `ActivityCalendar.test.tsx` "says when no day has the measure, when only weeks not shown have it…" ("No commits in the last 26 weeks."). |

### Shade the calendar by the work chart's measure

| Scenario | Proof |
|---|---|
| Follow the switch | **Partly.** `calendarDays.test.ts` "keeps its view key through newer figures and a selection, not through another measure…" builds the model for prompts. No test renders the calendar with Prompts chosen and reads its shades, hint and key; the component's tests and step 4.1 use Commits. |
| All three figures | `ActivityCalendar.test.tsx` "reads today with Left, with its sentence, its tooltip…" (the tooltip's rows: Commits, Prompts, Sessions). |

### Cut the calendar's scale into steps

| Scenario | Proof |
|---|---|
| One very busy day | `calendarDays.test.ts` "cuts %s" ("the design's ten values": 1–2, 3–8, 9–40); `ActivityCalendar.test.tsx` "names the span, the busiest day and the keys…" (the key "1–2", "3–8", "9–40"). |
| Every day alike | **Partly.** `calendarDays.test.ts` "cuts every day 1" (one step, 1 to 1). No test reads the key's text "1" for a step of one value. |
| Same shade at every width | `calendarDays.test.ts` "starts at the first week shown when recording started before it…" (the steps at 53 weeks equal those at 13). |

### Tell an empty day from a day before recording

| Scenario | Proof |
|---|---|
| A quiet weekend | `calendarDays.test.ts` "holds the readable days…" (a day with none is step 0, in the model); `ActivityCalendar.test.tsx` "reads today with Left…" (Up reads idle Tuesday, Nov 17; not a weekend day); `calendar.mjs:200` (every day of the weeks shown up to today is drawn). The pointer reading an empty day is not tested on its own. |
| Before the first day | `ActivityCalendar.test.tsx` "names the span, the busiest day and the keys…" ("Recording starts Sep 1, 2026"); `calendarDays.test.ts` "holds the readable days…" (nothing before Sep 1); `calendar.mjs:211`, `:240`. |

### Read the calendar in two directions

| Scenario | Proof |
|---|---|
| A week back | `gridReading.test.ts` "%s with %s read reads %s" (`ArrowLeft` rows); `ActivityCalendar.test.tsx` "reads today with Left…" (Left from Nov 17 reads Nov 10); `calendar.mjs:442`. |
| Across a week | `gridReading.test.ts` "%s with %s read reads %s" (`ArrowDown` from the last day of a week to the first of the next); `calendar.mjs:442`. |
| First key | `ActivityCalendar.test.tsx` "reads today with Left…"; `gridReading.test.ts` (`ArrowLeft` with nothing read). |
| The page stays | `ActivityCalendar.test.tsx` "reads today with Left…" (Down is prevented); `calendar.mjs:453`. |
| Escape from another control | `ActivityCalendar.test.tsx` "reads the day under the pointer and ends the reading when it leaves, or on Escape from elsewhere"; `calendar.mjs:464`, `:481`. |

### Word a calendar day

| Scenario | Proof |
|---|---|
| A busy day | `ActivityCalendar.test.tsx` "reads today with Left…" ("Tuesday, Nov 10, 2026: 8 commits, 8 prompts, 1 session."). |
| An idle day | `ActivityCalendar.test.tsx` "reads today with Left…" ("Tuesday, Nov 17, 2026: no activity."); `ActivityCalendar.test.tsx` "picks a busy day with Enter…" (the sentence kept after Enter). |
| A day that stands out | `ActivityCalendar.test.tsx` "reads today with Left…" (today, in the top of three steps: "Among the busiest days for commits."). |

### Select a day on the calendar

| Scenario | Proof |
|---|---|
| Pick a day inside the range | `ActivityPage.test.tsx` "follows the tabs, selects a day, widens the range for a day outside it…" (`day=`, the range kept, the focus on the tab panel); `ActivityCalendar.test.tsx` "picks a busy day with Enter and says so…" (the status); `calendar.mjs:498`, `:502`, `:505`. That the tabs then count that day only is the work chart's existing `day=` path. |
| An idle day | `ActivityCalendar.test.tsx` "picks a busy day with Enter and says so, keeps the reading on an idle day…". |
| Marked on both charts | **Partly.** The frame: `calendarDays.test.ts` "frames the cells of %s in the accent, unfilled", `ActivityCalendar.real.test.tsx` "draws a cell per readable day and the selection…". No calendar test reads the work chart's chip after a calendar pick. |
| While a view loads | `ActivityPage.test.tsx` "follows the tabs, selects a day…, and takes no pick while its figures are another view's" (with a change of source, not of project); `calendar.mjs:623`. |

### Widen the range for a day outside it

| Scenario | Proof |
|---|---|
| A day four months back | **Partly.** `calendarDays.test.ts` "keeps or widens the range for a day 120 days back" (all time). The status "the range is now all time" has no test: `ActivityCalendar.test.tsx` and `calendar.mjs:513` check the 90-day case. |
| Back | `ActivityPage.test.tsx` "follows the tabs, selects a day, widens the range…" (`history.back()` restores `?range=7&day=…`); `calendar.mjs:518`. |
| Said beforehand | `ActivityCalendar.test.tsx` "picks a busy day with Enter…" (Sep 1, outside 30 days: the sentence and the tooltip name the last 90 days); `calendarDays.test.ts` "keeps or widens the range for a day 50 days back". |

### Offer the calendar as a table

| Scenario | Proof |
|---|---|
| Show the table | `ActivityCalendar.test.tsx` "lists each week shown in the data table, with a dash for a day with no cell"; `calendar.mjs:243`. |
| Closed | **No calendar test asserts it.** The table is rendered by the shared `ChartTable`, closed until pressed; the calendar test presses it before reading. |

### Load the calendar on its own

| Scenario | Proof |
|---|---|
| Before the calendar's figures | `ActivityPage.test.tsx` "shows its heading before its figures, says a failed request with Retry over the kept calendar…"; `calendar.mjs:399`, `:404`. |
| A failure over the kept calendar | The same page test (the alert's words, no pick on the kept calendar); `calendar.mjs:617`, `:623`. |
| Retry | The same page test ("Retrying…", `aria-disabled`, the focus on the button, then on the calendar); `calendar.mjs:632`, `:639`. |

### Serve the calendar's days

| Scenario | Proof |
|---|---|
| Same figures as the work chart | `tests/test_metrics.py` `MetricsTest.test_calendar` (the rows equal `usage()`'s `daily_work`, with and without automated sessions). |
| The span starts on a Monday | `MetricsTest.test_calendar` (`start` for a Monday, a Thursday, a Sunday and the next Monday as today; the Sunday is Nov 8, 2026, not the scenario's Nov 22). |
| Recording began before the span | `MetricsTest.test_calendar` ("A year later bar's day is out of the rows, but still the first day"). |
| A prompt before the first request | `MetricsTest.test_calendar` ("A prompt the day before bar's first request"). |
| Unknown source | `tests/test_app.py` (`/api/calendar?source=gemini` in the list that answers 400); `MetricsTest.test_calendar` (`ValueError`). |

### Order the Activity page

| Scenario | Proof |
|---|---|
| Chart before the vitals | The existing `ActivityPage.test.tsx` "orders the interrupted line, attention, the work chart, the vitals, then the tabs", unchanged. |
| The switch leads | Unchanged by this change; not re-checked here (the scenario is the main spec's, carried into the modified requirement). |
| The calendar comes last | `ActivityPage.test.tsx` "follows the tabs, selects a day…" (the section follows `#workbench`). |

## `dashboard-app`

### Show a shade step as a size under forced colors

| Scenario | Proof |
|---|---|
| Activity calendar in high contrast | `calendarDays.test.ts` "draws shades as squares of growing side in the text ink under forced colors…" (3, 5, 8, 10px); `ActivityCalendar.real.test.tsx` "draws a step as a square of the text color under forced colors…"; `calendar.mjs:339`, `:343`. |
| The key matches | `calendar.mjs:373` only (the swatches by a screenshot's pixels). |
| Turning forced colors off | **Partly.** `web/src/components/echart/tokens.test.ts` "gives a new env when %s fires change" (`(forced-colors: active)`), and the option is built from the env. No test turns forced colors off with the calendar shown. |

### Mark one cell of a chart laid out in rows and columns

| Scenario | Proof |
|---|---|
| Read and selected | **Partly.** The ring: `ActivityCalendar.test.tsx` "reads today with Left…" (on the cell's place); the frame: `ActivityCalendar.real.test.tsx` "draws a cell per readable day and the selection…". `calendar.mjs:348`, `:352` show both at once in forced colors, in `Highlight`, but on two cells (the frame on the selected day, the ring on today). No test reads the frame and the ring on one cell. |
| Reading another day | `calendar.mjs:348`, `:352`: the frame on the selected day and the ring on another day read, in forced colors. In the theme, the frame follows the selection (`calendarDays.test.ts` "places the selection of %s") and the ring the reading, each tested alone. |
| Reading before the chart has drawn | `ActivityCalendar.test.tsx` "reads today with Left, with its sentence, its tooltip and the ring on its cell…", on the fake runtime, which draws nothing. |

## Net test lines

Against `origin/main` (`05a44407`), in `*.test.*` and `tests/`: **710 net** (728 added, 18 removed).

| File | Net |
|---|---|
| `tests/test_metrics.py`, `tests/test_app.py`, `tests/test_web_fixtures.py` | 34 |
| `calendarDays.test.ts` | 236 |
| `gridReading.test.ts` | 41 |
| `ActivityCalendar.test.tsx` | 152 |
| `ActivityCalendar.real.test.tsx` | 105 |
| `ActivityPage.test.tsx` | 137 |
| Five other tests' API mocks (`/api/calendar` added) | 5 |

The browser check, `tools/demo/chartfit/calendar.mjs` (645 lines), is not counted: it runs locally, not in CI.

Why it is over the advice of 400: the calendar owns its keyboard and pointer reading, because the shared chart wrapper reads along one axis only. Its keys move one point left or right, its pointer reads the column under it, and its mark is a band over a column; a calendar needs Up and Down, the row under the pointer, and a ring on one cell. So the calendar passes the wrapper `points={0}` and does its own reading: the key table, the pointer test, the tooltip, the ring, the live region, Escape, blur and the statuses. Those are tested here because nothing else tests them, at the layer that owns each rule (`gridReading.test.ts` for the keys and the pointer, `ActivityCalendar.test.tsx` for what a user reaches). The layout and the scale add a pure model with its own table-driven tests. The page's loading, failure and Retry states were not in the plan and take 80 lines of `ActivityPage.test.tsx`. If the wrapper gains a step per key, a pointer test in two directions and the place of a point (`design.md`, "For the owner of the shared chart component"), `gridReading.ts` and most of the component's reading tests go away.

## Bundle

`cd web && npm run build && node scripts/check-bundle.mjs`, as printed:

```
ok   index-CZZbju2-.js  109.9 kB gzip  (limit 130 kB)
ok   CostPage-DBvZuzZs.js  12.1 kB gzip  (limit 20 kB)
ok   ActivityPage-DF3c-Exl.js  28.2 kB gzip  (limit 31 kB)
ok   zoomReset-BDwHU1c6.js  7.7 kB gzip  (limit 9 kB)
ok   echarts-CZ7cuwNT.js  176.5 kB gzip  (limit 195 kB)
```
