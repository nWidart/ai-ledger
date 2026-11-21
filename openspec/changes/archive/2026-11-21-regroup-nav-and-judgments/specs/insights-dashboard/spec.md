## ADDED Requirements

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

## RENAMED Requirements

- FROM: `### Requirement: Order the page`
- TO: `### Requirement: Order the Judgments view`
- FROM: `### Requirement: Index the page's sections`
- TO: `### Requirement: Index the Judgments view's sections`
- FROM: `### Requirement: Keep the drill-down filters in the page URL`
- TO: `### Requirement: Keep the drill-down filters in the URL`

## MODIFIED Requirements

### Requirement: Filter by project, range, source and automated sessions
The Judgments view SHALL offer the shared project, time range and automated-session filters, in the header beside the heading, and no source filter: every figure is of Claude Code sessions, and the view SHALL ask the app for every source whatever the URL's source. Every figure and list SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

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

### Requirement: Show friction categories
The page SHALL list friction families with the number of sessions that reported any of their labels, heaviest first under the chosen weight: the cost or the active time of those sessions, or the total count over the view's facets. A family of one label SHALL show that label as written.

#### Scenario: Friction ranking
- **WHEN** 9 sessions report `wrong_approach` 14 times and 4 sessions report `buggy_code` 5 times, no other label shares a family with them, and the user weighs by Reports
- **THEN** `wrong_approach` is listed first with 14 in 9 sessions, then `buggy_code` with 5 in 4 sessions

#### Scenario: No friction
- **WHEN** no facet in the view reports friction
- **THEN** the section says no friction was reported, instead of an empty table

### Requirement: Link analysed sessions to their sheets
Each session in the store SHALL link to its session sheet, which opens over the Judgments view. The view's project, range, source, automated filter and its own filters SHALL stay as they were under the sheet and after it closes. The link's address SHALL name the view, so a new tab opens the same.

#### Scenario: Open a session
- **WHEN** the user views project `foo` for the last 7 days and clicks a session in the list
- **THEN** that session's sheet opens over the Judgments view, and the view still shows project `foo` for the last 7 days

#### Scenario: Session missing from the store
- **WHEN** a facet's session has no transcript in the store
- **THEN** the session is listed with its summary and no link

### Requirement: Treat Codex sessions as not analysed
Codex sessions SHALL never count in a facet figure, and the view SHALL show no line that counts them. Activity SHALL NOT show the Judgments view for a Codex-only view: it shows Overview, with the reason on its view switch. The sub line's How measured toggletip SHALL say that `/insights` judges Claude Code sessions only, so the view has no source filter.

#### Scenario: Source All
- **WHEN** the view holds 400 Claude Code and 60 Codex sessions
- **THEN** the coverage line counts the 400 Claude Code sessions, and no line names the Codex sessions

#### Scenario: Source Codex
- **WHEN** the URL names `source=codex` and `view=judgments`
- **THEN** Activity shows Overview, and no page says that `/insights` analyses only Claude Code sessions in place of figures

### Requirement: Say how sessions are counted
The Judgments view SHALL say, behind the sub line's How measured toggletip, that it counts a session by its start time, and that Overview counts a session with a request in the range, so the two totals can differ slightly.

#### Scenario: Subtitle names the counting rule
- **WHEN** the user opens the Judgments view with a view that has facets and activates the sub line's How measured toggletip
- **THEN** the toggletip says a session counts by its start time and that Overview counts a session with a request in the range

### Requirement: Order the Judgments view
When the view has analysed sessions, the Judgments view SHALL show, in this order: Activity's view switch, the lede with the filters beside it, its sub line, the coverage note, the section index, the vitals, one row holding Outcomes and Friction categories, the Trend panel when it is shown, Satisfaction and helpfulness, the analysed sessions, then the drawers: Goals, Session types, Session figures, Coverage and How this works. Each drawer SHALL be closed by default.

#### Scenario: Order with figures
- **WHEN** the view holds analysed sessions across 2 or more weeks
- **THEN** the sections read in the order Outcomes, Friction categories, Outcome trend, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, Session figures, Coverage, How this works, and the drawers are closed

#### Scenario: Order without a trend
- **WHEN** the view holds analysed sessions from one week only
- **THEN** the Trend panel is left out and the other sections keep their order

### Requirement: Index the Judgments view's sections
With analysed sessions, the Judgments view SHALL show a section index after the coverage note: Summary, Outcomes, Friction, Trend when shown, Satisfaction, Sessions, then the drawers. With none, it SHALL list Summary and the drawers it has: Session figures for session-meta rows in the view, How this works for facets in the store. An empty store, with no facet and no session-meta row, SHALL show no index. Choosing a drawer SHALL open it and scroll to it. No entry SHALL be named Overview.

#### Scenario: Jump to a drawer
- **WHEN** the user chooses Goals in the section index
- **THEN** the Goals drawer opens and scrolls into view

#### Scenario: No figures
- **WHEN** the store holds no facet and no session-meta row
- **THEN** no section index is shown

#### Scenario: No analysed sessions
- **WHEN** the store has facets, and the view has no facet and no session-meta row
- **THEN** the index lists Summary and How this works only

#### Scenario: Session figures but no judgments
- **WHEN** the store has facets, and the filtered view has session-meta rows but no facet
- **THEN** the index lists Summary, Session figures and How this works

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

### Requirement: Show session figures only when counted
The drawer SHALL appear, and be listed in the section index, only when the view has a session-meta row. It SHALL appear in a view with no analysed session. For source Codex the app SHALL send empty figures.

#### Scenario: Codex
- **WHEN** the app is asked for the judgments of source Codex
- **THEN** the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet
- **THEN** the drawer is shown beside the How this works drawer

### Requirement: Count a family from its labels
A family's count SHALL be the sum of its labels' counts. Its sessions SHALL be the distinct sessions of the view with any of its labels, never the sum of its labels' sessions; a friction family's cost and active time SHALL be summed over those sessions. The payload SHALL order labels by count, then name, and families by count, then sessions, then key; on screen the Friction rows follow the selected weight. The raw goal and friction lists SHALL stay in the payload.

#### Scenario: One session, two labels of a family
- **WHEN** one session reports `create_pull_request` 2 times and `open_pr` once, and no other session does
- **THEN** the family "pull request" counts 3 in 1 session

#### Scenario: Empty view
- **WHEN** the view has no goal
- **THEN** the goal families are empty

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
