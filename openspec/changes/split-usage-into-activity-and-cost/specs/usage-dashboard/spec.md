# Spec Delta

## ADDED Requirements

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: commits, prompts, sessions and active days, with turns and tool calls per prompt. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits, prompts, sessions and active days of those 30 days, and no cost figure appears before the attention summary

### Requirement: Lead with what needs attention
Activity SHALL show, directly under its lead, every problem found in the view (error loops, sessions at 80% or more of the context window, tools failing over 10% of at least 20 calls, failed test runs), each with an action that opens the matching detail. When none is found it SHALL say so.

#### Scenario: Error loops present
- **WHEN** the view contains 3 error loops and 1 session near the context limit
- **THEN** the attention summary lists both problems, the error loops marked as needing action, and each offers to open its table

#### Scenario: Nothing found
- **WHEN** the view has no error loops, sessions near the limit, flaky tools or failed tests
- **THEN** the attention summary says that nothing needs attention

### Requirement: Show work per day
Activity SHALL chart commits, prompts or sessions per day across the view, with failed tool calls per day on the same chart, and selecting a day SHALL list that day's sessions.

#### Scenario: Pick a busy day
- **WHEN** the user selects a day with 40 commits on the work chart
- **THEN** the sessions table opens limited to the sessions that ran on that day

## MODIFIED Requirements

### Requirement: Show subagent share
The dashboard SHALL show what share of tokens came from subagents.

#### Scenario: Subagent heavy project
- **WHEN** 40% of a project's tokens came from subagent transcripts
- **THEN** the project shows a 40% subagent share

### Requirement: Show outcomes and efficiency ratios
The dashboard SHALL count successful `git commit` calls and test or build runs (with pass and fail counts) per session, and SHALL show tokens per commit and errors per 100 tool calls per project.

#### Scenario: Project with no commits
- **WHEN** a project has sessions but no commits in the range
- **THEN** per-commit ratios show as not available, not as zero or infinity

### Requirement: Show model and tool mix
The dashboard SHALL show usage and failure rates per tool, MCP server, skill and hook.

#### Scenario: MCP server failures
- **WHEN** an MCP server's tool calls fail
- **THEN** the dashboard shows that server's call count and failure rate

## REMOVED Requirements

### Requirement: Show token usage by kind
**Reason**: Token consumption by kind is a cost driver and moves to the cost dashboard with the cost figures it explains.
**Migration**: The same requirement is in `cost-dashboard` ("Show token usage by kind"); the chart is on `/cost`.

### Requirement: Show estimated cost
**Reason**: Cost moves off Activity so the page leads with work.
**Migration**: The same requirement is in `cost-dashboard` ("Show estimated cost"); the figures are on `/cost`. The sessions table on Activity keeps a cost column.

### Requirement: Show cache efficiency
**Reason**: Cache hit ratio and 1-hour write share are cost levers and belong with cost.
**Migration**: The same requirement is in `cost-dashboard` ("Show cache efficiency").
