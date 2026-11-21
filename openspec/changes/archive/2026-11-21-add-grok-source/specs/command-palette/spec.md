# Spec Delta

## MODIFIED Requirements

### Requirement: Narrow with `#` filters
A `#` term SHALL select a filter: a project, a source (`#claude` for Claude Code, `#codex` for Codex, `#grok` for Grok), a time range (`#7d`, `#14d`, `#30d`, `#90d`, `#all`) or `#automated` to include automated sessions. Several `#` filters SHALL combine, and each SHALL write the same URL state as the page's own filter controls.

#### Scenario: Three filters on a page
- **WHEN** the user commits `#myproject #codex #7d >cost`
- **THEN** Cost opens filtered to project `myproject`, Codex and the last 7 days

#### Scenario: Grok source
- **WHEN** the user commits `#grok >activity`
- **THEN** Activity opens with the source filter on Grok, and the URL records `source=grok`

#### Scenario: All time and automated sessions
- **WHEN** the user commits `#all #automated` on Activity
- **THEN** Activity shows all time with automated sessions included, as if the user had picked All and turned on the automated control

#### Scenario: Automated sessions on Errors
- **WHEN** the user commits `#automated` while on Errors
- **THEN** the URL records the choice, Errors keeps showing automated sessions as it always does, and the choice applies on Activity and Cost

### Requirement: Go to the Judgments view with `>`
`>judgments` SHALL open Activity's Judgments view, and `>insights`, its name when it was a page, SHALL find the same row. The row SHALL follow Activity in the list and say it is an Activity view. A move between Overview and Judgments SHALL carry the shared filters and leave the other view's own keys behind, as the view switch does. `>activity` from the Judgments view SHALL open Overview. When the filters name one source other than Claude Code, such as Codex or Grok, the footer SHALL say that Overview opens.

#### Scenario: Open Judgments
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>judgments`
- **THEN** the URL becomes `/usage?project=myproject&range=7&view=judgments`, and the footer said "open Judgments" before Enter

#### Scenario: The old name
- **WHEN** the user types `>insights`
- **THEN** the first row is Judgments

#### Scenario: Back to Overview
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved` commits `>activity`
- **THEN** the URL becomes `/usage?range=7`

#### Scenario: Codex only
- **WHEN** the chips are `#codex` and `>judgments`
- **THEN** the footer says Codex has no judgments and that Overview opens

#### Scenario: Grok only
- **WHEN** the chips are `#grok` and `>judgments`
- **THEN** the footer says Grok has no judgments and that Overview opens
