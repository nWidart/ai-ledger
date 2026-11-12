# Spec Delta

## ADDED Requirements

### Requirement: Break a type down by tool and agent
The open type's detail SHALL list, next to By project, the type's top five tools (By tool) and top five agents (By agent), each with its error count and share of the type's errors in the detail, and fold the rest into "N more: M errors". A By agent row SHALL set the page's source filter. By agent SHALL be hidden under a source filter and when the type's errors come from one agent only.

#### Scenario: Top tools and agents
- **WHEN** a type's errors come from Edit and Bash, by Claude Code and Codex
- **THEN** By tool lists Edit and Bash and By agent lists Claude Code and Codex, each with count and share

#### Scenario: One agent
- **WHEN** all of a type's errors come from one agent
- **THEN** By agent is not shown

#### Scenario: Filter to an agent
- **WHEN** the user clicks a By agent row
- **THEN** the page's source filter is that agent and By agent is hidden

### Requirement: Narrow the type detail to a tool
A By tool row SHALL narrow the open type's detail, and only it, to the errors of that tool: the incident sentence, By project, By agent, and the incidents and examples with their counts. The summary, chart and type table SHALL NOT change. The selection SHALL apply on top of a selected chart bucket. The selected row SHALL be marked pressed, and a click on it, or on a chip by the list header that names the tool, SHALL clear the selection.

#### Scenario: Select a tool
- **WHEN** the user clicks a tool in By tool
- **THEN** the detail counts only that tool's errors, the row is pressed, a chip names the tool, and the type table is unchanged

#### Scenario: One tool
- **WHEN** a type's errors come from one tool only and none is selected
- **THEN** By tool is not shown

#### Scenario: Clear
- **WHEN** the user clicks the pressed row or the chip
- **THEN** the detail returns to all tools and focus stays on a control that still exists

### Requirement: Keep the selected tool in the view
The selected tool SHALL be part of the URL view under `etool`, push a history entry, and SHALL NOT be saved with the last view. It SHALL clear when the type closes, another type opens, or the open type has no error of that tool in the view. A linked example of another tool SHALL show under "Outside current filters", Clear filters SHALL also clear the tool, and an example's permalink SHALL leave it out.

#### Scenario: Another type opens
- **WHEN** a tool is selected and the user opens another type
- **THEN** the tool selection is cleared

#### Scenario: Linked example of another tool
- **WHEN** a link opens an example of a tool other than the selected one
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the tool
