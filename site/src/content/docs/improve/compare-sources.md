---
title: Compare Claude Code and Codex
description: Compare your agents, Grok included, on the same figures with the source filter.
---

## Goal

Each kind of task goes to the agent that does it for less estimated cost per commit and fewer failures, and work moves to the agent with plan limit headroom before a limit runs out.

## Signs you need it

- [Limits](/ai-ledger/pages/limits/) shows a suggestion such as "Send work to Codex: about 70% of its weekly limit would go unused" (an example). The app shows it when two providers or more have a forecast, and names the one with the most headroom.
- On [Cost](/ai-ledger/pages/cost/), with **Stack by** set to **Agent**, the chart shows two agents or more in the range.
- Rule of thumb: you used two agents in one project in the last 30 days, and you cannot say which one costs less per commit there.

If you use only one agent, this playbook does not apply. If one plan limit runs out and the other agent has no headroom either, use [Stop hitting plan limits](/ai-ledger/improve/plan-limits/). To lower cost within one agent, use [Spend less for the same output](/ai-ledger/improve/spend-less/).

## Diagnose

Compare like with like: the same project, the same range, and figures that the agents record the same way. Every page has the **Source** filter (All, Claude Code, Codex, Grok), and the navigation carries it to the next page.

1. On [Cost](/ai-ledger/pages/cost/), set the range to **30d** and **Stack by** to **Agent**. Select the **Claude Code** key in the chart's legend: it sets the source filter. In **Project spend and change**, select each project: its sheet gives its commits. Select the key again to clear it, then do the same with **Codex** and **Grok**. Pick a project where each agent has 5 commits or more (a rule of thumb). With fewer, one long session decides the figure.
2. Pick that project in the project picker, and set the source to **Claude Code**. On Cost, open **Tokens and cache** and write down **Per commit** and **Per prompt**.
3. On [Activity](/ai-ledger/pages/activity/), write down the heading's commits and prompts, the share of prompts interrupted in the line under the heading, and the **Work health** tile **Test runs passed**.
4. On [Context](/ai-ledger/pages/context/), write down **Added per prompt** and **Sessions with a compaction** in **Growth**.
5. Set the source to **Codex**, then to **Grok**, and read the same figures again on the same pages.
6. Open [Limits](/ai-ledger/pages/limits/) with the source at **All**. Read the heading, the status in each card's header, and the suggestion if one shows. Limits has a Grok card when the Grok CLI is signed in with grok.com.

Compare only these figures. The others differ by what each agent records:

| Figure | Comparable? | Why | Grok |
| --- | --- | --- | --- |
| **Cost / commit**, **Cost / prompt** | Yes, at API list prices | Claude Code's and Codex's are estimates at list prices, not what your plans charge. | Grok's cost is what Grok reported, not an estimate. |
| Commits, prompts, **Prompts interrupted**, **Test runs passed** | Yes | The agents record prompts, interruptions and shell calls the same way. | A cancelled turn marks its prompt interrupted. |
| **Added per prompt**, **Sessions with a compaction** | Yes, as a rough guide | Each agent decides when to compact, and the models' windows differ. | Grok records its compactions and the context of each model call. |
| Totals per session, day, project and model | Yes | Each agent's tokens count once. | Grok reports usage once per turn. Totals are exact; how a turn splits over its model calls is an estimate. |
| **Errors per 100 calls**, tool calls per prompt | No | The agents call different tools for the same work, so a call is not the same unit. | A shell command that exits non-zero is an error even when Grok marks it completed. |
| Starting context | No | Each agent has its own system prompt and tools, and reads its own instruction file. | Grok has its own system prompt and tools too. |
| **Cache hit**, **1h writes**, cache breaks | No | Codex reports one kind of cache write, and the app counts its cache as lasting 30 minutes. Claude Code has 5-minute and 1-hour writes. | xAI states no cache lifetime, so a Grok cache break is never **expired**. |
| **Largest tool results** | No | Codex records no result size for `apply_patch` and `web_search`. | Grok records the size of every finished tool call's result, so no Grok tool is missing from the list. |
| Model time, output speed | No | Codex records no model time. | Each Grok turn reports its API time. Grok reports no tool time and no lines added or removed. |
| Outcomes, friction | No | Activity's [Judgments view](/ai-ledger/pages/insights/) covers Claude Code sessions only, and cannot be picked with Codex or Grok as the source. | Grok writes no facets. |
| Points, percent of a limit | No | Each provider's plan sets its own limits. | Grok's limit is the percent of its period's credits used, weekly or monthly. |
| **ended** on Live | No | Codex writes no close, so a Codex session never reads **ended**. | A Grok session reads **ended** after Grok exits. |
Then read what you wrote down:

| What you see | Cause | Fix |
| --- | --- | --- |
| One agent's **Cost / commit** is 1.5 times another's or more (a rule of thumb) in the same project. | This kind of work costs less with the other agent. | [Send each kind of task to one agent](#send-each-kind-of-task-to-one-agent) |
| One agent has a lower **Test runs passed** in the same project, by 10 points or more (a rule of thumb). | That agent's instruction file lacks rules that the other one has, such as how to run the tests. | [Give Claude Code and Codex the same instructions](#give-claude-code-and-codex-the-same-instructions) |
| Limits shows "Send work to …", or one provider's window **runs out** while the other has headroom. | One plan runs out first. | [Move work before a limit runs out](#move-work-before-a-limit-runs-out) |

## Act

### Send each kind of task to one agent

1. Name the kind of task the project gets most, such as "small bug fixes" or "test writing" (examples).
2. Write the rule down where you start work, such as the project's `README.md` or your task notes:

   ```md
   ## Which agent
   - Bug fixes and refactors in this repository: Codex (lower cost per commit, 30 days to YYYY-MM-DD).
   - Design and multi-file features: Claude Code.
   ```

   The split is an example. Write the date your figures end on in place of `YYYY-MM-DD`, and use your own figures from Diagnose.
3. When you start a task of that kind, start it in the agent the rule names.

If you work on a team, the rule is yours: other people's plans and prices differ.

### Give Claude Code and Codex the same instructions

Claude Code reads `CLAUDE.md`, and Codex reads `AGENTS.md`. When the two files differ, one agent misses rules that the other follows. Keep the rules in `AGENTS.md`, and make `CLAUDE.md` import it. Put this line in the project's `CLAUDE.md`:

```md
@AGENTS.md
```

Move the rules that only one agent needs below that line in `CLAUDE.md`, or into a section of `AGENTS.md` that names the agent.

Then open [Errors](/ai-ledger/pages/errors/) with the project filter and the source set to the agent with the worse figure. Paste the fix of each type under **Open fixes** into `AGENTS.md`. Both agents then read it. See [Kill repeated tool failures](/ai-ledger/improve/tool-failures/).

### Move work before a limit runs out

When the Limits heading names a window that runs out before its reset, start your next task in the agent that the suggestion "Send work to …" names. Without a suggestion, read the card headers and pick the provider whose windows read neither **at its limit** nor **runs out**.

Do not move work to a provider whose limit already shows **at limit**. Limits never suggests it.
## Verify

Before you act, keep the figures you wrote down in Diagnose, with the date. Also note **Cost / commit** of the project with the source at **All**, at **14d**. The app has no custom date range, so you need these to compare with.

After 14 days of work in the project, set the range to **14d** and pick the project. Read each figure with the source that the Where column names:

| Figure | Where | Expected |
| --- | --- | --- |
| **Per commit** | Cost, **Tokens and cache**, with the source at **All** | Lower than your note: more of the work went to the agent that costs less per commit. |
| **Test runs passed** | Activity, **Work health**, with the source set to the agent that had the lower figure | Higher than your note, closer to the other agent's. |
| Windows at limit | Limits, card headers, source at **All** | No card reads **at its limit** or **runs out**. |
| **avg N% unused** | Limits, **Past windows**, source at **All** | A smaller share for the provider you moved work to. |

If **Cost / commit** did not fall, check that the kind of task you moved is what the project's commits are about: read the session titles in Activity's **Sessions** tab for each source. If one agent has fewer than 5 commits in the range, wait one more week.

## Related

- [Filters](/ai-ledger/everywhere/filters/): the **Source** filter and how it carries from page to page.
- [Cost](/ai-ledger/pages/cost/): **Stack by** **Agent**, **Project spend and change** and **Tokens and cache**.
- [Limits](/ai-ledger/pages/limits/): the suggestion and the windows of each provider.
- [How cost is estimated](/ai-ledger/concepts/cost-estimates/): why a cost is at API list prices, and why Grok's is the reported one.
- [Context windows and plan limit windows](/ai-ledger/concepts/windows/): why a point of one provider is not a point of the other.
- [Stop hitting plan limits](/ai-ledger/improve/plan-limits/): when both providers run out.
- [Metric glossary](/ai-ledger/reference/glossary/): the definition of each figure.
