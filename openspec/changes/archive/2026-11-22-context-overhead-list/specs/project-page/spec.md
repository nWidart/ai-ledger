## ADDED Requirements

### Requirement: List what loads before the first prompt
With a context snapshot, the Context block SHALL offer a disclosure "What loads before your first prompt", closed on load, whose summary gives the total tokens of the snapshot's categories loaded before the first prompt; with no category above 0 the summary SHALL give no total. Open, it SHALL say when and with which model the snapshot was measured, and SHALL rank those categories by tokens, each with its tokens, its share of that total and a bar on one scale for the whole list.

#### Scenario: Ranked categories
- **WHEN** `foo`'s snapshot loads 12,790 tokens of system tools, 9,357 of skills and 4,107 of system prompt among 28,413 tokens before the first prompt, and the user opens the list
- **THEN** System tools comes first with 12.8k tokens and 45%, then Skills with 9.4k tokens and 33%, then System prompt

#### Scenario: Closed on load
- **WHEN** the user opens the Project page of `foo`, which has a snapshot
- **THEN** the list is closed and its summary reads "What loads before your first prompt · 28.4k tokens"

#### Scenario: Nothing counted before the first prompt
- **WHEN** the snapshot lists one custom agent and has no category above 0
- **THEN** the summary reads "What loads before your first prompt" with no total, and the list says that no category of the snapshot loads tokens before the first prompt

### Requirement: Close the overhead list for another project
Selecting another project SHALL draw that project's overhead list closed, even when its Context comes from what the page already fetched.

#### Scenario: Another project on the Project page
- **WHEN** the user opened `bar`'s list, then goes back to the Project page of `foo`, whose Context the page already fetched
- **THEN** `foo`'s list is closed

### Requirement: Write the overhead shares at either end
In the overhead list, a share above 0 that would round to 0% SHALL read as under 0.1%, and a share under 1 that would round to 100% SHALL read as over 99%.

#### Scenario: A share near none or all
- **WHEN** the snapshot loads 2,000,000 tokens of system tools and 1 token of system prompt
- **THEN** System tools reads "2.0M tokens, >99%" and System prompt "1 token, <0.1%"

### Requirement: Keep the overhead list open for a new snapshot
A new snapshot of the same project SHALL keep the overhead list open, and SHALL close what was opened in it: each server's tools and each list shown in full. A snapshot SHALL be told from another by its own id, not by its session and time.

#### Scenario: A new snapshot of the same project
- **WHEN** the list and the tools of a server are open, and a newer snapshot of the same project arrives
- **THEN** the list stays open, the server's tools are closed, and the list says when the newer snapshot was measured

#### Scenario: A replacement snapshot with the same time
- **WHEN** the list and the tools of a server are open, and another snapshot of the same session with the same time replaces it
- **THEN** the list stays open and the server's tools are closed

### Requirement: Say when the overhead snapshot predates the view
When the snapshot was taken before the view's first day, the overhead list SHALL say so and that the configuration may have changed since. For a view of all time it SHALL say nothing of the kind.

#### Scenario: An old snapshot
- **WHEN** the view covers the last 7 days and `foo`'s latest snapshot is a month old
- **THEN** the list says the snapshot was taken before this view's first day and that the configuration may have changed since

#### Scenario: A view of all time
- **WHEN** the view covers all time and `foo`'s latest snapshot is a month old
- **THEN** the list says nothing of the snapshot's age

### Requirement: Rank the overhead items under their category
Under each category with items, the list SHALL rank its items by tokens: MCP servers with their tools summed and listed under each server, memory files by file name with their type and folder, custom agents, and skills. Each such category SHALL say how many items it holds and, with two or more, their median tokens, and how many of its tokens no item lists. A list of more than six items SHALL show five, then one row with the count and tokens of the rest and a button that shows them all.

#### Scenario: Many small skills
- **WHEN** the snapshot lists 214 skills with a median of 40 tokens
- **THEN** the Skills row says "214 skills, median 40 tokens", five skills are listed, and a row reads "209 more" with their tokens and "Show all 214"

#### Scenario: Show all
- **WHEN** the user selects "Show all 214"
- **THEN** every skill is listed, the button reads "Show fewer" and keeps the focus

#### Scenario: Two files of one name
- **WHEN** the snapshot lists `CLAUDE.md` in `/w/foo` and in `/w/foo/api`
- **THEN** the list shows two `CLAUDE.md` rows, each with its own folder as text in the row

#### Scenario: An item with no name
- **WHEN** a skill of the snapshot has no name
- **THEN** it is listed as "Unnamed skill" with its tokens and opens nothing

### Requirement: Tell apart MCP servers of one name
Two MCP servers of the overhead list that read alike SHALL each add the key their calls are stored under, as "github (plugin_gh_github)", and each name SHALL open the tool sheet of its own key.

#### Scenario: Two servers of one name
- **WHEN** the snapshot lists a plugin's server `github`, its calls stored under `plugin_gh_github`, and a user's server `github`
- **THEN** the rows read "github (plugin_gh_github)" and "github (github)", and each name opens the tool sheet of its own key

### Requirement: Say how often each MCP server and skill was called
Each MCP server row and skill row SHALL say how many times Claude Code called it in the view, its range and automated filter applied and subagents' calls counted, and calls by other agents not counted. The row's name SHALL open that server's or skill's tool sheet, by the key its calls are stored under. Categories, tools, memory files, custom agents and unnamed items SHALL open nothing.

#### Scenario: A called server
- **WHEN** Claude Code called the server `github` 12 times in the view, 3 of them from subagents
- **THEN** the `github` row says "called 12 times by Claude Code in this view"

#### Scenario: Another agent's calls
- **WHEN** the view holds all sources and only Codex called the server `linear`
- **THEN** the `linear` row says "not called by Claude Code in this view"

#### Scenario: Open a server
- **WHEN** the user presses Enter on the name of the `github` row
- **THEN** the tool sheet of the MCP server `github` opens over the page

### Requirement: List MCP tools of no server under Unknown server
MCP tools whose server the snapshot does not name SHALL be listed under one row, "Unknown server", which SHALL say that its calls cannot be counted and SHALL open nothing.

#### Scenario: A tool with no server
- **WHEN** the snapshot lists an MCP tool with no server name and a name with no `mcp__<server>__` prefix
- **THEN** it is listed under "Unknown server", whose row says "The snapshot names no server, so its calls cannot be counted." and has no button

### Requirement: Show overhead items that do not fit their category
When the items listed for a category hold more tokens than the category loads, their rows SHALL show their tokens with no bar, and the category SHALL say that some of them are not loaded before the first prompt and that the snapshot does not say which. Items of a kind whose category is missing or at 0 SHALL be listed after the ranked categories under the kind's name, with no bar and no share.

#### Scenario: MCP tools listed beyond what loads
- **WHEN** the snapshot's MCP tools category loads 619 tokens and the three tools listed hold 805
- **THEN** the server row has no bar, and the MCP tools row says the 3 tools listed hold 805 tokens, more than the 619 this category loads

#### Scenario: No category for the items
- **WHEN** the snapshot lists MCP tools and has no MCP tools category above 0
- **THEN** the tools' servers are listed under "MCP tools" after the ranked categories, with no bar, and the row says none of them is counted before the first prompt

### Requirement: Fit the overhead list on any screen
The overhead list SHALL not scroll the page sideways at any width or text size. In a narrow box the bar SHALL move under the row's name. Every bar's track SHALL have one width at every level of the list, in either layout, so equal tokens draw bars of equal length. A bar SHALL be at least 1px for an item above 0 tokens. Under forced colors a bar SHALL be told by its length and a border, not by a hue. Nothing in the list SHALL animate, and nothing in it SHALL be reachable only by hovering.

#### Scenario: A phone at large text
- **WHEN** the user opens the list on a 375px screen with 32px text
- **THEN** each bar sits under its row's name and the page does not scroll sideways

#### Scenario: Equal tokens, equal bars
- **WHEN** a memory file holds as many tokens as the System prompt category, the list is open in a 343px box, and a server's tools are open
- **THEN** the category's, the file's and each tool's tracks are one width, and the category's and the file's bars are one length

#### Scenario: A tiny item
- **WHEN** a 40-token skill is listed beside a 12,790-token category
- **THEN** its bar is 1px wide and its row says 40 tokens

#### Scenario: Forced colors
- **WHEN** forced colors are on
- **THEN** each bar, a category's or an item's, is drawn in the system text color inside a bordered track

#### Scenario: A memory file on a phone
- **WHEN** the user opens the list on a 375px screen and the snapshot lists a memory file
- **THEN** the file's folder is text in its row, seen without hovering, and the page does not scroll sideways

## REMOVED Requirements

### Requirement: List the largest overhead items
**Reason**: Five items per group, no custom agents and no call counts could not say what to remove, or tell one large item from many small ones.
**Migration**: Replaced by "List what loads before the first prompt", "Close the overhead list for another project", "Write the overhead shares at either end", "Keep the overhead list open for a new snapshot", "Say when the overhead snapshot predates the view", "Rank the overhead items under their category", "Tell apart MCP servers of one name", "Say how often each MCP server and skill was called", "List MCP tools of no server under Unknown server", "Show overhead items that do not fit their category" and "Fit the overhead list on any screen". `/api/context` `overhead.top` is replaced by `items` and `calls`.
