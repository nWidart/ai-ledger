## ADDED Requirements

### Requirement: Show the page-wide filters in one scope bar
The page-wide filters SHALL sit in one scope bar directly under the navigation, the same place on every page, and no page header SHALL hold one. The bar SHALL stick under the navigation while the page scrolls. A page that shows none of the shared filters SHALL show no bar. A control that sets some sections only SHALL stay where it acts: Limits' range in Past windows, Errors' Day / Week in the rate chart, Cost's plan gauge beside Cost's heading.

#### Scenario: Same place on every page
- **WHEN** the user goes from Cost to Errors, then to Limits
- **THEN** each page shows its filters in the bar under the navigation, at the same height, and its header holds none

#### Scenario: Scrolled
- **WHEN** the user scrolls Cost down to its drawers
- **THEN** the navigation and the scope bar stay at the top of the window

#### Scenario: Cost's plan gauge
- **WHEN** the user opens Cost for a view with a monthly projection
- **THEN** the plan gauge sits beside the heading, not in the scope bar

### Requirement: Keep at most two bars stuck to the top
No page SHALL keep more than two bars stuck to the top of the window: the navigation and the scope bar. No page SHALL show a sticky section index. A header that sticks inside a pane, as Errors' type header and example bar do on a wide screen, SHALL stick under both bars.

#### Scenario: Cost
- **WHEN** the user scrolls Cost at 1440×900
- **THEN** only the navigation and the scope bar are stuck to the top, and there is no section index

#### Scenario: Judgments
- **WHEN** the user scrolls Activity's Judgments view to its drawers at 1440×900
- **THEN** only the navigation and the scope bar are stuck to the top, and there is no section index

#### Scenario: A phone
- **WHEN** the user scrolls any page on a phone 390px wide
- **THEN** only the navigation and the scope bar are stuck to the top

#### Scenario: Errors' examples
- **WHEN** the user scrolls through a type's examples on Errors at 1440×900
- **THEN** the type header sticks right under the scope bar, and the example bar right under the type header

### Requirement: Collapse the scope bar on narrow screens
On a narrow screen the scope bar SHALL be one row: a Filters button, named with how many of the page's filters are off their default and showing that count, then, with a project picked, the project and its Brief link. The button SHALL open the page's filters over the page, so nothing on it moves. A filter change SHALL keep them open and focus on the control; Escape SHALL close them and return focus to the button.

#### Scenario: A phone with filters set
- **WHEN** the user views Cost for `foo` and the last 7 days on a phone 390px wide
- **THEN** the bar is one row, no taller than the navigation, with "Filters" showing 2, `foo` and Brief, and the page does not scroll sideways

#### Scenario: Change the range
- **WHEN** the user opens Filters on a phone and picks 7d
- **THEN** the filters stay open, focus stays on 7d, and the button's count follows

#### Scenario: Close
- **WHEN** the user presses Escape in the open filters
- **THEN** they close and focus is on the Filters button

#### Scenario: Only the page's filters count
- **WHEN** the user views Limits on a phone with `project=foo`, `range=7` and `source=codex` in the URL
- **THEN** the button says one filter is set: Limits shows only the source

### Requirement: Keep one keyboard order through the bars
On every page Tab SHALL reach the navigation, then the scope bar's controls in this order: project, clear project, range, source, automated, Brief, then the page. Skip to content SHALL still move focus to the page heading. Changing a filter SHALL keep focus on the control that changed it.

#### Scenario: Cost
- **WHEN** the user tabs past the navigation's last control on Cost with a project picked
- **THEN** focus moves to the project picker, and Brief is the bar's last stop before the page

#### Scenario: Limits
- **WHEN** the user tabs past the navigation's last control on Limits
- **THEN** focus moves to the source filter's first choice

#### Scenario: Skip to content
- **WHEN** the user activates Skip to content on any page
- **THEN** focus moves to the page heading, past both bars

## MODIFIED Requirements

### Requirement: Show a page only the filters that change it
Each page SHALL show a shared filter only when it changes what the page shows; a filter not shown SHALL keep its URL value for the other pages. The filters shown SHALL sit in the scope bar in one order: project, range, source, then the automated toggle. A filter that sets some sections only SHALL sit in the header of the section it sets, as Limits' range does. A page's own controls sit where they act, as on Errors.

#### Scenario: Judgments has no source filter
- **WHEN** the user opens Activity's Judgments view with `source=claude` in the URL
- **THEN** the scope bar shows the project, range and automated filters and no source filter, and a range change keeps `source=claude` in the URL

#### Scenario: Limits
- **WHEN** the user opens Limits
- **THEN** the scope bar shows the source filter only, Past windows' header shows the range, and there is no project filter or automated toggle

#### Scenario: Errors
- **WHEN** the user opens Errors
- **THEN** the scope bar holds only the project, range and source filters, and Day / Week sits in the rate chart's header

#### Scenario: Live
- **WHEN** the user opens Live
- **THEN** the scope bar shows the project and source filters and the automated toggle, and no range

### Requirement: Keep targets clear of the sticky navigation
A section or field that the user jumps to, or that takes keyboard focus, SHALL NOT end up under the sticky navigation or the scope bar.

#### Scenario: Jump to a section
- **WHEN** the user follows "by project and run" in the coverage note of Activity's Judgments view
- **THEN** the Coverage drawer opens, and its heading shows below the navigation and the scope bar, not under them

#### Scenario: Tab to a control
- **WHEN** the user tabs to a control that is above the scope bar's bottom edge after a scroll
- **THEN** the page scrolls so the control shows below the scope bar

### Requirement: Open one drawer at a time
A page SHALL show at most one open drawer. Opening a drawer, by its toggle or an action that opens it, SHALL close the page's other open drawer. Closing a drawer SHALL open no other.

#### Scenario: Open a second drawer
- **WHEN** the Tokens and cache drawer on Cost is open and the user opens the Most expensive sessions drawer
- **THEN** the Most expensive sessions drawer is open and the Tokens and cache drawer is closed

#### Scenario: An action opens its drawer
- **WHEN** the Largest tool results drawer on Context is open and the user opens a tip's matching sessions
- **THEN** the tip's drawer opens and scrolls into view, and the Largest tool results drawer closes

## REMOVED Requirements

### Requirement: Keep the section index current
**Reason**: No page has a section index any more: it was a third sticky bar under the navigation and the scope bar.
**Migration**: Sections keep their headings and ids. Drawers open from their toggles and from the actions that name them.
