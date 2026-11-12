# Spec Delta

## ADDED Requirements

### Requirement: Record the speed of each request
Each derived request SHALL carry the `speed` its response's `usage` reports (`fast` or `standard` for Claude Code), as written, or none when the transcript has none. Requests from sources without a speed SHALL carry none. A store created before the column existed SHALL keep working when opened, with no speed until the user runs a rebuild.

#### Scenario: Fast-mode response
- **WHEN** a Claude Code response's `usage.speed` is `fast`
- **THEN** its request record has speed `fast`

#### Scenario: Response without a speed
- **WHEN** a response's `usage` has no `speed`, or the request comes from Codex
- **THEN** its request record has no speed
