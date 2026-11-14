# Spec Delta

## ADDED Requirements

### Requirement: Record the size of each tool result
Each derived tool call SHALL carry the size in bytes of its result text as the transcript stores it (the UTF-8 length of the result's text content; an image or other non-text block counts nothing), or no size when the source gives the call no result text. The size SHALL be recorded when the result is ingested, also when the result arrives in a later ingest than the call.

#### Scenario: Result with text
- **WHEN** a `tool_result` block holds 12,345 bytes of text
- **THEN** its tool call records a result size of 12,345

#### Scenario: Result in a later ingest
- **WHEN** a call's `tool_result` is read by a later ingest than its `tool_use`
- **THEN** the call's record gains the result's size in that ingest

#### Scenario: Call without a result
- **WHEN** a call has no result yet
- **THEN** its record has no size

### Requirement: Record a session's context window and first compaction
Each derived session SHALL carry the context window its source states, or none when the source states none, and the time of its first compaction, or none when it never compacted. A later ingest of the same session SHALL keep the earliest compaction time and take the newest stated window.

#### Scenario: Claude Code session
- **WHEN** a Claude Code session's lines hold a `compact_boundary` at 10:42 and a later one at 11:30
- **THEN** the session records 10:42 as its first compaction and no stated window

#### Scenario: Compaction in a later ingest
- **WHEN** a session's first compaction is read by a later ingest than its first lines
- **THEN** the session's record gains that time

### Requirement: Add the context columns to an existing store
A store created before the result size, context window and first compaction columns existed SHALL gain them when opened, without losing or re-reading any line. The new columns SHALL be empty until the user runs a rebuild, which SHALL fill them from the stored lines.

#### Scenario: Store upgraded
- **WHEN** the app opens a store whose tables lack the three columns
- **THEN** the columns are added, every existing row has no value in them, and the line, session, request and tool call counts are unchanged

#### Scenario: Rebuild fills them
- **WHEN** the user runs a rebuild on that store
- **THEN** every tool call with a stored result text has its size, and every session that compacted has its first compaction time
