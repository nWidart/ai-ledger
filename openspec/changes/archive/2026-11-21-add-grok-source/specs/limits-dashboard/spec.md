# Spec Delta

## MODIFIED Requirements

### Requirement: Filter Limits by time range and source
The scope bar SHALL show the Source filter only on Limits. Source SHALL apply to every section. The time range SHALL be set in the "Past windows" section header and SHALL apply to the past windows and to "What a point buys". Open windows SHALL always show, whatever the range. Limits SHALL have no project filter. Grok reports no plan limits: with the source on Grok, Limits SHALL show no window, no lead and no suggestion, and SHALL say in one line that Grok reports no plan limits.

#### Scenario: Codex only
- **WHEN** the user picks source Codex on Limits
- **THEN** only Codex windows, history and value appear, and the URL records `source=codex`

#### Scenario: Grok only
- **WHEN** the user picks source Grok on Limits
- **THEN** Limits shows no window, history or value, says that Grok reports no plan limits, and the URL records `source=grok`

#### Scenario: Project filter set
- **WHEN** the shared project filter is `foo` on another page and the user opens Limits
- **THEN** Limits shows no project filter, every section reads as with no project, and the URL keeps `project=foo` for the other pages

#### Scenario: Range in Past windows
- **WHEN** the user picks 7d in the "Past windows" header
- **THEN** the strips, the table and "What a point buys" cover the last 7 days, the open windows do not change, and the URL records `range=7`
