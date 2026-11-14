# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Announce the chart as an application`
- TO: `### Requirement: Announce the chart as a labelled group`

## MODIFIED Requirements

### Requirement: Announce the chart as a labelled group
The chart box SHALL have `role="group"`, as it is a control the user reads with arrow keys, Enter and Space, and SHALL NOT have `role="application"` or `aria-roledescription`. It SHALL keep its label (the instructions and the selected bucket), be described by the chart's hint, and keep its live region for the keyboard reading. Escape SHALL dismiss its tooltip.

#### Scenario: Role
- **WHEN** a screen reader reaches the chart
- **THEN** it exposes a group with the chart's label and hint, and the arrow keys read each point

#### Scenario: Escape
- **WHEN** the chart's tooltip is open and the user presses Escape
- **THEN** the tooltip closes and the selected bucket is unchanged
