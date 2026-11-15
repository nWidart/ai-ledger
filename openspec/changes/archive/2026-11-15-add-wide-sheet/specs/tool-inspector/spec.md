## ADDED Requirements

### Requirement: Use the room of a wide inspector
When the inspector has room for two columns, it SHALL show calls per day beside where the subject is used, and failures by type beside recovery and error loops. The Inputs and Recent calls tables SHALL span the inspector's width. Without room for two columns every section SHALL stack in the narrow inspector's order. The wide inspector SHALL show the same sections and figures as the narrow one.

#### Scenario: Wide inspector
- **WHEN** the user widens the `Bash` inspector on a 1440px viewport
- **THEN** Calls per day sits beside Where, Failures by type sits beside After a failure, and Inputs and Recent calls span the sheet

#### Scenario: Narrow inspector
- **WHEN** the user views the `Bash` inspector at the narrow width
- **THEN** every section stacks in one column

#### Scenario: Pair with one section
- **WHEN** the user widens the inspector of a tool with failure types and no recovery incident or error loop
- **THEN** Failures by type takes the whole width
