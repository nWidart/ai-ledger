# Spec Delta

## ADDED Requirements

### Requirement: Title each live session
Each active-session entry and each session payload SHALL carry the session's title and say whether it came from the agent (a custom title, an AI title or a Codex thread name) or from the first prompt. A title from the agent SHALL always be sent. A title from the first prompt SHALL be sent only to a request that asks for text.

#### Scenario: Agent title
- **WHEN** an active session has the AI title "Add session titles" and the page asks for the list without text
- **THEN** the entry carries "Add session titles", marked as from the agent

#### Scenario: Prompt title without text
- **WHEN** an active session has no agent title and the page asks for the list without text
- **THEN** the entry carries no title

#### Scenario: Prompt title with text
- **WHEN** the same session is asked for with text
- **THEN** the entry carries the title made from its first prompt, marked as from the prompt

#### Scenario: Title arrives during the session
- **WHEN** a session's `ai-title` line is stored after the page first listed it
- **THEN** the next list after the change notice carries the new title

## MODIFIED Requirements

### Requirement: Send transcript text only on request
By default, prompts and replies SHALL be returned as word counts and tool results as character counts, without their text. A session title made from the first prompt is prompt text, and SHALL be left out by default. Only a request that asks for text SHALL receive the prompt and reply text, up to 4 KB of each tool result, and first-prompt titles.

#### Scenario: Default request
- **WHEN** the page asks for events without asking for text
- **THEN** no prompt, reply or tool-result text is in the response, and no first-prompt title

#### Scenario: Text requested
- **WHEN** the page asks for events with text
- **THEN** prompts and replies come as written and each tool result is cut to 4 KB
