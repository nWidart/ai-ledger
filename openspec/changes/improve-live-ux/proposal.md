# Proposal

## Why

A UX review of the Live page against a real store (GitHub issue #7) found ten ways it makes the user read more than they should. With several sessions running, the user has to scan every rail row to find the agent that waits for them. The rail reorders on each write, so a click can land on another session. The stream shows a long `cd` path instead of what a shell call is for, and a subagent lane can bury the main thread. Slow-but-fine shell calls read as "approval?". A closed session looks like "your turn". A paused page still shows a pulsing green dot. The nav's "Last ingest" lags behind a page that updates each second.

None of these is a defect. Each makes the page less useful as the place to watch many sessions at once, which is the reason Live exists.

## What Changes

- **Attention first.** The rail and the wall group sessions by state: approval?, your turn, working (running or thinking), idle, ended. Rail entries and wall tiles show how long the session has been on "your turn" or "thinking". "Your turn" tiles get a border. The browser tab title carries the count of sessions that need the user (approval? plus your turn). There is no desktop notification.
- **Stable rail order.** Inside a state group, sessions keep their order by session start, so an entry moves only when its state changes.
- **Bash description as row text.** A shell call that carries a `description` shows it as the row text. The command stays in the opened row.
- **Lanes.** A finished lane is folded by default. A running lane shows its last 5 rows, with a control to show all. Follow keeps the newest event in view even when it lands in a lane in the middle of the stream. The lane header shows the lane's cost, model and error count.
- **Fewer false "approval?" states.** A shell call with `run_in_background`, or with an explicit timeout above 120 s, reads as running. The server and the page apply the same rule.
- **Stream filters.** Selecting the Errors count filters the stream to failed rows. Two toggles: main thread only (hides lanes), and hide read-only noise (Read, Grep, Glob and their Codex counterparts).
- **Session sheet link and dates.** The stream head links to the session sheet on Activity. Times in the stream include the date when the event is not from today.
- **An "ended" state** for a closed session, distinct from "your turn" and idle. It shows only when the transcript gives evidence of the close.
- **Paused looks paused.** No green dot and no pulsing state dots while paused. When the events stream answers with an HTTP error, the page retries with a backoff and shows "reconnecting".
- **Nav ingest status keeps up with Live.** While Live is open, the nav's "Last ingest" updates when Live receives a change notice, not only on the nav's 60 s poll.

## Capabilities

### Modified Capabilities
- `live-sessions`: the session list carries each session's start; a new *ended* state; shell calls that run long on purpose do not read as *likely waiting for approval*; tool events carry their `detached` and `quiet` flags; the session payload carries each lane's cost and model.
- `live-dashboard`: state groups, durations, tab title count, stable order, row text, lane folding and header, lane-aware Follow, stream filters, session sheet link and dated times, paused look, reconnect with backoff.
- `dashboard-app`: while a Live page is open, the nav's ingest status updates on each change notice.

## Impact

- **Python:** `src/ai_ledger/live.py` (state rule, ended state, list and session payload fields), `store.py` and `codex.py` `live_items` (carry `run_in_background` and the timeout, and the close evidence for *ended*), `categorize.py` if the read-only command list lives there.
- **Web:** `web/src/pages/live/` (LivePage, Stream, Wall, AgentPanel, live.ts, useLive.ts, live.css), `web/src/components/Nav.tsx` and `refresh.ts`, `web/src/api.ts` types. The build in `src/ai_ledger/web/` is regenerated.
- **Fixtures:** `web/src/__fixtures__/` after each payload change.
- **Docs:** `README.md` describes the Live page; it is updated.
- No new tables, endpoints or dependencies. Payload fields are added; none is removed.
