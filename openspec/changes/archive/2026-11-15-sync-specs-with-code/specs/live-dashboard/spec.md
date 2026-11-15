## MODIFIED Requirements

### Requirement: Show each session in its rail entry
Each rail entry SHALL show the session's title as its main line, then the project with its color, the state and the source on its second line, and the cost so far. An entry with no title SHALL show the project as its main line, and its second line SHALL hold the state, the source and the branch. An entry in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and an entry running a tool SHALL show the tool's name and how long it has run, such as `Bash 12s`.

#### Scenario: Two sessions in one project
- **WHEN** two `ai-ledger` sessions are active with the AI titles "Add session titles" and "Fix Cost test"
- **THEN** their rail entries show those titles as their main lines, and `ai-ledger` on their second lines

#### Scenario: Prompt title under Full text
- **WHEN** an active session has no agent title and Full text is off
- **THEN** its entry shows the project as its main line, and when Full text is turned on it shows the title made from its first prompt

#### Scenario: Untitled entry
- **WHEN** an active session on branch `main` has no title
- **THEN** its entry shows the project as its main line, and its second line shows the state, the source and `main`

#### Scenario: How long on your turn
- **WHEN** a session has been in your turn for 4 minutes
- **THEN** its entry shows 4m 00s beside the state, and the figure counts up

#### Scenario: How long idle
- **WHEN** a session has been idle for 7 minutes
- **THEN** its entry shows `idle 7m 00s`

#### Scenario: A running tool
- **WHEN** a session has run a `Bash` call for 12 seconds
- **THEN** its entry shows `Bash 12s` as the state

### Requirement: Show each session on its wall tile
A wall tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. A tile in *your turn*, *thinking* or *idle* SHALL show how long the session has been in that state, and one running a tool its name and run time. A tile in *your turn* SHALL have a border. The title SHALL take one line under the project, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL leave that line out.

#### Scenario: Long title on a tile
- **WHEN** a session's title is wider than its tile
- **THEN** the tile shows the title on one line, cut with an ellipsis, and hovering it shows the full title

#### Scenario: Your turn tile
- **WHEN** a session is in your turn
- **THEN** its tile has a border and shows how long the session has waited
