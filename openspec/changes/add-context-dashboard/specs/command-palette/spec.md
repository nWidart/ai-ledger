# Spec Delta

## MODIFIED Requirements

### Requirement: Go to a page with `>`
A `>` term naming a page (Activity, Cost, Context, Errors, Limits, Insights, Live) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them.

#### Scenario: Page only
- **WHEN** the user views project `myproject` for the last 14 days on Activity and commits `>errors`
- **THEN** Errors opens filtered to `myproject` and the last 14 days

#### Scenario: Page and filter
- **WHEN** the user commits `>errors #myproject` on any page
- **THEN** the URL becomes `/errors#project=myproject` with the other current filters, and Errors shows `myproject`

#### Scenario: No filters set
- **WHEN** the user has no filters on Activity, the last Errors view saved in the browser was project `other`, and the user commits `>errors`
- **THEN** Errors opens with no project filter, matching the view the user came from

#### Scenario: Go to Live
- **WHEN** the user views project `myproject` on Cost and commits `>live`
- **THEN** Live opens and shows only `myproject` sessions

#### Scenario: Go to Context
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>context`
- **THEN** Context opens filtered to `myproject` and the last 7 days

### Requirement: A sheet without a page stays where it can
A `>` sheet without a page SHALL open on the current page when that page hosts the sheet, and otherwise on Activity. Activity, Cost, Context and Errors host the tool, MCP server, skill and session sheets. Limits hosts none.

#### Scenario: On a hosting page
- **WHEN** the user on Errors commits `>bash`
- **THEN** the `Bash` inspector opens over Errors

#### Scenario: On Context
- **WHEN** the user on Context commits `>bash`
- **THEN** the `Bash` inspector opens over Context

#### Scenario: On Limits
- **WHEN** the user on Limits commits `>bash`
- **THEN** Activity opens with the `Bash` inspector, and the footer said so before Enter
