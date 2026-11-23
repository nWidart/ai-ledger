# Design

## Context

See `proposal.md` for the motivation. What the code does today, checked at `eccf0ffc`:

- **Subagents are lanes of their parent session.** Claude Code's `subagents/agent-<id>.jsonl`, a Codex thread whose `session_meta` names another session, and a Grok child session named by a `subagent_spawned` line are all stored under the parent's `session_id` with `raw_lines.subagent = true` (`Source.placement`). A lane's id comes from its file path (`Source.lane`).
- **Lanes exist only in one session's events.** `live.session()` gives each event its `lane`, and the tool call that started a subagent names it in `agent` (`started_by`, `spawned`). The page builds lanes from the events it holds (`lanesOf` in `web/src/pages/live/live.ts`). The active list (`live.sessions()`, `LiveListSession`) carries nothing of subagents.
- **The derived tables know no lane.** `tool_calls` and `requests` have a `subagent` flag only. `live.lanes()` finds a lane's cost by joining requests to raw lines on their time. Codex `spawn_agent` calls have no `tool_calls` row at all: `CodexDeriver` derives calls from `item_completed` items, and a spawn is not one.
- **Lanes are flat, but the lines know the parent.** A subagent can start a subagent. In a sample of 2,000 `agent-*.meta.json` files, one has `spawnDepth: 2`; its `toolUseId` names a call in the parent subagent's file. In all three sources the line that names a new subagent is written in the file of the thread that started it: Claude Code's `Agent` result (`toolUseResult.agentId`), Codex's `SubAgentActivity` start item, Grok's `spawn_subagent` result.
- **Delegation calls.** In 266 `mcp__t3-code__delegate_task` calls of the local transcripts (keys read, no content): the input always has `title`, `task` and `role`; `target` holds `providerInstanceId` and `model` in 182, only `options` or nothing in the rest. 259 calls set no `mode`, so they run async. The Claude Code result line carries `mcpMeta.structuredContent` with `status`, `model`, `providerInstanceId`, `taskId` and `childThreadId`. In a second, larger sample, 184 of 185 such results say `starting` or `running`, and one says `completed`, for a `mode: "wait"` call. The parent's transcript then says nothing more of the task in 180 of 181 cases: one session called `task_status`.
- **The list is polled often.** The page asks for `/api/live` after every change notice, at most one request at a time, and every 10 seconds. It is asked for by the rail, the Wall and the Stream view.
- **`add-tool-filter`** is a parked change with only a proposal. It adds a page-wide tool filter to Activity, Cost, Errors and perhaps Limits, through a shared hash key. It does not name Live, and its tentative deltas are for `usage-dashboard`, `cost-dashboard`, `dashboard-app` and `tool-inspector`. No spec overlaps. In code both changes touch `web/src/api.ts`; the Tree's `view` and `layout` are Live's own search keys, not shared ones, and the new `tool_calls` columns do not change what a tool filter would query.

## Goals / Non-Goals

**Goals:**

- One place, across sessions, that shows which agents are at work under which parent.
- Exact parents. A node stands under another only when a transcript line says so.
- No extra work for the rail, the Wall and the Stream view.
- The same derived shape for Claude Code, Codex and Grok.

**Non-Goals:**

- Linking a delegation to the session it started. The child session stays a root. No T3 Code database is read, and no session is matched by time or folder: the research showed false matches.
- Following a delegated task after its call returned. `task_status`, `task_cancel` and `t3_background_wait` results are not read: they are rare (one task in 181), and a status that is right for one node in 181 would make the other 180 look checked.
- Nesting lanes in the Stream. The stream keeps its flat lanes, and a nested lane's header there still names no starting call (`lanesOf` ties a lane to a main-thread call only).
- Full text in the Tree, type-ahead in the Outline, drag, zoom or pan in the Org chart, and a remembered layout outside the URL.
- A link from the session sheet's "Tool calls by thread" to the Tree.

## Decisions

### 1. The store names the thread of each call and request, and keeps one record per spawn call

Three additions to the derived tables, filled by all three derivers:

- `tool_calls.lane VARCHAR` and `requests.lane VARCHAR`: the lane id of the subagent file the line came from (`SOURCES[source].lane(path)` when the deriver's file is a subagent's), NULL for the main thread. A Claude Code main-file line with `isSidechain` keeps `subagent = true` and no lane, as it has no file of its own.
- A new derived table, in `DERIVED`:

  ```sql
  CREATE TABLE IF NOT EXISTS spawns (
    call_id VARCHAR PRIMARY KEY, session_id VARCHAR, kind VARCHAR,  -- 'subagent' or 'delegation'
    lane VARCHAR,          -- the thread that made the call; NULL: the main thread
    tool VARCHAR, description VARCHAR, start_ts TIMESTAMP,
    agent VARCHAR,         -- kind subagent: the lane the call started, once a line names it
    provider VARCHAR, model VARCHAR, status VARCHAR);  -- kind delegation
  ```

  A deriver adds a row when it reads a spawn call (`Agent`, `Task`, `spawn_agent`, `spawn_subagent`) or a `mcp__t3-code__delegate_task` call, and sets `agent`, or `provider`, `model` and `status`, when it reads the line that states them. Both go through one upsert (`ON CONFLICT (call_id) DO UPDATE SET col = coalesce(excluded.col, spawns.col)`), so the two lines can arrive in either order and in different ingests. `description` is the label the agent gave the call (`input.description`, Codex `task_name`, Grok `rawInput.description`, the delegation's `title`), cut to 300 characters when stored: the Tree never shows more, and the store should not hold a second copy of long text. The prompt and the `task` are not stored here.

Per source:

| | spawn call | names the subagent | delegation input | delegation result |
| --- | --- | --- | --- | --- |
| Claude Code | `tool_use` named `Agent` or `Task` | the result line's `toolUseResult.agentId` | the `tool_use` input | the result line's `mcpMeta.structuredContent` (`status`, `model`, `providerInstanceId`) |
| Codex | `response_item` `function_call` named `spawn_agent` (a new branch in `CodexDeriver.add`; it adds no `tool_calls` row) | the `SubAgentActivity` start item (`id`, `agent_thread_id`) | the `McpToolCall` item's `arguments` | read from the item only where it states a status; else none |
| Grok | `tool_call` named `spawn_subagent` | the `tool_call_update` whose `rawOutput` is `SubagentCompleted` | `rawInput.tool_input` of the `use_tool` call | as Codex |

`GrokDeriver.adopt` moves a child's `tool_calls` to its parent; it also moves the child's `spawns` rows, and sets `lane` to the child's id on the moved rows that have none.

A parent is then one lookup: the parent of lane L is the `lane` of the `spawns` row whose `agent` is L.

*Why not read it all at request time?* The list would have to read every line of every active session's subagent files on each poll to count calls per lane. A column makes it one grouped query.

*Why not `agent` and `description` columns on `tool_calls`?* Codex spawn calls have no `tool_calls` row, and adding one would change the tool counts of every page.

*Why not a `parent_lane` column per lane?* The line that names a subagent is the same line that says which call started it. Keeping the call gives the parent, the name and the description at once.

*Why not read `agent-<id>.meta.json` at ingest?* A rebuild must work from the stored lines alone (`transcript-store`), and Claude Code deletes those files. Live already reads them at request time for running subagents (`started_by`); decision 3 reuses that.

### 2. The list carries the agents only when asked, as one flat list per session

`GET /api/live?agents=1` adds two fields to each session:

```ts
interface LiveAgent {
  id: string;                    // a lane id, or a delegation's call id
  kind: "agent" | "delegation";
  parent: string | null;         // a lane id; null: the main thread
  name: string;                  // the starting call's tool, else "Subagent"; a delegation's tool
  description: string | null;    // at most 300 characters
  status: "running" | "done" | "pending" | "started" | "failed";
  start: Ts | null; end: Ts | null;
  tools: number | null; errors: number | null; cost: number | null;  // null for a delegation
  model: string | null; provider: string | null;                      // provider: a delegation's
}
// on LiveListSession, only with agents=1:
agents?: LiveAgent[]; agents_more?: number;
```

Without `agents=1` the answer is what it is today, to the byte: the rail, the Wall and the Stream view pay nothing. The page asks with `agents=1` only in the Tree view, under a query key of its own.

The list is flat and names parents, and the page builds the tree. A nested payload would need the server to decide where an orphan goes and would make the cap (below) cut subtrees; a flat list leaves one rule on the page: a node whose parents do not lead to the session stands under the session. That rule also ends a cycle, should bad data hold one.

With `agents=1` the list does three more grouped queries over the active sessions, each filtered by `list_contains(?, session_id)` as `figures()` is: calls per lane (`count`, failed, first and last time, any pending), requests per lane (cost through the price CTE, newest model, first and last time), and the `spawns` rows joined to `tool_calls` for the call's end and failure. No line's text is read.

**Limit.** At most 200 agents per session (`AGENTS_CAP`): those not finished first, then the finished, newest start first; `agents_more` counts the rest. 200 nodes of about 250 bytes keep one busy session near 50 KB.

*Why not a new endpoint?* The Tree needs the sessions and their states too. A second endpoint would be a second request per notice, answered at another moment than the list, and a second place to apply the filters.

*Why not always send the agents?* A session with 100 subagents would add about 25 KB to every poll of every Live view, to draw a rail that shows none of it.

### 3. Status rules live in `live.py`, next to the state rules

For a subagent, in this order:

1. Its file holds turn marks (Codex, Grok): `done` when its newest mark is a turn end, else `running`. The marks come from the rows `recent()` already reads for the session's state, which hold each subagent file's newest mark whatever its age.
2. Its starting call is known: `done` when that call has ended, else `running`. For Codex and Grok, and for a finished Claude Code subagent, the call is the `spawns` row. For a running Claude Code subagent no line names it yet: `started_by()` reads `agent-<id>.meta.json` for the subagent files among the session's recent rows, as it does for the stream, and gives the call's id.
3. Neither: `done` once no call of its is pending and its newest call or request is older than `IDLE` (5 minutes). About 3% of the sampled meta files name no `toolUseId`; without this rule such a subagent would read as running for as long as its session is listed.

Rules 1 and 2 are the stream's own (`live-dashboard`, "Tell when a lane is finished"), now also told by the app. The page keeps `lanesOf` for the stream; the two cannot share code across Python and TypeScript, as `likelyWaiting` already cannot.

For a delegation: `pending` with no result, `failed` when the call failed, `done` when the stored status is `completed`, else `started`. `started` is all the transcript supports: the call returns at once and nothing later says the task ended. The page says so in the node's hover text and accessible name.

`live.lanes()` (a lane's cost and model in `/api/live/session`) changes to read `requests.lane`, so a lane's header and its Tree node cannot disagree. Its payload and its tests stay as they are.

### 4. URL state

- `view=tree` joins `view=wall`; any other value is the Stream.
- `layout=org` selects the Org chart; absent is the Outline. It is valid only with `view=tree`: `validateSearch` drops it otherwise.
- `session` stays the selected session, as on the Wall, and the Tree marks that session's node as current. There is no key for a focused node or for folds.
- Selecting a node sets `session` and clears `view` and `layout` in a new history entry, so Back returns to the Tree in its layout. Switching the layout replaces the entry, as pinning does.

### 5. One model, two renderers

`web/src/pages/live/tree.ts` (no React) turns the list into what both layouts draw:

- `groupSessions()` gives the roots, as for the rail and the Wall.
- Per session, the agents become a tree by `parent`. Children are ordered by `start`, then `id`.
- A node is *over* when it is a done subagent with no child that shows, or a delegation that is done, failed, or whose call returned more than 10 minutes ago. The 10 minutes are a rule about clutter, not about the task: an orchestrator session would otherwise show every delegation it ever made, since none ever reads as done. The node keeps its "started" label inside the fold.
- Under each parent, the nodes that are over go into one fold node, placed last. Its label counts by kind: "4 finished subagents", "1 finished subagent, 1 earlier delegation".
- Fold state is `Map<nodeKey, boolean>` in `LivePage` state, beside `LaneChoices`: fold nodes default to closed, every other node to open. It is shared by both layouts, kept while the page is open, and not stored.

`Outline.tsx` and `OrgChart.tsx` draw that model. Neither computes order, folds or labels, so a rule is tested once, in `tree.test.ts`.

### 6. Outline

One `role="tree"` per state group, labelled by the group's `h2`, with a roving `tabindex` (one tab stop per group; the session the URL names, else the first row). Rows are `role="treeitem"` with `aria-level`, `aria-posinset`, `aria-setsize` and, with children, `aria-expanded`; children sit in `role="group"`. Keys follow the ARIA tree pattern: Up, Down, Left, Right, Home, End, Enter and Space. A row's accessible name is a screen-reader-only sentence built from the node, as the Wall's `tileText` is, with the drawn glyphs hidden.

Columns line up through a CSS grid on the tree with `subgrid` rows: state, name and description, tools, errors, duration, cost, model. Below 721 pixels a row is two lines and the indent drops from 24 to 12 pixels.

*Why one tree per group, not one tree?* A tree cannot hold headings, and the groups are headings everywhere else on Live. The cost is one tab stop per group, five at most.

### 7. Org chart

Nested `<ul>`/`<li>` per session, each card a `<button>`. Connectors are CSS borders on pseudo-elements, so they are not in the accessibility tree and need no `aria-hidden` nodes. Two arrangements of a parent's children, chosen by a class:

- **Row**: children side by side under the parent, joined by a horizontal rail. Used when the parent shows 5 children or fewer and the page is 721 pixels wide or more.
- **Column**: children stacked, each joined to one vertical line from the parent. Used for 6 or more, and for every parent below 721 pixels.

The chart sits in a box with `overflow-x: auto`. No library, no canvas, no measuring in JavaScript: the layout is the DOM's, so the screen-reader order and the tab order are the visual order. Keyboard use is Tab between buttons; arrow keys are the Outline's.

*Why not SVG?* Cards hold text that wraps and updates every second. In SVG that needs measured boxes, and a second, hidden structure for screen readers.

### 8. Opening a node in the Stream

`LivePage` gets one `reveal` value: `{ lane?: string; call?: string }`, set by a Tree node and consumed once by `Stream` after the session's events arrive.

- Session node: `pick(id)` as today (Follow on), focus on the stream's heading, as Open in Stream does.
- Subagent node: `pick(id)`, set that lane's fold to open in `LaneChoices`, `reveal = { lane }`. `Stream` scrolls the lane's header into view, focuses it and turns Follow off.
- Delegation node: `pick(id)`, open the fold of the lane that made the call, if any, `reveal = { call }`. `Stream` finds the tool row by the call's id, scrolls it into view and focuses it, Follow off. It does not open the row's detail.
- When the events held do not include the lane or the call (it is older than the 500 loaded), `reveal` is dropped and the stream opens as for a session node.

### 9. Updates

The Tree view runs `useLive` with no selected session and no pins, as the Wall with none pinned, and with `agents: true`, which goes into the list's URL and its query key. Notices, the 10-second recheck, Pause and the hidden tab work through the same code paths. `useNow` drives the running durations.

Focus is kept by key: a node's DOM id is its node key, and after a render that removed the focused element the page focuses the element with the same key, else the fold node that now holds it, the way `LivePage` already refocuses a rail entry that changed group.

## Risks / Trade-offs

- **A store that was not rebuilt has no lanes for old lines.** → Live lists only sessions active in the last 10 minutes, so only sessions that span the upgrade are affected: their earlier subagent calls are missing from the Tree until a rebuild. The changelog and the upgrade page say to run `ai-ledger rebuild` once.
- **`requests.lane` changes how a lane's cost is found.** A request row is written once, by the first file derived that holds its id. → Claude Code and Codex write a request in its own thread's file only; a forked Codex thread's copied history is the case to check (task 1.6). The existing lane cost tests in `tests/test_live.py` must pass unchanged.
- **A running Grok subagent stands under its session until its call returns.** Grok names the child only in the `spawn_subagent` result. → Accepted, as the stream has the same limit today; the node moves under its parent when the result arrives.
- **A Claude Code background `Agent` call returns at once**, so its subagent reads `done` while it works, as its lane does in the stream. → Accepted: one rule for both views. The session's own state still reads thinking ("Keep a session working while a subagent works").
- **"started" tells little.** → It is labelled as such, with the reason on the node. Folding after 10 minutes keeps old ones out of the way.
- **Codex and Grok delegation results may state no status.** → The node then reads "started" once the call returned, which is true. Task 1.5 reads the keys of a real line before writing the parser.
- **Two layouts are two things to keep accessible.** → All rules sit in `tree.ts`; each renderer has one structure test.
- **Deep or wide charts scroll sideways inside their box.** → The Outline is the default and never scrolls sideways.

## Migration Plan

1. `open_store` adds the two columns with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` and creates `spawns` through `DERIVED_SCHEMA`. An older store opens and works; new lines fill the new fields.
2. `ai-ledger rebuild`, with the app stopped, fills them for stored lines. It is optional for Live and noted in `CHANGELOG.md` and the upgrade page.
3. Rollback: an older version ignores the new columns and table. Nothing else in the store changes.
