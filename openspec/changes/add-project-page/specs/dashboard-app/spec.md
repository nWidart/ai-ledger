## MODIFIED Requirements

### Requirement: Open Activity by default
The app SHALL serve Activity at `/usage`, Cost at `/cost`, Context at `/context`, Errors at `/errors`, Limits at `/limits`, Insights at `/insights`, Live at `/live` and the Project page at `/project`, and SHALL send `/` to Activity.

#### Scenario: Open the app root
- **WHEN** the user opens `http://127.0.0.1:8765/`
- **THEN** the Activity page opens

#### Scenario: Open Limits directly
- **WHEN** the user opens `http://127.0.0.1:8765/limits`
- **THEN** the Limits page opens

#### Scenario: Open Context
- **WHEN** the user opens `http://127.0.0.1:8765/context`
- **THEN** the Context page opens

#### Scenario: Open Insights
- **WHEN** the user opens `http://127.0.0.1:8765/insights`
- **THEN** the Insights page opens

#### Scenario: Open Live
- **WHEN** the user opens `http://127.0.0.1:8765/live`
- **THEN** the Live page opens

#### Scenario: Open a project's page
- **WHEN** the user opens `http://127.0.0.1:8765/project?project=foo`
- **THEN** the Project page opens on `foo`
