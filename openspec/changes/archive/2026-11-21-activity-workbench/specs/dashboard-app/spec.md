# Spec Delta

## MODIFIED Requirements

### Requirement: Keep a drawer's title a heading
A drawer's title SHALL be a real heading in the page outline, and its toggle SHALL be a button. The toggle SHALL NOT hold the heading element inside it.

#### Scenario: Headings list
- **WHEN** a screen reader user lists the headings of Cost, with a drawer closed
- **THEN** the drawer's title is listed as a heading

### Requirement: Start every drawer closed
Every drawer SHALL be closed when its page loads, on every page and after every reload. The app SHALL NOT keep which drawers were open in the browser. A drawer SHALL open on load only when a link asks for it, such as a tip in the Context page's URL.

#### Scenario: Reload after opening a drawer
- **WHEN** the user opens the Tokens and cache drawer on Cost and reloads the page
- **THEN** every drawer on the page is closed

### Requirement: Open one drawer at a time
A page SHALL show at most one open drawer. Opening a drawer, by its toggle, the section index or an action that opens it, SHALL close the page's other open drawer. Closing a drawer SHALL open no other.

#### Scenario: Open a second drawer
- **WHEN** the Tokens and cache drawer on Cost is open and the user opens the Most expensive sessions drawer
- **THEN** the Most expensive sessions drawer is open and the Tokens and cache drawer is closed

#### Scenario: An action opens its drawer
- **WHEN** the Largest tool results drawer on Context is open and the user opens a tip's matching sessions
- **THEN** the tip's drawer opens and scrolls into view, and the Largest tool results drawer closes

### Requirement: Show the main chart in the first screen
On a 1440×900 window with every drawer closed, the main chart of the Activity, Context and Errors pages SHALL start inside the first 900 pixels of the page, and on Activity's Overview the workbench tab list SHALL end inside them too. On Activity's Judgments view the main chart is the Outcomes ledger.

#### Scenario: Activity
- **WHEN** the user opens Activity at 1440×900
- **THEN** the work chart starts and the workbench tab list ends within the first 900 pixels

#### Scenario: Judgments
- **WHEN** the user opens Activity's Judgments view at 1440×900
- **THEN** the Outcomes ledger starts within the first 900 pixels
