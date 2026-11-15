---
title: Limits
description: Each plan limit window, what used it, and a forecast to its reset.
spec: [limits-dashboard, plan-limits]
---

Limits answers: **how much of each plan limit window is used, when will it run out or reset, and how much goes unused?** A plan limit window is the 5-hour or weekly allowance of a provider's plan, for example Claude Code weekly or Codex 5-hour. For the difference between a plan limit window and a model's context window, see [Windows](/ai-ledger/concepts/windows/).

<!-- shot slots: limits-lead (heading, status strip, suggestion, data line), limits-window-card (one open-window card), limits-past-windows (strips and table), limits-unused -->

## Where the data comes from

Limits reads two kinds of reading, and marks each figure as **measured** or **estimated**.

| | macOS | Linux |
| --- | --- | --- |
| Claude Code windows | The app sends your Claude Code OAuth token from the Keychain to Anthropic's usage endpoint at most every 5 minutes. The token goes nowhere else and is never stored or logged. | No poll. Limits estimates the windows from transcripts, as far as a calibration allows. |
| Codex windows | Read from the `rate_limits` blocks in Codex transcripts. | Read from the same blocks. |

A window with no measured reading is estimated: the last reading, plus the counted use since, divided by the calibration. The calibration is the estimated cost one percentage point buys, worked out from past readings and the cost of the use counted in the same windows. A window with no calibration shows its measured points, no forecast, and the reason; on Linux a Claude Code window has no polled readings to calibrate from, so it shows only what transcripts allow. An estimate counts local agent work only. Use elsewhere (claude.ai, Codex cloud) shows up at the next measured reading. See [Privacy and security](/ai-ledger/concepts/privacy-security/) and [Cost estimates](/ai-ledger/concepts/cost-estimates/).

## Filters

Limits has the shared project, time range and source filters. See [Filters](/ai-ledger/everywhere/filters/).

| Filter | What it changes |
| --- | --- |
| Range | Past windows, Left unused and What a point buys. |
| Source | Every section. Source Codex shows only Codex windows, history and value. |
| Project | Only the commits-a-point table in What a point buys. Limits are per account, so open windows always show account-wide use. |

There is no Include automated control on Limits. Open windows ignore the range.

## Navigation alert

A dot on the Limits tab, on every page, marks an alert. With no dot, no open window is in alert. The alert names the one worst open window, in this order. The dot's own tone is in brackets; it is separate from the chip tones in the status strip below.

1. **At its limit** (critical dot): the window that resets last of those at their limit.
2. **Runs out** (critical dot): the window forecast to reach 100% soonest, before its reset.
3. **High** (warning dot): the window with the highest percent used, from 90% up.

The 90% threshold applies only to High: a window at its limit or forecast to run out is in alert at any percent. Hover the tab to read the sentence, for example "Claude Code weekly is forecast to run out Sat, Nov 7, 2:00 PM". It ends with "(and 2 more)" when other windows are in alert too. A figure that is an estimate says so ("is estimated to be at its limit", "is at an estimated 92%"). A screen reader reads the sentence after the tab name, as "Limits alert: …".

## Panels

### Heading and summary

The heading names the window that will stop you first. It has three forms:

- "**Claude Code weekly** is at its limit (100% used) until Sat, Nov 7, 2:00 PM." A window is at its limit. If several are, it names the one that resets last.
- "**Claude Code weekly**, at 90% now, reaches 100% Sat, Nov 7, 2:00 PM, before its reset Sun, Nov 8, 6:00 AM." No window is at its limit and at least one is forecast to reach 100%. It names the one that does so first.
- "No limit runs out at the current pace. Fullest: **Claude Code weekly**, at 41% now, about 66% when it resets Sun, Nov 8, 6:00 AM." Every forecast ends below 100%. It names the window with the highest forecast at reset.

With no window, the heading reads "No plan limits seen yet." Times read as "Sat, Nov 7, 2:00 PM", in your time zone.

Under the heading:

- **Status strip** ("Open windows at a glance"): one chip per open window, in payload order. A chip shows the window name, the percent used now ("–" with no reading) and "resets in". A window at its limit or forecast to reach 100% before its reset has the warning tone and the text **at limit** or **runs out**. An estimated chip carries **est.**. With no open window, the strip does not show.
- **Suggestion**: "Send work to Codex: about 70% of its weekly limit would go unused (resets …)". It names the provider with the most headroom at the current pace. It never names a provider that has a window at its limit or forecast to reach 100%, and it shows only when at least two providers have a forecast.
- **Data line** (one per provider): "measured" or "estimated", the time of the last poll (or last reading, for a provider that is not polled) and how long ago. A provider with no reading says "no limit readings yet". A chip flags a problem: **polling failing**, **token expired** or **old** (the last reading is older than twice the poll interval). A reading from a provider that is not polled counts as estimated once it is over an hour old.

### Open windows

One card per open window, whole account, regardless of the range. The hint above the cards says the range and project filters do not apply. The chart key lists measured, reading, estimated, forecast, last 24 h pace (only when a chart shows it), likely range, now, limit, and plan change (only when a chart shows one).

A card shows, top to bottom:

| Part | What it says |
| --- | --- |
| Heading | The window name and the plan (for example "Claude Code weekly · max"), the percent used now, and a **measured** or **estimated** chip. |
| Chart | The percent used so far, the forecast to the reset with its likely range, a 100% line, and the reset time. A solid line with dots is measured, a dotted line is estimated, and a dashed line is the forecast. Plan changes are marked. |
| Caption | "At its limit until …", "Reaches 100% at … (between … and …)", or "Resets first at about 66% (60–85%)". With no calibration it says why there is no forecast. A **flat rate** chip marks a forecast made at a flat rate: a provider with fewer than 14 active days in the last 8 weeks. |
| Last-24-hours line | "If the last 24 hours continue: reaches 100% at …" (warning tone) or "… about 41% at its reset". It carries your use over the last 24 hours on to the reset. It does not show for a window at its limit or without a forecast. |
| Share line | For a scoped limit: "This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it". |
| Surfaces line | For a weekly window with a breakdown: "All of this week's use so far came from Claude Code", or "This week's use by surface: Chats 60%, Claude Code 40%". No line when every surface is 0%. A surface under 0.5% reads "<1%". |
| Pace line | "80% left · 3d 12h to reset · usual pace 6.8% a day; this window 5.1% a day over its last day; 23% a day would use it all · behind pace: about 59% would go unused". The verdict is **ahead of pace: runs out before the reset** when the forecast reaches 100%, else **behind pace: about N% would go unused**, where N is 100 minus the forecast percent at the reset. Windows shorter than a day read per hour. A window at its limit has no pace. |
| Cap in money | "100% ≈ $420 a week at list prices, from 37 points over 2 windows". Shows only for a calibrated window. |
| What used this window | A drawer, closed by default. |

**How the forecast is made.** The forecast follows your activity profile by hour of day, pooled across providers. Once a window has been open for a seventh of its length (at most a day), the forecast pace is halfway between your usual pace and the window's own pace over that last seventh, and the likely range covers both. A percent at reset from 99.5% up to 100% reads 99%, so "100%" appears only for a line that reaches it.

**Reading a chart.** Point at the chart to read the nearest point: "Sat, Nov 7, 2:00 PM · 42% · measured", or for the forecast "… · forecast 71% (60–85%)", ending in " · last 24 h pace 72.3%" where that line exists. By keyboard, the chart is one tab stop: focus reads now, Left and Right move between points, Home and End go to the first and last, and Escape clears. Keys with Alt, Ctrl, Meta or Shift held are left to the browser.

**What used this window.** The summary ends with the top project and its share ("What used this window · ai-ledger 54%"). Opened, it lists the top three projects and the top three models by estimated cost, each with its share and, for a calibrated window, its points ("≈ 12.3 points"). Hover a row for its cost at API list prices. The note says only counted local agent use at list prices is in it. The drawer counts use from the window's start to now, for the provider's agent and the models the limit covers, whatever the page filters say. Each project links to [Cost](/ai-ledger/pages/cost/) for that project, the window's provider and automated sessions included, at the smallest range preset (7, 14, 30 or 90 days, else all time) that covers the window's start. The link names that range. **Open in Cost** does the same with no project. A window with no counted use since its start has no drawer.

### Left unused

For each provider and window kind, the average share still unused when the windows reset, over windows that ran their full length, in the selected range. Each row reads "60% unused" with "4 windows" (and ", 1 estimated" where some are). The hint says how many windows that ended early, by an early reset or a plan change, are left out. A model-scoped window with nothing used and no counted use of its model is skipped. With none, it reads "No full-length windows in this range."

### Past windows

A drawer, closed by default, headed **Past windows** with the number of closed windows. It lists the closed windows of the selected range, newest first.

- **Strips.** One row per limit with closed windows, in the order of the open windows (provider, then the longest window first, then scope). Each bar is one closed window, oldest left, as tall as its final percent; a window at 0% still shows. A strip shows at most the 60 most recent windows and says "60 most recent of 143; the table lists all" when it holds more. A strip too wide for its box scrolls inside the box.
- **Key** ("Bar key"): red is **hit its limit**, hatched is **ended early**, outlined is **estimated**. A bar can carry all three. Each bar is a button whose name says the same in words, for example "Codex 5-hour, ended Sat, Nov 7, 2:00 PM: 100%, hit its limit for 4h 15m".
- **Keyboard.** A strip is one tab stop. Left and Right move between bars, Home and End go to the first and last, and Enter or Space picks the focused bar.
- **Curve panel.** Pick a bar to open that window's curve under the strips: the window name and plan, its start and end, its final percent and its notes, then the chart, without a forecast or a "now" line. It reads "Loading the curve…" while it loads. If the fetch fails it says so and offers **Retry**. **Close** (or picking the bar again) closes it and returns focus to the bar. The picked window is not in the page address. A filter that leaves the window out closes the panel.
- **Closed windows table.** Columns: Window, Plan, Ended, Final, At 100% for, Note. The picked window's row is marked. Note reads "ended early by a plan change …" or "reset early", and an **estimated** chip for a window rebuilt from counted usage. With none, it reads "No closed windows in this range." See [Data tables](/ai-ledger/everywhere/data-tables/).

### What a point buys

A drawer, closed by default. One point is 1% of a limit. Cost is estimated at API list prices.

- For each calibrated limit, a heading "Claude Code weekly: $8.00 a point" (with the plan, and "an earlier plan" when the limit belongs to one) and a table **Points by model**: Model, Points used, Tokens a point. A model without a price is marked **unpriced** and has no points. Points used count only use inside the limit's own windows on its plan, over the range.
- **Commits a point, by project**: Project, Limit, Points, Commits, Commits a point. Projects that used at least one point get a row; the rest fold into one "smaller projects" row. With a project filter, the table shows only that project. A figure without enough data reads as not available.
- With no calibrated limit, it reads "No calibrated limit yet."

## Sheets

Limits has no sheets. Its drawer links open [Cost](/ai-ledger/pages/cost/).

## What each figure means

| Figure | Meaning |
| --- | --- |
| Percent used | The share of the window's allowance used now. **measured** comes from a poll or a reading; **estimated** is rebuilt from counted usage. |
| Resets in / resets | The time to the window's reset, and the reset time. |
| Forecast, likely range | Where the percent used goes by the reset, from your hourly activity profile. The range covers your usual pace and the window's own recent pace. |
| Reaches 100% at | The forecast time the line crosses 100%, strictly before the reset. Reaching exactly 100% at the reset is no hit. |
| Last 24 h pace | The forecast if your use over the last 24 hours continued to the reset. It does not change the heading, the status strip, the caption or the suggestion. |
| Usual pace | Your average rate for this provider, weighted toward recent weeks. |
| Pace that would use it all | The pace that ends at exactly 100% at the reset. |
| Cap in money | The calibrated cost of one percent, times 100, at API list prices. It rests on the points and windows named in the line. |
| Points | Percentage points of a limit. |
| Early end | A window closed before its scheduled reset, by an early reset or a plan change. |

See the [Metric glossary](/ai-ledger/reference/glossary/) for every figure in the app.

## Playbooks that start here

- [Stop hitting plan limits](/ai-ledger/improve/plan-limits/): what used the window, the forecast and pacing.
- [Spend less for the same output](/ai-ledger/improve/spend-less/): plan fit and what a point buys.
- [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/): send work to the provider with headroom.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): where Limits sits in a routine across the pages.
