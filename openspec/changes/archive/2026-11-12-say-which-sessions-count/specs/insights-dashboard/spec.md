# Spec Delta

## ADDED Requirements

### Requirement: Say how sessions are counted
The Insights page SHALL say that it counts a session by its start time, and that Activity counts a session with a request in the range, so the two totals can differ slightly.

#### Scenario: Subtitle names the counting rule
- **WHEN** the user opens Insights with a view that has facets
- **THEN** the subtitle says a session counts by its start time and that Activity counts a session with a request in the range
