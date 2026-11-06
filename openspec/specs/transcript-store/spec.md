# transcript-store Specification

## Purpose

AI Ledger's store: keeps a permanent, deduplicated, queryable local copy of every coding-agent transcript line (Claude Code's and Codex CLI's), so usage and error metrics survive transcript cleanup and do not require rescanning raw files.

## Requirements

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

### Requirement: Keep the store when its default file is renamed
The store's default file SHALL be `data/ai-ledger.duckdb`. When that file does not exist and a store exists at the earlier default `data/claude.duckdb`, opening the store SHALL move the earlier file, with its write-ahead log, to the new path and keep every stored line. Opening the store SHALL never create an empty store while a store exists at the earlier path.

#### Scenario: First start after the rename
- **WHEN** `data/claude.duckdb` holds 2,000,000 lines and `data/ai-ledger.duckdb` does not exist
- **THEN** the store opens at `data/ai-ledger.duckdb` with the same 2,000,000 lines, and `data/claude.duckdb` no longer exists

#### Scenario: Write-ahead log present
- **WHEN** `data/claude.duckdb.wal` exists next to the earlier file
- **THEN** it moves with the file, and lines it held are in the store after opening

#### Scenario: Both files exist
- **WHEN** both `data/claude.duckdb` and `data/ai-ledger.duckdb` exist
- **THEN** the store opens `data/ai-ledger.duckdb`, leaves `data/claude.duckdb` untouched, and logs that the earlier file was not moved

#### Scenario: Explicit database path
- **WHEN** the user passes `--db <file>`
- **THEN** the store opens that file and moves nothing

#### Scenario: Moved file stays private
- **WHEN** the earlier file is moved to the new path
- **THEN** the new file has mode `0600`

### Requirement: Group a renamed repository under its new name
Sessions run in a repository before and after its folder was renamed SHALL belong to one project, named after the new folder, when the rename is listed as a project alias. The alias SHALL apply to sessions already in the store as well as to new ones.

#### Scenario: This repository renamed
- **WHEN** the store holds sessions whose `cwd` is `~/Sites/projects/claude-errors-dashboard`, and new sessions run in `~/Sites/projects/ai-ledger`
- **THEN** all of them belong to project `ai-ledger`, and no project named `claude-errors-dashboard` appears in any dashboard

#### Scenario: Worktree of the renamed repository
- **WHEN** a session ran in `~/Sites/projects/claude-errors-dashboard/.claude/worktrees/x`
- **THEN** it belongs to project `ai-ledger`

#### Scenario: Rebuild keeps the alias
- **WHEN** the user runs a rebuild
- **THEN** sessions from the old folder still belong to project `ai-ledger`

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
