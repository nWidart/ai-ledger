---
title: Insights
description: How Claude Code's /insights judged your sessions.
spec: [insights-dashboard, session-insights]
---

Insights answers: **did my sessions reach their goal, what got in the way, and how much of my work has `/insights` looked at?** It shows how Claude Code's `/insights` command judged your sessions, lists the judged sessions, and says how many sessions are not judged yet.

`/insights` is a Claude Code command. A model reads each session's transcript and writes one judgment file, a **facet**, per session. The app reads those files at every ingest and keeps a copy in the store, so the judgments stay after Claude Code overwrites or deletes the files. The app never calls a model and never runs `claude`. The directory it reads is `~/.claude/usage-data` (set with `--usage-data`; see the [CLI reference](/ai-ledger/reference/cli/)).

<!-- shot slots: insights-vitals (the five figures), insights-outcomes-friction (Outcomes and Friction categories side by side), insights-sessions (the filter controls and two session cards), insights-coverage (the Coverage drawer, open) -->

## Model-judged and measured

Every figure that comes from a facet carries a **model-judged** tag next to it and in the page heading. The tag says the figure is a model's opinion of a transcript, not a measurement. Figures counted from transcripts (Session figures, Coverage, the measured line on a session card) carry no tag.

## Filters

Insights has the shared project, time range, source and Include automated filters. See [Filters](/ai-ledger/everywhere/filters/).

- A session belongs to a range by its **start time**. [Activity](/ai-ledger/pages/activity/) counts a session with a request in the range, so the two totals can differ slightly. The sub line says so.
- Source **Codex** shows no figures: "/insights analyses only Claude Code sessions." Codex writes no facets. With source All, Codex sessions never count in a facet figure.
- With Include automated off, the facets of automated sessions count nowhere on the page. With it on, they count in every figure except the coverage figures, which never count automated sessions unless the project filter names their project.
- **Refresh** is the button in the navigation bar. It runs an ingest at once: the app reads new transcript lines and new `/insights` files into the store, and the page then shows them.

Besides the shared filters, the page has drill-down filters on the session list. They are kept in the page address, so a copied link keeps them, and they survive a change of project, range, source or Include automated. Setting one adds a history entry, so Back undoes it.

## Page states

The text at the top changes with what the store holds.

| State | What the page says |
| --- | --- |
| No facet in the store | "No /insights data found." with the directory it reads and "Run /insights in Claude Code, then Refresh." |
| No facet, but session figures exist | "No /insights judgments found." The session figures are counted from transcripts. |
| Facets in the store, none in this view | "No analysed sessions in this view." |
| Source Codex | "/insights analyses only Claude Code sessions." No figures. |
| Facets in the view | The panels below. |

## Panels

In page order, when the view has analysed sessions.

### Coverage note

"**150 of 400 Claude Code sessions** in this view analysed (38%). Each /insights run in Claude Code analyses more. The newest analysis was written Sat, Nov 7, 2:00 PM. Coverage by project and run." The last words link to the Coverage drawer. When none is missing, it reads "Every Claude Code session in this view with a transcript is analysed." With source All and Codex sessions in the view, a second line says they are not analysed.

### Heading and sub line

The heading counts only the fully achieved sessions, not the mostly achieved ones. It reads "**117 of 150** analysed sessions fully achieved their goal; **tooling** caused the most friction." It names the friction family with the highest count when the family holds two or more labels, else the most counted label as written, or "no friction reported". The sub line names the view and the counting rule above.

### Section index

Links to Overview, Outcomes, Friction, Trend (when the trend shows), Satisfaction and Sessions, then to the drawers Goals, Session types, Session figures, Coverage and How this works. Choosing a drawer opens it and scrolls to it. It does not show for source Codex or an empty store.

### Outcomes at a glance

Five figures:

| Figure | Detail line |
| --- | --- |
| Sessions analysed | "150 of 400 stored Claude Code sessions", plus ", N without transcript" and "; N with no clear outcome" when they apply. |
| Fully or mostly achieved | The fully plus mostly achieved count and its share, with the split: "141 (94%)", "117 fully, 24 mostly". |
| Partially | "some of the goal met". |
| Not achieved | "goal abandoned or failed". |
| Dissatisfied | "sessions where the user pushed back": sessions with a dissatisfied signal. |

### Outcomes

Model-judged. Whether each session met its goal, as a share of the analysed sessions: Fully achieved, Mostly achieved, Partially achieved, Not achieved and Unclear. Each row shows its share and its count. An outcome the page does not know shows under its raw name. Each row is a button that filters the session list.

### Friction categories

Model-judged. What got in the way, by times reported, with the sessions that reported it ("14", "9 sessions"). A session can carry several labels. Similar labels are grouped into **families** by keyword, in a fixed order where the first matching rule wins; a label no rule matches is a family of its own. A family of two or more labels shows an expander, "N labels", that lists the labels as `/insights` wrote them. A family's count is the sum of its labels' counts, and its sessions are the distinct sessions that carry any of them. Names read with spaces, not underscores. The list shows the first 12 rows and "Show all N friction families". With none, it reads "No friction reported in this view."

Selecting a family row filters the session list by the family (`frf`); selecting a label row, or a family of one label, filters by that label (`fr`). The chip names the filter: "Friction: buggy code" for a label, "Friction family: buggy code" for a family. Selecting the same row again, or the chip, clears it.

### Outcome trend

Model-judged. For each week of session start, the share of analysed sessions fully or mostly achieved, as "Week of Nov 3", the share, and "4 of 5". Weeks with no session are left out, and at most the newest 26 weeks show. The panel shows only when the analysed sessions span two or more weeks. A week with few sessions swings.

### Satisfaction and helpfulness

Model-judged. Two lists:

- The user satisfaction signals the model saw, summed over the sessions: satisfied, likely satisfied, dissatisfied, and so on, each with its count and sessions. They are not filters. The list shows the first 12 rows.
- **Claude's helpfulness**: sessions per rating, from essential to unhelpful, with the count and the share. Each row is a filter.

### Analysed sessions

Model-judged. The view's analysed sessions as cards. A line above the cards says how many it lists, in what order, and that the summary and friction detail are the model's words.

| Control | What it does |
| --- | --- |
| Sort | Orders the list; it removes no session. **Newest** (default), **Oldest**, or **Outcome**. Outcome puts the worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved, and the newest first within one outcome. The choice lasts for the page visit and is not in the address. |
| Outcome | All outcomes, or one of the outcomes the view has. |
| Only sessions with friction | Lists sessions whose facet reports a friction category or friction detail. |

**Active filters** show above the list as chips, such as "Friction: buggy code". Selecting a chip removes that filter. With two or more, **Clear filters** removes them all. All filters combine with AND, and the count changes to "N of M sessions".

The drill-down filters and their address keys:

| Filter | Key | Set from |
| --- | --- | --- |
| Outcome | `outcome` | The Outcomes rows, the Outcome select, a card's outcome badge. |
| Helpfulness | `help` | The helpfulness rows. |
| Goal, friction label | `goal`, `fr` | A goal or friction label row, or a chip on a card. |
| Goal family, friction family | `goalf`, `frf` | A family row. |
| Friction only | `friction=1` | The checkbox. |

A value no session has shows "No session in this view matches the filters." with no error.

Each card shows: the session title (a link to the session's sheet on Activity, in the view's filters; a session with no transcript in the store shows "no transcript" and no link), the outcome badge, **dissatisfied** when the user pushed back, the goal chips and friction chips, the start time and the project, then the model's brief summary. A closed **Friction detail** control holds the model's friction text. A last line counted from the transcript reads "+120 −30 lines · 4 files · 35m · 1 push", leaving out any part that is missing or 0. The chips and the badge are buttons that set or clear their filter without moving the page.

The list shows the first 25 sessions and "Show all N sessions". The payload holds the newest 200 analysed sessions of the view; when it is cut and a filter is active, the line says the filter covers only those 200, so a ledger count can exceed the sessions listed.

### Drawers

Closed by default; the page remembers the ones you leave open.

| Drawer | Content |
| --- | --- |
| Goals (model-judged) | What each session set out to do, as families with the same grouping and filters as Friction categories. First 12 rows. |
| Session types (model-judged) | A colored strip and a key with the sessions per type, for example multi task 109. Not filters. |
| Session figures | What `/insights` counted from each transcript, for sessions with a session-meta row, which can be more than were judged: Lines added, Lines removed, Files modified, Git pushes, Median session duration and Median response time (the median of the session medians), then **Languages** with the summed count and the sessions that named each. Shows in a view with no analysed session. Not shown for source Codex. |
| Coverage | **By project**: Claude Code sessions of the view analysed, as "8 of 10" and the share, busiest project first, with "none analysed" for a project with no judgment. First 12 rows. **By run**: the `/insights` runs in the view, newest first, at most 20, each with its time and the facets it wrote in the view. A run is the facets written within an hour of each other; a session analysed again counts in its latest run. These are counts, not judgments. |
| How this works | What `/insights` is, the directory the app reads, when the last run wrote, how many sessions the last runs wrote ("The last 3 runs each wrote between 40 and 80 sessions (median 60)", or "The one run so far wrote 12 sessions"), and "For more coverage, run /insights again in Claude Code, then Refresh." Shows whenever the store has facets and the source is not Codex. |

## Sheets

Insights opens no sheet of its own. A session card links to that session's sheet on [Activity](/ai-ledger/pages/activity/), where a **/insights judgment** section (model-judged) repeats the outcome, the dissatisfied mark, the helpfulness and session type ratings, the goal and friction chips, the summary and the friction text, with an **Open in Insights** link. Project rows in Coverage by project work with the [context menu](/ai-ledger/everywhere/context-menu/).

## What each figure means

| Figure | Meaning |
| --- | --- |
| Outcome | A model's reading of whether the session met its goal: fully, mostly, partially or not achieved, or unclear from the transcript. |
| Dissatisfied | A session where the model saw the user push back. |
| Friction | A label for what got in the way. The counts are times reported; a session can carry several. |
| Family | A group of similar friction or goal labels, made by keyword when the page loads. |
| Helpfulness | The model's rating of how helpful Claude was, essential to unhelpful. |
| Session type | The model's label for the shape of the session, such as single task or multi task. |
| Analysed | A Claude Code session with a facet. |
| Run | The facets written within an hour of each other. |
| Session figures | Counts `/insights` made from the transcript. They are measured. |

See the [Metric glossary](/ai-ledger/reference/glossary/) for every figure in the app.

## Playbooks that start here

- [Get sessions to finish](/ai-ledger/improve/finish-sessions/): raise the share of sessions that reach their goal, from the outcomes and friction.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): where Insights sits in a routine across the pages.
