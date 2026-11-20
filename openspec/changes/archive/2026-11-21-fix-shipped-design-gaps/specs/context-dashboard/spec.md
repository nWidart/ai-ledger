## MODIFIED Requirements

### Requirement: Chart the largest contributors
The page SHALL chart the ten tools, or MCP servers, with the largest summed size, each beside the range from its median to its 95th percentile result, with its calls and its largest result, and SHALL fold the rest into one "Other" total. The total bars SHALL scale to the largest of the named rows; the Other row SHALL show its total with no bar. The main-thread and subagent totals SHALL be drawn as two parts of one bar.

#### Scenario: Many small or a few huge
- **WHEN** `Read` totals 2,000,000 bytes over 400 results with a 95th percentile of 12,000, and `Bash` totals 2,000,000 over 8 results with a 95th percentile of 900,000
- **THEN** the two tools show equal totals, and `Bash`'s range sits far above `Read`'s

#### Scenario: More than ten tools
- **WHEN** 14 tools have results with a known size
- **THEN** the chart shows the 10 with the largest totals and one "Other" row summing the remaining 4

#### Scenario: A long tail
- **WHEN** 30 small tools sum to more than the largest named tool
- **THEN** the largest named tool's bar is full, and the Other row has its total and no bar

### Requirement: Show and sort every contributor
A "Show all N" control SHALL list every tool, or MCP server, in the largest contributors table, with no Other row, and a second activation SHALL fold them again. The Name, Calls, Total, Typical result and Largest columns SHALL sort the rows, the Typical result column by the median. The rows SHALL start ordered by total, largest first. Folded, the ten shown SHALL stay the ten with the largest totals whatever the sort: the sort orders them, and the Other row stays last. A column's scale SHALL sit in its header outside the sort button, so the button is named for the column alone.

#### Scenario: Show all
- **WHEN** 14 tools have results with a known size and the user selects "Show all 14 tools"
- **THEN** the table lists all 14 and no Other row

#### Scenario: Sort by calls
- **WHEN** the user sorts the folded table by Calls
- **THEN** the ten largest tools by total are listed, the one with the most calls first, and the Other row is last
