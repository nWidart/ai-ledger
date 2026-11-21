## MODIFIED Requirements

### Requirement: Order the Activity page
Activity SHALL show its view switch first. Its Overview SHALL then show, in this order: the lede, the prompts interrupted line, the attention summary, the work chart, the vitals, then the workbench tabs. Its filters are in the scope bar above the page. Overview SHALL have no section index.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals, and the tab list comes after the vitals

#### Scenario: The switch leads
- **WHEN** the user opens Activity
- **THEN** the view switch comes before the lede
