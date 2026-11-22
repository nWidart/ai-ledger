# Changelog

All notable changes to AI Ledger are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Prices for OpenAI `gpt-6.2-sol` and `gpt-6.2-astra`, so Codex sessions on those models show an estimated cost.

### Fixed

- The wheel scrolls the page again with the pointer over the tabs on Context and Activity. The tab strip scrolled a pixel up and down and held the wheel.

## [0.5.0] - 2026-11-21

### Added

- Grok CLI sessions, read from `~/.grok/sessions` (`--grok` sets another Grok home). Every source filter offers Grok. A turn's tokens are split over its model calls, so per-call figures are estimates.
- Limits shows Grok's plan limit. The app polls Grok's billing endpoint every 5 minutes with the token in `~/.grok/auth.json`, and never stores or logs it. Without a grok.com login it sends nothing.
- Documentation site at https://nwidart.github.io/ai-ledger/. It replaces `docs/guide.md`.
- A **Docs** link in the top bar, and "Docs:" commands in the palette, open the docs for the current page. Hints and error states link to the section that explains them.
- Model and tool time for Claude Code sessions from late October 2026 on: an Output speed tile on Activity, and model time, tool time, output speed and lines changed in the session sheet. Run `ai-ledger rebuild` once to fill them for stored sessions.
- Activity's Sessions table:
  - **Model** and **Tok/s** columns. `/api/sessions` rows add `model_ms` and `output_per_s`.
  - A **Columns** button hides or shows columns. The browser keeps the choice.
  - Sort by up to three columns: tick **Sort by several columns**, or Shift-click a header.
  - Select up to four sessions and **Compare** them side by side.
- `/api/sessions` takes up to three sort keys (`sort=-cost,prompts`). Invalid keys and a blank `sort=` answer 400. `sort=cost&desc=1` still works.
- Cost's daily chart zooms in views of 14 days or more, with a slider or the plus and minus keys.
- Activity's work chart zooms in views of 14 bars or more, with a slider or the plus and minus keys.
- Cost's tokens chart has a Scale switch: Volume, or Share (each day as a 100% bar).
- Errors' Where to start lists applied fixes, with the error rate before and since.
- Each Errors incident shows its attempts on a small time strip.
- Errors' rate chart has a "Show data table" disclosure.
- The Live tab shows a badge counting the sessions that wait for you.
- The Limits tab shows the percent of your fullest open window, amber or red when near or at its limit. It replaces the alert dot.
- Judgments' session cards show cost, peak context and failed tool calls.
- Judgments' Friction categories can be weighed by cost, active time or reports.
- `>judgments` in the command palette opens Judgments.
- `GET /metrics` serves the store's figures to Prometheus: requests, tokens, cost, sessions, tool calls and errors, active sessions, plan limits and ingest state. No label holds transcript text.
- `--metrics-host HOST[:PORT]` lets `/metrics` answer through a proxy such as `tailscale serve`, so one Prometheus can scrape several machines. Pages and `/api` keep the strict host check.
- `workloads.json` beside the store names groups of sessions by the start of their first prompt, such as review agents. `/metrics` carries it as a `workload` label.
- A Grafana dashboard for the metrics, in `contrib/grafana/ai-ledger.json`.

### Changed

- Insights is now Activity's **Judgments** view (`/usage?view=judgments`). Old `/insights` links still work.
- One scope bar under the navigation holds the page-wide filters on every page: project, range, source, Include automated sessions. On a phone it is one **Filters** button.
- The navigation has two groups, **Now** (Live, Limits) and **Review** (Activity, Cost, Context, Errors), and stays on one row at every width. Narrow screens get a page chooser.
- Last ingest and Refresh are one control. It reads "Stale", "Failed" or "Offline" when the data is not current.
- Session, tool, MCP server, skill and project sheets open over every page instead of sending you to Activity. Live's open sheet is in the URL as `sheet=`.
- Text follows the browser's font size and stays readable at 200%.
- The light theme's amber warning color is darker, for 3:1 contrast.
- Screen readers hear only the result of a manual refresh, not every timed ingest.
- New logo: a bound ledger with an accountant's double rule.
- The docs site adds Supported agents and Sheets pages, groups the playbooks into three sections, and follows the navigation's order.
- Activity:
  - The Overview is a workbench: Sessions, Projects, Tools and MCP, and Loops and tests are tabs under the chart (`tab=`). The drawers and section index are gone.
  - The work chart draws errors per 100 calls on its own track. Week bars can be selected (`week=`).
  - The work chart uses the shared chart component. It follows theme changes without a reload, frames and announces the selected day or week, always shows the newest bar's label, right-aligned, and keeps the peak label inside the plot.
  - Five tiles, each opening the matching tab or page. Output speed opens Sessions sorted by Tok/s.
- Judgments:
  - No source filter. With Codex selected, the view says why it is unavailable.
  - Outcome trend is a weekly chart of 100% bars, with a data table. It uses the shared chart component, so it follows theme changes without a reload and keeps the week you are reading when new data lands.
  - Outcomes and Claude's helpfulness each show one stacked bar over their rows.
- Live:
  - A status strip above the stream replaces the agent panel, so the stream is wider.
  - The tokens-per-minute chart is a 10-minute pulse of context per request, with a tick per tool call. The session payload's `spark` is now `pulse` and adds `cwd`.
  - Each rail entry adds a context meter, the latest action and failed calls.
  - Selecting a Wall tile pins its stream beside the tiles, two at most (`pin=`).
  - The Full text warning opens over the page, so the stream no longer moves. On a phone the rail scrolls sideways.
- Cost:
  - The daily chart is on the first screen, with a plan gauge beside the heading. It replaces the sparkline and the "N× your plan" multiple.
  - "Project spend and change" shows each project once. It replaces What changed, Where the spend went and Cost by project.
  - The heading keeps the cost and its change; the rest moves to "How measured". The Biggest spender and Cache hit cards are gone.
  - Tokens and cache compares each kind's share of tokens with its share of cost.
  - The daily chart follows theme changes without a reload.
  - The peak label of the daily chart shows at larger text sizes when the plot has room, and stays inside the plot.
- Context leads with what to act on:
  - Tips are one strip of short items, each opening its evidence in place.
  - Three tabs replace the section index: Overhead and pressure, Growth and bloat, Cache health (`tab=`).
  - The cache chart's bars show uncached tokens, with cache breaks and hit ratio on their own tracks.
  - The session map names its four quadrants. Selecting one narrows the pressure bars.
  - Overhead and pressure shows a window grid for each of the six busiest projects.
  - Tips name Codex's commands for Codex sessions.
- Errors:
  - Each control sits where it acts. URL keys are unchanged.
  - The type table has four columns and fits without scrolling sideways. "Didn't recover" is now "Not recovered".
  - Panels and wording match the other pages.
- Limits:
  - Each open-window chart draws use so far, a forecast cone, now and a safe-pace line. The chart key is gone.
  - Each card's header gives the percent and one status. The rest is behind **Details**.
  - The last 24 h pace line is behind one toggle, and the status strip is gone.
  - Past windows are always shown and replace the Left unused panel. The time range moved into their header.
  - No project filter. The Project page still shows one project's plan-limit figures.
- The Project page uses two columns on wide screens, leads with Activity, and loads each block on its own.
- Shorter pages on Activity, Context, Errors and Judgments:
  - Drawers start closed, and opening one closes the other.
  - Each hint is one line, with method text behind **How measured**.
  - Each heading states at most two figures. Errors' Error rate tile gives way to **Top type**.
  - Context's Largest contributors replaces the By tool and By MCP server tables.

### Removed

- The sticky section index on Cost and Judgments, and its "Jump to" menu.
- Activity's Prompts by hour heatmap, and `work_hours` in `/api/usage`.

### Fixed

- One quiet day no longer sets the scale of Activity's error-rate line. Days with under 50 tool calls draw a hollow dot.
- Cost's daily chart no longer recolors the bar you are reading, and the 7-day average no longer gets dots.
- Cost's projects could all show as "Other" after a reload, until the next refresh.
- Limits draws two past windows from the same poll as separate bars.
- **Open session** opens the sheet over every page, and Live keeps its stream.
- On a narrow screen, a sheet opened from an Errors type sheet stacks over it with **← Back**.
- Limits' forecast and estimate lines are full contrast, and plans show their tier ("max 20x").
- Durations never round across units: 59.6 s reads "1m", not "60s".
- The ignored-`automated.json` warning shows on every page.
- The right-click menu opens on more sessions, tools, error types and projects.
- Thin chart segments no longer vanish beside tall ones.
- The Project page's Errors block asks for no judgments when the source is Codex alone.
- Changing the project or source closes Live's open session sheet.
- Context's tool-results tip no longer suggests subagents for Codex sessions.
- Context's Largest contributors keeps the ten largest tools whatever the sort.
- Live shows "N new events" beside **Jump to latest** while Follow is off.
- Activity's Sessions table names a session with no project "(no project)".
- Live's wall reads "1 error", not "1 errors".
- Accessibility:
  - Alt+Left, Ctrl+Home and other modified keys work while a chart or tab list has focus.
  - Error loops, Failed test runs, Closed windows and Error types have row headers.
  - Toggletips no longer read aloud on hover. Cost, Errors and Limits use the shared **How measured** toggletip.
  - Escape closes the work chart's and the Cost chart's tooltips wherever the focus is.
  - Cost announces every sort.
  - A Live wall tile's name gives its full state.
  - Errors, Judgments and Live have one heading in every state.
  - Focus lands on the heading when a closed sheet's opener is gone, and Tab from Activity's tabs reaches the selected panel.
  - Forced colors: chart bars, the Session types bar and pressed controls stay visible and framed.

## [0.4.0] - 2026-11-15

Run `ai-ledger rebuild` once after upgrading, with the app stopped. It fills the data the Context page needs (tool result sizes, Codex context windows, first compactions, past `/context` results) from transcripts already read. Until then, the Context page marks those figures as unavailable.

### Added

- Project page: one project's figures, cost, top sessions, errors, context, judgments and plan-limit share. Its context grid mirrors Claude Code's `/context`, and Measure runs `claude -p "/context"` for a fresh snapshot. Open it from the project filter, the project sheet or the command palette.
- Context page: how context fills in Claude Code and Codex sessions. It shows starting size, growth per turn, time to first compaction, what fills context, caching cost and cache breaks. Tips from fixed rules show their evidence and matching sessions. Token figures from result sizes are estimates (bytes ÷ 4).
- Context page sections: window pressure, a session map, cache use over time, and tools and MCP servers by result size.
- `>context` in the command palette opens the Context page.
- Right-click menus on projects, sessions, tools, MCP servers, skills and error types: open, filter, mute, or copy a resume command, id or directory. Shift+F10, the menu key and long press also open them.
- The session sheet shows the resume command and directory, with Copy buttons.
- A Wide toggle on the session and tool sheets (up to 1100px), saved in the browser.
- Accessibility: a skip link, one main landmark, focus on the new page's heading, "?" buttons for hover-only hints, "Show data table" under charts, and forced-colors support.
- Page switches crossfade (unless reduced motion is on), Back and Forward restore scroll, and first loads show placeholders.
- Hovering or focusing a page's tab preloads the page and its data.

### Changed

- `/context` runs no longer count as prompts on Activity.
- Shorter README. Details moved to the [user guide](docs/guide.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- Context charts: percentile ranges for starting context, a band on the weekly trend, growth as a share of the window, and peak-fill groups cut at 80% instead of 75%.
- Accessibility: named tables with row headers, keyboard-scrollable tables, drawer titles as headings, 3:1 input borders, 4.5:1 Live tool text in the light theme, silent loading states and wrapping titles.
- Faster: pages load on first use (the first download is about a third), revisited pages and sheets show at once and refetch only after new data, abandoned requests are cancelled, the page is revalidated by ETag, and chart hover and scrolling do less work.
- In a background tab, Live stops streaming and polls pause until you return.
- View state moved from the URL hash to the query string: `/usage#project=foo` is now `/usage?project=foo`. Old links still work.

### Fixed

- In the command palette, a suggestion picked with the keys or mouse stays highlighted when session results load, so Enter opens it.
- No more `BrokenPipeError` traceback when a page cancels a request.
- A Codex cache break after a 5 to 30 minute pause is no longer called an expiry: Codex's cache lives 30 minutes.
- "?" buttons show their text again outside the sheets, and also open on hover.

### Security

- `/api` refuses requests from other sites (403). `curl` and the command line are unaffected.
- Security headers and a Content Security Policy on every response: no framing, own scripts only.
- Table export guards cells that start with a tab or carriage return against formula injection.

## [0.3.0] - 2026-11-12

Run `ai-ledger rebuild` once after upgrading (with the app stopped): Codex subagent threads stored before this version are filed under their own ids, and the rebuild moves them to their sessions.

### Added

- Insights shows the figures `/insights` counts from each transcript, which were ingested and shown nowhere: a "Session figures" drawer (lines added and removed, files modified, pushes, median duration and response time, languages) over every session with session meta, and one line of those figures on each analysed session.
- Insights has a "How this works" drawer (what `/insights` is, the directory read, the last run, how many sessions a run analyses) and an Outcome trend panel with the share of sessions fully or mostly achieved per week of session start.
- Insights has a Coverage drawer with the analysed share of each project's sessions, so a busy project with no judgments stands out, and the facets each `/insights` run wrote. The coverage sentence links to it.
- Insights drill-down: select a row of Outcomes, Claude's helpfulness, Friction categories or Goals, or a goal chip, friction chip or outcome badge on a session card, to list only those sessions. The filters (`outcome=`, `help=`, `goal=`, `fr=`) combine, sit in the URL, show as removable chips above the list, and say when the 200-session cut hides some. The sort now lasts the page visit.
- Insights and the Activity Sessions drawer say which sessions they count: Insights counts a session by its start time, Activity by a request in the range, so the two totals can differ slightly.
- The session sheet shows the session's `/insights` judgment, tagged model-judged, between its figures and its timeline: outcome, a dissatisfied marker, helpfulness, session type, goal and friction categories, the summary and the friction detail, with a link to Insights in the same filters. A session `/insights` has not analysed (every Codex session) shows none.

### Changed

- Insights groups similar goal and friction labels into families by keyword (pull request, git cleanup, docs, implement feature, buggy code, and so on), so the ranking is no longer fragmented. A family with several labels expands to them as `/insights` wrote them; selecting it lists the sessions with any of them (`goalf=`, `frf=` in the URL).
- The Insights page lists analysed sessions as cards (title, outcome and chips on one line, the summary below, the friction detail on expand) and lets you sort them (newest, oldest, worst outcome first) and filter them by outcome, kept in the URL.
- The Insights page reads in a new order: vitals, outcomes beside friction, satisfaction, then the analysed sessions, with Goals and Session types folded into closed drawers, and has a section index like Activity's.
- The project picker is one filterable dropdown: type in it and the matching projects list below it at once, for any number of projects. It replaces the select and the separate search box, which appeared only over 12 projects, and typing no longer moves the controls beside it.

### Fixed

- The Live page's Stream view fits the window: a titled session no longer makes the page scroll, and the session rail, the stream and the agent panel stay within the window and scroll inside themselves (from 721 pixels wide; below that the page scrolls as before).
- A time with a date in the Live stream ("Nov 10, 17:40:05") stays on one line: the time column widens when an event shows a date.
- The "Include automated" tooltip on Live names the `automated.json` file, as on Activity.
- Codex subagents show under their session on Live. A subagent's rollout is named by its own thread id only, so ingest filed its lines as a session of its own; a thread now belongs to the session its first `session_meta` names, and the files that continue a main thread are main-thread work, no longer a lane.
- A session with a subagent at work reads working, not your turn, for both agents. A Codex subagent's finished turn no longer ends its parent's turn, and a subagent's lines can no longer push the main thread out of the lines the state is read from, so a long Codex turn still reads working.
- A forked Codex subagent's copy of its parent's history no longer shows as events or state of the session.
- A failed command that a Codex `exec` script ran now has a row in the Live stream, and a Codex `spawn_agent` call names the subagent it started, so the page ties them together.

## [0.2.0] - 2026-11-12

Run `ai-ledger rebuild` once after upgrading (with the app stopped): error types, test runs, Codex tool timing and fast-mode speed are stored when transcripts are read.

### Added

- The Limits page shows past windows as a strip of small bars per limit above the table (the 60 most recent, oldest left, as tall as the final percent; a hit is red, an early end hatched, an estimated window outlined), and picking a bar shows that window's curve, with its plan changes, under the strips. Bars are keyboard reachable, one tab stop per strip, and each says what it shows in words. The curve is fetched when picked, from the new `/api/limits/window`, so the Limits payload stays small.
- The Limits tab shows a dot on every page when a limit window is at its limit or forecast to run out (red), or at 90% used or more (amber); hover it, or read the tab's name, for which window and when. The app works it out once per ingest cycle.
- The Limits cards use more of the Claude usage response: a model-scoped card says how much of the weekly allowance its limit is and how much of that allowance is used through it, and the weekly card says which surface (Claude Code, chat, cowork) the week's use so far came from, so a scoped card and use made outside the terminal read as figures, not mysteries. Both come from the newest poll and only while it describes the open window.
- The Limits cards have a drawer, "What used this window", closed by default: the top projects and models of the window's counted use so far, with their shares and points. Each project links to Cost with that project, the agent, automated sessions and the nearest range preset (7, 14, 30 or 90 days, else all time; each link says so), and "Open in Cost" does the same for the whole window.
- The Limits page adds a second line to each open window, "if the last 24 hours continue": your use over the last 24 hours carried on to the reset, with its own run-out time on the card ("If the last 24 hours continue: reaches 100% at …", or the percent at the reset) and in the chart readout. The usual forecast, the heading and the suggestion do not change.
- The Limits charts can be read at a time: hover or touch a chart, or focus it and use the arrow keys, Home, End and Escape. A guide and a marker show the point, and a tooltip gives its time and percent, measured or estimated, or, ahead of now, the forecast with its likely range. Keyboard changes are announced.
- The Limits cards show the cap in money under the pace line: "100% ≈ $X a week at list prices, from N points over M windows", so a calibrated window reads as dollars with the evidence behind it.
- The Limits page shows a status strip under its heading: one chip per open window with its percent used, the time to its reset, and an "at limit" or "runs out" warning, so every window reads without scrolling.
- The Errors type table sorts by Type, Errors, Time lost, Change and two new columns, Rate (errors per 100 tool calls) and Didn't recover (the share of the type's incidents that did not recover); Share orders as Errors does, so it is no sort of its own. A second click flips the direction. Change sorts by the change in the type's error rate, in points, counts such as 0 → 48 included; a type with no value to sort by ("–") comes last either way. A filter box above the table narrows it to the types whose name or id contains the text. The sort and the filter last the page visit; they are not in the URL.
- The Errors type detail has a third list, By message, beside Incidents and Every error. It groups the type's errors by normalized message (paths, ids, numbers and long quoted strings set aside), most errors first, each row with its count, share, projects, tools and newest time. A row opens its examples, and a button copies the normalized message. The search, the selected day or week and tool, and a linked example work in it as in the other lists.
- The Errors type detail breaks the type down by tool and by agent next to By project, each with count and share. A By agent row filters the page to that agent. A By tool row narrows that type's detail (incident count, By project, incidents and examples) to the tool, on top of a selected day or week; a chip or a second click clears it, and it lives in the URL (`etool=`). It replaces the "Mostly ..." phrase.
- The Errors page keeps its "fix applied" markers in the store, not in the browser, so they follow you to another port or browser and survive `ai-ledger rebuild`. Markers saved by an earlier version move to the store the first time the page loads, also for a type another browser muted meanwhile; a marker you undid stays undone.
- The Errors page can mute an error type you expect, such as a grep that finds nothing. A muted type counts as noise: the toggle, now "Hide noise and muted", leaves it out of the error rate, the chart and the table; with the toggle off it shows with a "Muted" chip. Where to start never suggests a muted type, and the summary's count of open fixes leaves it out too. Muted types are kept in the store, like the fix markers.
- An Errors permalink to an error the store no longer holds says so: a notice above the summary, with Dismiss, shows the view without it, over the range the link names (30 days when none) rather than all time.
- A click on a day or week of the Errors chart narrows the type table and the open type's incidents and examples to it. Enter or Space does it from the keyboard, a chip by the table clears it, and it lives in the URL (`at=`). Opening a type from the chart legend, Where to start or the palette clears a selected day that has none of its errors (the palette always clears it), and a day with errors but no tool calls says so instead of "no activity". The chart is announced as an application, since it takes arrow keys, Enter and Space.
- The Errors summary shows the uncategorized share: the errors in the catch-all types (Other, Other non-zero exit, MCP tool error) that no specific rule matched, split by agent when both have errors.
- The Errors type table shows each type's time lost (the time in its retry loops, first failure to last), the type detail adds the total, and Where to start ranks open fixes by time lost instead of error count.
- The project sheet shows the project's change against the previous period: previous and current cost, the change (marked new when it had no usage before) and a daily cost sparkline over both windows.
- The Cost heading compares the list-price estimate with your plan's monthly price ("4.2× your plan"), for Claude Pro and Max and ChatGPT Plus and Pro. A `plans` object in `prices.json` adds or overrides plans.
- Fast-mode requests are priced at the fast rates (Fable 5.2, Opus 5.5) and show as their own "fast" rows in the Cost page's Models and effort. A `fast` object in a `prices.json` entry sets the rates for other models.
- A `prices.json` next to the store adds or overrides model prices. The Cost page names the file when a model has no price.
- Activity shows thinking time and, per session, test runs passed of run.
- Limits forecasts use the open window's own recent pace as well as your usual pace, and say when a limit is already reached.
- Cost by project sorts by any column, and its tints compare each project with the median of the projects big enough to compare (2% of cost or 10 prompts), so scratch projects no longer make every real project look worse.
- Cost by project folds projects too small to compare into one "Small projects" row that opens on demand, and the project picker on every page gets a search box when it lists more than 12 projects.
- Cost by project and Most expensive sessions download as CSV, or copy as tab-separated text for a spreadsheet, with the rows in the order shown.
- Activity sorts its Sessions, Project metrics and Tools tables by column, lists failed test runs, shows the change against the previous period, charts errors per 100 calls, stacks the work chart by project, groups long ranges by week, adds a prompts-by-hour heatmap, and narrows Tools, MCP & hooks and Error loops to a selected day. The Sessions filters are kept in the URL.
- An `automated.json` next to the store lists more projects to treat as automated. Activity names the file when it cannot be used.
- New error types: "Command too complex for worktree check", "Network / DNS unreachable", "Browser automation failed" and "MCP tool error".
- The Cost page's Tokens and cache drawer shows each token kind's estimated cost and share of cost next to its tokens, biggest cost first.
- Live groups sessions by who needs you first: approval?, your turn, working, idle, ended. A session keeps its place in its group until its state changes.
- Live shows how long a session has been on your turn or thinking, and the tab title counts the sessions that need you: `(2) Live · AI Ledger`.
- Live shows a Claude Code session you closed as ended. Codex records no close, so a Codex session goes idle.
- The Cost chart's day tooltip lists the three costliest projects inside Other, with their cost, and how many more there are.
- The Cost chart hatches today's bar and keys it "Today so far", leaves today out of the 7-day average, and the heading says what the month is on pace for at list prices.
- The Cost chart stacks by project, model or agent: a Stack by switch beside Cost and Tokens, remembered in the browser. An agent's key in the legend filters the page to it, and the models inside Other list in the tooltip.
- Live filters the stream: failed calls only, main thread only, or without the calls that only read, except a failed one.
- Live links the stream to the session sheet on Activity, and shows the date on times from another day.

### Changed

- Days follow the local clock on every page, so totals and charts agree.
- Session duration is active time: pauses over 20 minutes are left out.
- Helper sessions (no prompt, or one prompt in a temporary directory) count as automated and are hidden by default. Active days count days with a prompt.
- An error incident belongs to one agent and ends after more than two successful calls of that tool in between.
- A test run is a test, build or lint command, not any command that mentions a tool name.
- Pages refetch only when new data is stored, and update without replaying their animations.
- Insights caps long lists at the top 12, lists sessions by title, and reports coverage as "N of M sessions analysed".
- Live, with Full text off, sends tool inputs cut to 300 characters and an agent call's description instead of its prompt.
- Live shows a shell call's description as its row text and on its wall tile, with the command in the opened row.
- Live folds a finished subagent, shows the last 5 calls of a running one, and gives each subagent's cost, model and errors in its header.
- Live, when paused, says Paused and shows no live dot.
- The nav's "Last ingest" keeps up with Live while it is open.

### Fixed

- Limits: the forecast's run-out time was up to one chart step late, and a 30-day window's forecast could miss the busy hours of the day. A forecast that reaches 100% exactly at the reset, or rounds to 100%, is no longer reported as a run-out.
- Cost: a day's sessions show that day's cost and add up to the bar; an unknown previous cost is no longer shown as $0.
- Cost: the plan multiple counts only the agents with a known plan and names them when another agent also spent. An unknown cost no longer reads as $0: per prompt and per commit show "–", the small-projects row shows "–", What changed keeps projects with an unknown cost, and the comparison says there was no priced usage instead of −100%. The day tooltip no longer lists a $0.00 Other, drops `claude-` from model names inside Other and says "1 unpriced request". The project-less row in Cost by project reads "(no project)", and the project search no longer says "No project matches" when the selected project matches.
- Errors: trends on a store with a thin start, the error-rate scale, and one "Change" comparison across the page.
- Live: subagent lanes no longer vanish after an update, late-written events are no longer missed, and running subagents carry their name.
- Limits: "Left unused" counts only full-length windows; "Points used" counts use inside the limit's own windows.
- Activity: the error-loops count, the Sessions table after a refresh, table layout at narrow widths, and the chart start.
- Project colours on a direct load of Insights, Live and Limits; the missing page icon; Back after closing a sheet.
- Live: a shell call with a timeout above 2 minutes no longer reads as "approval?".
- Live: the page reconnects on its own when the events stream fails with an HTTP error.
- Live: a finished Codex subagent folds as any other.
- Live: the rail's footer counts a session waiting for approval as waiting for you, not as working.
- A failed Refresh keeps its Retry until you retry; the status the nav polls no longer clears it.

## [0.1.3] - 2026-11-11

### Changed

- Releases carry provenance on PyPI: each file links to the commit and workflow that built it.

## [0.1.2] - 2026-11-11

### Added

- `ai-ledger` opens Activity in your browser when it starts. `--no-open` skips it. Nothing opens when the app runs without a terminal, or on Linux without a display.

## [0.1.1] - 2026-11-11

### Changed

- A shorter README, with GIFs of every page, Live and Insights included, in light and dark mode. Its links work on PyPI.

## [0.1.0] - 2026-11-11

First release on PyPI.

### Added

- Six pages: Activity, Cost, Errors, Limits, Insights and Live.
- Two sources, Claude Code and Codex, in the same tables, with a source filter on every page.
- The `ai-ledger` package and command: run it with `uvx ai-ledger`, or install it with `uv tool install ai-ledger`. It
  keeps the `serve`, `ingest` and `rebuild` commands and adds `--version` and `--port`.
- The package carries the built pages and the price table, so it runs without Node or a checkout.
- MIT license.

### Changed

- The store lives in the per-user data folder: `~/Library/Application Support/ai-ledger/` on macOS,
  `$XDG_DATA_HOME/ai-ledger/` (or `~/.local/share/ai-ledger/`) elsewhere. A source checkout's `data/ai-ledger.duckdb`
  moves there on the first start.

[0.5.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.5.0
[0.4.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.4.0
[0.3.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.3.0
[0.2.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.2.0
[0.1.3]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.3
[0.1.2]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.2
[0.1.1]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.1
[0.1.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.0
