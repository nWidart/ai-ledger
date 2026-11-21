# project-page Specification

## Purpose

The Project page: one project across the dashboards, with its summary, cost, sessions, errors, context, session judgments and plan-limit share, each linked to its page, so how a project is doing can be read without visiting every page.

## Requirements

### Requirement: Show one project on a page of its own
The app SHALL show a Project page at `/project` for the project named by the shared project filter. The page SHALL have the shared time range, source and automated filters and the project picker, and every figure on it SHALL reflect them, except where a block says otherwise. Its heading SHALL be the project's name. Picking another project SHALL stay on the page and show that project.

#### Scenario: Open a project
- **WHEN** the user opens `/project?project=foo&range=7`
- **THEN** the page is headed `foo` and its figures cover `foo` over the last 7 days

#### Scenario: Pick another project
- **WHEN** the user views `foo` on the Project page and picks `bar` in the project picker
- **THEN** the page shows `bar` with the same range and source

#### Scenario: Project with no use in the view
- **WHEN** the user opens the Project page on `foo` for the last 7 days and `foo` has no request in them
- **THEN** the page keeps its heading and filters and says there is no use in this view

### Requirement: Leave the Project page when no project is named
The Project page SHALL NOT show without a project. Opening `/project` with no project, and clearing the project while on the page, SHALL open Activity with the range, source and automated filters kept, and Back SHALL NOT return to a Project page without a project.

#### Scenario: Open without a project
- **WHEN** the user opens `/project?range=7`
- **THEN** Activity opens for the last 7 days

#### Scenario: Clear the project on the page
- **WHEN** the user views `foo` on the Project page and clears the project filter
- **THEN** Activity opens with no project filter and the same range and source

### Requirement: Keep the Project page out of the tabs
The navigation SHALL have no Project tab, and SHALL mark no tab as current on the Project page. The tabs SHALL keep the project, as on every page. On narrow screens the page chooser SHALL read "Pages" on the Project page and mark no link in its list as current.

#### Scenario: Tab from the Project page
- **WHEN** the user views `foo` for the last 30 days on the Project page and clicks Cost
- **THEN** Cost opens filtered to `foo` and the last 30 days

#### Scenario: Page chooser on the Project page
- **WHEN** the user views `foo` on the Project page on a phone
- **THEN** the page chooser reads "Pages", and none of its links is marked current

### Requirement: Show the project's cost
The page SHALL show the project's change in estimated cost against the previous period, its cost per day over both periods, its models ranked by estimated cost, and its share of tokens beside its share of estimated cost for each token kind, as the Tokens and cache drawer of the Cost page shows them for the view. The all-time view SHALL show the estimated cost and no change. The block SHALL link to Cost filtered to the project.

#### Scenario: Change against the previous period
- **WHEN** `foo` cost $8 in the previous 30 days and $12 in the last 30 days
- **THEN** the block shows $8, $12 and a change of +$4

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the block shows the estimated cost, the models and the token share chart, and no change

#### Scenario: Tokens beside dollars
- **WHEN** cache reads are 66% of `foo`'s tokens and 5% of its estimated cost
- **THEN** the block's chart shows 66% of tokens beside 5% of estimated cost for Cache read

### Requirement: List the project's most expensive sessions
The page SHALL list the project's eight most expensive sessions in the view with their title, start, branch, active time and estimated cost. Selecting one SHALL open its session sheet over the page. The block SHALL link to Activity filtered to the project.

#### Scenario: Open a session
- **WHEN** the user selects a session in the list
- **THEN** its session sheet opens over the Project page and the URL names the session

### Requirement: Show the project's errors
The page SHALL show the project's failed tool calls and error rate, and its five most frequent error types with their count, rate and change against the previous period, each equal to the figure the Errors page shows by default for the project, range and source. A type SHALL link to Errors on that type, and the block SHALL link to Errors filtered to the project. The block SHALL say that it counts automated sessions when the page leaves them out.

#### Scenario: Top types
- **WHEN** `foo` has 40 failed calls in the last 30 days, 25 of them of the type "File not found"
- **THEN** the block lists "File not found" first with 25

#### Scenario: Follow a type
- **WHEN** the user follows the type "File not found" on the Project page of `foo` over the last 30 days
- **THEN** Errors opens on that type, filtered to `foo` and the last 30 days

#### Scenario: No errors
- **WHEN** `foo` has no failed call in the view
- **THEN** the block says there are no errors in this view and lists no type

### Requirement: Show the project's context use
The page SHALL show the project's median starting context and its share of the window, the tokens added per prompt, the turns to the first compaction and the sessions that came near the context limit, each equal to the figure Context and Activity show for the project. A figure the store cannot give SHALL read as not available. The block SHALL link to Context filtered to the project.

#### Scenario: Starting context
- **WHEN** Context shows a median starting context of 24,000 tokens for `foo` over the last 30 days
- **THEN** the Project page of `foo` over the last 30 days shows 24,000 tokens

### Requirement: Draw a typical session's window as a grid
The Context block SHALL open with a grid of 200 cells, ten rows of twenty, in the style of Claude Code's `/context`, each cell half a percent of the context window. It SHALL fill cells for the median starting context's share, then for the median peak's share less the starting share, and leave the rest free; a peak over the window SHALL fill the grid. When the start's or the peak's window share is not known, the block SHALL show no grid.

#### Scenario: Grid of a typical session
- **WHEN** the sessions of `foo` start with a median 12% of a 200k window and peak at a median 40%
- **THEN** the grid fills 24 cells as starting context, 56 cells as added by the peak, and leaves 120 cells free

#### Scenario: Unknown window
- **WHEN** no session of `foo` in the view has a known context window
- **THEN** the Context block shows its figures and no grid

### Requirement: Explain the context grid in a legend
Beside the grid a legend SHALL give each part's tokens and share of the window, and a heading SHALL name the most common window and the number of sessions measured. Without a context snapshot of the project, the legend SHALL say that the starting context holds the system prompt, tools, memory and first prompt together, since the transcripts do not split it.

#### Scenario: Legend of the parts
- **WHEN** the sessions of `foo` start with a median 24,000 tokens, 12% of a 200k window
- **THEN** the legend reads "Starting context 24k tokens (12%)" under the heading "Typical session · 200k window"

### Requirement: Show the project's session judgments
The page SHALL show how many of the project's Claude Code sessions `/insights` analysed, out of how many, their outcomes and the three most reported kinds of friction, marked as a model's judgment. With no analysed session the block SHALL say so in one line. It SHALL link to the Judgments view filtered to the project, as "Open in Judgments"; with the source on Codex alone, it SHALL say why there are no judgments in the link's place, as Activity's view switch does.

#### Scenario: Analysed sessions
- **WHEN** 6 of the 10 Claude Code sessions of `foo` in the view are analysed
- **THEN** the block reads 6 of 10 analysed and shows their outcomes

#### Scenario: Nothing analysed
- **WHEN** no session of `foo` in the view is analysed
- **THEN** the block says no session is analysed and shows no outcome chart

#### Scenario: Open in Judgments
- **WHEN** the user views `foo` for the last 7 days and selects the block's link
- **THEN** Activity's Judgments view opens at `/usage?project=foo&range=7&view=judgments`

#### Scenario: Codex only
- **WHEN** the user views `foo` with the source filter on Codex
- **THEN** the block has no "Open in Judgments" link, and says that Codex writes no facets

### Requirement: Show the project's part of the plan limits
For each open limit window that lists the project among what used it, the page SHALL show the project's share of the window's counted use and its points when the window is calibrated. For each limit with a figure for the project, it SHALL show the project's commits per percentage point. The block SHALL link to Limits. When no window lists the project and no limit has a figure for it, the block SHALL be left out.

#### Scenario: Project in an open window
- **WHEN** the weekly window lists `foo` with 54% of its counted use
- **THEN** the block shows the weekly window with 54%

#### Scenario: Nothing to show
- **WHEN** no open window lists `foo` and no limit has commits per point for it
- **THEN** the page has no Limits block

### Requirement: Load each block on its own
The page SHALL show its heading, filters and every block without waiting for any request. Each block SHALL show its own state: a loading line while its data is on the way, its figures once they arrive, an empty state when it has nothing to show, and an error with Retry when its request fails. A failed or slow request SHALL change only the blocks that read it. The Plan limits block SHALL stay out until it has something to show, and show its error when its request fails.

#### Scenario: One block fails
- **WHEN** the insights request fails and the others succeed
- **THEN** the Session judgments block shows an error with Retry and every other block shows its figures

#### Scenario: Usage fails
- **WHEN** the usage request fails and the others succeed
- **THEN** Activity, Cost and Sessions show errors with Retry, and Errors, Context and Plan limits show their figures

#### Scenario: Slow block
- **WHEN** the errors request has not answered
- **THEN** the Errors block says it is loading and the other blocks show their figures

#### Scenario: Empty block
- **WHEN** `foo` has no failed call in the view
- **THEN** the Errors block says there are no errors in this view

### Requirement: Say when the view has no use
The page SHALL say there is no use in the view only when the usage request has answered with no request for the project. That message SHALL sit above the blocks and SHALL NOT hide them: Activity, Cost and Sessions SHALL say they have no request in the view, and every other block SHALL show its own figures, empty state or error. With a snapshot, the Context block SHALL still show what it measured and offer Measure now, even with no grid to draw.

#### Scenario: Snapshot without a grid
- **WHEN** `foo` has a context snapshot and no session in the view, so the start's share of the window is unknown
- **THEN** the Context block shows no grid, and shows when the snapshot was measured, its categories' tokens and its largest items, with Measure now

#### Scenario: No use with a snapshot
- **WHEN** the usage request answers with no request for `foo` and `foo` has a context snapshot
- **THEN** the page says there is no use of `foo` in the view, Activity, Cost and Sessions say they have no request, and the Context block shows the snapshot and offers Measure now

#### Scenario: No use with a failed request
- **WHEN** the usage request answers with no request for `foo` and the errors request fails
- **THEN** the page says there is no use of `foo` in the view, and the Errors block shows its error with Retry

### Requirement: Mark each block busy on its own
The per-block states SHALL take the place of the app's page placeholder for data: once the page's code has loaded, the page SHALL NOT show the gray placeholder blocks while its data loads, and its content area SHALL NOT be `aria-busy`. Instead each block SHALL be `aria-busy` while a request it reads is under way. A block's loading line SHALL NOT be a live region.

#### Scenario: Slow usage request
- **WHEN** the usage request has not answered and the others have
- **THEN** Activity, Cost, Sessions and Context are `aria-busy`, Errors and Session judgments are not, the page's content area is not, and no loading line is announced

### Requirement: Keep and refresh each block's figures on its own
A block that shows figures SHALL keep them while its request refreshes and while a range, source or automated-filter change loads. A request a block reads, its own or one it reads a line from, that takes over 150 ms SHALL dim that block only. Picking another project SHALL drop the figures, so no block shows one project's figures under another's name. After Refresh, a filter change or a failed request, only blocks whose data changed SHALL fade in.

#### Scenario: Slow refresh
- **WHEN** the usage request refreshes and takes over 150 ms
- **THEN** Activity, Cost, Sessions and Context keep their figures dimmed until it answers, and the other blocks are not dimmed

#### Scenario: Range change
- **WHEN** the user changes the range from 30 to 7 days and the usage request for 7 days takes over 150 ms
- **THEN** the blocks that read usage keep their 30-day figures, dimmed, and no loading line replaces them

#### Scenario: Another project
- **WHEN** the user picks `bar` on the Project page of `foo` and `bar`'s usage request has not answered
- **THEN** the blocks that read usage say they are loading and show none of `foo`'s figures

#### Scenario: Refresh changes one payload
- **WHEN** a Refresh brings new usage figures and the same errors and insights
- **THEN** Activity, Cost and Sessions fade in, and Errors and Session judgments do not

### Requirement: Say how the Live request stands in Activity
While the Live request is on the way, the Activity block SHALL say it is checking for active sessions, in a line that is not a live region. When the Live request fails, the block SHALL say the sessions active now could not load, with a Retry control, and keep its figures. Neither state SHALL read as no active session. Retry SHALL leave focus on the line while the request runs.

#### Scenario: Live pending
- **WHEN** the usage request has answered and the Live request has not
- **THEN** the Activity block shows its figures and says it is checking for active sessions

#### Scenario: Live fails
- **WHEN** the live request fails and the usage request succeeds
- **THEN** the Activity block shows its figures and says the sessions active now could not load, with Retry

### Requirement: Host the sheets on the Project page
The Project page SHALL host the session sheet and the tool, MCP server and skill sheets, kept in the URL as on Activity.

#### Scenario: Reload with a session open
- **WHEN** the user reloads `/project?project=foo&session=abc`
- **THEN** the Project page of `foo` shows with that session's sheet open

### Requirement: Split the starting context by a context snapshot
When the project has a context snapshot, the grid SHALL split the starting cells in proportion to the snapshot's categories loaded before the first prompt, with the rest of the median start as "First prompt and other". The legend SHALL give each category's tokens, the snapshot's date and model, and the deferred tools' total without cells. When the categories exceed the median start, the cells SHALL be split among the categories alone and the legend SHALL say so.

#### Scenario: Split by a snapshot
- **WHEN** `foo` has a median start of 40,000 tokens and a snapshot with 4,000 tokens of system prompt, 12,000 of system tools and 4,000 of skills
- **THEN** the starting cells are split 10% system prompt, 30% system tools, 10% skills and 50% first prompt and other, and the legend gives the snapshot's date

#### Scenario: Snapshot larger than the median start
- **WHEN** `foo`'s snapshot categories total 50,000 tokens and its median start is 40,000
- **THEN** the starting cells are split among the categories alone and the legend says the snapshot is larger than the median start

### Requirement: List the largest overhead items
With a context snapshot, the Context block SHALL list the snapshot's five largest MCP servers, memory files and skills by tokens, each group only when it has items.

#### Scenario: Largest items
- **WHEN** `foo`'s snapshot has MCP tools of the server `gmail` totalling 30,000 tokens
- **THEN** the list of largest items names `gmail` with 30k tokens

### Requirement: Measure a project's context overhead
The Context block SHALL offer Measure now when the view has Claude Code sessions or the project already has a context snapshot. Measure now SHALL run `claude -p "/context"` in the folder of the project's latest Claude Code session that still exists, with the project's most used model, then ingest, and the block SHALL show the new snapshot.

#### Scenario: Measure a project
- **WHEN** the user chooses Measure now on the Project page of `foo`
- **THEN** `claude -p "/context"` runs in `foo`'s latest folder, and the grid splits the starting context by the new snapshot

#### Scenario: Snapshot without sessions in the view
- **WHEN** the Project page of `foo` has a context snapshot and the view holds no Claude Code session of `foo`
- **THEN** the Context block still offers Measure now

### Requirement: Choose the measured folder and model in the app
A request to measure SHALL name only the project, which SHALL be one the store knows. The app SHALL choose the folder and the model from the store and SHALL ignore any other value in the request. One run SHALL go at a time.

#### Scenario: Request names a folder
- **WHEN** a request to measure carries a folder or a model
- **THEN** the app ignores them and uses the folder and model it chose from the store

#### Scenario: Second request while one runs
- **WHEN** a measure request arrives while another run is going
- **THEN** the app refuses it and the first run continues

### Requirement: Say what measuring does and when it fails
Before the run the block SHALL say that Measure now starts the project's MCP servers and hooks like a new session and calls no model. When Claude Code is not found, the run fails or times out, or no folder of the project exists, the block SHALL say so and keep its figures.

#### Scenario: Claude Code not installed
- **WHEN** `claude` is not on the app's `PATH` and the user chooses Measure now
- **THEN** the block says Claude Code was not found and its figures stay

### Requirement: Reach the Project page from the project sheet and the filter row
The project sheet SHALL offer "Open project page", which opens the Project page for its project with the page's filters and closes the sheet. With a project filter set, every page but the Project page SHALL show a "Project page" link next to the project picker that opens the Project page with the same view, named "<project> project page", on narrow screens too. Project names in tables SHALL keep opening the project sheet.

#### Scenario: From the sheet
- **WHEN** the user has the project sheet of `foo` open on Cost for the last 7 days and chooses "Open project page"
- **THEN** the Project page opens on `foo` for the last 7 days with no sheet open

#### Scenario: From the filter row
- **WHEN** the user views `foo` on Errors for the last 7 days and follows "Project page" next to the picker
- **THEN** the Project page opens on `foo` with the same range and source

#### Scenario: Name for assistive technology
- **WHEN** a screen-reader user lists the links of the Errors page while `foo` is the project filter
- **THEN** one link reads "foo project page"

#### Scenario: On the Project page
- **WHEN** the user views `foo` on the Project page
- **THEN** the filter row shows no "Project page" link

#### Scenario: No project filter
- **WHEN** the user views Errors with no project filter
- **THEN** the filter row shows no "Project page" link

### Requirement: Clear the project from the filter row
With a project filter set, the filter row SHALL show a button next to the project picker, named "Clear project filter", that removes the project filter and keeps focus on the project picker. On the Project page it SHALL follow the rule for clearing the project there.

#### Scenario: Clear on Errors
- **WHEN** the user views `foo` on Errors for the last 7 days and activates "Clear project filter"
- **THEN** Errors shows every project for the last 7 days, and focus is on the project picker

#### Scenario: Clear on the Project page
- **WHEN** the user views `foo` on the Project page and activates "Clear project filter"
- **THEN** Activity opens with no project filter and the same range and source

### Requirement: Lay out the blocks in two columns
On wide screens the Project page SHALL show its blocks in two columns: Activity, Cost and Context on the left, and Errors, Plan limits, Sessions and Session judgments on the right, each in that order. On narrow screens it SHALL show them in one column in the same order, left column first. The heading and filters SHALL span the page above the columns. A block SHALL NOT repeat the project sheet's summary figures, except the Cost block's estimated cost.

#### Scenario: Wide screen
- **WHEN** the user opens the Project page on a screen wider than 60em
- **THEN** Activity, Cost and Context are in the left column and Errors, Plan limits, Sessions and Session judgments in the right

#### Scenario: Narrow screen
- **WHEN** the user opens the Project page on a phone
- **THEN** the blocks stack in one column, Activity first and Session judgments last

### Requirement: Show the project's activity
The page SHALL open its left column with an Activity block of the project's prompts, commits, active days, requests (with those from the main thread), median session, estimated cost per prompt, turns per prompt and interrupted prompts, each equal to the Activity dashboard's figure for the view, or not available. With sessions active now, the block SHALL say how many and link to Live filtered to the project. The block SHALL link to Activity filtered to the project.

#### Scenario: Figures of the view
- **WHEN** `foo` has 120 prompts and 9 commits over the last 30 days
- **THEN** the Activity block shows 120 prompts and 9 commits

#### Scenario: Sessions active now
- **WHEN** two sessions of `foo` are active
- **THEN** the Activity block reads "2 sessions active now" and the link opens Live showing only `foo`
