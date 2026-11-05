# Spec Delta

## Purpose

Keeps a permanent, deduplicated, queryable local copy of every Claude Code transcript line, so usage and error metrics survive transcript cleanup and do not require rescanning raw files.

## ADDED Requirements

### Requirement: Store every transcript line verbatim
The store SHALL keep the exact text of every line from every transcript file under the transcript root, including main session files and subagent files, so any metric can be re-derived later.

#### Scenario: Request and response bodies kept
- **WHEN** a transcript contains `user`, `assistant`, `api-request`, `api-request-blob`, `api-request-shape`, `system` or `attachment` lines
- **THEN** the store holds each line's original JSON text, unchanged

#### Scenario: Subagent transcripts included
- **WHEN** a session has files under `<project>/<session>/subagents/*.jsonl`
- **THEN** their lines are stored and marked as subagent lines

#### Scenario: Malformed line
- **WHEN** a line is not valid JSON
- **THEN** the store keeps its text, marks it unparsed, and ingest continues with the next line

### Requirement: Retain data after transcript deletion
The store SHALL never delete or alter stored lines because a source transcript file was deleted, truncated or rewritten.

#### Scenario: Source file deleted
- **WHEN** Claude Code deletes a transcript file that was already ingested
- **THEN** all of that file's lines remain in the store and in every metric

### Requirement: Ingest incrementally
Ingest SHALL read only bytes added to each transcript file since the previous ingest, and SHALL store only complete, newline-terminated lines.

#### Scenario: File grew
- **WHEN** a file grew by N bytes since the last ingest
- **THEN** ingest reads only those N bytes

#### Scenario: Line still being written
- **WHEN** a file ends with a partial line
- **THEN** ingest stores lines up to the last newline and reads the partial line on a later ingest

#### Scenario: File rewritten or shrunk
- **WHEN** a file is now smaller than the stored read position
- **THEN** ingest reads the file from the start, and deduplication prevents duplicate rows

### Requirement: Deduplicate repeated lines
The store SHALL keep each logical record once, even when resumed or forked sessions copy earlier lines into a new file.

#### Scenario: Line with a uuid copied into another file
- **WHEN** two files contain a line with the same `uuid`
- **THEN** the store keeps one copy

#### Scenario: Request blob repeated
- **WHEN** two `api-request-blob` lines share the same `hash`
- **THEN** the store keeps one copy of the blob

### Requirement: Count usage once per API response
Derived usage SHALL count each API response's `usage` exactly once, even though Claude Code writes one `assistant` line per content block of the same response.

#### Scenario: Response split across lines
- **WHEN** three `assistant` lines share one `message.id`
- **THEN** that response's input, output and cache tokens are counted once

### Requirement: Group worktrees by repository
Each session SHALL belong to one project. Sessions run in a git worktree SHALL belong to the same project as the repository's main checkout.

#### Scenario: Worktree of an existing repo
- **WHEN** a session's `cwd` is a worktree of the repo at `~/Sites/projects/foo`
- **THEN** the session's project is `foo`

#### Scenario: Directory no longer exists
- **WHEN** a session's `cwd` no longer exists on disk
- **THEN** the project is derived from the path, stripping known worktree path segments, and the result is stable across ingests

### Requirement: Provide derived records
The store SHALL provide derived sessions, API requests, tool calls and user prompts, each linked to its project and session, and SHALL be able to rebuild them from the stored raw lines alone.

#### Scenario: Tool call with result
- **WHEN** a `tool_use` block and its `tool_result` are ingested
- **THEN** one tool call record holds tool name, input summary, start and end time, error flag, error text and error category

#### Scenario: Rebuild after parser change
- **WHEN** the user runs a rebuild
- **THEN** all derived records are regenerated from raw lines, including lines whose source files no longer exist

### Requirement: Keep transcript data private
The database file SHALL be readable and writable only by the current OS user and SHALL never be committed to git.

#### Scenario: New database file
- **WHEN** the store creates its database file
- **THEN** the file has mode `0600` and its directory is git-ignored
