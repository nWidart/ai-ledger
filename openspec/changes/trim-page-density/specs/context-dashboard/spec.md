# Spec Delta

## MODIFIED Requirements

### Requirement: Show what fills context
The page SHALL show, over the view's main-thread tool calls with a known result size, the summed result size by tool and by MCP server, each with its calls, its median, 95th percentile and largest result and an estimated token count labelled as an estimate. The figures SHALL be shown once, in the largest contributors table, with no second table of the same rows. The results of calls made inside subagent transcripts SHALL be summed apart, as bytes that never entered the main thread's context.

#### Scenario: By tool
- **WHEN** 40 main-thread `Read` results total 2,000,000 bytes and 10 `Bash` results total 300,000
- **THEN** `Read` leads with 2,000,000 bytes and about 500,000 estimated tokens, and `Bash` follows

#### Scenario: Subagent results apart
- **WHEN** a session's subagent transcripts hold 5,000,000 bytes of tool results and its main thread 800,000
- **THEN** the main-thread figures count 800,000 bytes and the subagent figure 5,000,000

#### Scenario: One table
- **WHEN** the user opens the What fills context section
- **THEN** it shows the largest contributors table and no separate By tool or By MCP server table

### Requirement: Chart the largest contributors
The page SHALL chart the ten tools, or MCP servers, with the largest summed size, each beside the range from its median to its 95th percentile result, with its calls and its largest result, and SHALL fold the rest into one "Other" total. A "Show all N" control SHALL list every row instead, with no Other row, and a second activation SHALL fold them again. The Name, Calls, Total, Typical result and Largest columns SHALL sort the rows, the Typical result column by the median; the rows start ordered by total, largest first. The main-thread and subagent totals SHALL be drawn as two parts of one bar.

#### Scenario: Many small or a few huge
- **WHEN** `Read` totals 2,000,000 bytes over 400 results with a 95th percentile of 12,000, and `Bash` totals 2,000,000 over 8 results with a 95th percentile of 900,000
- **THEN** the two tools show equal totals, and `Bash`'s range sits far above `Read`'s

#### Scenario: More than ten tools
- **WHEN** 14 tools have results with a known size
- **THEN** the chart shows the 10 with the largest totals and one "Other" bar summing the remaining 4, and "Show all 14 tools" lists all 14

#### Scenario: Sort by calls
- **WHEN** the user sorts the table by Calls
- **THEN** the tool with the most calls comes first, and the ten shown are the ten with the most calls

### Requirement: Give data-driven tips
The page SHALL show tips from a fixed set of rules, each with a severity, a title, its evidence figures, its advice and the sessions that match it. The rules and their thresholds SHALL be fixed in the app, not learned or generated. A tip SHALL be shown only when its rule fires on the view's data, and the page SHALL say when none fires. Tips SHALL show as compact cards side by side, never as full-width cards stacked one under another.

#### Scenario: Nothing fires
- **WHEN** no rule fires on the view
- **THEN** the tips section says that nothing stands out and lists no tip

#### Scenario: Rule fires
- **WHEN** a main-thread tool result in the view is 150,000 bytes
- **THEN** the large-results tip is shown with its evidence, advice and the session that holds the result

#### Scenario: Several tips
- **WHEN** three rules fire on a 1440-pixel-wide window
- **THEN** the three tips show as compact cards on one row

## ADDED Requirements

### Requirement: Lead with the typical start
The Context lede SHALL state the view's median starting context and, when known, its median share of the window. The number of sessions that compacted SHALL show in the Growth vitals, as that many of the view's sessions, not in the lede.

#### Scenario: Lede and compactions
- **WHEN** the view's median start is 24,000 tokens, 12% of the window, and 9 of 40 sessions compacted
- **THEN** the lede states 24,000 tokens and 12% of its window, and the Growth vitals show 9 sessions compacted of 40
