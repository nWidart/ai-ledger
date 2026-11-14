# Spec Delta

## Purpose

The Context page: how much of the model's context window each project's sessions start with, how fast it grows, what fills it, what that costs, and what to do about it, for Claude Code and Codex sessions alike.

## ADDED Requirements

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
The page SHALL show, for the view and for each project in it, the median and the 10th percentile of starting context over the project's sessions, the median share of the model's window, and the number of sessions measured; and SHALL show the view's median starting context per week of session start. A project with no measured session SHALL show no figure, not zero.

#### Scenario: Two projects
- **WHEN** `foo` sessions start at 20,000, 24,000 and 70,000 tokens and `bar` sessions at 8,000 and 9,000
- **THEN** `foo` shows a median of 24,000 and `bar` a median of 8,500, each with its 10th percentile and its sessions count

#### Scenario: Window share
- **WHEN** a session starts at 50,000 tokens and its window resolves to 200,000
- **THEN** that session's share of the window is 25%

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
The page SHALL chart the median context (prompt tokens) at each turn index over the view's sessions with at least that many turns, up to turn 100 and only for indexes with at least 5 sessions, and the same curve for each of the five projects with the most sessions. It SHALL show the median tokens added per user prompt, where a session's added tokens are the sum of the rises between consecutive turns (a fall, as after a compaction, adds nothing).

#### Scenario: Curve points need sessions
- **WHEN** 12 sessions have 10 or more turns and 3 sessions have 11 or more
- **THEN** the curve shows turn 10 and stops before turn 11

#### Scenario: Added per prompt
- **WHEN** a session's turns are at 20,000, 30,000, 45,000, then 25,000 after a compaction, then 32,000, over 2 prompts
- **THEN** its added tokens are 32,000 and its tokens added per prompt are 16,000

### Requirement: Show the way to the first compaction
For the view's sessions with a compaction, the page SHALL show how many there are, the median number of turns before the first compaction, and the median active minutes before it, where active time leaves out every pause over 20 minutes, as a session's duration does. It SHALL show the same per project.

#### Scenario: Session compacted after a pause
- **WHEN** a session makes 14 turns in 30 minutes, pauses for 3 hours, makes 6 turns in 10 minutes and then compacts
- **THEN** it counts 20 turns and 40 active minutes before its first compaction

#### Scenario: No compaction in the view
- **WHEN** no session in the view compacted
- **THEN** the section says so and shows no medians

### Requirement: Show peak fill by window size
The page SHALL group the view's sessions with a known window by that window and show, for each window, how many sessions peaked under 25%, 25 to 50%, 50 to 75%, 75 to 90% and at or over 90% of it.

#### Scenario: Two window sizes
- **WHEN** the view holds 1,000,000-token sessions and 258,400-token sessions
- **THEN** each window shows its own five counts, and the counts of a window add up to its sessions

### Requirement: Show what fills context
The page SHALL show, over the view's main-thread tool calls with a known result size, the summed result size by tool and by MCP server, each with its calls, its median and largest result and an estimated token count labelled as an estimate. The results of calls made inside subagent transcripts SHALL be summed apart, as bytes that never entered the main thread's context.

#### Scenario: By tool
- **WHEN** 40 main-thread `Read` results total 2,000,000 bytes and 10 `Bash` results total 300,000
- **THEN** `Read` leads with 2,000,000 bytes and about 500,000 estimated tokens, and `Bash` follows

#### Scenario: Subagent results apart
- **WHEN** a session's subagent transcripts hold 5,000,000 bytes of tool results and its main thread 800,000
- **THEN** the main-thread figures count 800,000 bytes and the subagent figure 5,000,000

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
A cache break SHALL be a main-thread request, not the session's first turn, with at least 20,000 prompt tokens of which less than half were cache reads. Its cause SHALL be `model_switch` when its model differs from the previous main-thread request's, else `expired` when more than 5 minutes passed since that request, else `other`. The page SHALL list the sessions with a break, most uncached tokens first, each with its breaks by cause and the uncached tokens those breaks cost.

#### Scenario: Model switch
- **WHEN** a session's turn on model A reads 80,000 tokens from cache, and the next turn, 20 seconds later on model B, has 85,000 prompt tokens with 0 cache reads
- **THEN** the second turn is a cache break with cause `model_switch`

#### Scenario: Cache expired
- **WHEN** two consecutive turns on the same model are 12 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
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

### Requirement: Give data-driven tips
The page SHALL show tips from a fixed set of rules, each with a severity, a title, its evidence figures, its advice and the sessions that match it. The rules and their thresholds SHALL be fixed in the app, not learned or generated. A tip SHALL be shown only when its rule fires on the view's data, and the page SHALL say when none fires.

#### Scenario: Nothing fires
- **WHEN** no rule fires on the view
- **THEN** the tips section says that nothing stands out and lists no tip

#### Scenario: Rule fires
- **WHEN** a main-thread tool result in the view is 150,000 bytes
- **THEN** the large-results tip is shown with its evidence, advice and the session that holds the result

### Requirement: Order the tips
Tips SHALL be ordered by severity, critical before warning, and within a severity in the rules' fixed order.

#### Scenario: Two tips
- **WHEN** the large-start tip fires as a warning and the near-limit tip fires as critical
- **THEN** the near-limit tip is listed first

### Requirement: Tip about a large starting context
The large-start rule SHALL fire when a project in the view has a median starting context of at least 30,000 tokens. Its evidence SHALL name the projects, their medians and their window shares, and its advice SHALL say to trim `CLAUDE.md` or `AGENTS.md` and to review the MCP servers configured for the project.

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
The near-limit rule SHALL fire, as critical, when a session in the view peaked at 80% or more of its window, the threshold Activity uses. Its evidence SHALL give the count of such sessions and the highest share, and its advice SHALL say to start the next task in a new session.

#### Scenario: Session at 85%
- **WHEN** a session peaked at 85% of a 200,000 window
- **THEN** the tip is shown as critical and that session matches it

### Requirement: Tip about large tool results
The large-results rule SHALL fire when a main-thread tool result in the view is 100,000 bytes or more, as a warning, or critical at 400,000 bytes or more. Its evidence SHALL give the count of such results, their total estimated tokens and the tools and MCP servers that produced them. Its advice SHALL name a remedy per tool: `Read` with offset and limit, shell output through `head`, `tail` or `grep`, search tools with a result cap, and delegating bulk reading to a subagent.

#### Scenario: Large Bash output
- **WHEN** a 250,000-byte `Bash` result is in the view
- **THEN** the tip is shown as a warning, names `Bash` and advises piping shell output through `head`, `tail` or `grep`

### Requirement: Tip about cache breaks
The cache-breaks rule SHALL fire when a session in the view has 2 or more cache breaks. Its evidence SHALL give the sessions, the breaks by cause and the uncached tokens, and the view's cache-hit ratio. Its advice SHALL say to keep one model through a session when most breaks are model switches, and to keep turns within the cache lifetime or accept the cost when most are expiries.

#### Scenario: Model switches
- **WHEN** a session has 3 cache breaks, 2 of them model switches
- **THEN** the tip is shown, counts 2 model switches, and advises keeping one model through a session

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
