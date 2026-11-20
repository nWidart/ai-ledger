## MODIFIED Requirements

### Requirement: Cover the places that show subjects
The menu SHALL open on every row, card and name that stands for a subject: the rows of the dashboard tables and drawers, the rows of the project, session and tool sheets, the sessions of the Live rail and wall, the error type rows of Errors, every link that opens a session sheet in place (Errors' examples, Insights' session cards, Live's stream), and project names shown with their dot. A project name inside another subject's row or card SHALL open that subject's menu. An "Other" or long-tail row that stands for no single subject SHALL open no menu.

#### Scenario: Project name inside a session row
- **WHEN** the user right-clicks the project name shown in a session row or on a Live wall tile
- **THEN** the session's menu opens, not the project's

#### Scenario: Live wall tile
- **WHEN** the user right-clicks a session tile on the Live wall
- **THEN** the session's menu opens

#### Scenario: Session link on an example
- **WHEN** the user right-clicks the session link of an example on Errors
- **THEN** that session's menu opens

#### Scenario: Other row
- **WHEN** the user right-clicks the "Other" row of the Context contributors table
- **THEN** the browser's menu shows

### Requirement: Offer a session's actions
A session's menu SHALL offer: Open session, Open project page, Copy resume command, Copy session ID, and Copy working directory. Open session SHALL open the session sheet as the palette opens it. Open project page SHALL be left out when the session has no project or the page is that project's page. Copy working directory SHALL be left out when the store has no working directory for the session.

#### Scenario: Open a session from Live
- **WHEN** the user on `/live?session=s1` picks Open session in the menu of session `abc`
- **THEN** the session sheet opens over Live at `/live?session=s1&sheet=abc`, and the stream keeps following `s1`

#### Scenario: Open a session from Limits
- **WHEN** the user picks Open session in a session's menu on Limits
- **THEN** the session sheet opens on Activity, as the palette's session destination does from a page that hosts no sheet

#### Scenario: Session without a working directory
- **WHEN** the user opens the menu of a session the store holds no working directory for
- **THEN** the menu has no Copy working directory item
