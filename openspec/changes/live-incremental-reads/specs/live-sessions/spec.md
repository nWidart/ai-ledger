# Spec Delta

## ADDED Requirements

### Requirement: Read only new lines on a repeated Live request
The app SHALL keep what it derived from each stored line between Live requests, and SHALL read and parse a line's stored text again only after it dropped what it kept for that line. A Live answer SHALL be the same as an answer computed with nothing kept. What the app keeps SHALL be bounded, so a long run does not grow it without limit.

#### Scenario: Active list after new lines
- **WHEN** the active list was answered once, then one active session gains 3 lines, then the list is asked for again
- **THEN** the second answer reads and parses the stored text of those 3 lines only, and equals an answer computed with nothing kept

#### Scenario: Session state after new lines
- **WHEN** a session's payload was answered once, then the session gains a line, then its payload is asked for again
- **THEN** its state and window are read without parsing again the lines read for the first answer

#### Scenario: Line stored late
- **WHEN** a line stamped before lines already read is stored after them, inside the newest lines of its session
- **THEN** the next answer holds it, as an answer with nothing kept does

#### Scenario: Line moved to another session
- **WHEN** an ingest moves stored lines to another session or marks them as a subagent's
- **THEN** the next answer places them as an answer with nothing kept does

#### Scenario: Kept lines over the bound
- **WHEN** the lines kept reach the bound
- **THEN** the app drops kept lines, and a later answer that needs a dropped line reads it again and is unchanged
