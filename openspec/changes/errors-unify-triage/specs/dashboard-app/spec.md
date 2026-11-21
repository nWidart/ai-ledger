## MODIFIED Requirements

### Requirement: Put method text behind How measured
A section's hint SHALL be one short line. Text that says how a figure is measured, beyond that line, SHALL sit behind a "How measured" toggletip at the end of the hint, which follows the toggletip rules. This SHALL apply to the Activity, Context, Cost, Errors, Limits and Insights pages. No page SHALL give method text only as hover text or in a disclosure of its own.

#### Scenario: Starting context
- **WHEN** the user opens Context
- **THEN** the Starting context hint is one line, and its method text shows only when the user activates, or rests the pointer on, its How measured toggletip

#### Scenario: Errors' uncategorized share
- **WHEN** the user opens Errors' summary on a phone
- **THEN** the uncategorized line shows, ending with a How measured toggletip that names the catch-all types, and the line has no hover title
