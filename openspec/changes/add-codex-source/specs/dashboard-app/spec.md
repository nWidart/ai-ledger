# Spec Delta

## ADDED Requirements

### Requirement: Filter by source
Activity, Cost and Errors SHALL offer a source filter with the choices All, Claude Code and Codex, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range.

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

### Requirement: Describe agent work without naming one agent
Page text that describes work from any source SHALL NOT name Claude. Text MAY name an agent when the source filter selects it.

#### Scenario: Empty range
- **WHEN** Activity has no sessions in the selected range and the source is All
- **THEN** the heading says there is no agent activity in that range, and does not say "Claude"

#### Scenario: Errors kicker
- **WHEN** the Errors page is open with source All
- **THEN** its kicker reads "Agent tool errors"
