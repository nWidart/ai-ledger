# Design

## Context

See proposal.md for why. Specs: `live-sessions`, `live-dashboard`, and the `dashboard-app` and `command-palette` deltas.

Current state that shapes the approach:

- **Ingest is already incremental and cheap when nothing changed.**
  - `store.ingest(con, roots)` lists every transcript file, compares each file's size and mtime with the `files` table, and reads only the new bytes of files that changed.
  - Measured on 2026-11-10 against 3,512 Claude Code files and 107 Codex files: listing takes 47 ms and stat-ing all files 18 ms.
  - `ingest_chunk` writes one transaction per changed file.
  - `App.loop` runs ingest, then the plan-limit pollers, then waits `INTERVAL` (60 s) on `App.wake`.
  - `store.ingest` also reads `/insights` usage data unless `roots["insights"]` is missing.
- **The derived tables have no text.** `tool_calls` holds `input_summary` and the error, but not the result. Prompts and replies are only in `raw_lines.json`. The session sheet already reads `raw_lines` by `session_id` for compactions and the first prompt.
  - On the 500k-line explore copy, reading one session's lines takes 2–14 ms.
- **Codex records tools differently.**
  - Codex writes `response_item` lines for each `function_call` or `custom_tool_call` (names seen: `exec`, `exec_command`, `apply_patch`, `spawn_agent`, `wait_agent`, MCP tools), and a matching `*_output` line with the same `call_id`.
  - `codex.py` derives `tool_calls` only from `item_completed` events and works out the start time from the duration. So `tool_calls` never holds a running Codex call. The raw `function_call` line does.
  - Codex also writes `task_started` and `task_complete` per turn, so Codex turn state is recorded rather than guessed.
- **Claude Code** pairs each `tool_use` in an assistant line with a `tool_result` in a later user line. Subagent lines are in `<session>/subagents/*.jsonl`, with `subagent = true` in `raw_lines`.
- **Context windows** are in `prices.json` (`context`, null when unknown). `metrics.NEAR_LIMIT = 0.8` is the existing near-full line.
- **The server** is `ThreadingHTTPServer`, one thread per request, and its threads are daemon threads. Handlers read through `app.con.cursor()`. Writers take `App.lock`.
- **The frontend** keeps view state in the URL hash (`hash.ts`, `SHARED_KEYS = project, range, source, auto`). The pages are listed in `App.tsx` `ROUTES` and `Nav.tsx` `PAGES`, and the palette's `>` destinations come from `PAGES`.

## Goals / Non-Goals

**Goals:**
- One source of truth: the Live page reads the store and never reads transcript files itself.
- Each source owns how its lines become display items, as each source already owns `prompt_text`.
- Nothing changes for users who never open Live: same 60 s interval and same tables.
- Payloads computed in Python and tested against synthetic transcripts, like `/api/limits` and `/api/insights`.

**Non-Goals:**
- Acting on a session: interrupting it, approving a tool or sending a prompt. Live only watches.
- Detecting permission prompts for certain. It stays a labelled guess until a transcript records them.
- Reading text from a session's thinking blocks. Claude Code usually stores them redacted, and Live does not show them.
- Keeping events in a new table. Events are read from `raw_lines` on request.
- Opening sessions in a terminal or editor.

## Decisions

### 1. Speed up the ingest loop while Live is open, instead of tailing files separately

`App` counts the connected Live pages. While the count is above zero, `App.loop` runs transcript ingest every 2 seconds. It still runs usage data and the pollers on their 60-second schedule. Connecting the first Live page sets `App.wake`, so speed-up starts at once.

- Considered: a separate tailer that reads files into memory and never touches DuckDB. Rejected: it is a second parser that would drift from `store.py` and `codex.py`, and the spec rule that both sources map onto the same records would apply twice.
- Considered: stat-ing only files changed in the last few minutes. Rejected for now: the full list and stat cost about 65 ms, which is 3% of a 2-second tick. That saving does not justify a hot set that misses new files. Revisit if file counts grow by ten times.
- 2 seconds, not 1, halves the write transactions. It still meets the stream requirement that a row appears within 3 seconds.

`store.ingest` gains `usage=True`. The fast pass passes `usage=False` instead of editing `roots`. Its stats gain `sessions`, the set of session ids that got new `raw_lines`. `ingest_chunk` already holds each row's session id.

### 2. Notify over SSE, fetch over JSON

`/api/live/events` is a Server-Sent Events stream. It carries only small notices, `changed {sessions: [...]}`, plus a `: keep-alive` comment every 15 seconds. The page then fetches `/api/live` (the session list and states) and `/api/live/session` (the events and figures for the selected session).

- Notices carry ids only, so no transcript content goes through the stream, and the JSON endpoints stay plain, cacheable and covered by fixtures.
- Considered: WebSockets. Rejected: they need a dependency or a hand-written framing layer, and the data only flows one way.
- Considered: polling every 2 seconds without SSE. Rejected: the server would not know when a page is watching, and could not speed up ingest only then.

**Server side.** `App` keeps a `threading.Condition` and a generation counter. After an ingest that stored lines, it records the session ids and `notify_all()`. Each SSE handler thread waits on the condition with a 15-second timeout. On wake-up it writes `changed`, or `: keep-alive` when nothing changed, and flushes. When the write fails (`BrokenPipeError`, `ConnectionResetError`), or when `App.stopping` is set, the handler lowers the live count and returns.

The stream has no `Content-Length`. The handler sends `Cache-Control: no-store` and `X-Accel-Buffering: no`, and flushes `wfile` after each message.

**Client side.** `EventSource` reconnects on its own. The page shows "reconnecting" on `error` and refetches on `open`.

### 3. Per-source display items, read from `raw_lines`

Each source gets `live_items(d)`. It turns one stored line into zero or more items:
- `prompt(text)` and `reply(text)`;
- `request(message_id)`;
- `tool_use(id, name, summary)` and `tool_result(id, is_error, error, output)`;
- `compaction`, `subagent_start(id, name, description)`, and for Codex `turn_start` and `turn_end`.

It reuses `summarize_input`, `error_text` and `codex.tool_of` / `error_of`, so the names and summaries match the other pages.
- Claude Code's goes in `store.py` next to `prompt_text`.
- Codex's goes in `codex.py`. It keys tools by `call_id`, so a `function_call` with no `*_output` shows as running.

`live.events(cur, sid, after, text)`:
1. Reads `raw_lines` for the session, ordered by `ts, file, line_no`. Rows after the cursor only, with a 500-event limit on first load.
2. Maps the rows through the source's `live_items`.
3. Pairs tool uses with their results. When a result comes after the cursor but its use came earlier, the call is sent again with its result.
4. Groups subagent items by file into lanes. A lane is tied to its parent call when the source names it: a Claude Code `Agent`/`Task` result carries the agent id, and a Codex `spawn_agent` output carries the thread id. Otherwise the lane stands on its own, at its first line.

The cursor is the last `(ts, key)` pair the page holds. Lines in one ingest can share a timestamp, so the page also drops repeated keys.

- Considered: a new derived `live_events` table. Rejected: it would duplicate `raw_lines`, and it would need `rebuild` and migration work for data that is only read for a few active sessions.
- Considered: using `tool_calls` for tool state. Rejected for state: it never holds a running Codex call (see Context). The agent panel's totals (cost, requests, tool calls and errors) still come from the derived tables through the existing `metrics` cost CTE, so they match Cost and Activity.

### 4. State is derived in one function, from the newest items

`live.state(items, now, source)` applies the order in the `live-sessions` spec, and returns `{kind, label, since, inferred}`.
- The approval guess applies to `SHELL_TOOLS` plus Codex `exec`, after 30 seconds.
- Codex *thinking* comes from `turn_start` with no matching `turn_end`, and is not inferred.

The function is pure, so tests feed it item lists directly.

The active list (`/api/live`) reads `sessions.last_ts` within 10 minutes, through the same `scope(project, automated, source)` filter as the other pages. For each active session it then reads only the newest lines needed for its state, at most 200.

### 5. Text is opt-in per request

`/api/live/session?text=1` adds the text of prompts, replies and tool results, each result capped at 4 KB. Without `text=1`, the items carry `words` or `chars` only.

The Full text toggle is React state with no storage, so it is off on each load. Turning it on refetches the selected session with `text=1`.

The server never puts text in SSE notices or in `/api/live`.

### 6. Page structure

`web/src/pages/live/` holds:
- `LivePage.tsx`: the rail, stream and panel layout, and the Stream or Wall switch.
- `Stream.tsx`: the stream with its tool rows and lanes.
- `AgentPanel.tsx`.
- `Wall.tsx`.
- `live.ts`: merging updates and the scroll-follow logic, kept pure and unit-tested.
- `useLive.ts`: `EventSource`, refetch on notice, and Pause, which buffers notices and refetches once on Resume.

Running timers tick from one shared 1-second interval in the page, and each tick re-renders only the rows that are still running. The URL hash gains `session` and `view`, outside `SHARED_KEYS`, so other pages keep their own hash. The mockup's layout and colors use the existing tokens in `theme.css`. The project color comes from `ProjectDot`.

## Risks / Trade-offs

- [Write load every 2 seconds while Live is open] → One transaction per changed file, usually 1–3 files. Measure lock wait and tick time against a copy of the store with two synthetic sessions writing (task 2.4). If a tick takes more than 500 ms, fall back to stat-ing only hot files (decision 1, alternative 2).
- [SSE threads hold server threads] → One thread per open Live tab. This is a local single-user app, so a handful of tabs is the realistic maximum. Daemon threads end with the process.
- [Shutdown hangs on an open stream] → SSE handlers wake at least every 15 seconds and exit on `App.stopping`. `serve_forever` stops accepting first. Daemon threads do not block exit.
- [Wrong approval guess] → Always labelled as inferred, with the reason. Only shell calls past 30 seconds qualify, so long test runs will sometimes be flagged as likely waiting. That is accepted and stated in the UI.
- [Secrets on screen] → Text only on request, toggle off on every load, a banner while on, and the page only ever on `127.0.0.1`.
- [Transcript format drift] → `live_items` ignores unknown line types, and tests pin the known shapes for both sources. An unknown tool name still shows with its raw name.
- [Codex subagent and turn shapes are newer than the parser's fixtures] → Task 3.3 adds synthetic `spawn_agent`, `task_started` and `task_complete` lines. If a real rollout differs, the lane falls back to standing on its own.

## Migration Plan

No schema change and no `rebuild`. Deploying means restarting the app with the new build. To roll back, revert the commit: no stored data depends on it.
