# Spec Delta

## MODIFIED Requirements

### Requirement: Show work per day
Activity SHALL chart commits, prompts or sessions across the view, from its first day with a session, with errors per 100 tool calls on the same chart against its own axis (the failed count stays in the tooltip); a view with no tool calls SHALL show no rate line, axis or legend entry. Selecting a day SHALL list that day's sessions. The all-time lead SHALL date the history from that same day.

#### Scenario: History starts inside the range
- **WHEN** the user opens the 90-day view and the first session in it ran 40 days ago
- **THEN** the chart starts 40 days ago, with zeros for the idle days after that

#### Scenario: Pick a busy day
- **WHEN** the user selects a day with 40 commits on the work chart
- **THEN** the sessions table opens limited to the sessions that ran on that day

#### Scenario: Failure rate, not failed count
- **WHEN** two busy days have 6 failed calls of 200 and 5 of 100
- **THEN** the line shows 3 and 5 errors per 100 calls, and each tooltip also gives the failed count

## ADDED Requirements

### Requirement: Mark work chart bars with few tool calls
On the work chart, a bar with fewer than 50 tool calls SHALL draw its rate as a hollow dot and SHALL NOT set the rate axis, when at least one bar has 50 or more. The line SHALL still run through the dot, and a rate above the axis SHALL stop at its top. The legend SHALL give a key for the hollow dot, and the bar's tooltip, screen-reader text and data table SHALL say it has too few calls for a steady rate while still giving its rate.

#### Scenario: Quiet day does not set the scale
- **WHEN** a quiet day has 2 failed calls of 4 and the busy days have 6 of 200 and 5 of 100
- **THEN** the quiet day's rate is a hollow dot with the line through it, the rate axis ends near 10 and not 100, the legend gives a key for the hollow dot, and the day's tooltip gives 50 errors per 100 calls and says it has too few calls for a steady rate

#### Scenario: Every bar is quiet
- **WHEN** no bar has 50 tool calls
- **THEN** the chart marks no hollow dot and its rate axis fits the highest rate
