# Spec Delta

## ADDED Requirements

### Requirement: Export cost tables
The cost dashboard SHALL let the user download the cost-by-project and most-expensive-sessions tables as CSV, or copy either to the clipboard as tab-separated text. Each export SHALL hold exactly the rows the table shows, in the order shown, with cost and share figures rounded to 4 decimals and n/a values as empty cells. The buttons SHALL NOT be shown when the table has no rows.

#### Scenario: Download the project table in its sorted order
- **WHEN** the user sorts the cost-by-project table by cost per commit and selects "Download CSV"
- **THEN** the file lists the projects in that order, with a header row and CRLF line ends

#### Scenario: Copy a table
- **WHEN** the user selects "Copy"
- **THEN** the clipboard receives the rows as tab-separated text, and the button reads "Copied" for about 2 seconds

#### Scenario: Copy fails
- **WHEN** the clipboard is unavailable or refuses the text
- **THEN** the button reads "Copy failed" and the status is announced

#### Scenario: No rows
- **WHEN** the sessions table has no rows
- **THEN** no export button is shown

### Requirement: Name and guard exported files
The CSV file name SHALL be `ai-ledger-cost-projects-<date>.csv` or `ai-ledger-cost-sessions-<date>.csv`, dated today, or with the selected day's date when a day is selected in the sessions table. Text cells that start with `=`, `+`, `-` or `@` SHALL be prefixed with an apostrophe; numbers SHALL NOT.

#### Scenario: Formula text
- **WHEN** a project name starts with `=`
- **THEN** its exported cell starts with an apostrophe, and a negative number is exported without one

#### Scenario: Session file on a selected day
- **WHEN** the user selects a day in the sessions table and downloads it
- **THEN** the file name carries that day's date
