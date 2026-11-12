# Spec Delta

## ADDED Requirements

### Requirement: Say how sessions are counted
The Sessions drawer SHALL say that it counts a session when it has a request in the range, and that Insights counts sessions by their start time, so the two totals can differ slightly.

#### Scenario: Drawer names the counting rule
- **WHEN** the user opens the Sessions drawer
- **THEN** the drawer says a session counts when it has a request in the range and that Insights counts by start time
