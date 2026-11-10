# Proposal

## Why

Every page today looks back: the store catches up once a minute, and the pages show totals, trends and finished sessions. Nothing shows what an agent is doing right now: which tool is running and for how long, how full its context window is, what a running session has cost so far, or whether it is waiting for the user. That matters most with several sessions running at once, across projects and both sources. The store already ingests incrementally, so it can follow running sessions within seconds.

## What Changes

- **A new Live page** at `/live`, in the shared navigation. It follows the sessions active in the last 10 minutes, from the agent's side. `mockup.html` in this change is the clickable mockup, with synthetic data.
  - **Session rail.** Each active session shows its project, source, cost so far and a state: *running a tool* (with a timer), *thinking*, *your turn*, *likely waiting for approval* or *idle*.
  - **Stream.** The selected session shows its prompts, replies, requests and tool calls as they arrive. Each tool call shows its input summary, how long it took, and whether it passed or failed. A running call shows a timer. A row opens to show the input, the error and the result. Subagent work is grouped in a lane that can be folded. Compactions are marked in the stream.
  - **Agent panel.** For the selected session: what it is doing now, its context window fill with compaction marks, cost, requests, tool calls, errors, cache-read share, tokens per minute, and the source's plan-limit use.
  - **Wall view.** A grid of tiles, one per active session. A tile shows the session's state, its latest action, context fill and cost. Clicking a tile opens that session in the stream.
  - **Follow, Pause and Jump to latest** control scrolling and updates.
- **Full text behind a toggle.** By default the stream shows prompts and replies as word counts, and tool output as a character count. The **Full text** toggle shows them as written. While it is on, the page shows a banner saying that secrets can appear. The server sends text only when the toggle asks for it. The toggle is off on every page load.
- **Inferred states are labelled.** Transcripts record neither a permission prompt nor a request in flight. The states *thinking* and *likely waiting for approval* are inferred from the last lines and are marked as such. A shell call that is still pending after 30 seconds counts as likely waiting for approval.
- **Faster ingest while Live is open.** While at least one Live page is connected, the app ingests transcripts every 2 seconds instead of every 60. It then pushes a "changed" notice naming the affected sessions over Server-Sent Events, and the page fetches what is new. Usage data and plan limits keep their own schedule. With no Live page open, nothing changes.
- **Filters.** Live honours the project, source and automated filters. It ignores the time range, but keeps the range in the URL so other pages get it back.

## Capabilities

### New Capabilities
- `live-sessions`: following running sessions. It covers which sessions count as active, how each session's state is derived and labelled, the stream of events read from the stored transcript lines, the text-on-request rule, and the change notices pushed to open pages.
- `live-dashboard`: the Live page, with its session rail, stream, agent panel, wall view, Follow, Pause and Full text controls, and its filters.

### Modified Capabilities
- `dashboard-app`: Live joins the shared navigation, the served pages and the page titles. The store is kept current every 2 seconds while a Live page is connected.
- `command-palette`: `>` page destinations include Insights, already in the code but missing from the spec, and Live.

## Impact

- `store.py`: `ingest` also returns the ids of the sessions that gained lines, and can skip the usage-data step. A per-source function turns one stored line into display items (prompt, reply, tool use, tool result). The Codex source gets the same function in `codex.py`. No schema change and no `rebuild`.
- New `live.py`: active sessions, derived states, the per-session event list and the agent-panel figures.
- `app.py`: the `/live` page, `/api/live`, `/api/live/session` and the `/api/live/events` SSE stream. A count of connected Live pages switches the ingest interval.
- `web/src`: a page under `pages/live/`, routes in `App.tsx` and `Nav.tsx`, payload types in `api.ts`, the `>live` palette destination, and fixtures in `web/src/__fixtures__/`. `web/dist/` is rebuilt and committed.
- `tests/`: synthetic transcripts that grow during a test; tests for state derivation and the SSE notice.
- `README.md`: the Live page, the Full text toggle and its privacy note.
- No new dependency. SSE runs on the standard library's `ThreadingHTTPServer` and the browser's `EventSource`.
