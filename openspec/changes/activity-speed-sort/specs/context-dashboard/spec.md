## MODIFIED Requirements

### Requirement: Tip about large tool results
The large-results rule SHALL fire when a main-thread tool result in the view is 100,000 bytes or more, as a warning, or critical at 400,000 bytes or more. Its evidence SHALL give the count of such results, their total estimated tokens and the tools and MCP servers that produced them. Its advice SHALL name a remedy per tool: `Read` with offset and limit, shell output through `head`, `tail` or `grep`, search tools with a result cap, and a subagent for bulk reading.

#### Scenario: Large Bash output
- **WHEN** a 250,000-byte `Bash` result is in the view
- **THEN** the tip is shown as a warning, names `Bash` and advises piping shell output through `head`, `tail` or `grep`

## ADDED Requirements

### Requirement: Fit the large-results advice to the agents
The large-results advice SHALL name a subagent only for Claude Code: not when every matching session is a Codex one, and for Claude Code alone when both agents match. When no remedy of its own fits a Codex match's tools, the advice SHALL still say to ask for a smaller part of the output.

#### Scenario: Codex sessions
- **WHEN** every session matching the large-results tip is a Codex session, with a large `exec_command` result
- **THEN** the advice names `head`, `tail` or `grep` and no subagent

#### Scenario: Both agents
- **WHEN** the matching sessions include Claude Code and Codex sessions
- **THEN** the advice says to hand bulk reading to a subagent in Claude Code
