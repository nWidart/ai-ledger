# Spec Delta

## MODIFIED Requirements

### Requirement: Show time metrics
The dashboard SHALL show session duration, thinking time, and tool call latency per tool. A session's duration SHALL be its active time: the time between its main-thread requests and tool calls, leaving out every pause over 20 minutes, the same rule as the session timeline.

The dashboard SHALL also show the model time and tool time that sessions record, summed over the view's sessions that record them, and the output speed. Output speed SHALL be the output tokens of those sessions divided by their model time, in tokens per second. Like duration, these are whole-session figures: they include the session's subagent work and its time outside the range. Output speed SHALL be compared with the previous period, and a fall SHALL read as worse. When no session in the view records model time, the dashboard SHALL show no model time or tool time, and SHALL show output speed as not available with the reason.

#### Scenario: Resumed session
- **WHEN** a session works for 30 minutes, pauses for 22 hours, then works for 5 minutes
- **THEN** its duration is 35 minutes, not 23 hours

#### Scenario: Slow tool
- **WHEN** the user views tool latency
- **THEN** each tool shows its median and 95th percentile duration from `tool_use` to `tool_result`

#### Scenario: Model and tool time
- **WHEN** the view holds two sessions that record 30 and 10 minutes of model time and 20 and 5 minutes of tool time, and a third that records none
- **THEN** the dashboard states 40 minutes waiting on the model and 25 minutes running tools, and does not count the third session in either figure

#### Scenario: Output speed
- **WHEN** the sessions that record model time spent 1,000 seconds of it and wrote 98,000 output tokens
- **THEN** output speed reads 98 tokens per second

#### Scenario: Nothing recorded
- **WHEN** every session in the view is a Codex session, or predates the `cost-state` line
- **THEN** output speed reads not available, its note says no session in the view records model time, and the duration note names no model or tool time

## ADDED Requirements

### Requirement: Show a session's model time, tool time and lines changed in its sheet
The session sheet SHALL show the session's model time, tool time, output speed, and the lines added and removed, when the session records them. The output speed SHALL be the session's output tokens divided by its model time. The sheet SHALL leave out each figure the session does not record, and SHALL show none of them for a session that records none.

#### Scenario: Recorded session
- **WHEN** a session records 15 minutes of model time, 6 minutes of tool time, 120 lines added and 30 removed, and wrote 81,000 output tokens
- **THEN** its sheet shows 15 minutes of model time, 6 minutes of tool time, 90 tokens per second, and +120 / −30 lines

#### Scenario: Session that records nothing
- **WHEN** the session is a Codex session
- **THEN** its sheet shows no model time, tool time, output speed or lines changed
