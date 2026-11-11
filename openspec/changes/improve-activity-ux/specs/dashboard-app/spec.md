# Spec Delta

## MODIFIED Requirements

### Requirement: Exclude automated sessions by default
Every page with the automated filter (Activity, Cost, Insights, Live) SHALL leave out automated sessions from every figure, chart and table, and SHALL offer a control to include them. A session is automated when it belongs to a known automated project (today `observer-sessions`, and every project listed in the automated projects file), when it has no user prompt, or when it ran in a temporary folder (project `(temp)`) with at most one user prompt. The choice SHALL be kept in the page URL and carried across pages. A project filter that names an automated project SHALL include that project's sessions; naming `(temp)` SHALL NOT include its automated sessions.

#### Scenario: Default view
- **WHEN** the store holds 631 `observer-sessions` sessions and 872 other sessions in the last 30 days
- **THEN** Activity counts 872 sessions for that range and `observer-sessions` does not appear in its tables or the project picker

#### Scenario: Include automated sessions
- **WHEN** the user turns on the control to include automated sessions
- **THEN** Activity counts 1,503 sessions, `observer-sessions` appears in its tables, and the URL records the choice

#### Scenario: Filter names an automated project
- **WHEN** the user opens Activity with `#project=observer-sessions` and the control off
- **THEN** Activity shows the `observer-sessions` sessions, and the project picker shows `observer-sessions` as the selected project

#### Scenario: Helper sessions in a temporary folder
- **WHEN** an app ran 170 one-prompt sessions in temporary folders and a person ran one session with three prompts in `/tmp`
- **THEN** Activity leaves the 170 out and counts the person's session under `(temp)`, and the control brings the 170 back

#### Scenario: Session with no prompt
- **WHEN** a Codex session makes requests without any user prompt
- **THEN** Activity, Cost, Insights and Live leave it out until the user turns on the control

#### Scenario: Project from the automated projects file
- **WHEN** the automated projects file lists `docs-bot` and the user reloads Activity with the control off
- **THEN** `docs-bot` sessions are left out of every figure and the project picker, with no rebuild, and the control brings them back

## ADDED Requirements

### Requirement: Read automated projects from a user file
The app SHALL read a user automated projects file, `automated.json` next to the store, holding `{"projects": ["name", ...]}`, on every request, and SHALL treat each listed project as automated in addition to the built-in ones. When the file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string, the app SHALL ignore the whole file and the Activity page SHALL show the file's path and the reason. A missing file SHALL be no error.

#### Scenario: File added
- **WHEN** the user creates the file with `{"projects": ["docs-bot"]}` and reloads Activity
- **THEN** `docs-bot` is automated

#### Scenario: Malformed file
- **WHEN** the file holds invalid JSON
- **THEN** every page still loads with the built-in detection alone, and Activity says the file was ignored and why

#### Scenario: No file
- **WHEN** there is no file
- **THEN** Activity shows no banner
