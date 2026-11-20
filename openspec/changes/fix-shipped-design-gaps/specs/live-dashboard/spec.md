## MODIFIED Requirements

### Requirement: Show each session on its wall tile
A wall tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. The error count SHALL agree in number with its noun: "1 error", "2 errors". A tile in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and one running a tool its name and run time. A tile in *your turn* SHALL have a border. The title SHALL take one line under the project, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL leave that line out.

#### Scenario: Long title on a tile
- **WHEN** a session's title is wider than its tile
- **THEN** the tile shows the title on one line, cut with an ellipsis, and hovering it shows the full title

#### Scenario: Your turn tile
- **WHEN** a session is in your turn
- **THEN** its tile has a border and shows how long the session has waited

#### Scenario: One error
- **WHEN** a session has one failed tool call
- **THEN** its tile reads "1 error"
