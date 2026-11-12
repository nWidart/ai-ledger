# Spec Delta

## MODIFIED Requirements

### Requirement: Backfill the fix decision once
When opening a store adds the decided flag to `error_marks`, it SHALL add the flag and backfill it in one transaction: a row with a fix day, or with no fix day and not muted, SHALL be decided. Such a row is an undo's, or a mute then an unmute made before the flag existed, which the backfill cannot tell apart and takes as decided. A muted row with no fix day SHALL stay undecided, as keeping a marker beats losing one. A later open SHALL NOT change any flag.

#### Scenario: A store from before the flag
- **WHEN** a store with rows `a` fixed, `b` with no day and not muted, `c` fixed and muted, and `d` with no day and muted is opened
- **THEN** `a`, `b` and `c` are decided and `d` is not

#### Scenario: A second open
- **WHEN** the user mutes and unmutes a type with no row, and the store is closed and opened again
- **THEN** the type's fix marker is still undecided

#### Scenario: A backfill that fails
- **WHEN** the backfill raises an error
- **THEN** the store has no flag, so the next open adds it and backfills again
