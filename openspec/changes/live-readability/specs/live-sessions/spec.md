## MODIFIED Requirements

### Requirement: Report the agent's figures
For one session, the app SHALL report:
- its newest main-thread request's context, and its window when known, alike on a first load, a catch-up and the list;
- its compactions, with the context before each;
- its cost, requests, tool calls, failed calls and cache-read share;
- its pulse of the 10 minutes up to now: each main-thread request's context, from the last one before, and each tool call that ended.

`/api/live/session` SHALL NOT report plan-limit use (`limits`) or the working directory (`cwd`): the Limits page and the session detail report them.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

#### Scenario: No plan limits or directory
- **WHEN** the session's source has open plan-limit windows and the store holds the session's working directory
- **THEN** `/api/live/session` holds neither a `limits` nor a `cwd` field

#### Scenario: Pulse
- **WHEN** a session made a main-thread request at 40,000 tokens 12 minutes ago and one at 62,000 tokens 2 minutes ago, and a subagent's call failed a minute ago
- **THEN** the pulse holds both contexts, the older one as the starting level, and one failed call

#### Scenario: Subagent request
- **WHEN** a subagent made a request in the last 10 minutes
- **THEN** the pulse's context leaves it out

#### Scenario: Line stamped after now
- **WHEN** the app reports a pulse ending at 08:10 and the store holds a request stamped 08:11
- **THEN** the pulse leaves that request out

#### Scenario: Window on a catch-up
- **WHEN** a Codex session on a model with no price states a 272,000-token window at a turn's start, more than a minute before a catch-up's cursor
- **THEN** the catch-up, the first load and the active list all report the 272,000-token window
