# insights-dashboard Specification

## Purpose
The Insights page: shows, per project and time range, how Claude Code's `/insights` judged the analysed sessions (outcome, satisfaction, helpfulness, friction, goals and session types), lists those sessions, and says how much of the view is not analysed yet.

## Requirements

### Requirement: Filter by project, range, source and automated sessions
The Insights page SHALL offer the shared project, time range, source and automated-session filters. Every figure and list on the page SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: One project
- **WHEN** the user opens `/insights#project=ai-ledger&range=30`
- **THEN** every figure counts only facets of `ai-ledger` sessions that started in the last 30 days

#### Scenario: Switch from Activity
- **WHEN** the user views project `foo` for the last 14 days on Activity and clicks Insights
- **THEN** Insights opens filtered to `foo` and the last 14 days

#### Scenario: Automated sessions left out
- **WHEN** the automated control is off and `observer-sessions` has facets
- **THEN** those facets count nowhere on the page

### Requirement: Label facet figures as model-judged
Every figure that comes from a facet SHALL be marked as a model's judgment, not a measurement, in visible text next to it and in the page heading.

#### Scenario: Outcome section
- **WHEN** the outcome section is shown
- **THEN** it says that the outcomes are judged by a model from the transcript

### Requirement: Show outcome rates
The page SHALL show the share and count of analysed sessions in the view for each outcome: fully achieved, mostly achieved, partially achieved, not achieved, and unclear. An outcome value it does not recognize SHALL be shown under its raw name, not dropped.

#### Scenario: Outcome mix
- **WHEN** the view holds 150 facets: 117 fully, 24 mostly, 7 partially, 1 not achieved and 1 unclear
- **THEN** the page shows fully achieved at 78% (117), mostly at 16% (24), partially at 5% (7), not achieved at 1% (1) and unclear at 1% (1)

#### Scenario: Unknown outcome
- **WHEN** a facet has outcome `abandoned`
- **THEN** the page shows a row named `abandoned` with its count

### Requirement: Show satisfaction and helpfulness
The page SHALL show the user satisfaction signals summed over the view's facets, per signal (for example satisfied, likely satisfied, dissatisfied, unclear), and the count of sessions per helpfulness rating, from essential to unhelpful.

#### Scenario: Satisfaction signals
- **WHEN** one facet counts 2 `likely_satisfied` and 1 `dissatisfied`, and another counts 1 `satisfied`
- **THEN** the page shows likely satisfied 2, dissatisfied 1 and satisfied 1

#### Scenario: Helpfulness ratings
- **WHEN** the view holds 111 `very_helpful`, 26 `essential` and 11 `moderately_helpful` facets
- **THEN** the page lists essential 26, very helpful 111 and moderately helpful 11, in that order

### Requirement: Show friction categories
The page SHALL list friction families by total count over the view's facets, with the number of sessions that reported any of their labels, most frequent first. A family of one label SHALL show that label as written.

#### Scenario: Friction ranking
- **WHEN** 9 sessions report `wrong_approach` 14 times and 4 sessions report `buggy_code` 5 times, and no other label shares a family with them
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
Each session in the store SHALL link to its session sheet on Activity, in the view's project, range, source and automated filter.

#### Scenario: Open a session
- **WHEN** the user views project `foo` for the last 7 days and clicks a session in the list
- **THEN** Activity opens on project `foo` for the last 7 days with that session's sheet

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
Codex sessions SHALL never count in a facet figure. With source All, the coverage line SHALL count Codex sessions apart from Claude Code sessions as not analysed by `/insights`. With source Codex, the page SHALL say that `/insights` analyses only Claude Code sessions, and show no figures.

#### Scenario: Source All
- **WHEN** the view holds 400 Claude Code and 60 Codex sessions
- **THEN** the coverage line counts the 400 Claude Code sessions and separately says 60 Codex sessions are not analysed by `/insights`

#### Scenario: Source Codex
- **WHEN** the user picks Codex on Insights
- **THEN** the page says `/insights` analyses only Claude Code sessions and shows no outcome, friction or session figures

### Requirement: Read only the local store
The Insights page SHALL read its data from the store through the app, and SHALL NOT call a model, run `claude`, or read the usage-data directory itself.

#### Scenario: Usage data deleted
- **WHEN** the usage-data directory is deleted while the app runs
- **THEN** the page shows the same figures as before

### Requirement: Say how sessions are counted
The Insights page SHALL say that it counts a session by its start time, and that Activity counts a session with a request in the range, so the two totals can differ slightly.

#### Scenario: Subtitle names the counting rule
- **WHEN** the user opens Insights with a view that has facets
- **THEN** the subtitle says a session counts by its start time and that Activity counts a session with a request in the range

### Requirement: Order the page
When the view has analysed sessions, the Insights page SHALL show, in this order: the coverage note, the lede and its sub line, the vitals, one row holding Outcomes and Friction categories, Satisfaction and helpfulness, the analysed sessions, then Goals and Session types. Goals and Session types SHALL each be a drawer, closed by default.

#### Scenario: Order with figures
- **WHEN** the view holds analysed sessions
- **THEN** the sections read in the order Outcomes, Friction categories, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, and Goals and Session types are closed

### Requirement: Index the page's sections
The Insights page SHALL show a section index after the sub line when the view has analysed sessions: Overview, Outcomes, Friction, Satisfaction and Sessions, then the drawers. Without analysed sessions, it SHALL show one only for How this works. Choosing a drawer SHALL open it and scroll to it. It SHALL NOT be shown for source Codex or an empty store.

#### Scenario: Jump to a drawer
- **WHEN** the user chooses Goals in the section index
- **THEN** the Goals drawer opens and scrolls into view

#### Scenario: No figures
- **WHEN** the source is Codex
- **THEN** no section index is shown

#### Scenario: No analysed sessions
- **WHEN** the store has facets but the view has no analysed session
- **THEN** the index lists Overview and How this works only

### Requirement: Sort analysed sessions
The page SHALL let the user order the listed sessions by Newest (the default), Oldest or Outcome. Outcome SHALL put the worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved, and sessions with the same outcome newest first. The choice SHALL last for the page visit, also across a view with no list, and SHALL NOT be kept in the page URL. The list's description SHALL say the order in words.

#### Scenario: Oldest first
- **WHEN** the user picks Oldest
- **THEN** the sessions are listed from the oldest start time to the newest

#### Scenario: Worst outcome first
- **WHEN** the user picks Outcome
- **THEN** sessions that did not achieve their goal come first, fully achieved ones last, and two sessions with one outcome keep newest first

#### Scenario: Another source and back
- **WHEN** the user picks Oldest, switches the source to Codex and back to Claude Code
- **THEN** the list is still ordered oldest first

### Requirement: Filter analysed sessions by outcome
The page SHALL let the user narrow the listed sessions to one outcome with a select of All outcomes and each outcome that has sessions in the view, shown by its label, kept in sync with the `outcome=<outcome name>` URL key and the outcome row and badge filters. It SHALL combine with the other filters and change the "N of M sessions" count. An outcome in the URL that no session has SHALL show an empty state, not an error; the select SHALL still name it.

#### Scenario: One outcome
- **WHEN** the user picks "Partially achieved"
- **THEN** the URL gains `outcome=partially_achieved` and only sessions with that outcome are listed, the list saying "N of M sessions"

#### Scenario: From the URL
- **WHEN** the user opens `/insights#outcome=not_achieved&friction=1`
- **THEN** the outcome select shows "Not achieved", the friction box is checked, and only sessions with both are listed

#### Scenario: Outcome nobody has
- **WHEN** the user opens `/insights#outcome=gone`
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
The page SHALL offer a closed "How this works" drawer whenever the store has facets and the source is not Codex, even when the view has no analysed session. It SHALL say what `/insights` is, that the app only reads its files and never calls a model, the directory read, and how to get more coverage.

#### Scenario: Drawer text
- **WHEN** the user opens the drawer
- **THEN** it names `/insights` as a Claude Code command, shows the directory in code, and says to run `/insights` again, then Refresh

#### Scenario: Codex source
- **WHEN** the source is Codex
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
The page SHALL show a panel, tagged model-judged, under the outcome and friction row. It lists each week, by the analysed session's start, with the share fully or mostly achieved and "A of N" as text. Weeks without a session are left out; at most the newest 26 weeks are shown.

#### Scenario: Weekly share
- **WHEN** a week holds 5 analysed sessions, 4 of them fully or mostly achieved
- **THEN** its row reads 80% with "4 of 5"

#### Scenario: Sessions without a start time
- **WHEN** an analysed session has no start time
- **THEN** it counts in no week

### Requirement: Hide a trend of fewer than two weeks
The trend panel SHALL be shown only when the view's analysed sessions span 2 or more weeks. Its hint SHALL say that weeks are by session start and that a week with few sessions swings.

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

### Requirement: Keep the drill-down filters in the page URL
The drill-down filters SHALL be kept in the page URL as `outcome=`, `help=`, `goal=` and `fr=`, one raw category name each, and `goalf=` and `frf=`, one family key each. Setting one SHALL add a history entry, so Back undoes it. All active filters, `friction=1` included, SHALL combine with AND and SHALL change the "N of M sessions" count. They SHALL survive a change of project, range, source or automated sessions and SHALL NOT be cleared by one.

#### Scenario: Combined filters
- **WHEN** the user opens `/insights#fr=buggy_code&goal=fix_bug`
- **THEN** only sessions with both are listed, and a project, range or source in the URL is left as it is by changing a filter

#### Scenario: Value nobody has
- **WHEN** the user opens `/insights#goal=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

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
The drawer SHALL appear, and be listed in the section index, only when the source is not Codex and the view has a session-meta row. It SHALL appear in a view with no analysed session. With source Codex the figures SHALL be empty.

#### Scenario: Codex
- **WHEN** the source filter is Codex
- **THEN** the drawer is not shown and the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet
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
A family's count SHALL be the sum of its labels' counts. Its sessions SHALL be the distinct sessions of the view that carry any of its labels, never the sum of its labels' sessions. Labels SHALL be ordered most counted first, then by name; families by count, then sessions, then key. The raw goal and friction lists SHALL stay in the payload.

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
- **WHEN** the user opens `/insights#goalf=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

### Requirement: Say that labels are grouped
The Friction and Goals sections SHALL say that similar labels are grouped into families by keyword, and that a family expands to the labels as `/insights` wrote them. They SHALL stay tagged as model-judged.

#### Scenario: Hint
- **WHEN** the Friction section is shown
- **THEN** its hint says labels are grouped into families by keyword and expand to the labels as written

### Requirement: Name the top friction family in the lede
The lede SHALL name the friction family with the highest count when it holds two or more labels, and otherwise the most counted friction label as written.

#### Scenario: Family leads
- **WHEN** the top friction family is "tooling", with `environment` and `flaky_ci`
- **THEN** the lede says tooling caused the most friction
