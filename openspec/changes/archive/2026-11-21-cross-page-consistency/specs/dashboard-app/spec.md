## ADDED Requirements

### Requirement: Close the session sheet on a project or source change
Picking a project, clearing the project filter or picking a source in the scope bar SHALL close an open session sheet on every page, on Live too, where the session sheet is named under `sheet`.

#### Scenario: Live's sheet
- **WHEN** the user on `/live?sheet=s2` picks Codex
- **THEN** the URL is `/live?source=codex` and the session sheet closes

#### Scenario: Clear on Live
- **WHEN** the user on `/live?project=foo&session=s1&sheet=s2` clears the project filter
- **THEN** the URL is `/live`, with no `session` and no `sheet`
