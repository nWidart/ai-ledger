# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the Project page out of the tabs
The navigation SHALL have no Project tab, and SHALL mark no tab as current on the Project page. The tabs SHALL keep the project, as on every page. On narrow screens the page chooser SHALL read "Pages" on the Project page and mark no link in its list as current.

#### Scenario: Tab from the Project page
- **WHEN** the user views `foo` for the last 30 days on the Project page and clicks Cost
- **THEN** Cost opens filtered to `foo` and the last 30 days

#### Scenario: Page chooser on the Project page
- **WHEN** the user views `foo` on the Project page on a phone
- **THEN** the page chooser reads "Pages", and none of its links is marked current

## REMOVED Requirements

### Requirement: Reach the Project page from the project sheet and the navigation
**Reason**: The navigation no longer shows the project chip. The link to the Project page moves to the filter row, next to the project picker it belongs to.
**Migration**: See "Reach the Project page from the project sheet and the filter row". The project sheet's "Open project page" is unchanged.

## ADDED Requirements

### Requirement: Reach the Project page from the project sheet and the filter row
The project sheet SHALL offer "Open project page", which opens the Project page for its project with the page's filters and closes the sheet. With a project filter set, every page but the Project page SHALL show a "Project page" link next to the project picker that opens the Project page with the same view, named "<project> project page", on narrow screens too. Project names in tables SHALL keep opening the project sheet.

#### Scenario: From the sheet
- **WHEN** the user has the project sheet of `foo` open on Cost for the last 7 days and chooses "Open project page"
- **THEN** the Project page opens on `foo` for the last 7 days with no sheet open

#### Scenario: From the filter row
- **WHEN** the user views `foo` on Errors for the last 7 days and follows "Project page" next to the picker
- **THEN** the Project page opens on `foo` with the same range and source

#### Scenario: Name for assistive technology
- **WHEN** a screen-reader user lists the links of the Errors page while `foo` is the project filter
- **THEN** one link reads "foo project page"

#### Scenario: On the Project page
- **WHEN** the user views `foo` on the Project page
- **THEN** the filter row shows no "Project page" link

#### Scenario: No project filter
- **WHEN** the user views Errors with no project filter
- **THEN** the filter row shows no "Project page" link

### Requirement: Clear the project from the filter row
With a project filter set, the filter row SHALL show a button next to the project picker, named "Clear project filter", that removes the project filter and keeps focus on the project picker. On the Project page it SHALL follow the rule for clearing the project there.

#### Scenario: Clear on Errors
- **WHEN** the user views `foo` on Errors for the last 7 days and activates "Clear project filter"
- **THEN** Errors shows every project for the last 7 days, and focus is on the project picker

#### Scenario: Clear on the Project page
- **WHEN** the user views `foo` on the Project page and activates "Clear project filter"
- **THEN** Activity opens with no project filter and the same range and source
