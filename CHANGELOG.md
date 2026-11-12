# Changelog

All notable changes to AI Ledger are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Run `ai-ledger rebuild` once after upgrading (with the app stopped): error types, test runs, Codex tool timing and fast-mode speed are stored when transcripts are read.

### Added

- The Limits cards have a drawer, "What used this window", closed by default: the top projects and models of the window's counted use so far, with their shares and points. Each project links to Cost with that project, the agent and the nearest range preset (7, 14, 30 or 90 days, else all time), and "Open in Cost" does the same for the whole window.
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

[0.1.3]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.3
[0.1.2]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.2
[0.1.1]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.1
[0.1.0]: https://github.com/nWidart/ai-ledger/releases/tag/v0.1.0
