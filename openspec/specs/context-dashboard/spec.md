# context-dashboard Specification

## Purpose
The Context page: how much of the model's context window each project's sessions start with, how fast it grows, what fills it, what that costs, and what to do about it, for Claude Code and Codex sessions alike.

## Requirements

### Requirement: Filter the Context page by view
The Context page SHALL offer the shared filters (project, time range, source, include automated) and every figure, chart, table and tip on the page SHALL reflect them. A session is in the view when it has a request in the range, as Activity counts; its own figures (starting context, growth, compactions) SHALL be taken over the whole session. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: Narrow to one project
- **WHEN** the user selects project `foo` and the last 30 days on Context
- **THEN** every section and tip covers only `foo` sessions with a request in those 30 days

#### Scenario: Codex only
- **WHEN** the user picks Codex
- **THEN** every section shows Codex sessions alone and the URL records `source=codex`

### Requirement: Measure starting context from tokens
A session's starting context SHALL be the prompt tokens (input, cache read and both cache writes) of its first turn: its earliest main-thread request with at least 2,000 prompt tokens. A smaller main-thread request is a side request and SHALL NOT count as a turn. The page SHALL NOT read `CLAUDE.md`, `AGENTS.md`, `.mcp.json` or any other file to measure it.

#### Scenario: First request is a side request
- **WHEN** a session's main-thread requests are, in order, 300 prompt tokens, then 24,000, then 31,000
- **THEN** its starting context is 24,000 tokens and its first turn is the 24,000-token request

#### Scenario: Subagent requests
- **WHEN** a session's earliest request is a subagent's
- **THEN** that request is not the session's first turn

### Requirement: Show starting context per project
The page SHALL show, for the view and for each project in it, the median, the 10th percentile and the 90th percentile of starting context over the project's sessions, the median share of the model's window, and the number of sessions measured; and SHALL show the view's median starting context per week of session start with its 25th to 75th percentile. A project with no measured session SHALL show no figure, not zero.

#### Scenario: Two projects
- **WHEN** `foo` sessions start at 20,000, 24,000 and 70,000 tokens and `bar` sessions at 8,000 and 9,000
- **THEN** `foo` shows a median of 24,000 and `bar` a median of 8,500, each with its 10th and 90th percentile and its sessions count

#### Scenario: Window share
- **WHEN** a session starts at 50,000 tokens and its window resolves to 200,000
- **THEN** that session's share of the window is 25%

### Requirement: Draw the spread of starting context
The page SHALL draw each project's 10th to 90th percentile range with its median marked, every project on one token scale, with the 30,000-token threshold of the large-start tip marked on it. It SHALL chart the weekly medians with their band on a labelled token axis, with weeks placed by date, and SHALL mark a week with fewer than 3 sessions as resting on few sessions.

#### Scenario: Spread is visible
- **WHEN** `foo` has a 10th percentile of 20,800 and a 90th percentile of 60,800, and `bar` 8,100 and 8,900
- **THEN** `foo`'s range is drawn many times wider than `bar`'s on the same scale, and crosses the 30,000-token mark

#### Scenario: A week with few sessions
- **WHEN** one week holds 2 sessions and the next 40
- **THEN** both weeks are on the trend, and the first is marked as resting on few sessions

#### Scenario: A week with no session
- **WHEN** sessions started in the weeks of 2 and 16 November and none in the week of 9 November
- **THEN** the trend leaves a gap at 9 November and does not draw the two weeks as neighbours

### Requirement: Resolve a session's context window
A session's context window SHALL be the window its source stated (a Codex turn's `model_context_window`), else the `context` the price table gives the session's peak model, else unknown. Window shares SHALL be computed only for sessions with a known window, and the page SHALL say how many sessions in the view have one.

#### Scenario: Codex session
- **WHEN** a Codex session's turns stated a window of 258,400 and the price table has no window for its model
- **THEN** its window is 258,400

#### Scenario: Claude Code session
- **WHEN** a Claude Code session's peak model has `context` 1,000,000 in the price table
- **THEN** its window is 1,000,000

#### Scenario: Unknown window
- **WHEN** a session's source stated no window and its model has no `context` in the price table
- **THEN** its window is unknown, it takes no part in any share, and the view's count of sessions with a window leaves it out

### Requirement: Show how context grows
The page SHALL chart the median context (prompt tokens) at each turn index over the view's sessions with at least that many turns, up to turn 100 and only for indexes with at least 5 sessions, and the same curve for each of the five projects with the most sessions. It SHALL show the median tokens added per user prompt, for the view and per project, where a session's added tokens are the sum of the rises between consecutive turns (a fall, as after a compaction, adds nothing).

#### Scenario: Curve points need sessions
- **WHEN** 12 sessions have 10 or more turns and 3 sessions have 11 or more
- **THEN** the curve shows turn 10 and stops before turn 11

#### Scenario: Added per prompt
- **WHEN** a session's turns are at 20,000, 30,000, 45,000, then 25,000 after a compaction, then 32,000, over 2 prompts
- **THEN** its added tokens are 32,000 and its tokens added per prompt are 16,000

#### Scenario: Per-project growth without a compaction
- **WHEN** the view has two projects and no session compacted
- **THEN** the page still shows each project's tokens added per prompt

### Requirement: Read the growth chart by sessions, share and project
The growth chart SHALL show, at each turn index, how many sessions the point rests on. It SHALL offer the same curves as a share of each session's window, over the sessions with a known window, with the near-limit share of 80% marked; the token curves SHALL carry no limit mark. Selecting a project in the legend SHALL draw that project alone against the view, with its 25th to 75th percentile band, and selecting it again SHALL restore every project.

#### Scenario: Sessions left at a turn
- **WHEN** 60 sessions reach turn 5 and 7 reach turn 40
- **THEN** the chart shows 60 sessions at turn 5 and 7 at turn 40

#### Scenario: Share of the window
- **WHEN** the user switches the chart to share of the window, and a session with a 200,000-token window is at 150,000 tokens at turn 30
- **THEN** that session counts as 75% at turn 30, and sessions with no known window take no part in the share curve

#### Scenario: Isolate a project
- **WHEN** the user selects `foo` in the legend
- **THEN** the chart draws the view's curve and `foo`'s curve with `foo`'s band, and no other project

### Requirement: Show the way to the first compaction
For the view's sessions with a compaction, the page SHALL show how many there are, the median number of turns before the first compaction, and the median active minutes before it, where active time leaves out every pause over 20 minutes, as a session's duration does. It SHALL show the same per project.

#### Scenario: Session compacted after a pause
- **WHEN** a session makes 14 turns in 30 minutes, pauses for 3 hours, makes 6 turns in 10 minutes and then compacts
- **THEN** it counts 20 turns and 40 active minutes before its first compaction

#### Scenario: No compaction in the view
- **WHEN** no session in the view compacted
- **THEN** the section says so and shows no medians

### Requirement: Show peak fill by window size
The page SHALL group the view's sessions with a known window by that window and show, for each window, how many sessions peaked under 25%, 25 to 50%, 50 to 80%, 80 to 90% and at or over 90% of it. Each window SHALL be drawn as one bar whose segments are those groups as shares of the window's sessions, with each segment's count and share readable.

#### Scenario: Two window sizes
- **WHEN** the view holds 1,000,000-token sessions and 258,400-token sessions
- **THEN** each window shows its own five counts, and the counts of a window add up to its sessions

#### Scenario: Threshold is a segment edge
- **WHEN** a session peaks at 79% of its window and another at 81%
- **THEN** the first is in the 50 to 80% group and the second in the 80 to 90% group

#### Scenario: Windows compare by share
- **WHEN** 2 of 4 sessions with one window and 50 of 100 with another peaked under 25%
- **THEN** both windows draw that segment at half the bar's width

### Requirement: Drill from a peak-fill group to its sessions
Selecting a segment of a window's bar SHALL list the sessions in it, newest first, at most 20, and selecting a session SHALL open its session sheet. The list SHALL hold only sessions on the session map, which carries the 1,000 newest sessions with a measured start, a known window and a recorded peak. When the list shows fewer sessions than the segment counts, the page SHALL say how many it shows of how many, and that the list covers the sessions on the map.

#### Scenario: Drill into a segment
- **WHEN** the user selects the 80 to 90% segment of the 200,000-token window, which holds 3 sessions
- **THEN** the page lists those 3 sessions, and selecting one opens its session sheet with the page's filters kept

#### Scenario: Segment larger than the list
- **WHEN** the user selects a segment that holds 30 sessions, all on the map
- **THEN** the page lists the 20 newest

#### Scenario: Sessions off the map
- **WHEN** the user selects a segment that holds 5 sessions and only 3 are on the session map
- **THEN** the page lists those 3 and says it shows 3 of 5, because the list covers the sessions on the map

### Requirement: Show what fills context
The page SHALL show, over the view's main-thread tool calls with a known result size, the summed result size by tool and by MCP server, each with its calls, its median, 95th percentile and largest result and an estimated token count labelled as an estimate. The figures SHALL be shown once, in the largest contributors table, with no second table of the same rows. The results of calls made inside subagent transcripts SHALL be summed apart, as bytes that never entered the main thread's context.

#### Scenario: By tool
- **WHEN** 40 main-thread `Read` results total 2,000,000 bytes and 10 `Bash` results total 300,000
- **THEN** `Read` leads with 2,000,000 bytes and about 500,000 estimated tokens, and `Bash` follows

#### Scenario: Subagent results apart
- **WHEN** a session's subagent transcripts hold 5,000,000 bytes of tool results and its main thread 800,000
- **THEN** the main-thread figures count 800,000 bytes and the subagent figure 5,000,000

#### Scenario: One table
- **WHEN** the user opens the What fills context section
- **THEN** it shows the largest contributors table and no separate By tool or By MCP server table

### Requirement: Chart the largest contributors
The page SHALL chart the ten tools, or MCP servers, with the largest summed size, each beside the range from its median to its 95th percentile result, with its calls and its largest result, and SHALL fold the rest into one "Other" total. The total bars SHALL scale to the largest of the named rows; the Other row SHALL show its total with no bar. The main-thread and subagent totals SHALL be drawn as two parts of one bar.

#### Scenario: Many small or a few huge
- **WHEN** `Read` totals 2,000,000 bytes over 400 results with a 95th percentile of 12,000, and `Bash` totals 2,000,000 over 8 results with a 95th percentile of 900,000
- **THEN** the two tools show equal totals, and `Bash`'s range sits far above `Read`'s

#### Scenario: More than ten tools
- **WHEN** 14 tools have results with a known size
- **THEN** the chart shows the 10 with the largest totals and one "Other" row summing the remaining 4

#### Scenario: A long tail
- **WHEN** 30 small tools sum to more than the largest named tool
- **THEN** the largest named tool's bar is full, and the Other row has its total and no bar

### Requirement: Show and sort every contributor
A "Show all N" control SHALL list every tool, or MCP server, in the largest contributors table, with no Other row, and a second activation SHALL fold them again.

#### Scenario: Show all
- **WHEN** 14 tools have results with a known size and the user selects "Show all 14 tools"
- **THEN** the table lists all 14 and no Other row

### Requirement: Sort the contributors table
The Name, Calls, Total, Typical result and Largest columns SHALL sort the rows, the Typical result column by the median. The rows SHALL start ordered by total, largest first. Folded, the ten shown SHALL stay the ten with the largest totals whatever the sort: the sort orders them, and the Other row stays last. A column's scale SHALL sit in its header outside the sort button, so the button is named for the column alone.

#### Scenario: Sort by calls
- **WHEN** the user sorts the folded table by Calls
- **THEN** the ten largest tools by total are listed, the one with the most calls first, and the Other row is last

### Requirement: Estimate tokens from bytes
An estimated token count SHALL be the result size in bytes divided by 4, rounded down, and SHALL be labelled as an estimate wherever it is shown.

#### Scenario: Estimate shown
- **WHEN** a tool's results total 1,003 bytes
- **THEN** its estimated tokens read as about 250 and are marked as an estimate

### Requirement: List the largest tool results
The page SHALL list the 25 largest main-thread tool results in the view, each with its tool, MCP server when it has one, its input summary, its size, its estimated tokens, its time, its project and source, and its session, and selecting one SHALL open that session's sheet.

#### Scenario: Open a session from a result
- **WHEN** the user selects the largest result, a 900,000-byte `Bash` output in session `s7`
- **THEN** the session sheet for `s7` opens and the page keeps its filters

### Requirement: Show context cost
The page SHALL show, for the view and per project, the estimated cache-read cost, the cost of requests priced on the long-prompt tier with their count, the cache-hit ratio (cache read tokens over all prompt tokens), and the total estimated cost. Costs SHALL use the same prices and tier as the Cost page, and SHALL read as unknown, not zero, when no request is priced.

#### Scenario: Long-tier spend
- **WHEN** 30 of a project's requests were priced on the long-prompt tier for $12 of its $100
- **THEN** the project shows 30 long-tier requests at $12

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** the cost figures read as unknown

### Requirement: Find the sessions where caching broke
A cache break SHALL be a main-thread request, not the session's first turn, with at least 20,000 prompt tokens of which less than half were cache reads. Its cause SHALL be `model_switch` when its model differs from the previous main-thread request's, else `expired` when more than the cache lifetime passed since that request, else `other`. The page SHALL list the sessions with a break, most uncached tokens first, at most 25, each with its breaks by cause and the uncached tokens those breaks cost.

#### Scenario: Model switch
- **WHEN** a session's turn on model A reads 80,000 tokens from cache, and the next turn, 20 seconds later on model B, has 85,000 prompt tokens with 0 cache reads
- **THEN** the second turn is a cache break with cause `model_switch`

#### Scenario: Cache expired
- **WHEN** two consecutive turns of a Claude Code session on the same model are 12 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

#### Scenario: One-hour cache
- **WHEN** a turn writes its prompt to the 1-hour cache, and the next turn on the same model, 12 minutes later, has 60,000 prompt tokens with no cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Cache writes are uncached
- **WHEN** a break turn has 60,000 prompt tokens, 59,990 of them written to the cache and 10 plain input
- **THEN** the break counts 60,000 uncached tokens

#### Scenario: Small request
- **WHEN** a request has 9,000 prompt tokens and no cache reads
- **THEN** it is not a cache break

#### Scenario: More sessions than the list holds
- **WHEN** 40 sessions in the view have a cache break
- **THEN** the drawer lists the 25 with the most uncached tokens and says it shows 25 of 40

### Requirement: Cache lifetime of a break
A cache break's `expired` cause SHALL use the cache lifetime of its session's source: 1 hour when the previous request wrote to the 1-hour cache, else 30 minutes for a Codex session, else 5 minutes.

#### Scenario: Codex pause within its cache lifetime
- **WHEN** two consecutive turns of a Codex session on the same model are 10 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Codex cache expired
- **WHEN** two consecutive turns of a Codex session on the same model are 40 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

### Requirement: Give data-driven tips
The page SHALL show tips from a fixed set of rules, each with a severity, a title, its evidence figures, its advice and the sessions that match it. The rules and their thresholds SHALL be fixed in the app, not learned or generated. A tip SHALL be shown only when its rule fires on the view's data, and the page SHALL say when none fires. Tips SHALL show as compact cards side by side, never as full-width cards stacked one under another.

#### Scenario: Nothing fires
- **WHEN** no rule fires on the view
- **THEN** the tips section says that nothing stands out and lists no tip

#### Scenario: Rule fires
- **WHEN** a main-thread tool result in the view is 150,000 bytes
- **THEN** the large-results tip is shown with its evidence, advice and the session that holds the result

#### Scenario: Several tips
- **WHEN** three rules fire on a 1440-pixel-wide window
- **THEN** the three tips show as compact cards on one row

### Requirement: Order the tips
Tips SHALL be ordered by severity, critical before warning, and within a severity in the rules' fixed order.

#### Scenario: Two tips
- **WHEN** the large-start tip fires as a warning and the near-limit tip fires as critical
- **THEN** the near-limit tip is listed first

### Requirement: Tip about a large starting context
The large-start rule SHALL fire when a project in the view has a median starting context of at least 30,000 tokens. Its evidence SHALL name the 5 projects with the largest medians, their medians and their window shares, and count the others, and its advice SHALL say to trim `CLAUDE.md` or `AGENTS.md` and to review the MCP servers configured for the project.

#### Scenario: Rule fires
- **WHEN** project `foo` sessions start at a median of 42,000 tokens
- **THEN** the tip names `foo` with 42,000 tokens, and its matching sessions are `foo` sessions starting at 30,000 tokens or more

#### Scenario: Below the threshold
- **WHEN** every project's median starting context is under 30,000 tokens
- **THEN** the large-start tip is not shown

### Requirement: Name only the MCP servers the transcripts record
The large-start tip SHALL list the MCP servers called in the named projects in the view, with their call counts, fewest first, and SHALL say that servers configured but never called leave no trace in transcripts, so the list shows only the ones that were called.

#### Scenario: Honest about MCP servers
- **WHEN** the large-start tip is shown for a project whose sessions called `github` 40 times and `figma` twice
- **THEN** the tip lists `figma` (2) before `github` (40) and says that only MCP servers that were called can be listed

### Requirement: Tip about frequent compactions
The frequent-compactions rule SHALL fire when a session in the view compacted 3 or more times, as a warning, or critical when a session compacted 6 or more times. Its evidence SHALL give the number of such sessions and the median turns and active minutes before the first compaction, and its advice SHALL say to start a new session or `/clear` between tasks, and to `/compact` before the context fills.

#### Scenario: Three compactions
- **WHEN** one session in the view compacted 3 times and no session more
- **THEN** the tip is shown as a warning and that session matches it

### Requirement: Tip about sessions near the limit
The near-limit rule SHALL fire, as critical, when a session in the view peaked at 80% or more of its window. The window is the session's stated one (Codex), else the price table's for its model; Activity uses only the price table's window for the peak model. Its evidence SHALL give the count of such sessions and the highest share, and its advice SHALL say to start the next task in a new session.

#### Scenario: Session at 85%
- **WHEN** a session peaked at 85% of a 200,000 window
- **THEN** the tip is shown as critical and that session matches it

#### Scenario: Stated window
- **WHEN** a Codex session states a 258,400-token window and peaked at 90% of it
- **THEN** the tip counts it against the stated window, not the price table's

### Requirement: Tip about large tool results
The large-results rule SHALL fire when a main-thread tool result in the view is 100,000 bytes or more, as a warning, or critical at 400,000 bytes or more. Its evidence SHALL give the count of such results, their total estimated tokens and the tools and MCP servers that produced them. Its advice SHALL name a remedy per tool: `Read` with offset and limit, shell output through `head`, `tail` or `grep`, search tools with a result cap, and delegating bulk reading to a subagent.

#### Scenario: Large Bash output
- **WHEN** a 250,000-byte `Bash` result is in the view
- **THEN** the tip is shown as a warning, names `Bash` and advises piping shell output through `head`, `tail` or `grep`

### Requirement: Tip about cache breaks
The cache-breaks rule SHALL fire when a session in the view has 2 or more cache breaks. Its evidence SHALL give the sessions, the breaks by cause and the uncached tokens, and the view's cache-hit ratio. Its advice SHALL say to keep one model through a session when most breaks are model switches, to keep turns within the cache lifetime or accept the cost when most are expiries (5 minutes in Claude Code, 30 in Codex), and that the prompt changed before its cached part when most are `other`.

#### Scenario: Model switches
- **WHEN** a session has 3 cache breaks, 2 of them model switches
- **THEN** the tip is shown, counts 2 model switches, and advises keeping one model through a session

#### Scenario: Expiries
- **WHEN** most of the cache breaks of the sessions that fire the tip are expiries
- **THEN** the advice says to keep turns within the cache lifetime and names 5 minutes for Claude Code and 30 minutes for Codex

#### Scenario: Other causes
- **WHEN** most of the cache breaks of the sessions that fire the tip have cause `other`
- **THEN** the advice says something before the cached part of the prompt changed, such as the system prompt, the tool set or an edited earlier message

### Requirement: Tip about long-tier spend
The long-tier rule SHALL fire when the view's long-prompt-tier cost is at least $1 and at least 10% of the view's estimated cost. Its evidence SHALL give that cost, its share, the number of long-tier requests and the models' long-prompt thresholds, and its advice SHALL say to `/compact` or start a new session before the prompt crosses the threshold.

#### Scenario: Long tier at 20%
- **WHEN** the view costs $50 and $10 of it was priced on the long tier
- **THEN** the tip is shown with $10 and 20%

#### Scenario: Small long-tier spend
- **WHEN** the view's long-tier cost is $0.40
- **THEN** the tip is not shown

### Requirement: Drill from a tip to its sessions
Selecting a tip's sessions SHALL list the matching sessions, up to 20, newest first, with the number left out when there are more, each with its title, project, source and start time; selecting one SHALL open its session sheet. The open tip SHALL be kept in the URL with the shared filters, and browser Back SHALL close it.

#### Scenario: Open the sessions of a tip
- **WHEN** the user selects "25 sessions" on the near-limit tip
- **THEN** a list of the 20 newest matching sessions opens, says 5 more are left out, and the URL records the tip

#### Scenario: Open a session
- **WHEN** the user selects a session in the list
- **THEN** its session sheet opens over the Context page, and Back returns to the list

### Requirement: Say when the store needs a rebuild
When any tool call in the view has no result size, or any session in the view compacted without a recorded first compaction, the page SHALL say that the store holds sessions from before this version and that `ai-ledger rebuild`, with the app stopped, fills the missing figures. Figures over the known rows SHALL still be shown.

#### Scenario: Store before the rebuild
- **WHEN** 3,000 of the view's 4,000 tool calls have no result size
- **THEN** the page says 1,000 of 4,000 calls carry a size and names `ai-ledger rebuild`

#### Scenario: Rebuilt store
- **WHEN** every tool call in the view has a result size
- **THEN** no rebuild notice is shown

### Requirement: Offer the growth chart as a table
Under the growth chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per turn the chart draws: the turn, the view's median context, its 25th and 75th percentile, its sessions, and the median of each project drawn separately. The table SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the growth chart, which draws two projects
- **THEN** a table lists each turn with the median, percentiles and sessions, and a column of medians for each project, and the button reads "Hide data table"

#### Scenario: A project's curve has ended
- **WHEN** a project's curve stops at turn 3 and the table shows turn 5
- **THEN** that project's cell for turn 5 reads as a dash

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Offer the weekly start chart as a table
Under the chart of the median starting context per week, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per week: the week's start, the median tokens and the sessions. The table SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the weeks
- **WHEN** the user selects "Show data table" under the weekly chart
- **THEN** a table lists every week with its median start and sessions

### Requirement: Dismiss the growth chart's reading with Escape
The growth chart SHALL be a focusable group named for its contents, SHALL read a turn with the arrow keys, Home and End, and SHALL clear that reading when the user presses Escape or leaves it.

#### Scenario: Escape
- **WHEN** the user reads a turn with the right arrow key and presses Escape
- **THEN** the turn's readout is cleared and focus stays on the chart

### Requirement: Map the view's sessions
The page SHALL chart each of the view's sessions with a measured start, a known window and a recorded peak as one mark, placed by starting context and by peak share of the window, with the 30,000-token and 80% thresholds drawn. A compacted session's mark SHALL differ by more than colour. A mark SHALL give the session's details, and selecting it SHALL open the session's sheet. The chart SHALL show at most the 1,000 newest such sessions and SHALL say how many it shows of how many.

#### Scenario: Heavy start, full window
- **WHEN** a session starts at 60,000 tokens and peaks at 180,000 of a 200,000-token window
- **THEN** its mark sits right of the 30,000-token line and above the 80% line

#### Scenario: Open a session from the map
- **WHEN** the user selects the mark of session `s7`
- **THEN** the session sheet for `s7` opens and the page keeps its filters

#### Scenario: Unknown window
- **WHEN** a session has a measured start and no known window
- **THEN** it has no mark, and the count the chart states leaves it out

#### Scenario: More sessions than the chart shows
- **WHEN** the view has 3,412 sessions that qualify
- **THEN** the chart shows the 1,000 newest and says it shows 1,000 of 3,412

#### Scenario: Compacted session
- **WHEN** a session compacted twice
- **THEN** its mark differs in shape from a session that never compacted, and its details say 2 compactions

### Requirement: Show cache use over time
The page SHALL chart, per day of the view, or per week when the view's first request is more than 60 days old, the prompt tokens of the view's requests split into cache reads, cache writes and uncached input, with each bucket's cache-hit ratio and its cache breaks by cause. The buckets SHALL add up to the cache-hit ratio of the view's requests that carry a time. The chart SHALL say that a break's cause is inferred. Costs SHALL NOT be stacked in this chart.

#### Scenario: A day's ratio
- **WHEN** a day's requests read 900,000 tokens from the cache, wrote 60,000 and sent 40,000 uncached
- **THEN** that day shows three segments of those sizes and a cache-hit ratio of 90%

#### Scenario: Breaks by cause
- **WHEN** a day has 2 cache breaks from a model switch and 1 from an expired cache
- **THEN** that day shows 3 breaks, 2 as model switches and 1 as expired

#### Scenario: Long view
- **WHEN** the view's first request is 200 days old
- **THEN** the chart shows one bucket per week

#### Scenario: Day with no request
- **WHEN** the view has requests on 3 and 5 November and none on 4 November
- **THEN** the chart leaves 4 November empty and does not draw 3 and 5 November as neighbours

#### Scenario: Request with no time
- **WHEN** a request in the view carries no time
- **THEN** it is in no bucket, and it still counts in the Cost section's cache-hit ratio

### Requirement: Lead with the typical start
The Context lede SHALL state the view's median starting context and, when known, its median share of the window. The number of sessions that compacted SHALL show in the Growth vitals, as that many of the view's sessions, not in the lede.

#### Scenario: Lede and compactions
- **WHEN** the view's median start is 24,000 tokens, 12% of the window, and 9 of 40 sessions compacted
- **THEN** the lede states 24,000 tokens and 12% of its window, and the Growth vitals show 9 sessions compacted of 40
