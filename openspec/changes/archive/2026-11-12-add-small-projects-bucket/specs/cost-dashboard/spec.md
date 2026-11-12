# Spec Delta

## ADDED Requirements

### Requirement: Fold small projects
The cost-by-project table SHALL fold the projects too small to compare, those outside the set the medians use (under 2% of the view's cost and under 10 prompts), into one "Small projects (N)" row after the big projects, whatever the sort. The row SHALL show their summed cost, tokens and commits and a button, with `aria-expanded`, that shows or hides them. Shown, they SHALL follow the big projects in the current sort order. The table SHALL fold only with at least 3 small projects and at least 1 big project. The selected project and the project ringed by "Compare projects" SHALL NOT be hidden: when one is small, the small projects SHALL show. The shown or hidden state SHALL reset when the view changes. The drawer's count SHALL stay the number of all projects.

#### Scenario: Scratch projects fold
- **WHEN** a view has three big projects and four small ones
- **THEN** the table shows the three big projects and a "Small projects (4)" row with their summed cost, tokens and commits

#### Scenario: Show the small projects
- **WHEN** the user selects "Show 4 small projects"
- **THEN** the four projects appear below the big ones and the button reads "Hide small projects" with `aria-expanded` true

#### Scenario: A small project is selected
- **WHEN** the project filter names a small project
- **THEN** the small projects show, with that project among them

#### Scenario: Too few to fold
- **WHEN** a view has fewer than 3 small projects
- **THEN** the table lists every project with no bucket row

## MODIFIED Requirements

### Requirement: Export cost tables
The cost dashboard SHALL let the user download the cost-by-project and most-expensive-sessions tables as CSV, or copy either to the clipboard as tab-separated text. Each export SHALL hold every row of the table, in the order shown (for cost by project, the order the projects have with the small projects shown, even when they are folded), with cost and share figures rounded to 4 decimals and n/a values as empty cells. The buttons SHALL NOT be shown when the table has no rows.

#### Scenario: Download the project table in its sorted order
- **WHEN** the user sorts the cost-by-project table by cost per commit and selects "Download CSV"
- **THEN** the file lists the projects in that order, with a header row and CRLF line ends

#### Scenario: Download with small projects folded
- **WHEN** the table folds four small projects and the user selects "Download CSV"
- **THEN** the file lists every project, the small ones after the big ones

#### Scenario: Copy a table
- **WHEN** the user selects "Copy"
- **THEN** the clipboard receives the rows as tab-separated text, and the button reads "Copied" for about 2 seconds

#### Scenario: Copy fails
- **WHEN** the clipboard is unavailable or refuses the text
- **THEN** the button reads "Copy failed" and the status is announced

#### Scenario: No rows
- **WHEN** the sessions table has no rows
- **THEN** no export button is shown
