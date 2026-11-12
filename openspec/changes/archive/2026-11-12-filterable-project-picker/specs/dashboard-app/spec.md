# Spec Delta

## MODIFIED Requirements

### Requirement: Search the project picker
Every page with the project picker SHALL show it as one filterable dropdown: a labelled field that holds the selected project, or "All projects", with the projects in a popup below it. Typing in the field SHALL open the popup and list the projects whose names contain the typed text, ignoring case. "All projects" SHALL stay listed, after the matches. Clearing the field SHALL list every project, and the popup SHALL say when no project matches.

#### Scenario: Narrow a long list
- **WHEN** the picker lists 14 projects and the user types `atl`
- **THEN** the popup lists the projects whose names contain `atl`, then All projects

#### Scenario: Nothing matches
- **WHEN** the typed text matches no project
- **THEN** the popup still lists All projects and says "No project matches"

#### Scenario: Short list
- **WHEN** the picker lists 2 projects
- **THEN** the field filters them the same way

## ADDED Requirements

### Requirement: Pick a project from the filterable picker
Typing in the project picker SHALL replace the name the field holds, and Enter SHALL select the first match. The popup SHALL float over the page and the field SHALL keep its width, so typing moves no other control. Closing the popup without a selection SHALL put the selected project back in the field. Selecting a project SHALL write the URL as before.

#### Scenario: Enter takes the first match
- **WHEN** the field holds `atlas-api`, and the user types `led` and presses Enter
- **THEN** the field held only `led`, and the first project whose name contains `led` is selected

#### Scenario: Typing moves nothing
- **WHEN** the user types in the field
- **THEN** the controls after it stay where they were

#### Scenario: Leave without selecting
- **WHEN** the user types `atl` and presses Escape
- **THEN** the popup closes, the field shows the selected project again and the URL is unchanged
