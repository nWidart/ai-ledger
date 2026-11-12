## ADDED Requirements

### Requirement: Show the uncategorized share
The Errors summary SHALL show the share of the view's errors in the catch-all types (Other, Other non-zero exit and MCP tool error), which are the errors no specific rule matched, with a title that says so. When the view is not filtered to one source and more than one source has errors, the line SHALL split the share by source. It SHALL show nothing when the view has no errors.

#### Scenario: Share shows
- **WHEN** the view has errors, and 12 of 100 of them are of catch-all types
- **THEN** the summary shows "Uncategorized: 12% of errors", titled with the catch-all types and what they mean

#### Scenario: Split by source
- **WHEN** the view has no source filter and both Claude Code and Codex have errors in it
- **THEN** the line adds each source's share in parentheses, such as "(Claude Code 9%, Codex 31%)"
- **AND** a view filtered to one source shows the share alone
