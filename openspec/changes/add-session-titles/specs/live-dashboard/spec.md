# Spec Delta

## MODIFIED Requirements

### Requirement: Show active sessions in a rail
The Live page SHALL list the active sessions in a rail. Each entry SHALL show the session's title as its main line, then the project with its color, the source and the state on its second line, and the cost so far. An entry with no title SHALL show the project as its main line. Selecting an entry SHALL open that session in the stream. With no session selected, the page SHALL open the newest active session.

#### Scenario: Open Live with two running sessions
- **WHEN** the user opens `/live` while sessions in `ai-ledger` and `jobdesk` are active, and `ai-ledger` wrote last
- **THEN** the rail lists both, and the stream shows `ai-ledger`

#### Scenario: No active session
- **WHEN** no session wrote a line in the last 10 minutes
- **THEN** the page says no session is active and shows when the newest session last wrote, with a link to it on Activity

#### Scenario: Two sessions in one project
- **WHEN** two `ai-ledger` sessions are active with the AI titles "Add session titles" and "Fix Cost test"
- **THEN** their rail entries show those titles as their main lines, and `ai-ledger` on their second lines

#### Scenario: Prompt title under Full text
- **WHEN** an active session has no agent title and Full text is off
- **THEN** its entry shows the project as its main line, and when Full text is turned on it shows the title made from its first prompt

### Requirement: Show all sessions on a wall
The page SHALL offer a Wall view with one tile per active session. A tile SHALL show the project, state, title, latest action, context fill, tool count, errors, cost, branch, source and model. The title SHALL take one line under the project, cut with an ellipsis when it does not fit, with the full title on hover. A tile with no title SHALL leave that line out. Selecting a tile SHALL open that session in the stream view.

#### Scenario: Pick a session from the wall
- **WHEN** the user selects the `graft` tile on the wall
- **THEN** the stream view opens on `graft`

#### Scenario: Long title on a tile
- **WHEN** a session's title is wider than its tile
- **THEN** the tile shows the title on one line, cut with an ellipsis, and hovering it shows the full title

## ADDED Requirements

### Requirement: Title the stream
The stream SHALL show the selected session's title as a heading above its project, branch, source and model. With no title, the heading SHALL be the project.

#### Scenario: Session with a custom title
- **WHEN** the followed session was renamed "release notes" with `/rename`
- **THEN** the stream's heading is "release notes", with the project and branch below it
