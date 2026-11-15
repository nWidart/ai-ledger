## MODIFIED Requirements

### Requirement: Order the page
When the view has analysed sessions, the Insights page SHALL show, in this order: the coverage note, the lede and its sub line, the vitals, one row holding Outcomes and Friction categories, the Trend panel when it is shown, Satisfaction and helpfulness, the analysed sessions, then the drawers: Goals, Session types, Session figures, Coverage and How this works. Each drawer SHALL be closed by default.

#### Scenario: Order with figures
- **WHEN** the view holds analysed sessions across 2 or more weeks
- **THEN** the sections read in the order Outcomes, Friction categories, Outcome trend, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, Session figures, Coverage, How this works, and the drawers are closed

#### Scenario: Order without a trend
- **WHEN** the view holds analysed sessions from one week only
- **THEN** the Trend panel is left out and the other sections keep their order
