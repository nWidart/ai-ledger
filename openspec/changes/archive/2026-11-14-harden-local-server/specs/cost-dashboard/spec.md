# Spec Delta

## MODIFIED Requirements

### Requirement: Name and guard exported files
The CSV file name SHALL be `ai-ledger-cost-projects-<date>.csv` or `ai-ledger-cost-sessions-<date>.csv`, dated today, or with the selected day's date when a day is selected in the sessions table. Text cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return SHALL be prefixed with an apostrophe; numbers SHALL NOT.

#### Scenario: Formula text
- **WHEN** a project name starts with `=`
- **THEN** its exported cell starts with an apostrophe, and a negative number is exported without one

#### Scenario: Leading tab
- **WHEN** a project name starts with a tab followed by `=1+1`
- **THEN** its exported cell starts with an apostrophe

#### Scenario: Session file on a selected day
- **WHEN** the user selects a day in the sessions table and downloads it
- **THEN** the file name carries that day's date
