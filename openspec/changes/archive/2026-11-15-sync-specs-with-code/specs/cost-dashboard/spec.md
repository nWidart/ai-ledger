## MODIFIED Requirements

### Requirement: Show token usage by kind
The dashboard SHALL show input, output, thinking, cache read, 5-minute cache write and 1-hour cache write tokens per day. Per project, it SHALL show a single total of tokens, in Cost by project, not split by kind or over time.

#### Scenario: Daily token chart
- **WHEN** the user views a project
- **THEN** a chart shows each token kind per day

#### Scenario: Tokens per project
- **WHEN** the user opens Cost by project
- **THEN** each project's row shows one token total, and no split by kind
