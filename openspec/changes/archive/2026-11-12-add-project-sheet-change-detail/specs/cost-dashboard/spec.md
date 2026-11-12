# Spec Delta

## ADDED Requirements

### Requirement: Show a project's change in its sheet
When the view has a previous period, a project's sheet SHALL show its change against that period: the previous cost, this period's cost, the change with its sign, a mark when the project had no usage in the previous period, and a daily cost sparkline over both periods with the split between them marked. A cost that is unknown (only unpriced models) SHALL read as unknown, with no change. The all-time view SHALL show none of this.

#### Scenario: Project that grew
- **WHEN** the user opens project `foo` from What changed, and `foo` cost $4 in the previous 30 days and $10 in the last 30
- **THEN** the sheet shows $4, $10 and +$6, and a daily sparkline over both periods

#### Scenario: New project
- **WHEN** project `foo` had no usage in the previous period
- **THEN** the sheet marks `foo` as new

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the project sheet shows no change block
