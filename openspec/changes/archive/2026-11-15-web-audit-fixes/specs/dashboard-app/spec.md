# Spec Delta

## ADDED Requirements

### Requirement: Put each page's content in a main landmark
Every dashboard page SHALL hold its content in one `<main>` landmark, after the shared navigation, and SHALL show a skip link as the first focusable element of the page. The skip link SHALL be visible only while it has focus, and activating it SHALL move focus to the main landmark.

#### Scenario: Skip the navigation
- **WHEN** the user loads any dashboard page and presses Tab once
- **THEN** the skip link shows and has focus, and pressing Enter moves focus into the page's main content, past the navigation

#### Scenario: One main
- **WHEN** a screen reader user lists the landmarks of any dashboard page, with or without a sheet open
- **THEN** there is one main landmark, and the page's heading and tables are inside it

### Requirement: Move focus to the heading after navigating
After the user picks a page in the navigation, focus SHALL move to that page's heading, so a screen reader reads the new page from its start. Loading the page directly, changing a filter and browser Back and Forward SHALL NOT move focus.

#### Scenario: Pick a page
- **WHEN** the user activates Cost in the navigation from the keyboard
- **THEN** the Cost page opens and focus is on its heading

#### Scenario: Change a filter
- **WHEN** the user changes the time range on a page
- **THEN** focus stays on the range control

### Requirement: Keep Refresh focusable while it runs
While a refresh runs, the navigation's Refresh button SHALL stay focusable and SHALL expose `aria-disabled` instead of being disabled, and a click or key press on it SHALL do nothing.

#### Scenario: Refresh with the keyboard
- **WHEN** the user presses Enter on Refresh, and presses Enter again while the refresh runs
- **THEN** focus stays on the button throughout, the second press starts nothing, and the button exposes `aria-disabled` until the refresh ends

### Requirement: Keep loading states out of live regions
A page that is loading SHALL mark its content area `aria-busy` and SHALL NOT announce the loading state through a live region. Only the result of an action, such as a failed refresh or a copied link, SHALL be announced.

#### Scenario: Open a page
- **WHEN** a screen reader user opens a page whose data is still loading
- **THEN** nothing about loading is announced, and the content area is `aria-busy` until the data arrives

### Requirement: Explain terms without hover
An explanation that a page gave only as hover text on a column header, a filter label, a facet or a figure of the Live agent panel SHALL be reachable from the keyboard: either as a visible hint, or behind a button, a toggletip, that shows the text on activation, is named for the term it explains, exposes `aria-expanded`, and closes on Escape, on activating it again and on a click outside it. The text SHALL be exposed to assistive technology once it shows.

#### Scenario: Column header explanation
- **WHEN** the user tabs to the toggletip beside a column header and presses Enter
- **THEN** the explanation shows, the button reads as expanded, and Escape hides it and keeps focus on the button

#### Scenario: Agent panel figure
- **WHEN** a screen reader user reaches the cache-read share in the Live agent panel
- **THEN** its explanation is available without a pointer

### Requirement: Name data tables and their headers
Every data table SHALL have an accessible name, and every header cell SHALL declare its scope (`col` or `row`). A table wrapper that scrolls sideways SHALL be a named region that takes keyboard focus, so a keyboard user can scroll it.

#### Scenario: Table list
- **WHEN** a screen reader user lists the tables of the Cost page
- **THEN** each is named, such as "Cost by project"

#### Scenario: Wide table
- **WHEN** a table is wider than its wrapper at 520px and the user tabs to it
- **THEN** the wrapper takes focus, says its name, and the arrow keys scroll it

### Requirement: Keep a drawer's title a heading
A drawer's title SHALL be a real heading in the page outline, and its toggle SHALL be a button. The toggle SHALL NOT hold the heading element inside it.

#### Scenario: Headings list
- **WHEN** a screen reader user lists the headings of Activity, with a drawer closed
- **THEN** the drawer's title is listed as a heading

### Requirement: Label an interactive chart as a group
The box of a chart that the user reads by keyboard, on Cost, Activity and Errors, SHALL be a `role="group"` with a label that says what the chart shows and how to read it, and SHALL NOT be `role="img"` or `role="application"`. Its live region for the keyboard reading SHALL stay.

#### Scenario: Roles
- **WHEN** a screen reader reaches the Cost chart
- **THEN** it exposes a group with the chart's label, and the label names the stacking

### Requirement: Dismiss a chart tooltip with Escape
Escape SHALL dismiss the open tooltip of the Cost, Activity work and Errors rate charts, whether the pointer or the keyboard reading opened it, without closing a sheet or the palette and without changing the selected bucket.

#### Scenario: Escape on a hovered bar
- **WHEN** the tooltip of a Cost bar is open and the user presses Escape
- **THEN** the tooltip closes and the selected day is unchanged

#### Scenario: Escape with a sheet open
- **WHEN** a sheet is open and no chart tooltip is
- **THEN** Escape closes the sheet, as before

### Requirement: Keep the interface legible in forced colors
In a forced-colors mode (Windows high contrast), pressed buttons, the selected tab and sort header, the current page in the navigation, the selected chart bucket, focus rings and chart bars SHALL stay distinguishable from their unpressed or unselected state and from the page, using system colors rather than the theme's.

#### Scenario: Current page in high contrast
- **WHEN** forced colors is on and the user views Cost
- **THEN** the Cost tab is distinguishable from the other tabs without relying on its background color

#### Scenario: Chart bars
- **WHEN** forced colors is on and a chart is drawn
- **THEN** its bars and the selected bar are visible against the page

### Requirement: Keep contrast for controls, focus and text
The border of an input and a select SHALL have a contrast of at least 3:1 against the page background, and the palette input SHALL show a focus ring of at least 3:1, in both themes. Text on the series-1 color, including the tool text of the Live page, SHALL have a contrast of at least 4.5:1 in both themes.

#### Scenario: Input border in light mode
- **WHEN** the dashboard is light and an input or select is not focused
- **THEN** its border has at least 3:1 against the page

#### Scenario: Palette focus
- **WHEN** the palette opens with its input focused
- **THEN** the input shows a visible focus ring

#### Scenario: Live tool text
- **WHEN** the dashboard is light and the Live stream shows a tool name in the series-1 color
- **THEN** the text has at least 4.5:1 against its background

### Requirement: Keep targets clear of the sticky navigation
A section or field that the user jumps to, or that takes keyboard focus, SHALL NOT end up under the sticky navigation or the section index.

#### Scenario: Jump to a section
- **WHEN** the user chooses a section in the Insights section index
- **THEN** the section's heading shows below the sticky navigation and the index, not under them

### Requirement: Pause the status poll in a hidden tab
The navigation's status poll, and any other background poll the page makes, SHALL stop while the tab is hidden, and SHALL fetch once on return to the tab, then resume its interval. Background polls SHALL use low fetch priority. A poll SHALL NOT delay the page's own data requests.

#### Scenario: Tab hidden
- **WHEN** the tab has been hidden for ten minutes
- **THEN** the app received no status request from it in that time

#### Scenario: Back to the tab
- **WHEN** the user returns to the tab
- **THEN** the navigation asks for the app's status at once and shows the newest ingest time, then continues on its interval
