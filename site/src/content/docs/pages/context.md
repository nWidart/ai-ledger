---
title: Context
description: How full the context window gets, how fast it grows, and what fills it.
spec: [context-dashboard, tool-inspector]
---

Context answers: how much of the model's context window does a session start with, how fast does it grow, how close does it get to the limit, what fills it, and what does the prompt cache save or lose? It reads Claude Code and Codex sessions with the same figures. The page is at `/context`.

Terms such as cache read, cache write and long-prompt tier are in the [Metric glossary](/ai-ledger/reference/glossary/). Every figure comes from the transcripts. The page reads no `CLAUDE.md`, `AGENTS.md`, `.mcp.json` or other configuration file. A token figure taken from a tool result's size is an estimate and is labelled **estimate** wherever it appears.

<!-- shots: context-overview (heading, filters and Tips), context-starting, context-growth, context-pressure, context-fills, context-cost -->

## Filters

The header carries the shared filters. Every figure, chart, table and tip on the page follows them, and the URL keeps them.

| Control | Values |
| --- | --- |
| Project | All projects, or one project. |
| Time range | 7d, 14d, 30d, 90d, All. |
| Source | All, Claude Code, Codex. |
| Include automated sessions | Off by default; on adds sessions that tools start in the background. |

A session is in the view when it has a request in the range. Its own figures (starting context, growth, compactions) cover the whole session. See [Filters](/ai-ledger/everywhere/filters/) for how the filters behave on every page.

## Section index

Links to Overview, Tips, Start (Starting context), Growth, Pressure (Window pressure), Fills (What fills context) and Spend (Cost), then to the two drawers: Results (Largest tool results) and Cache breaks (Sessions where caching broke).

## Panels

### Heading

**Shows** the view's answer: "A typical session starts with N tokens of context, X% of its window." It adds how many sessions compacted. The line under it says that the figures are the prompt tokens of each session's first turn.

With no measured session, the heading reads "No {agent} session{ in project} with a measured start in the last N days." (or "… yet." for All). The agent is "agent", "Claude Code" or "Codex", by the Source filter.

### Rebuild notice

**Shows** a notice, "The store holds sessions from before this version", when either of these holds in the view:

- some tool calls have no result size;
- some sessions that compacted have no recorded first compaction.

**Figures** It gives the counts ("N of M tool calls carry a result size") and says to stop the app and run `ai-ledger rebuild`. The figures on the page still cover the rows that have them. See [Troubleshooting](/ai-ledger/reference/troubleshooting/) and the [CLI reference](/ai-ledger/reference/cli/).

### Tips

**Shows** tips from six fixed rules. The app sets the thresholds; nothing is learned or generated. A tip shows only when its rule fires on the view. When none fires, the section reads "Nothing stands out in this view." Tips run most severe first (critical, then warning), and within a severity in the order below.

**Figures** Each tip is a card with a severity, a title, its evidence, its advice and a count of the sessions that match. A small label names the kind of finding: Starting context, Compactions, Window limit, Tool results, Prompt cache or Long prompts.

| Tip (title) | Fires when | Severity |
| --- | --- | --- |
| Sessions start with a large context | A project's median starting context is 30,000 tokens or more. | Warning |
| Sessions compact repeatedly | A session compacted 3 or more times. | Warning; critical at 6 or more |
| Sessions reach the limit of the window | A session peaked at 80% or more of its window. | Critical |
| Tool results fill the context | A main-thread tool result is 100,000 bytes or more. | Warning; critical at 400,000 bytes or more |
| The prompt cache breaks within sessions | A session has 2 or more cache breaks. | Warning |
| Requests are priced on the long-prompt tier | The long-prompt-tier cost is at least $1 and at least 10% of the view's estimated cost. | Warning |

The evidence of the large-start tip names the five projects with the largest medians with their window shares, counts the rest, and lists the MCP servers that the transcripts record as called in those projects, fewest calls first. A server that is configured but never called leaves no trace in a transcript, so it is not listed.

**Controls** Selecting the count opens the **Sessions matching** list: the 20 newest matching sessions, with how many more are left out, each with its title, project, source and start time. Selecting a session opens its session sheet. The open tip is in the URL, and browser Back closes it.

### Starting context

**Shows** the prompt tokens of each session's first turn, which is what the model read before any work. The section's hint states how many sessions have a measured start and how many have a known window; a share of the window covers only sessions with a known window.

**Figures**

- **Starting context by project** table. One row for the whole view (when there is more than one project) and one per project:
  - **Median**, **10th percentile**, **90th percentile**: the spread of starting context over the project's sessions.
  - **10th to 90th percentile**: a bar on one token scale for every row, a tick at the median, and a dashed line at 30,000 tokens, the mark of the large-start tip.
  - **Share of window**: the median share of the model's window, with the window size.
  - **Sessions**: sessions measured. A project with none shows no figure, not zero.
- **Median start by week**: the weekly median of starting context with its 25th to 75th percentile band, one point per week of session start. A week with fewer than 3 sessions has a hollow dot and is read as resting on few sessions. A week with no session is a gap, not a joined line.

**Controls** Selecting a project row opens its project sheet. On the weekly chart, arrow keys read a week; **Show data table** lists week, median, 25th and 75th percentile, and sessions.

### Growth

**Shows** the median context (prompt tokens) at each turn of a session.

**Figures**

- **Growth chart**: the median at each turn index over the sessions that reach it, up to turn 100, with the 25th to 75th percentile band. A point needs at least 5 sessions that reach that turn (for a project's own curve, 5 sessions of that project), so a curve stops where they run out. Under the chart, a strip counts the sessions each turn rests on. The five projects with the most sessions get a curve of their own. The share view draws a dashed line at 80% of the window. The token view has no limit mark.
- **Added per prompt**: the median, over sessions, of the tokens a session adds per user prompt. A session's added tokens are the sum of the rises between consecutive turns; a fall, as after a compaction, adds nothing.
- Three tiles appear when at least one session has a recorded first compaction: **Sessions with a compaction**, **Before the first compaction** (median turns) and **Active time before it** (median minutes; pauses over 20 minutes are left out). Without such a session, a line says either that no session compacted or that none has a recorded first compaction yet.
- **Growth by project** table (more than one project): **Sessions**, **Added per prompt**, **Compacted**, **Turns to first compaction**, **Active time to it**.

**Controls**

- **Tokens / Share of window** switch: the same curves as tokens, or as a share of each session's window over the sessions with a known window.
- A project button in the legend draws that project alone against the view, with its band; selecting it again restores every project.
- Arrow keys, Home and End read a turn; Escape clears the reading. **Show data table** lists each turn with the median, 25th and 75th percentile, sessions, and each project's median (a dash where that curve has ended).

### Window pressure

**Shows** how full sessions get at their peak, by the size of their model's window. A session's window is the one its source stated (for Codex, the turn's `model_context_window`), else the `context` of its peak model in the price table, else unknown. See [Windows](/ai-ledger/concepts/windows/).

**Figures**

- **One bar per window size** (for example 200k, 1M), over the sessions with a known window. Each bar splits into five segments: under 25%, 25–50%, 50–80%, 80–90% and 90% or more of the window at the session's peak. A segment is a share of that window's sessions; a segment of 7% or more of the bar shows its count, and one of 20% or more its label. A peak at an edge belongs to the band above it (80% is in 80–90%).
- **Sessions by start and peak**: one dot per session, placed by starting context (log scale) and peak share of the window, with a line at 30,000 tokens and one at 80% of the window. A ring marks a session that compacted at least once. A dot shows the session's details on hover or focus. The chart holds at most the 1,000 newest sessions that have a measured start, a known window and a recorded peak, and states "Showing the newest N of M sessions" when there are more.

**Controls**

- Selecting a segment lists its sessions, newest first, up to 20, each showing its start, its peak share and its compactions. Selecting a session opens its session sheet. A table of the same counts is behind **Show data table**.
- A dot opens its session sheet. Arrow keys step from the oldest to the newest session; Escape clears the reading.

### What fills context

**Shows** the size of the main-thread tool results as the transcript stores them, summed by tool and by MCP server. The page marks each token count as an estimate: bytes divided by 4, rounded down. The section's hint states how many completed calls have a known size.

**Figures**

- **Main thread / Subagents**: one bar in two parts. Results of calls made inside subagent transcripts never entered the main thread's context, so they are summed apart and are not in any other figure of the section.
- **Largest contributors**: the ten tools, or MCP servers, with the largest total result size, and one **Other** row for the rest. Each row has a total bar and the typical result range, median to 95th percentile, on a log scale with a dashed line at 100,000 bytes.
- **By tool** and **By MCP server** tables list every tool or server: **Calls**, **Median**, **95th percentile**, **Largest**, **Total**, **Estimated tokens**. A hint on **Calls** gives how many have a result size.

**Controls** A **By tool / By MCP server** switch shows when MCP servers exist. Selecting a tool or server row opens its tool inspector.

### Cost

**Shows** cost as the [Cost page](/ai-ledger/pages/cost/) counts it, with the prompt cache's part in it. Prices and tiers are the same as Cost's. A view with no priced request reads "–" (unknown), never zero.

**Figures**

- **Cache use over time**: per day, or per week when the view's first request is more than 60 days old, the prompt tokens split into **Cache read**, **Cache write** and **Uncached input**, with each bucket's **Cache-hit ratio** (cache read tokens over all prompt tokens) as a line, and the cache breaks by cause as markers under the bars. A day or week with no request is empty. The caption says that a break's cause is inferred from the gap and the model of the previous request, not reported by the provider. Costs are not stacked in this chart.
- **Cost by project** table: **Whole view** and each project (when there is more than one): **Estimated cost**, **Cache reads** (cost), **Long-prompt tier** (cost), **Long-tier requests**, **Cache-hit ratio**. The long-prompt tier prices a whole request higher once its prompt passes a model's threshold.

A request that carries no time is in no bucket of the chart, but it counts in the table's cache-hit ratio. See [Cost estimates](/ai-ledger/concepts/cost-estimates/).

**Controls** **Show data table** lists each bucket of the chart.

## Drawers

### Largest tool results

**Shows** the 25 largest main-thread tool results in the view.

**Figures** Columns: **Tool** (with its MCP server), **Input** (a summary), **Size**, **Estimated tokens**, **When**, **Project** (with its source) and **Session**.

**Controls** Selecting a row opens its session sheet.

### Sessions where caching broke

**Shows** the sessions with a cache break, most uncached tokens first, up to 25.

**Figures** Columns: **Session**, **Project**, **Breaks**, **By cause**, **Uncached tokens**, **Their input cost**.

**Controls** Selecting a row opens its session sheet.

A cache break is a main-thread request that is not the session's first turn, has at least 20,000 prompt tokens, and read less than half of them from the cache. Cache writes count as uncached. Its cause is the first of these that applies, in this order:

| Cause | Meaning |
| --- | --- |
| model switch | The request's model differs from the previous main-thread request's. |
| expired | More than the cache lifetime passed since the previous request. The lifetime is 1 hour when the previous request wrote to the 1-hour cache (any source), else 30 minutes for a Codex session, else 5 minutes. A rule, not a measurement. |
| other | Anything else, such as a changed prompt or tool set. |

## Sheets

Selecting a row, dot or session opens a sheet over the page and keeps the filters:

- the **session sheet**, from sessions in tips, the pressure lists, the session map and both drawers;
- the **project sheet**, from a project row in the Starting context, Growth and Cost tables;
- the **tool inspector**, from a tool or MCP server row in Largest contributors and the By tool and By MCP server tables. It shows that tool's calls, failures and latency for the same view.

## How the figures are measured

| Term | Definition |
| --- | --- |
| Turn | A main-thread request that carries the context. A main-thread request with fewer than 2,000 prompt tokens is a side request and is not a turn. Subagent requests are never turns. |
| Prompt tokens | Input, cache read and both cache writes of a request. |
| Starting context | The prompt tokens of a session's first turn. |
| Peak | The most prompt tokens a session reached, read against its window. |
| Compaction | The agent summarizes the session's history to free context. The context then falls, and the session's added tokens do not count the fall. |
| Main thread | The session's own requests, as opposed to those of subagents. |
| Near the limit | 80% or more of the window. |
| Estimate | Tool result bytes divided by 4, rounded down. |

## Playbooks that start here

- [Keep context lean](/ai-ledger/improve/lean-context/): a large starting context, fast growth and tool results that fill the window.
- [Spend less for the same output](/ai-ledger/improve/spend-less/): cache breaks and long-prompt-tier spend.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): where Context fits in a 15-minute routine.
