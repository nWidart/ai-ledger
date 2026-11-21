## ADDED Requirements

### Requirement: Go to the Judgments view with `>`
`>judgments` SHALL open Activity's Judgments view, and `>insights`, its name when it was a page, SHALL find the same row. The row SHALL follow Activity in the list and say it is an Activity view. A move between Overview and Judgments SHALL carry the shared filters and leave the other view's own keys behind, as the view switch does. `>activity` from the Judgments view SHALL open Overview. When the filters name Codex only, the footer SHALL say that Overview opens.

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

## MODIFIED Requirements

### Requirement: Go to a page with `>`
A `>` term naming a page (Live, Limits, Activity, Cost, Context, Errors) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them. When the palette's chips or the current view name a project, `>project` SHALL open the Project page for that project; with no project, the palette SHALL NOT offer the bare Project page.

#### Scenario: Page only
- **WHEN** the user views project `myproject` for the last 14 days on Activity and commits `>errors`
- **THEN** Errors opens filtered to `myproject` and the last 14 days

#### Scenario: Page and filter
- **WHEN** the user commits `>errors #myproject` on any page
- **THEN** the URL becomes `/errors?project=myproject` with the other current filters, and Errors shows `myproject`

#### Scenario: No filters set
- **WHEN** the user has no filters on Activity, the last Errors view saved in the browser was project `other`, and the user commits `>errors`
- **THEN** Errors opens with no project filter, matching the view the user came from

#### Scenario: Go to Live
- **WHEN** the user views project `myproject` on Cost and commits `>live`
- **THEN** Live opens and shows only `myproject` sessions

#### Scenario: Go to Context
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>context`
- **THEN** Context opens filtered to `myproject` and the last 7 days

#### Scenario: Go to a project's page
- **WHEN** the user has no project filter on Cost for the last 7 days and commits `>project #myproject`
- **THEN** the URL becomes `/project?project=myproject&range=7` and the Project page shows `myproject`

#### Scenario: Project page from the current view
- **WHEN** the user views project `myproject` on Activity and commits `>project`
- **THEN** the Project page opens on `myproject`

#### Scenario: No project named
- **WHEN** the user has no project filter, no project chip, and no project whose name matches `proj`, and types `>proj`
- **THEN** the list offers no Project page

### Requirement: A page-bound sheet implies its page
A sheet that only one page hosts SHALL take the commit to that page. Error categories live on Errors; every other sheet is hosted by every page. When a page chosen after a category is not Errors, the later page SHALL win and the category's chip SHALL show that it was dropped.

#### Scenario: Error category from Activity
- **WHEN** the user on Activity commits `>timeout` picked as the `Command timed out` category
- **THEN** Errors opens on that category, and the footer said so before Enter

#### Scenario: Page after a category
- **WHEN** the chips are `>timeout` (a category) and then `>cost`
- **THEN** the category chip shows as dropped, and Enter opens Cost with no category

### Requirement: A sheet without a page stays where it can
A `>` tool, MCP server, skill or session sheet without a page SHALL open on the current page, whatever the page: the app's shell hosts those sheets on every page, Limits included. With a page chip, it SHALL open on that page.

#### Scenario: On a hosting page
- **WHEN** the user on Errors commits `>bash`
- **THEN** the `Bash` inspector opens over Errors

#### Scenario: On Context
- **WHEN** the user on Context commits `>bash`
- **THEN** the `Bash` inspector opens over Context

#### Scenario: On the Project page
- **WHEN** the user on the Project page of `foo` commits `>bash`
- **THEN** the `Bash` inspector opens over the Project page

#### Scenario: On Limits
- **WHEN** the user on Limits commits `>bash`
- **THEN** the `Bash` inspector opens over Limits, at `/limits?tool=Bash`

#### Scenario: On the Judgments view
- **WHEN** the user on `/usage?range=7&view=judgments` commits a session
- **THEN** the session sheet opens over the Judgments view, with the view kept in the URL
