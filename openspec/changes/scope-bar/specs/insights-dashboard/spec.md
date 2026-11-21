## MODIFIED Requirements

### Requirement: Order the Judgments view
When the view has analysed sessions, the Judgments view SHALL show, in this order: Activity's view switch, the lede, its sub line, the coverage note, the vitals, one row holding Outcomes and Friction categories, the Trend panel when it is shown, Satisfaction and helpfulness, the analysed sessions, then the drawers: Goals, Session types, Session figures, Coverage and How this works. Each drawer SHALL be closed by default. Its filters are in the scope bar.

#### Scenario: Order with figures
- **WHEN** the view holds analysed sessions across 2 or more weeks
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
- **WHEN** the view has session-meta rows and no facet
- **THEN** the drawer is shown beside the How this works drawer

## REMOVED Requirements

### Requirement: Index the Judgments view's sections
**Reason**: The section index was a third sticky bar under the navigation and the scope bar.
**Migration**: Each section keeps its heading. The coverage note's "by project and run" link still opens the Coverage drawer, and every drawer opens from its toggle.
