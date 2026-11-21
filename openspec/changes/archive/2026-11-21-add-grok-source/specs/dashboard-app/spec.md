# Spec Delta

## MODIFIED Requirements

### Requirement: Filter by source
Activity's Overview, Cost, Context, Errors, Limits and Live SHALL offer a source filter with the choices All, Claude Code, Codex and Grok, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range. Activity's Judgments view SHALL offer no source filter: only Claude Code sessions are judged.

#### Scenario: Default shows every source
- **WHEN** the user opens Cost with no source in the URL, and the last 30 days hold $120 of Claude usage and $15 of Codex usage
- **THEN** Cost shows $135 for the period

#### Scenario: Narrow to Codex
- **WHEN** the user picks Codex on Activity
- **THEN** every figure, chart and table shows only Codex sessions, and the URL records `source=codex`

#### Scenario: Narrow to Grok
- **WHEN** the user picks Grok on Cost
- **THEN** every figure, chart and table shows only Grok sessions, and the URL records `source=grok`

#### Scenario: Switch pages with a source
- **WHEN** the user views Codex for the last 30 days on Activity and clicks Errors
- **THEN** the errors dashboard opens filtered to Codex and the last 30 days

#### Scenario: Unknown source in the URL
- **WHEN** the URL holds `source=gemini`
- **THEN** the page shows All and replaces the value in the URL

#### Scenario: Codex on Insights
- **WHEN** the user views Codex on Activity, whose Judgments view holds what Insights showed
- **THEN** Activity shows Overview, and its Judgments view cannot be picked and says Codex writes no facets

#### Scenario: Grok on Insights
- **WHEN** the user views Grok on Activity
- **THEN** Activity shows Overview, and its Judgments view cannot be picked and says Grok writes no facets

#### Scenario: Codex on Live
- **WHEN** the user picks Codex on Live
- **THEN** the rail and the wall show only Codex sessions

#### Scenario: Codex on Context
- **WHEN** the user picks Codex on Context
- **THEN** every Context section and tip covers Codex sessions alone
