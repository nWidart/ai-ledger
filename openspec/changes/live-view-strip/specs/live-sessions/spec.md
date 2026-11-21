## MODIFIED Requirements

### Requirement: Report the agent's figures
For one session, the app SHALL report:
- the context of its newest main-thread request, and the model's context window when it is known;
- its compactions, with the context before each;
- its cost, requests, tool calls, failed tool calls and cache-read share;
- its working directory, when known;
- its pulse of the last 10 minutes: each main-thread request's context, from the last one before, and each tool call that ended, failed or not;
- the newest plan-limit use for the session's source.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

#### Scenario: Pulse
- **WHEN** a session made a main-thread request at 40,000 tokens 12 minutes ago and one at 62,000 tokens 2 minutes ago, and a subagent's call failed a minute ago
- **THEN** the pulse holds both contexts, the older one as the starting level, and one failed call

#### Scenario: Subagent request
- **WHEN** a subagent made a request in the last 10 minutes
- **THEN** the pulse's context leaves it out
