## MODIFIED Requirements

### Requirement: Name data tables and their headers
Every data table SHALL have an accessible name, and every header cell SHALL declare its scope (`col` or `row`). Every row of a data table's body SHALL have a row header: a header cell scoped to the row that names it, such as the session of an error loop or the window of a closed window. A table wrapper that scrolls sideways SHALL be a named region that takes keyboard focus, so a keyboard user can scroll it.

#### Scenario: Table list
- **WHEN** a screen reader user lists the tables of the Cost page
- **THEN** each is named, such as "Cost by project"

#### Scenario: Wide table
- **WHEN** a table is wider than its wrapper at 520px and the user tabs to it
- **THEN** the wrapper takes focus, says its name, and the arrow keys scroll it

#### Scenario: Row header
- **WHEN** a screen reader user moves down the Failures column of Activity's Error loops table
- **THEN** each value is announced with its row's header, the loop's session
