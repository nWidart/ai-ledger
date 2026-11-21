---
title: Get sessions to finish
description: Raise the share of sessions that reach their goal, from the outcomes and friction in Activity's Judgments view.
---

## Goal

More sessions reach their goal: the share **Fully or mostly achieved** goes up, and the friction family that leads **Friction categories** reports less.

## Signs you need it

Open Activity, select [Judgments](/ai-ledger/pages/insights/) in the view switch above the heading, and set the range to **30d**. Every figure named here is **model-judged**: Claude Code's `/insights` wrote it from the transcript. The app sets no threshold in this view, so these signs are rules of thumb:

- Rule of thumb: in **Outcomes at a glance**, **Fully or mostly achieved** is under 80%.
- Rule of thumb: **Not achieved** or **Dissatisfied** is higher than in your last note of the [Weekly 15-minute review](/ai-ledger/improve/weekly-review/#keep-a-note-of-each-review).
- Rule of thumb: the newest week's bar in **Outcome trend** has a smaller fully and mostly achieved part than the week before, on at least 5 sessions. The figure over a bar is the week's sessions; a faint bar has fewer than 5, and swings.
- Rule of thumb: one family leads **Friction categories**, by **Reports**, two reviews in a row. The heading names it: "…; **tooling** caused the most friction" (an example).

The same judgments show for one project in the **Session judgments** block of the [Project](/ai-ledger/pages/project/) page.

The view covers Claude Code sessions only: `/insights` analyses no Codex session.

Two families point to other playbooks first:

- **tooling** and **slow**: open [Kill repeated tool failures](/ai-ledger/improve/tool-failures/). If the sessions also compacted often, open [Keep context lean](/ai-ledger/improve/lean-context/).
- **rejected action**: open [Babysit agents less](/ai-ledger/improve/babysit-less/).

## Diagnose

Find the friction that stops the most sessions, and read what the model wrote about it.

1. Read the coverage note at the top, such as "150 of 400 Claude Code sessions in this view analysed (38%)" (an example). The figures cover only the analysed sessions. If the last week has no analysis, run `/insights` in Claude Code, select **Refresh** in the app's navigation bar, and read the page again.
2. In **Friction categories**, select **Reports**: families then come most reported first. Read the first family and its sessions. Then select **Cost**: the family on top is the one the costliest sessions reported, which is the one to fix first when the two differ. The cost is that of the whole sessions, not of the friction alone. Select **N labels** under a family to read the labels as `/insights` wrote them. The app groups labels into families by keyword: **misunderstood request**, **wrong approach**, **tooling**, **buggy code**, **excessive changes**, **rejected action** and **slow**. A label that matches no family is a row of its own.
3. Select the family's row. The session list under **Analysed sessions** keeps the sessions with that friction, and a chip reads "Friction family: …". Set **Sort** to **Outcome**: the sessions that did not reach their goal come first.
4. On the first five cards, open **Friction detail** and read the model's words. Note what went wrong in each: what the agent did, and what you wanted.
5. Read the goal chips on those cards. If one goal family recurs, such as **fix bug** (an example), the fix belongs to that kind of task. Select the goal chip to keep only its sessions.
6. Read each card's measured line, such as "$4.20 · peak context 62% · 1 tool error" (an example). Then select the title of one card: its session sheet opens over the view. If its **Error loops** list is not empty, or its peak context is at 80% or more of the window (the app's own limit for **Needs attention**; the card marks it), fix that measured cause before the friction family: use the table's last two rows.

| What you see | Cause | Fix |
| --- | --- | --- |
| **misunderstood request** leads; the detail says the agent solved another problem. | The prompt leaves the goal open. | [State the goal and when it is done](#state-the-goal-and-when-it-is-done) |
| **wrong approach** leads; the detail says the agent's design was rejected or redone. | The agent starts building before you agree on the approach. | [Agree on the approach before the code](#agree-on-the-approach-before-the-code) |
| **buggy code** leads; the detail says the code failed after the agent reported it done. | The agent reports done without running the tests. | [Make the agent prove it is done](#make-the-agent-prove-it-is-done) |
| **excessive changes** leads; the detail says the agent changed what it was not asked to. | The agent widens the task. | [Keep the agent inside the task](#keep-the-agent-inside-the-task) |
| **tooling** or **slow** leads, or the session sheet lists error loops. | Tool failures and retries. | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| The session sheet shows a peak context at 80% or more. | The session ran out of room. | [Keep context lean](/ai-ledger/improve/lean-context/) |

## Act

Each snippet goes in the project's `CLAUDE.md`. The same lines work in `AGENTS.md` for Codex, though the Judgments view cannot show their effect there. If the friction shows in every project, put the lines in your own `~/.claude/CLAUDE.md` instead.

### State the goal and when it is done

Make it a habit: when you start a task, write the first prompt in three parts.

```text
Goal: <what should be true when you are done>
Done when: <the check that proves it, such as a test that passes or a page that shows X>
Out of scope: <what not to touch>
```

Then paste this into `CLAUDE.md`:

```md
## Before you start
- If the request can mean two things, ask one question before you start. Do not guess.
- Restate the goal in one sentence before your first change.
```

### Agree on the approach before the code

Make it a habit: when a task touches more than one file or adds a design choice, ask for a plan first.

- In Claude Code, press Shift+Tab until the mode reads plan mode, then give the task. The agent plans and changes nothing until you accept the plan.
- In Codex, start the prompt with: "Before any change, list the files you will touch and the approach, then wait for my go."

Paste this into `CLAUDE.md` for the cases you forget:

```md
## Approach
- Before a change to more than one file, state the approach in three lines and wait for my go.
- When an approach fails twice, stop and say so. Do not try a third approach on your own.
```

### Make the agent prove it is done

Paste this into `CLAUDE.md`, with your project's commands in place of the examples:

```md
## Definition of done
- Run `npm test` and `npm run lint` before you say the task is done. Fix what fails.
- Never report done while a test fails. Say which test fails and why.
- When you change behavior, add or update a test for it.
```

### Keep the agent inside the task

Paste this into `CLAUDE.md`:

```md
## Scope
- Change only what the task asks for.
- List other problems you notice at the end of your reply. Do not fix them.
- Do not rename, reformat or move code that the task does not need.
```

## Verify

Before you act, note four figures at **30d**: **Fully or mostly achieved**, **Not achieved**, **Dissatisfied**, and the reports of the family you worked on in **Friction categories** (select **Reports**). The app has no custom date range, so you need them to compare with.

There is no same-day check: the judgments come from `/insights`, after the sessions end.

After 14 days of work, run `/insights` in Claude Code, select **Refresh**, and read the Judgments view:

| Figure | Where | Expected |
| --- | --- | --- |
| The weeks that start after your change | **Outcome trend** | A larger fully and mostly achieved part than in the weeks before it. The view counts a session by its start time, so these weeks hold only sessions you started after the change. |
| The family you worked on | **Friction categories**, by **Reports**, at **14d** | No longer first, or reported fewer times than half of your note at **30d**. The half is a rule of thumb: 14 days are about half of 30. |
| **Fully or mostly achieved** | **Outcomes at a glance**, at **14d** | A higher share than your note. |
| **Not achieved** and **Dissatisfied** | **Outcomes at a glance**, at **14d** | A lower share of **Sessions analysed** than in your note. |

If a figure did not move:

- Check the coverage note. If few of the new sessions are analysed, run `/insights` again, then **Refresh**.
- A change to `CLAUDE.md` applies to new sessions only.
- If the family fell but another rose to first place, the fix worked: start again from step 2 of Diagnose with the new family.
- If **Friction detail** still describes the same failure, the snippet does not reach the agent. Check that it sits in the `CLAUDE.md` of the folder you start the agent in.

## Related

- [Judgments](/ai-ledger/pages/insights/): every panel used here, the families, the weights and the filters.
- [Activity](/ai-ledger/pages/activity/#session-sheet): the session sheet and its **/insights judgment**.
- [Project](/ai-ledger/pages/project/): the **Session judgments** block for one project.
- [Metric glossary](/ai-ledger/reference/glossary/#judgments): what each judgment means.
- [Kill repeated tool failures](/ai-ledger/improve/tool-failures/): for **tooling** and **slow**.
- [Babysit agents less](/ai-ledger/improve/babysit-less/): for **rejected action**.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): where this check sits in a routine.
