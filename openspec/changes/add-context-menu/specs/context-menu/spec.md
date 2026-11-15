# Spec Delta

## Purpose

A right-click menu on the subjects the dashboards show, projects, sessions, tools and error types, that offers each subject's actions in place, so the user can open, filter or copy without first opening a sheet or the palette.

## ADDED Requirements

### Requirement: Open a subject's menu on right-click
A right-click on a project, a session, a tool, MCP server or skill, or an error type SHALL open a menu of that subject's actions at the pointer, in place of the browser's menu. The menu SHALL show only the actions of the subject under the pointer. A right-click SHALL NOT run the subject's click action.

#### Scenario: Right-click a project row
- **WHEN** the user right-clicks a project row in Activity's projects table
- **THEN** the project's menu opens at the pointer
- **AND** the project sheet does not open

#### Scenario: Right-click a session inside a project row's sheet
- **WHEN** the user right-clicks a session row in an open project sheet
- **THEN** the session's menu opens, not the project's

### Requirement: Leave the browser's menu where the app adds nothing
The browser's own menu SHALL show for a right-click outside a subject, for a right-click while text is selected, and for a right-click with Shift held.

#### Scenario: Right-click outside a subject
- **WHEN** the user right-clicks a page heading or an empty area
- **THEN** the browser's menu shows and no app menu opens

#### Scenario: Right-click selected text in a row
- **WHEN** the user selects text in a session row and right-clicks it
- **THEN** the browser's menu shows, so the text can be copied

#### Scenario: Shift+right-click a subject
- **WHEN** the user holds Shift and right-clicks a project row
- **THEN** the browser's menu shows and no app menu opens

### Requirement: Cover the places that show subjects
The menu SHALL open on every row, card and name that stands for a subject: the rows of the dashboard tables and drawers, the rows of the project, session and tool sheets, the sessions of the Live rail and wall, the error type rows of Errors, and project names shown with their dot. An "Other" or long-tail row that stands for no single subject SHALL open no menu.

#### Scenario: Live wall tile
- **WHEN** the user right-clicks a session tile on the Live wall
- **THEN** the session's menu opens

#### Scenario: Other row
- **WHEN** the user right-clicks the "Other" row of the Context contributors table
- **THEN** the browser's menu shows

### Requirement: Offer a project's actions
A project's menu SHALL offer: Open project page, Open project sheet, Filter dashboard to the project, Show on Cost, Show on Errors, Show on Context, Show on Live, and Copy project name. Open project page SHALL be left out on that project's page. Open project sheet SHALL be left out where the page cannot host the sheet.

#### Scenario: Open the project page
- **WHEN** the user picks Open project page in the menu of project `jobdesk` on Cost with range 7d
- **THEN** the Project page for `jobdesk` opens with range 7d

#### Scenario: Show a project on another page
- **WHEN** the user picks Show on Errors in the menu of project `jobdesk` on Activity
- **THEN** Errors opens filtered to `jobdesk`, with the range, source and automated filters kept

#### Scenario: Already on the project's page
- **WHEN** the user opens the menu of project `jobdesk` on the Project page for `jobdesk`
- **THEN** the menu has no Open project page item

### Requirement: Toggle the project filter from the menu
When the page is not filtered to the project, the filter item SHALL read "Filter dashboard to <project>" and set the project filter. When the page already shows only that project, the item SHALL read "Show all projects" and clear the filter, as the project sheet's filter button does.

#### Scenario: Filter to a project
- **WHEN** the user picks "Filter dashboard to jobdesk" on Activity with no project filter
- **THEN** Activity shows only `jobdesk`

#### Scenario: Clear the filter
- **WHEN** the user opens the menu of project `jobdesk` on Cost filtered to `jobdesk` and picks "Show all projects"
- **THEN** Cost shows every project

### Requirement: Offer a session's actions
A session's menu SHALL offer: Open session, Open project page, Copy resume command, Copy session ID, and Copy working directory. Open session SHALL open the session sheet as the palette opens it. Open project page SHALL be left out when the session has no project. Copy working directory SHALL be left out when the store has no working directory for the session.

#### Scenario: Open a session from Live
- **WHEN** the user picks Open session in the menu of a session on Live
- **THEN** the session sheet opens on Activity, as the palette's session destination does from a page that hosts no sheet

#### Scenario: Session without a working directory
- **WHEN** the user opens the menu of a session the store holds no working directory for
- **THEN** the menu has no Copy working directory item

### Requirement: Copy the command that resumes a session
Copy resume command SHALL copy the command that resumes the session in its agent: `claude --resume <id>` for a Claude Code session and `codex resume <id>` for a Codex session. When the store has the session's working directory, the command SHALL first change to it, `cd '<cwd>' && `, with the directory quoted for a POSIX shell.

#### Scenario: Claude Code session with a directory
- **WHEN** the user picks Copy resume command for Claude Code session `abc` with working directory `/Users/me/my app`
- **THEN** the clipboard holds `cd '/Users/me/my app' && claude --resume abc`

#### Scenario: Codex session
- **WHEN** the user picks Copy resume command for Codex session `def` with no working directory
- **THEN** the clipboard holds `codex resume def`

#### Scenario: Directory with a single quote
- **WHEN** the working directory is `/tmp/it's`
- **THEN** the command starts with `cd '/tmp/it'\''s' && `

### Requirement: Wait for a session's details
A session item that needs details the row does not carry, such as the source, project or working directory, SHALL show as unavailable, with the reason "Loading…", until the details arrive, and SHALL then become available without closing the menu. When the details cannot be loaded, those items SHALL stay unavailable with the reason "Not available", and Open session and Copy session ID SHALL still work.

#### Scenario: Details arrive while the menu is open
- **WHEN** the user opens a session's menu before its details have loaded
- **THEN** Copy resume command shows as unavailable with "Loading…"
- **AND** it becomes available once the details load, with the menu still open

#### Scenario: Details fail
- **WHEN** loading a session's details fails
- **THEN** Copy resume command shows as unavailable with "Not available"
- **AND** Copy session ID still copies the id

### Requirement: Offer a tool's actions
The menu of a tool, MCP server or skill SHALL offer Open inspector and Copy name. Open inspector SHALL open the same sheet the palette opens for that subject.

#### Scenario: Open an MCP server's inspector
- **WHEN** the user picks Open inspector in the menu of an MCP server row on Context
- **THEN** that MCP server's sheet opens on Context

### Requirement: Offer an error type's actions
An error type's menu SHALL offer Open on Errors and Copy name. On Errors it SHALL also offer "Mute this type", or "Unmute" for a muted type, which SHALL write through the same queue and show the same feedback as the type detail's button. The mute item SHALL be left out for `infra` and `user_denied`.

#### Scenario: Open an error type from the Project page
- **WHEN** the user picks Open on Errors in the menu of an error type on the Project page
- **THEN** Errors opens on that type, filtered to the project

#### Scenario: Mute from the menu
- **WHEN** the user picks "Mute this type" in the menu of an error type row on Errors
- **THEN** the type is muted as if the detail's Mute button had been pressed, with the same "Saving…" feedback

#### Scenario: Fixed noise type
- **WHEN** the user opens the menu of the `infra` type on Errors
- **THEN** the menu has no mute item

### Requirement: Navigate from the menu as the app's links do
A menu item that changes the page, the filters or the open sheet SHALL write the URL once, add one browser history entry, and carry the filters as the navigation and the palette carry them. Browser Back SHALL return to the view before the item was picked. Picking any item SHALL close the menu.

#### Scenario: Back after a menu action
- **WHEN** the user picks Show on Cost in a project's menu on Activity and then presses Back
- **THEN** Activity shows again with the view it had before

### Requirement: Announce what a copy did
A copy item SHALL put its text on the clipboard and say "Copied" or that the text could not be copied, as a polite status present in the page before the message is set, so a screen reader says it once.

#### Scenario: Clipboard refused
- **WHEN** the browser refuses the clipboard write for Copy session ID
- **THEN** the status says the text could not be copied

### Requirement: Open and use the menu from the keyboard
Shift+F10 and the context-menu key SHALL open the menu of the focused subject, anchored to it. The menu SHALL be a `menu` of `menuitem`s named after its subject, moved through with Up and Down and picked with Enter. Escape SHALL close it without closing a sheet or the palette, and focus SHALL return to the subject.

#### Scenario: Keyboard open and close
- **WHEN** a session row has focus and the user presses Shift+F10, then Escape
- **THEN** the session's menu opens with its first item highlighted, then closes
- **AND** focus is back on the session row and the open sheet is still open

#### Scenario: Accessible name
- **WHEN** the menu of project `jobdesk` opens
- **THEN** assistive technology reads it as a menu named "jobdesk actions"

### Requirement: Open the menu by long-press
On a touch screen, pressing and holding a subject SHALL open its menu, and SHALL NOT run the subject's tap action.

#### Scenario: Long-press a project row
- **WHEN** the user presses and holds a project row on a phone
- **THEN** the project's menu opens and the project sheet does not

### Requirement: Keep every action reachable without the menu
Every action the menu offers SHALL also be reachable without it, through a visible control, a sheet or the palette. The menu SHALL NOT be the only way to any action.

#### Scenario: Resume command without the menu
- **WHEN** the user opens a session sheet
- **THEN** the sheet shows the session's resume command and working directory, each with a Copy button
