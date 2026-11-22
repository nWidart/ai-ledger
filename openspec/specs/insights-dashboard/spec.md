# insights-dashboard Specification

## Purpose
Activity's Judgments view (`/usage?view=judgments`, once the Insights page): shows, per project and time range, how Claude Code's `/insights` judged the analysed sessions (outcome, satisfaction, helpfulness, friction, goals and session types), lists those sessions, and says how much of the view is not analysed yet.

## Requirements

### Requirement: Filter by project, range, source and automated sessions
The Judgments view SHALL offer the shared project, time range and automated-session filters, in the scope bar, and no source filter: every figure is of Claude Code sessions, and the view SHALL ask the app for every source whatever the URL's source. Every figure and list SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: One project
- **WHEN** the user opens `/usage?project=ai-ledger&range=30&view=judgments`
- **THEN** every figure counts only facets of `ai-ledger` sessions that started in the last 30 days

#### Scenario: Switch from Activity
- **WHEN** the user views project `foo` for the last 14 days on Activity's Overview and picks Judgments
- **THEN** the Judgments view opens filtered to `foo` and the last 14 days

#### Scenario: Automated sessions left out
- **WHEN** the automated control is off and `observer-sessions` has facets
- **THEN** those facets count nowhere on the page

#### Scenario: A source in the URL
- **WHEN** the user opens the view with `source=claude` in the URL
- **THEN** the view shows no source filter, its figures are the same as with no source, and `source=claude` stays in the URL

### Requirement: Label facet figures as model-judged
The view SHALL carry the model-judged tag once, beside Activity's view switch and outside the lede heading, and the sub line SHALL say that the figures come from `/insights` facets, a model's reading of each session, except Session figures and Coverage, which are counted, and each session's cost, peak context and tool errors, which are measured. The panels and drawers SHALL NOT repeat the tag. The lede SHALL be the page's one level-one heading.

#### Scenario: Outcome section
- **WHEN** the outcome section is shown
- **THEN** it says that the outcomes are judged by a model from the transcript

#### Scenario: One tag
- **WHEN** the user opens the Judgments view for a view with analysed sessions
- **THEN** the model-judged tag shows once, beside the view switch, the lede is the one level-one heading, and no panel heading carries the tag

### Requirement: Show outcome rates
The page SHALL show the view's analysed sessions as one stacked bar split by outcome, best first, over a row per outcome with its share and count: fully achieved, mostly achieved, partially achieved, not achieved, and unclear. An outcome value it does not recognize SHALL be shown under its raw name, as a part and a row of its own, not dropped.

#### Scenario: Outcome mix
- **WHEN** the view holds 150 facets: 117 fully, 24 mostly, 7 partially, 1 not achieved and 1 unclear
- **THEN** the bar has five parts in that order, and the rows show fully achieved at 78% (117), mostly at 16% (24), partially at 5% (7), not achieved at 1% (1) and unclear at 1% (1)

#### Scenario: Unknown outcome
- **WHEN** a facet has outcome `abandoned`
- **THEN** the page shows a row named `abandoned` with its count, after the known outcomes, and a part for it at the end of the bar

### Requirement: Show satisfaction and helpfulness
The page SHALL show the user satisfaction signals summed over the view's facets, per signal (for example satisfied, likely satisfied, dissatisfied, unclear), as a ranked list, and the sessions per helpfulness rating as one stacked bar from essential to unhelpful, over a row per rating with its share and count.

#### Scenario: Satisfaction signals
- **WHEN** one facet counts 2 `likely_satisfied` and 1 `dissatisfied`, and another counts 1 `satisfied`
- **THEN** the page shows likely satisfied 2, dissatisfied 1 and satisfied 1

#### Scenario: Helpfulness ratings
- **WHEN** the view holds 150 facets, 111 of them `very_helpful`, 26 `essential` and 11 `moderately_helpful`
- **THEN** the rows read essential 17% (26), very helpful 74% (111) and moderately helpful 7% (11), in that order, and the bar's parts follow the same order

### Requirement: Show friction categories
The page SHALL list friction families with the number of sessions that reported any of their labels, heaviest first under the chosen weight: the cost or the active time of those sessions, or the total count over the view's facets. A family of one label SHALL show that label as written.

#### Scenario: Friction ranking
- **WHEN** 9 sessions report `wrong_approach` 14 times and 4 sessions report `buggy_code` 5 times, no other label shares a family with them, and the user weighs by Reports
- **THEN** `wrong_approach` is listed first with 14 in 9 sessions, then `buggy_code` with 5 in 4 sessions

#### Scenario: No friction
- **WHEN** no facet in the view reports friction
- **THEN** the section says no friction was reported, instead of an empty table

### Requirement: Show goal categories and session types
The page SHALL list goal families by total count over the view's facets, and the number of sessions per session type, each in a drawer that is closed by default. A list of free-form entries (goal families, friction families, satisfaction signals) SHALL show its first 12 rows, with a control to show them all.

#### Scenario: Goals and types
- **WHEN** the view holds 109 `multi_task` and 16 `single_task` sessions, and goals `implement_feature` 40 and `fix_bug` 22
- **THEN** the page lists session types multi task 109 and single task 16, and goals implement feature 40 and fix bug 22, once their drawers are open

#### Scenario: Many goals
- **WHEN** the view holds 222 goal families
- **THEN** the Goals list shows the 12 most counted and a "Show all 222 goal families" control

### Requirement: List analysed sessions
The page SHALL list the view's analysed sessions as cards: title, outcome, goals and friction categories with the project and start time on a first line, and the brief summary full width below. The friction detail SHALL stay hidden until the user expands it. The list SHALL scroll with the page, show its first 25 sessions with a control to show them all, and say how many it lists and in what order. Sessions with friction SHALL be listable on their own, kept in the page URL.

#### Scenario: Only sessions with friction
- **WHEN** the user narrows the list to sessions with friction
- **THEN** only sessions whose facet reports a friction category or friction detail are listed, each with its friction detail available to expand, and the list says "N of M sessions"

#### Scenario: Friction detail on expand
- **WHEN** the page lists a session whose facet has friction detail
- **THEN** the card shows the brief summary and a closed "Friction detail" control, and the detail shows once the user expands it

#### Scenario: No friction detail
- **WHEN** a session's facet has no friction detail
- **THEN** its card shows no expander

### Requirement: Link analysed sessions to their sheets
Each session in the store SHALL link to its session sheet, which opens over the Judgments view. The view's project, range, source, automated filter and its own filters SHALL stay as they were under the sheet and after it closes. The link's address SHALL name the view, so a new tab opens the same.

#### Scenario: Open a session
- **WHEN** the user views project `foo` for the last 7 days and clicks a session in the list
- **THEN** that session's sheet opens over the Judgments view, and the view still shows project `foo` for the last 7 days

#### Scenario: Session missing from the store
- **WHEN** a facet's session has no transcript in the store
- **THEN** the session is listed with its summary and no link

### Requirement: Show coverage and staleness
The page SHALL show, in neutral text, how many of the view's Claude Code sessions have a facet, out of how many, and the share, with the note that each `/insights` run analyses more when any have none. It SHALL show when the newest facet in the store was written. The page SHALL say every session is analysed only when the view has at least one analysed session and none without a facet.

#### Scenario: Sessions not analysed
- **WHEN** the view holds 400 Claude Code sessions and 150 of them have a facet
- **THEN** the page says "150 of 400 Claude Code sessions in this view analysed (38%)" and that each `/insights` run analyses more

#### Scenario: No analysed session in the view
- **WHEN** the view holds no analysed session
- **THEN** the page says no analysed sessions are in the view, and does not say every session is analysed

#### Scenario: No facets at all
- **WHEN** the store holds no facet
- **THEN** the page says no `/insights` data was found, names the directory it reads, and says to run `/insights` in Claude Code

#### Scenario: Session meta without facets
- **WHEN** the store holds no facet and the view has session-meta rows
- **THEN** the page says no `/insights` judgments were found, still says to run `/insights`, and says the session figures are counted from transcripts

### Requirement: Leave automated sessions out of the coverage
Automated sessions SHALL NOT count in the coverage, whatever the automated filter, unless the project filter names their project.

#### Scenario: Automated sessions included
- **WHEN** the automated filter is on and the view holds 3,000 `observer-sessions` sessions besides 400 Claude Code sessions
- **THEN** the coverage still counts 400 Claude Code sessions

### Requirement: Treat Codex sessions as not analysed
Codex and Grok sessions, and the sessions of any source other than Claude Code, SHALL never count in a facet figure, and the view SHALL show no line that counts them. Activity SHALL NOT show the Judgments view for a view of a source other than Claude Code alone: it shows Overview, with the reason on its view switch. The sub line's How measured toggletip SHALL say that `/insights` judges Claude Code sessions only, so the view has no source filter.

#### Scenario: Source All
- **WHEN** the view holds 400 Claude Code and 60 Codex sessions
- **THEN** the coverage line counts the 400 Claude Code sessions, and no line names the Codex sessions

#### Scenario: Source Codex
- **WHEN** the URL names `source=codex` and `view=judgments`
- **THEN** Activity shows Overview, and no page says that `/insights` analyses only Claude Code sessions in place of figures

#### Scenario: Source Grok
- **WHEN** the URL names `source=grok` and `view=judgments`
- **THEN** Activity shows Overview for Grok, and no line of the Judgments view counts Grok sessions

### Requirement: Read only the local store
The Insights page SHALL read its data from the store through the app, and SHALL NOT call a model, run `claude`, or read the usage-data directory itself.

#### Scenario: Usage data deleted
- **WHEN** the usage-data directory is deleted while the app runs
- **THEN** the page shows the same figures as before

### Requirement: Say how sessions are counted
The Judgments view SHALL say, behind the sub line's How measured toggletip, that it counts a session by its start time, and that Overview counts a session with a request in the range, so the two totals can differ slightly.

#### Scenario: Subtitle names the counting rule
- **WHEN** the user opens the Judgments view with a view that has facets and activates the sub line's How measured toggletip
- **THEN** the toggletip says a session counts by its start time and that Overview counts a session with a request in the range

### Requirement: Order the Judgments view
When the view has analysed sessions, the Judgments view SHALL show, in this order: Activity's view switch, the lede, its sub line, the coverage note, the vitals, one row holding Outcomes and Friction categories, the Trend panel when it is shown, Satisfaction and helpfulness, the analysed sessions, then the drawers: Goals, Session types, Session figures, Coverage and How this works. Each drawer SHALL be closed by default. Its filters are in the scope bar.

#### Scenario: Order with figures
- **WHEN** the view holds facets of analysed sessions across 2 or more weeks, and session-meta rows
- **THEN** the sections read in the order Outcomes, Friction categories, Outcome trend, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, Session figures, Coverage, How this works, and the drawers are closed

#### Scenario: Order without a trend
- **WHEN** the view holds analysed sessions from one week only
- **THEN** the Trend panel is left out and the other sections keep their order

### Requirement: Sort analysed sessions
The page SHALL let the user order the listed sessions by Newest (the default), Oldest or Outcome. Outcome SHALL put the worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved, and sessions with the same outcome newest first. The choice SHALL last for the page visit, also across a view with no list, and SHALL NOT be kept in the page URL. The list's description SHALL say the order in words.

#### Scenario: Oldest first
- **WHEN** the user picks Oldest
- **THEN** the sessions are listed from the oldest start time to the newest

#### Scenario: Worst outcome first
- **WHEN** the user picks Outcome
- **THEN** sessions that did not achieve their goal come first, fully achieved ones last, and two sessions with one outcome keep newest first

#### Scenario: Another source and back
- **WHEN** the user picks Oldest, the list goes away for a view with no analysed session (the view has no source filter, so by a project filter), and the user clears that filter
- **THEN** the list is still ordered oldest first

### Requirement: Filter analysed sessions by outcome
The page SHALL let the user narrow the listed sessions to one outcome with a select of All outcomes and each outcome that has sessions in the view, shown by its label, kept in sync with the `outcome=<outcome name>` URL key and the outcome row and badge filters. It SHALL combine with the other filters and change the "N of M sessions" count. An outcome in the URL that no session has SHALL show an empty state, not an error; the select SHALL still name it.

#### Scenario: One outcome
- **WHEN** the user picks "Partially achieved"
- **THEN** the URL gains `outcome=partially_achieved` and only sessions with that outcome are listed, the list saying "N of M sessions"

#### Scenario: From the URL
- **WHEN** the user opens `/usage?view=judgments&outcome=not_achieved&friction=1`
- **THEN** the outcome select shows "Not achieved", the friction box is checked, and only sessions with both are listed

#### Scenario: Outcome nobody has
- **WHEN** the user opens `/usage?view=judgments&outcome=gone`
- **THEN** the list says no session in this view matches the filters, the select still names that outcome, and the page shows no error

### Requirement: Show coverage by project
The page SHALL show, in a Coverage drawer closed by default, for each project in the view, how many of its Claude Code sessions are analysed, out of how many, and the share, busiest project first. A project with no analysed session SHALL be marked as such. The figures follow the coverage rules: automated sessions and Codex sessions SHALL NOT count. They are measured, so the drawer SHALL NOT carry the model-judged tag. The coverage sentence SHALL link to the drawer.

#### Scenario: Busy project with none analysed
- **WHEN** the view holds 120 sessions of `big-app` with no facet and 10 sessions of `small-app` with 8 facets
- **THEN** the drawer lists `big-app` first as 0 of 120, marked as none analysed, and `small-app` as 8 of 10 (80%)

#### Scenario: Automated sessions left out
- **WHEN** the automated filter is on and `observer-sessions` has sessions
- **THEN** the drawer lists no `observer-sessions` row

#### Scenario: Long list
- **WHEN** the view holds more than 12 projects
- **THEN** the drawer shows the first 12 and a control to show all

### Requirement: Show coverage by run
The page SHALL show, in the Coverage drawer, the `/insights` runs that wrote a facet in the view, newest first, at most 20, each with its time and the number of facets it wrote in the view. A run is a group of stored facets whose write times have no gap over one hour between neighbours, formed over the whole store whatever the filters. A session analysed again SHALL count in its latest run only. A run with no facet in the view SHALL be left out. The page SHALL say what a run is.

#### Scenario: Two runs a day apart
- **WHEN** 40 facets were written on Monday afternoon and 25 on Tuesday afternoon
- **THEN** the drawer lists the Tuesday run with 25 facets, then the Monday run with 40

#### Scenario: Facets 30 minutes apart
- **WHEN** one facet was written at 10:00 and another at 10:30
- **THEN** they count as one run, timed at 10:30

#### Scenario: Run with no facet in the view
- **WHEN** the view is project `foo` and a run wrote only facets of other projects
- **THEN** the drawer does not list that run

### Requirement: Explain how /insights works
The view SHALL offer a closed "How this works" drawer whenever the store has facets, even when the view has no analysed session. It SHALL say what `/insights` is, that the app only reads its files and never calls a model, the directory read, and how to get more coverage.

#### Scenario: Drawer text
- **WHEN** the user opens the drawer
- **THEN** it names `/insights` as a Claude Code command, shows the directory in code, and says to run `/insights` again, then Refresh

#### Scenario: Codex source
- **WHEN** the source is Codex
- **THEN** Activity shows Overview, so the drawer is not shown

#### Scenario: No facet in the store
- **WHEN** the store holds no facet
- **THEN** the drawer is not shown

### Requirement: Say how much one run analyses
The drawer SHALL give the time of the newest facet and the sizes of the newest 20 runs over the whole store, whatever the filters: how many runs, and the smallest, median and largest. With one run it SHALL give that run's size.

#### Scenario: Several runs
- **WHEN** the store holds runs of 40, 60 and 80 facets
- **THEN** the drawer says the last 3 runs each wrote between 40 and 80 sessions (median 60)

#### Scenario: One run
- **WHEN** the store holds one run of 12 facets
- **THEN** the drawer says the one run so far wrote 12 sessions

### Requirement: Show the outcome trend per week
The page SHALL show a panel under the outcome and friction row with one bar per week, by session start. Each bar SHALL fill the plot (100% of its week), stacked best outcome first: fully, mostly, partially, not achieved, no clear outcome. Every part with a session SHALL show at least 1px. The week's sessions SHALL show over its bar, over every few bars when they would overlap. A legend SHALL name the parts. Weeks without a session are left out; at most the newest 26 show.

#### Scenario: One session in 150
- **WHEN** a week holds 150 analysed sessions, one of them not achieved
- **THEN** its not-achieved part shows at least 1px tall

#### Scenario: 26 weeks on a phone
- **WHEN** the trend has 26 weeks on a phone 320px wide
- **THEN** the counts over the bars do not overlap: they show over every few bars, and the table holds each week's

#### Scenario: Weekly share
- **WHEN** a week holds 5 analysed sessions, 4 of them fully or mostly achieved
- **THEN** the two lowest parts of its bar fill 80% of it, with 5 over the bar

#### Scenario: Weekly mix
- **WHEN** a week holds 12 analysed sessions: 7 fully, 2 mostly, 2 partially and 1 not achieved
- **THEN** its bar is as tall as every other, split 58%, 17%, 17% and 8% from the bottom, with 12 over it

#### Scenario: No clear outcome
- **WHEN** a week holds a session whose outcome is unclear, or one `/insights` added later
- **THEN** it counts in the week's sessions and in the bar's last part

#### Scenario: Sessions without a start time
- **WHEN** an analysed session has no start time
- **THEN** it counts in no week

### Requirement: Hide a trend of fewer than two weeks
The trend panel SHALL be shown only when the view's analysed sessions span 2 or more weeks. Its hint SHALL say that the bars are shares of each week and that the figure over a bar is its sessions; its How measured toggletip SHALL say that weeks are by session start and begin on Monday.

#### Scenario: One week
- **WHEN** all analysed sessions of the view started in one week
- **THEN** the panel is not shown

### Requirement: Filter the sessions from a ledger row
A row of the Outcomes, Claude's helpfulness, Friction categories and Goals lists SHALL be a button that narrows the session list to that value (outcome, helpfulness, or a friction or goal family or label) and moves to the list. Selecting the row that is already the filter SHALL clear it. The active row SHALL be marked and expose `aria-pressed`. A row with no sessions SHALL NOT be a button. The satisfaction signals and session types are not filters.

#### Scenario: Which sessions had buggy code
- **WHEN** `buggy_code` is the only label of its family and the user selects its row of Friction categories
- **THEN** the URL gains `fr=buggy_code`, the page moves to the session list, only sessions reporting that label are listed, and the row is marked pressed

#### Scenario: Select it again
- **WHEN** the user selects the active "buggy code" row
- **THEN** the filter clears, `fr` leaves the URL and every session is listed again

### Requirement: Filter the sessions from a card
On a session card, each goal chip, each friction chip and the outcome badge SHALL be a button that sets that filter, as a ledger row does, without moving the page. A chip or badge that is the active filter SHALL be marked and expose `aria-pressed`, and selecting it SHALL clear the filter.

#### Scenario: A goal chip
- **WHEN** the user selects the "fix bug" chip on a card
- **THEN** the URL gains `goal=fix_bug` and the list keeps only sessions with that goal

### Requirement: Keep the drill-down filters in the URL
The drill-down filters SHALL be kept in the URL as `outcome=`, `help=`, `goal=` and `fr=`, one raw category name each, and `goalf=` and `frf=`, one family key each. Setting one SHALL add a history entry, so Back undoes it. All active filters, `friction=1` included, SHALL combine with AND and SHALL change the "N of M sessions" count. They SHALL survive a change of project, range or automated sessions. A switch to Overview SHALL drop them.

#### Scenario: Combined filters
- **WHEN** the user opens `/usage?view=judgments&fr=buggy_code&goal=fix_bug`
- **THEN** only sessions with both are listed, and a project, range or source in the URL is left as it is by changing a filter

#### Scenario: Value nobody has
- **WHEN** the user opens `/usage?view=judgments&goal=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

#### Scenario: Back to Overview
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved` picks Overview
- **THEN** the URL is `/usage?range=7`

### Requirement: Show the active filters as removable chips
Above the session list, each active filter SHALL show as a chip that names its kind and value (for example "Friction: buggy code") and removes that filter when selected, with an accessible name such as "Remove filter Friction: buggy code". With two or more active filters the list SHALL also offer "Clear filters", which removes them all.

#### Scenario: Two filters
- **WHEN** `fr=buggy_code` and `outcome=not_achieved` are active
- **THEN** two chips show, "Clear filters" shows, and selecting a chip removes only its filter

### Requirement: Say what truncation hides from a filter
The payload lists at most the newest 200 analysed sessions of the view. When it is cut and any filter is active, the list's description SHALL say the filter covers only those newest 200 analysed sessions, so a ledger count can exceed the sessions listed.

#### Scenario: Cut list
- **WHEN** the view has 340 analysed sessions and the user filters by a friction category
- **THEN** the description says the filter covers the newest 200 analysed sessions of the view

### Requirement: Show the view's session figures
The Insights page SHALL show a "Session figures" drawer, closed by default, with the lines added and removed, files modified and git pushes summed, and the median session duration and median response time. Response time is the median of the per-session median response times. The figures SHALL NOT be marked model-judged.

#### Scenario: Figures drawer
- **WHEN** the view has session-meta rows
- **THEN** the drawer shows the summed figures and the medians, a missing figure counting as 0 in a sum and a median with no value shown as a dash

#### Scenario: Drawer is not tagged as judged
- **WHEN** the drawer is shown
- **THEN** its heading carries no model-judged tag

### Requirement: Say where the session figures come from
The drawer SHALL say that `/insights` counted the figures from each transcript, for how many sessions, and that this can be more sessions than were judged. It SHALL say that response time is the median of session medians.

#### Scenario: More sessions than judged
- **WHEN** the view has 3 session-meta rows and 1 facet
- **THEN** the drawer counts 3 sessions, including the 2 with no facet, and says this can be more than were judged

### Requirement: Count session figures in the view
The session figures SHALL cover Claude Code sessions with a session-meta row. A row's project SHALL be its stored session's, else the meta's, and its start the stored session's first timestamp, else the meta's start time. The project, range, source and automated filters SHALL apply as they do to facets.

#### Scenario: View filter
- **WHEN** the user filters to project `foo` for the last 7 days
- **THEN** the drawer counts only session-meta rows of `foo` sessions that started in the last 7 days

#### Scenario: Session meta without a facet
- **WHEN** a session has a session-meta row and no facet
- **THEN** the drawer counts it, and the analysed counts do not

### Requirement: List languages
The drawer SHALL list every language the view's session-meta rows name, most counted first and ties by name, with its summed count and the number of sessions that named it. It SHALL show the first 12 until asked for all. A languages value that is not a JSON object SHALL be skipped without failing the page.

#### Scenario: Languages ledger
- **WHEN** two sessions name Python (5 and 1) and one names Go (2)
- **THEN** the ledger shows Python 6 over 2 sessions, then Go 2 over 1 session

#### Scenario: Many languages
- **WHEN** the view names 15 languages
- **THEN** the ledger shows 12 and a control to show all 15

### Requirement: Show session figures only when counted
The drawer SHALL appear only when the view has a session-meta row. It SHALL appear in a view with no analysed session. For a source other than Claude Code, such as Codex or Grok, the app SHALL send empty figures.

#### Scenario: Codex
- **WHEN** the app is asked for the judgments of source Codex
- **THEN** the figures count no sessions

#### Scenario: Grok
- **WHEN** the app is asked for the judgments of source Grok
- **THEN** the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet, and the store has facets of other sessions
- **THEN** the drawer is shown beside the How this works drawer

### Requirement: Show a measured line on each session
A session card SHALL show one line of the session's own figures counted by `/insights`: lines added and removed, files modified, duration and pushes. It SHALL leave out a part that is missing or 0, and show no line when none is left. The line SHALL be apart from the model's summary, titled as counted from the transcript.

#### Scenario: Session with meta
- **WHEN** a session has 120 lines added, 30 removed, 4 files, 35 minutes and 1 push
- **THEN** its card shows "+120 −30 lines · 4 files · 35m · 1 push", titled "Counted by /insights from the transcript"

#### Scenario: Session with a facet and no meta
- **WHEN** a listed session has no session-meta row
- **THEN** its card shows no measured line

#### Scenario: Part left out
- **WHEN** a session has 0 files modified and no pushes
- **THEN** the line shows neither

### Requirement: Group goal and friction labels into families
The payload SHALL group the goal labels and the friction labels of the view into families by keyword. It SHALL compute them when it is built and SHALL NOT store them. A label is split into lower-case tokens on `_`, `-`, spaces and `/`. The first rule, in a fixed order per kind, with a keyword (one token) or a phrase (consecutive tokens) in the label SHALL win. A label no rule matches SHALL be a family of its own, with no "Other" bucket.

#### Scenario: Two labels, one family
- **WHEN** the view holds the goals `create_pull_request` and `open_pr`
- **THEN** both belong to the family "pull request"

#### Scenario: First matching rule wins
- **WHEN** the view holds the goal `fix_failing_test`, which matches the fix bug rule and the tests rule
- **THEN** it belongs to the family of the rule that comes first, "fix bug"

#### Scenario: Whole words only
- **WHEN** the view holds the goals `express_routes` and `address_feedback`
- **THEN** neither joins the "pull request" or "implement feature" family, and each is a family of its own

#### Scenario: Unmatched label
- **WHEN** the view holds the goal `learn_rust`, which no rule matches
- **THEN** it is a family of one label named `learn rust`

### Requirement: Count a family from its labels
A family's count SHALL be the sum of its labels' counts. Its sessions SHALL be the distinct sessions of the view with any of its labels, never the sum of its labels' sessions; a friction family's cost and active time SHALL be summed over those sessions. The payload SHALL order labels by count, then name, and families by count, then sessions, then key; on screen the Friction rows follow the selected weight. The raw goal and friction lists SHALL stay in the payload.

#### Scenario: One session, two labels of a family
- **WHEN** one session reports `create_pull_request` 2 times and `open_pr` once, and no other session does
- **THEN** the family "pull request" counts 3 in 1 session

#### Scenario: Empty view
- **WHEN** the view has no goal
- **THEN** the goal families are empty

### Requirement: Expand a family to its labels
A family of two or more labels SHALL have an expander, a button apart from its row's filter button, that lists its labels as `/insights` wrote them with their counts. It SHALL be closed by default and SHALL expose `aria-expanded`. A family of one label SHALL be a plain row with that label's name and no expander. A label row SHALL filter by its raw name.

#### Scenario: Closed by default
- **WHEN** the Goals drawer shows the family "implement feature" with `implement_feature` and `build_feature`
- **THEN** the row shows an expander, closed, and the two labels are not listed

#### Scenario: Expand
- **WHEN** the user selects the expander
- **THEN** both labels are listed with their counts, and the session list is not filtered

#### Scenario: One label
- **WHEN** a family holds one label
- **THEN** its row carries that label's name and no expander

### Requirement: Filter the sessions by family
Selecting the row of a family of two or more labels SHALL narrow the session list to the sessions that carry any of its labels, kept in the page URL as `goalf=<family key>` or `frf=<family key>`, with a chip such as "Friction family: buggy code". The client SHALL take the labels from the payload. A family of one label SHALL filter as `goal=` or `fr=`. A family key the view lacks SHALL show the empty state, not an error.

#### Scenario: A friction family
- **WHEN** the user selects the "buggy code" family, whose labels are `buggy_code` and `broken_build`
- **THEN** the URL gains `frf=buggy_code` and the list keeps sessions with either label

#### Scenario: Label inside a family
- **WHEN** the user expands the family and selects `broken_build`
- **THEN** the URL gains `fr=broken_build`, not `frf=`

#### Scenario: Family nobody has
- **WHEN** the user opens `/usage?view=judgments&goalf=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

### Requirement: Say that labels are grouped
The Friction and Goals sections SHALL say, behind their How measured toggletip, that similar labels are grouped into families by keyword, and that a family expands to the labels as `/insights` wrote them.

#### Scenario: Hint
- **WHEN** the Friction section is shown and the user activates its How measured toggletip
- **THEN** the toggletip says labels are grouped into families by keyword and expand to the labels as written

### Requirement: Name the top friction family in the lede
The lede SHALL name the friction family with the highest count when it holds two or more labels, and otherwise the most counted friction label as written.

#### Scenario: Family leads
- **WHEN** the top friction family is "tooling", with `environment` and `flaky_ci`
- **THEN** the lede says tooling caused the most friction

### Requirement: Keep the vitals to what the lede leaves out
The Insights vitals SHALL show the sessions fully or mostly achieved, partially achieved, not achieved and dissatisfied. They SHALL NOT show the number of analysed sessions, which the lede states.

#### Scenario: Vitals
- **WHEN** the lede says 117 of 150 analysed sessions fully achieved their goal
- **THEN** no vital shows 150 sessions analysed

### Requirement: Show the judgments as a view of Activity
The `/insights` judgments SHALL be the Judgments view of the Activity page, at `/usage?view=judgments`, not a page of their own: no navigation entry, and Activity's browser title. In the requirements of this capability, "the page" and "Insights" mean that view.

#### Scenario: Open the view
- **WHEN** the user opens `/usage?view=judgments`
- **THEN** Activity shows the judgments, the Activity tab is the current one, and the navigation has no Insights entry

### Requirement: Read the outcome trend one week at a time
The outcome trend SHALL be read by pointer or keyboard. Its chart SHALL be a focusable group whose name says what it shows, the weeks and the share fully or mostly achieved. Left and Right SHALL move between weeks, Home and End SHALL go to the first and the last, and Escape SHALL dismiss the readout; a key with Alt, Ctrl, Meta or Shift is left to the browser. The readout SHALL give the week, its sessions, and each outcome's count and share, in a tooltip and in a polite live region.

#### Scenario: Read a week
- **WHEN** the user focuses the chart and presses Right on a week of 12 sessions: 7 fully, 2 mostly, 2 partially, 1 not achieved
- **THEN** the readout says the week, "12 analysed sessions", and 7 fully achieved (58%), 2 mostly achieved (17%), 2 partially achieved (17%), 1 not achieved (8%)

#### Scenario: Escape
- **WHEN** the readout shows and the user presses Escape
- **THEN** the readout goes and focus stays on the chart

#### Scenario: Modified keys
- **WHEN** the chart has focus and the user presses Alt+Left or Ctrl+Home
- **THEN** the chart does not handle the key, so the browser goes back in history or to the page top

### Requirement: Mark a week with few sessions
A week with fewer than 5 analysed sessions SHALL be drawn at half width in its full colors, so each part keeps 3:1 against the surface. The legend SHALL name that mark when a week has it, and the week's readout and table row SHALL say it has few sessions. The trend's How measured toggletip SHALL say that every bar is 100% of its week, so the figure over a bar says how many sessions it stands on.

#### Scenario: A week of three sessions
- **WHEN** a week holds 3 analysed sessions
- **THEN** its bar is half as wide as the others and not faded, its readout says one session moves the bar a lot, and its table row marks it as few

#### Scenario: No such week
- **WHEN** every week holds 5 analysed sessions or more
- **THEN** every bar is full width and the legend names no such mark

### Requirement: Offer the outcome trend as a table
The trend panel SHALL offer its data as a table behind "Show data table", closed on every load: one row per week with its analysed sessions and, for each outcome, the count and the share of that week.

#### Scenario: Open the table
- **WHEN** the user selects "Show data table" under the trend
- **THEN** a table named "Analysed sessions by outcome per week" lists each week with its sessions and the count and share of each outcome

### Requirement: Show what the store measured on a session card
A session card SHALL show one line of figures measured from the session's stored transcript, over the whole session: its estimated cost, its peak context as a share of the model's window, and its failed tool calls. A figure the store does not know SHALL be left out, and a session with no transcript SHALL show no such line. A peak at 80% or more and a failed call SHALL be marked. The line SHALL be apart from the model's summary and SHALL NOT be tagged model-judged.

#### Scenario: A stored session
- **WHEN** a session cost $4.20, peaked at 62% of its window and had 1 failed tool call
- **THEN** its card shows "$4.20 · peak context 62% · 1 tool error"

#### Scenario: No transcript
- **WHEN** a facet's session has no transcript in the store
- **THEN** its card shows no such line

#### Scenario: No price
- **WHEN** no request of a session is priced
- **THEN** the line leaves the cost out and keeps the other figures

### Requirement: Weigh friction by cost and active time
Each friction family and label SHALL carry the estimated cost and active time of the sessions that reported it, each session counted once and whole, whatever the range. A session with no transcript SHALL add nothing; one with no price SHALL add its active time but no cost. The user SHALL weigh the Friction rows by Cost (the default), Active time or Reports, not kept in the URL: the pick SHALL order the rows and set each bar and value, with the other two weights and the sessions beside it.

#### Scenario: Cost first
- **WHEN** `wrong_approach` was reported twice by a session that cost $42, and `tooling` 9 times by four sessions that cost $6.50 together
- **THEN** with Cost, `wrong approach` is listed first with $42 and "1.5h · 2 reports · 1 session" beside it, then `tooling` with $6.50

#### Scenario: An unpriced session
- **WHEN** a session with no priced request and 20 active minutes reports `buggy_code`
- **THEN** it adds no cost to `buggy code` and adds its 20 minutes to the family's active time

#### Scenario: By reports
- **WHEN** the user picks Reports
- **THEN** `tooling` is listed first with 9, and each row still shows its cost, active time and sessions

#### Scenario: One session, two labels of a family
- **WHEN** one session reports two labels of one family
- **THEN** the family counts that session's cost and active time once

### Requirement: Say what a friction weight is
The Friction section's hint SHALL say the rows are weighed by the sessions that reported them. Behind its How measured toggletip it SHALL say that cost and active time are those of the whole sessions, not of the friction alone, that each session counts once in a row, that a session with no transcript adds nothing, and that one with no price adds no cost but its active time.

#### Scenario: Toggletip
- **WHEN** the user activates the Friction section's How measured toggletip
- **THEN** it says cost and active time are those of the whole sessions that reported a friction, not of the friction alone

### Requirement: Give each kind of breakdown one form
A breakdown where each analysed session has exactly one value on a short fixed scale (Outcomes, Claude's helpfulness, Session types) SHALL be one stacked bar with a row or key entry per value. A breakdown of open-ended names, where a session can count several times (Friction categories, Satisfaction signals, Goals, Languages), and the Coverage lists by project and by run SHALL be ranked or dated lists with one bar per row. Outcomes per week SHALL be the outcome trend.

#### Scenario: Forms on the page
- **WHEN** the view has analysed sessions across 2 or more weeks
- **THEN** Outcomes, Claude's helpfulness and Session types each show one stacked bar, Friction categories, Satisfaction, Goals, Languages and Coverage show one bar per row, and only the outcome trend has a time axis

#### Scenario: Friction keeps its weights
- **WHEN** the user picks Active time in Friction categories
- **THEN** the rows reorder and each row's bar and value follow the active time, as before this change

### Requirement: Draw a stacked bar of the analysed sessions
A stacked bar SHALL span all the view's analysed sessions: each value with a session takes a part as wide as its share, in the order of its rows, at least 3px wide, with 2px of surface between parts. A value with no session SHALL have no part and SHALL keep its row. Sessions with no value SHALL leave the end of the bar empty. Shares SHALL be of the analysed sessions, which are Claude Code sessions only.

#### Scenario: One session in 200
- **WHEN** the view holds 200 analysed sessions, one of them not achieved, on a phone 390px wide
- **THEN** the not-achieved part is at least 3px wide and stands apart from its neighbours

#### Scenario: A rating nobody got
- **WHEN** no session of the view is rated `slightly_helpful`
- **THEN** the bar has no part for it, and its row shows 0% (0)

#### Scenario: Sessions without a rating
- **WHEN** 148 of 150 analysed sessions have a helpfulness rating
- **THEN** the parts fill 148/150 of the bar and the rest of the track is empty

#### Scenario: A view with Codex sessions
- **WHEN** the view holds 40 analysed Claude Code sessions and 60 Codex sessions
- **THEN** each share is of the 40 analysed sessions, and no part stands for a Codex session

### Requirement: Color the parts of a scale
The Outcomes bar SHALL use the outcome trend's colors for the four outcomes, and one neutral color for unclear and for a value the page does not recognize. The helpfulness bar SHALL use two greens (essential, very helpful), amber (moderately helpful) and two reds (slightly helpful, unhelpful). Each color SHALL keep 3:1 against the panel surface in the light and the dark theme. Each row SHALL carry its part's color as a swatch beside its name, so a part is never told by color alone.

#### Scenario: Same colors as the trend
- **WHEN** the Outcomes bar and the outcome trend both show
- **THEN** fully, mostly, partially and not achieved have the same color in the bar, its rows' swatches and the trend's legend

#### Scenario: Same ends on both bars
- **WHEN** the Outcomes bar and the helpfulness bar both show
- **THEN** essential has the green of fully achieved, moderately helpful the amber of partially achieved, and unhelpful the red of not achieved

#### Scenario: Dark theme
- **WHEN** the page is in the dark theme
- **THEN** every part of both bars keeps at least 3:1 against the panel surface

#### Scenario: Two unknown values
- **WHEN** facets hold the outcomes `abandoned` and `blocked`
- **THEN** each has a neutral part and a row of its own, and the rows name them

#### Scenario: A value named like a built-in
- **WHEN** a facet holds the helpfulness rating `constructor`
- **THEN** its part and its swatch are the neutral color, as for any unknown value

### Requirement: Read a stacked bar from its rows
A stacked bar SHALL be hidden from assistive technology, and the rows or key under it SHALL be its text alternative: every value of the scale, in order, with its name, share and count as text. The bar SHALL offer no data table, and its parts SHALL NOT be controls: a filter is set from a row, a real button reached with Tab and pressed with Enter or Space. The bar and its rows SHALL handle no other key, so arrow, Home, End and modified keys stay the browser's.

#### Scenario: Screen reader
- **WHEN** a screen reader user moves through the Outcomes section of a view with 117 of 150 sessions fully achieved
- **THEN** they reach a list item reading "Fully achieved", 78% and 117, and nothing announces the bar

#### Scenario: Session types key
- **WHEN** the Session types drawer is open in a view of 150 analysed sessions, 109 of them multi task
- **THEN** the key entry reads multi task, 109 and 73%, so the share a part's tooltip gives is also in the text

#### Scenario: Filter by keyboard
- **WHEN** the user tabs to the "Partially achieved" row and presses Enter
- **THEN** the session list is narrowed to that outcome and the row exposes `aria-pressed="true"`

#### Scenario: Browser keys
- **WHEN** focus is on a row and the user presses Alt+Left
- **THEN** the page handles no key and the browser goes back in history

#### Scenario: Pointer on a part
- **WHEN** the user hovers a part of the bar
- **THEN** a tooltip names its value, count and share, and selecting the part filters nothing

### Requirement: Keep a stacked bar legible in forced colors
In a forced-colors mode each part of a stacked bar and each swatch SHALL keep its color and sit in a frame of the system text color, and the bar's track SHALL be framed too, so an empty end still shows. The row that is the active filter SHALL be outlined in the system highlight color.

#### Scenario: Forced colors
- **WHEN** the user turns on a forced-colors mode and opens a view with analysed sessions
- **THEN** the parts of the Outcomes, helpfulness and Session types bars are colored and framed, and the swatches match them

#### Scenario: Active row
- **WHEN** the outcome filter is "Not achieved" in a forced-colors mode
- **THEN** its row is outlined in the highlight color

### Requirement: Mark a stacked bar that stands on few sessions
When the view has fewer than 5 analysed sessions, the Outcomes and helpfulness sections SHALL each say that one session moves the bar a lot, in the words the outcome trend uses for a week with few sessions. The bar and the rows SHALL still show. When no analysed session of the view has a value, the section SHALL show its empty sentence and neither a bar nor rows.

#### Scenario: Three sessions
- **WHEN** the view holds 3 analysed sessions, 2 fully achieved and 1 not achieved
- **THEN** the bar shows two parts, the rows show 67% (2) and 33% (1), and the section says one session moves the bar a lot

#### Scenario: Five sessions
- **WHEN** the view holds 5 analysed sessions
- **THEN** neither section shows that note

#### Scenario: No rating at all
- **WHEN** no analysed session of the view has a helpfulness rating
- **THEN** the section says "No ratings in this view." and shows no bar and no rows

### Requirement: Fit the stacked bars to wide and narrow screens
On a page wider than 900px, Satisfaction and Claude's helpfulness SHALL sit side by side in their panel; at 900px or narrower they SHALL stack, satisfaction first. A stacked bar SHALL take the width of its column and its rows SHALL sit under it, with the name, share and count of a row on one line. The page SHALL NOT scroll sideways at 390px. On a page narrower than 20em, as a 390px phone at 200% zoom, a row's name SHALL take its own line, whole, over its share and count.

#### Scenario: Desktop
- **WHEN** the view shows at 1440 x 900
- **THEN** the Outcomes bar spans its column beside Friction categories, and Satisfaction and Claude's helpfulness share one row of their panel

#### Scenario: Exactly 900px
- **WHEN** the view shows at 900px wide
- **THEN** Satisfaction and Claude's helpfulness stack, as Outcomes and Friction categories do at that width

#### Scenario: Phone
- **WHEN** the view shows at 390px wide
- **THEN** each bar spans the panel, its rows sit under it, Satisfaction comes before Claude's helpfulness, and the page has no horizontal scroll

#### Scenario: Large text on a phone
- **WHEN** the view shows at 390px wide and 200% zoom
- **THEN** each row of the Outcomes and helpfulness bars shows its whole name on one line of its own, with its share and count under it, and no name is cut short

### Requirement: Keep the outcome trend's reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the outcome trend SHALL draw it and SHALL keep the week being read, with its tooltip, also when a week joins or leaves the trend. The polite status SHALL say nothing for such a redraw, except a week the keyboard is reading, said again, alone, when its words changed. The reading SHALL end when the project, the range, the source or the automated-sessions filter changes, and when the week read leaves the trend.

#### Scenario: Ingest while reading
- **WHEN** the user reads the week of Oct 19 with the arrow keys and an ingest changes nothing in that week
- **THEN** the week of Oct 19 is still read, with its tooltip, and the status does not repeat it

#### Scenario: The week read changes
- **WHEN** the user reads the newest week with the arrow keys and `/insights` analyses one more of its sessions
- **THEN** the tooltip shows the new figures and the status says the week again with them

#### Scenario: A week joins the trend
- **WHEN** the user reads the week of Oct 19 and an older week gains its first analysed session
- **THEN** the week of Oct 19 is still read, with its tooltip over its bar, and the status says nothing

#### Scenario: A new newest week
- **WHEN** the user reads the week of Oct 19 and the first session of a new week is analysed
- **THEN** the week of Oct 19 is still read

#### Scenario: Project change
- **WHEN** the pointer rests on a week and the project filter changes
- **THEN** the reading ends
