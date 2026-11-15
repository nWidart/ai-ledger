## ADDED Requirements

### Requirement: Use the room of a wide session sheet
The session timeline SHALL span the width of the session sheet at either width, and SHALL draw a taller plot when it is at least 900px wide. When the sheet has room for two columns, the session's Models and Tools SHALL sit side by side; without that room they SHALL stack. The wide session sheet SHALL show the same sections and figures as the narrow one.

#### Scenario: Wide session sheet
- **WHEN** the user widens a session sheet on a 1440px viewport
- **THEN** the timeline spans the sheet with a taller plot, and Models sits beside Tools

#### Scenario: Narrow session sheet
- **WHEN** the user views a session sheet at the narrow width
- **THEN** the timeline has its narrow height and Models and Tools stack
