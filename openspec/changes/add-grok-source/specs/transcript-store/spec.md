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
- **WHEN** one ingest reads a Grok session log
- **THEN** its lines and session are recorded as `grok`

## ADDED Requirements

### Requirement: Keep the cost a source reports
A request SHALL carry the cost its source reported for it, when the source reports one. Requests from sources that report no cost SHALL carry none. Opening a store from before this field SHALL add it with no value, and SHALL NOT read any line again.

#### Scenario: Existing store upgraded
- **WHEN** the app opens a store whose requests have no reported cost field
- **THEN** every existing request has no reported cost, and every figure is unchanged

#### Scenario: Rebuild keeps reported costs
- **WHEN** the user runs a rebuild on a store with Grok requests
- **THEN** each Grok request has the same reported cost as before

### Requirement: Keep the context size a source states
A request SHALL carry the context size its source stated for its model call, when the source states one apart from its token counts. Requests from sources that state none SHALL carry none, and their context SHALL be their input and cache tokens. Opening a store from before this field SHALL add it with no value, and SHALL NOT read any line again.

#### Scenario: Existing store upgraded
- **WHEN** the app opens a store whose requests have no stated context size field
- **THEN** every existing request has no stated context size, and every figure is unchanged

#### Scenario: Source that states none
- **WHEN** Claude Code or Codex requests are ingested
- **THEN** they carry no stated context size, and each one's context is its input and cache tokens
