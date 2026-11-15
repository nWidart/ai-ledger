## MODIFIED Requirements

### Requirement: Announce what a copy did
A copy item SHALL put its text on the clipboard and say "Copied to clipboard." or "Could not copy to clipboard.", as a polite status present in the page before the message is set, so a screen reader says it once.

#### Scenario: Clipboard refused
- **WHEN** the browser refuses the clipboard write for Copy session ID
- **THEN** the status says "Could not copy to clipboard."

#### Scenario: Clipboard written
- **WHEN** the user picks Copy session ID and the browser accepts the write
- **THEN** the status says "Copied to clipboard."
