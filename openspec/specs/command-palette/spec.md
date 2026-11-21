# command-palette Specification

## Purpose

The keyboard command palette: one input that narrows the view with `#` filters, goes to a page or inspector or runs a command with `>`, and writes the whole result to the URL in one step, so a combined view takes one gesture instead of many clicks.

## Requirements

### Requirement: Open the palette
Every dashboard page SHALL open the palette on Cmd+K on macOS and Ctrl+K on other systems, also while focus is in a page control. The navigation SHALL show a button that opens the palette and shows the shortcut for the user's system. The button's accessible name SHALL include "Search" and any text the button shows. The palette SHALL open with its input focused.

#### Scenario: Shortcut on macOS
- **WHEN** the user presses Cmd+K on any dashboard page on macOS
- **THEN** the palette opens with its input focused, and the browser's own Cmd+K action does not run

#### Scenario: Shortcut on other systems
- **WHEN** the user presses Ctrl+K on Activity on Linux or Windows
- **THEN** the palette opens with its input focused

#### Scenario: Navigation button
- **WHEN** the user views any dashboard page
- **THEN** the navigation shows a palette button with the hint `⌘K` on macOS or `Ctrl K` elsewhere, and clicking it opens the palette

#### Scenario: Button name
- **WHEN** a speech-input user says "click Search"
- **THEN** the palette button is the target, because its accessible name includes "Search"

#### Scenario: Shortcut while a sheet is open
- **WHEN** an inspector sheet is open and the user presses the shortcut
- **THEN** the palette opens above the sheet

### Requirement: Narrow with `#` filters
A `#` term SHALL select a filter: a project, a source (`#claude` for Claude Code, `#codex` for Codex, `#grok` for Grok), a time range (`#7d`, `#14d`, `#30d`, `#90d`, `#all`) or `#automated` to include automated sessions. Several `#` filters SHALL combine, and each SHALL write the same URL state as the page's own filter controls.

#### Scenario: Three filters on a page
- **WHEN** the user commits `#myproject #codex #7d >cost`
- **THEN** Cost opens filtered to project `myproject`, Codex and the last 7 days

#### Scenario: Grok source
- **WHEN** the user commits `#grok >activity`
- **THEN** Activity opens with the source filter on Grok, and the URL records `source=grok`

#### Scenario: All time and automated sessions
- **WHEN** the user commits `#all #automated` on Activity
- **THEN** Activity shows all time with automated sessions included, as if the user had picked All and turned on the automated control

#### Scenario: Automated sessions on Errors
- **WHEN** the user commits `#automated` while on Errors
- **THEN** the URL records the choice, Errors keeps showing automated sessions as it always does, and the choice applies on Activity and Cost

### Requirement: Go to a page with `>`
A `>` term naming a page (Live, Limits, Activity, Cost, Context, Errors) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them. When the palette's chips or the current view name a project, `>project` SHALL open the Project page for that project; with no project, the palette SHALL NOT offer the bare Project page.

#### Scenario: Page only
- **WHEN** the user views project `myproject` for the last 14 days on Activity and commits `>errors`
- **THEN** Errors opens filtered to `myproject` and the last 14 days

#### Scenario: Page and filter
- **WHEN** the user commits `>errors #myproject` on any page
- **THEN** the URL becomes `/errors?project=myproject` with the other current filters, and Errors shows `myproject`

#### Scenario: No filters set
- **WHEN** the user has no filters on Activity, the last Errors view saved in the browser was project `other`, and the user commits `>errors`
- **THEN** Errors opens with no project filter, matching the view the user came from

#### Scenario: Go to Live
- **WHEN** the user views project `myproject` on Cost and commits `>live`
- **THEN** Live opens and shows only `myproject` sessions

#### Scenario: Go to Context
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>context`
- **THEN** Context opens filtered to `myproject` and the last 7 days

#### Scenario: Go to a project's page
- **WHEN** the user has no project filter on Cost for the last 7 days and commits `>project #myproject`
- **THEN** the URL becomes `/project?project=myproject&range=7` and the Project page shows `myproject`

#### Scenario: Project page from the current view
- **WHEN** the user views project `myproject` on Activity and commits `>project`
- **THEN** the Project page opens on `myproject`

#### Scenario: No project named
- **WHEN** the user has no project filter, no project chip, and no project whose name matches `proj`, and types `>proj`
- **THEN** the list offers no Project page

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
- **WHEN** the user opens the palette on Activity with `?project=myproject&source=codex`
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
Up and Down SHALL move the highlight through the suggestions. Once the user moves the highlight, it SHALL stay on that suggestion when suggestions load later or change order. Tab SHALL add the highlighted suggestion as a chip and keep the palette open. Enter SHALL add the highlighted suggestion, if any, and commit. Esc SHALL close the palette without changing the view and return focus to where it was.

#### Scenario: Tab then Enter
- **WHEN** the user types `myp`, presses Tab, types `>bas` and presses Enter
- **THEN** `myproject` becomes a chip after Tab, and Enter opens the `Bash` inspector scoped to `myproject`

#### Scenario: Escape
- **WHEN** the user has added chips and presses Esc
- **THEN** the palette closes, the URL is unchanged, and focus returns to the control that had it before the palette opened

#### Scenario: Suggestions load after the user moved
- **WHEN** the user types `jobdesk`, presses Down to highlight "jobdesk · open project page", and matching sessions then load above that row
- **THEN** the highlight stays on the project page row, and Enter opens the Project page for `jobdesk`

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
A sheet that only one page hosts SHALL take the commit to that page. Error categories live on Errors; every other sheet is hosted by every page. When a page chosen after a category is not Errors, the later page SHALL win and the category's chip SHALL show that it was dropped.

#### Scenario: Error category from Activity
- **WHEN** the user on Activity commits `>timeout` picked as the `Command timed out` category
- **THEN** Errors opens on that category, and the footer said so before Enter

#### Scenario: Page after a category
- **WHEN** the chips are `>timeout` (a category) and then `>cost`
- **THEN** the category chip shows as dropped, and Enter opens Cost with no category

### Requirement: A sheet without a page stays where it can
A `>` tool, MCP server, skill or session sheet without a page SHALL open on the current page, whatever the page: the app's shell hosts those sheets on every page, Limits included. With a page chip, it SHALL open on that page.

#### Scenario: On a hosting page
- **WHEN** the user on Errors commits `>bash`
- **THEN** the `Bash` inspector opens over Errors

#### Scenario: On Context
- **WHEN** the user on Context commits `>bash`
- **THEN** the `Bash` inspector opens over Context

#### Scenario: On the Project page
- **WHEN** the user on the Project page of `foo` commits `>bash`
- **THEN** the `Bash` inspector opens over the Project page

#### Scenario: On Limits
- **WHEN** the user on Limits commits `>bash`
- **THEN** the `Bash` inspector opens over Limits, at `/limits?tool=Bash`

#### Scenario: On the Judgments view
- **WHEN** the user on `/usage?range=7&view=judgments` commits a session
- **THEN** the session sheet opens over the Judgments view, with the view kept in the URL

### Requirement: Keep the followed session on Live
On Live, the session sheet SHALL be named under `sheet`, and opening any sheet SHALL keep `session`, the session the stream follows, even when the same commit changes the project or source. A commit that changes the project or source and opens no sheet SHALL drop `session`.

#### Scenario: On Live
- **WHEN** the user on `/live?session=s1` commits a session chip for `abc`
- **THEN** the URL is `/live?session=s1&sheet=abc`, the session sheet opens over Live and the stream keeps following `s1`

#### Scenario: On Live, with a new project
- **WHEN** the user on `/live?project=foo&session=s1` changes the project chip to `bar` and commits a session chip for `abc`
- **THEN** the URL is `/live?project=bar&session=s1&sheet=abc`, and the stream keeps following `s1`; changing the project alone starts the stream over

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

### Requirement: Leave keys to the input method
While an input method (IME) is composing text in the palette input, Enter, Tab, and the Up and Down keys SHALL be left to the input method: they SHALL NOT commit, add a chip or move the highlight. Once the composition ends, they SHALL act as in Keyboard controls.

#### Scenario: Confirm a composition with Enter
- **WHEN** the user composes Japanese text in the palette and presses Enter to confirm a conversion
- **THEN** the text is entered, no chip is added, and the palette does not commit

#### Scenario: Enter after the composition
- **WHEN** the composition has ended and the user presses Enter
- **THEN** the palette commits as usual

### Requirement: Announce a copied link as a status
The message that `>copy link` shows, "Link copied" or that the link could not be copied, SHALL be a polite status (`role="status"`), present in the page before the message is set so that a screen reader says it once, and SHALL leave after a few seconds.

#### Scenario: Link copied
- **WHEN** the user commits `>copy link` and the browser allows the copy
- **THEN** a status reading "Link copied" shows and a screen reader says it once, without moving focus

### Requirement: Offer a project's page from its match
Typed text with no sigil or with `>` SHALL also list a row that opens the page of each of the best three matching projects, in the Page group. Picking it SHALL add the project filter and the Project page together, announced in one message. The row SHALL NOT show for `#` terms, for empty text, or when picking it would change nothing. With no sigil it SHALL NOT count as an exact match.

#### Scenario: Type a project's name
- **WHEN** the user on Cost for the last 7 days types `jobdesk` and commits the row "jobdesk · open project page"
- **THEN** the URL becomes `/project?project=jobdesk&range=7` and the Project page shows `jobdesk`

#### Scenario: Name then another page
- **WHEN** the user types `jobdesk >errors` and commits
- **THEN** `jobdesk` becomes a project chip and Errors opens filtered to `jobdesk`

#### Scenario: Name with `>`
- **WHEN** the user types `>jobdesk #7d`
- **THEN** `>jobdesk` becomes the project filter and Project page chips, and Enter opens the Project page of `jobdesk` for the last 7 days

#### Scenario: Filters only
- **WHEN** the user types `#job`
- **THEN** the list shows the project `jobdesk` as a filter and no project-page row

#### Scenario: Project already filtered
- **WHEN** the user views `jobdesk` on Cost, opens the palette and types `jobdesk`
- **THEN** the list offers the row "jobdesk · open project page"

#### Scenario: Already on the page
- **WHEN** the user views `jobdesk` on the Project page, opens the palette and types `jobdesk`
- **THEN** the list offers no row for the page of `jobdesk`

### Requirement: Show the project filter on the palette button
While a project filter is set, the palette button SHALL show the project's color dot and its name, cut short with an ellipsis when long, in place of the "Search" label, and SHALL name the project in its accessible name. When the button shows only its icon, it SHALL keep the dot. With no project filter, the button SHALL show "Search".

#### Scenario: Project filter set
- **WHEN** the user views Errors with the project filter `ai-ledger`
- **THEN** the palette button shows the `ai-ledger` dot and name, and its accessible name includes "Search" and "ai-ledger"

#### Scenario: Narrow window
- **WHEN** the window is too narrow for the button's text and the project filter is `ai-ledger`
- **THEN** the button shows the search icon and the `ai-ledger` dot

#### Scenario: No project filter
- **WHEN** the user views Errors with no project filter
- **THEN** the palette button shows "Search"

### Requirement: Go to the Judgments view with `>`
`>judgments` SHALL open Activity's Judgments view, and `>insights`, its name when it was a page, SHALL find the same row. The row SHALL follow Activity in the list and say it is an Activity view. A move between Overview and Judgments SHALL carry the shared filters and leave the other view's own keys behind, as the view switch does. `>activity` from the Judgments view SHALL open Overview. When the filters name one source other than Claude Code, the footer SHALL say that Overview opens.

#### Scenario: Open Judgments
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>judgments`
- **THEN** the URL becomes `/usage?project=myproject&range=7&view=judgments`, and the footer said "open Judgments" before Enter

#### Scenario: The old name
- **WHEN** the user types `>insights`
- **THEN** the first row is Judgments

#### Scenario: Back to Overview
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved` commits `>activity`
- **THEN** the URL becomes `/usage?range=7`

#### Scenario: Codex only
- **WHEN** the chips are `#codex` and `>judgments`
- **THEN** the footer says Codex has no judgments and that Overview opens

#### Scenario: Grok only
- **WHEN** the chips are `#grok` and `>judgments`
- **THEN** the footer says Grok has no judgments and that Overview opens

### Requirement: Open the docs with `>`
A `>` term SHALL also name a docs command. "Docs: this page" SHALL open the documentation page for the current page, as the navigation's Docs link does. Each page of the documentation SHALL have a command named "Docs: " and its title, which opens that page. A docs command SHALL match "docs", "documentation", "help" and its page's title, and SHALL open its page in a new tab with no referrer.

#### Scenario: Docs for this page
- **WHEN** the user on Cost commits `>docs: this page`
- **THEN** `https://nwidart.github.io/ai-ledger/pages/cost/` opens in a new tab, the palette closes, and the view is unchanged

#### Scenario: A docs page by name
- **WHEN** the user types `>docs windows`
- **THEN** "Docs: Context windows and plan limit windows" is offered, and Enter opens `concepts/windows/` in a new tab

#### Scenario: Footer
- **WHEN** "Docs: this page" is highlighted on Errors
- **THEN** the footer says that Enter opens the Errors docs in a new tab

### Requirement: Apply the other chips with a docs command
A docs command SHALL take the command slot, as the other commands do, and the other chips SHALL still apply to the view. When the user types a page's name, the page's own row SHALL rank above its docs command.

#### Scenario: With a filter
- **WHEN** the user commits `#myproject >docs: this page` on Errors
- **THEN** Errors shows `myproject`, and the Errors docs open in a new tab

#### Scenario: The page first
- **WHEN** the user types `>cost`
- **THEN** the first row is the Cost page, and its docs command follows it
