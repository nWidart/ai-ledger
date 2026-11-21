## MODIFIED Requirements

### Requirement: Show the workbench as tabs
Under the vitals, Activity's Overview SHALL show its tables as tabs, in a tab list named "Activity detail": Sessions, Projects, Tools and MCP (tools, MCP servers, skills and hooks), and Loops and tests. Sessions SHALL be the default. The tabs SHALL follow the WAI-ARIA tabs pattern: one tab stop, Left and Right to move with wrap, Home and End, Enter or Space to activate, and the selected panel as the next tab stop.

#### Scenario: Keyboard
- **WHEN** focus is on the Sessions tab and the user presses Left, then Enter
- **THEN** focus moves to Loops and tests, and Enter shows its panel and marks it selected

#### Scenario: Default
- **WHEN** the user opens `/usage?range=30`
- **THEN** the Sessions tab is selected and its panel lists the sessions

#### Scenario: Tab to the panel
- **WHEN** focus is on the selected tab and the user presses Tab
- **THEN** focus moves to the selected tab's panel
