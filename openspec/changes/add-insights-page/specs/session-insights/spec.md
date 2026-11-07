# Spec Delta

## Purpose

Keeps a local copy of the per-session judgments and figures that Claude Code's `/insights` command writes, and ties each one to a session and a project, so the ledger can show them per project and keep them after Claude Code overwrites or deletes them.

## ADDED Requirements

### Requirement: Read facets and session meta during ingest
Every ingest SHALL read the JSON files under `facets/` and `session-meta/` in Claude Code's usage-data directory (default `~/.claude/usage-data`, set with `--usage-data`). It SHALL keep each file's text verbatim and SHALL NOT read the narrative `report*.html` files.

#### Scenario: First ingest with usage data
- **WHEN** the usage-data directory holds 150 facet files and 586 session-meta files and the store has none
- **THEN** after ingest the store holds 150 facets and 586 session-meta records, each with its file's original text

#### Scenario: Report files ignored
- **WHEN** the usage-data directory holds `report.html` and `report-2026-11-07-101858.html`
- **THEN** ingest reads neither file and stores nothing from them

### Requirement: Read usage-data files incrementally
Ingest SHALL read a usage-data file again only when its size or modification time changed since the last ingest. A file that changed SHALL replace that session's earlier facet or meta record.

#### Scenario: Nothing changed
- **WHEN** ingest runs twice and no usage-data file changed in between
- **THEN** the second ingest reads no usage-data file

#### Scenario: Facet rewritten by a new `/insights` run
- **WHEN** `/insights` rewrites the facet of session `abc` with outcome `fully_achieved` where it was `partially_achieved`
- **THEN** after the next ingest session `abc` has one facet, with outcome `fully_achieved`

### Requirement: Keep facets after their files are deleted
The store SHALL keep a facet or session-meta record after its file is deleted from the usage-data directory.

#### Scenario: Usage data cleared
- **WHEN** the user deletes `~/.claude/usage-data/facets/` after an ingest
- **THEN** the facets stay in the store and on the Insights page

### Requirement: Skip bad usage data without failing ingest
A missing usage-data directory, an unreadable file, malformed JSON, or JSON without a `session_id` SHALL be skipped. Ingest SHALL count skipped files in its result and SHALL go on with transcripts and other files.

#### Scenario: No usage-data directory
- **WHEN** `~/.claude/usage-data` does not exist
- **THEN** ingest succeeds, stores transcripts as before, and reports no usage-data files read and none skipped

#### Scenario: One malformed facet
- **WHEN** one facet file holds invalid JSON and 149 are valid
- **THEN** ingest stores the 149 facets, reports 1 skipped file, and does not store the invalid one

#### Scenario: Malformed file fixed later
- **WHEN** a skipped facet file is rewritten as valid JSON
- **THEN** the next ingest stores it

### Requirement: Attribute facets to sessions and projects
Each facet and session-meta record SHALL be keyed by session id. It SHALL take the project of the matching stored session. When no stored session matches, it SHALL take the project resolved from the session-meta `project_path`, the same way a transcript's working directory resolves, worktrees included.

#### Scenario: Session in the store
- **WHEN** a facet's session id matches a stored session of project `ai-ledger`
- **THEN** the facet counts for `ai-ledger`

#### Scenario: Worktree session
- **WHEN** a facet's session ran in `/Users/me/Sites/ai-ledger-add-insights-page`, a git worktree of `ai-ledger`, and its transcript is not in the store
- **THEN** the facet counts for `ai-ledger`

#### Scenario: No project known
- **WHEN** a facet has no stored session and no session-meta record
- **THEN** the facet counts under `(unknown)`

### Requirement: Rebuild facets from the raw copy
Rebuilding the derived tables SHALL re-derive facets and session meta from the stored file text, without reading the usage-data directory.

#### Scenario: Rebuild after a parser change
- **WHEN** the user runs `rebuild` after the usage-data directory was deleted
- **THEN** every facet and session-meta record is derived again from the store

### Requirement: Keep usage data local
Facets and session meta SHALL be stored only in the local store, with the same file permissions as transcript data. Test fixtures and the demo store SHALL hold only synthetic facets.

#### Scenario: Repository contents
- **WHEN** the change is committed
- **THEN** no file in the repository holds text from a real facet or session-meta file
