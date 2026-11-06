# Spec Delta

## ADDED Requirements

### Requirement: Record the source of every line and session
The store SHALL record which coding agent wrote each stored line, file and session. Today the agents are `claude` (Claude Code) and `codex` (Codex CLI). Lines and sessions stored before sources existed SHALL be recorded as `claude`, and none of them SHALL be lost or re-read.

#### Scenario: Existing store upgraded
- **WHEN** the app opens a store that holds 458,905 lines and has no source information
- **THEN** all 458,905 lines and their sessions are recorded as `claude`, and every Activity, Cost and Errors figure for them is unchanged

#### Scenario: Lines from both agents
- **WHEN** one ingest reads a Claude Code transcript and a Codex session file
- **THEN** the Claude lines and session are recorded as `claude`, and the Codex lines and session as `codex`

### Requirement: Derive every source into the same records
Each source's lines SHALL be derived into the same sessions, requests, tool calls and prompts. Token columns SHALL mean the same thing whatever the source: uncached input, output, thinking as part of output, cache read and cache write. Metrics therefore combine sources without double counting.

#### Scenario: Totals across sources
- **WHEN** a day has Claude requests totaling 1,000,000 tokens and Codex requests totaling 200,000 tokens
- **THEN** that day's total is 1,200,000 tokens

#### Scenario: Rebuild with both sources
- **WHEN** the user runs a rebuild
- **THEN** each file's lines are re-derived by its own source's parser, and the derived records equal those that ingest produced
