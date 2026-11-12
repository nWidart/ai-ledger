# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the Errors page's marks through a rebuild
The store SHALL hold the Errors page's marks in an `error_marks` table: for each error type the user has marked, unmarked, muted or unmuted, the day the fix went in (none after an undo) and whether the type is muted, each independent of the other. The table SHALL NOT be derived from transcript lines: `ai-ledger rebuild` SHALL leave its rows as they are. A store without the table, or with a table that has no muted flag, SHALL gain it when opened.

#### Scenario: Rebuild
- **WHEN** the user has marked `worktree` fixed on Nov 4 and runs a rebuild
- **THEN** the store still marks `worktree` fixed on Nov 4

#### Scenario: A store from before muted types
- **WHEN** a store whose `error_marks` has a fix day for `x` and no muted flag is opened
- **THEN** the store gains the flag, `x` keeps its fix day and is not muted, and muting `x` keeps the day

#### Scenario: Mute keeps the fix day
- **WHEN** the user marks `x` fixed on Nov 4 and then mutes it
- **THEN** `x` is muted and still fixed on Nov 4, and a later undo keeps it muted
