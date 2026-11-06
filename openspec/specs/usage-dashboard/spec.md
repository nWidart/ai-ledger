# usage-dashboard Specification

## Purpose

Shows how Claude Code spends tokens, money and time in each project, and how much work it gets done for that spend, so inefficient projects and habits stand out.

## Requirements

### Requirement: Filter by time range and project
The usage dashboard SHALL let the user pick a time range and a project, and every metric on the page SHALL reflect that selection. The project filter SHALL change only through the filter controls or an explicit filter action; selecting a project or session elsewhere SHALL open its details in a side sheet without changing the filter.

#### Scenario: Narrow to one project
- **WHEN** the user selects project `foo` and the last 7 days
- **THEN** every chart, tile and table shows only `foo` sessions from those 7 days

#### Scenario: Inspect a project without filtering
- **WHEN** the user selects project `foo` in the spend ledger or the project table
- **THEN** a side sheet shows `foo`'s summary, the page keeps its current filter, and the sheet offers a button to filter the dashboard to `foo`

### Requirement: Show token usage by kind
The dashboard SHALL show input, output, thinking, cache read, 5-minute cache write and 1-hour cache write tokens per project and over time.

#### Scenario: Daily token chart
- **WHEN** the user views a project
- **THEN** a chart shows each token kind per day

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model

### Requirement: Show cache efficiency
The dashboard SHALL show the cache hit ratio (cache read tokens divided by all input tokens) and the share of cache writes that used the 1-hour lifetime.

#### Scenario: Cache ratio per project
- **WHEN** the user compares projects
- **THEN** each project shows its cache hit ratio and 1-hour write share

### Requirement: Show subagent share
The dashboard SHALL show what share of tokens and cost came from subagents.

#### Scenario: Subagent heavy project
- **WHEN** 40% of a project's tokens came from subagent transcripts
- **THEN** the project shows a 40% subagent share

### Requirement: Show context health
The dashboard SHALL show peak context size per session, the number of compactions per session, and tokens spent per user prompt.

#### Scenario: Session near the limit
- **WHEN** a session's largest request used most of the model's context window
- **THEN** that session is listed among sessions near the context limit

### Requirement: Show autonomy and friction
The dashboard SHALL show assistant turns and tool calls per user prompt, the rate of user interruptions and rejections, and error loops (the same tool failing three or more times in a row within a session).

#### Scenario: Error loop detected
- **WHEN** a session has four consecutive failed `Edit` calls
- **THEN** the session counts one error loop and links to it in the errors dashboard

### Requirement: Show time metrics
The dashboard SHALL show session duration, thinking time, and tool call latency per tool.

#### Scenario: Slow tool
- **WHEN** the user views tool latency
- **THEN** each tool shows its median and 95th percentile duration from `tool_use` to `tool_result`

### Requirement: Show outcomes and efficiency ratios
The dashboard SHALL count successful `git commit` calls and test or build runs (with pass and fail counts) per session, and SHALL show tokens per commit, cost per commit and errors per 100 tool calls per project.

#### Scenario: Project with no commits
- **WHEN** a project has sessions but no commits in the range
- **THEN** per-commit ratios show as not available, not as zero or infinity

### Requirement: Show model and tool mix
The dashboard SHALL show the split of requests by model and effort level, and usage and failure rates per tool, MCP server, skill and hook.

#### Scenario: MCP server failures
- **WHEN** an MCP server's tool calls fail
- **THEN** the dashboard shows that server's call count and failure rate

### Requirement: Link to a project or session
The usage dashboard SHALL keep the selected project, time range, inspected project and open session in the page URL, so a view can be reopened or shared into an agent prompt, and browser Back SHALL retrace filter and sheet changes.

#### Scenario: Open a copied URL
- **WHEN** the user opens a copied usage dashboard URL
- **THEN** the same project, range and session are selected
