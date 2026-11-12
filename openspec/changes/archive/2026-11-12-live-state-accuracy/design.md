# Design

## Context

Codex writes one rollout file per thread. Measured on 164 real files (CLI 0.120 to 0.167):

- A subagent's file is `rollout-<time>-<thread>.jsonl` (its own thread id only). Its first `session_meta` has `session_id` (the parent session) different from `id` (its thread), `parent_thread_id` and `thread_source = "subagent"`. A forked one also has `subagent_history_start_ordinal`: lines below that ordinal copy the parent's history, `task_started` included, and the file holds a second `session_meta`, the parent's.
- Two files are named `<session>_<thread>`. Their `session_meta` has `session_id == id` and a `history_base`: they continue the main thread.
- The parent's rollout holds a `SubAgentActivity` item with `kind = "started"` per subagent (CLI 0.156 and later): its `id` is the `spawn_agent` call's `call_id`, its `agent_thread_id` the subagent's thread.
- Inner calls of an `exec` script are `item_completed` lines whose `item.id` never equals the outer `call_id`.

## Decisions

- **D1. One function decides a file's owner.** `codex.thread_class(path, payload)` returns (session id, is subagent) from the first `session_meta` payload: a subagent when `session_id` is set and differs from `id`, else main-thread work of `session_id` or `id`. With no payload it falls back to the file name rule. A new `Source.placement(cur, path, lines)` hook returns (session id or None, subagent) for a file, so `ingest_chunk` and `rebuild` need no source test. Codex's takes the `session_meta` of the chunk, else the thread's stored one; Claude Code's is `(None, "/subagents/" in path)`. `CodexDeriver.start` uses the same function. `rebuild` first rewrites `session_id` and `subagent` of a Codex file's stored lines. Index lines are not touched. The lane id of a subagent stays its thread id (`codex.ids(path)[1]`).
- **D2. Skip the copied history.** `live.session` and `live.sessions` drop the lines of a forked subagent file below its `subagent_history_start_ordinal`. One query per call reads the start ordinals of the session's subagent files. Derived rows dedupe by id; no double counting was seen there, and none is changed here.
- **D3. State reads the main thread.** Codex turn marks decide *thinking* and *your turn* from events with no lane. When that rule gives *your turn* and a lane's newest evidence is newer than the main thread's newest and shows the lane at work, the state is *thinking*, inferred, since that evidence. At work: for Codex the lane's newest turn mark is a turn start; for Claude Code the lane's newest event is a finished tool call, as its next reply has not come. A pending call in a lane already reads *running a tool*.
- **D4. The window keeps the main thread.** `live.recent` takes the newest `STATE_LINES` lines of the main thread and of the subagents separately, and for Codex also reads the main thread's newest turn mark (an `event_msg` of type `task_started`, `task_complete` or `turn_aborted`) whatever its age, so a long turn still reads thinking.
- **D5. A failed inner call is an event.** `codex.live_items` carries the tool name and summary on the failed `tool_result`. `live.assemble` turns a failed result that no tool call of the session has the id of (in the rows, or earlier, as `earlier_uses` resolves) into a finished, failed tool event on its lane, keyed `<line key>#<i>`. It never changes the state. A failed item whose id matches a call still marks that call failed; successful inner calls stay hidden.
- **D6. The spawn call names its lane.** `codex.live_items` reports a `SubAgentActivity` item of kind `started` as the call `id` that started agent `agent_thread_id`. `live.session` sets `agent` on the matching call as `started_by` does for Claude Code, including a call before the rows, and never sets its end.
- **D7. Resumed session: no change.** A resumed Claude Code session reads *ended* until its first timed line. On 3,423 real main transcripts, 3,637 `cost-state` lines: 3,467 end a file (a) and 170 are followed by a timed line (b). Of (a), 3,369 have nothing after the close; the other types after it are `mode`, `last-prompt`, `ai-title`, `artifact-comment-monitor`, `artifact-autoreact-ledger`, `tools-used`, `atis-latch`, `custom-title` and `agent-name`. Of (b), 108 have nothing between the close and the next timed line, and 165 of the 170 next timed lines are `queue-operation`. `tools-used`, `mode`, `atis-latch` and both `artifact-*` types appear in (a) and (b), so no untimed line marks a resume. `agent-setting` (5 in (b), none in (a)) and `worktree-state` are written all through a session (7,742 and 845 lines in total), so they are no resume mark either. The limit is stated in the spec.

## Known limits

- A subagent of a Codex CLI before 0.156 writes no `SubAgentActivity` start (no such child file exists to check): its lane is named by no call, and the page tells it done by its last turn mark.
- A resumed Claude Code session reads *ended* from its resume until its first timed line, a few seconds.

## Risks

- A store written before this version keeps the old session ids until `ai-ledger rebuild` runs. The changelog says so.
- A forked subagent's first `session_meta` is the one read; the second is the parent's copy and is ignored, as `CodexDeriver` already does.
