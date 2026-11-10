# command-palette Specification

## Purpose

The keyboard command palette: one input that narrows the view with `#` filters, goes to a page or inspector or runs a command with `>`, and writes the whole result to the URL in one step, so a combined view takes one gesture instead of many clicks.

## Requirements

### Requirement: Open the palette
Every dashboard page SHALL open the palette on Cmd+K on macOS and Ctrl+K on other systems, also while focus is in a page control. The navigation SHALL show a button that opens the palette and shows the shortcut for the user's system. The palette SHALL open with its input focused.

#### Scenario: Shortcut on macOS
- **WHEN** the user presses Cmd+K on any dashboard page on macOS
- **THEN** the palette opens with its input focused, and the browser's own Cmd+K action does not run

#### Scenario: Shortcut on other systems
- **WHEN** the user presses Ctrl+K on Activity on Linux or Windows
- **THEN** the palette opens with its input focused

#### Scenario: Navigation button
- **WHEN** the user views any dashboard page
- **THEN** the navigation shows a palette button with the hint `⌘K` on macOS or `Ctrl K` elsewhere, and clicking it opens the palette

#### Scenario: Shortcut while a sheet is open
- **WHEN** an inspector sheet is open and the user presses the shortcut
- **THEN** the palette opens above the sheet

### Requirement: Narrow with `#` filters
A `#` term SHALL select a filter: a project, a source (`#claude` for Claude Code, `#codex` for Codex), a time range (`#7d`, `#14d`, `#30d`, `#90d`, `#all`) or `#automated` to include automated sessions. Several `#` filters SHALL combine, and each SHALL write the same URL state as the page's own filter controls.

#### Scenario: Three filters on a page
- **WHEN** the user commits `#myproject #codex #7d >cost`
- **THEN** Cost opens filtered to project `myproject`, Codex and the last 7 days

#### Scenario: All time and automated sessions
- **WHEN** the user commits `#all #automated` on Activity
- **THEN** Activity shows all time with automated sessions included, as if the user had picked All and turned on the automated control

#### Scenario: Automated sessions on Errors
- **WHEN** the user commits `#automated` while on Errors
- **THEN** the URL records the choice, Errors keeps showing automated sessions as it always does, and the choice applies on Activity and Cost

### Requirement: Go to a page with `>`
A `>` term naming a page (Activity, Cost, Errors, Limits, Insights, Live) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them.

#### Scenario: Page only
- **WHEN** the user views project `myproject` for the last 14 days on Activity and commits `>errors`
- **THEN** Errors opens filtered to `myproject` and the last 14 days

#### Scenario: Page and filter
- **WHEN** the user commits `>errors #myproject` on any page
- **THEN** the URL becomes `/errors#project=myproject` with the other current filters, and Errors shows `myproject`

#### Scenario: No filters set
- **WHEN** the user has no filters on Activity, the last Errors view saved in the browser was project `other`, and the user commits `>errors`
- **THEN** Errors opens with no project filter, matching the view the user came from

#### Scenario: Go to Live
- **WHEN** the user views project `myproject` on Cost and commits `>live`
- **THEN** Live opens and shows only `myproject` sessions

### Requirement: Open an inspector with `>`
A `>` term naming a tool, an MCP server, a skill, a session or an error category SHALL open that subject's sheet: the tool inspector for a tool, MCP server or skill, the session sheet for a session, and the category on Errors for an error category. The sheet SHALL reflect the committed filters.

#### Scenario: Tool inspector scoped to a project
- **WHEN** the user is on Cost and commits `#myproject >bash`
- **THEN** Cost shows project `myproject` with the `Bash` inspector open over it

#### Scenario: Page then inspector
- **WHEN** the user commits `>errors >bash`
- **THEN** Errors opens with the `Bash` inspector open over it

#### Scenario: Session
- **WHEN** the user types `>` followed by part of a session's id, project or branch, and commits the matching session
- **THEN** the session sheet for that session opens

#### Scenario: MCP server and skill
- **WHEN** the user commits `>github` picked as an MCP server, or `>ship` picked as a skill
- **THEN** the inspector opens for MCP server `github`, or for skill `ship`

### Requirement: Run a command with `>`
A `>` term SHALL also name a command. `>refresh` SHALL run the same ingest and data refresh as the navigation's Refresh button. `>copy link` SHALL apply the view the other chips describe and copy that view's URL to the clipboard, and SHALL announce the result.

#### Scenario: Refresh
- **WHEN** the user commits `>refresh`
- **THEN** the palette closes and the navigation shows the ingest status as if Refresh had been clicked

#### Scenario: Copy link to a combined view
- **WHEN** the user commits `#myproject >errors >copy link`
- **THEN** Errors opens filtered to `myproject`, its URL is in the clipboard, and the page announces that the link was copied

#### Scenario: Clipboard unavailable
- **WHEN** the browser refuses clipboard access on `>copy link`
- **THEN** the page announces that the link could not be copied and the view still applies

### Requirement: Accept terms in any order
The meaning of a commit SHALL NOT depend on the order of its `#` and `>` terms, except where a clash rule names the later term as the winner.

#### Scenario: Filter before or after the page
- **WHEN** the user commits `>errors #myproject`, and later commits `#myproject >errors` from the same view
- **THEN** both commits open the same URL

### Requirement: Search every kind without a sigil
Text typed without a sigil SHALL match every kind: projects, sources, ranges, the automated filter, pages, tools, MCP servers, skills, sessions, error categories and commands. Each suggestion row SHALL show its kind as a badge and the sigil it becomes when picked.

#### Scenario: Bare text
- **WHEN** the user types `bash`
- **THEN** the list shows every match across kinds, such as the `Bash` tool with a `Tool` badge and `>`, and a project named `bash-scripts` with a `Project` badge and `#`

#### Scenario: Sigil narrows the kinds
- **WHEN** the user types `#co`
- **THEN** the list shows only filters, such as the Codex source and projects starting with `co`, and no pages, inspectors or commands

### Requirement: Show picked terms as chips
A picked suggestion SHALL become a chip: filter chips on the left of the input, the destination (page, inspector or command) on the right. Backspace in an empty input SHALL remove the last chip. Each chip SHALL also be removable on its own.

#### Scenario: Chips from picks
- **WHEN** the user picks `myproject` and then `Bash`
- **THEN** a `#myproject` chip shows left of the input and a `>Bash` chip shows right of it

#### Scenario: Backspace removes the last chip
- **WHEN** the input is empty and the user presses Backspace with chips `#myproject` and `#7d`
- **THEN** the `#7d` chip is removed and `#myproject` stays

### Requirement: Pre-fill chips from the current view
Opening the palette SHALL show a chip for each filter the current URL sets: project, source, range and the automated toggle. Removing a pre-filled chip and committing SHALL remove that filter, so the palette also edits the current filters in place.

#### Scenario: Filtered page
- **WHEN** the user opens the palette on Activity with `#project=myproject&source=codex`
- **THEN** the palette shows the chips `#myproject` and `#codex`

#### Scenario: Remove a filter
- **WHEN** the user removes the pre-filled `#codex` chip and presses Enter
- **THEN** Activity stays open with `myproject` for every source

#### Scenario: Nothing changed
- **WHEN** the user opens the palette and presses Enter without changing the pre-filled chips or typing
- **THEN** the palette closes and the URL and history stay as they were

### Requirement: Narrow suggestions by the chosen facets
Inspector and filter suggestions SHALL reflect the filters chosen in the palette, not only the current page's. Tools, MCP servers and skills SHALL list only those with calls in the chosen view, with their call count and failure rate. Projects, sources and error categories SHALL show their count in the view the other chosen filters describe.

#### Scenario: Tools in one project
- **WHEN** the user picks `#myproject` and types `>`
- **THEN** the tool rows list only tools called in `myproject` sessions in the chosen range, each with its call count and failure rate

#### Scenario: No data for a combination
- **WHEN** the user picks `#myproject #codex` and `myproject` has no Codex sessions
- **THEN** no tool rows are listed for that view, and the list says that the view has no tool calls

#### Scenario: Error category counts
- **WHEN** the user picks `#7d` and types `>time`
- **THEN** the `Command timed out` category row shows its number of errors in the last 7 days

### Requirement: State what Enter will do
A footer SHALL state what Enter will do with the current chips and the highlighted suggestion, naming the action, the destination and the filters that apply, and any page a clash rule chose.

#### Scenario: Inspector footer
- **WHEN** the chips are `#myproject` and `#claude`, the range is 30 days, and `Bash` is highlighted
- **THEN** the footer reads like "Enter: open Bash inspector · myproject · Claude Code · 30d"

#### Scenario: Footer names an implied page
- **WHEN** the user is on Activity and highlights the `Command timed out` category
- **THEN** the footer says that Enter opens Errors on that category

### Requirement: Keyboard controls in the palette
Up and Down SHALL move the highlight through the suggestions. Tab SHALL add the highlighted suggestion as a chip and keep the palette open. Enter SHALL add the highlighted suggestion, if any, and commit. Esc SHALL close the palette without changing the view and return focus to where it was.

#### Scenario: Tab then Enter
- **WHEN** the user types `myp`, presses Tab, types `>bas` and presses Enter
- **THEN** `myproject` becomes a chip after Tab, and Enter opens the `Bash` inspector scoped to `myproject`

#### Scenario: Escape
- **WHEN** the user has added chips and presses Esc
- **THEN** the palette closes, the URL is unchanged, and focus returns to the control that had it before the palette opened

### Requirement: One history entry per commit
A commit SHALL write the URL once and add exactly one browser history entry, whatever it changes: page, filters and sheet. Browser Back SHALL return to the view before the commit.

#### Scenario: Back undoes a combined commit
- **WHEN** the user on Activity commits `#myproject #codex #7d >cost >bash`, then presses browser Back once
- **THEN** Activity shows again with the filters it had before the commit and no inspector open

### Requirement: Later page wins
When a commit names two pages, the later one SHALL win. The earlier page's chip SHALL show that it was replaced and SHALL NOT apply.

#### Scenario: Two pages
- **WHEN** the chips are `>errors` and then `>cost`
- **THEN** the `>errors` chip shows as replaced by Cost, and Enter opens Cost

### Requirement: Later single-valued filter wins
Project, source and range each hold one value. When a commit names a second value of one of them, the later value SHALL replace the earlier chip.

#### Scenario: Two ranges
- **WHEN** the chips are `#7d` and the user picks `#90d`
- **THEN** the `#7d` chip is replaced by `#90d`

#### Scenario: Two projects
- **WHEN** the chips are `#alpha` and the user picks `#beta`
- **THEN** only `#beta` remains and the commit filters to `beta`

### Requirement: One sheet per commit
A commit SHALL open at most one sheet. When a commit names a second inspector, the later one SHALL replace the earlier chip.

#### Scenario: Two inspectors
- **WHEN** the chips are `>bash` and the user picks `>read`
- **THEN** only `>Read` remains and Enter opens the `Read` inspector

### Requirement: A page-bound sheet implies its page
A sheet that only one page hosts SHALL take the commit to that page. Error categories live on Errors. When a page chosen after such a sheet cannot host it, the later page SHALL win and the sheet's chip SHALL show that it was dropped.

#### Scenario: Error category from Activity
- **WHEN** the user on Activity commits `>timeout` picked as the `Command timed out` category
- **THEN** Errors opens on that category, and the footer said so before Enter

#### Scenario: Page after a category
- **WHEN** the chips are `>timeout` (a category) and then `>cost`
- **THEN** the category chip shows as dropped, and Enter opens Cost with no category

### Requirement: A sheet without a page stays where it can
A `>` sheet without a page SHALL open on the current page when that page hosts the sheet, and otherwise on Activity. Activity, Cost and Errors host the tool, MCP server, skill and session sheets. Limits hosts none.

#### Scenario: On a hosting page
- **WHEN** the user on Errors commits `>bash`
- **THEN** the `Bash` inspector opens over Errors

#### Scenario: On Limits
- **WHEN** the user on Limits commits `>bash`
- **THEN** Activity opens with the `Bash` inspector, and the footer said so before Enter

### Requirement: Tools are not filters
A `#` term that matches a tool, MCP server or skill SHALL NOT become a filter. The palette SHALL offer that subject's inspector instead, as a row like "Bash · open inspector (>)", and picking it SHALL add a `>` chip.

#### Scenario: Tool typed after `#`
- **WHEN** the user types `#bash`
- **THEN** the list offers "Bash · open inspector (>)" and no `#Bash` filter, and picking it adds a `>Bash` chip

### Requirement: Accessible by keyboard and screen reader
Every palette action SHALL be possible from the keyboard alone. The input SHALL be a combobox that controls a listbox of suggestions, with the highlighted option exposed as the active descendant. Chips SHALL be named controls that say what removing them does. Changes to the chips and the footer SHALL be announced.

#### Scenario: Screen reader reads the highlight
- **WHEN** a screen reader user presses Down in the palette
- **THEN** the screen reader reads the highlighted option with its kind and counts, and its position in the list

#### Scenario: Chip removal announced
- **WHEN** the user removes the `#codex` chip with Backspace
- **THEN** the screen reader announces that the Codex filter was removed

#### Scenario: Page behind is out of reach
- **WHEN** the palette is open
- **THEN** keyboard focus and the screen reader stay inside the palette, and the page behind it cannot be reached until the palette closes
