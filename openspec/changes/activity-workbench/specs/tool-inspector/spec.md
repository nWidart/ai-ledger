# Spec Delta

## MODIFIED Requirements

### Requirement: Open the inspector from tool rows and names
The inspector SHALL open from tool, MCP server and skill rows in Activity's Tools and MCP tab, from tool rows in the session sheet, and from tool names on the Errors page.

#### Scenario: From the tools drawer
- **WHEN** the user clicks the `Bash` row in Activity's Tools and MCP tab
- **THEN** the inspector opens for `Bash`

#### Scenario: From the session sheet
- **WHEN** the user clicks a tool row in a session sheet
- **THEN** the inspector opens for that tool in place of the session sheet, and browser Back returns to the session

#### Scenario: From the Errors page
- **WHEN** the user clicks the tool name of an error example
- **THEN** the inspector opens for that tool in the Errors page's view

### Requirement: Keep the inspector in the URL
The open inspector SHALL be kept in the page URL, so reload and a copied link reopen it, and browser Back closes it. A session opened from the inspector SHALL offer ← Back to the inspector. Closing a sheet the page opened SHALL return to the history entry it opened from, so it adds no entry that Back would reopen.

#### Scenario: Reload with the inspector open
- **WHEN** the user reloads Activity with the inspector open for `Grep`
- **THEN** the inspector for `Grep` opens again

#### Scenario: Back from a session
- **WHEN** the user opens a session from the `Bash` inspector and presses ← Back
- **THEN** the `Bash` inspector shows again

#### Scenario: Back after closing
- **WHEN** the user opens the `Bash` inspector from the Tools and MCP tab, closes it, then presses browser Back
- **THEN** the browser leaves the page's current view, without reopening the inspector
