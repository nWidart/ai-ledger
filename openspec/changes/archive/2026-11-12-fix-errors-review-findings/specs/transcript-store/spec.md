# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the Errors page's marks through a rebuild
The store SHALL hold the Errors page's marks in an `error_marks` table, one row per error type the user marked, unmarked, muted or unmuted: its fix day (none after an undo), whether it is muted, and whether its fix marker is decided (a mark or an undo decides it, a mute does not), each independent of the others. The table SHALL NOT be derived from transcript lines: `ai-ledger rebuild` SHALL leave its rows as they are. A store lacking the table or a column SHALL gain it when opened.

#### Scenario: Rebuild
- **WHEN** the user has marked `worktree` fixed on Nov 4 and runs a rebuild
- **THEN** the store still marks `worktree` fixed on Nov 4

#### Scenario: A store from before muted types
- **WHEN** a store whose `error_marks` has a fix day for `x` and no muted flag is opened
- **THEN** the store gains the flag, `x` keeps its fix day and is not muted, and muting `x` keeps the day

#### Scenario: Mute keeps the fix day
- **WHEN** the user marks `x` fixed on Nov 4 and then mutes it
- **THEN** `x` is muted and still fixed on Nov 4, and a later undo keeps it muted

#### Scenario: A mute decides nothing
- **WHEN** the user mutes `x`, which has no row
- **THEN** `x` is muted and its fix marker is not decided, and a mark or an undo of `x` decides it

## ADDED Requirements

### Requirement: Backfill the fix decision once
When opening a store adds the decided flag to `error_marks`, a row with a fix day, or with no fix day and not muted (it exists only because of an undo), SHALL be decided. A muted row with no fix day SHALL stay undecided, as it is ambiguous and keeping a marker beats losing one. A later open SHALL NOT change any flag.

#### Scenario: A store from before the flag
- **WHEN** a store with rows `a` fixed, `b` with no day and not muted, `c` fixed and muted, and `d` with no day and muted is opened
- **THEN** `a`, `b` and `c` are decided and `d` is not

#### Scenario: A second open
- **WHEN** the user mutes and unmutes a type with no row, and the store is closed and opened again
- **THEN** the type's fix marker is still undecided
