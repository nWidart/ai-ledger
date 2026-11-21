## MODIFIED Requirements

### Requirement: Filter by project, range, source and automated sessions
The Judgments view SHALL offer the shared project, time range and automated-session filters, in the scope bar, and no source filter: every figure is of Claude Code sessions, and the view SHALL ask the app for every source whatever the URL's source. Every figure and list SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: One project
- **WHEN** the user opens `/usage?project=ai-ledger&range=30&view=judgments`
- **THEN** every figure counts only facets of `ai-ledger` sessions that started in the last 30 days

#### Scenario: Switch from Activity
- **WHEN** the user views project `foo` for the last 14 days on Activity's Overview and picks Judgments
- **THEN** the Judgments view opens filtered to `foo` and the last 14 days

#### Scenario: Automated sessions left out
- **WHEN** the automated control is off and `observer-sessions` has facets
- **THEN** those facets count nowhere on the page

#### Scenario: A source in the URL
- **WHEN** the user opens the view with `source=claude` in the URL
- **THEN** the view shows no source filter, its figures are the same as with no source, and `source=claude` stays in the URL

### Requirement: Order the Judgments view
When the view has analysed sessions, the Judgments view SHALL show, in this order: Activity's view switch, the lede, its sub line, the coverage note, the vitals, one row holding Outcomes and Friction categories, the Trend panel when it is shown, Satisfaction and helpfulness, the analysed sessions, then the drawers: Goals, Session types, Session figures, Coverage and How this works. Each drawer SHALL be closed by default. Its filters are in the scope bar.

#### Scenario: Order with figures
- **WHEN** the view holds facets of analysed sessions across 2 or more weeks, and session-meta rows
- **THEN** the sections read in the order Outcomes, Friction categories, Outcome trend, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, Session figures, Coverage, How this works, and the drawers are closed

#### Scenario: Order without a trend
- **WHEN** the view holds analysed sessions from one week only
- **THEN** the Trend panel is left out and the other sections keep their order

### Requirement: Show session figures only when counted
The drawer SHALL appear only when the view has a session-meta row. It SHALL appear in a view with no analysed session. For source Codex the app SHALL send empty figures.

#### Scenario: Codex
- **WHEN** the app is asked for the judgments of source Codex
- **THEN** the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet, and the store has facets of other sessions
- **THEN** the drawer is shown beside the How this works drawer

## REMOVED Requirements

### Requirement: Index the Judgments view's sections
**Reason**: The section index was a third sticky bar under the navigation and the scope bar.
**Migration**: Each section keeps its heading. The coverage note's "by project and run" link still opens the Coverage drawer, and every drawer opens from its toggle.
