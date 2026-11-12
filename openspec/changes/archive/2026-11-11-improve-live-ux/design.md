# Design

## Context

See proposal.md for why. Specs: `live-sessions`, `live-dashboard` and `dashboard-app` deltas. The decisions below were made before this change was written; they are recorded, not open. Decisions 4 (lane cost), 5, 6 (the read-only rule) and 8 were settled against real transcripts during the build, and say what was built.

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
- A learned duration per command, to tell a slow command from a wait. The rule is one explicit signal (a timeout above 120 s) and nothing else.
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

- `/api/live` gains `first_ts` on each entry, the session's start, from `sessions.first_ts`. The list keeps its order by last write, because the page's default selection, "the newest active session", reads the first entry; the page does the grouping and the sorting.
- Considered: newest start first. Rejected: a new session would push every entry in its group down by one, the movement this decision removes.
- Considered: sort by project. Rejected: it groups by something the state groups already split.

### 3. Bash description as row text

When a shell call (`Bash`, `exec_command`, `exec`) carries a `description`, the stream row shows it as the row text, in place of the command. The opened row shows both: the description and the command (the input, as today). Without a description the row shows the command, as today.

- The payload already carries `description` on every tool event. Without Full text it is cut to `INPUT_CAP`, like other inputs, and it is treated as the label the agent gave the call, not as transcript text to hide. Subagent calls already use it this way.
- The row's title attribute holds the command, so hovering still shows it.

### 4. Lanes

- **Folded by default when finished.** A lane whose parent call has a result (the existing `done`) starts folded. A running lane starts unfolded. A fold the user toggles is kept while the page is open (`LaneChoices` in `live.ts`, held by the page), so a lane the user opened stays open when it finishes. With the Errors filter on, a finished lane that holds a failed row is open, unless the user folded it.
- **A running lane shows its last 5 rows.** Above them the lane shows "Show all N rows" and, once expanded, "Show last 5". The count is of tool rows, and the control shows only above 5. The choice is kept per lane while the page is open; asking for every row is opening the lane, so it stays open when it finishes.
- **Follow is lane-aware.** With Follow on, the stream scrolls the newest event into view: the row of the event with the newest timestamp, wherever it sits, not the bottom of the scroll box. A lane in the middle of the stream with a new row therefore scrolls to that row. The `onScroll` handler that turns Follow off must tell its own scroll from the user's: it compares the position with the position it last set, and ignores scrolls that land on it. A running lane shows the last 5 rows, so the newest event is always rendered; with a lane the user folded, Follow scrolls to the lane header.
- **Lane header: cost, model, errors.** The header adds the lane's cost, its model and its error count (failed tool rows in the lane; shown only when above zero, in the error color).
  - Errors come from the events the page holds, as the tool count does.
  - Cost and model come from the server. The session payload gains `lanes`, a map `Record<laneId, {cost, model}>` keyed by the events' lane id, with an entry for each lane that has a request. `requests` names no subagent, so the server gives a request to a lane by joining `requests` to the request lines of the lane files (`assistant`, Codex `token_usage_record`) on session and line time. It reads the request id from the line (`message.id`, Codex `payload.response_id`) only on a time tie, when files of several lanes hold a request line with that time. A request written on several lines counts once. The lane's cost is the sum of its priced requests (the figures query already prices requests through `metrics.requests_cte`), and none when no request of its has a price; its model is the model of its newest request, for both sources, as a Codex request carries its turn's model. When the cost or model is not known, the header leaves the figure out.
  - Considered: put `lane` on the `requests` table. Rejected: a schema change and a rebuild for a figure only this page shows.

### 5. Fewer false "approval?" states

A shell call that carries an explicit timeout above 120 s is *long*: it reads as *running a tool*, never as *approval?*, however long it runs.

- `live_items` for Claude Code carries `timeout` (`input.timeout`, in milliseconds, when it is a number) on its `tool_use` items. Codex's shell tools carry no timeout and no background field (`exec_command`'s `yield_time_ms` is how long the call waits for output, not a timeout), so a Codex item's `timeout` is none and `long` is always false for Codex.
- `live.py` computes `long` for each tool event (`timeout` above `LONG = 120 s`; exactly 120 s is not long) and sends it on the event. `state` leaves long calls out of the approval wait, and sends `long` on a `tool` state too.
- `run_in_background` does not set the flag, and no item carries a `background` field. A background shell call returns as soon as its command has started: real ones return within seconds (p99 3.7 s in a sample of real calls). One still pending past 30 s is therefore almost always an approval wait, and reads *approval?* like any other shell call.
- `live.ts` keeps its 30 s rule but reads the flag (`likelyWaiting`): `stateNow` turns a `tool` state into `wait` only when the state is not long; `ToolRow` does the same for the event. The page holds no list of its own, so the two cannot disagree on which calls are long.
- No learned duration per command: a command that is usually slow but carries no long timeout still reads as *approval?* after 30 s. That stays a guess, labelled inferred. Out of scope.

### 6. Stream filters

Three controls in a bar under the stream head:
- **Errors count.** The agent panel's error count, and the same figure in the bar, are a button. Selecting it filters the stream to failed tool rows; selecting it again clears it. A pressed button is the filter on. It is off on every load.
- **Main thread only.** Hides every lane.
- **Hide read-only.** Hides tool rows that only read: `Read`, `Grep` and `Glob`, and a shell call (`Bash`, `exec_command`) whose every simple command only reads, searches or prints. Codex names no Read or Grep tool: it reads and searches through `exec_command`.

The rules:
- The server owns the read-only rule (`quiet` in `live.py`) and sends `quiet` on each tool event, as it does `long`, so the command parsing stays with the code that already parses shell commands (`categorize.commands`) and the page keeps no tool list.
- A shell call is quiet when, unwrapped from `bash -lc '…'` and split into simple commands, every command is one of `QUIET_COMMANDS` (`rg`, `grep`, `cat`, `ls`, `head`, `tail`, `wc`, `nl`, `cd`, `pwd`, `echo`, `sed`, `sort`, `find`) with no flag that makes it write (`sed -i` or `--in-place`; `sort -o` or `--output`; `find -delete`, `-exec`, `-execdir`, `-ok`, `-okdir`, `-fprint`, `-fprint0`, `-fprintf`, `-fls`), and the line redirects nothing into a file (`2>&1` and `> /dev/null` are not files). Quoted text that runs nothing is not read as shell syntax; a command substitution is a command of its own. A call that cannot be read as a command line is not quiet: Codex's `exec`, which runs a script, an empty command, and a summary Codex cut short.
- Filters combine. Main thread only with Errors shows failed main-thread rows. A lane that has matching rows stays, with its header and only those rows; a lane with none is hidden.
- Prompts, replies, compactions and interrupts are hidden while Errors is on, because the filter is for failed rows. They stay when only the other toggles are on.
- Filtering changes what is drawn, not what is held: the lane's tool count and the agent panel's figures do not change.
- Filters are page state, off on every load, and survive a session switch in the same page visit. They are not in the URL.
- The stream says when a filter hides everything ("No failed calls in the events held"), and how many rows are hidden.

### 7. Session sheet link and dated times

The stream head gains a link to the session's sheet on Activity (`sessionHref`, with `appLink` as the "older events" note already uses). The head also keeps the other chips.

Times in the stream (`time()` in `Stream.tsx`) include the date when the event is not from today in the user's locale: `Nov 9, 14:03:12`. Today's events keep the bare time. The check is by local calendar day, against the page clock.

### 8. An "ended" state

A new state kind, `ended`, for a session whose transcript shows it closed. It is checked first, before *idle*: a closed session is ended, not idle, whatever its age (within the 10-minute active list). It names no tool and is not inferred. Its `since` is the time of the session's newest timed line, because the close line has no timestamp.

- The state shows only when the transcript gives evidence of the close, and only when no timed line of the main thread follows the close line (a resumed session is not ended). Without evidence the state stays what the old rules give: *your turn*, then *idle* after 5 minutes. The page never guesses an end.
- The evidence, found in real transcripts of both sources (a copy of the store, as `AGENTS.md` says; shapes only):
  - **Claude Code** writes a line of type `cost-state` as the process exits. It carries the session id and no `timestamp`. A session is ended when that line comes after the last timed line of its main file; with several main files, the one that wrote last decides. A resume writes on after the line, in the main file, and so reopens the session. A subagent's file does not count: a late subagent line reopens no closed session.
  - **Codex** writes no line that marks a close, so a Codex session never shows *ended*.
- Each source declares the type of its close line as `Source.close_type` in `store.py` (`cost-state` for Claude Code, none for Codex), and `live.closed` reads `raw_lines` by that type. The close is not an item of `live_items`: events come from timed lines, and the close line has no time.
- In the rail and on the wall *ended* is the last group, drawn apart from *idle*: a square dot where the other states have a round one, and a dashed frame on its tile and on the panel's box. It does not count toward the tab title, the "working" count or the "waiting for you" count.

### 9. Paused looks paused, and an HTTP error retries

**Paused.** While paused, the connection line has no green dot, and the state dots in the rail, the wall and the panel do not pulse, and no spinner turns. Today the green dot belongs to "Updating live" and the pulse to running and thinking dots. Paused shows a neutral, still dot, and the running timers stop (they already do, since `useNow` stops). A class on the page (`paused`) switches the CSS, so no component carries the logic.

**HTTP error.** `EventSource` retries by itself after a network drop, but closes for good when the response is an HTTP error: `readyState` is `CLOSED` in `onerror`. The page then closes the source, shows "reconnecting", and opens a new one after a backoff: 1 s, doubling to a cap of 30 s, reset by a successful `onopen`. A source that stays `CONNECTING` is left to the browser. The backoff timer is cleared on unmount. Pause does not close the connection, as today: notices arrive and are held, and a retry that succeeds while paused counts as one held update. The `NoticeSource` test seam gains `readyState` so tests can drive both cases.

### 10. Nav ingest status

The nav's poll becomes one exported function, `pollStatus()`, in `refresh.ts` (it fetches `/api/status`, then calls `noteIngest`, `noteStatus` and `setOrder`, as the nav effect does). `Nav` still calls it on its 60 s and 3 s schedule. `useLive` calls it on each change notice, coalesced: at most one request in flight, and one trailing call when notices arrive meanwhile. A notice that arrives while paused is held and does not poll; the resume refetch polls once.

- The notice already means an ingest stored lines, so "Last ingest" changes only on those. An ingest that stores nothing sends no notice and leaves the time as it was; the 60 s poll covers it.
- `noteIngest` clears the API cache when `last_change` moves. On the Live page that cache is not read (Live uses `getJson` per request), so the clear is harmless there; other pages are not open.
- A notice comes after the ingest finished, so the status the poll reads is not "Ingesting…" except for the next second's ingest overlapping; the nav's own 3 s retry covers that.

## Risks / Trade-offs

- **Ended evidence is thin.** Codex writes nothing on close, so *ended* never shows for it, and a Claude Code session whose transcript holds no `cost-state` line shows none either. The spec allows that on purpose: a wrong *ended* hides a session that waits for the user.
- **Fewer approvals shown.** A long call that does wait on approval reads as running. The signal is explicit (the agent asked for a long timeout), and the permission prompt for such a call is the same one as for any call, so this trades a few missed prompts for far fewer false ones. The 30 s rule still applies to everything else, background calls included.
- **Lane cost by line time.** It depends on the lane's files holding the request lines the `requests` rows came from, with the same times. A lane whose lines were not ingested yet has no entry in `lanes`, and shows no cost, until they are.
- **Grouping moves entries on a state change.** A session finishing its turn jumps from *working* to *your turn*. That is the point of the grouping, and the only movement left.
- **Scroll-to-newest in a middle lane** uses element positions and needs a layout in tests; jsdom has none, so the test drives the handler with stubbed measurements.

## Migration Plan

Payload fields are added (`first_ts`, `lanes`, `long`, `quiet`, a state `ended`); none is removed, and the page and server ship together in one build, so no compatibility window is needed. No rebuild of derived tables: `live_items`, the close line and the lane figures read `raw_lines` on request. Regenerate `web/src/__fixtures__/` after payload changes and commit `src/ai_ledger/web/`.
