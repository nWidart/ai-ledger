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
The navigation SHALL have no Project tab, and SHALL mark no tab as current on the Project page. The tabs SHALL keep the project, as on every page.

#### Scenario: Tab from the Project page
- **WHEN** the user views `foo` for the last 30 days on the Project page and clicks Cost
- **THEN** Cost opens filtered to `foo` and the last 30 days

### Requirement: Summarize the project
The page SHALL open with the project's estimated cost, sessions, tokens, cache-hit ratio, share of tokens from subagents, cost per commit with the commit count, errors per 100 tool calls and error loops, each equal to the same figure on the project sheet for the same view. When the project has sessions active now, the summary SHALL say how many and link to Live filtered to the project; with none it SHALL say nothing about Live.

#### Scenario: Same figures as the sheet
- **WHEN** the project sheet of `foo` over the last 30 days shows an estimated cost of $12.40 and 9 sessions
- **THEN** the Project page of `foo` over the last 30 days shows $12.40 and 9 sessions

#### Scenario: Sessions active now
- **WHEN** two sessions of `foo` are active
- **THEN** the summary reads "2 sessions active now" and the link opens Live showing only `foo`

### Requirement: Show the project's cost
The page SHALL show the project's change in estimated cost against the previous period, its cost per day over both periods, and its models ranked by estimated cost, as the project sheet and the Cost page show them. The all-time view SHALL show no change. The block SHALL link to Cost filtered to the project.

#### Scenario: Change against the previous period
- **WHEN** `foo` cost $8 in the previous 30 days and $12 in the last 30 days
- **THEN** the block shows $8, $12 and a change of +$4

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the block shows the models and no change

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
The page SHALL show how many of the project's Claude Code sessions `/insights` analysed, out of how many, the outcomes of the analysed sessions and the three most reported kinds of friction, marked as a model's judgment as on Insights. With no analysed session the block SHALL say so in one line. The block SHALL link to Insights filtered to the project.

#### Scenario: Analysed sessions
- **WHEN** 6 of the 10 Claude Code sessions of `foo` in the view are analysed
- **THEN** the block reads 6 of 10 analysed and shows their outcomes

#### Scenario: Nothing analysed
- **WHEN** no session of `foo` in the view is analysed
- **THEN** the block says no session is analysed and shows no outcome chart

### Requirement: Show the project's part of the plan limits
For each open limit window that lists the project among what used it, the page SHALL show the project's share of the window's counted use and its points when the window is calibrated. For each limit with a figure for the project, it SHALL show the project's commits per percentage point. The block SHALL link to Limits. When no window lists the project and no limit has a figure for it, the block SHALL be left out.

#### Scenario: Project in an open window
- **WHEN** the weekly window lists `foo` with 54% of its counted use
- **THEN** the block shows the weekly window with 54%

#### Scenario: Nothing to show
- **WHEN** no open window lists `foo` and no limit has commits per point for it
- **THEN** the page has no Limits block

### Requirement: Load each block on its own
Each block SHALL show as soon as its own data arrives. A block whose data fails to load SHALL say so with a Retry control, and the other blocks SHALL still show.

#### Scenario: One block fails
- **WHEN** the insights request fails and the others succeed
- **THEN** the Insights block shows an error with Retry and every other block shows its figures

### Requirement: Host the sheets on the Project page
The Project page SHALL host the session sheet and the tool, MCP server and skill sheets, kept in the URL as on Activity.

#### Scenario: Reload with a session open
- **WHEN** the user reloads `/project?project=foo&session=abc`
- **THEN** the Project page of `foo` shows with that session's sheet open

### Requirement: Reach the Project page from the project sheet and the navigation
The project sheet SHALL offer "Open project page", which opens the Project page for its project with the page's filters and closes the sheet. With a project filter set, the navigation's project chip SHALL show the name and a visible "Page" label as one link to the Project page with the same view, named "<project> project page", labelled on narrow screens too, and current on the Project page. Project names in tables SHALL keep opening the project sheet.

#### Scenario: From the sheet
- **WHEN** the user has the project sheet of `foo` open on Cost for the last 7 days and chooses "Open project page"
- **THEN** the Project page opens on `foo` for the last 7 days with no sheet open

#### Scenario: From the navigation
- **WHEN** the user views `foo` on Errors and follows the chip's Page control
- **THEN** the Project page opens on `foo` with the same range and source

#### Scenario: Name for assistive technology
- **WHEN** a screen-reader user lists the links of the navigation while `foo` is the project filter
- **THEN** one link reads "foo project page"

#### Scenario: Current page
- **WHEN** the user views `foo` on the Project page
- **THEN** the chip's link is marked as the current page and no tab is

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
