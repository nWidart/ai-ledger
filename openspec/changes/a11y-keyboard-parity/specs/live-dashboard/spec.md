## MODIFIED Requirements

### Requirement: Show each session on its wall tile
A wall tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. The error count SHALL agree in number with its noun: "1 error", "2 errors". The tile SHALL be a toggle named "Pin" and the session's name, with a pressed state that says whether it is pinned, and SHALL give a screen reader all it shows as its description.

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile reads "1 error"

#### Scenario: A screen reader on a tile
- **WHEN** a screen reader reaches the tile of a session titled "Fix login" in project foo
- **THEN** it reads "Pin Fix login", not pressed, then the project, state, latest action, context, tools, errors, cost, branch, source and model
