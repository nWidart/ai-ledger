---
title: Metric glossary
description: Every figure the pages show, what it means, where it shows and the playbook that acts on it.
---

This page lists the figures of each page: what each one means, the panel that shows it, and the playbook that acts on it. The first table defines the terms that the other tables use. A "–" in the Playbook column means that no playbook starts from the figure.

Four words mark where a figure comes from:

| Mark | Meaning |
| --- | --- |
| estimate, estimated cost | Tokens priced at API list prices; or, for a tool result, its bytes divided by 4. Not a bill and not a count. |
| measured | A plan limit reading that the provider reported. |
| estimated (Limits) | A plan limit figure rebuilt from the last reading and the use counted since. |
| model-judged | A judgment that Claude Code's `/insights` wrote about a session. An opinion, not a measurement. |

## Terms on every page

| Term | Definition |
| --- | --- |
| Session | One Claude Code or Codex conversation, with its subagents. A session is in a view when it has a request in the range; Insights counts it by its start time instead. |
| Source | The agent that wrote the session: Claude Code or Codex. |
| Project | The repository or folder a session ran in. |
| Automated session | A session of a known automated project, a session with no user prompt, or a session in a temporary folder with at most one prompt. Left out unless **Include automated** is on; Errors has no such control and always counts them. See [Filters](/ai-ledger/everywhere/filters/#include-automated). |
| Main thread | The session's own requests and tool calls, as opposed to its subagents'. |
| Subagent | An agent that the session started for part of the work. Its requests count in tokens and cost, never as turns. |
| Request | One model response in a transcript, counted once. |
| Prompt | A message that you sent. A run of `/context` is not a prompt. |
| Interrupted prompt | A prompt whose work you stopped before the agent finished. |
| Turn | On Context: a main-thread request with at least 2,000 prompt tokens. On Activity, "turns per prompt" counts every main-thread request. |
| Tokens | Input, output (thinking included), cache read and cache write tokens of the requests, added up. |
| Prompt tokens | What a request read: input, cache read and both cache writes. Also called context. |
| Tool call | One use of a tool by the agent. A failed tool call returned an error. |
| Commit | A `git commit` shell call that succeeded. |
| Test run | A shell call that runs tests, a build, a linter or a type check. |
| Active time | The time between a session's main-thread requests and tool calls, less every pause over 20 minutes. |
| Active day | A day with at least one prompt. |
| Previous period | The same number of days just before the range. The **All** range has none. |
| Estimated cost | Each request's tokens times its model's API list price. See [How cost is estimated](/ai-ledger/concepts/cost-estimates/). |
| Unpriced model | A model with no price in the price table. Its tokens count; its cost is unknown and left out of totals. |
| Cache read | Prompt tokens read from the prompt cache, at a fraction of the input price. |
| Cache write | Prompt tokens written to the cache, with a 5-minute or a 1-hour lifetime. Costs more than plain input. |
| Cache hit | Cache read tokens over all prompt tokens. Context calls it the cache-hit ratio. |
| Long-prompt tier | The higher prices that some models charge for a whole request once its prompt passes a set size. |
| Context window | The most tokens a model can read in one request. See [Context windows and plan limit windows](/ai-ledger/concepts/windows/). |
| Compaction | The agent replaces the session's history with a summary to free context. |
| Near the limit | 80% or more of the context window. |
| Error loop | The same tool failing 3 times or more in a row within one session. Activity counts error loops. Errors groups every failure into an [incident](#errors), which can hold a single failure. |
| Plan limit window | A stretch of time, such as 5 hours or a week, over which a plan caps use. |
| Point | 1% of a plan limit. |

## Activity

See [Activity](/ai-ledger/pages/activity/).

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Commits, prompts, sessions, active days | Counts over the view, with the change against the previous period. | Heading | [Weekly review](/ai-ledger/improve/weekly-review/) |
| Turns per prompt, tool calls per prompt | Main-thread requests, and main-thread tool calls, per prompt. | Under the heading | [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| N things to look at | How many of the four lines below show. | **Needs attention** | [Weekly review](/ai-ledger/improve/weekly-review/) |
| N error loops | Error loops in the view. Marks the card **● Act**. | **Needs attention** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| N sessions reached 80%+ of the context window | Sessions whose peak context was near the limit. | **Needs attention** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| N tools fail over 10% of calls | Tools that failed more than 10% of at least 20 calls. | **Needs attention** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| N failed test runs of M | Failed test runs out of all test runs. | **Needs attention** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Errors per 100 calls | Failed tool calls per 100 tool calls. Marked worse when it goes up. | **Work health**; **Project metrics** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Test runs passed | The share of test runs that passed. Marked worse when it goes down. | **Work health** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Prompts interrupted | The share of prompts that were interrupted. Marked worse when it goes up. | **Work health** | [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| Subagents | The share of tokens that came from subagents. | **Work health**; **Project metrics** | – |
| Median session | The median active time of a session. | **Work health** | – |
| Work per day, or per week | Commits, prompts or sessions per day, with errors per 100 calls as a line. One bar per week when the view spans more than 60 days. | **Work per day** | [Weekly review](/ai-ledger/improve/weekly-review/) |
| Prompts by hour | Prompts by weekday and hour, on the machine's clock. | **Prompts by hour** | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Peak context | The largest request of a session, with its share of the window when that is 80% or more. | **Sessions** drawer | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Failed, Compactions, Commits, Tests | Per session: failed tool calls, compactions, commits, and test runs passed of run. | **Sessions** drawer | [Retro on one project](/ai-ledger/improve/project-retro/) |
| Tokens / prompt | A project's tokens per prompt. | **Project metrics** drawer | [Retro on one project](/ai-ledger/improve/project-retro/) |
| Error loops (per project) | A project's error loops. Tinted when 2 or more and above the median project. | **Project metrics** drawer | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Calls, Failed, p50, p95 | Per tool: calls, failure rate, and the median and 95th-percentile time from call to result. | **Tools** drawer | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Hook runs, Failed, Avg | Per hook: runs, failed runs and average time. | **MCP servers, skills and hooks** drawer | – |

## Cost

See [Cost](/ai-ledger/pages/cost/). Every cost is an estimate at API list prices.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Estimated cost | The view's estimated cost, and its comparison with the previous period: a multiple from 2× up, a percentage below. | Heading | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| thin history | The previous period has prompts on fewer than half as many days as this one, so the comparison says little. | Heading | – |
| On pace for about $X this month | This month's cost up to yesterday, plus the mean daily cost of the last 7 complete days times the days left. | Heading | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| N× your plan | The estimated cost over the plan's monthly price, prorated to the days of the view. | Heading | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| +? | The cost leaves out requests of unpriced models. | Beside a cost | – |
| Change by project | Each project's cost against the previous period, biggest move first. | **What changed** | [Retro on one project](/ai-ledger/improve/project-retro/) |
| Biggest spender | The project with the highest cost, its share of spend and its cost per commit. **▲ Watch** when that is over twice the median project's. | **What stands out** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Cost per commit | Estimated cost over commits, for the view and against the median project. An outlier costs over twice the median and holds at least 2% of the spend: **▲ Watch**, and **● Act** from 4 times. | **What stands out**; **Tokens and cache**; **Cost by project** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Peak day | The costliest day, as a multiple of the median day with spend. **▲ Watch** at 3 times or more, with 5 or more days of spend. | **What stands out** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Cache hit | Cache read tokens over all prompt tokens. | **What stands out**; **Tokens and cache**; **Cost by project** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| 1h writes | The share of cache write tokens that use the 1-hour lifetime. | **What stands out**; **Tokens and cache**; **Cost by project** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Subagent cost | The share of estimated cost that came from subagents. | **Tokens and cache**; **Cost by project** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Cost per day | Estimated cost per day, stacked by project, model or agent, with a 7-day average when the view has 14 days or more. | **Estimated cost per day** | [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/) |
| Tokens per day | Tokens per day by kind: Input, Output, Thinking, Cache read, Cache write 5m, Cache write 1h. | **Tokens per day** | – |
| Share of spend | A project's share of the view's cost. | **Where the spend went** | [Retro on one project](/ai-ledger/improve/project-retro/) |
| Model and effort share | The share of cost of each model and effort level; fast-mode requests form their own rows. | **Models and effort** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Per prompt | Estimated cost and tokens per prompt. | **Tokens and cache**; **Cost by project** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Cost by token kind | Cost and tokens of Input, Output + thinking, Cache read, Cache write 5m and Cache write 1h. | **Tokens and cache** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Est. cost (session) | A session's estimated cost; with a day selected, its cost on that day. | **Most expensive sessions** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |

## Context

See [Context](/ai-ledger/pages/context/). Every figure comes from the transcripts; no configuration file is read.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Starting context | The prompt tokens of a session's first turn: what the model read before any work. | Heading; **Starting context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Median, 10th percentile, 90th percentile | The spread of starting context over a project's sessions. The 10th percentile approximates the fixed overhead. | **Starting context by project** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Share of window | The median of starting context over each session's window. | **Starting context by project** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Median start by week | The weekly median of starting context, by week of session start, with its 25th to 75th percentile band. A hollow dot rests on fewer than 3 sessions. | **Starting context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Growth curve | The median context at each turn, up to turn 100, over the sessions that reach it. A point needs 5 sessions. | **Growth** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Added per prompt | The median, over sessions, of the tokens a session adds per prompt. A fall, as after a compaction, adds nothing. | **Growth** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Sessions with a compaction | Sessions with a recorded first compaction. | **Growth** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Before the first compaction; Turns to first compaction | The median number of turns before a session's first compaction. | **Growth**; **Growth by project** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Active time before it | The median active minutes before the first compaction. | **Growth**; **Growth by project** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Peak | The most prompt tokens a session reached, as a share of its window. | **Window pressure** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Peak bands | The share of sessions that peaked under 25%, at 25–50%, 50–80%, 80–90% and 90% or more of the window, per window size. A peak at an edge belongs to the band above it. | **Window pressure** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Sessions by start and peak | One dot per session by starting context and peak share; a ring marks a session that compacted. | **Window pressure** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Total result size, Estimated tokens | The bytes of the main-thread tool results by tool or MCP server, and those bytes divided by 4. | **What fills context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Main thread / Subagents | Tool result bytes read by the main thread, and by subagents, which never entered the main context. | **What fills context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Largest tool results | The 25 largest main-thread tool results, with tool, input and session. | **Largest tool results** drawer | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Cache-hit ratio | Cache read tokens over all prompt tokens, per day or week and per project. | Context's **Cost** section | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Cache break | A main-thread request after the first turn with at least 20,000 prompt tokens, less than half read from the cache. Its cause is a model switch, expired, or other. | Context's **Cost** section; **Sessions where caching broke** drawer | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Uncached tokens, Their input cost | The prompt tokens of a session's cache breaks that were not read from the cache, and their cost. | **Sessions where caching broke** drawer | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Long-prompt tier, Long-tier requests | The cost and the count of requests priced on the long-prompt tier. | Context's **Cost** section | [Spend less for the same output](/ai-ledger/improve/spend-less/) |

### Context tips

Each tip fires from a fixed rule. A tip carries **▲ Watch**, or **● Act** where the table says so.

| Tip | Fires when | Playbook |
| --- | --- | --- |
| Sessions start with a large context | A project's median starting context is 30,000 tokens or more. | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Sessions compact repeatedly | A session compacted 3 times or more. **● Act** from 6. | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Sessions reach the limit of the window | A session peaked at 80% or more of its window. Always **● Act**. | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Tool results fill the context | A main-thread tool result is 100,000 bytes or more. **● Act** from 400,000 bytes. | [Keep context lean](/ai-ledger/improve/lean-context/) |
| The prompt cache breaks within sessions | A session has 2 cache breaks or more. | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Requests are priced on the long-prompt tier | The long-prompt-tier cost is at least $1 and at least 10% of the view's estimated cost. | [Spend less for the same output](/ai-ledger/improve/spend-less/) |

## Errors

See [Errors](/ai-ledger/pages/errors/). Errors counts automated sessions too.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Failed tool calls | Tool calls that returned an error, each sorted into one error type. | Heading | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Error rate | Failed tool calls as a share of all tool calls. | Summary; chart | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Change | The error rate against the comparison period: the same number of days before, or for **All** the earlier half of the calls. "–" when either side has fewer than 200 tool calls. | Summary; type table | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Incident | A retry loop: failures of one tool, by one agent, with one error type, each at most 10 minutes after the previous one, with at most 2 successful calls of that tool in between. | Summary; type detail | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Recovered (Next call OK) | The agent's next call of that tool after the incident succeeded. Otherwise the incident reads **Failed again** or **Gave up**. | Type detail | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Didn't recover | The share of incidents whose outcome is not recovered. | Summary; type table | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Fixes applied | The error types that you marked as fixed, and the open types that still have a ready-made fix. | Summary | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Uncategorized | The share of errors in the catch-all types: Other, Other non-zero exit and MCP tool error. | Under the heading | – |
| Errors, Share | A type's failed calls, and its share of the view's errors. | Type table | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Time lost | The time in retry loops: each incident's first failure to its last, summed. | Type table; type detail | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Rate, Rate trend | A type's errors per 100 tool calls, and that rate over the range. | Type table | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Open fixes | Up to four open types with a ready-made fix, most time lost first. | **Where to start** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Rising fastest | Up to four types whose rate rose by more than 10% of its earlier value, with at least 5 errors now. | **Where to start** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Before and after the fix | A type's error rate before and since the day you marked a fix, over all time. The verdict is **Rate lower**, **Rate higher** or **Rate unchanged**. It reads **Not enough calls yet** until the calls since the fix number at least 200 and enough for the old rate to have produced 5 errors. | Type detail | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Noise | Harness errors, user rejections and the types you muted. **Hide noise and muted** leaves them out. | Filters; type detail | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |

## Limits

See [Limits](/ai-ledger/pages/limits/). Open windows cover the whole account and ignore the range.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Percent used | The share of a window's allowance used now, **measured** or **estimated**. | Heading; status strip; window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Resets in | The time to the window's reset. | Status strip; window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| at limit, runs out | The window is at 100%, or is forecast to reach 100% before its reset. | Status strip | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Limits alert (dot) | An open window is at its limit, is forecast to run out, or is at 90% or more. | The **Limits** tab, on every page | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Forecast, likely range | Where the percent used goes by the reset, from your activity by hour of day. The range covers your usual pace and the window's own recent pace. | Window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Reaches 100% at | The forecast time the window reaches 100%, before its reset. | Heading; window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Last 24 h pace | The forecast if your use of the last 24 hours continued to the reset. | Window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Usual pace; pace that would use it all | Your average rate for the provider, and the rate that ends at exactly 100% at the reset. | Window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| ahead of pace, behind pace | The forecast reaches 100% before the reset, or about N% would go unused. | Window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Send work to | The provider with the most headroom at the current pace, when two providers or more have a forecast. | Under the heading | [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/) |
| Counted use | The local agent use that the app prices from transcripts. Use elsewhere, such as claude.ai, shows only at the next measured reading. | **What used this window** | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| What used this window | The top three projects and models of a window by estimated cost, with their share and points. | Window cards | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Calibrated window | A window with a known estimated cost per point, worked out from past readings. A window calibrates once it has moved 5 points while its use was counted. | Window cards; **What a point buys** | – |
| Cap in money | The calibrated cost of one point, times 100, at API list prices. | Window cards | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Left unused | The average share of a limit still unused when its full-length windows reset, in the range. | **Left unused** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Final, At 100% for | A closed window's final percent, and how long it stayed at its limit. | **Past windows** drawer | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| $ a point, Tokens a point | The estimated cost of one point of a limit, and the tokens of each model that one point buys. | **What a point buys** drawer | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Commits a point | A project's commits per point of a limit. | **What a point buys** drawer | [Retro on one project](/ai-ledger/improve/project-retro/) |

## Insights

See [Insights](/ai-ledger/pages/insights/). The figures are model-judged unless the table says "measured". They cover Claude Code sessions only.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Sessions analysed | The Claude Code sessions of the view that `/insights` judged, out of those stored. | Coverage note; **Outcomes at a glance** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Outcome | Whether a session met its goal: fully, mostly, partially or not achieved, or unclear. | **Outcomes**; session cards | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Fully or mostly achieved | The count and share of analysed sessions with one of those two outcomes. | **Outcomes at a glance** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Partially, Not achieved | Sessions that met some of the goal, and sessions whose goal was abandoned or failed. | **Outcomes at a glance** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Dissatisfied | Sessions where the model saw you push back. | **Outcomes at a glance** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Friction | A label for what got in the way, counted by times reported and by sessions. Similar labels form a family. | **Friction categories** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Outcome trend | Per week of session start, the share of analysed sessions fully or mostly achieved. | **Outcome trend** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Satisfaction signals, helpfulness | The satisfaction signals the model saw, and its rating of Claude's help from essential to unhelpful. | **Satisfaction and helpfulness** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| Goal, session type | What a session set out to do, and the model's label for its shape, such as single task. | **Goals**, **Session types** drawers | – |
| Session figures (measured) | Lines added and removed, files modified, git pushes, median session duration and response time, and languages, as `/insights` counted them. | **Session figures** drawer | – |
| Coverage, run (measured) | Sessions analysed per project, and per `/insights` run. A run is the judgments written within an hour of each other. | **Coverage** drawer | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |

## Live

See [Live](/ai-ledger/pages/live/). Live lists the sessions whose newest line is less than 10 minutes old.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| approval? | A shell call with no result for more than 30 seconds. Inferred. | Rail; wall; agent panel | [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| your turn | The agent finished its turn and waits for your prompt. The label counts up. | Rail; wall; agent panel | [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| working | The session runs a tool or is thinking. | Rail; wall | – |
| idle, ended | No line for 5 minutes; or a Claude Code session that you closed. | Rail; wall | – |
| N waiting for you | The sessions in **approval?** and **your turn**. Also the count in the tab title. | Rail footer; tab title | [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| Context window, % used | The context of the newest main-thread request over the model's window, with a mark at each compaction. The agent panel's meter takes the warning color above 80%. | Agent panel; wall tiles | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Cost, Requests, Tool calls, Errors | The selected session's figures so far. | Agent panel, **This session** | – |
| Cache read | The share of the session's tokens read from the cache. | Agent panel, **This session** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| Tokens · last minute | Tokens per minute, cache reads included. | Agent panel | – |
| Plan limits | The newest plan limit use for the session's source, with its reset time. Warning color above 80%. | Agent panel | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |

## Project

See [Project](/ai-ledger/pages/project/). Its blocks repeat the figures of the other pages for one project. These figures show only here.

| Figure | Meaning | Where | Playbook |
| --- | --- | --- | --- |
| Context grid | A typical session's window as 200 cells: the median starting context, what the median peak adds, and free space. | **Context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Overhead by category | The tokens of each category that a `/context` snapshot lists as loaded before the first prompt, such as memory files and MCP tools. | **Context**, after **Measure now** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Deferred tokens | Tool definitions that the snapshot lists as not loaded. They take no context. | **Context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Largest overhead items | The snapshot's five largest MCP servers, memory files and skills by tokens. | **Context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Sessions near the context limit | The project's sessions that peaked at 80% or more of their window. | **Context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| Share of each open window | The project's share of a plan limit window's counted use, with its points, when it is among the window's top three. | **Plan limits** | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| Top error types | The project's five most frequent error types, with rate and change. | **Errors** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| Outcomes, Top friction | The outcomes of the project's analysed sessions, and its three most reported kinds of friction. Model-judged. | **Session judgments** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |

For the whole page, use [Retro on one project](/ai-ledger/improve/project-retro/).

## Playbooks that start from a filter

Three playbooks start from a control, not from one figure.

| Control | Playbook |
| --- | --- |
| The **Source** filter | [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/) |
| **Include automated** | [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/) |
| Live's **Full text** toggle, and the project filter | [Share your screen safely](/ai-ledger/improve/share-screen/) |
