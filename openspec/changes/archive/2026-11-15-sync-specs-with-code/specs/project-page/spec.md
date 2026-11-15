## MODIFIED Requirements

### Requirement: Measure a project's context overhead
The Context block SHALL offer Measure now when the view has Claude Code sessions or the project already has a context snapshot. Measure now SHALL run `claude -p "/context"` in the folder of the project's latest Claude Code session that still exists, with the project's most used model, then ingest, and the block SHALL show the new snapshot.

#### Scenario: Measure a project
- **WHEN** the user chooses Measure now on the Project page of `foo`
- **THEN** `claude -p "/context"` runs in `foo`'s latest folder, and the grid splits the starting context by the new snapshot

#### Scenario: Snapshot without sessions in the view
- **WHEN** the Project page of `foo` has a context snapshot and the view holds no Claude Code session of `foo`
- **THEN** the Context block still offers Measure now
