# Spec Delta

## ADDED Requirements

### Requirement: Show the projects inside Other
The cost chart SHALL stack the projects that own a color of their own and sum the rest into Other. The day's cost tooltip SHALL list the three costliest projects inside Other on that day, with their cost, and SHALL add "+ N more" when there are more than three. The day's screen-reader text SHALL carry the same projects. A project with no name SHALL read as "(no project)".

#### Scenario: More than three projects in Other
- **WHEN** a day's Other holds projects B ($5), C ($3), D ($1) and E ($0.5), and the user hovers the day
- **THEN** the tooltip lists B, C and D under Other with their costs, then "+ 1 more"

#### Scenario: One project in Other
- **WHEN** a day's Other holds only project F ($2)
- **THEN** the tooltip lists F under Other

#### Scenario: Token view
- **WHEN** the user shows tokens per day
- **THEN** the tooltip lists the token kinds only, as before
