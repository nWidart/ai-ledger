# Spec Delta

## ADDED Requirements

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
