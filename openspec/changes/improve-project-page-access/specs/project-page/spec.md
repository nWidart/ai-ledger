## MODIFIED Requirements

### Requirement: Reach the Project page from the project sheet and the navigation
The project sheet SHALL offer "Open project page", which SHALL open the Project page for the sheet's project with the page's range, source and automated filters, and close the sheet. When a project filter is set, the navigation's project chip SHALL show the project's name and a visible "Page" control as one link to the Project page with the same view; its accessible name SHALL be the project's name followed by "project page". The control SHALL keep its visible label on narrow screens. On the Project page the link SHALL be marked as the current page. Project names in tables SHALL keep opening the project sheet.

#### Scenario: From the sheet
- **WHEN** the user has the project sheet of `foo` open on Cost for the last 7 days and chooses "Open project page"
- **THEN** the Project page opens on `foo` for the last 7 days with no sheet open

#### Scenario: From the navigation
- **WHEN** the user views `foo` on Errors and follows the chip's Page control
- **THEN** the Project page opens on `foo` with the same range and source

#### Scenario: Name for assistive technology
- **WHEN** a screen-reader user lists the links of the navigation while `foo` is the project filter
- **THEN** one link reads "foo project page"

#### Scenario: Current page
- **WHEN** the user views `foo` on the Project page
- **THEN** the chip's link is marked as the current page and no tab is
