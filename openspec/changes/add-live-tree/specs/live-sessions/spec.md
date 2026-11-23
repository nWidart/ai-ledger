# Spec Delta

## ADDED Requirements

### Requirement: Give each active session's agents on request
A request for the active list that asks for agents (`agents=1`) SHALL receive, for each session, its agents as one flat list: its subagents and its delegation calls, each with an id, a kind, and the id of its parent agent, or none for the main thread. A request that does not ask SHALL receive no agents, and the rest of its answer SHALL be the same either way.

#### Scenario: List with agents
- **WHEN** an active session has two subagents and one delegation call, and the page asks for `/api/live?agents=1`
- **THEN** the session's entry holds three agents, two of kind agent and one of kind delegation

#### Scenario: List without agents
- **WHEN** the page asks for `/api/live` for the same session
- **THEN** the entry holds no `agents` field, and its other fields equal those of the answer with agents

#### Scenario: Session with no agent
- **WHEN** a session that made no subagent and no delegation call is listed with `agents=1`
- **THEN** its entry holds an empty list of agents

#### Scenario: Subagents of all three sources
- **WHEN** a Claude Code, a Codex and a Grok session each run one subagent
- **THEN** each session's agent has the same fields

### Requirement: Name each subagent's parent
A subagent's parent SHALL be the thread that made the call that started it: none when the main thread made it, else that subagent's id. The starting call SHALL be the one the session's events name for that subagent. A subagent with no known starting call SHALL have no parent. A parent that the list does not hold SHALL read as none.

#### Scenario: Subagent of the main thread
- **WHEN** a session's main thread started subagent `a1` with an `Agent` call
- **THEN** agent `a1` has no parent

#### Scenario: Subagent of a subagent
- **WHEN** subagent `a1` started subagent `b2` with an `Agent` call written in `agent-a1.jsonl`
- **THEN** agent `b2` has the parent `a1`

#### Scenario: Running Claude Code subagent
- **WHEN** subagent `a1`'s `Agent` call for `b2` has no result yet, and `agent-b2.meta.json` names that call
- **THEN** agent `b2` has the parent `a1`

#### Scenario: Codex thread spawned by a thread
- **WHEN** a Codex subagent thread `t1` holds the `SubAgentActivity` start item for thread `t2`
- **THEN** agent `t2` has the parent `t1`

#### Scenario: Starting call not known
- **WHEN** no call and no `meta.json` names subagent `c3`
- **THEN** agent `c3` has no parent, the name "Subagent" and no description

### Requirement: Give each subagent's figures
Each agent of kind agent SHALL carry its name (the tool of its starting call), its description, the times of its first and its last call or request, its tool calls, its failed calls, the cost of its priced requests and the model of its newest request. A figure the app does not know SHALL be none. The cost and the model SHALL equal those `/api/live/session` gives the same subagent's lane.

#### Scenario: Subagent figures
- **WHEN** subagent `a1`, started by an `Agent` call described "Map the parsers", made 8 tool calls of which 2 failed, on `claude-haiku-5-5` for $0.05
- **THEN** its agent carries the name `Agent`, the description "Map the parsers", 8 tool calls, 2 errors, $0.05 and `claude-haiku-5-5`

#### Scenario: Grok subagent
- **WHEN** a Grok subagent made three tool calls, and Grok's usage counts in its parent's turn
- **THEN** its agent carries 3 tool calls, no cost and no model

#### Scenario: Subagent with no call yet
- **WHEN** a Claude Code subagent made one request and no tool call
- **THEN** its agent carries 0 tool calls and the time of that request as its start

### Requirement: Tell whether a subagent is finished
Each agent of kind agent SHALL carry a status, `running` or `done`, by the rule that tells a lane finished: a subagent whose own lines hold a turn start or end is done when its newest turn has ended; any other is done when the call that started it has ended. A subagent with neither SHALL be done once none of its calls is pending and its newest call or request is more than 5 minutes old.

#### Scenario: Codex thread whose turn ended
- **WHEN** a Codex subagent thread's newest turn mark is a turn end
- **THEN** its agent's status is `done`

#### Scenario: Agent call still open
- **WHEN** the `Agent` call that started a Claude Code subagent has no result
- **THEN** its agent's status is `running`

#### Scenario: Agent call ended
- **WHEN** that `Agent` call has a result
- **THEN** its agent's status is `done`

#### Scenario: Unknown starting call
- **WHEN** a subagent with no known starting call and no turn mark made its last call 7 minutes ago, and none is pending
- **THEN** its agent's status is `done`, and it was `running` 3 minutes after that call

### Requirement: Report delegation calls as agents
Each `mcp__t3-code__delegate_task` call of a session SHALL be an agent of kind delegation: its id the call's id, its parent the thread that made the call, its description the call's `title`, its start and end the call's, and the provider and the model the store holds for it. It SHALL carry no tool calls, errors or cost. The app SHALL NOT name, link or look for the session the call started.

#### Scenario: Delegation by the main thread
- **WHEN** a session's main thread made a delegation call titled "Write the tests" for the model `gpt-6.1-sol`
- **THEN** the session has an agent of kind delegation with that description and that model, and no parent

#### Scenario: Delegation by a subagent
- **WHEN** subagent `a1` made a delegation call
- **THEN** the delegation's parent is `a1`

#### Scenario: Child session is active too
- **WHEN** the session a delegation call started is itself active
- **THEN** the list holds it as a session of its own, and the delegation carries no session id

### Requirement: Say what a delegation's status tells
A delegation's status SHALL be `pending` while its call has no result, `failed` when the call failed, `done` when its result states the status `completed`, and `started` otherwise. `started` SHALL mean only that the call returned: the transcript does not say when the delegated task ends, and the app SHALL NOT infer it.

#### Scenario: Call returned at once
- **WHEN** a delegation call returned with the status `running` two hours ago
- **THEN** its status is `started`

#### Scenario: Call that waited
- **WHEN** a delegation call made with `mode: "wait"` returned with the status `completed`
- **THEN** its status is `done`

#### Scenario: Call with no result
- **WHEN** a delegation call has no result yet
- **THEN** its status is `pending`

#### Scenario: Call refused
- **WHEN** a delegation call's result is an error
- **THEN** its status is `failed`

### Requirement: Cap the agents of one session
A session's entry SHALL hold at most 200 agents: first those not finished, then the finished ones, newest start first. A subagent is finished when `done`, a delegation when `done` or `failed` or when its call returned more than 10 minutes ago, as the Tree folds it; the delegation's `status` stays as it is. The entry SHALL say how many agents it left out (`agents_more`), 0 when none.

#### Scenario: Session with 260 agents
- **WHEN** a session has 10 running subagents and 250 finished ones
- **THEN** its entry holds the 10 running and the 190 finished that started last, and says it left 60 out

#### Scenario: Under the cap
- **WHEN** a session has 12 agents
- **THEN** its entry holds all 12 and says it left 0 out

### Requirement: Keep prompt text out of the agents
An agent SHALL carry no prompt, reply, task or tool-result text. Its description SHALL be cut to 300 characters, whether the request asks for text or not.

#### Scenario: Long description
- **WHEN** an `Agent` call has a description of 2,000 characters and the page asks for `/api/live?agents=1&text=1`
- **THEN** the agent's description holds 300 characters

#### Scenario: Delegated task text
- **WHEN** a delegation call's `task` holds 2,000 characters
- **THEN** the answer holds none of it
