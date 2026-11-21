# Spec Delta

## MODIFIED Requirements

### Requirement: Resolve a session's context window
A session's context window SHALL be the window its source stated (a Codex turn's `model_context_window`, or the window a Grok compaction notice states), else the `context` the price table gives the session's peak model, else unknown. Window shares SHALL be computed only for sessions with a known window, and the page SHALL say how many sessions in the view have one.

#### Scenario: Codex session
- **WHEN** a Codex session's turns stated a window of 258,400 and the price table has no window for its model
- **THEN** its window is 258,400

#### Scenario: Grok session
- **WHEN** a Grok session's compaction notice states a window of 256,000, and another Grok session has no compaction and its model has `context` 2,000,000 in the price table
- **THEN** the first session's window is 256,000 and the second's is 2,000,000

#### Scenario: Claude Code session
- **WHEN** a Claude Code session's peak model has `context` 1,000,000 in the price table
- **THEN** its window is 1,000,000

#### Scenario: Unknown window
- **WHEN** a session's source stated no window and its model has no `context` in the price table
- **THEN** its window is unknown, it takes no part in any share, and the view's count of sessions with a window leaves it out

### Requirement: Cache lifetime of a break
A cache break's `expired` cause SHALL use the cache lifetime of its session's source: 1 hour when the previous request wrote to the 1-hour cache, else 30 minutes for a Codex session, else 5 minutes. Grok's logs state no cache lifetime, so a break of a Grok session SHALL never be `expired`: its cause SHALL be `model_switch` when its model differs from the previous main-thread request's, else `other`.

#### Scenario: Codex pause within its cache lifetime
- **WHEN** two consecutive turns of a Codex session on the same model are 10 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Codex cache expired
- **WHEN** two consecutive turns of a Codex session on the same model are 40 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

#### Scenario: Grok pause
- **WHEN** two consecutive turns of a Grok session on the same model are 2 hours apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

### Requirement: Tip about a large starting context
The large-start rule SHALL fire when a project in the view has a median starting context of at least 30,000 tokens. Its evidence SHALL name the 5 projects with the largest medians, their medians and window shares, and count the others. Its advice SHALL say to trim the instruction files and review the configured MCP servers, naming where each agent of the matching sessions configures them; for Grok sessions it SHALL name no agent-specific file or command.

#### Scenario: Rule fires
- **WHEN** project `foo` sessions start at a median of 42,000 tokens
- **THEN** the tip names `foo` with 42,000 tokens, and its matching sessions are `foo` sessions starting at 30,000 tokens or more

#### Scenario: Below the threshold
- **WHEN** every project's median starting context is under 30,000 tokens
- **THEN** the large-start tip is not shown

#### Scenario: Codex sessions
- **WHEN** every matching session is a Codex session
- **THEN** the advice names `AGENTS.md` and `codex mcp list`, and not `CLAUDE.md` or `claude mcp list`

#### Scenario: Grok sessions
- **WHEN** every matching session is a Grok session
- **THEN** the advice says to trim the instruction files and review the configured MCP servers, and names none of `CLAUDE.md`, `AGENTS.md`, `claude mcp list` or `codex mcp list`

### Requirement: Tip about frequent compactions
The frequent-compactions rule SHALL fire when a session in the view compacted 3 or more times, as a warning, or critical at 6 or more. Its evidence SHALL give the number of such sessions and the median turns and active minutes before the first compaction. Its advice SHALL say to start a new session between tasks and to compact before the context fills, with the commands of the matching sessions' agents; for Grok sessions it SHALL name no agent-specific command.

#### Scenario: Three compactions
- **WHEN** one session in the view compacted 3 times and no session more
- **THEN** the tip is shown as a warning and that session matches it

#### Scenario: Claude Code sessions
- **WHEN** every matching session is a Claude Code session
- **THEN** the advice names `/clear` and `/compact`

#### Scenario: Codex sessions
- **WHEN** every matching session is a Codex session, on a Codex-only view or not
- **THEN** the advice names `/new` and `/compact`, and not `/clear`

#### Scenario: Both agents
- **WHEN** the matching sessions include Claude Code and Codex sessions
- **THEN** the advice names `/clear` for Claude Code and `/new` for Codex

#### Scenario: Grok sessions
- **WHEN** every matching session is a Grok session
- **THEN** the advice says to start a new session between tasks and to compact before the context fills, and names neither `/clear` nor `/new`

### Requirement: Tip about sessions near the limit
The near-limit rule SHALL fire, as critical, when a session in the view peaked at 80% or more of its window. The window is the session's stated one (Codex, or Grok after a compaction notice), else the price table's for its model; Activity uses only the price table's window for the peak model. Its evidence SHALL give the count of such sessions and the highest share, and its advice SHALL say to start the next task in a new session.

#### Scenario: Session at 85%
- **WHEN** a session peaked at 85% of a 200,000 window
- **THEN** the tip is shown as critical and that session matches it

#### Scenario: Stated window
- **WHEN** a Codex session states a 258,400-token window and peaked at 90% of it
- **THEN** the tip counts it against the stated window, not the price table's

### Requirement: Fit the large-results advice to the agents
The large-results advice SHALL name a subagent only for Claude Code, judged by the agents of the sessions that produced the large results: not when every such session is a Codex or Grok one, and for Claude Code alone when Claude Code and another agent produced them. When a Codex or Grok result's tool has no remedy of its own, the advice SHALL also say to ask for a smaller part of the output, whatever the other results. A Grok `run_terminal_command` result SHALL take the shell remedy.

#### Scenario: Codex sessions
- **WHEN** every large result in the view comes from a Codex session, with a large `exec_command` result
- **THEN** the advice names `head`, `tail` or `grep` and no subagent

#### Scenario: Grok sessions
- **WHEN** every large result in the view comes from a Grok session, with a large `run_terminal_command` result
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
