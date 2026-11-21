# Spec Delta

## ADDED Requirements

### Requirement: Ingest Grok session logs
Ingest SHALL read the Grok CLI's session logs: the file `updates.jsonl` of every folder `sessions/<encoded cwd>/<session>/` under the Grok home (default `~/.grok`, set with `--grok`). It SHALL read each file incrementally, store each line once, and read no other file of a session folder. A session's working folder SHALL be the folder name with its URL encoding undone. A missing Grok home SHALL be skipped.

#### Scenario: New lines only
- **WHEN** a session log of 400 lines was ingested, Grok appends 20 lines and ingest runs again
- **THEN** the store gains 20 lines and reads none of the first 400 again

#### Scenario: Working folder from the folder name
- **WHEN** a session's folder is `sessions/%2FUsers%2Fme%2Fwork%2Fapp/<session>/`
- **THEN** the session's working folder is `/Users/me/work/app`

#### Scenario: No Grok home
- **WHEN** `~/.grok` does not exist
- **THEN** ingest reads the other sources and reports no error

### Requirement: Key Grok lines by event id and time
Each Grok line SHALL be stored under the key `grok:<event id>:<agentTimestampMs>`, because a resumed session counts its event ids from 1 again, with its `sessionUpdate` as its type and its `agentTimestampMs` as its time. A `hook_execution` line SHALL take its hook event's name as its type. Lines SHALL be derived by their own times and ids, not by their order in the file.

#### Scenario: Line read twice
- **WHEN** a file is truncated and read again from its start
- **THEN** each line is stored once

#### Scenario: Resumed session
- **WHEN** a session is resumed and its new run writes a line with event id `<session>-1`, an id its first run used too
- **THEN** both lines are stored

#### Scenario: Unknown update
- **WHEN** a line's `sessionUpdate` is one this version does not know
- **THEN** the line is stored and derives nothing

### Requirement: Count Grok usage per model call
A finished Grok turn (a `turn_completed` line) SHALL become one request per model call of the turn. A model call is a distinct `streamStartMs` among the turn's lines; its time is that value and its context size is the largest `totalTokens` on its lines. Each token count of the turn SHALL be split over the calls in proportion to their context sizes, so that the requests add up to the turn's count exactly. A turn with no `turn_completed` SHALL make no request.

#### Scenario: Turn of three calls
- **WHEN** a turn's lines show three model calls and its `turn_completed` reports 459 output tokens
- **THEN** the session has three requests whose output adds up to 459

#### Scenario: Larger context, larger share
- **WHEN** a turn has two calls with context sizes 20,000 and 60,000 and reports 80,000 uncached input tokens
- **THEN** the first request holds 20,000 of them and the second 60,000

#### Scenario: Cancelled turn
- **WHEN** the user cancels a turn and Grok writes its `turn_completed` with stop reason `cancelled`
- **THEN** the turn's usage is counted as any other turn's

#### Scenario: Turn still running
- **WHEN** ingest reads a turn's first 30 calls and no `turn_completed` yet
- **THEN** the turn has no request; after the turn ends, the next ingest adds them all

### Requirement: Count a Grok turn whose calls cannot be told
A finished Grok turn with no line that states a model call, or one that names more than one model, SHALL become one request per model at the turn's end, with that model's counts.

#### Scenario: Calls unknown
- **WHEN** a turn's `turn_completed` reports usage and no line of the turn states a model call
- **THEN** the turn is one request at the turn's end with the turn's counts

### Requirement: Normalize Grok token counts
A Grok turn's counts SHALL map onto the shared token columns as: uncached input is `inputTokens` minus `cachedReadTokens` minus `cacheCreationTokens`; cache read is `cachedReadTokens`; cache write is `cacheCreationTokens`; output is `outputTokens`, of which thinking is `reasoningTokens`. The model SHALL be the billed model the turn names.

#### Scenario: Cached input is not counted twice
- **WHEN** a turn reports 97,245 input tokens of which 41,600 cached, and 459 output tokens of which 230 reasoning, on `grok-4.7-build`
- **THEN** its requests add up to 55,645 uncached input, 41,600 cache read, 459 output and 230 thinking, 97,704 tokens in all, on model `grok-4.7-build`

### Requirement: Keep the cost Grok reports
Each request of a Grok turn SHALL carry a share of the cost the turn reports (`costUsdTicks`, where 10,000,000,000 ticks are one dollar), split as the tokens are, so that the requests add up to the turn's cost. A model's own cost SHALL stand when its entry states one; the turn's cost less those SHALL go to the models whose entry states none, in proportion to their tokens.

#### Scenario: Model entry without a cost
- **WHEN** a turn reports a cost and its one model's entry states none
- **THEN** its requests add up to the turn's cost

#### Scenario: Cost of a turn
- **WHEN** a turn of three calls reports 1,348,440,000 cost ticks
- **THEN** its three requests' reported costs add up to $0.134844

### Requirement: Record the context of a Grok session
A Grok session's peak context SHALL be the largest context size of its main-thread model calls. Each completed automatic compaction SHALL count as a compaction of the session, and the context window a compaction notice states SHALL be the session's context window.

#### Scenario: Compacted session
- **WHEN** a session's largest model call states 204,851 tokens, Grok says it compacts at a window of 256,000 and completes the compaction
- **THEN** the session has 1 compaction, a context window of 256,000 and a peak context of 204,851

### Requirement: Record the context of each Grok request
Each request of a model call SHALL keep the context size the call stated, and context readers SHALL use it as the request's context. A request whose tokens are not one call's, such as that of a turn whose calls cannot be told, SHALL state no context, and context readers SHALL show no context for it.

#### Scenario: Turn that includes a subagent's calls
- **WHEN** a parent's turn reports usage that includes its subagent's calls, and its last call states a context size of 23,170 tokens
- **THEN** that call's request has a context of 23,170, not its share of the turn's input

#### Scenario: Turn whose calls cannot be told
- **WHEN** a turn reports 5,000,000 input tokens and no line of it states a model call
- **THEN** its request counts those tokens and their cost, and Live, the session timeline and Context show no context for it

### Requirement: Record Grok model time
Each finished Grok turn SHALL add a run to its session with the API time the turn reports. A Grok run SHALL state no tool time and no lines added or removed.

#### Scenario: Output speed
- **WHEN** a session's one turn reports 100,000 output tokens and 1,000,000 ms of API time
- **THEN** the session's output speed is 100 tokens per second

### Requirement: Attribute Grok subagents to their parent
A Grok session that another session spawned SHALL NOT be a session of its own. Its tool calls and prompts SHALL belong to the parent session as subagent work. Its usage SHALL make no request: the parent's turn already includes it. The link SHALL come from the parent's stored `subagent_spawned` line, so that a rebuild gives the same result.

#### Scenario: Probe with a subagent
- **WHEN** a session spawns a subagent that reads one file, the parent's turn reports 5 model calls and the child's own turn reports 2
- **THEN** the store has one session, one subagent `read_file` call on it, and requests that add up to the parent's reported usage

#### Scenario: Rebuild
- **WHEN** the user runs a rebuild after the Grok home was deleted
- **THEN** the subagent's work still belongs to its parent session

### Requirement: Record Grok tool calls and errors
Each Grok tool call SHALL become a tool call record with its tool name, an input summary, its start (the `tool_call` line) and its end (the `tool_call_update` line that states a status) and the size of its result's text. A call SHALL be an error when its status is `failed` or when it is a shell command whose exit code is not 0. A shell error's text SHALL start with `Exit code N`. `run_terminal_command` SHALL count as a shell tool for commit and test detection.

#### Scenario: Failing command marked completed
- **WHEN** `run_terminal_command` runs `ls missing-dir`, Grok marks the call `completed` and the output's exit code is 1
- **THEN** the call is an error whose text starts with `Exit code 1`, and it has an error category

#### Scenario: Commit
- **WHEN** `run_terminal_command` runs `git commit -m "x"` and exits 0
- **THEN** the call counts as a commit

#### Scenario: Call still running
- **WHEN** a `tool_call` line has only an in-progress update
- **THEN** the tool call has a start and no end

### Requirement: Record Grok MCP calls under the MCP tool's name
A Grok call through `use_tool` SHALL be recorded as the MCP tool it calls, `mcp__<server>__<tool>`, with its server. It SHALL be an error when the MCP result says so.

#### Scenario: MCP call
- **WHEN** `use_tool` calls `t3-code__preview_open`
- **THEN** the tool call is `mcp__t3-code__preview_open` with MCP server `t3-code`

#### Scenario: MCP error
- **WHEN** an MCP result of `use_tool` says it is an error
- **THEN** the tool call is an error with the result's error text

### Requirement: Recognize prompts in Grok sessions
Each turn of a Grok main session that starts with a user message SHALL be one prompt, whatever the number of chunks the message came in. A turn that ends with stop reason `cancelled` SHALL mark its prompt interrupted.

#### Scenario: Prompt in two chunks
- **WHEN** a turn's user message is written as two `user_message_chunk` lines
- **THEN** the session has one prompt for the turn, and its text is the two chunks in order

#### Scenario: Cancelled turn
- **WHEN** a turn ends with stop reason `cancelled`
- **THEN** its prompt is interrupted

### Requirement: Record Grok hooks
Each run of a `hook_execution` line SHALL become a hook record with the hook event, the run's name, its duration and whether it failed.

#### Scenario: Two hooks on session start
- **WHEN** a `session_start` hook line lists two runs that succeeded in 12 ms and 40 ms
- **THEN** the session has two `session_start` hook records with those durations and no error
