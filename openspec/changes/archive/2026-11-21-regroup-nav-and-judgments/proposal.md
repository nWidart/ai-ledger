# Proposal

## Why

The navigation lists seven pages in one flat row, in no order that says what each is for. Two of them answer "what is happening now" (Live, Limits) and four answer "what happened" (Activity, Cost, Context, Errors), but nothing shows that. The two "now" pages also keep their one urgent fact off the bar: how many sessions wait on the user, and how full the fullest limit window is. The Limits tab has a 7px dot that says "something" and no more.

Insights is a page of its own, yet it is a second reading of the same sessions Activity shows: how `/insights` judged them, beside what the store measured. It offers a Codex source that it then disclaims with a dead-end page, its trend is a list of rows that hides how few sessions stand behind a week, its session cards carry no measured figure, and its friction ranking counts reports, not what the friction cost.

Sheets are mounted by each page, so a page that mounts none (Limits) sends the user to Activity to see a session. And each page shows the whole filter bar, whether or not a filter changes anything on it.

## What Changes

- **Navigation in two groups.** "Now" holds Live and Limits; "Review" holds Activity, Cost, Context and Errors. The groups are named for assistive technology and, where the bar has room, in words. The page chooser on narrow screens lists the same two groups. Keyboard and mobile behaviour stay as they are.
- **Live badge.** The Live tab shows how many sessions wait on the user (a likely approval wait, or your turn), and nothing at 0. `/api/status` gains `live_waiting`.
- **Limits pill.** The Limits tab shows the fullest open window's percent, in the warning or the critical tone when a window is nearly full, at its limit or forecast to run out. It replaces the alert dot. `/api/status` gains `limits_peak`.
- **Text alternatives.** The badge and the pill are hidden from assistive technology; each tab's name says them in words.
- **One active style.** Errors loses its coral active tab. Every tab uses the same one.
- **Insights folded into Activity.** Insights leaves the navigation. Activity gains a view switch, Overview and Judgments, kept in the URL as `view=judgments`. **BREAKING** for bookmarks only in form: `/insights` redirects to the Judgments view and keeps every key.
- **Judgments, improved.** The outcome trend is a chart of weekly bars, each 100% of its week and stacked by outcome, with the week's sessions over it, a faint bar for a week with few sessions, a keyboard readout and a data table. Session cards show the session's cost, peak context share and tool errors. Friction families are weighed by the cost and the active time of the sessions that reported them, or by reports.
- **Codex and Judgments.** With the source filter on Codex alone, the Judgments button is unavailable and says why. A link to the judgments of Codex opens Overview. There is no dead-end page.
- **One sheet host.** The app's shell mounts the project, tool and session sheets once. Every page opens them in place, Limits included. No page mounts its own.
- **Scope bar honesty.** A page shows a filter only when it changes the page. Judgments shows no source filter. Filters sit in the page header beside the heading, in one order.
- **Command palette.** `>judgments` (and `>insights`) opens the Judgments view. A sheet opens on the current page, whatever the page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the navigation's groups, badge and pill; the status fields behind them; the sheet host in the shell; filters per page; the `/insights` redirect; the page lists that named Insights.
- `insights-dashboard`: the judgments as a view of Activity; no source filter and no Codex page; the stacked outcome trend with its readout and table; stored figures on session cards; friction weighed by cost and active time.
- `usage-dashboard`: the view switch, each view's own keys, Judgments unavailable for Codex alone, the link from a session's judgment.
- `command-palette`: the Judgments destination; every page hosts the sheets.
- `context-menu`: the project sheet and Open session on every page.
- `project-page`: the Session judgments block links to the Judgments view.
- `documentation-site`: the Pages group follows the app's order, with a Judgments page.
- `distribution`: the list of pages an installed app serves.

## Impact

- `src/ai_ledger/app.py`, `live.py`, `limits.py`: `live_waiting` and `limits_peak` in `/api/status`.
- `src/ai_ledger/insights.py`, `families.py`: per-outcome counts in the trend, measured figures on listed sessions, cost and active time on friction families.
- `web/src/components/Nav.tsx`, `Nav.css`, `refresh.ts`: groups, badge, pill, breakpoints.
- `web/src/App.tsx`, `router.tsx`, `url.ts`, `components/sheets/UsageSheets.tsx`: the sheet host, the redirect, the `view` key.
- `web/src/pages/activity/`: the view switch; `pages/insights/` moves to `pages/activity/judgments/` with the trend chart.
- `web/src/components/Filters.tsx`, `palette/`, `menu/`: the source prop, the Judgments destination, sheets on every page.
- `web/src/pages/{cost,context,errors,live,project}`: their `UsageSheets` mounts go. Nothing else changes there.
- Fixtures in `web/src/__fixtures__/`, tests in `tests/` and `web/src/`.
- `tools/demo/record.mjs`, `README.md`, `site/`, `CHANGELOG.md`.
