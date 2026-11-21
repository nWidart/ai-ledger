## MODIFIED Requirements

### Requirement: Tip about large tool results
The large-results rule SHALL fire when a main-thread tool result in the view is 100,000 bytes or more, as a warning, or critical at 400,000 bytes or more. Its evidence SHALL give the count of such results, their total estimated tokens and the tools and MCP servers that produced them. Its advice SHALL name a remedy per tool: `Read` with offset and limit, shell output through `head`, `tail` or `grep`, search tools with a result cap, and a subagent for bulk reading.

#### Scenario: Large Bash output
- **WHEN** a 250,000-byte `Bash` result is in the view
- **THEN** the tip is shown as a warning, names `Bash` and advises piping shell output through `head`, `tail` or `grep`

## ADDED Requirements

### Requirement: Fit the large-results advice to the agents
The large-results advice SHALL name a subagent only for Claude Code, judged by the agents of the sessions that produced the large results: not when every such session is a Codex one, and for Claude Code alone when both agents produced them. When a Codex result's tool has no remedy of its own, the advice SHALL also say to ask for a smaller part of the output, whatever the other results.

#### Scenario: Codex sessions
- **WHEN** every large result in the view comes from a Codex session, with a large `exec_command` result
- **THEN** the advice names `head`, `tail` or `grep` and no subagent

#### Scenario: Both agents
- **WHEN** the large results in the view come from Claude Code and Codex sessions
- **THEN** the advice says to hand bulk reading to a subagent in Claude Code

#### Scenario: A Codex result outside the matching sessions
- **WHEN** the source is Codex and a large `exec_command` result falls in the range, but its session's requests all fall before it
- **THEN** the advice names no subagent

#### Scenario: A Claude Code Read and a Codex tool with no remedy
- **WHEN** a large `Read` result of a Claude Code session and a large `view_image` result of a Codex session fire the tip
- **THEN** the advice names `Read` with offset and limit, says to ask for a smaller part of the output, and names a subagent for Claude Code
