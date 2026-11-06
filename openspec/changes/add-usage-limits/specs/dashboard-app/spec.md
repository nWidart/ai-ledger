# Spec Delta

## MODIFIED Requirements

### Requirement: Shared navigation
Every dashboard page SHALL show the same navigation with Activity, Cost, Errors and Limits entries, mark the current page, and keep the selected project and time range when switching pages.

#### Scenario: Switch from Usage to Errors
- **WHEN** the user views project `foo` for the last 30 days on Activity (`/usage`) and clicks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Activity to Cost
- **WHEN** the user views project `foo` for the last 30 days on Activity and clicks Cost
- **THEN** the cost dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Cost to Limits
- **WHEN** the user views Codex for the last 30 days on Cost and clicks Limits
- **THEN** the Limits page opens filtered to Codex and the last 30 days

### Requirement: Open Activity by default
The app SHALL serve Activity at `/usage`, Cost at `/cost`, Errors at `/errors` and Limits at `/limits`, and SHALL send `/` to Activity.

#### Scenario: Open the app root
- **WHEN** the user opens `http://127.0.0.1:8765/`
- **THEN** the Activity page opens

#### Scenario: Open Limits directly
- **WHEN** the user opens `http://127.0.0.1:8765/limits`
- **THEN** the Limits page opens

### Requirement: Filter by source
Activity, Cost, Errors and Limits SHALL offer a source filter with the choices All, Claude Code and Codex, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range.

#### Scenario: Default shows every source
- **WHEN** the user opens Cost with no source in the URL, and the last 30 days hold $120 of Claude usage and $15 of Codex usage
- **THEN** Cost shows $135 for the period

#### Scenario: Narrow to Codex
- **WHEN** the user picks Codex on Activity
- **THEN** every figure, chart and table shows only Codex sessions, and the URL records `source=codex`

#### Scenario: Switch pages with a source
- **WHEN** the user views Codex for the last 30 days on Activity and clicks Errors
- **THEN** the errors dashboard opens filtered to Codex and the last 30 days

#### Scenario: Unknown source in the URL
- **WHEN** the URL holds `source=grok`
- **THEN** the page shows All and replaces the value in the URL
