## MODIFIED Requirements

### Requirement: Reach the Project page from the project sheet and the navigation
The project sheet SHALL offer "Open project page", which opens the Project page for its project with the page's filters and closes the sheet. With a project filter set, the navigation's project chip SHALL show the name and a visible "Page" label as one link to the Project page with the same view, named "<project> project page", labelled on narrow screens too, and current on the Project page. Project names in tables SHALL keep opening the project sheet.

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
