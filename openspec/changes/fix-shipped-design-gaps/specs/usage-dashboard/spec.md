## MODIFIED Requirements

### Requirement: Show output speed
The dashboard SHALL show output speed: the output tokens of the sessions that record model time divided by their model time, in tokens per second. It SHALL be compared with the previous period, and a fall SHALL read as worse. When no session in the view records model time, the dashboard SHALL show output speed as not available with the reason: when every session in the view is a Codex session, that Codex transcripts record no model time; otherwise, that no session in the view records it. Which sessions are in the view SHALL decide it, priced or not.

#### Scenario: Output speed
- **WHEN** the sessions that record model time spent 1,000 seconds of it and wrote 98,000 output tokens
- **THEN** output speed reads 98 tokens per second

#### Scenario: Nothing recorded
- **WHEN** every session in the view predates the `cost-state` line
- **THEN** output speed reads not available, its note says no session in the view records model time, and the duration note names no model or tool time

#### Scenario: Codex only
- **WHEN** every session in the view is a Codex session
- **THEN** output speed reads not available, and its note says Codex transcripts record no model time

#### Scenario: Priced Codex and unpriced Claude Code
- **WHEN** the view has all sources, its Codex requests are priced, its Claude Code requests are from an unpriced model, and no session records model time
- **THEN** output speed reads not available, and its note says no session in the view records model time, not that Codex records none

### Requirement: Mark work chart bars with few tool calls
On the work chart, a bar with fewer than 50 tool calls SHALL draw its rate as a hollow dot and SHALL NOT set the rate axis, when at least one bar has 50 or more. The line SHALL still run through the dot, and a rate above the axis SHALL stop at its top. The legend SHALL give a key for the hollow dot, and the bar's tooltip, screen-reader text and data table SHALL say it has too few calls for a steady rate while still giving its rate. In forced colors, the dot and its key SHALL stay hollow: a page-colored center in a text-colored ring. The chart's How measured toggletip SHALL name its bucket: "How measured: work per day", or "per week" on a chart by week.

#### Scenario: Quiet day does not set the scale
- **WHEN** a quiet day has 2 failed calls of 4 and the busy days have 6 of 200 and 5 of 100
- **THEN** the quiet day's rate is a hollow dot with the line through it, the rate axis ends near 10 and not 100, the legend gives a key for the hollow dot, and the day's tooltip gives 50 errors per 100 calls and says it has too few calls for a steady rate

#### Scenario: Every bar is quiet
- **WHEN** no bar has 50 tool calls
- **THEN** the chart marks no hollow dot and its rate axis fits the highest rate

#### Scenario: Forced colors
- **WHEN** the user's system forces its colors
- **THEN** the hollow dot and its key keep a page-colored center and a text-colored ring, apart from the solid line

#### Scenario: A chart by week
- **WHEN** the chart shows one bar per week
- **THEN** its How measured toggletip is named "How measured: work per week"
