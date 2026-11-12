# Spec Delta

## ADDED Requirements

### Requirement: Keep the Errors page's marks through a rebuild
The store SHALL hold the fix markers the user sets on the Errors page in an `error_marks` table, one row per error type the user has marked or unmarked, with the day the fix went in or none after an undo. The table SHALL NOT be derived from transcript lines: `ai-ledger rebuild` SHALL leave its rows as they are. A store created before the table existed SHALL gain it, empty, when opened.

#### Scenario: Rebuild
- **WHEN** the user has marked `worktree` fixed on Nov 4 and runs a rebuild
- **THEN** the store still marks `worktree` fixed on Nov 4
