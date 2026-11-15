## MODIFIED Requirements

### Requirement: Go to a page with `>`
A `>` term naming a page (Activity, Cost, Context, Errors, Limits, Insights, Live) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them. When the palette's chips or the current view name a project, `>project` SHALL open the Project page for that project; with no project, the palette SHALL NOT offer it.

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
- **WHEN** the user has no project filter and types `>proj` with no project chip
- **THEN** the list offers no Project page
