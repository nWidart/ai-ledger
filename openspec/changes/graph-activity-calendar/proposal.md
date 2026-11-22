# Proposal

## Why

Activity answers "what got done in this range". It does not answer "when do I work with agents, and which days stand out": the work chart follows the page's range, shows at most 61 days as days, and turns into weekly bars after that. A reader who wants the pattern of a year (the quiet weekends, the week of a release, the day with 40 commits) has no view of it.

A calendar heatmap is the form readers know for that question: one cell per day, weeks as columns, weekdays as rows. A design round proposed it as "Activity: 90-day calendar heatmap", drawn with Apache ECharts 6.1.0. This change plans it.

## What Changes

- **New section on Activity's Overview: the activity calendar.** One cell per day, weeks as columns from Monday to Sunday. It is the last section of Overview, after the workbench tabs.
- **A fixed span that does not follow the range.** The server answers the last 53 weeks. The chart shows as many of the newest weeks as its box holds: 53 on a desktop column, 26 in a 343px box, fewer at a larger text size. The page never scrolls sideways.
- **The shade follows the work chart's measure.** Commits, Prompts or Sessions, as the switch on the work chart is set. All three are per-day figures. The calendar has no switch of its own.
- **A scale of at most four shade steps and an empty cell**, with a text key that gives each step's numbers. The steps are cut at the median, the 80th and the 95th percentile of the days that have any, so one very busy day does not flatten the rest.
- **An empty day is a cell. A day before the first recorded day is no cell.** So is a day after today.
- **Reading in two directions.** Left and Right move a week, Up and Down a day, Home and End go to the first and the last day. The pointer reads the cell under it. One tooltip and one live sentence give the day's commits, prompts and sessions.
- **Enter or a click selects the day**, as a bar of the work chart does: the same `day=` in the URL, the same narrowed tabs. The tabs are above the calendar, so the page brings them into view and moves the focus to the tab panel. A day outside the page's range first sets the range to the smallest one that holds it, and a status says so.
- **Forced colors, dark, text size, reduced motion.** In forced colors the step is the size of a square in the system text color, not a shade. The cells keep their size at a larger text size; the labels grow.
- **New endpoint `/api/calendar`**: the work per day of the last 53 weeks for a project, a source and the automated-sessions filter, and the first recorded day. It takes no range.
- **No change to the work chart, the outcome trend, `/api/usage` or the shared chart component.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Activity gains the calendar section, its span, measure, scale, reading, selection and table; the page order names it; a new endpoint serves it.
- `dashboard-app`: a drawn chart that shows a value as a shade shows it as a size under forced colors; a chart laid out in rows and columns marks the one cell being read and the one selected. Both are added requirements: no existing requirement of `dashboard-app` is modified, so this change does not collide with the chart migrations in progress.

## Impact

- **Server.** `src/ai_ledger/metrics.py` gains `calendar()`; `src/ai_ledger/app.py` gains the route. No stored data changes, no `rebuild`.
- **Web.** A new folder `web/src/pages/activity/calendar/`: a pure model and option builder, a reading hook, the component and its styles. `web/src/api.ts` and `web/src/queries.ts` gain the payload type and the query. `ActivityPage.tsx` renders the section and wires the selection. `theme.css` gains four shade tokens.
- **Shared chart component.** Not edited. `web/src/components/echart/echarts.ts` is not edited either: the calendar draws with the custom series already registered, on no coordinate system. The ECharts chunk stays at 176.5 kB.
- **Dependencies.** None added.
- **Tests.** Python tests for the endpoint; tests of the pure model and the reading rule; component tests on the fake runtime; one smoke test on real ECharts. A new generated fixture, `web/src/__fixtures__/calendar.ts`.
- **Tooling.** `tools/demo/chartfit/calendar.mjs` and its name in the runner. `web/scripts/check-bundle.mjs` keeps its limits.
- **Images and docs.** A new `activity-calendar` shot; `CHANGELOG.md`, the Activity row of `README.md`, and the docs site's Activity, keyboard and glossary pages.
- **Open to the owner.** Where the section sits (design decision 9), and three wrapper additions that would let a later calendar drop its own reading code (design, "For the owner of the shared chart component").
