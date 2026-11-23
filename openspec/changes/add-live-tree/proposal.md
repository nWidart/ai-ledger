# Proposal

## Why

Live shows what each session does, but not who works for whom. A session that runs six subagents, or hands tasks to other agents through T3 Code, reads as one rail entry and one tile; its subagents show only as lanes inside its own stream, one session at a time. A user who orchestrates agents cannot see, across sessions, which agents are at work, under which parent, and what each has cost.

## What Changes

- Live gets a third view, **Tree**, next to Stream and Wall. Its roots are the active sessions, grouped by state as the rail and the Wall are; under each session stand its agents.
- A subagent stands under the thread that started it, so a subagent's own subagent is nested one level deeper. A subagent whose starting call is not known stands under its session.
- A delegation call (T3 Code's `mcp__t3-code__delegate_task`) shows as a child node of the thread that made it: its title, its target provider and model, and what the call's result says of it. The node does not link to the child session, which stays a root of its own. The app reads no third-party database, and matches no session by time or folder.
- Tree has two layouts behind a toggle: **Outline**, an indented tree read with the arrow keys, and **Org chart**, one top-down diagram of cards per session with connectors from parent to children.
- Each node shows its state, name, description, tool calls, duration, cost, model and errors, as far as the app knows them.
- Finished subagents are folded under one row per parent, such as "4 finished subagents". Running ones show.
- Selecting a node opens its session in the Stream view; a subagent node opens it with that subagent's lane unfolded.
- Tree offers no Full text, as the Wall: no prompt or reply text, and descriptions cut to 300 characters.
- `/api/live` gives each session's agents to a request that asks for them (`agents=1`). The rail, the Wall and the Stream do not ask, so their requests stay as they are.
- The store records, for each tool call and request, the subagent thread that made it, and one record per call that starts a subagent or delegates a task. An existing store gains them empty; `ai-ledger rebuild` fills them for the lines already stored.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `live-dashboard`: the Tree view, its two layouts, its folds, its keyboard and screen-reader structure, and how a node opens the Stream; the URL keeps the Tree and its layout; Full text stays the Stream view's.
- `live-sessions`: the active list gives each session's agents on request: subagents with their parent thread, state and figures, and delegation calls with their target and status.
- `transcript-store`: derived calls and requests name the subagent thread that made them; the store keeps one record per call that starts a subagent or delegates a task.

## Impact

- `src/ai_ledger/store.py`, `codex.py`, `grok.py`: two new columns (`tool_calls.lane`, `requests.lane`) and one new derived table (`spawns`), filled by all three derivers in the same shape. `ai-ledger rebuild` fills them for stored lines.
- `src/ai_ledger/live.py`, `app.py`: `/api/live` takes `agents=1` and adds `agents` and `agents_more` to each session. A subagent lane's cost and model read the new column.
- `web/src/api.ts`, `queries.ts`, `web/src/pages/live/`: the Tree view (shell, Outline, Org chart), its URL keys (`view=tree`, `layout=org`), and the handoff to the Stream.
- `web/src/__fixtures__/`: the Live fixtures regenerate, with one new fixture for the list with agents.
- `README.md`, `CHANGELOG.md`, `site/src/content/docs/pages/live.mdx` and the keyboard page.
- `tools/demo/seed.py` (optional): a session with nested subagents and a delegation call.
- No new dependency. No change to `/api/live/session`'s shape, to `/metrics`, or to any other page.
