## MODIFIED Requirements

### Requirement: Cover the places that show subjects
The menu SHALL open on every row, card and name that stands for a subject: the rows of the dashboard tables and drawers, the rows of the project, session and tool sheets, the sessions of the Live rail and wall, the error type rows of Errors, every link that opens a session sheet in place (Errors' examples, the session cards of Activity's Judgments view, Live's stream), and project names shown with their dot.

#### Scenario: Live wall tile
- **WHEN** the user right-clicks a session tile on the Live wall
- **THEN** the session's menu opens

#### Scenario: Session link on an example
- **WHEN** the user right-clicks the session link of an example on Errors
- **THEN** that session's menu opens

### Requirement: Offer a project's actions
A project's menu SHALL offer: Open project page, Open project sheet, Filter dashboard to the project, Show on Cost, Show on Errors, Show on Context, Show on Live, and Copy project name. Open project page SHALL be left out on that project's page. Open project sheet SHALL be offered on every page: the app's shell hosts the sheet.

#### Scenario: Open the project page
- **WHEN** the user picks Open project page in the menu of project `jobdesk` on Cost with range 7d
- **THEN** the Project page for `jobdesk` opens with range 7d

#### Scenario: Show a project on another page
- **WHEN** the user picks Show on Errors in the menu of project `jobdesk` on Activity
- **THEN** Errors opens filtered to `jobdesk`, with the range, source and automated filters kept

#### Scenario: Already on the project's page
- **WHEN** the user opens the menu of project `jobdesk` on the Project page for `jobdesk`
- **THEN** the menu has no Open project page item

#### Scenario: Project sheet on Limits
- **WHEN** the user picks Open project sheet in the menu of project `jobdesk` on Limits
- **THEN** the project sheet opens over Limits

### Requirement: Offer a session's actions
A session's menu SHALL offer: Open session, Open project page, Copy resume command, Copy session ID, and Copy working directory. Open session SHALL open the session sheet as the palette opens it. Open project page SHALL be left out when the session has no project or the page is that project's page. Copy working directory SHALL be left out when the store has no working directory for the session.

#### Scenario: Open a session from Live
- **WHEN** the user on `/live?session=s1` picks Open session in the menu of session `abc`
- **THEN** the session sheet opens over Live at `/live?session=s1&sheet=abc`, and the stream keeps following `s1`

#### Scenario: Open a session from Limits
- **WHEN** the user picks Open session in a session's menu on Limits
- **THEN** the session sheet opens over Limits, as the palette's session destination does on every page

#### Scenario: Session without a working directory
- **WHEN** the user opens the menu of a session the store holds no working directory for
- **THEN** the menu has no Copy working directory item
