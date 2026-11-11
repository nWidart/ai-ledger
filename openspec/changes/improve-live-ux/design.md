# Design

## Context

See proposal.md for why. Specs: `live-sessions`, `live-dashboard` and `dashboard-app` deltas. The decisions below were made before this change was written; they are recorded, not open.

Current state that shapes the approach:

- **State is one function.** `live.state(events, now, source, last)` returns `kind` (idle, wait, tool, thinking, you), `tool`, `since` and `inferred`. The page's `stateNow` in `live.ts` turns a pending shell call (`Bash`, `exec_command`, `exec`) older than 30 s into `wait` between fetches, so the page and the server each hold the 30 s rule and the shell tool set. Both read tool names only.
- **`live_items` drops what the new rules need.** Claude Code's `tool_use` item carries `description` but not `run_in_background` or `timeout`. Codex's carries `description` for `spawn_agent` only. Both arrive as `input` or `arguments` in the line.
- **The list is sorted by `last_ts`.** `/api/live` returns sessions newest-written first, with no start time. `sessions.first_ts` exists in the store.
- **Lane figures are on the page, not the server.** `lanesOf` in `live.ts` builds lanes from the events held: start, end, tool count, running. Requests are left out of `assemble`, and `requests` has `subagent` but no lane id, so lane cost and model cannot be read from the derived tables.
- **Stream layout.** `streamRows` places each lane after the call that started it. `Stream.tsx` follows by setting `scrollTop = scrollHeight`, and turns Follow off when the scroll position leaves the bottom. A lane in the middle of the stream therefore grows out of view while Follow stays on.
- **Connection.** `useLive` opens an `EventSource`. On `onerror` it sets "reconnecting". A browser retries a dropped connection by itself, but when the server answers with an HTTP error status (not a 200 `text/event-stream`), `EventSource` closes for good and the page stays "reconnecting" forever.
- **Nav status.** `Nav.tsx` polls `/api/status` every 60 s (3 s while ingesting) and feeds `noteIngest` and `noteStatus` (`refresh.ts`). The poll lives in a `useEffect` of `Nav`, so nothing else can ask for it.

## Goals / Non-Goals

**Goals:**
- The user sees which agent needs them without reading every row.
- Nothing moves under the cursor except on a state change.
- The server and the page agree on what reads as "approval?", by reading one flag the server computes.
- Each rule lives once: the read-only list, the long-call rule and the close evidence are in Python, and the payload carries their result.

**Non-Goals:**
- A learned duration per command, to tell a slow command from a wait. The rule is the two explicit signals (`run_in_background`, timeout above 120 s) and nothing else.
- Desktop notifications. The tab title count is the whole alert.
- Acting on a session (interrupting, approving). Live still only watches.
- Keeping the filters or the lane fold state across reloads or in the URL.
- New endpoints or tables.

## Decisions

### 1. Attention first

The rail and the wall group sessions by state, in this order: *approval?*, *your turn*, *working* (running or thinking), *idle*, *ended*. A group with no sessions is not drawn. Each group has a heading with its count.

- A rail entry and a wall tile show how long the session has been in its state when it is *your turn* or *thinking*, from `state.since`, as running tools already do ("your turn 4m 05s", "thinking 12s"). The figure counts up with the page clock.
- A "your turn" tile has a border, in the state's own color (`--good`), as the *approval?* tile already has one in the warning color (`.tile.st-wait`). The two groups that need the user are the two with a frame. The border is not the only cue: the group heading and the state label say the state.
- The tab title carries the count of sessions that need the user: *approval?* plus *your turn*, over the sessions listed after the filters. With a count above zero the title reads `(2) Live · AI Ledger`; with zero it reads `Live · AI Ledger`. `App.tsx` sets the base title on each route, so the Live page sets its own title in an effect and restores the base on cleanup. The count uses `stateNow`, so a call passing 30 s moves the count when the page notices, not at the next fetch.
- The rail footer keeps its text (working, waiting for you, cost).
- Considered: a desktop notification. Rejected by the owner: a second channel to permit and to silence, and the tab title is visible from any tab.

### 2. Stable rail order

Inside a state group, sessions sort by session start, oldest first, then by session id. A new session joins the end of its group, so no entry above it moves. An entry changes position only when its state changes group.

- `/api/live` gains `started` on each entry, from `sessions.first_ts`. The list keeps its order by last write, because the page's default selection, "the newest active session", reads the first entry; the page does the grouping and the sorting.
- Considered: newest start first. Rejected: a new session would push every entry in its group down by one, the movement this decision removes.
- Considered: sort by project. Rejected: it groups by something the state groups already split.

### 3. Bash description as row text

When a shell call (`Bash`, `exec_command`, `exec`) carries a `description`, the stream row shows it as the row text, in place of the command. The opened row shows both: the description and the command (the input, as today). Without a description the row shows the command, as today.

- The payload already carries `description` on every tool event. Without Full text it is cut to `INPUT_CAP`, like other inputs, and it is treated as the label the agent gave the call, not as transcript text to hide. Subagent calls already use it this way.
- The row's title attribute holds the command, so hovering still shows it.

### 4. Lanes

- **Folded by default when finished.** A lane whose parent call has a result (the existing `done`) starts folded. A running lane starts unfolded. A fold the user toggles is kept for the session while the page is open (the existing `folded` set), so a lane the user opened stays open when it finishes.
- **A running lane shows its last 5 rows.** Above them the lane shows "Show all N rows" and, once expanded, "Show last 5". The count is of tool rows. The choice is kept per lane while the page is open.
- **Follow is lane-aware.** With Follow on, the stream scrolls the newest event into view: the row of the event with the newest timestamp, wherever it sits, not the bottom of the scroll box. A lane in the middle of the stream with a new row therefore scrolls to that row. The `onScroll` handler that turns Follow off must tell its own scroll from the user's: it compares the position with the position it last set, and ignores scrolls that land on it. A running lane shows the last 5 rows, so the newest event is always rendered; with a lane the user folded, Follow scrolls to the lane header.
- **Lane header: cost, model, errors.** The header adds the lane's cost, its model and its error count (failed tool rows in the lane; shown only when above zero, in the error color).
  - Errors come from the events the page holds, as the tool count does.
  - Cost and model come from the server. The session payload gains `lanes`, an array of `{id, cost, model}`. The server prices the lane's requests: each lane file's `raw_lines` hold assistant lines whose `message.id` is the `requests.message_id`, so the lane's cost is the sum of the priced requests of those ids (the figures query already prices requests through `metrics.requests_cte`), and its model is the model of the lane's newest request. For Codex, which names its model per turn, the model is the session's. When the cost or model is not known, the header leaves the figure out.
  - Considered: put `lane` on the `requests` table. Rejected: a schema change and a rebuild for a figure only this page shows.

### 5. Fewer false "approval?" states

A shell call that carries `run_in_background`, or an explicit timeout above 120 s, is *detached*: it reads as *running a tool*, never as *approval?*, however long it runs.

- `live_items` for Claude Code carries `background` (`input.run_in_background`) and `timeout` (`input.timeout`, in milliseconds) on its `tool_use` items. The Codex counterpart is whatever field its `exec_command` arguments use for a background run or a timeout; the builder reads real rollouts for it, and the spec rule stays the same.
- `live.py` computes `detached` for each tool event (`background` true, or `timeout` above `LONG_CALL = 120 s`) and sends it on the event. `state` leaves detached calls out of the approval wait, and sends `detached` on a `tool` state too.
- `live.ts` keeps its 30 s rule but reads the flag: `stateNow` turns a `tool` state into `wait` only when the state is not detached; `ToolRow` does the same for the event. The page holds no list of its own, so the two cannot disagree on which calls are long.
- No learned duration per command: a command that is usually slow but carries neither signal still reads as *approval?* after 30 s. That stays a guess, labelled inferred. Out of scope.

### 6. Stream filters

Three controls in the stream head:
- **Errors count.** The agent panel's error count, and the same figure in the stream head, are a button. Selecting it filters the stream to failed tool rows; selecting it again clears it. It is off on every load.
- **Main thread only.** Hides every lane.
- **Hide read-only noise.** Hides tool rows that only read: Claude Code's `Read`, `Grep` and `Glob`, and Codex's counterparts, which are shell calls whose every simple command is a read-only reader or searcher (`rg`, `grep`, `cat`, `sed`, `ls`, `find`, `head`, `tail`, `wc` and the like, confirmed against real rollouts).

The rules:
- The server owns the read-only rule and sends `quiet` on each tool event, as it does `detached`, so the Codex command parsing stays with the code that already parses shell commands (`categorize.commands`) and the page keeps no tool list.
- Filters combine. Main thread only with Errors shows failed main-thread rows. A lane that has matching rows stays, with its header and only those rows; a lane with none is hidden.
- Prompts, replies, compactions and interrupts are hidden while Errors is on, because the filter is for failed rows. They stay when only the other toggles are on.
- Filtering changes what is drawn, not what is held: the lane's tool count and the agent panel's figures do not change.
- Filters are page state, off on every load, and survive a session switch in the same page visit. They are not in the URL.
- The stream says when a filter hides everything ("No failed calls in the events held"), and how many rows are hidden.

### 7. Session sheet link and dated times

The stream head gains a link to the session's sheet on Activity (`sessionHref`, with `appLink` as the "older events" note already uses). The head also keeps the other chips.

Times in the stream (`time()` in `Stream.tsx`) include the date when the event is not from today in the user's locale: `Nov 9, 14:03:12`. Today's events keep the bare time. The check is by local calendar day, against the page clock.

### 8. An "ended" state

A new state kind, `ended`, for a session whose transcript shows it closed. It is checked first, before *idle*: a closed session is ended, not idle, whatever its age (within the 10-minute active list). It names no tool, carries `since` (the close) and is not inferred.

- The state shows only when the transcript gives evidence of the close, and only when no later line follows the close line (a resumed session is not ended). Without evidence the state stays what the old rules give: *your turn*, then *idle* after 5 minutes. The page never guesses an end.
- What counts as evidence is for the implementing builder to find in real transcripts of both sources (a copy of the store, as `AGENTS.md` says): for Claude Code, whatever the CLI writes on exit; for Codex, whatever its rollout writes at shutdown. The builder records what it found, with the shape of the line (never a real line), under this decision before writing code, and puts each source's rule in its own `live_items`, as every per-source rule is. If a source gives no evidence, that source never shows *ended*, and the task says so.
- In the rail and on the wall *ended* is the last group, drawn quieter than *idle*. It does not count toward the tab title, the "working" count or the "waiting for you" count.

### 9. Paused looks paused, and an HTTP error retries

**Paused.** While paused, the connection line has no green dot, and the state dots in the rail, the wall and the panel do not pulse. Today the green dot belongs to "Updating live" and the pulse to running and thinking dots. Paused shows a neutral, still dot, and the running timers stop (they already do, since `useNow` stops). A class on the page (`paused`) switches the CSS, so no component carries the logic.

**HTTP error.** `EventSource` retries by itself after a network drop, but closes for good when the response is an HTTP error: `readyState` is `CLOSED` in `onerror`. The page then closes the source, shows "reconnecting", and opens a new one after a backoff: 1 s, doubling to a cap of 30 s, reset by a successful `onopen`. A source that stays `CONNECTING` is left to the browser. The backoff timer is cleared on unmount. Pause does not close the connection, as today: notices arrive and are held, and a retry that succeeds while paused counts as one held update. The `NoticeSource` test seam gains `readyState` so tests can drive both cases.

### 10. Nav ingest status

The nav's poll becomes one exported function, `pollStatus()`, in `refresh.ts` (it fetches `/api/status`, then calls `noteIngest`, `noteStatus` and `setOrder`, as the nav effect does). `Nav` still calls it on its 60 s and 3 s schedule. `useLive` calls it on each change notice, coalesced: at most one request in flight, and one trailing call when notices arrive meanwhile. A notice that arrives while paused is held and does not poll; the resume refetch polls once.

- The notice already means an ingest stored lines, so "Last ingest" changes only on those. An ingest that stores nothing sends no notice and leaves the time as it was; the 60 s poll covers it.
- `noteIngest` clears the API cache when `last_change` moves. On the Live page that cache is not read (Live uses `getJson` per request), so the clear is harmless there; other pages are not open.
- A notice comes after the ingest finished, so the status the poll reads is not "Ingesting…" except for the next second's ingest overlapping; the nav's own 3 s retry covers that.

## Risks / Trade-offs

- **Ended evidence may be thin.** If a source writes nothing on close, *ended* never shows for it. The spec allows that on purpose: a wrong *ended* hides a session that waits for the user.
- **Fewer approvals shown.** A detached call that does wait on approval reads as running. Both signals are explicit (the agent asked for a background run or a long timeout), and the permission prompt for such a call is the same one as for any call, so this trades a few missed prompts for far fewer false ones. The 30 s rule still applies to everything else.
- **Lane cost by request id.** It depends on the lane's lines holding the assistant lines the `requests` rows came from. A lane whose lines were not ingested yet shows no cost until they are.
- **Grouping moves entries on a state change.** A session finishing its turn jumps from *working* to *your turn*. That is the point of the grouping, and the only movement left.
- **Scroll-to-newest in a middle lane** uses element positions and needs a layout in tests; jsdom has none, so the test drives the handler with stubbed measurements.

## Migration Plan

Payload fields are added (`started`, `lanes`, `detached`, `quiet`, a state `ended`); none is removed, and the page and server ship together in one build, so no compatibility window is needed. No rebuild of derived tables: `live_items` changes read `raw_lines` on request. Regenerate `web/src/__fixtures__/` after payload changes and commit `src/ai_ledger/web/`.
