## MODIFIED Requirements

### Requirement: Go to a page with `>`
A `>` term naming a page (Activity, Cost, Context, Errors, Limits, Insights, Live) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them. When the palette's chips or the current view name a project, `>project` SHALL open the Project page for that project; with no project, the palette SHALL NOT offer the bare Project page.

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

## ADDED Requirements

### Requirement: Offer a project's page from its match
Typed text with no sigil or with `>` SHALL also list a row that opens the page of each of the best three matching projects, in the Page group. Picking it SHALL add the project filter and the Project page together, announced in one message. The row SHALL NOT show for `#` terms, for empty text, or when picking it would change nothing. With no sigil it SHALL NOT count as an exact match.

#### Scenario: Type a project's name
- **WHEN** the user on Cost for the last 7 days types `jobdesk` and commits the row "jobdesk · open project page"
- **THEN** the URL becomes `/project?project=jobdesk&range=7` and the Project page shows `jobdesk`

#### Scenario: Name then another page
- **WHEN** the user types `jobdesk >errors` and commits
- **THEN** `jobdesk` becomes a project chip and Errors opens filtered to `jobdesk`

#### Scenario: Name with `>`
- **WHEN** the user types `>jobdesk #7d`
- **THEN** `>jobdesk` becomes the project filter and Project page chips, and Enter opens the Project page of `jobdesk` for the last 7 days

#### Scenario: Filters only
- **WHEN** the user types `#job`
- **THEN** the list shows the project `jobdesk` as a filter and no project-page row

#### Scenario: Project already filtered
- **WHEN** the user views `jobdesk` on Cost, opens the palette and types `jobdesk`
- **THEN** the list offers the row "jobdesk · open project page"

#### Scenario: Already on the page
- **WHEN** the user views `jobdesk` on the Project page, opens the palette and types `jobdesk`
- **THEN** the list offers no row for the page of `jobdesk`
