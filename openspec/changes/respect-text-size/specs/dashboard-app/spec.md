# Spec Delta

## ADDED Requirements

### Requirement: Follow the browser's text size
Text in the dashboard, chart labels included, SHALL be sized relative to the browser's default font size, and the dashboard SHALL NOT set the font size of the root element. At the default of 16px each page SHALL render as it did with fixed sizes. The page SHALL opt in to the operating system's text scale in browsers that support the opt-in.

#### Scenario: Default text size
- **WHEN** the browser's default font size is 16px
- **THEN** body text is 14px and every page looks as it did before

#### Scenario: Larger text
- **WHEN** the user sets the browser's default font size to 32px and opens any dashboard page
- **THEN** body text is 28px, and headings, tables and controls are twice their default size

#### Scenario: Chart labels
- **WHEN** the browser's default font size is 20px and a chart is drawn
- **THEN** its axis labels are 1.25 times their default size

#### Scenario: Operating system text scale
- **WHEN** a browser that supports the `text-scale` opt-in loads the dashboard on a system with a larger text setting
- **THEN** the dashboard's text grows with that setting

### Requirement: Keep content whole at a larger text size
At a browser default font size of up to 32px (200%), on a 1280px wide viewport, no text SHALL be clipped or overlap other content unless it was already clipped at 16px, and no page SHALL scroll sideways.

#### Scenario: Control labels
- **WHEN** the browser's default font size is 32px
- **THEN** no button, tab, chip or badge cuts off its label

#### Scenario: Chart labels stay inside
- **WHEN** the browser's default font size is 32px and a chart is drawn
- **THEN** its axis labels stay inside the chart and do not overlap each other or the plot

#### Scenario: No sideways scroll
- **WHEN** the browser's default font size is 32px and the viewport is 1280px wide
- **THEN** no dashboard page scrolls sideways
