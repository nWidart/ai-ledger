## MODIFIED Requirements

### Requirement: Name data tables and their headers
Every data table SHALL have an accessible name, and every header cell SHALL declare its scope (`col` or `row`). Every row that presents data SHALL have a row header scoped to that row and naming it, such as the session of an error loop or the window of a closed window. The row header SHALL come before the row's data cells, since it names only the cells after it. A table wrapper that scrolls sideways SHALL be a named region that takes keyboard focus, so a keyboard user can scroll it.

#### Scenario: Table list
- **WHEN** a screen reader user lists the tables of the Cost page
- **THEN** each is named, such as "Cost by project"

#### Scenario: Wide table
- **WHEN** a table is wider than its wrapper at 520px and the user tabs to it
- **THEN** the wrapper takes focus, says its name, and the arrow keys scroll it

#### Scenario: Row header
- **WHEN** a screen reader user moves down the Failures column of Activity's Error loops table
- **THEN** each value is announced with its row's header, the loop's session

#### Scenario: Row header first
- **WHEN** a screen reader user moves down the When column of Activity's Error loops table
- **THEN** each time is announced with the loop's session, the row header in the table's first column
