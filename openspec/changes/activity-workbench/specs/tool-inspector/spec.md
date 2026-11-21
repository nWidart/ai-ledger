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
