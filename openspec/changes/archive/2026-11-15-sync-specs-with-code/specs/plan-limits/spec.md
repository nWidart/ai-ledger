## MODIFIED Requirements

### Requirement: Handle the Claude credential safely
The app SHALL read the Claude OAuth access token from the OS credential store each time it polls. It SHALL send the token only to the Anthropic usage endpoint. It SHALL never write the token to the store, the logs, an API response or the page, and it SHALL never refresh the token. Only the macOS Keychain is read.

#### Scenario: Expired token
- **WHEN** the stored access token has expired
- **THEN** the app skips the poll, does not request a new token, and reports Claude limits as stale

#### Scenario: No credential store
- **WHEN** the app runs where no Claude credential can be read, such as Linux, which has no macOS Keychain
- **THEN** the Claude Code poll still runs and fails with "cannot read the Claude credential: no macOS Keychain", ingest continues, and Limits flags Claude Code as "polling failing"

#### Scenario: Claude Code windows without a poll
- **WHEN** the Claude Code poll fails on every attempt
- **THEN** Claude Code windows come only from polls already in the store, because Claude Code writes no limits into transcripts, and Codex windows still come from Codex transcripts
