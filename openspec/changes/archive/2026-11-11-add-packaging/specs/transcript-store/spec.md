# Spec Delta

## MODIFIED Requirements

### Requirement: Keep transcript data private
The database file SHALL be readable and writable only by the current OS user and SHALL never be committed to git.

#### Scenario: New database file
- **WHEN** the store creates its database file
- **THEN** the file has mode `0600` and its directory has mode `0700`

#### Scenario: Store in a source checkout
- **WHEN** a contributor passes `--db` with a path under the checkout's `data/` folder
- **THEN** that folder is git-ignored

### Requirement: Keep the store when its default file is renamed
The store's default file SHALL be `ai-ledger.duckdb` in the per-user data folder. When that file does not exist and the app runs from a source checkout holding a store at `data/ai-ledger.duckdb`, or else at the earlier `data/claude.duckdb`, opening the store SHALL move that file, with its write-ahead log, to the default path and keep every stored line. Opening the store SHALL never create an empty store while a store exists at an earlier path.

#### Scenario: First start after the move to the data folder
- **WHEN** the checkout's `data/ai-ledger.duckdb` holds 2,000,000 lines and the data folder has no store
- **THEN** the store opens at the data folder's `ai-ledger.duckdb` with the same 2,000,000 lines, and `data/ai-ledger.duckdb` no longer exists

#### Scenario: First start after the rename
- **WHEN** the checkout holds only `data/claude.duckdb` and the data folder has no store
- **THEN** the store opens at the data folder's `ai-ledger.duckdb` with every line `data/claude.duckdb` held, and `data/claude.duckdb` no longer exists

#### Scenario: Moved file stays private
- **WHEN** an earlier file is moved to the default path
- **THEN** the new file has mode `0600` and the data folder has mode `0700`

#### Scenario: Write-ahead log present
- **WHEN** a `.wal` file exists next to the earlier file
- **THEN** it moves with the file, and lines it held are in the store after opening

#### Scenario: Both files exist
- **WHEN** both an earlier store and the data folder's `ai-ledger.duckdb` exist
- **THEN** the store opens the data folder's file, leaves the earlier file untouched, and logs that the earlier file was not moved

#### Scenario: Move across disks
- **WHEN** the earlier store is on a different file system from the data folder and cannot be renamed into it
- **THEN** the app exits without creating a store, and its message names both paths and says to move the file by hand or pass `--db`

#### Scenario: Explicit database path
- **WHEN** the user passes `--db <file>`
- **THEN** the store opens that file and moves nothing

## ADDED Requirements

### Requirement: Keep the store in the per-user data folder
The default store SHALL live in a per-user data folder outside the installed code: `~/Library/Application Support/ai-ledger/` on macOS, and `$XDG_DATA_HOME/ai-ledger/` elsewhere, or `~/.local/share/ai-ledger/` when `XDG_DATA_HOME` is unset or empty. The app SHALL create the folder on first start.

#### Scenario: First start on macOS
- **WHEN** a user runs the installed app on macOS for the first time
- **THEN** the store is created at `~/Library/Application Support/ai-ledger/ai-ledger.duckdb`

#### Scenario: Linux with XDG_DATA_HOME
- **WHEN** a user on Linux with `XDG_DATA_HOME=/data/me` runs the app
- **THEN** the store is at `/data/me/ai-ledger/ai-ledger.duckdb`

#### Scenario: Upgrade keeps the store
- **WHEN** the user upgrades the package to a new version
- **THEN** the app opens the same store with every stored line
