# Spec Delta

## ADDED Requirements

### Requirement: Search the project picker
Every page with the project picker SHALL offer a labelled search box next to it when the picker lists more than 12 projects. The box SHALL narrow the picker's options to the projects whose names contain the typed text, ignoring case. "All projects" and the selected project SHALL stay listed, clearing the box SHALL restore the full list, and the page SHALL say when no project matches. With 12 projects or fewer there SHALL be no search box. Selecting a project SHALL write the URL as before.

#### Scenario: Narrow a long list
- **WHEN** the picker lists 14 projects and the user types `atl`
- **THEN** it lists All projects, the selected project and the projects whose names contain `atl`

#### Scenario: Nothing matches
- **WHEN** the typed text matches no project
- **THEN** the picker still lists All projects and the page says "No project matches"

#### Scenario: Short list
- **WHEN** the picker lists 12 projects
- **THEN** no search box is shown
