---
title: Cost
description: Estimated spend at API list prices, per project, model and session, compared with your plan.
spec: [cost-dashboard]
---

Cost answers three questions: what did this period cost, where did the spend go, and why did it change? Every figure is an estimate. It applies API list prices to the tokens in your transcripts; it is not a bill. See [Cost estimates](/ai-ledger/concepts/cost-estimates/) for what the estimate includes and leaves out.

The page follows the filters at its top. Every figure below describes the selected project, time range and source.

<!-- shot slot: cost-overview (the heading, comparison and sparkline) -->
<!-- shot slot: cost-changed (the "What changed" panel) -->
<!-- shot slot: cost-insights (the "What stands out" cards) -->
<!-- shot slot: cost-spend (the "Estimated cost per day" chart) -->
<!-- shot slot: cost-where (the "Where the spend went" and "Models and effort" panels) -->

## Filters

| Control | Values |
| --- | --- |
| Project | A searchable list of projects, plus "All projects". |
| Time range | 7d, 14d, 30d, 90d, All. The default is 30d. |
| Source | All, Claude Code, Codex. |
| Include automated sessions | On or off. |

The filters live in the page URL, together with the inspected project and the open session. The project filter changes only through these controls, through a project key in the chart's legend, or through a "Filter dashboard to" button in a sheet; selecting a project or session elsewhere opens a sheet and leaves the filter alone. See [Filters](/ai-ledger/everywhere/filters/).

## Page order

The page has a section index (Overview, Changes, Insights, Per day, Spend) and three drawers (Tokens, Projects, Sessions). A drawer is a table folded behind its title.

### Overview

**Shows** the heading, which answers "what did this period cost, and how does that compare?":

> $3,429 estimated cost 17.8× the previous 30 days

**Figures**

- The estimated cost of the view. With one project selected, the heading adds "on" and the project. With the All range, it adds "since" and the first day with spend.
- The comparison with the previous period of equal length:
  - from 2× up, a multiple: "17.8× the previous 30 days";
  - below 2×, a percentage: "+35% vs the previous 30 days" or "−12% vs the previous 30 days";
  - "flat vs the previous 30 days" when the two costs are within half a percent;
  - "nothing in the previous 30 days" or "no priced usage in the previous 30 days" when the previous period has no cost to divide by;
  - "no priced usage in this period" when no request of the view has a price.
  - The All range shows no comparison.
- A line gives the windows. For a range: "This period" with its dates and how many of its days had prompts, and "Previous" with its dates, its cost and its days with prompts. A "thin history" chip marks a previous window with prompts on fewer than half as many days as this one, since its multiple then says little. The All range has no previous window and no chip. For All: the dates and the number of days with prompts.
- A second line gives the sessions (and projects), the tokens and requests, and "Cost is estimated at API list prices" (and "leaves out unpriced models" when some are unpriced).
- "On pace for about $X this month." This is the projection for the calendar month: the cost so far this month up to yesterday, plus the mean daily cost of the last 7 complete days times the days left, today included. It follows the project, source and automated filters, not the range, so it shows for every range, All included. It is not shown without 7 complete days of history or without a priced request among them.
- The plan line: "You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan." The multiple divides the estimated cost by the plan's monthly price prorated to the view's days (monthly price × days / 30; for All, the days from the first recorded day to today). It names every plan in the view, and only the agents with a known plan count; when another agent without a plan also spent, the line says whose use it counts. A multiple below 1 shows as such. It states no savings. It is not shown without a known plan, without usage, or when the cost is unknown. Set plan prices in [Configuration](/ai-ledger/reference/configuration/).
- A daily cost sparkline across both periods: the previous period dashed, this one solid, with the split marked, and the two period costs under it. For All, it covers the whole history.
- With no requests in the view, the heading reads "No agent usage in the last 30 days." (or "yet" for All).

**Banners**

- **Unpriced models** appears when some model has no price. It lists each model with its tokens. Their tokens are counted; their cost is unknown and left out of totals. To price one, add it to the user prices file, whose full path the banner names, in the shape of the packaged `prices.json`. The next page load uses it, with no rebuild.
- **Prices file ignored** appears when the user prices file cannot be used. It names the file and the reason. Packaged prices apply until it is fixed. See [Configuration](/ai-ledger/reference/configuration/).

A "+?" chip beside a cost means the figure leaves out some requests from unpriced models. Its text says how many, and its hover text shows the count.

### What changed

**Shows** each project's change in estimated cost against the previous period, biggest move first, as bars either side of zero. The panel is titled "What changed vs the previous N days". It is left out for the All range, for a one-project view, and when no project moved.

**Figures**

- A line gives the two period costs and the change: "$120 → $3,429 (+$3,309)".
- Each row: the project, a "new" chip when it had no usage at all before, the bar, the change, and the two costs. A cost that is unknown (only unpriced models) shows "–" and no change.
- When projects marked new exist, the line adds how many and what they are worth.
- Two day strips show which days of each window have spend, with the count ("N/M days with spend").
- When the previous window is thin, a note says older transcripts may not be in the store, so read the multiple as "more than before".

**Controls** The top 8 projects show. **Show all N projects** shows the rest; the rows left out are summed into "N other projects". A row opens the project sheet.

### What stands out

**Shows** up to four findings, each with one action. The most severe leads, in a wide card; among equal severity, the finding with more money at stake (the cost of the project, session or day it names) leads. The others follow as compact cards. A card is marked "✓ Good", "▲ Watch" or "● Act", or has no mark.

| Finding | Figure | Mark | Action |
| --- | --- | --- | --- |
| Biggest spender (with one project selected, Biggest session) | The project's cost and its share of spend; its cost per commit. | Watch when its cost per commit is over twice the median project's. | Inspect project (or Open session). |
| Cost per commit | The median cost per commit and the view's cost per commit. | Good when no project is an outlier. Watch for an outlier, Act when the outlier is four times the median or more. | Compare projects (or Open session). |
| Peak day | The costliest day, as a multiple of the median day with spend and as a share of the range. | Watch when 5 or more days have spend and the peak is 3 or more times the median. | Show that day's sessions. |
| Cache hit | The cache hit ratio; the share of cache writes that use the 1-hour lifetime; the subagents' share of cost. | None. | See tokens and cache. |

**Rules**

- An outlier costs more than twice the median per commit and holds at least 2% of the view's spend. With one project selected, the same test runs over its sessions that have 2 or more commits.
- The median covers the projects big enough to compare: those with at least 2% of the view's cost or at least 10 prompts. A median per commit also needs projects with at least 3 commits. With fewer than 3 such projects, there is no median and the card says "Too few projects with commits to compare against a median."
- With no commits, the Cost per commit card reads "No commits" and its action is "See cost per prompt".
- The Cache hit card is left out when the cache hit ratio is unknown (no input tokens). Compare projects sorts Cost by project by cost per commit and rings the outlier.

### Estimated cost per day

**Shows** the chart of the view, one bar per day. The title reads "Estimated cost per day", with " by model" or " by agent" for those stackings, or "Tokens per day" for the Tokens measure.

**Figures**

- **Cost measure.** Each bar is stacked by the chosen **Stack by** value:
  - **Project** (the default): the projects that have a color of their own (the busiest of all time), by spend in the view, then Other in grey. With one project selected, one series.
  - **Model**: the models that cost the most in the view, up to six series colors, then Other, labeled without the `claude-` prefix.
  - **Agent**: one series per agent (Claude Code, Codex), no Other.
  - A day's total is the same in every stacking.
- **Tokens measure.** Each bar is stacked by token kind: Input, Output, Thinking, Cache read, Cache write 5m, Cache write 1h. Cache reads usually dwarf the rest.
- A 7-day average line, drawn when the view has 14 or more days. At a day, it is the mean of the 7 complete days ending there; today has none.
- Today's bar is hatched over each segment's color, and the legend adds "Today so far". The tooltip and the label say "so far".
- A label names the peak.
- The tooltip lists the day's parts, the total, and the unpriced requests. For Other, it lists the three costliest names inside it, with their cost, and "+ N more" when there are more. A project with no name reads "(no project)".

**Controls**

- **Stack by** (Project, Model, Agent) switches the stacking. It shows only on the Cost measure. The choice is kept in the browser.
- **Cost, Tokens** switch the measure. Cost is the default. The choice is kept in the browser.
- On the Cost measure, a project key in the legend filters the page to that project, an agent key filters to that agent, and the same key again (shown with ✕) clears the filter. Model keys, Other and the average line only name a series; they do not filter or toggle.
- On the Tokens measure, a legend key hides or shows a kind. The hidden kinds are kept in the browser. When every kind is hidden, a note offers "Show every kind".
- Select a day, or focus the chart, use the arrow keys (Home and End jump to the ends) and press Enter, to select that day. The Most expensive sessions drawer opens with every session active that day and its cost on that day, costliest first, so the costs add up to the bar.
- **Show data table** opens a named table: one row per day, one column per series of the current stacking, and a total. It is closed on every page load.

### Where the spend went

**Shows** the estimated cost per project, as a share of the total. With one project selected, the panel is titled "Most expensive sessions" and lists that project's sessions as a share of its cost.

**Figures** A row has the name, a bar in the project's color, the cost (with a "+?" chip when unpriced requests are left out) and the share.

**Controls** The top 8 rows show. **Show all N projects** (or **sessions**) shows the rest. A row opens the project sheet (or the session sheet).

### Models and effort

**Shows** the share of estimated cost of each model and effort level, costliest first. A row is named `model · effort`, with `· fast` for fast-mode requests, which form their own rows. A share above zero that rounds to 0% reads "<1%". A model with no price shows "–" and an "unpriced" chip.

**Controls** The top 8 rows show. **Show all N** shows the rest.

## Drawers

Each drawer title carries a count.

### Tokens and cache

The count is the view's tokens.

**Shows** four figures:

- **Cache hit**: the share of input tokens that came from cache, and the share of cache writes that use the 1-hour lifetime.
- **Subagent cost**: the share of estimated cost that came from subagents, with the amount, and the share of tokens.
- **Per prompt**: estimated cost per prompt, and tokens per prompt.
- **Per commit**: estimated cost per commit, and tokens per commit, or "n/a" with no commits.

Under them, each billed kind, biggest cost first: Input, Output + thinking (thinking is billed as output), Cache read, Cache write 5m, Cache write 1h. A kind shows its estimated cost, its share of the total, its tokens and its share of tokens. When no request is priced, the cost reads "cost unknown", not zero. A last row gives the requests and how many came from the main thread.

### Cost by project

The count is the number of projects.

**Columns** Project, Est. cost (with a bar), Tokens, Cache hit, 1h writes, Subagent cost, Commits, Cost / commit, Cost / prompt.

**Rules**

- Every column sorts, by click or keyboard; the sorted header carries `aria-sort`. The default is Est. cost, highest first. A project with no value in a column comes last in either direction. The sort resets when the view changes.
- With 3 or more big projects, the Cache hit, Cost / commit and Cost / prompt cells are tinted against the median project, with a ▲ or ▼ mark and a key above the table. A ratio 1.5 times the median or more away is tinted; cache hit is tinted from 10 points away. The median covers the projects with at least 2% of the view's cost or at least 10 prompts; Cost / commit also needs 3 or more commits. Hover a tinted cell for how far.
- Projects too small to compare (outside that set) fold into one row, "Small projects (N)", after the big projects, whatever the sort. The row sums their cost, tokens and commits. Folding needs at least 3 small projects and at least 1 big one. **Show N small projects** (and **Hide small projects**) toggles them. The selected project, and a project ringed by Compare projects, are never hidden. The fold resets with the view; the drawer count stays the number of all projects.
- A project with no commits shows "n/a" in Cost / commit.

**Controls**

- **Download CSV** and **Copy** export the table. Copy puts tab-separated text on the clipboard. The export holds every row in the order shown, small projects included even when folded, with costs and shares rounded to 4 decimals. The file is named `ai-ledger-cost-projects-<date>.csv`, dated today. A text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with an apostrophe; numbers are not.
- From Compare projects, a note says "Sorted by cost per commit, highest first.", gives the outlier's cost per commit and its multiple of the median, and offers "Sort by cost again".
- A row opens the project sheet.

### Most expensive sessions

The count is the number of sessions listed: the most expensive sessions of the view (up to 50), or with a day selected, every session active that day.

**Columns** Session (title or id, with start time and branch under it), Project, Active (pauses over 20 minutes left out), Prompts, Commits, Cost / commit, Est. cost.

**Controls**

- A day chip, "Active on *day*", shows when a day is selected. Its ✕ shows the most expensive sessions of the view again.
- **Download CSV** and **Copy** export the table, as above. The file is named `ai-ledger-cost-sessions-<date>.csv`, dated today, or with the selected day's date when a day is selected.
- A row opens the session sheet.

## Sheets

A sheet opens beside the page and does not change the filters. Its state is in the URL.

- **Project sheet**: Filter dashboard to *project*, Open project page, Open its errors; eight figures (estimated cost, sessions, tokens, cache hit, tokens from subagents, cost per commit, errors per 100 calls, error loops); with a previous period, the "Change vs the previous N days" (both costs, the change with its sign, a "new" mark, and a daily cost sparkline with the split marked); Models and effort; the most expensive sessions. See [Project](/ai-ledger/pages/project/).
- **Session sheet**: the whole session, its figures, timeline, models and tools, and a Copy button for its resume command. See [Activity](/ai-ledger/pages/activity/#session-sheet).

## Playbooks that start here

- [Spend less for the same output](/ai-ledger/improve/spend-less/): the model mix, the cache hit and the most expensive sessions.
- [Stop hitting plan limits](/ai-ledger/improve/plan-limits/): how the cost compares with your plan.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): a pass over Cost and the other pages.
- [Retro on one project](/ai-ledger/improve/project-retro/): cost per commit and per prompt by project.
- [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/): the Agent stacking and the Source filter.
- [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/): the Include automated sessions toggle.
