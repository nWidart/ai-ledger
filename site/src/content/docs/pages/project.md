---
title: Project
description: One project across all the other pages.
spec: [project-page]
---

<!-- Shot slots wanted: project-summary, project-cost, project-sessions, project-errors, project-context (the grid and its legend), project-insights, project-limits. -->

Project answers one question: how is this project doing, without visiting every page? It gathers the project's figures from Activity, Cost, Errors, Context, Insights and Limits on one page. Each block links to its page, filtered to the project.

Terms such as automated session, calibrated window, points and counted use are in the [Metric glossary](/ai-ledger/reference/glossary/).

## Filters

The heading is the project's name. Beside it are the shared [filters](/ai-ledger/everywhere/filters/). Every figure follows them, except where a block below says otherwise.

| Control | Values |
| --- | --- |
| Project | The project picker. Picking another project stays on the page and shows that project. |
| Time range | 7d, 14d, 30d, 90d, All. |
| Source | All, Claude Code, Codex. |
| Include automated sessions | Off by default; on adds sessions that tools start in the background. |

The tabs of the navigation keep the project, as on every page, and none is marked current on the Project page.

When the project has no request in the view, the page keeps its heading and filters and says "No use of <project> in this view." with a hint to pick a longer range, another source or include automated sessions. It shows no block.

## Panels

The page loads each block on its own. A block whose data fails to load says "Could not load <block>" with the error and a **Retry** control; the other blocks still show. Each block's heading has an **Open in <page>** link to that page, filtered to the project and to the page's range, source and automated filters. Blocks appear in this order.

### Summary

**Shows** a line, "Last N days, from the range filter" (or "All time"), "Estimated at API list prices." Then eight figures, each equal to the same figure on the project sheet for the same view.

**Figures**

| Figure | Meaning |
| --- | --- |
| est. cost | Estimated spend at API list prices. See [Cost estimates](/ai-ledger/concepts/cost-estimates/). |
| sessions | Sessions of the project in the view. |
| tokens | Tokens used. |
| cache hit | Cache-read tokens over all prompt tokens. |
| tokens from subagents | Share of tokens spent by subagents. |
| per commit | Estimated cost per commit, with the commit count: "per commit, N commits". `n/a` with no commit. |
| errors per 100 calls | Failed tool calls per 100 tool calls. |
| error loops | Runs where the same tool failed three or more times in a row within a session. |

**Controls** The heading link **Open in Activity** opens Activity for the project. When sessions of the project are active now, a link reads "N sessions active now" and opens [Live](/ai-ledger/pages/live/) showing only the project. With none, the block says nothing about Live.

### Cost

**Shows**

- **Change vs the previous N days**: the cost of the previous period, the cost of the last N days, and the change, with a **new** tag when the project had no usage before. A chart gives the cost per day over both periods. The all-time view shows no change.
- **Models by estimated cost**: the project's models ranked by estimated cost, as the project sheet and the [Cost](/ai-ledger/pages/cost/) page show them.

**Controls** The heading link **Open in Cost** opens Cost for the project.

### Sessions

**Shows** the project's eight most expensive sessions in the view, in a table named "Most expensive sessions": session (title and start), Branch, Active (active time, pauses over 20 minutes left out), and Est. cost.

**Controls** The heading link **Open in Activity** opens Activity for the project. Selecting a row opens its session sheet over the page, and the URL names the session.

### Errors

**Shows** figures that each equal what [Errors](/ai-ledger/pages/errors/) shows by default for the project, range and source. The block counts automated sessions too, as Errors does; when the **Include automated sessions** filter is off it says so: "Errors counts automated sessions too, whatever the filter says." With that filter off, this block's error rate can therefore differ from the Summary's errors per 100 calls, which follow the filter.

**Figures**

- **failed tool calls**, and the **error rate** with its call count.
- **Top error types**: the five most frequent types, in a table of Type, Errors, Rate and Change against the previous period ("Change vs previous N days").

With no failed call, the block says "No errors in this view." and lists no type.

**Controls** The heading link **Open in Errors** opens Errors for the project. A type links to Errors on that type, filtered to the project, range and source.

### Context

**Shows** a grid, five figures, and a **Measure now** control.

**Figures**

**Grid.** The grid draws a typical session's context window as 200 cells, ten rows of twenty, in the style of Claude Code's `/context`. Each cell is half a percent of the window. It fills cells for the median starting context, then for what the median peak adds, and leaves the rest free; a peak over the window fills the grid. The block shows no grid when the start's or the peak's share of the window is not known.

The legend beside the grid has a heading, "Typical session · 200k window" (the most common window), and "median of N sessions". It lists each part with its tokens and share of the window:

| Part | Meaning |
| --- | --- |
| Starting context | The median context at the start of a session. Without a snapshot, a note says it holds the system prompt, tools, memory and first prompt together, since transcripts do not split them. |
| Added by the peak | The median peak less the median start. |
| Free space | The rest of the window. |

**Snapshot.** When the project has a context snapshot, the starting cells split by the snapshot's categories loaded before the first prompt: system prompt, system tools, MCP tools, custom agents, memory files and skills, with the rest of the median start as "First prompt and other". The legend gives each category's tokens, says "Overhead measured <date> with <model>", and gives the deferred tools' total ("N deferred tokens of tools are not loaded"), which has no cells. When the categories exceed the median start, the cells split among the categories alone and the legend says the measured overhead is larger than the median start. A **Largest overhead items** disclosure lists the snapshot's five largest MCP servers, memory files and skills by tokens, each group only when it has items. The page uses the project's latest snapshot, whatever the range. The snapshot categories need a `/context` reading of the project; [Keep context lean](/ai-ledger/improve/lean-context/) covers how to take one.

**Context figures.** Each equals the figure [Context](/ai-ledger/pages/context/) and Activity show for the project. One the store cannot give reads `n/a`.

| Figure | Meaning |
| --- | --- |
| median starting context, tokens | Context at the start of a session, median. |
| of the window at the start | That start as a share of the model's context window. |
| tokens added per prompt | Context growth per prompt. |
| turns to the first compaction | Turns before the first compaction. |
| sessions near the context limit | Sessions that came near the limit. |

**Controls**

- The heading link **Open in Context** opens Context for the project.
- **Measure now.** The control shows for a project with Claude Code sessions in the view, or with a snapshot already. It runs `claude -p "/context"` in the folder of the project's latest Claude Code session, with the project's most used model, then ingests the result and shows the new snapshot. It calls no model and costs nothing, but it starts the project's MCP servers and hooks as a new session would; the block says so. The button reads "Measuring…" while it runs, and only one run goes at a time. The app chooses the folder and the model from the store. When Claude Code is not found, the run fails or times out, or no folder of the project exists, the block says "Could not measure" with the reason and keeps its figures.

### Session judgments

**Shows** how many of the project's Claude Code sessions `/insights` analysed, out of how many ("N of M Claude Code sessions analysed"), marked as a model's judgment as on [Insights](/ai-ledger/pages/insights/). Then **Outcomes** of the analysed sessions, as share and count, and **Top friction**, the three most reported kinds of friction with their session counts. With no analysed session the block says "No session is analysed by `/insights` in this view." and shows no outcome.

**Controls** The heading link **Open in Insights** opens Insights for the project.

### Plan limits

**Shows** two parts, each only when it has rows. The block is left out when there is nothing to show.

**Figures**

- **Share of each open window**: for each open limit window that lists the project among its top three users, the project's share of the window's counted use, with its points ("≈ N points") when the window is calibrated. A project outside a window's top three has no row there.
- **Commits per point**: a table of Limit, Points, Commits and Commits a point, for each limit with a figure for the project.

See [Windows](/ai-ledger/concepts/windows/) for how limit windows work.

**Controls** The heading link **Open in Limits** opens Limits for the project.

## Sheets

The Project page hosts the session sheet and the tool, MCP server and skill sheets. Their state is kept in the URL, as on Activity: reloading `/project?project=foo&session=abc` shows the Project page of `foo` with that session's sheet open.

## Open the page

The Project page has no tab. Open it in one of three ways:

- Select **Page** in the project chip of the navigation, which shows the project's name once a project filter is set. The link reads "<project> project page" for a screen reader.
- Choose **Open project page** in the project sheet. The sheet closes and the page opens with the same range, source and automated filters.
- With a project set, choose the **Project** row in the [command palette](/ai-ledger/everywhere/command-palette/) (`>project`).

Without a project the page has nothing to show. Opening `/project` with no project, or clearing the project on the page, opens Activity with the range, source and automated filters kept.

## Playbooks that start here

- [Retro on one project](/ai-ledger/improve/project-retro/): read the whole page for one project.
- [Spend less for the same output](/ai-ledger/improve/spend-less/): from the Cost block.
- [Keep context lean](/ai-ledger/improve/lean-context/): from the Context block and Measure now.
- [Kill repeated tool failures](/ai-ledger/improve/tool-failures/): from the Errors block.
