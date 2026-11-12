# Spec Delta

## MODIFIED Requirements

### Requirement: Show cost per outcome
The cost dashboard SHALL show cost per commit and cost per prompt per project, and SHALL point out a project (or, inside one project, a session) whose cost per commit is more than twice the median and that holds at least 2% of the view's spend. The median project SHALL be taken over projects big enough to compare: those with at least 2% of the view's estimated cost or at least 10 prompts, and, for cost per commit, at least 3 commits. Among findings of equal severity, the one with more money at stake SHALL lead.

#### Scenario: Cost-per-commit outlier
- **WHEN** one project with three or more commits costs four times the median project per commit
- **THEN** the cost dashboard names that project as an outlier and offers to compare projects

#### Scenario: Small outlier
- **WHEN** the project with the highest cost per commit holds 1% of the spend
- **THEN** the cost dashboard does not name it as an outlier

#### Scenario: Project with no commits
- **WHEN** a project has cost but no commits in the range
- **THEN** its cost per commit shows as not available, not as zero or infinity

#### Scenario: Scratch projects
- **WHEN** many one-prompt projects with near-zero cost sit beside three real projects
- **THEN** the real projects are compared with the median of the real projects, the scratch projects show their values untinted, and the table says which projects the median covers

#### Scenario: Too few projects to compare
- **WHEN** fewer than three projects are big enough to compare
- **THEN** the table tints no cell

## ADDED Requirements

### Requirement: Sort cost by project
The cost dashboard SHALL sort the cost-by-project table by any column, by click or keyboard, marking the sorted column with `aria-sort`. The default SHALL be cost, highest first. A project with no value in the column SHALL come last in either direction. Comparing projects from the cost-per-commit finding SHALL sort by cost per commit, highest first, ring the outlier and say how far it sits from the median, and a control in that note SHALL return to the default sort. The sort SHALL reset when the view changes.

#### Scenario: Sort by a column
- **WHEN** the user selects the Cost / commit header twice
- **THEN** the table lists projects by cost per commit, highest then lowest first, projects without commits last both times

#### Scenario: Compare projects
- **WHEN** the user compares projects from an outlier finding
- **THEN** the table is sorted by cost per commit, highest first, with the outlier ringed and focused
