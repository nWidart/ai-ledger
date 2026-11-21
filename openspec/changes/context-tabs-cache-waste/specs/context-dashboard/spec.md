## ADDED Requirements

### Requirement: Group the sections in three tabs
Under the tips, the page SHALL show three tabs: Overhead and pressure (starting context, window grids, window pressure and the session map), Growth and bloat (growth, what fills context, largest tool results) and Cache health (cache use, cost by project, sessions where caching broke). The selected tab SHALL be kept in the URL, except the first, which is the default. The page SHALL show no section index.

#### Scenario: Open a tab from a link
- **WHEN** the user opens `/context?range=30&tab=cache`
- **THEN** Cache health is selected and shows the cache chart, the cost by project and the cache breaks drawer

#### Scenario: Choose a tab
- **WHEN** the user selects Growth and bloat
- **THEN** the URL records `tab=growth` with the filters kept, and selecting Overhead and pressure again removes `tab`

#### Scenario: A link to a section
- **WHEN** the user opens `/context#d-breaks`
- **THEN** Cache health is selected and the cache breaks drawer opens

### Requirement: Operate the tabs from the keyboard
The tabs SHALL follow the WAI-ARIA tabs pattern. A tablist holds the tabs, and only the selected tab is a tab stop. The right and left arrow keys select the next and previous tab, wrapping. Home and End select the first and last. Selecting a tab moves focus to it and shows its panel. The panel is named by its tab and takes focus after the tablist.

#### Scenario: Arrow keys
- **WHEN** focus is on Overhead and pressure and the user presses the right arrow key
- **THEN** Growth and bloat is selected, has focus, and its panel shows

#### Scenario: Wrap
- **WHEN** Cache health has focus and the user presses the right arrow key
- **THEN** Overhead and pressure is selected

### Requirement: Draw each project's window as a grid
On Overhead and pressure, the page SHALL draw the Project page's window grid as a small grid for each of the six projects in the view with the most sessions that have a known start and peak share of the window. Each grid SHALL give its project, its window and the median start, median peak and free space as shares. With a project selected, the page SHALL draw that project's one full grid with its legend instead.

#### Scenario: Several projects
- **WHEN** eight projects have a known window, and `p0`, with the most sessions, starts at a median 10% of a 200k window and peaks at 40%
- **THEN** six grids are drawn, `p0` first, filling 20 cells as start, 60 as added by the peak and 120 free, and the page says it shows 6 of 8 projects

#### Scenario: One project
- **WHEN** the user selects project `foo`
- **THEN** the page draws `foo`'s full grid, with its legend, and no small grids

### Requirement: Name sessions by their title on the map
The session map's tooltip, readout and data table, the quadrant lists and the peak-fill lists SHALL name a session by its title, else by its short id. In a table, a titled session's short id SHALL show under its title.

#### Scenario: A titled session
- **WHEN** the user reads the mark of a session titled "Fix the login redirect"
- **THEN** the tooltip and the readout start with "Fix the login redirect", and its table row shows the title over its short id

### Requirement: Narrow window pressure to a quadrant of the map
The 30,000-token and 80% lines SHALL cut the session map into four named quadrants: Lean, Heavy start, Grew full and Heavy and full. A button per quadrant SHALL give its count. Selecting a quadrant, by its button or by a click on the plot away from any mark, SHALL count only its sessions on the map in the peak-fill bars, dim the other marks and list its 20 newest sessions. Escape, Clear or selecting it again SHALL clear it.

#### Scenario: Select by keyboard
- **WHEN** the user focuses the Grew full button and presses Enter
- **THEN** the button is pressed, the peak-fill bars count the Grew full sessions on the map alone and say so, and a list names those sessions, newest first

#### Scenario: Clear with Escape
- **WHEN** a quadrant is selected and the user presses Escape on its button or on the map
- **THEN** the quadrant is cleared and the bars count every session again

#### Scenario: Click the plot
- **WHEN** the user clicks the top right of the map, away from any mark
- **THEN** Heavy and full is selected and no session sheet opens

## MODIFIED Requirements

### Requirement: Give data-driven tips
The page SHALL show tips from a fixed set of rules, each with a severity, a title, its evidence figures, its advice and the sessions that match it. The rules and their thresholds SHALL be fixed in the app. A tip SHALL be shown only when its rule fires, and the page SHALL say when none fires. Tips SHALL show under the lede as one strip of short items, at most four before "Show N more", so the tabs and the first chart start on the first screen at 1440 × 900.

#### Scenario: Nothing fires
- **WHEN** no rule fires on the view
- **THEN** the tips strip says that nothing stands out and lists no tip

#### Scenario: Rule fires
- **WHEN** a main-thread tool result in the view is 150,000 bytes
- **THEN** the large-results tip is listed, and opening it shows its evidence, advice and the session that holds the result

#### Scenario: Several tips
- **WHEN** all six rules fire on a 1440 × 900 window
- **THEN** four items show, "Show 2 more" reveals the rest, and the first chart's top is within the window

#### Scenario: One item open
- **WHEN** the user opens the near-limit item and then the compactions item
- **THEN** the compactions item's evidence and advice show under the strip, and the near-limit item is closed

### Requirement: Tip about a large starting context
The large-start rule SHALL fire when a project in the view has a median starting context of at least 30,000 tokens. Its evidence SHALL name the 5 projects with the largest medians, their medians and window shares, and count the others. Its advice SHALL say to trim the instruction files and review the configured MCP servers, naming where each agent of the matching sessions configures them.

#### Scenario: Rule fires
- **WHEN** project `foo` sessions start at a median of 42,000 tokens
- **THEN** the tip names `foo` with 42,000 tokens, and its matching sessions are `foo` sessions starting at 30,000 tokens or more

#### Scenario: Below the threshold
- **WHEN** every project's median starting context is under 30,000 tokens
- **THEN** the large-start tip is not shown

#### Scenario: Codex sessions
- **WHEN** every matching session is a Codex session
- **THEN** the advice names `AGENTS.md` and `codex mcp list`, and not `CLAUDE.md` or `claude mcp list`

### Requirement: Tip about frequent compactions
The frequent-compactions rule SHALL fire when a session in the view compacted 3 or more times, as a warning, or critical at 6 or more. Its evidence SHALL give the number of such sessions and the median turns and active minutes before the first compaction. Its advice SHALL say to start a new session between tasks and to compact before the context fills, with the commands of the matching sessions' agents.

#### Scenario: Three compactions
- **WHEN** one session in the view compacted 3 times and no session more
- **THEN** the tip is shown as a warning and that session matches it

#### Scenario: Claude Code sessions
- **WHEN** every matching session is a Claude Code session
- **THEN** the advice names `/clear` and `/compact`

#### Scenario: Codex sessions
- **WHEN** every matching session is a Codex session, on a Codex-only view or not
- **THEN** the advice names `/new` and `/compact`, and not `/clear`

#### Scenario: Both agents
- **WHEN** the matching sessions include Claude Code and Codex sessions
- **THEN** the advice names `/clear` for Claude Code and `/new` for Codex

### Requirement: Tip about long-tier spend
The long-tier rule SHALL fire when the view's long-prompt-tier cost is at least $1 and at least 10% of the view's estimated cost. Its evidence SHALL give that cost, its share, the number of long-tier requests and the models' long-prompt thresholds. Its advice SHALL say to `/compact` or start a new session before the prompt crosses the threshold, naming `/new` for Codex sessions.

#### Scenario: Long tier at 20%
- **WHEN** the view costs $50 and $10 of it was priced on the long tier
- **THEN** the tip is shown with $10 and 20%

#### Scenario: Small long-tier spend
- **WHEN** the view's long-tier cost is $0.40
- **THEN** the tip is not shown

### Requirement: Show cache use over time
The page SHALL chart, per day of the view, or per week when its first request is more than 60 days old, the prompt tokens not read from the cache (uncached input and cache writes), the cache breaks by cause and the cache-hit ratio, each on its own track over the same buckets. Cache reads SHALL show only on request. The buckets SHALL add up to the view's cache-hit ratio. The chart SHALL say a break's cause is inferred, and SHALL NOT stack costs.

#### Scenario: A day's ratio
- **WHEN** a day's requests read 900,000 tokens from the cache, wrote 60,000 and sent 40,000 uncached
- **THEN** that day's bar shows 40,000 uncached input and 60,000 cache write, and no cache-read segment

#### Scenario: Hit-ratio track
- **WHEN** that day is charted
- **THEN** its cache-hit ratio of 90% shows on its own track under the same day, not on a second axis over the bars

#### Scenario: Cache reads on request
- **WHEN** the user turns cache reads on
- **THEN** each bar gains a cache-read segment on top, the token axis rescales to the prompt tokens, and the control is pressed

#### Scenario: Reading a day
- **WHEN** the user reads that day with the arrow keys, cache reads off
- **THEN** the readout gives 40k uncached input, 60k cache write, 900k cache read and a 90% cache-hit ratio, and the data table has the same columns

#### Scenario: Breaks by cause
- **WHEN** a day has 2 cache breaks from a model switch and 1 from an expired cache
- **THEN** that day shows 3 breaks under its bar, 2 as model switches and 1 as expired

#### Scenario: Long view
- **WHEN** the view's first request is 200 days old
- **THEN** the chart shows one bucket per week

#### Scenario: Day with no request
- **WHEN** the view has requests on 3 and 5 November and none on 4 November
- **THEN** every track leaves 4 November empty and the ratio line does not join 3 and 5 November

#### Scenario: Request with no time
- **WHEN** a request in the view carries no time
- **THEN** it is in no bucket, and it still counts in the Cost section's cache-hit ratio

### Requirement: Map the view's sessions
The page SHALL chart each of the view's sessions with a measured start, a known window and a recorded peak as one mark, placed by starting context and by peak share of the window, with the 30,000-token and 80% lines drawn and the four quadrants they make named. A compacted session's mark SHALL differ by more than colour. Selecting a mark SHALL open the session's sheet. The chart SHALL show at most the 1,000 newest such sessions and say how many it shows of how many.

#### Scenario: Heavy start, full window
- **WHEN** a session starts at 60,000 tokens and peaks at 180,000 of a 200,000-token window
- **THEN** its mark sits right of the 30,000-token line and above the 80% line, in the quadrant named Heavy and full

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
