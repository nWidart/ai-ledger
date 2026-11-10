# Spec Delta

## ADDED Requirements

### Requirement: Read Codex thread names
The store SHALL ingest the Codex session index, `session_index.jsonl` in the Codex home, and keep its lines verbatim like any transcript line. It SHALL be read incrementally. Each line names a session by its id and gives its thread name. A later line for the same session SHALL replace that session's thread name.

#### Scenario: Thread renamed
- **WHEN** the index holds a line naming session A "Review MRI findings" and a later line naming it "Knee MRI review"
- **THEN** session A's thread name is "Knee MRI review"

#### Scenario: Index read before its session
- **WHEN** an ingest reads the index line for session B before it reads B's rollout file
- **THEN** once B's rollout file is ingested, B has that thread name as its title

#### Scenario: Name for a session never stored
- **WHEN** the index names a session whose rollout file was never ingested
- **THEN** no session appears in the dashboards because of that line

#### Scenario: Index missing
- **WHEN** the Codex home has no `session_index.jsonl`
- **THEN** ingest reads the rollout files as before, and Codex sessions are titled from their first prompt
