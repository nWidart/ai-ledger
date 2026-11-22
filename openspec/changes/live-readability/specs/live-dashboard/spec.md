## ADDED Requirements

### Requirement: Render prompts and replies as Markdown
With Full text on, the stream SHALL render the body of each prompt and reply as Markdown, with GFM tables. A code block SHALL scroll sideways inside the body and SHALL NOT widen the stream. Tool output SHALL stay plain text. An update to the stream SHALL NOT parse again a body that did not change.

#### Scenario: Reply with Markdown
- **WHEN** Full text is on and a reply holds a heading, a list, bold text, inline code, a link, a GFM table and a code fence
- **THEN** the stream shows a heading, a list, bold text, code, a link, a table and a code block

#### Scenario: Long code block
- **WHEN** Full text is on and a reply holds a code fence with a 400-character line
- **THEN** the code block scrolls sideways inside the body, and the stream has no sideways scroll

#### Scenario: Tool output
- **WHEN** Full text is on and a tool result holds `# not a heading`
- **THEN** its detail shows `# not a heading` as plain text

#### Scenario: Full text off
- **WHEN** Full text is off
- **THEN** prompts and replies show as word counts, with no Markdown rendered

### Requirement: Keep Markdown bodies safe
Raw HTML in a prompt or reply body SHALL show as text and SHALL NOT become elements. A link SHALL keep its href only when it is `http:`, `https:` or `mailto:`, and SHALL open in a new tab with `rel="noreferrer noopener"`; any other link SHALL show as text. An image SHALL show as a link to its source, so the page makes no image request.

#### Scenario: Raw HTML in a prompt
- **WHEN** Full text is on and a prompt holds `<img src=x onerror=alert(1)>` and `<b>hi</b>`
- **THEN** the stream shows both as text, and the page holds no element made from them

#### Scenario: Unsafe link
- **WHEN** Full text is on and a reply holds `[run](javascript:alert(1))` and `[docs](https://example.com)`
- **THEN** "run" shows as text with no link, and "docs" links to `https://example.com` in a new tab with `rel="noreferrer noopener"`

#### Scenario: Image in a reply
- **WHEN** Full text is on and a reply holds `![chart](https://example.com/c.png)`
- **THEN** the stream shows a link named "chart" to that address, and the page requests no image

## MODIFIED Requirements

### Requirement: Show each session in its rail entry
Each rail entry SHALL take two lines, and every entry SHALL have the same height. Its first line SHALL show the session's title, cut with an ellipsis when it does not fit, and, at its end when above zero, the error count with a ✕, such as `✕2`. An entry with no title SHALL show the project as its first line. Its second line SHALL show the state, then the project with its color when the entry has a title, and, at its end, the context percent when the window is known, in the warning color above the near-full mark. The project SHALL shrink first, cut with an ellipsis; the state SHALL be cut with an ellipsis only once the project has shrunk to nothing. An inferred state SHALL NOT show "(inferred)" in the entry, and the entry's accessible name SHALL say it is inferred. An entry SHALL NOT show the cost, the source, the branch, the latest action or a meter. An entry in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and an entry running a tool SHALL show the tool's name and how long it has run, such as `Bash 12s`. The entry's accessible name SHALL carry what it shows: the title or project, the state with its detail, the project, the context percent and the errors in words, such as "2 errors". At 1440x900 the rail SHALL hold 8 sessions without scrolling.

#### Scenario: Two sessions in one project
- **WHEN** two `ai-ledger` sessions are active with the AI titles "Add session titles" and "Fix Cost test"
- **THEN** their rail entries show those titles as their first lines, and `ai-ledger` on their second lines

#### Scenario: Prompt title under Full text
- **WHEN** an active session has no agent title and Full text is off
- **THEN** its entry shows the project as its first line, and when Full text is turned on it shows the title made from its first prompt

#### Scenario: Untitled entry
- **WHEN** an active session on branch `main` has no title
- **THEN** its entry shows the project as its first line, its second line shows the state and no project, and `main` shows nowhere in the entry

#### Scenario: How long on your turn
- **WHEN** a session has been in your turn for 4 minutes
- **THEN** its entry shows 4m 00s beside the state, and the figure counts up

#### Scenario: How long idle
- **WHEN** a session has been idle for 7 minutes
- **THEN** its entry shows `idle 7m 00s`

#### Scenario: A running tool
- **WHEN** a session has run a `Bash` call for 12 seconds
- **THEN** its entry shows `Bash 12s` as the state

#### Scenario: Entry with failures
- **WHEN** a session at 62% of its window has two failed calls
- **THEN** its first line ends with `✕2`, read as "2 errors", and its second line ends with "62%"

#### Scenario: Long title and long project
- **WHEN** a session titled with 72 characters in a project of 30 characters is running a `mcp__t3-code__delegate_task` call, in a 1440x900 window
- **THEN** the title and the project are cut with an ellipsis, the state shows whole while any of the project remains, and the entry has the height of every other entry

#### Scenario: Unknown window
- **WHEN** the session's context window is not known
- **THEN** its second line shows no percent

#### Scenario: Eight sessions
- **WHEN** 8 sessions in five groups are active in a 1440x900 window
- **THEN** the rail shows all 8 without scrolling

### Requirement: Toggle full text
The page SHALL offer a Full text toggle that is off on every page load. The toggle and its warning SHALL show only in the Stream view; on the Wall, the page's requests SHALL NOT ask for full text, whatever the toggle says, and the toggle SHALL keep its setting for the return to the Stream view. With it off, prompts and replies SHALL show as word counts, tool results as sizes, tool inputs cut to 300 characters and subagent calls by their description. With it on, they SHALL show as written, a dismissible warning SHALL say that secrets can appear, without moving the page, and the toggle SHALL keep a warning tint. The warning SHALL close by itself 6 seconds after it shows, SHALL NOT count that time while the pointer is over it or the focus is inside it, and SHALL move no focus when it closes by itself. Turning it on SHALL keep open rows, folded lanes and the scroll position.

#### Scenario: Turn on full text
- **WHEN** the user turns on Full text
- **THEN** the stream shows prompts, replies and tool results as written, the warning appears, the stream does not move, and a row the user had open stays open

#### Scenario: Dismiss the warning
- **WHEN** the user dismisses the warning
- **THEN** it goes, nothing moves, Full text stays on with its tint, and the focus is on the Full text toggle

#### Scenario: Warning closes by itself
- **WHEN** the user turns on Full text and waits 7 seconds with the pointer and the focus elsewhere
- **THEN** the warning is gone, Full text stays on with its tint, and the focus has not moved

#### Scenario: Warning under the pointer
- **WHEN** the user turns on Full text and rests the pointer on the warning for 10 seconds
- **THEN** the warning stays, and it closes no more than 6 seconds after the pointer leaves

#### Scenario: Warning with the focus
- **WHEN** the focus moves into the warning before it closes
- **THEN** the warning stays while the focus is inside it

#### Scenario: Wall view
- **WHEN** the user turns on Full text in the Stream view and opens the Wall
- **THEN** the Wall shows no Full text toggle and no warning, its requests ask for no full text, and back in the Stream view Full text is on

#### Scenario: Reload
- **WHEN** the user reloads the page after turning Full text on
- **THEN** Full text is off

### Requirement: Follow the newest event
With Follow on, the stream SHALL keep the newest event in view, wherever it falls in the stream, including inside a lane in the middle of it. Scrolling up or opening a tool row SHALL turn Follow off. The page's own scrolling SHALL NOT. A size change of the stream or its rows SHALL keep Follow on and put the newest event back in view. While Follow is off and new events arrive, the page SHALL offer Jump to latest, which turns Follow back on. While Follow is off, a scroll by the user that brings the stream within 2 pixels of its bottom SHALL turn Follow back on, as Jump to latest does; a resize or new content that leaves the stream at its bottom SHALL NOT. Turning Follow off with its checkbox while the stream is at its bottom SHALL keep it off until a later scroll by the user reaches the bottom.

#### Scenario: Read back while the session runs
- **WHEN** the user scrolls up while new tool calls arrive
- **THEN** the stream stays where the user scrolled, and Jump to latest appears

#### Scenario: Scroll back to the bottom
- **WHEN** Follow is off after the user scrolled up, new events arrived, and the user scrolls down to the bottom of the stream
- **THEN** Follow is on, Jump to latest goes, and the new-events status is empty

#### Scenario: Follow cleared at the bottom
- **WHEN** the stream is at its bottom and the user clears the Follow checkbox
- **THEN** Follow stays off, and turns on again only when the user scrolls up and back down to the bottom

#### Scenario: Content reaches the bottom
- **WHEN** Follow is off and the stream lands at its bottom because the window grew or rows were hidden
- **THEN** Follow stays off

#### Scenario: Newest event in a lane
- **WHEN** Follow is on, a running lane stands in the middle of the stream with a main-thread event after it, and the lane gets a new tool call
- **THEN** the stream scrolls to that call, and Follow stays on

#### Scenario: Stream changes size
- **WHEN** Follow is on and the window is resized, or a web font loads and the rows wrap anew
- **THEN** Follow stays on, and the newest event is in view

#### Scenario: Newest event taller than the stream
- **WHEN** Follow is on and the newest event, in the middle of the stream, is opened and taller than the stream's box
- **THEN** the stream shows that event from its top, and stays there

### Requirement: Show each session on its wall tile
A wall tile SHALL show, in this order: the state, with the error count with a ✕ when above zero and a pinned mark when pinned; the title; the project when the session has a title, and the model without its `claude-` prefix; the context meter with its percent. A tile SHALL NOT show the latest action, the tool count, the cost, the branch or the source. Tiles in one row SHALL have one height. The tile SHALL be a toggle whose pressed state says whether it is pinned. Its accessible name SHALL come from its content: "Pin" and the session's name, then all the tile shows, in words, current after each update. In the name, the error count SHALL agree in number with its noun: "1 error", "2 errors".

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile shows `✕1`, and its name reads "1 error"

#### Scenario: A screen reader on a tile
- **WHEN** a screen reader reaches the tile of a session titled "Fix login" in project foo on `claude-opus-5-5`
- **THEN** it reads "Pin Fix login", then the state, the errors, the project, `opus-5-5` and the context, and not pressed, and it reads no latest action, tools, cost, branch or source

#### Scenario: A tile that updates
- **WHEN** the tile's state or figures change while a screen reader is on it
- **THEN** the tile's name says the new state and figures

#### Scenario: Tiles of one row
- **WHEN** a row holds a tile with a 30-character title and one with an 80-character title, in a 1440x900 window
- **THEN** both tiles have the same height

#### Scenario: Codex model
- **WHEN** a Codex session runs on `gpt-6.2-sol` with no known cost
- **THEN** its tile shows `gpt-6.2-sol`, and no cost

### Requirement: Show state time and title on a wall tile
A tile in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and one running a tool its name and run time. A tile in *your turn* SHALL have a border. The title SHALL take at most two lines, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL show the project in the title's place, and SHALL leave the project out of the line under it.

#### Scenario: Long title on a tile
- **WHEN** a session's title is longer than two lines of its tile
- **THEN** the tile shows the title on two lines, cut with an ellipsis, and hovering it shows the full title

#### Scenario: Untitled tile
- **WHEN** a session in project `foo` has no title
- **THEN** its tile shows `foo` in the title's place, and the line under it shows the model alone

#### Scenario: Your turn tile
- **WHEN** a session is in your turn
- **THEN** its tile has a border and shows how long the session has waited

### Requirement: Filter the stream
The stream SHALL offer filters, in a bar above it, that change what it draws and nothing it holds. A Failed calls only toggle SHALL filter the stream to failed tool rows; while the stream holds failed rows, its label SHALL give their count, such as "Failed calls only (2)". It SHALL be the page's only control that filters to failed rows: the status strip's error count SHALL NOT be a control. A Main thread only toggle SHALL hide every lane. A Hide read-only toggle SHALL hide the rows the app marks read-only: `Read`, `Grep`, `Glob`, and shell calls whose every command only reads or searches. It SHALL NOT hide a failed row.

#### Scenario: Filter to failed rows
- **WHEN** the user turns on Failed calls only while the stream holds two failed rows among forty
- **THEN** the stream shows the two failed rows, and turning it off shows all rows

#### Scenario: Failed calls count
- **WHEN** the stream holds two failed rows
- **THEN** the toggle reads "Failed calls only (2)", and with no failed row it reads "Failed calls only"

#### Scenario: Errors count pressed
- **WHEN** the session has two failed calls
- **THEN** the strip shows the error count as text in the error color, and selecting it does nothing

#### Scenario: Main thread only
- **WHEN** the user turns on Main thread only with two lanes in the stream
- **THEN** no lane shows, and the main-thread rows do

#### Scenario: Hide read-only rows
- **WHEN** the user turns on Hide read-only with `Read`, `Grep`, `Glob` and `Edit` rows in the stream
- **THEN** only the `Edit` row shows among them

#### Scenario: Hide read-only shell rows
- **WHEN** the user turns on Hide read-only with a shell row that runs `rg TODO src` and one that runs `git commit`
- **THEN** only the `git commit` row shows among them

#### Scenario: Failed read-only row
- **WHEN** the user turns on Hide read-only, with Failed calls only or without it, and a `Read` row failed
- **THEN** the failed `Read` row shows

#### Scenario: Filters do not change figures
- **WHEN** the user turns on any filter
- **THEN** the strip's figures and the lane headers' tool counts do not change

### Requirement: Combine stream filters
The stream filters SHALL combine, SHALL be off on every page load, and SHALL stay on when the user opens another session. A lane with no matching row SHALL be hidden; a lane with matching rows SHALL keep its header, with the matching rows under it when it is open. Failed calls only SHALL open a finished lane that holds a failed row; a lane the user folded SHALL stay folded. The stream SHALL say how many rows the filters hide.

#### Scenario: Filters combine
- **WHEN** the user turns on Failed calls only and Main thread only, and the only failed row is inside a lane
- **THEN** the stream shows no row, and says that the filters hide every row

#### Scenario: Failed row in a lane
- **WHEN** the user turns on Failed calls only and a finished lane, folded as any finished lane, holds one failed row among six
- **THEN** the lane opens, and shows its header and that one row

#### Scenario: Lane the user folded
- **WHEN** the user folds a lane that holds a failed row, with Failed calls only on
- **THEN** the lane shows its header and no row

#### Scenario: Another session
- **WHEN** the user turns on Main thread only and opens another session
- **THEN** Main thread only is still on

#### Scenario: Reload
- **WHEN** the user reloads the page after turning a filter on
- **THEN** every filter is off

### Requirement: Show the session's status strip
Above the stream, under its head, the page SHALL show a strip about the selected session's conversation only, in two rows. The first row SHALL show the state and its detail, then the cost, the tool calls, the errors as a number in the error color when above zero, and the cache-read share with a toggletip. The second row SHALL hold two columns of equal width: Context, a readout of the context over its window, its percent and, when above zero, its compactions, above a meter as wide as the column with a mark at each compaction; and Last 10 min, the pulse as wide as its column. Below 721 pixels wide, and in a pinned stream on the Wall, the two columns SHALL stack. The strip SHALL NOT show plan limits, the working directory or Copy resume. An inferred state SHALL say it is inferred, with the reason behind a toggletip.

#### Scenario: Context near full
- **WHEN** the session uses more than 80% of its context window: the window the session states (Codex), else its model's window in the price table
- **THEN** the strip's context meter shows the warning color

#### Scenario: Context readout
- **WHEN** the session uses 119,500 tokens of a 1,000,000-token window and has compacted twice
- **THEN** the Context column reads "119.5k / 1.0M · 12% · 2 compactions" above its meter, and with no compaction it reads "119.5k / 1.0M · 12%"

#### Scenario: Likely waiting for approval
- **WHEN** the selected session's state is likely waiting for approval
- **THEN** the strip shows the state in the warning color with "(inferred)", and that toggletip gives the reason

#### Scenario: Unknown window
- **WHEN** the model's context window is not known
- **THEN** the strip shows the context in tokens and says the window is not known, with no meter

#### Scenario: Pulse width
- **WHEN** the user opens a session in a 1440x900 or a 1280x800 window
- **THEN** the pulse is at least 200 pixels wide and fills its column

#### Scenario: Plan limit near full
- **WHEN** the session's source has a 5-hour limit at 86% and the session's working directory is known
- **THEN** the strip shows no plan limit, no directory and no Copy resume

#### Scenario: Strip on a phone
- **WHEN** the user opens a session on a 390x844 screen
- **THEN** the Context column shows above the Last 10 min column, and the page has no sideways scroll

### Requirement: Fit the page to a narrow screen
Below 721 pixels wide, the rail SHALL be one row of entries that scrolls sideways inside itself, with its group headings for screen readers, and the page SHALL NOT scroll sideways. The strip's second row SHALL stack its columns, and the pulse's readout SHALL open under the strip and wrap within it. At 390x844 the first event of the stream SHALL be on the first screen.

#### Scenario: Phone with eight sessions
- **WHEN** the user opens a session on a 390x844 screen with 8 active sessions
- **THEN** the page has no sideways scroll, and the stream's first event shows without scrolling

#### Scenario: Pulse readout on a phone
- **WHEN** the user focuses the pulse on a 390x844 screen and presses End
- **THEN** the readout shows within the screen, and the page has no sideways scroll

## REMOVED Requirements

### Requirement: Copy the resume command from the strip
**Reason**: The strip shows only the current conversation; the resume command is a session fact.
**Migration**: Copy it from the session sheet's Resume line or the session's context menu (Copy resume command).

### Requirement: Show context, errors and latest action in a rail entry
**Reason**: The rail entry takes two lines: the context percent and the error count move into "Show each session in its rail entry", and the latest action leaves the rail.
**Migration**: Read the latest action in the session's stream.

### Requirement: Name a tile's latest shell call by its description
**Reason**: Wall tiles no longer show the latest action.
**Migration**: Pin the tile to read the session's stream, whose shell rows keep their descriptions.
