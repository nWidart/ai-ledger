---
title: Retro on one project
description: Review one project's work, cost, errors and context on the Project page.
---

## Goal

At the end of a stretch of work on one project, find in 20 minutes the one figure of that project that most needs a fix, and see it improve by the next retro.

## Signs you need it

Run a retro when one of these holds:

- [Cost](/ai-ledger/pages/cost/), **What stands out**: the card **Cost-per-commit outlier** names the project. The app marks it **▲ Watch** when the project costs more than twice the median project per commit, and **● Act** from 4 times.
- Cost, **Project spend and change**: one project carries most of the rise in the change column.
- [Activity](/ai-ledger/pages/activity/), **Project metrics**: the project's **Errors / 100** or **Error loops** cell is tinted as worse. The app tints errors per 100 calls at 1.5 times the median project or more, and an error-loop count of 2 or more above the median. The table needs three or more projects to compare.
- Rule of thumb: you closed a milestone on the project, such as a release or a finished feature, or a month has passed since its last retro.

For all your projects at once, use the [Weekly 15-minute review](/ai-ledger/improve/weekly-review/) instead.

## Diagnose

Make one pass over the [Project](/ai-ledger/pages/project/) page. At each stop, read the figures named, compare them with the "off" column, and write them down. Fix nothing yet.

To open the page, set the project filter to the project, then select **Brief →** at the end of the scope bar. Set the range to the stretch you review: **30d** for a month (an example). Leave the source at **All** and **Include automated sessions** off.

Before the first stop, select the project's name in Cost's **Project spend and change** (or in Activity's **Projects** tab) to open the [project sheet](/ai-ledger/everywhere/sheets/#project-sheet). Write down its **est. cost**, **per commit**, **errors per 100 calls** and **error loops**: the Project page does not repeat these figures. Then select **Open project page** in the sheet.

The stops follow the page: the left column (Activity, Cost, Context), then the right column (Errors, Plan limits, Sessions, Session judgments).

| Stop | Read | Off when | Open |
| --- | --- | --- | --- |
| 1. **Activity** | **estimated cost per prompt**, **turns per prompt**, **of prompts interrupted** | Rule of thumb: a figure is higher than at the last retro. | [Spend less for the same output](/ai-ledger/improve/spend-less/) for cost or turns, [Babysit agents less](/ai-ledger/improve/babysit-less/) for interruptions |
| 2. **Cost** | The change against the previous period, **Models by estimated cost**, **Tokens beside cost** | Rule of thumb: the change is a rise, and Activity shows no rise in commits for the project; or a token kind's share of cost is far above its share of tokens. | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| 3. **Context** | **median starting context, tokens**, **sessions near the context limit** | The median start is 30,000 tokens or more, the app's threshold for its **Sessions start with a large context** tip; or a session came near the limit. | [Keep context lean](/ai-ledger/improve/lean-context/) |
| 4. **Errors** | **error rate**, the **Change** column of **Top error types** | A type's change is a rise, which the block colors as worse. | [Kill repeated tool failures](/ai-ledger/improve/tool-failures/) |
| 5. **Plan limits** | **Share of each open window** | Rule of thumb: the project holds over half of an open window. The block shows only when the project is among a window's top three users. | [Stop hitting plan limits](/ai-ledger/improve/plan-limits/) |
| 6. **Sessions** | The first rows of the eight most expensive sessions | Rule of thumb: a session in the top three has no commit. Select it: the session sheet's line of figures counts its commits. | [Spend less for the same output](/ai-ledger/improve/spend-less/) |
| 7. **Session judgments** | **Outcomes**, **Top friction** | Rule of thumb: **Not achieved** holds more than 10% of the analysed sessions, or one friction family leads by twice the next. | [Get sessions to finish](/ai-ledger/improve/finish-sessions/) |

Notes on the stops:

- The project sheet's figures have no comparison of their own. To compare **per commit** with the other projects, open Cost with **All projects**; for **errors per 100 calls** and **error loops**, open Activity's **Projects** tab or [Errors](/ai-ledger/pages/errors/).
- **Errors** counts automated sessions too, whatever the filter says, so its **error rate** can differ from the sheet's **errors per 100 calls**.
- **Session judgments** covers only Claude Code sessions that `/insights` analysed: "N of M Claude Code sessions analysed". If M is much larger than N, run `/insights` in Claude Code, select **Refresh**, and read the block again.
- The **Context** block's snapshot is the project's latest, whatever the range. Select **Measure now** if it is older than the stretch you review.

## Act

### Pick one fix

Do not work on every stop that is off. Pick one, in this order (a rule of thumb):

1. A stop whose sign the app raised itself: a **● Act** or **▲ Watch** card on Cost, a tinted cell in **Project metrics**, a tip threshold on Context.
2. **Errors**, when a type rises: a failing tool costs time, tokens and outcomes at once.
3. Any other stop that is off, the one that was also off at the last retro first.

Open the playbook in the stop's row, and do its **Act** section for this project only.

### Write what the project taught into its instruction file

When the stop you picked is **Errors** or **Session judgments**, end the retro with one line in the project's `CLAUDE.md`, or `AGENTS.md` for Codex. For the other stops, the playbook you opened names the change.

- From **Errors**: open the type that rises. In its detail, under **Potential fix**, select **Copy instruction line** and paste the line into the file. Then select **Mark fix applied**.
- From **Session judgments**: select **Open in Judgments**, filter by the top friction family, and read **Friction detail** on three cards. Write the rule that would have prevented it, such as:

  ```md
  - Run `npm test` before you say a task is done.
  ```

  The line is an example. [Get sessions to finish](/ai-ledger/improve/finish-sessions/#act) has a snippet for each friction family.

The file is shared in git, so the change reaches everyone who works in the repository.

### Keep a note of each retro

Paste this template into a notes file of your own, such as `ai-ledger-retro.md`, and fill one copy at each retro:

```md
## Retro of <project>, YYYY-MM-DD (range 30d, all sources)
- Project sheet: est. cost $_ · per commit $_ · errors per 100 calls _ · error loops _
- Activity: cost per prompt $_ · turns per prompt _ · prompts interrupted _%
- Cost: change vs the previous 30 days _ · top model _
- Context: median start _ tokens · sessions near the limit _
- Errors: error rate _% · rising types: _
- Plan limits: largest share of an open window _%
- Sessions: top session $_ with _ commits
- Session judgments: _ of _ analysed · not achieved _% · top friction _
- Stops that are off: _
- Fix picked: _ · line added to the instruction file: _
```

### Make it a habit

When you tag a release or close a milestone on the project, open its Project page and run the retro before you start the next piece of work. For a project with no milestones, put a monthly entry in your calendar.

## Verify

At the next retro, with the same project and the same range, compare the figure of the fix you picked with your note:

| Fix picked | Figure | Where | Expected |
| --- | --- | --- | --- |
| Spend | **per commit**, and **estimated cost per prompt** | The project sheet, and the Project page's **Activity** block | Lower than your note. |
| Errors | The type's **Change** | **Errors**, **Top error types** | A fall. In the type's detail on Errors, **Before and after the fix** reads **Rate lower**. |
| Context | **median starting context, tokens** | **Context** | Lower than your note, and under 30,000 tokens. |
| Outcomes | **Not achieved** | **Session judgments**, **Outcomes** | A lower share than your note. |
| Limits | The project's share | **Plan limits** | A lower share of the open window. |

For the same day, a line added to `CLAUDE.md` shows in the **Context** block: select **Measure now** and read **Memory files** in the legend. It is larger than before you added the line. That proves Claude Code reads the file, not that the fix works. A Codex project has no **Measure now**.

If the figure did not move:

- The previous period still held sessions from before the fix. Wait one more period, then read again.
- A change to `CLAUDE.md` or `AGENTS.md` applies to new sessions only.
- If another stop is now off, the fix worked and the work moved: pick that stop at this retro.

## Related

- [Project](/ai-ledger/pages/project/): every block read here and how to open the page.
- [Sheets](/ai-ledger/everywhere/sheets/#project-sheet): the project sheet and its eight quick figures.
- [Activity](/ai-ledger/pages/activity/#projects): **Project metrics**.
- [Cost](/ai-ledger/pages/cost/): **What stands out** and **Project spend and change**.
- [Metric glossary](/ai-ledger/reference/glossary/#project): the figures that show only on Project.
- [Cost estimates](/ai-ledger/concepts/cost-estimates/): why the cost figures are estimates.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): the same pass for all projects.
