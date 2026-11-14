# Spec Delta

## ADDED Requirements

### Requirement: Record Codex tool result sizes
A Codex tool call's result size SHALL be the UTF-8 length of the completed item's output text: a command's aggregated output, or the text content of an MCP call's result. A file change or a web search, whose item carries no result text, SHALL record no size.

#### Scenario: Shell command
- **WHEN** a `CommandExecution` item completes with 2,048 bytes of aggregated output
- **THEN** its tool call records a result size of 2,048

#### Scenario: MCP call
- **WHEN** an `McpToolCall` item's result content is one text block of 17 bytes
- **THEN** its tool call records a result size of 17

#### Scenario: File change
- **WHEN** a `FileChange` item completes
- **THEN** its tool call records no result size

### Requirement: Record the context window Codex states
A Codex session SHALL record the `model_context_window` its turns' `task_started` events state, the newest turn's winning, and the time of its first `compacted` line as its first compaction.

#### Scenario: Window stated
- **WHEN** a session's turns start with `model_context_window` 258,400
- **THEN** the session records a context window of 258,400

#### Scenario: Compacted
- **WHEN** a session holds `compacted` lines at 09:10 and 09:50
- **THEN** the session records 09:10 as its first compaction and 2 compactions
