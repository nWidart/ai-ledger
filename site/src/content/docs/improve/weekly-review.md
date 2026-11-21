---
title: Weekly 15-minute review
description: A 15-minute routine across the pages, with the figure to check at each stop and the playbook to open when it is off.
---

## Goal

Once a week, in 15 minutes, find the one figure of the last 7 days that most needs a fix, and open the playbook that fixes it.

## Signs you need it

Run the review every week. It is overdue when one of these holds:

- [Activity](/ai-ledger/pages/activity/), **Needs attention**, shows the same line as last week, such as "N error loops: a tool failed 3+ times in a row."
- The **Limits** tab carries a dot that you did not expect. The app shows the dot when a plan limit window is at its limit, is forecast to run out, or is at 90% or more.
- [Cost](/ai-ledger/pages/cost/), at its default range of 30d, opens on a multiple, such as "3.1× the previous 30 days" (an example), and you cannot say why.

Skip the week when Activity's heading reads "No agent activity in the last 7 days."

## Diagnose

Make one pass over seven stops: the six pages in the navigation, and Activity's Judgments view. At each stop, read the figures named, compare them with the "off" column, and write down what is off. Fix nothing yet.

Start on Activity. Set the range to **7d**, the project to **All projects**, the source to **All**, and leave **Include automated sessions** off. The navigation carries these filters to each page you open next. To open the review in one step, bookmark this address:

```text
http://127.0.0.1:8765/usage?range=7
```

| Stop | Minutes | Read | Open when it is off |
| --- | --- | --- | --- |
| [1. Activity](#1-activity-3-minutes) | 3 | **Needs attention**, **Work health** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/), [Keep context lean](/ai-ledger/improve/lean-context/), [Babysit agents less](/ai-ledger/improve/babysit-less/) |
| [2. Cost](#2-cost-2-minutes) | 2 | The heading, **What stands out** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| [3. Context](#3-context-2-minutes) | 2 | **Tips** | [Keep context lean](/ai-ledger/improve/lean-context/), [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| [4. Errors](#4-errors-3-minutes) | 3 | **Change**, **Where to start** | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| [5. Limits](#5-limits-2-minutes) | 2 | The heading, the card headers, **Past windows** | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| [6. Judgments](#6-judgments-2-minutes) | 2 | **Outcomes at a glance**, **Friction categories** | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |
| [7. Live](#7-live-1-minute) | 1 | The rail's **approval?** and **your turn** groups | [Babysit agents less](/ai-ledger/improve/babysit-less/) |

### 1. Activity (3 minutes)

Read the **Needs attention** card. It is off when its title reads "N things to look at" instead of "Nothing needs attention". The app writes each line from its own rule:

| Line | Playbook |
| --- | --- |
| "N error loops: a tool failed 3+ times in a row." | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| "N sessions reached 80%+ of the context window." | [Keep context lean](/ai-ledger/improve/lean-context/) |
| "N tools fail over 10% of calls" (counted over tools with at least 20 calls) | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| "N failed test runs of M." | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |

Then read the **Work health** tile **Errors per 100 calls** and the prompts interrupted line under the heading. Each compares the 7 days with the 7 days before, and the app marks it when the change is for the worse:

- **Errors per 100 calls** reads "up from": open [Kill repeated tool failures](/ai-ledger/improve/tool-failures/).
- The prompts interrupted line under the heading reads "up from": open [Babysit agents less](/ai-ledger/improve/babysit-less/).

### 2. Cost (2 minutes)

Read the heading: the estimated cost and its comparison with the previous 7 days. Then read the cards under **What stands out**. The stop is off when:

- a card carries the mark **▲ Watch** or **● Act**. The app sets **▲ Watch** for a project that costs over twice the median project per commit (the project holds at least 2% of the spend and has 3 or more commits), and for a peak day at 3 times the median day or more (with 5 or more days with spend). It sets **● Act** for a project at 4 times the median per commit or more.
- Rule of thumb: the heading shows a multiple, which the app does from 2× up, and no **thin history** chip sits beside the previous period.

For either, open [Spend less for the same output](/ai-ledger/improve/spend-less/). If one project carries the rise in the change column of **Project spend and change**, open [Retro on one project](/ai-ledger/improve/project-retro/) for that project instead.

Read the plan gauge's pace ("on pace for ~$X") as information. It is an estimate at API list prices, not a bill.

### 3. Context (2 minutes)

Read **Tips**. The stop is off when a tip shows instead of "Nothing stands out in this view." Each tip fires from a fixed rule of the app.

| Tip | Playbook |
| --- | --- |
| **Sessions start with a large context**, **Sessions compact repeatedly**, **Sessions reach the limit of the window**, **Tool results fill the context** | [Keep context lean](/ai-ledger/improve/lean-context/) |
| **The prompt cache breaks within sessions**, **Requests are priced on the long-prompt tier** | [Spend less for the same output](/ai-ledger/improve/spend-less/) |

A tip marked **● Act** counts before one marked **▲ Watch**.

### 4. Errors (3 minutes)

Errors has no **Include automated** control: its figures count automated sessions too.

Read the **Change** vital: the error rate of the 7 days against the 7 days before. It shows "–" when either period has fewer than 200 tool calls. In that case set the range to **30d** for this stop: **Change** then compares the 30 days with the 30 days before. Set the range back to **7d** when you leave.

Then read **Where to start**, beside the type table. The stop is off when:

- **Open fixes** lists a type: an error type with a ready-made fix that you have not marked with **Mark fix applied** in the type's detail.
- **Rising fastest** lists a type: its error rate rose by more than 10% of its earlier value, with at least 5 errors now.
- **Change** shows a rise of more than 1%, which the app colors as worse.

For any of these, open [Kill repeated tool failures](/ai-ledger/improve/tool-failures/).

If you marked a fix in an earlier week, open that type and read **Before and after the fix**. **Rate lower** means the fix worked. **Rate higher** or **Rate unchanged** means it did not: write the type down.

### 5. Limits (2 minutes)

The open windows cover your whole account and ignore the range.

Read the heading. The stop is off when it does not start with "No limit runs out at the current pace.", or when a card's header reads **at its limit** or **runs out**. Open [Stop hitting plan limits](/ai-ledger/improve/plan-limits/).

Then read two more lines:

- A suggestion such as "Send work to Codex: about 70% of its weekly limit would go unused" (an example) names the provider with the most headroom. To act on it, open [Compare Claude Code and Codex](/ai-ledger/improve/compare-sources/).
- **Past windows** gives, under each limit's name, the average share still unused when its windows reset ("avg 60% unused"). Rule of thumb: when a weekly limit reads 50% unused or more in every review of a month, your plan is larger than your use. Open [Spend less for the same output](/ai-ledger/improve/spend-less/) for the plan fit.

### 6. Judgments (2 minutes)

Select the **Activity** tab, then **Judgments** in the view switch above the heading. Set the range to **30d** for this stop. The view counts a session by its start time, and **Outcome trend** needs sessions from two or more weeks.

First read the coverage note at the top, such as "150 of 400 Claude Code sessions in this view analysed (38%)" (an example). The figures cover only the analysed sessions. If the last week is not analysed, run the `/insights` command in Claude Code, then select **Refresh** in the app's navigation bar, and read the stop again.

Every figure here is **model-judged**: a model's reading of the transcript, not a measurement. The app sets no threshold on this page, so these are rules of thumb. The stop is off when:

- **Not achieved** or **Dissatisfied**, in **Outcomes at a glance**, is higher than in your last note.
- The newest week's bar in **Outcome trend** has a smaller fully and mostly achieved part than the week before. A week with few sessions swings: read the figure over the bar, the week's sessions. A half-width bar has fewer than 5.
- One family leads **Friction categories** two reviews in a row. Read it by **Cost** to see which friction the costliest sessions had, and by **Reports** to see which comes most often.

For any of these, open [Get sessions to finish](/ai-ledger/improve/finish-sessions/).

The view shows Claude Code sessions only, and with Codex or Grok as the source Activity does not offer it. Set the range back to **7d** when you leave.

### 7. Live (1 minute)

Live has no range: it shows the sessions that wrote a line in the last 10 minutes.

Read the rail's groups and its footer, which adds "N waiting for you" when a session needs you. The stop is off when a session sits under **approval?** or **your turn** and you did not know: the label of **your turn** counts up how long it has waited. Open [Babysit agents less](/ai-ledger/improve/babysit-less/).

If the **Context window** meter of a session is in the warning color, which it takes above 80%, note it for [Keep context lean](/ai-ledger/improve/lean-context/).

With no active session, the page reads "No session is active in this view." and the stop is done.

## Act

### Pick one playbook

Do not work on every stop that is off. Pick one, in this order (a rule of thumb):

1. A Limits heading that names a window at its limit or reaching 100% before its reset. It stops your work this week.
2. A card marked **● Act**: **Needs attention** on Activity, which carries the mark when it has an error-loop line, a card under **What stands out** on Cost, or a tip on Context.
3. A fix that did not work: **Rate higher** or **Rate unchanged** on Errors.
4. Any other stop that is off, the one that was also off last week first.

Open the playbook that the stop names, and do its **Act** section now or plan it for the week.

### Keep a note of each review

Not every page shows last week's figure next to this week's, so keep your own. Paste this template into a notes file of your own, such as `ai-ledger-review.md`, and fill one copy at each review:

```md
## Review of YYYY-MM-DD (range 7d, all projects)
- Activity: things to look at: _ · errors per 100 calls: _ · prompts interrupted: _%
- Cost: $_ · against the previous 7 days: _ · cards marked Watch or Act: _
- Context: tips showing: _
- Errors: error rate: _% · change: _ · open fixes: _ · fix verdicts: _
- Limits: heading: _ · chips at limit or runs out: _
- Judgments (30d): analysed: _ of _ · not achieved: _ · dissatisfied: _ · top friction: _
- Live: waiting for you: _
- Stops that are off: _
- Playbook picked: _
```

### Make it a habit

Put a 15-minute entry in your calendar, each week on the same day, with the bookmark as its link. When the entry comes up, open the bookmark and last week's note before any other work.

## Verify

After 4 reviews (28 days), compare your first note with your last:

| Figure | Where | Expected |
| --- | --- | --- |
| "N things to look at" | Activity, **Needs attention**, at **7d** | A smaller N, or "Nothing needs attention". |
| **Errors per 100 calls** | Activity, **Work health**, with the range set to **30d** for this row | The tile reads "down from": at 30d the app compares the last 30 days, the span of your 4 reviews, with the 30 days before. |
| Tips showing | Context, **Tips**, at **7d** | Fewer tips, and none marked **● Act**. |
| **Playbook picked** | Your notes | Each playbook you picked has reached the result in its own **Verify** section. |

The review itself should fit in 15 minutes by the third week. If it does not, read only the "off" test at each stop and open nothing else.

If the figures did not move after 28 days, you picked a new playbook each week without finishing one. Stay on one playbook until its **Verify** section holds.

## Related

- [15-minute first tour](/ai-ledger/start/first-tour/): read each page once before you make the review a routine.
- [Activity](/ai-ledger/pages/activity/), [Cost](/ai-ledger/pages/cost/), [Context](/ai-ledger/pages/context/), [Errors](/ai-ledger/pages/errors/), [Limits](/ai-ledger/pages/limits/), [Judgments](/ai-ledger/pages/insights/) and [Live](/ai-ledger/pages/live/): what each stop shows.
- [Filters](/ai-ledger/everywhere/filters/): how the range, project and source carry from page to page.
- [Command palette](/ai-ledger/everywhere/command-palette/): `#7d` and `#30d` switch the range from the keyboard.
- [Metric glossary](/ai-ledger/reference/glossary/): every figure named here, and the playbook that acts on it.
- [Retro on one project](/ai-ledger/improve/project-retro/): the same review for one project.
