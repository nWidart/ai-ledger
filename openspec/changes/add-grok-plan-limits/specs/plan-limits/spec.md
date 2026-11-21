# Spec Delta

## ADDED Requirements

### Requirement: Poll Grok limits
While serving, the app SHALL ask the Grok billing endpoint for the credit usage of the Grok CLI's grok.com login at most once every 5 minutes. It SHALL record one snapshot per poll: the period type as the limit, no scope, the period's length, its end as the reset and the credit usage percent. Grok's windows SHALL reset on a schedule. Polled snapshots SHALL be kept through a rebuild.

#### Scenario: Weekly credits
- **WHEN** a poll reports a weekly period from Nov 19 21:27 to Nov 26 21:27 with 10% of its credits used
- **THEN** one Grok snapshot is recorded: limit `weekly`, a 7-day window, 10%, resetting Nov 26 21:27

#### Scenario: Response without usage
- **WHEN** the Grok billing endpoint answers without a credit usage percent
- **THEN** no snapshot is recorded and the Grok poll counts as failed

### Requirement: Handle the Grok credential safely
The app SHALL read the access token of the Grok CLI's grok.com login from the Grok CLI's auth file each time it polls. It SHALL send the token only to the Grok billing endpoint. It SHALL never write the token to the store, the logs, an API response or the page, and it SHALL never refresh the token.

#### Scenario: Expired token
- **WHEN** the Grok login's access token has expired
- **THEN** the app skips the poll, does not request a new token, and reports Grok limits as stale

#### Scenario: No Grok login
- **WHEN** the machine has no Grok auth file, or the Grok CLI is set to use an API key or another account or endpoint
- **THEN** the app sends no Grok request, records nothing, and shows no Grok window, freshness flag or error

#### Scenario: Signed out after polling
- **WHEN** Grok polls were recorded and the user then signs out of the Grok CLI
- **THEN** Limits shows no open Grok window and no Grok freshness line, and Grok's past windows stay in the history

#### Scenario: Redirected request
- **WHEN** the billing endpoint answers with a redirect
- **THEN** the request that follows the redirect carries no token
