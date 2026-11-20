## MODIFIED Requirements

### Requirement: Link analysed sessions to their sheets
Each session in the store SHALL link to its session sheet, which opens over Insights. The page's project, range, source, automated filter and its own filters SHALL stay as they were under the sheet and after it closes.

#### Scenario: Open a session
- **WHEN** the user views project `foo` for the last 7 days and clicks a session in the list
- **THEN** that session's sheet opens over Insights, and the page still shows project `foo` for the last 7 days

#### Scenario: Session missing from the store
- **WHEN** a facet's session has no transcript in the store
- **THEN** the session is listed with its summary and no link
