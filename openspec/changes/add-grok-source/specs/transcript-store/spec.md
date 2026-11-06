# Spec Delta

## MODIFIED Requirements

### Requirement: Record the source of every line and session
The store SHALL record which coding agent wrote each stored line, file and session. Today the agents are `claude` (Claude Code), `codex` (Codex CLI) and `grok` (Grok CLI). Lines and sessions stored before sources existed SHALL be recorded as `claude`, and none of them SHALL be lost or re-read.

#### Scenario: Existing store upgraded
- **WHEN** the app opens a store that holds 458,905 lines and has no source information
- **THEN** all 458,905 lines and their sessions are recorded as `claude`, and every Activity, Cost and Errors figure for them is unchanged

#### Scenario: Lines from both agents
- **WHEN** one ingest reads a Claude Code transcript and a Codex session file
- **THEN** the Claude lines and session are recorded as `claude`, and the Codex lines and session as `codex`

#### Scenario: Lines from Grok
- **WHEN** one ingest reads a Claude Code transcript and a Grok session's `updates.jsonl`
- **THEN** the Claude lines and session are recorded as `claude`, and the Grok lines and session as `grok`

## ADDED Requirements

### Requirement: Keep the cost a source reports
A request SHALL carry the cost in US dollars that its source reported, when the source reports one, and no cost otherwise. Opening a store created before this column existed SHALL add it without losing or re-reading any line, and a rebuild SHALL derive it again from the stored lines.

#### Scenario: Store upgraded
- **WHEN** the app opens a store whose requests have no cost column
- **THEN** the column is added, every existing request has no reported cost, and its line, session and request counts are unchanged

#### Scenario: Claude and Codex requests
- **WHEN** ingest derives a Claude or Codex request
- **THEN** the request has no reported cost

#### Scenario: Rebuild keeps reported costs
- **WHEN** the user runs a rebuild on a store that holds Grok turns
- **THEN** every Grok request has the same reported cost as before the rebuild
