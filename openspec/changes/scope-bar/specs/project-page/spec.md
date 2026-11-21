## MODIFIED Requirements

### Requirement: Lay out the blocks in two columns
On wide screens the Project page SHALL show its blocks in two columns: Activity, Cost and Context on the left, and Errors, Plan limits, Sessions and Session judgments on the right, each in that order. On narrow screens it SHALL show them in one column in the same order, left column first. The heading SHALL span the page above the columns, under the scope bar. A block SHALL NOT repeat the project sheet's summary figures, except the Cost block's estimated cost.

#### Scenario: Wide screen
- **WHEN** the user opens the Project page on a screen wider than 60em
- **THEN** Activity, Cost and Context are in the left column and Errors, Plan limits, Sessions and Session judgments in the right

#### Scenario: Narrow screen
- **WHEN** the user opens the Project page on a phone
- **THEN** the blocks stack in one column, Activity first and Session judgments last

### Requirement: Reach the Project page from the project sheet and the filter row
The project sheet SHALL offer "Open project page", which opens the Project page for its project with the page's filters and closes the sheet. With a project filter set, the scope bar of every page with a project picker, except the Project page, SHALL end with a "Brief" link that opens the Project page with the same view, named "Brief, <project> project page", on narrow screens too. Project names in tables SHALL keep opening the project sheet.

#### Scenario: From the sheet
- **WHEN** the user has the project sheet of `foo` open on Cost for the last 7 days and chooses "Open project page"
- **THEN** the Project page opens on `foo` for the last 7 days with no sheet open

#### Scenario: From the filter row
- **WHEN** the user views `foo` on Errors for the last 7 days and follows Brief at the end of the scope bar
- **THEN** the Project page opens on `foo` with the same range and source

#### Scenario: Name for assistive technology
- **WHEN** a screen-reader user lists the links of the Errors page while `foo` is the project filter
- **THEN** one link reads "Brief, foo project page"

#### Scenario: On the Project page
- **WHEN** the user views `foo` on the Project page
- **THEN** the scope bar shows no Brief link, and keeps the project picker and its clear button

#### Scenario: No project filter
- **WHEN** the user views Errors with no project filter
- **THEN** the scope bar shows no Brief link

#### Scenario: Limits
- **WHEN** the user views Limits with `project=foo` in the URL
- **THEN** the scope bar shows no project picker and no Brief link
