## ADDED Requirements

### Requirement: Cap the lists under Where to start
Where to start SHALL list at most 4 open types with a ready-made fix, and at most 4 under Rising fastest. It SHALL NOT leave out the always-noise types: with Hide noise and muted off, a type such as `user_denied` can be listed.

#### Scenario: More open types than the list holds
- **WHEN** 6 open types have a ready-made fix
- **THEN** Where to start lists the 4 with the most time lost

#### Scenario: Noise type with the toggle off
- **WHEN** Hide noise and muted is off and `user_denied` is an open type with a ready-made fix and the most time lost
- **THEN** Where to start lists `user_denied`, marked as noise
