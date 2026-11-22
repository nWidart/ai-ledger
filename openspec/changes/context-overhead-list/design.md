# Design

## Context

See `proposal.md` for the motivation. The reader has one Claude Code project and asks: what is loaded into every session before I type, which parts can I change, and which single item would save the most if I removed it. Every open choice below is settled from that reader's side.

The decisions fixed by the owner (2026-11-22, accepting the study `.claude/plans/recommendation-treemap-flamechart.md`, section 1): no treemap and no chart library; a nested, ranked HTML list with a bar per row, titled "What loads before your first prompt", in place of "Largest overhead items" in `ContextGrid`; categories ranked by tokens, items under them ranked by tokens with a count and a median, folded after a few rows; "called N times in this view" on each MCP server and skill row, whose name opens its tool sheet; one Claude Code project with a snapshot, else no block, as today.

**Facts checked in the code** (base `e88a6005`):

- `context.overhead(cur, project, source)` (`src/ai_ledger/context.py:606`) returns `None` without a project, for a source other than `""` or `claude`, or without a snapshot; else the latest snapshot of the project (by `ts`, then `uuid`), whatever the range, with `categories` (in `seq` order) and `top`: three lists of the five largest MCP servers (tools summed by `detail`), memory files and skills, each `name IS NOT NULL`. Custom agents are never sent. `payload()` calls it with no view filter.
- `context.payload()` runs about 20 statements with no transaction. `metrics.usage()` wraps its payload in `BEGIN` … `ROLLBACK` in a `finally` (`metrics.py:413`), and `tests/test_metrics.py` proves it with `test_one_snapshot_for_the_whole_payload` (a request committed by another cursor after the first query changes no figure). `insights.py:86` and `limits.py:325` use `BEGIN` for writes.
- The parser (`store.py:560`, `context_usage`) keeps, per item of `contextUsage`, the kind, `name` (`text_or_none`), `detail` (`server_name`, `type` or `source`), and `tokens` through `int_or_none`, which takes any integer, negative included. `CONTEXT_PARTS` (`store.py:740`) lists the fields read. Each part has a `seq`, unique within its snapshot (`PRIMARY KEY (uuid, seq)`).
- The repo's fixture (`tests/fixtures/claude/context-command.jsonl`, Claude Code 2.1.325, trimmed) has these keys per item: MCP tool `name`, `server_name`, `tokens`; memory file `path`, `type`, `tokens`; agent `agent_type`, `source`, `tokens`; skill `name`, `source`, `tokens`. **No item has a loaded or deferred flag.** Only categories carry a `kind` (used, deferred, buffer, free).
- Calls: `tool_calls.mcp_server` is set by all three parsers (Claude Code from the tool name, `name[5:].rsplit("__", 1)[0]` for `mcp__<server>__<tool>`, `store.py:600`; Codex from the item's `server`; Grok from its own field). `tool_calls.skill` is set only by Claude Code's Skill tool (`store.py:601`); Codex and Grok write `None`. The tool sheet counts a subject by `SUBJECTS` (`metrics.py:652`) over `metrics.view()`'s filter, subagents included, every source of the view.
- Readers of `overhead.top`: `context.py` (`OVERHEAD_TOP`), `tests/test_context.py:932-935`, `web/src/api.ts:607`, `ContextGrid.tsx` (`TopItems`), `project.ts` (`GridOverhead.top`, `gridOverhead()`), `project.test.ts:99` and `:114`, `ProjectPage.test.tsx:320-341` and `:425`. No fixture holds a snapshot (`web/src/__fixtures__/context.ts` has `"overhead": null`). Neither the palette nor the Prometheus metrics (`prom.py`) read it. Docs that name "Largest overhead items": `site/…/pages/project.mdx:107`, `improve/lean-context.mdx:41,74,88`, `improve/share-screen.md:45,84`, `reference/glossary.md:239`. `README.md` names it nowhere.
- Both callers already pass the snapshot to `ContextGrid`: `Grids.tsx:38` (`snapshot={d.overhead}`, the Context page with a project) and `blocks.tsx:221` (`snapshot={c.overhead}`, the Project page). Both read `/api/context`; there is one payload shape.
- The app's lists fold with a `<details>` ("Largest overhead items" itself) or a button with `aria-expanded` that stays in place ("Show 3 more" / "Show fewer" in `tips.tsx:43`; "Show all" / "Show fewer" in `activity/tables.tsx:128`, `PREVIEW = 5`). A row that opens a tool sheet calls `openToolSheet(kind, name)` (`components/sheets/session.ts:26`) and carries `subjectAttrs(kind, name)` for the context menu (`activity/tables.tsx:92-93`).
- Ingest and Refresh invalidate every query (`web/src/queries.ts:93`), so the list is always drawn from the same payload as the grid beside it.

**What was measured** (scratch script on the tests' own `Builder` from `tests/test_context.py`, written to a temporary store; deleted after use; no browser):

| Question | Result |
|---|---|
| Today's chunk | `ContextGrid-*.js` 3.68 kB gzip (9.67 kB raw), no limit in `check-bundle.mjs`; `ProjectPage-*.js` 9.4 kB (limit 11), `ContextPage-*.js` 19.5 kB (no limit on main), `index-*.js` 109.9 kB (130). |
| A large snapshot: 300 skills, 60 MCP tools on 6 servers, 4 memory files, 5 agents; 400 sessions and 200,000 tool calls, 10% of them MCP calls and 2% Skill calls | Items query: 369 rows in 0.6 ms. Call counts, one statement: 306 groups in 5.0 ms (median of 7). Today's three `top` queries: 2.7 ms. |
| `overhead` JSON | 1,134 B today; 37,287 B planned (items 26,976 B, calls 9,761 B); 3,213 B gzipped. The app sends JSON uncompressed over the loopback. |
| On the build (`de1513d9`), the same large snapshot with every server and skill called once, 26-character skill names (`plugin-name:skill-name-000`) and 27-character tool names | `overhead` JSON 56,930 B (items 42,010 B, calls 14,611 B); 3,577 B gzipped. The size grows with the names' length; the planned 37.3 KB had shorter names. `ContextGrid-*.js` 6.21 kB gzip (16.65 kB raw). |
| The fixture's numbers | Categories loaded before the first prompt sum to 28,413 tokens (System tools 12,790, Skills 9,357, System prompt 4,107, MCP server instructions 979, MCP tools 619, Custom agents 480, Memory files 81). Items listed: MCP tools 805 (254 + 414 + 137, one server), agents 250 (136 + 114), memory files 81, skills 122 (43 + 40 + 39). |

## Goals / Non-Goals

**Goals:**

- Every item of the snapshot, ranked, under its category, with the words that tell "one big thing" from "many small things".
- For each MCP server and skill, whether Claude Code used it in the view, one Enter from its sheet.
- Nothing drawn that the data cannot back: no child sum longer than its parent, no share of a total it is not part of.
- The first screen of both pages unchanged; no file of `echart-context` edited before it merges.

**Non-Goals:**

- A treemap, an icicle or any drawn chart; ECharts.
- A loaded or deferred flag per MCP tool: the snapshot has none (see Context).
- Measure now on the Context page; it stays on the Project page.
- Overhead per session, or a history of snapshots.
- A "configured but never called" tip, or advice on what to remove.

## Decisions

### 1. A ranked list in the grid's side column, closed by default

The list replaces `TopItems` in `ContextGrid`, in both of its full modes (a typical session's grid, and the snapshot alone when there is no grid). The compact grids of the Context page's small multiples never show it. It is a `<details>` whose `<summary>` names it and gives its total, closed on every load, as the list it replaces.

It sits where `TopItems` sat, last in the side column (`.cg-side`), after the legend. That column is wide enough without a move (read from the CSS, not measured in a browser): in the Project page's left column (about 560px inside the panel at 1240px of page, `base.css` `.wrap`), 360px of cells, a 28px gap and the side column's 16.25rem basis do not fit on one line, so the side column wraps under the cells at the panel's width; on the Context page's full-width panel it sits beside the cells at about 780px; under 40em the grid stacks (`ContextGrid.css`).

Why closed: the summary is one line, as today's was, so the first screen of both pages is unchanged (checked by `tools/demo/firstscreen.mjs` in step 4.1); and the open list shows server names, skill names and memory file paths, which the docs' "Share your screen" page already tells readers to keep folded.

Why not a treemap: two thirds of the fixture's overhead (17,876 of 28,413 tokens: system tools, system prompt, MCP server instructions) has no items; Skills, the large category with items, is about 40 tokens a skill, so a few hundred near-equal cells, which at 343 × 240px are 11px squares with no room for a name. The grid already shows the categories as areas.

### 2. The payload: `items`, `calls` and `before_view` in place of `top`

`overhead` keeps `ts`, `session_id`, `model`, `version`, `window` and `categories`, drops `top`, and gains:

```json
{
  "ts": "2026-11-15T10:42:41.622Z", "session_id": "ad33f29e-…", "model": "claude-fable-5-2", "version": "2.1.325", "window": 1000000,
  "before_view": false,
  "categories": [{ "name": "System prompt", "tokens": 4107, "state": "used" }, "…"],
  "items": [
    { "seq": 13, "kind": "mcp_tool", "name": "mcp__caveman__caveman_retrieve", "detail": "caveman", "server": "caveman", "tokens": 414 },
    { "seq": 12, "kind": "mcp_tool", "name": "mcp__caveman__caveman_compress", "detail": "caveman", "server": "caveman", "tokens": 254 },
    { "seq": 14, "kind": "mcp_tool", "name": "mcp__caveman__caveman_stats", "detail": "caveman", "server": "caveman", "tokens": 137 },
    { "seq": 16, "kind": "agent", "name": "caveman:cavecrew-builder", "detail": "plugin", "server": null, "tokens": 136 },
    { "seq": 17, "kind": "agent", "name": "caveman:cavecrew-investigator", "detail": "plugin", "server": null, "tokens": 114 },
    { "seq": 15, "kind": "memory_file", "name": "/home/dev/.claude/CLAUDE.md", "detail": "User", "server": null, "tokens": 81 },
    { "seq": 18, "kind": "skill", "name": "answer-review-feedback", "detail": "userSettings", "server": null, "tokens": 43 },
    "…"
  ],
  "calls": { "mcp": [{ "server": "caveman", "calls": 12 }], "skill": [{ "name": "babysit-pr", "calls": 3 }] }
}
```

(The snapshot and its items are the repo's fixture; the call counts are made up.)

- `items`: every part of kind `mcp_tool`, `memory_file`, `agent` or `skill`, ordered by tokens (largest first), then by name (no name last), then by `seq`. A NULL name or detail is kept as `null`: the item's tokens count toward its category. A negative token count reads as 0 (`greatest(coalesce(tokens, 0), 0)`); the parser accepts any integer, and a negative item would shrink a sum.
- `seq` is the item's identity: unique within the snapshot, so the web keys rows by it and never by a name.
- `server` is the key the item's calls are stored under, by the parser's own rule: `store.mcp_server_of(name)` for a name of the form `mcp__<server>__<tool>`, else `detail`; `null` for other kinds, or when neither gives one. An empty `detail` is sent as it is (`""`); the web reads an empty name, detail or server as missing. It is sent because the snapshot's `server_name` and the stored calls' server can differ (a plugin's server, for one), and the tool sheet needs the stored key.
- `calls`: `mcp` per server key, `skill` per skill name, each only for keys and names the snapshot holds and only when called; a missing entry is 0. Lists, not objects keyed by name: a skill named `constructor` would otherwise read a function from `Object.prototype` in the web.
- `before_view`: the snapshot was taken before the view's first day (`false` for all time or a NULL `ts`).
- `OVERHEAD_TOP` and `top` go. Every reader is listed under Context; each is updated in step 3.1.

Size and cost (measured, Context): 37.3 KB of JSON and about 6 ms for 300 skills and 60 MCP tools over 200,000 calls, against 1.1 KB and 2.7 ms today. On the build, with longer names (26-character skills, every one called), the same snapshot's `overhead` is 56.9 KB (3.6 KB gzipped): the size follows the names' length. Not capped: a few hundred items is the expected worst case, and a cap would hide exactly the long tail the reader asks about.

### 3. The SQL, in one transaction

`payload()` becomes `BEGIN`; `try: return context_payload(…)`; `finally: ROLLBACK`, as `metrics.usage()` does, so the snapshot, the call counts and every other figure of the Context payload belong to one moment: an ingest that commits while the payload is built changes none of them. The transaction only reads; it takes no lock. `overhead()` takes the view's `W`, `fp` and `start` from `payload()`.

The snapshot (one more column):

```sql
SELECT uuid, ts, session_id, model, version, context_window AS window,
       coalesce(ts < timezone('UTC', CAST(CAST(? AS DATE) AS TIMESTAMPTZ)), false) AS before_view
FROM context_snapshots WHERE project = ? ORDER BY ts DESC NULLS LAST, uuid DESC LIMIT 1
-- params: [start, project]; the day start is metrics.day_start(), as every view filter writes it
```

The items (the four kinds are `OVERHEAD_ITEMS` in `context.py`, bound as parameters):

```sql
SELECT seq, kind, name, detail, greatest(coalesce(tokens, 0), 0) AS tokens FROM context_parts
WHERE uuid = ? AND kind IN ('mcp_tool', 'memory_file', 'agent', 'skill')
ORDER BY tokens DESC, name NULLS LAST, seq
```

The call counts (`overhead_calls()` in `context.py`), one statement for both kinds, skipped when the snapshot has no server key and no skill name:

```sql
SELECT t.mcp_server AS server, t.skill, count(*) AS calls
FROM tool_calls t JOIN sessions s USING (session_id)
WHERE {W('coalesce(t.start_ts, t.end_ts)')} AND coalesce(s.source, 'claude') = 'claude'
  AND (list_contains(?, t.mcp_server) OR list_contains(?, t.skill))
GROUP BY ALL
-- params: fp + [server keys or [""], skill names or [""]]
```

`W` and `fp` are `metrics.view()`'s, as every other count of the payload uses them (`Ctx.calls`, `called_servers`): project, range, automated filter, and the source filter (here `""` or `claude`, since `overhead` is `None` for the others). Python sums the rows into `calls.mcp` and `calls.skill`, keeping only the snapshot's own keys and names, so the `[""]` placeholder (DuckDB cannot type an empty list parameter; `project_match` uses the same one) never counts. Sorted by key for a stable payload.

`store.mcp_server_of(tool)` is the parser's expression at `store.py:600`, moved into a function that both call, so the two cannot drift.

### 4. Which calls count: Claude Code's, in the view

"Called N times" counts the calls Claude Code made in the view: its range and automated filter, main thread and subagents. Not Codex's or Grok's, even in a view of all sources.

Why: the snapshot is Claude Code's configuration, and the reader asks whether to remove a server or a skill from it. A Codex session calling a server of the same name says nothing about whether Claude Code needs it. Subagents count: a server a subagent calls is used. Skills come from one source anyway (only Claude Code records a Skill call). The row names the agent ("by Claude Code"), so nothing claims more.

For a source filter of Codex or Grok, `overhead` stays `None` and the block is absent, as today, so no row ever shows a figure the source cannot have. With the source on Claude Code the figure is the same as with all sources.

The tool sheet a row opens counts every source of the view (`tool_detail`). With all sources selected and a server Codex also calls, the sheet can show more calls than the row. That is the sheet's view of the server, and the row's words say whose calls it counted.

### 5. Items that do not fit their category

Each kind maps to one category by Claude Code's label: `mcp_tool` to "MCP tools", `memory_file` to "Memory files", `agent` to "Custom agents", `skill` to "Skills" (the first category of that name with state `used`). For a category, `listed` is the sum of its items' tokens.

| Case | Fixture | The category row | Its item rows |
|---|---|---|---|
| `listed` ≤ the category's tokens | Skills 122 of 9,357; agents 250 of 480; memory files 81 of 81 | Tokens, share and bar; the count and median line, and the tokens no item lists when there are any ("9.2k tokens not listed by item") | Tokens and a bar on the categories' scale |
| `listed` > the category's tokens | MCP tools: 805 listed, 619 loaded | Tokens, share and bar; the line says the listed tools hold more than the category loads (decision 8) | Tokens, no bar |
| The category is missing, or at 0 | none; possible when every MCP tool is deferred | After the ranked categories, a row under the kind's own name ("MCP tools"), no tokens of its own, no share, no bar; the line says none of them is counted before the first prompt | Tokens, no bar |

Why: the fixture's MCP tools prove that `mcp_tools` lists tools that are not loaded (805 > 619, next to 81,826 tokens of "MCP tools (deferred)"), and the snapshot has no field that says which. Drawing a server's bar longer than its category's, or a share of a total the tool is not part of, would claim what the data does not hold. The tokens stay: they are what the tool costs when it does load, and with "called N times" they still answer "what can I remove". Every item is in the list; none is dropped for not fitting. No loaded flag is invented: if a real snapshot has one, parsing it is a later change (open question 1).

### 6. The web model

`web/src/pages/project/overhead.ts`, pure, no React. Its input is `ContextOverhead`; it reuses `overheadParts()` from `project.ts` (the categories loaded before the first prompt: state `used`, not "Messages", tokens above 0) and `median()` from `format.ts`. Every text of the list is written here, the figures included, so the component only places them. It exports only what `OverheadList.tsx` imports; the rest is module-private.

```ts
const FOLD = 5;                                     // private: fold() writes the fold row's texts
export const FEWER = "Show fewer";
export const STALE = "That was before this view's first day: the configuration may have changed since.";
type ItemKind = "server" | "memory_file" | "agent" | "skill";
export interface LoadTool { key: string; label: string; tokens: number; bar: number | null; figure: string }
export interface LoadItem {
  key: string;            // "i" + seq, or for a server "s" + the seq of its largest tool
  kind: ItemKind; label: string; tokens: number;
  bar: number | null;     // tokens ÷ the largest category's tokens; null in a category that does not fit (decision 5)
  figure: string;         // "312 tokens"
  sub: string | null;     // the line under the name (decision 8)
  toolsLine: string | null;  // a server's tools disclosure, "4 tools, median 410 tokens"; null for other kinds
  path: string | null;    // a memory file's full path
  open: { kind: "mcp" | "skill"; name: string } | null;  // the sheet its name opens; null for files, agents, unnamed or keyless items
  calls: number | null;   // Claude Code's calls in the view; null where not counted (files, agents, unnamed skills, keyless servers)
  tools: LoadTool[];      // a server's tools, ranked; [] for other kinds
}
export interface LoadCategory {
  key: string;            // "c" + its index among overheadParts(); "k" + kind for a kind with no category
  name: string; tokens: number | null; share: number | null; bar: number | null;
  fit: "none" | "nested" | "over" | "uncounted";  // none: no items
  figure: string;         // "12.8k tokens, 45%", or "not counted"
  line: string | null;    // the count and median line (decision 8)
  items: LoadItem[];
}
interface LoadList { total: number; summary: string; categories: LoadCategory[]; measured: string; stale: boolean }
export function loadList(o: ContextOverhead): LoadList | null;
export function fold<T extends { tokens: number }>(rows: readonly T[]):
  { head: T[]; rest: T[]; restTokens: number; more: string | null; all: string | null };  // more: "209 more, 8.4k tokens"; all: "Show all 214"
function calledText(n: number): string;            // private
```

- **Categories**: `overheadParts(o)` ranked by tokens, ties in snapshot order; `share` = tokens ÷ `total` (their sum); `bar` = tokens ÷ the largest category's tokens. Then one category per kind that has items and no category (`fit: "uncounted"`), in the order MCP tools, Memory files, Custom agents, Skills.
- **Servers**: MCP tools grouped by `server`; tools with no `server` form one group, "Unknown server". A server's tokens are its tools' sum, its label the first non-null `detail` of its tools, else its key. Servers rank as items do, by tokens then label; "Unknown server" has no label, so it comes last among equals. Two servers with the same label each read "label (call key)", such as "github (plugin_gh_github)" and "github (github)". Tools ranked as items are; a tool's label is its name without the `mcp__<server>__` prefix, else its name.
- **Memory files**: the label is the file name (the last part of the path, either separator), the path is kept whole in `path`, and `sub` is the type and the folder. Two `CLAUDE.md` files in different folders are two rows with two keys and two folders. A file at the root (`/CLAUDE.md`) has the folder `/`.
- **Calls**: `calls.mcp` and `calls.skill` read into `Map`s; a missing key is 0.
- **Missing and odd values**: an empty string (name, detail, server, model) counts as missing. A negative or NaN token or call count reads 0.
- **Labels for a missing name**: "Unnamed tool", "Unnamed file", "Unnamed agent", "Unnamed skill". Such an item opens nothing and has no call count.
- `summary` is the disclosure's text, `measured` the heading line and `stale` is `before_view` (the component appends `STALE`; decision 8).
- `null` when there is neither a category nor an item.
- Keys are a letter and a number from the payload (`seq`, an index), never names joined by a separator.

### 7. The fold

A list of items (a category's items, or a server's tools) of more than `FOLD + 1` (6) rows shows its first 5 and folds the rest into one row: "209 more, 8.4k tokens" with a button "Show all 214"; expanded, the rest show and the same button reads "Show fewer". Six rows or fewer show whole: a fold row would take the place of the one row it hides. Five, as `PREVIEW` in `activity/tables.tsx`.

`fold()` is pure and in the model, and writes the fold row's two texts; the state (the set of expanded lists, by the list's key, for one snapshot: its `session_id` and `ts`) is the component's. A refetch of the same snapshot keeps every fold; a new snapshot starts with every list folded. The categories themselves never fold: there are at most seven, plus up to four uncounted kinds.

### 8. The words

The total, the shares and the tokens use `big()` (as the grid's legend: "12.8k"), shares `share()` from `context.ts` ("45%", "0.3%"), counts `plural()` and `num()`, the time `when()`. All follow the browser's locale.

- **Shares at the ends.** A share above 0 that `share()` would write as "0.0%" (under 0.05%) reads "<0.1%"; a share under 1 that it would write as "100%" (99.5% or more) reads ">99%".
- **One token.** A figure that `big()` writes as "1" reads "1 token"; every other "N tokens".
- **Missing time or model.** With no `ts` the heading line starts "Measured." (or "Measured with \<model>."); with no model it has no "with" clause.

**The summary and the heading line**

| Where | Text |
|---|---|
| Summary | "What loads before your first prompt · 28.4k tokens" |
| First line, open | "Measured Nov 15, 10:42 AM with claude-fable-5-2. Ranked by tokens; each share is of the 28.4k." |
| Without a model | "Measured Nov 15, 10:42 AM. Ranked by tokens; each share is of the 28.4k." |
| Measured before the view's first day | the first line, then "That was before this view's first day: the configuration may have changed since." |
| With only uncounted kinds (no category above 0) | Summary "What loads before your first prompt", and the first line ends "No category of this snapshot loads tokens before the first prompt." in place of the shares sentence |

**A category row**: its name, then "12.8k tokens, 45%", and its bar. An uncounted kind: its name, then "not counted", no bar.

**A category's line** (under its name; none without items):

| Kind | One | Several | Tokens not listed by item (`nested`, `listed` < tokens) |
|---|---|---|---|
| Skills | "1 skill" | "214 skills, median 40 tokens" | appends "; 9.2k tokens not listed by item" |
| Memory files | "1 memory file" | "2 memory files, median 900 tokens" | the same |
| Custom agents | "1 agent" | "2 agents, median 125 tokens" | the same |
| MCP tools | "1 server, 1 tool" | "3 servers, 41 tools, median 1.6k tokens a server" ("1 server, 3 tools" with one server: no median of one) | the same |
| `over` | "The 3 tools listed hold 805 tokens, more than the 619 this category loads: some are not loaded before the first prompt, and the snapshot does not say which." With one item: "The 1 tool listed holds …". Memory files, agents, skills: "files", "agents", "skills". When the two figures read alike in `big()` (1,290 and 1,260 are both "1.3k"), both are written in full with `num()`. | | |
| `uncounted` | "3 tools listed, 805 tokens; this snapshot counts none of them before the first prompt." (one: "1 tool listed, 414 tokens; …") | | |

The median is `median()` of the rows at that level (servers, not tools, for MCP tools), written with `big()`; it is left out for one row.

**An item row**: its name, then "312 tokens", its bar (or none, decision 5), and its line:

| Item | Line |
|---|---|
| MCP server | "called 12 times by Claude Code in this view", then the tools disclosure "4 tools, median 410 tokens" ("1 tool"). Its name is the server's label, or "label (call key)" when another server reads alike |
| Unknown server | "4 tools, median 410 tokens", then "The snapshot names no server, so its calls cannot be counted." |
| A tool (inside the disclosure) | none; its tokens and its bar |
| Skill | its source when it has one ("userSettings · "), then the call text |
| Unnamed skill | its source, if any; no call text |
| Memory file | its type and folder: "Project · /home/dev/code/foo/sub1"; the type alone for a path with no folder; the folder alone with no type; the type alone for an unnamed file |
| Agent | its source ("plugin"), or none |

The call text: "not called by Claude Code in this view", "called once by Claude Code in this view", "called 12 times by Claude Code in this view" (`calledText`).

**The fold row**: "209 more, 8.4k tokens" and the button "Show all 214"; expanded, only the button, "Show fewer".

### 9. Disclosure, Enter, focus and the screen reader

- **Markup.** `<details class="ol">` → `<summary>`; the heading line; an `<ol>` of categories, each `<li>` holding its row and, when it has items, an `<ol>` of items. A server's tools are a `<details>` in its row ("4 tools, median 410 tokens" as the summary) holding an `<ol>`. Ordered lists: the order is the ranking.
- **One sentence a row.** Each row's text, in DOM order, reads as one sentence: "Skills, 9.4k tokens, 33%, 214 skills, median 40 tokens." The bar is `aria-hidden`. Nothing is said only by a bar or a color.
- **Buttons only where a row does something.** `OverheadList({ snapshot, onOpen })` takes the opener as a prop, so the component does not import the sheets; `ContextGrid` passes `openToolSheet`. With `onOpen`, the name of an MCP server row with a key, and of a named skill row, is a `<button class="linkish">` that calls `onOpen("mcp", server)` or `onOpen("skill", name)` and carries `subjectAttrs` of the same kind and value, so the context menu works on it as on Activity's tables. Without `onOpen` no name is a button. Enter, Space or a click on the name opens the sheet. Categories, memory files, agents, tools and keyless or unnamed items are text, and the fold rows' buttons and the tools disclosures are the only other controls.
- **Focus.** The fold button is the same element in both states, at the end of its list, so it keeps the focus when it expands or folds the list; `aria-expanded` says which, and `aria-controls` names the list. Closing a tool sheet returns the focus as the sheet already does.
- **Named lists.** Each `<ol>` is labelled (`aria-labelledby`): the categories by the summary, a category's items by its name, a server's tools by its name and its tools line. Ids come from `useId()` and the model's keys.
- **A new snapshot.** The categories' `<ol>` takes the snapshot (`session_id` and `ts`) as its React `key`, so a new snapshot of the same project closes every server's tools disclosure and every fold, while the outer `<details>` stays open. Another project on the Context page closes the list too (decision 13).
- **No live region.** Nothing changes without the reader's action: a refetch after Refresh or Measure now redraws in place, and the Block around it already marks itself busy.
- **The memory file's folder** is in its line, with its type, so it is read and seen without a hover. The file name keeps the full path as its `title` for the pointer. Nothing else has a `title`.

### 10. The bar and the narrow layout

`OverheadList.css`, imported by `OverheadList.tsx` and so bundled with `ContextGrid`. Its own custom properties on `.ol`, none added to `theme.css`:

The rules as built (abridged; spacing and type sizes are `theme.css`'s existing tokens):

```css
.ol { --ol-bar: var(--series-1); --ol-item: color-mix(in srgb, var(--series-1) 55%, var(--surface-1)); container-type: inline-size; }
.ol-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(4rem, 9rem) max-content; column-gap: var(--space-4); align-items: baseline; }
.ol-name { grid-column: 1; grid-row: 1; min-width: 0; overflow-wrap: anywhere; }
.ol-fig { grid-column: 3; grid-row: 1; font-variant-numeric: tabular-nums; }
.ol-track { grid-column: 2; grid-row: 1; block-size: .5rem; align-self: center; }
.ol-bar { display: block; block-size: 100%; inline-size: max(1px, calc(var(--w) * 100%)); background: var(--ol-bar); }
.ol-items .ol-bar { background: var(--ol-item); }
.ol-line { grid-column: 1 / -1; min-width: 0; font-size: var(--fs-xs); color: var(--text-muted); overflow-wrap: anywhere; }
@container (max-width: 24rem) {
  .ol-row { grid-template-columns: minmax(0, 1fr) max-content; }
  .ol-fig { grid-column: 2; }
  .ol-track { grid-column: 1 / -1; grid-row: 2; }
}
```

- **DOM order is reading order.** In the DOM the figure comes before the bar, so a row reads name, figure, line; the grid places the bar between name and figure on screen. Hidden `", "` separators (`.sr`) make each row one sentence for a screen reader.

- `--w` is the row's `bar` (0 to 1), set inline as the grid's cells already are. A row with no bar renders no track. A bar of 0 tokens renders no track either; every other bar is at least 1px (`max(1px, …)`), and its figure is beside it in words.
- One scale for every bar: the largest category's tokens. An item's bar is then never longer than its category's (in a category that fits), and a 40-token skill beside 12.8k of system tools is the sliver it is.
- **Narrow.** The container query is in `rem`, so at 32px text the bar drops under the name at a proportionally wider box. In a 343px box at 16px text the list is about 311px wide, under 24rem (384px): the bar sits on its own line under the name and the figure. In the Project page's left column (about 560px) the row is one line; at 32px text there (560px is under 24rem of 32px, 768px) it is two. Names and lines wrap anywhere; no row scrolls sideways.
- `ContextGrid.css` loses its `.cg-top` rules; the list's rules are all in `OverheadList.css`.
- Items are indented by `--space-7` (16px; `--space-6`, 12px, in the narrow layout); a server's tools by as much again.

### 11. Forced colors, dark and motion

- **Forced colors.** `@media (forced-colors: active) { .ol-bar, .ol-items .ol-bar { forced-color-adjust: none; background: CanvasText; } .ol-track { border: 1px solid CanvasText; } }`. Every bar, category or item, is the system text color; it is told by its length and its track's border, not by a hue. Buttons and summaries take the system's colors.
- **Dark.** `--series-1`, `--surface-1` and `--text-muted` carry both schemes; the item tint is mixed from them.
- **Reduced motion, and in every mode.** Nothing animates: no transition on the bars, and `<details>` opens at once.

### 12. Empty and odd cases

| Case | The list |
|---|---|
| No snapshot, no project, a Codex or Grok source | Absent, as today (the Project page keeps Measure now) |
| A snapshot with no category above 0 and no item | Absent |
| Categories and no item | The categories only |
| One item | One row, no fold, no median ("1 skill") |
| A category at 0 tokens with items | Its items under the kind's name, `uncounted` |
| One giant category and many tiny items | Each tiny bar 1px; the count and median line says it ("214 skills, median 40 tokens") |
| A negative token count | Read as 0 by the server; the web reads a negative or NaN token or call count as 0 too |
| A NULL or empty name | "Unnamed skill" (or tool, file, agent), counted in its category, opening nothing |
| A NULL or empty detail | No source or type in the line; an MCP tool keyed by its name's prefix, else "Unknown server", last among servers of equal tokens |
| Two memory files with one file name | Two rows, each with its folder |
| Two servers with one label | Each reads "label (call key)" and opens its own key's sheet |
| A name that is a property of `Object.prototype` | Counted from a `Map`: 0 unless called |
| A snapshot older than the view | The heading line says so (decision 8) |
| No `ts` or no model | "Measured." with no date, and no "with" clause (decision 8) |
| The same snapshot refetched after Refresh | Redrawn in place; the disclosure, every fold and every tools disclosure keep their state |
| A new snapshot of the same project (Measure now) | The disclosure stays open (same element); every fold and every server's tools close (decision 9) |
| Another project selected on the Context page | A new grid: the list draws closed (decision 13) |

### 13. Place and pages

- **Project page.** In the Context block, the grid's side column, after the legend (or after "Measured overhead" in the snapshot-alone mode), where "Largest overhead items" was (decision 1). Measure now stays under the block's figures, below the grid; a measurement refetches the payload and the list shows the new snapshot.
- **Context page.** On Overhead and pressure, with one project selected, in the one full grid (`Grids.tsx` → `ContextGrid`). With no project selected there is no full grid and no list, as today.
- `Grids.tsx` changes by one line: the one full `ContextGrid` takes `key={d.project}`, so selecting another project mounts a new grid and its list draws folded again (decision 1: closed, for screen sharing). The Context page keeps the previous payload while the next loads, so without the key the grid stays mounted and the open list would carry over to the other project. A new snapshot of the same project keeps the grid and the open list (decision 12). `blocks.tsx`, `ContextPage.tsx` and `sections.tsx` do not change.

### 14. Bundle

`ContextGrid-*.js` is its own chunk (3.68 kB gzip), shared by the Context and Project pages. The list adds an estimated 2 to 2.5 kB (a model of about 120 lines and a component of about 100; the study's estimate was 1 to 2 kB). **As built** (`de1513d9`, against its base `b414d690`): `ContextGrid-*.js` 6.21 kB gzip (16.65 kB raw; 3.68 kB at the base), `ProjectPage-*.js` 9.48 kB (9.47), `ContextPage-*.js` 19.55 kB (19.54), `index-*.js` 347.59 kB raw at both, 111.41 kB gzip (111.40), `echarts-*.js` the same file (179.09 kB gzip). Step 4.2 adds `ContextGrid: 8` to `LIMITS` in `web/scripts/check-bundle.mjs`, so a later heavy import into the shared grid fails the check. That file is `echart-context`'s until it merges, so the step waits for it. `index-*.js` and `echarts-*.js` must not change.

### 15. Tests, the browser check and the images

| Where | What | Catches |
|---|---|---|
| `tests/test_context.py`, `OverheadTest` | The existing snapshot test asserts `items` in place of `top` (order, `seq`, `server`, a negative count at 0, a NULL name kept, agents present, `top` gone); a new test for the counts (calls of two servers and a skill across Claude Code main and subagent, Codex and Grok, inside and outside the range, an automated session); a new test that the payload is one snapshot (`test_one_snapshot_for_the_whole_payload`, as in `test_metrics.py`); `before_view` added to the latest-snapshot test | Decisions 2 to 4 |
| `tests/test_derive.py`, `ContextSnapshotTest` | `test_a_snapshot_tool_and_its_calls_have_one_server_key`: a `/context` line and its session's calls ingested, a tool whose `server_name` differs from its prefix and a plugin's server; each item's `server` equals the stored calls' key and its calls count | The risk of step 1.1: the snapshot's server and its calls drifting apart |
| `web/src/pages/project/overhead.test.ts` | Ranking and shares on the fixture's numbers; servers grouped by key and labelled by detail; every line of decision 8, singular and plural; `nested`, `over` and `uncounted`; the fold at 6 and 7 rows; two `CLAUDE.md` files; labels of NULL names; a skill named `constructor` | Decisions 5 to 8 |
| `web/src/pages/project/OverheadList.test.tsx` | What a user reaches: closed summary; opened rows in rank order as text; a server name opens its sheet (URL gains `mcp=`), a skill name its skill sheet; files and agents have no button; Show all and Show fewer keep the focus on the button and flip `aria-expanded`; an `over` category's items have no bar; the before-view sentence | Decision 9, the wiring of the model |
| `ProjectPage.test.tsx` | The existing snapshot test asserts the summary and one opened server row in place of "Largest overhead items"; the snapshot-alone test asserts the summary | The Project page's place |
| `pages/context/Grids.test.tsx` | The existing one-project test gets a snapshot, asserts the summary, and that another project's list draws closed | The Context page's place, decision 13's key |

Net test lines, estimated: Python 70, model 120, component 90, pages 15, removed `top` assertions −15: about 280, under the 400-line advice. **As built: 447** (472 added, 25 removed; `verification.md` gives the split). Over the advice because the model's tests carry the rules this design left open and the build settled (shares at the ends, one token, figures that read alike, empty strings, NaN, two servers of one label, "Unknown server" last), one table-driven case per line of decision 8, and the ingest-to-payload test of the server key.

**What only a browser shows** (step 4.1, a throwaway Playwright script in the builder's scratchpad, no `tools/demo/chartfit/` module: there is no chart to fit): at 1440px, a 375px window and 1280px at 32px root text, the page does not scroll sideways and every row ends inside its column; in a 343px box at 16px and at 32px text the bar sits under the name; a 40-token row's bar is 1px wide and present; under forced colors each bar is `CanvasText` and its track has a border; dark and light; Enter on a server name opens the tool sheet and on a skill name the skill sheet, and closing either brings the focus back; Show all keeps the focus; `node tools/demo/firstscreen.mjs` passes unchanged. The script answers `/api/context` with the demo payload changed where a case needs it (300 skills, the fixture's overflowing MCP tools, a long path, a 0-token category with items). The run's fifteen lines, at `ea8ae5b4`, are in `verification.md`.

**Images.** The `project-context` shots (and their `-light` twin) show the old summary line; `node tools/demo/record.mjs shots project` records the Project page's shots again on the demo store. The disclosure stays closed in them, as on load. The `project-layout` shots crop above the list, so they did not change and were not recorded again. No Context shot shows the list (`context-grids` is the small multiples), so no Context shot changes, and `record.mjs` and the shots' `README.md` are not edited. The README GIFs do not change.

## Risks / Trade-offs

- **The MCP list includes tools that are not loaded, and the store cannot tell which.** → Decision 5: no bar, the words say so, the tokens stay. Open question 1.
- **A snapshot's server or skill name may not match the name its calls are stored under** (plugins). → The server key comes from the tool name by the parser's own rule. Skills have no such rule: a plugin skill whose snapshot name differs from its Skill call's `skill` input reads "not called". Open question 2.
- **The Context payload's transaction now spans every query.** → Read-only, no lock, the pattern `usage()` uses; the ingest's writes go on. `payload()` must not be called inside another transaction (DuckDB refuses a nested `BEGIN`): `app.py` gives each request a fresh cursor, and no test opens one.
- **37 KB more JSON for a large configuration.** → Loopback only, about 6 ms; fetched once per view.
- **The list repeats the categories the grid's legend already lists.** → The legend gives each category's share of the window; the list ranks them by share of the overhead and puts the items under them, and it is closed until asked for.
- **The row and the sheet can disagree** on a server's calls with all sources selected (decision 4). → The row says "by Claude Code".

## Open Questions

1. **A loaded flag.** The repo's fixture is a trimmed real snapshot and shows no loaded or deferred field per MCP tool. On a copy of your own store, does a recent `/context` line's `contextUsage.mcp_tools[]` carry one (such as `isLoaded` or `deferred`)? If it does, a later change parses it, and decision 5's "over" case becomes exact nesting.
2. **Plugin names.** On a copy of your store, does a plugin skill's name in `contextUsage.skills[]` equal the `skill` input of its Skill calls (both `plugin:skill`, say)? And does a plugin MCP server's `server_name` match the `mcp__<server>__` prefix of its tools? If the skill names differ, those rows read "not called" when they were called.
