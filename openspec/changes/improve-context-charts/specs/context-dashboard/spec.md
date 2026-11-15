# Spec Delta

## MODIFIED Requirements

### Requirement: Show starting context per project
The page SHALL show, for the view and for each project in it, the median, the 10th percentile and the 90th percentile of starting context over the project's sessions, the median share of the model's window, and the number of sessions measured. It SHALL draw each project's 10th to 90th percentile range with its median marked, every project on one token scale, with the 30,000-token threshold of the large-start tip marked on that scale. It SHALL chart the view's median starting context per week of session start with its 25th to 75th percentile band, on a labelled token axis, with weeks placed by date, and SHALL mark a week with fewer than 3 sessions as resting on few sessions. A project with no measured session SHALL show no figure, not zero.

#### Scenario: Two projects
- **WHEN** `foo` sessions start at 20,000, 24,000 and 70,000 tokens and `bar` sessions at 8,000 and 9,000
- **THEN** `foo` shows a median of 24,000 and `bar` a median of 8,500, each with its 10th and 90th percentile and its sessions count

#### Scenario: Window share
- **WHEN** a session starts at 50,000 tokens and its window resolves to 200,000
- **THEN** that session's share of the window is 25%

#### Scenario: Spread is visible
- **WHEN** `foo` has a 10th percentile of 20,800 and a 90th percentile of 60,800, and `bar` 8,100 and 8,900
- **THEN** `foo`'s range is drawn many times wider than `bar`'s on the same scale, and crosses the 30,000-token mark

#### Scenario: A week with few sessions
- **WHEN** one week holds 2 sessions and the next 40
- **THEN** both weeks are on the trend, and the first is marked as resting on few sessions

#### Scenario: A week with no session
- **WHEN** sessions started in the weeks of 2 and 16 November and none in the week of 9 November
- **THEN** the trend leaves a gap at 9 November and does not draw the two weeks as neighbours

### Requirement: Show how context grows
The page SHALL chart the median context (prompt tokens) at each turn index over the view's sessions with at least that many turns, up to turn 100 and only for indexes with at least 5 sessions, and the same curve for each of the five projects with the most sessions. The chart SHALL show, at each turn index, how many sessions the point rests on. It SHALL offer the same curves as a share of each session's window, over the sessions with a known window, with the near-limit share of 80% marked; the token curves SHALL carry no limit mark. Selecting a project in the chart's legend SHALL draw that project alone against the view, with its 25th to 75th percentile band, and selecting it again SHALL restore every project. The page SHALL show the median tokens added per user prompt, for the view and per project, where a session's added tokens are the sum of the rises between consecutive turns (a fall, as after a compaction, adds nothing).

#### Scenario: Curve points need sessions
- **WHEN** 12 sessions have 10 or more turns and 3 sessions have 11 or more
- **THEN** the curve shows turn 10 and stops before turn 11

#### Scenario: Added per prompt
- **WHEN** a session's turns are at 20,000, 30,000, 45,000, then 25,000 after a compaction, then 32,000, over 2 prompts
- **THEN** its added tokens are 32,000 and its tokens added per prompt are 16,000

#### Scenario: Sessions left at a turn
- **WHEN** 60 sessions reach turn 5 and 7 reach turn 40
- **THEN** the chart shows 60 sessions at turn 5 and 7 at turn 40

#### Scenario: Share of the window
- **WHEN** the user switches the chart to share of the window, and a session with a 200,000-token window is at 150,000 tokens at turn 30
- **THEN** that session counts as 75% at turn 30, and sessions with no known window take no part in the share curve

#### Scenario: Isolate a project
- **WHEN** the user selects `foo` in the legend
- **THEN** the chart draws the view's curve and `foo`'s curve with `foo`'s band, and no other project

#### Scenario: Per-project growth without a compaction
- **WHEN** the view has two projects and no session compacted
- **THEN** the page still shows each project's tokens added per prompt

### Requirement: Show peak fill by window size
The page SHALL group the view's sessions with a known window by that window and show, for each window, how many sessions peaked under 25%, 25 to 50%, 50 to 80%, 80 to 90% and at or over 90% of it. Each window SHALL be drawn as one bar whose segments are those five groups as shares of the window's sessions, so that windows with different numbers of sessions can be compared, with each segment's count and share readable. Selecting a segment SHALL list the sessions in it, newest first, and selecting a session SHALL open its session sheet.

#### Scenario: Two window sizes
- **WHEN** the view holds 1,000,000-token sessions and 258,400-token sessions
- **THEN** each window shows its own five counts, and the counts of a window add up to its sessions

#### Scenario: Threshold is a segment edge
- **WHEN** a session peaks at 79% of its window and another at 81%
- **THEN** the first is in the 50 to 80% group and the second in the 80 to 90% group

#### Scenario: Windows compare by share
- **WHEN** 2 of 4 sessions with one window and 50 of 100 with another peaked under 25%
- **THEN** both windows draw that segment at half the bar's width

#### Scenario: Drill into a segment
- **WHEN** the user selects the 80 to 90% segment of the 200,000-token window, which holds 3 sessions
- **THEN** the page lists those 3 sessions, and selecting one opens its session sheet with the page's filters kept

### Requirement: Show what fills context
The page SHALL show, over the view's main-thread tool calls with a known result size, the summed result size by tool and by MCP server, each with its calls, its median, 95th percentile and largest result and an estimated token count labelled as an estimate. It SHALL chart the ten tools, or MCP servers, with the largest summed size, each beside the range from its median to its 95th percentile result, and SHALL fold the rest into one "Other" total. The results of calls made inside subagent transcripts SHALL be summed apart, as bytes that never entered the main thread's context, and the main-thread and subagent totals SHALL be drawn as two parts of one bar.

#### Scenario: By tool
- **WHEN** 40 main-thread `Read` results total 2,000,000 bytes and 10 `Bash` results total 300,000
- **THEN** `Read` leads with 2,000,000 bytes and about 500,000 estimated tokens, and `Bash` follows

#### Scenario: Subagent results apart
- **WHEN** a session's subagent transcripts hold 5,000,000 bytes of tool results and its main thread 800,000
- **THEN** the main-thread figures count 800,000 bytes and the subagent figure 5,000,000

#### Scenario: Many small or a few huge
- **WHEN** `Read` totals 2,000,000 bytes over 400 results with a 95th percentile of 12,000, and `Bash` totals 2,000,000 over 8 results with a 95th percentile of 900,000
- **THEN** the two tools show equal totals, and `Bash`'s range sits far above `Read`'s

#### Scenario: More than ten tools
- **WHEN** 14 tools have results with a known size
- **THEN** the chart shows the 10 with the largest totals and one "Other" bar summing the remaining 4, and the table lists all 14

## ADDED Requirements

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
The page SHALL chart, per day of the view, or per week when the view's first request is more than 60 days old, the prompt tokens of the view's requests split into cache reads, cache writes and uncached input, with the cache-hit ratio of each bucket, and the number of cache breaks in each bucket by cause. The buckets SHALL add up to the cache-hit ratio of the view's requests that carry a time; a request with no time is in no bucket. The chart SHALL say that a break's cause is inferred, not reported by the provider. Costs SHALL NOT be stacked in this chart.

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
