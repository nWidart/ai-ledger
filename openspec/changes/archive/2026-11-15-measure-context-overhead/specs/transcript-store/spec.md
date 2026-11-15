## ADDED Requirements

### Requirement: Keep the context snapshots that /context records
The store SHALL keep each `/context` result a Claude Code transcript records as a structured `contextUsage` object: its time, session, project, folder, Claude Code version, model and window, the tokens and state of each category, and the tokens of each MCP tool, memory file, custom agent and skill. A `/context` line without that object SHALL be skipped.

#### Scenario: Snapshot from a print-mode run
- **WHEN** a transcript holds the line `claude -p "/context"` wrote in `/home/dev/demo` for `claude-fable-5-2` with 4,107 tokens of system prompt
- **THEN** the store holds a snapshot for that session and project with a 1,000,000-token window and a system prompt category of 4,107 tokens

### Requirement: Derive context snapshots on rebuild
Rebuild SHALL derive the context snapshots from the stored lines, so that runs ingested before this change count too.

#### Scenario: Rebuild keeps snapshots
- **WHEN** the user runs a rebuild
- **THEN** the snapshots are derived again from the stored lines and equal those ingest produced

### Requirement: Leave measuring sessions out of the session counts
A session whose only lines are a `/context` run has no API request and SHALL NOT count as a session on any page.

#### Scenario: Measuring session is not a session
- **WHEN** a transcript holds only a `/context` run
- **THEN** Activity counts no session for it
