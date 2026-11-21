## ADDED Requirements

### Requirement: Cover the session lists, fix rows, tool names and project grids
The menu SHALL also open, on the subject each stands for, on the session buttons of Activity's Error loops and Failed test runs, of Context's quadrant list and window pressure list, on the rows of Errors' Applied fixes whose type has errors in the view, on an Errors example's tool name, and on each of Context's small window grids. A fix row with no error in the view and a grid with no project SHALL open none.

#### Scenario: A session in an error loop
- **WHEN** the user right-clicks the session of an error loop on Activity
- **THEN** that session's menu opens

#### Scenario: A quadrant's session
- **WHEN** the user selects a quadrant of Context's session map and right-clicks a session in its list
- **THEN** that session's menu opens

#### Scenario: An applied fix
- **WHEN** the user right-clicks the row of type "File not found" under Applied fixes on Errors, with errors of it in the view
- **THEN** the menu of that error type opens; the row of a fixed type with no error in the view opens none

#### Scenario: An example's tool
- **WHEN** the user right-clicks the tool name `Bash` on an Errors example
- **THEN** the menu of the `Bash` tool opens

#### Scenario: A small window grid
- **WHEN** the user right-clicks the window grid of project `foo` on Context
- **THEN** the menu of `foo` opens; the grid of "(no project)" opens none
