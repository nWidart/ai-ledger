# Spec Delta

## ADDED Requirements

### Requirement: Record a session's model time, tool time and lines changed
The store SHALL derive each Claude Code session's API time (`totalAPIDuration`), its tool time (`totalToolDuration`), and the lines its edits added (`totalLinesAdded`) and removed (`totalLinesRemoved`), from the session's `cost-state` lines. The figures SHALL include the session's subagent work, as Claude Code counts it. A session with no `cost-state` line SHALL have no figures, not zero figures.

#### Scenario: Session that ends once
- **WHEN** a session's only `cost-state` line states 90 s of API time, 40 s of tool time, 120 lines added and 30 removed
- **THEN** the session records 90 s of model time, 40 s of tool time, 120 lines added and 30 removed

#### Scenario: Codex session
- **WHEN** a Codex session is ingested
- **THEN** it has no model time, tool time or lines changed

#### Scenario: Session from before the line existed
- **WHEN** a Claude Code session's lines hold no `cost-state` line
- **THEN** it has no model time, tool time or lines changed

### Requirement: Count each run of a session once
A run SHALL be the `cost-state` lines of a session that share one `startTime`. A `cost-state` line holds running totals, so a later line of the same run SHALL replace that run's figures only where it is larger. A session's figures SHALL be the sum over its runs.

#### Scenario: Snapshots of one run
- **WHEN** a session has two `cost-state` lines with the same `startTime`, stating 60 s and then 90 s of API time
- **THEN** the session records 90 s of model time, not 150 s

#### Scenario: Session resumed in a new run
- **WHEN** a session has a `cost-state` line with 60 s of API time, and a later one with a different `startTime` and 20 s
- **THEN** the session records 80 s of model time

#### Scenario: Line read twice
- **WHEN** a `cost-state` line is ingested again, or a copy of it appears in another file under the same session
- **THEN** the session's figures do not change

### Requirement: Add the session timing to an existing store
A store created before the session timing existed SHALL gain it, empty, when opened, without losing or re-reading any line. Newly ingested `cost-state` lines SHALL fill it, and a rebuild SHALL fill it from the lines already stored.

#### Scenario: Store upgraded
- **WHEN** the app opens a store created before the session timing existed
- **THEN** no session has model time, and the line, session, request and tool call counts are unchanged

#### Scenario: Rebuild fills it
- **WHEN** the user runs a rebuild on that store
- **THEN** every session with a stored `cost-state` line has its model time, tool time and lines changed
