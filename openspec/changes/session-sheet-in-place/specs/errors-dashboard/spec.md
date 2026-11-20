## ADDED Requirements

### Requirement: Open an example's session over Errors
An example with a session SHALL show the session's short id as a link that opens the session sheet over Errors, in the page's view, with automated sessions shown as the page shows them. The open type, the linked example and the lists SHALL stay as they were under the sheet and after it closes.

#### Scenario: Open an example's session
- **WHEN** the user on `/errors?range=7&cat=x` clicks an example's session link
- **THEN** the session sheet opens over Errors, the URL is `/errors?range=7&session=<id>&cat=x`, and type `x` stays open under it

#### Scenario: Close the session sheet
- **WHEN** the user closes that sheet
- **THEN** the URL is `/errors?range=7&cat=x` and focus is on the session link
