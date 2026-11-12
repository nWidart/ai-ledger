# Spec Delta

## MODIFIED Requirements

### Requirement: Count an archived session once
Each Codex line SHALL be keyed by the thread named in its file name and its `ordinal`, so the same line in a live file and in its archived copy is stored once.

#### Scenario: Session archived after ingest
- **WHEN** a session was ingested from `sessions/` and Codex later moves it to `archived_sessions/` as `.jsonl.zst`
- **THEN** its lines, requests and tool calls are not duplicated, and its token totals do not change

#### Scenario: Thread file that continues a session
- **WHEN** a file is named `rollout-<time>-<session>_<thread>.jsonl.zst`, its `session_meta` has the same `session_id` and `id`, and its ordinals overlap the ordinals of the `<session>` file
- **THEN** the store keeps both files' lines. Lines are keyed by `<thread>`, and that thread's requests and tool calls belong to session `<session>` as main-thread work

## ADDED Requirements

### Requirement: Place each thread by its own session record
A Codex thread SHALL belong to the session its first `session_meta` states, and be subagent work only when that record's `session_id` is set and differs from its `id`. This holds for the stored lines (`session_id`, `subagent`) and the derived rows, whatever the file is named. With no `session_meta`, the file name decides: `<session>_<thread>` is subagent work of `<session>`. `rebuild` SHALL set it again on lines stored before.

#### Scenario: Subagent in a file named by its own thread
- **WHEN** a file `rollout-<time>-<thread>.jsonl` has a `session_meta` with `session_id` `<parent>` and `id` `<thread>`
- **THEN** its lines are stored under session `<parent>` as subagent work, and so are its requests and tool calls

#### Scenario: Chunk with no session record
- **WHEN** a later ingest reads lines of that file and none is a `session_meta`
- **THEN** the new lines are stored under `<parent>` as subagent work, as the stored record says

#### Scenario: Continuation file
- **WHEN** a file named `<session>_<thread>` has a `session_meta` whose `session_id` equals its `id`
- **THEN** its lines are stored under `<session>`, not as subagent work

#### Scenario: No session record
- **WHEN** a file named `<session>_<thread>` holds no `session_meta`
- **THEN** its lines are stored under `<session>` as subagent work

#### Scenario: Store from before this rule
- **WHEN** `rebuild` runs on a store whose subagent file's lines carry the thread's id as their session
- **THEN** those lines carry the parent's id and the subagent flag, and the derived rows match a fresh ingest
