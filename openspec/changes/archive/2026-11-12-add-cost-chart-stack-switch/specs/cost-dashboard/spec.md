# Spec Delta

## ADDED Requirements

### Requirement: Stack the cost chart by project, model or agent
In the cost metric the chart SHALL offer a "Stack by" switch with Project, Model and Agent, Project by default. The choice SHALL be kept in the browser. The switch SHALL NOT show in the tokens metric. A day's total SHALL be the same in every stacking. Under Model the chart SHALL give a series color to each of the models with the most cost in the view, up to the number of series colors, and sum the rest into Other, labelled without the `claude-` prefix. Under Agent the chart SHALL show one series per agent and no Other. The heading, the hint, the chart's label and the day's screen-reader text SHALL name the stacking. A one-project view SHALL offer all three stackings.

#### Scenario: Switch to Model
- **WHEN** the user selects Model
- **THEN** the bars and the legend restack by model, and the tooltip total for each day is unchanged

#### Scenario: Stacking is remembered
- **WHEN** the user selects Agent and reopens the page
- **THEN** the chart stacks by agent

#### Scenario: Tokens metric
- **WHEN** the user shows tokens per day
- **THEN** the "Stack by" switch is not shown

#### Scenario: Agent key
- **WHEN** the chart stacks by agent and the user selects the Codex key
- **THEN** the page filters to Codex, and the same key then clears the filter

#### Scenario: Model key
- **WHEN** the chart stacks by model
- **THEN** a model key does not filter the page

#### Scenario: Today under Model
- **WHEN** the chart stacks by model
- **THEN** today's bar is hatched and the 7-day average leaves today out

## MODIFIED Requirements

### Requirement: Show the projects inside Other
The cost chart SHALL stack the projects, or the models, that own a color of their own and sum the rest into Other. The day's cost tooltip SHALL list the three costliest names inside Other on that day, with their cost, and SHALL add "+ N more" when there are more than three. The day's screen-reader text SHALL carry the same names. A project with no name SHALL read as "(no project)".

#### Scenario: More than three projects in Other
- **WHEN** a day's Other holds projects B ($5), C ($3), D ($1) and E ($0.5), and the user hovers the day
- **THEN** the tooltip lists B, C and D under Other with their costs, then "+ 1 more"

#### Scenario: More than three models in Other
- **WHEN** the chart stacks by model and a day's Other holds models m7 ($4), m8 ($3), m9 ($2) and m10 ($1)
- **THEN** the tooltip lists m7, m8 and m9 under Other with their costs, then "+ 1 more"

#### Scenario: One project in Other
- **WHEN** a day's Other holds only project F ($2)
- **THEN** the tooltip lists F under Other

#### Scenario: Token view
- **WHEN** the user shows tokens per day
- **THEN** the tooltip lists the token kinds only, as before
