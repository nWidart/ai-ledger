## MODIFIED Requirements

### Requirement: Show output speed
The dashboard SHALL show output speed: the output tokens of the sessions that record model time divided by their model time, in tokens per second. It SHALL be compared with the previous period, and a fall SHALL read as worse. When no session in the view records model time, the dashboard SHALL show output speed as not available with the reason: on a view of Codex work only, that Codex transcripts record no model time.

#### Scenario: Output speed
- **WHEN** the sessions that record model time spent 1,000 seconds of it and wrote 98,000 output tokens
- **THEN** output speed reads 98 tokens per second

#### Scenario: Nothing recorded
- **WHEN** every session in the view predates the `cost-state` line
- **THEN** output speed reads not available, its note says no session in the view records model time, and the duration note names no model or tool time

#### Scenario: Codex only
- **WHEN** every session in the view is a Codex session
- **THEN** output speed reads not available, and its note says Codex transcripts record no model time
