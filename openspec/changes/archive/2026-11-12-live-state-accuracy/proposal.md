# Proposal

## Why

The Live page misreads Codex sessions that use subagents, and some Claude Code ones:

- A Codex subagent's file is named by its own thread id, so ingest filed its lines under that id, as a session of its own and not as subagent work. The two files that continue a main thread (`<session>_<thread>`) were read as subagents instead. Live never showed a subagent under its session.
- A subagent's turn end set the parent to *your turn* while the parent still worked.
- A session whose only live work is in a subagent read *your turn*.
- The newest-lines window for the active list could lose the main thread's turn marks to subagent traffic.
- A failed command run by a Codex `exec` script left no row.
- A Codex lane had no call that named it.

## What Changes

- **A Codex file belongs to the session and class its own `session_meta` states.** A thread whose `session_id` differs from its `id` is a subagent of that session; any other file, `<session>_<thread>` included, is main-thread work. Ingest, derived rows and `rebuild` agree.
- **Live skips a forked subagent's copied history**, which would show the parent's turns again.
- **State reads the main thread.** For Codex, only main-thread turn marks decide *thinking* and *your turn*. A subagent at work keeps a session *thinking* (inferred), for both sources.
- **The newest-lines window keeps the main thread**: per session, the newest lines of the main thread and of the subagents are read apart, and Codex's newest main-thread turn mark is read whatever its age.
- **A failed call inside an `exec` script becomes a tool event.**
- **A Codex `spawn_agent` call names its lane**, from the `SubAgentActivity` start item.
- **Resumed session:** measured on real transcripts; the limit is stated, no code changes (see design).

Out of scope: the web page (it already ties a lane to the call whose `agent` names it), double counting of a forked history in derived rows (it dedupes by id), a stored Codex store before this version (corrected by `ai-ledger rebuild`).

## Capabilities

### Modified Capabilities
- `live-sessions`: "Derive each session's state", "Mark inferred states", "Group subagent work", "Report a closed session as ended"; new requirements "Keep a session working while a subagent works", "Show a failed call made inside a Codex script", "Skip a forked subagent's copied history", "Keep the main thread in the state window".
- `codex-transcripts`: "Count an archived session once"; new requirement "Place each thread by its own session record".

## Impact

- `src/ai_ledger/codex.py`, `store.py` (the `Source` hook, `ingest_chunk`, `rebuild`), `live.py`; tests; README, CHANGELOG. Page-test fixtures only if a payload changes. A store written before this version needs one `ai-ledger rebuild`.
