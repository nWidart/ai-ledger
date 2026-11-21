# Changelog

All notable changes to AI Ledger are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Cost's daily chart zooms. In views of 14 days or more, a slider under the day labels narrows the days the chart draws, down to 7. With the chart focused, plus halves the days shown and minus doubles them, around the day you are reading; while zoomed, "Show all days" beside the legend shows every day again. A screen reader hears the days shown after each change. An arrow key, Home or End that reads a day outside them moves them to include it, and the chart says the day, then the days shown. Zooming changes nothing else: the range, the totals, the other sections and the data table keep every day, and the value axis and the 7-day average stay those of the whole view. The zoom resets when you change the range, project, source, Include automated sessions, Cost or Tokens, stacking or scale, and when the view's first day moves (at midnight, or when older days arrive). It stays when new data arrives and when you hide or show a token kind.
- Limits shows Grok's plan limit. While it runs, the app asks `https://cli-chat-proxy.grok.com/v1/billing?format=credits` every 5 minutes for the percent of the period's credits used, with the access token of the Grok CLI's grok.com login, read from `~/.grok/auth.json` (or `$GROK_HOME/auth.json`) on each poll. The token goes only to that endpoint and is never stored, logged, shown or refreshed; an expired token skips the poll and marks Grok stale. Without a grok.com login (no Grok, an API key, or a custom endpoint), the app sends nothing and Limits shows no Grok card. The Grok card has the chart, forecast, history, unused capacity and value of the others, and works on macOS and Linux. The response names no plan, so Cost still has no Grok plan from snapshots.
- The app links to its documentation site. The top bar has a **Docs** link that opens the docs for the page you are on in a new tab (Activity's Judgments view opens the Judgments page); on a phone it is the last row of the page chooser. The command palette has "Docs: this page" and one "Docs: <page title>" per documentation page, found with `>docs`, `>help` or a page's title. "How measured" notes and "?" toggletips can end with a "Learn more" link to the section that explains the figure. A page that failed to load shows a Troubleshooting link beside Retry, the freshness control's details link to Troubleshooting while it says Failed or Offline, and when the store holds no session after an ingest, each page says so and links to Install. The app sends nothing to the documentation site until you follow a link.
- Grok CLI sessions are read too, from `~/.grok/sessions` (`--grok` sets another Grok home), and every page offers Grok in its source filter (`source=grok`, `#grok` in the command palette). Grok writes usage once per turn, so a session's tokens and cost appear when a turn ends, and the app splits each turn over its model calls by context size: totals are exact, one call's share is an estimate. A Grok request costs what Grok reported, not the list-price estimate. `/insights` does not judge Grok sessions, so Judgments cannot be picked with Grok alone. Copy resume command gives `grok --resume <id>`.
- Documentation site at https://nwidart.github.io/ai-ledger/: install, playbooks that improve your agent workflow, each page, configuration and the command line, in the app's typeface and colors, light and dark. It replaces the user guide in `docs/guide.md`.
- Time on the model and on tools, from the `cost-state` line Claude Code writes when a session ends (about late October 2026 on). Activity has a new "Output speed" tile (output tokens per second of model time, compared with the previous period; "n/a" when no session in view records model time), and the "Median session" note adds the time spent waiting on the model and running tools. The session sheet shows model time, tool time, output speed and lines added and removed. Figures include subagent work. Codex and older Claude Code sessions have none. Run `ai-ledger rebuild` once with the app stopped to fill the figures for sessions already ingested.
- Errors' Where to start lists every applied fix in an "Applied fixes" table: the error rate before the fix and since, and the same verdict as the type detail ("Rate lower", "Not enough calls yet" and so on). It is hidden when no fix is marked.
- Each incident on Errors shows its attempts on a small time strip: ✕ for each failure, then ✓ when the next call succeeded. A tight retry loop is a short strip of crowded marks, failures minutes apart a long one; a screen reader hears it as text ("3 failed attempts over 4s, 2s apart on average, then the next call succeeded 2s later").
- Errors' rate chart has a "Show data table" disclosure, as on Activity and Cost.
- Cost's tokens chart has a Scale switch, Volume or Share. Share draws each day as a 100% bar split by token kind, so each kind's daily share is readable beside the cache reads that dominate Volume. It drops the 7-day average and the peak label, and the tooltip, screen-reader text and data table give each kind's share and the day's total.
- The Live tab shows a badge with the sessions that wait for you (a likely approval wait, or your turn), on every page. It shows nothing at 0 and "9+" above nine, and the tab's name says the count for a screen reader.
- The Limits tab shows the percent of your fullest open limit window, on every page ("≈" marks an estimate). It replaces the alert dot: the pill turns amber or red, with a ring, when a window is nearly full, at its limit or forecast to run out. It keeps one width from "7%" to "≈100%", so no tab moves.
- Judgments' session cards show what the store measured of each session: its estimated cost, its peak context as a share of the window, and its failed tool calls.
- Judgments' Friction categories can be weighed by the cost or the active time of the sessions that reported each friction, or by reports. Cost is the default, and each row shows the other two beside it. A session with no price adds its active time but no cost.
- The command palette opens Activity's Judgments view with `>judgments`; `>insights` finds the same row.
- Activity's Sessions tab has **Model** (model time) and **Tok/s** (output tokens per second of model time) columns, whole-session figures that sort like the others. Sessions that record no model time, Codex and older Claude Code ones, read "–" and sort last either way, and add nothing to the Output speed tile. On a narrow window the sorted column stays shown. `/api/sessions` rows add `model_ms` and `output_per_s` and accept them as `sort`.

### Changed

- The documentation site adds **Concepts → Supported agents** (one matrix of what Claude Code, Codex and Grok record) and **Everywhere → Sheets** (extracting the shared session, project and tool sheets from Activity), groups the 11 workflow playbooks into **Routines**, **Efficiency & limits** and **Reliability & workflow**, renames the comparison playbook to **Compare Claude Code, Codex and Grok**, refreshes every panel screenshot with Grok demo data, and adds theme-token and screenshot-list drift checks to `site/`'s check.
- The page-wide filters are in one scope bar under the navigation, the same place and the same tab stop on every page: project, range, source, then **Include automated sessions**. It stays at the top with the navigation as you scroll. Each page shows only the filters that change it; a section's own filter (Limits' range) is in that section's header. With a project picked, a ✕ "Clear project filter" button sits beside the picker and the bar ends with a **Brief** link to the Project page. The navigation no longer shows the project chip, and the Search button shows the project's color dot and name while a project filter is set. On a phone the bar is one **Filters** button with the number of filters set, which opens them over the page.
- Live's agent panel is gone: a status strip above the stream shows the session's state, a context meter, cost, tools, errors (still the failed-calls filter), cache read, each plan limit, its working directory and **Copy resume**. A plan limit's reset time is behind a toggletip that the keyboard reaches. The stream gains the panel's width: 1,102px instead of 798px at 1440 x 900. The strip has no request count; the session sheet lists requests per model. A session that fails to load says so once, in its panel. The session payload's context window no longer disappears on a catch-up of a Codex session on an unpriced model.
- Live's tokens-per-minute chart is now a pulse of the last 10 minutes: the context of each main-thread request, and a tick for each finished tool call, upright for a success and ✕ for a failure. It reads by keyboard one minute at a time and names its summary, from its lowest to its highest context, for a screen reader. Cache rereads no longer look like work. The session payload's `spark` is now `pulse`, and it adds `cwd`.
- Each Live rail entry has a third line: a small context meter with its percent, the latest action, and `✕ N` when calls failed. Eight sessions still fit the rail at 1440 x 900.
- On Live's Wall, selecting a tile pins its stream beside the tiles instead of leaving the Wall. Two pins at most: pinning a third unpins the oldest and says so. A pinned stream has its own filters, Follow, a **Session sheet** link, **Open in Stream** and **Unpin**. A pin says when it is loading, when an update failed, and when its session is not found. The pins are kept in the URL (`pin=`).
- Live's connection status sits in the bar, and the Full text warning opens over the page with **Dismiss**, so the stream no longer moves down when Full text turns on; the toggle keeps a warning tint while on. On a phone the rail is one row that scrolls sideways, so the page no longer scrolls sideways and the first event shows on the first screen; the strip keeps the working directory, and the pulse's readout stays on the screen.
- The navigation has two groups: **Now** (Live, Limits) and **Review** (Activity, Cost, Context, Errors). The page chooser on narrow screens lists the same groups. Every tab uses the same active style; Errors no longer has a red one.
- Insights is now the **Judgments** view of Activity, picked with a switch above the heading and kept in the address (`/usage?view=judgments`). The Insights tab is gone. An old `/insights` link opens the view with its filters, its judgment filters, its open session and its section anchor (`#d-goals`).
- Judgments shows no source filter, and no longer says "/insights analyses only Claude Code sessions" on an empty page. With Codex as the source, Activity shows Overview, and the Judgments button says why it cannot be picked; so does the Project page's Session judgments block, in place of its link. A judged session's sheet over a Codex view links to Judgments for every source.
- Judgments' Outcome trend is a chart: one bar per week, each 100% of that week and split by outcome, with the week's sessions over it. A week with fewer than 5 sessions is drawn at half width. Every outcome with a session shows, even 1 in 150, and on a phone the counts thin out instead of overlapping. The arrow keys read each week (Alt, Ctrl, Meta and Shift keys stay the browser's), and a data table lists them.
- Judgments' Outcomes and Claude's helpfulness are each one stacked bar of the analysed sessions, over a row per outcome or rating with its share and then its count (helpfulness showed the count first). The Outcomes bar has the outcome trend's order and colors; the helpfulness bar runs from essential to unhelpful in two greens, amber and two reds. The rows still filter the session list. A bar that stands on fewer than 5 sessions says "Few sessions: one session moves this bar a lot", and every part with a session is at least 3px wide, so 1 session in 200 still shows. Satisfaction signals and Claude's helpfulness sit side by side on a wide screen and stack on a narrow one, and on a phone with large text each row's name takes its own line over its share and count.
- The amber warning color is one step darker in the light theme, so it keeps 3:1 contrast as a fill. This applies on every page.
- Sessions, tools, MCP servers, skills and projects open their sheet over every page, Limits included. From Limits, the command palette and the right-click menu no longer send you to Activity, and the projects in What used this window and Commits a point, by project open the right-click menu.
- The docs site lists the pages in the navigation's order, and the Insights page is now Judgments, at the same address.
- Activity's Overview is a workbench. Its tables sit in tabs under the chart: Sessions, Projects, Tools and MCP, and Loops and tests, with the tab kept in the address (`tab=`). Loops and tests shows the five newest error loops and failed test runs, with "Show all" for the rest. The seven drawers and the section index are gone; at 1440×900 the work chart and the tab list fit the first screen.
- Activity's work chart draws errors per 100 tool calls on its own track under the bars, on the same days or weeks, in place of a line on a second axis. Week bars can be selected now, by click or Enter: a selected day or week narrows every tab to its days (Projects and Failed test runs too), shows a chip beside the metric switch, and clears with the chip or Escape on the chart. The week is kept in the address (`week=`, its Monday). A week the range cuts short counts only its days in the range, active time included, and the tab names those days. A tile or a Needs attention action clears the selection, since its figure covers the range.
- Activity has five tiles, each a way in: Sessions opens the Sessions tab, Errors per 100 calls opens Errors, Test runs passed opens the failed test runs, Subagents opens Projects by subagent share, Output speed opens Sessions by active time. Output speed gets a trend line per chart bucket, and on a Codex-only view gives way to a note. The median session moves into the Sessions tile, with the total active time and the thinking time, and the prompts interrupted, with their count and the turns and tool calls per prompt, to a line under the heading.

- Context is shorter and leads with what to act on:
  - The tips are one strip of short items under the heading, at most four before "Show N more"; an item opens its evidence, advice and sessions in place.
  - Three tabs replace the section index: Overhead and pressure, Growth and bloat, and Cache health. The URL keeps the tab (`tab=growth`, `tab=cache`), and arrow keys, Home and End move between tabs.
  - The cache chart draws the tokens not read from the cache (uncached input and cache writes) as its bars, the cache breaks by cause on a strip under them, and the cache-hit ratio on its own thin track. Cache reads join the bars only when you turn them on.
  - The session map names its four quadrants (Lean, Heavy start, Grew full, Heavy and full). Selecting one narrows the window pressure bars to its sessions and lists them; one Escape clears it, with any reading. Sessions show their titles on the map and in the pressure lists.
  - Overhead and pressure draws the Project page's window grid for each of the six projects with the most sessions that have a measured start, a known window and a peak, drawn from those sessions alone, or the one full grid with a project selected.
  - The compaction, long-prompt-tier and large-start tips name Codex's commands (`/new`, `/compact`, `codex mcp list`) for Codex sessions, and Claude Code's for Claude Code sessions.
- Errors puts each control where it acts. The header keeps project, range and source; Day / Week moves into the rate chart's header, and "Include subagents" and "Hide noise and muted" into the type table's toolbar. Links and saved views keep working: the URL keys are the same.
- Errors' type table has four columns and fits its pane without scrolling sideways: Type; Errors and Rate, with the share as a bar; Time lost, with the share not recovered under it; and Trend, with a tick on the day a fix was applied, and Change under it; select a change to see the two rates behind it, or why it shows "–". All six sorts stay, two to a header where a column holds two figures. "Didn't recover" is now "Not recovered".
- Errors matches the other pages: panels instead of cards, messages without contractions ("Could not load errors."), no "Ingested …" in the date line or ingest note under Where to start (the navigation shows both), and on a phone the whole summary, vitals two to a row, instead of a "More summary" button.
- New logo: a bound ledger whose page ends in an accountant's double rule, in place of the bar-chart tile. It shows in the app's navigation, as the app's favicon, and in the docs site's title bar and favicon.

- Tokens and cache on Cost compares each billed kind's share of tokens with its share of estimated cost as a two-sided bar, with a sentence naming the kind where they differ most and a data table of the exact figures (full token counts, dollars to the cent). Models priced at zero rates read $0.00, not unknown. It replaces the plain list. The 5-minute and 1-hour cache writes are one Cache write row; the table keeps both.
- The Project page shows its blocks in two columns on wide screens (Activity, Cost and Context; then Errors, Plan limits, Sessions and Session judgments) and in one on narrow screens. Its first block is now Activity, with figures the project sheet does not show (prompts, commits, active days, requests, median session, cost per prompt, turns per prompt, interrupted prompts) in place of the sheet's eight. Cost adds each token kind's share of tokens beside its share of cost. The heading, filters and blocks show at once, and each block loads, fails and shows its empty state on its own; a slow or failed usage request no longer holds back or dims the other blocks. A filter change keeps each block's figures, dimmed, until the new ones arrive, and after Refresh only the blocks whose data changed fade in. Activity says "Checking for active sessions…" until Live answers. With no use in the view, the blocks still show under the message, so Context can still show its snapshot and measure from it.
- Session links on Errors, Activity's Judgments view and Live open the session sheet over the page instead of going to Activity. The page keeps its state, Live keeps its stream and live connection, and Close or Back returns to it. The URL names the open sheet (`sheet=` on Live, where `session=` is the followed session), and middle-click opens it in a new tab.
- The last ingest and Refresh are one control: a Refresh button (it reads "Retry" after a failed refresh) and the last ingest as a clock time. Clicking or hovering the time shows the exact time, new lines, last data change, interval and the full error. It reads "Stale" when the last ingest is older than three intervals, "Failed" after an ingest error and "Offline" when the app does not answer. "+N lines" appears for a few seconds after an ingest stores new lines.
- The navigation stays on one row at every width. Narrower windows hide the wordmark, shrink Search to an icon, hide the groups' names and tighten the tabs. On narrow screens a page chooser (the current page's name, or "Pages" on the Project page) replaces the tabs and carries the Live badge and, while a window is in alert, the Limits pill.
- Screen readers no longer hear every timed ingest; only the result of a manual refresh is announced.
- Cost puts the daily chart on the first screen. A plan gauge beside the heading shows the month's cost so far and its pace against a tick at your plan's monthly price, with an "N× plan" badge (the pace over the plan price). Without a known plan it shows the cost so far and the pace only. It replaces the sparkline and the "On pace for…" and "You pay about…" sentences. The old prorated "N× your plan" multiple of the range is gone.
- Cost shows each project once, in "Project spend and change": a daily trend, spend with its share, the change against the previous period (new projects marked; projects used only before listed at $0), cost per commit and cache hit. Every column sorts, small projects fold into one row, and a row opens the project sheet. It replaces What changed, Where the spend went and the Cost by project drawer. Tokens, 1h writes, subagent cost share and cost per prompt per project are in its CSV and Copy export, which also gains the change.
- Cost's heading keeps the cost and its change. The windows' days with prompts, the sessions, tokens and requests, and how the estimate and the pace are computed move to a "How measured" disclosure. The Biggest spender and Cache hit cards are gone; the project table and Tokens and cache show the same figures.
- Limits is easier to read:
  - Each open-window chart draws four things: the line used so far (solid where measured, faded where estimated), the forecast as a shaded cone (amber when its high edge reaches 100% before the reset), now, and a faint safe-pace line from now to 100% at the reset. The chart key is gone.
  - Each card's header gives the percent and one status ("runs out …", "at its limit until …", "about N% at reset"). A footer gives headroom, pace against the safe pace ("18%/d vs 7%/d safe") and the top project. Everything else, including a table of the chart, is behind **Details**.
  - The last 24 h pace line is behind one toggle.
  - The status strip is gone.
  - Past windows are always on the page, each limit with "avg N% unused · K hits", and replace the Left unused panel. Their table is behind **Show data table**.
  - The time range moved into the Past windows header. Limits has no project filter: "What a point buys" lists every project, and the Project page still shows one project's plan-limit figures.
  - The heading gives at most two figures, and the forecast method is behind **How measured**.
- Shorter pages on Activity, Context, Errors and Insights. On the demo store at 1440×900, Context drops from 8 to 5.5 screens, and every main chart starts on the first screen.
  - Drawers start closed on every page load, and a page opens one at a time: opening a drawer closes the open one. Drawers you left open before this version start closed.
  - Each section's hint is one line. Method text sits behind a **How measured** link at its end.
  - Each heading states at most two figures, and no tile repeats them. Activity reads "N commits from M prompts". Errors reads "N failed tool calls (X%)"; the Error rate tile is gone and a **Top type** tile is new. Context leaves the compacted sessions to its Growth tiles. Insights drops the Sessions analysed tile.
  - Context's By tool and By MCP server tables are gone: the Largest contributors table gains Calls and Largest columns, sortable columns and **Show all N tools**.
  - Insights shows the model-judged tag once, in the page heading.

- Text follows the browser's default font size: font sizes are relative, chart labels scale with them, and nothing is cut off at 200%. In Chrome and Edge 146+ the dashboard also follows the operating system's text scale.
- Activity's Output speed tile opens the Sessions tab sorted by Tok/s, fastest first, instead of by active time. Activity's Overview is 20px shorter above the tabs, so the tab list clears the first screen at 1440 x 900 with room.
- Cost's daily chart follows a theme change, and an operating-system light or dark change under System, without a reload. Escape closes its tooltip wherever the focus is. In forced colors the day you are reading is a highlight-colored band instead of a thin frame. On a first visit the chart draws a moment after the page, in a box already at its height, and its bars grow once, on that first draw, not each time new data lands. When new data lands, the day you are reading stays read; a screen reader hears it again only if you read it with the keyboard and its figures changed.

### Removed

- The sticky section index on Cost and on Activity's Judgments view, and its "Jump to" menu on narrow screens. Only the navigation and the scope bar stay at the top now. Each section keeps its heading.
- Activity's Prompts by hour heatmap, and `work_hours` in `/api/usage`. To spot a script by its hours, sort the Sessions tab by prompts and read the start times.

### Fixed

- Judgments' Session types bar shows in a forced-colors (high contrast) mode, where its parts used to vanish.
- The Activity work chart no longer lets one quiet day set the scale of its errors-per-100-calls line. A day or week with fewer than 50 tool calls draws its rate as a hollow dot, is left out of the right-hand axis, and says "too few calls for a steady rate" in its tooltip and data table, as the Errors chart does. A legend key explains the hollow dot.
- Escape closes the Activity work chart's tooltip that the pointer opened while the focus is elsewhere, such as on the metric switch.
- In forced colors, the hovered and selected bars of the Activity, Cost and Judgments charts are framed at full strength, and the work chart's hollow-dot key matches its dot. The Sessions search box has a 3:1 border.
- Gaps found in a design review of the recent changes:
  - **Open session** in the command palette and the context menu opens the sheet over Insights and Live too, instead of going to Activity. On Live it keeps the followed session and the live connection, also when the same command changes the project. Session links on Errors' examples and Insights' cards open the context menu, and focus returns to them when the sheet closes.
  - On a narrow screen, a session or tool sheet opened from an Errors type sheet stacks over it with **← Back**. Back, Close, Esc or a click beside it returns to the type and to the link. A link or reload that names both keeps the session sheet on top.
  - Cost, Errors and Limits use the same **How measured** toggletip as the other pages. Errors' uncategorized share and incident line explain themselves there instead of in hover text.
  - Toggletips no longer read their text aloud on hover. Their text follows the button in the page, so a screen reader reaches it once the button is expanded. A long one fits the window and scrolls, by keyboard too.
  - Limits: the forecast, estimated and safe-pace lines are dotted or dashed at full contrast instead of faint, and keep it while a slow range change dims the page. An estimate between two readings is dashed, with no solid line drawn over it. The percent chip reads "estimated", a missing pace says why behind a **?** (at the limit too), each project in What used this window shows its cost, and a limit's unused summary explains itself behind How measured instead of hover text. Plans show their tier ("max 20x") instead of only in hover text. A scenario that reaches 100% reads in the warning style. The **Last 24 h pace** toggle hides when every window with a scenario is at its limit, and its line goes with it when a refresh brings the last one there. A past window's curve has its data table, What a point buys names its range and keeps its pricing note behind How measured, and the closed windows table gives time at the limit as "4h 15m", as the bars do.
  - Context's Largest contributors keeps the ten largest tools whatever the sort, scales its bars to them, and draws no bar for Other.
  - Cost: **Sort by cost again** moves focus to the Spend header, every sort is announced to screen readers (Compare projects, a repeat and a new view's reset too), and the unpriced chip reads "plus an unknown cost for N requests from unpriced models".
  - Durations read in one unit everywhere and never round across it: 59.6 s reads "1m", not "60s". Errors writes "20m" where it wrote "20 min".
  - The warning that `automated.json` was ignored shows under the navigation on every page, not only Activity, and every automated toggle names the file.
  - The Errors chart's keyboard reading says "too few calls for a steady rate" for a hollow point, as Activity does. Hollow points stay visible in Windows high contrast. The weekly work chart's How measured says "per week".
  - Errors, Insights and Live give each page one heading that names it, while loading, after a failed load and with nothing to show.
  - Live's wall reads "1 error", not "1 errors". A followed session with no title has its project as the stream's heading.
  - Activity's Output speed tile says "Codex transcripts record no model time." when every session in the view is a Codex one, priced or not.
- The right-click menu opens on more sessions, tools, error types and projects: the sessions of Activity's Error loops and Failed test runs, of Context's quadrant list and window pressure list, the rows of Errors' Applied fixes for a type with errors in the view, an Errors example's tool name, and each of Context's small window grids.
- A thin segment of Activity's work chart no longer vanishes beside a tall one: it keeps at least 1px. Context's cache chart keeps a full bar with thin parts inside its track.
- The Project page's Errors block explains a type's change in a toggletip instead of a hover-only title. With the source on Codex alone, it no longer asks for session judgments, and shows none kept from another source. Its project picker also lists Context's projects when usage has not answered.
- Picking or clearing a project, or picking a source, closes Live's open session sheet, as it does on the other pages.
- Errors' rate chart keeps its hint on a phone, as the other pages' charts do, and the Incidents vital no longer repeats what "recovered" means.
- Context's "Tool results fill the context" tip no longer tells Codex sessions to hand bulk reading to a subagent; when both agents match, it names Claude Code for that line.
- Alt+Left (Back), Ctrl+Home and other modified keys work again while a chart or a tab list has focus, on Activity, Cost, Context, Errors and in the session sheet's timeline. The charts and tabs handle their keys only without Alt, Ctrl, Meta or Shift; the timeline keeps Shift for its ten-request step.
- A screen reader hears all a Live wall tile shows in the tile's name, "Pin" and the session, then its state, latest action, context, tools, errors, cost, branch and model, kept current as the tile updates, with its pressed state.
- Live shows "N new events" beside **Jump to latest** while Follow is off, at once and then at most every 5 seconds, in a polite status. It was for screen readers only. The count starts when Follow turns off, by the checkbox too, and still counts once the stream holds its 2,000 events.
- Closing a sheet on Live moves focus to the page heading when the control that opened it is gone, as on the other pages.
- Tab from Activity's workbench tabs reaches the selected panel, as on Context.
- In forced colors, Live's pressed Errors figure and Activity's selected workbench tab are outlined in the highlight color, and Limits' pressed **Last 24 h pace** toggle is filled with it, so it reads as pressed with keyboard focus too.

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

[0.4.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.4.0
[0.3.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.3.0
[0.2.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.2.0
[0.1.3]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.3
[0.1.2]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.2
[0.1.1]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.1
[0.1.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.0
