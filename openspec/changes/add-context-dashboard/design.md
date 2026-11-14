# Design

## Context

See proposal.md, "Why". What the store holds today, and what the page leans on:

- `requests` (one row per API response): `session_id`, `ts`, `model`, `subagent`, `input`, `output`, `thinking`, `cache_read`, `cache_5m`, `cache_1h`, `speed`. A request's **prompt tokens** are `input + cache_read + cache_5m + cache_1h`: what the model read, which is the context size at that request. `metrics.requests_cte` already derives per-request cost, the kind costs and the flags `lg` (priced on the long-prompt tier) and `fst` (fast mode).
- `sessions`: `compactions` (a count), `peak_context` (the largest main-thread prompt), `peak_model`, `source`. Activity resolves a session's window as `prices[peak_model]["context"]` (`metrics.sessions`), and Live as `live.window_of`: the Codex turn's `model_context_window` when stated, else the price table. `prices.json` has `context: null` for the OpenAI models, so today Codex sessions get no window on Activity.
- `tool_calls`: `tool`, `mcp_server`, `input_summary`, `start_ts`, `end_ts`, `subagent`, `result_file`, `result_seq`. The result's text is in `raw_lines` only. Live shows its length (`chars`) by replaying lines, which is fine for one session and far too slow for a view.
- Compaction times live in `raw_lines` only (`live.compactions` replays one session's lines). The per-session count is derived.
- Filters: `metrics.view(project, range_days, prices, today, automated, source, user_projects)` returns `start, pcte, pparams, fp, W, rq, rp`: `W(ts)` is the session-scope and range predicate over an alias `s` of `sessions`, `fp` its params, `rq` the requests CTE text and `rp` its params. Every page query goes through it, and `metrics.automated_file()` is read once per payload.
- Pages: `web/src/pages/<page>/<Page>Page.tsx`, with `Filters`, `useApi(url)`, `useLanding`, `SectionIndex`, `Drawer`, `Ledger`/`LedgerRow`, `InsightCard` (`Sev` is `good | warn | critical | info`) and `UsageSheets` (the project, tool and session sheets driven by the `inspect`, `tool`/`mcp`/`skill` and `session` hash keys). Insights keeps drill-down filters as page-only hash keys (`drill.ts`).
- The Codex fixtures hold no `response_item` output lines; the CLI's completed items carry a command's `aggregated_output` and an MCP call's `result.content`. A `task_started` event carries `model_context_window` (258,400 and 475,000 in the fixtures).

## Goals / Non-Goals

**Goals:**
- Every Context figure comes from derived tables and the price table, in queries of the same shape and cost as Activity's. No per-page replay of `raw_lines`.
- Both parsers fill the same columns, and `rebuild` gives the same rows as ingest.
- Tip rules are a table of named constants a reader can check against the spec.
- The page reuses the filter, sheet, ledger, drawer and card components; nothing new in `components/`.

**Non-Goals:**
- Reading `CLAUDE.md`, `AGENTS.md`, `.mcp.json` or any settings file. Nothing on the page knows what is configured, only what the transcripts record.
- Counting the bytes of a tool's **input**, of prompts, or of the system prompt. The page measures results and token counts.
- A context figure on the Live page, the session sheet or Activity. Live keeps `window_of` as it is; a later change can read `sessions.context_window` there.
- Image results: a `tool_result` image block counts nothing.
- Grok. `add-grok-source` is in flight; whichever merges second makes `GrokDeriver` write the three columns (NULL where Grok gives nothing).

## Decisions

### D1. Three derived columns, not one

The user approved `tool_calls.result_bytes`. Two more make the page possible without replaying `raw_lines` per view:

| Column | Type | Claude Code | Codex | On conflict (a later chunk of the same session) |
| --- | --- | --- | --- | --- |
| `tool_calls.result_bytes` | `BIGINT` | `len(text_of(block["content"]).encode("utf-8"))` of the `tool_result` block | `CommandExecution`: `len(aggregated_output.encode())`; `McpToolCall`: `len(text_of(result["content"]).encode())` when `result` is a dict with `content`, else `len(json.dumps(result).encode())` when `result` is not None; `FileChange`, `WebSearch`: `NULL` | set with the result, as `end_ts` |
| `sessions.context_window` | `BIGINT` | `NULL` | `payload.model_context_window` of each `event_msg` `task_started` (an int) | `coalesce(excluded.context_window, sessions.context_window)`: newest turn wins, as `live.window_of` |
| `sessions.first_compaction_ts` | `TIMESTAMP` | `ts_of(d["timestamp"])` of the first `system` / `compact_boundary` line | `store.ts_of(d["timestamp"])` of the first `compacted` line | `least(sessions.first_compaction_ts, excluded.first_compaction_ts)` (DuckDB's `least` skips NULLs, as `first_ts` relies on) |

Alternatives: (a) read compaction times and Codex windows from `raw_lines` at query time with `contains(json, …)` over the view's sessions: a scan of the largest table on every page load, growing with history; Live does it for one session only. (b) A `compactions` table with one row per compaction: more than the page needs (it uses the first one), and a fourth place to keep in shape across sources. (c) Keep `peak_context / prices.context` alone: leaves every Codex session without a window, since `prices.json` has none for OpenAI models.

`DERIVED_SCHEMA` gains the columns. `open_store` adds them in place, as `speed` was: `ALTER TABLE tool_calls ADD COLUMN IF NOT EXISTS result_bytes BIGINT`, `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS context_window BIGINT`, `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS first_compaction_ts TIMESTAMP`. They are NULL until `rebuild`.

### D2. How the parsers fill them

**Claude Code (`store.Deriver`).**
- `user()`: the `results[tool_use_id]` dict gains `bytes=len(text_of(x.get("content")).encode("utf-8"))`. `text_of` joins the `text` of the content's dict blocks (a string content is itself), so an image block adds nothing.
- `tool_row()` appends `r and r["bytes"]` as the row's last value. `flush_tools` appends `"result_bytes"` to `cols`; since `done` rows are built from `row[7:12] + row[15:]` and updated through `cols[7:12] + cols[15:]`, a result that arrives in a later ingest than its call carries its size with no further change.
- `add()`: in the `compact_boundary` branch, `s["first_compaction"] = min(s["first_compaction"] or ts, ts)` when `ts` is set. `session()` initialises `first_compaction=None, window=None`.
- `flush()`: the sessions insert gains `context_window` and `first_compaction_ts`, with the conflict clauses of D1.

**Codex (`codex.CodexDeriver`).**
- `item()`: `self.results[tid]` gains `bytes=result_bytes(it)`, a module function: `aggregated_output` for `CommandExecution`, the result text for `McpToolCall` as in D1, `None` otherwise.
- `add()`: `event_msg` / `task_started` with an int `model_context_window` sets `s["window"]`; the `compacted` branch sets `s["first_compaction"]` as Claude's does. Both go through the same `session()` dict, so `Deriver.flush` writes them.

Grok (if present first): `GrokDeriver` writes `bytes=None` and leaves `window` and `first_compaction` `None` until someone maps them.

### D3. Where the code goes

- `src/ai_ledger/context.py`: `payload(cur, project="", range_days=0, source="", automated=False, today=None, prices=None)` and the pieces below. It imports `metrics` for `view`, `requests_cte`, `price_cte`, `rows`, `iso`, `day`, `week`, `day_start`, `median`, `project_list`, `project_order`, `automated_file`, `with_titles`, `titles`, `NEAR_LIMIT`, `IDLE_GAP_S`, `TOKEN_KINDS`, `PRICE_KINDS`. Tip rules are plain functions in the same module, `RULES: tuple[Rule, ...]` in fixed order; nothing else imports them.
- `src/ai_ledger/app.py`: `elif url.path == "/api/context": self.json(context.payload(app.con.cursor(), q.get("project", ""), int(q.get("range") or 0), q.get("source", ""), automated=q.get("automated") == "1"))`, and `/context` in `PAGES`. A bad source or range raises `ValueError`, which the handler already turns into a 400.
- `web/src/pages/context/`: `ContextPage.tsx` (sections, tips, the sessions drawer), `GrowthChart.tsx` (the curve, SVG as `WorkChart`/`CostChart`), `context.ts` (pure helpers: fill-bin labels, tip card mapping, byte and estimate formatting), `context.css`, `ContextPage.test.tsx`, `context.test.ts`.
- `web/src/api.ts`: the types of D9 and `contextUrl = (v: View) => \`/api/context?${qs(viewQs(v))}\``.
- `web/src/App.tsx`: `"/context": { title: "Context · AI Ledger", Page: ContextPage }`. `web/src/components/Nav.tsx`: `{ path: "/context", label: "Context" }` after Cost. `web/src/components/palette/resolve.ts`: `"/context"` in `HOSTS_SHEETS` (the page list comes from `Nav.PAGES`). `web/src/hash.ts`: `tip` is a page-only key (nothing to add to `HEAD`/`TAIL`; it is written with `push: true` so Back closes it).

### D4. The view's sessions and turns (the CTEs every section shares)

All SQL uses `metrics.view(...)` and names below. `start, pcte, pparams, fp, W, rq, rp = view(...)`.

```sql
-- sess: the sessions in the view (a request in range), with their window.
sess AS (
  SELECT s.session_id, s.project, coalesce(s.source, 'claude') AS source, s.first_ts, s.compactions, s.peak_context,
         s.first_compaction_ts, coalesce(s.context_window, p.context) AS window
  FROM sessions s LEFT JOIN price p ON p.model = s.peak_model
  WHERE s.session_id IN (SELECT DISTINCT session_id FROM rq)),
-- turns: every main-thread request of those sessions (the whole session, not only the range), numbered.
turns AS (
  SELECT r.session_id, r.ts, r.model, r.input + r.cache_read + r.cache_5m + r.cache_1h AS prompt, r.cache_read, r.input,
         row_number() OVER (PARTITION BY r.session_id ORDER BY r.ts, r.message_id) AS turn
  FROM requests r JOIN sess USING (session_id)
  WHERE NOT r.subagent AND r.ts IS NOT NULL AND r.input + r.cache_read + r.cache_5m + r.cache_1h >= 2000),  -- START_MIN_TOKENS
-- starts: one row per session with a turn.
starts AS (SELECT session_id, prompt AS start_prompt, ts AS start_ts FROM turns WHERE turn = 1)
```

`rq` is `requests_cte(pcte, W("r.ts"))`, so `price` is in scope. The `>= 2000` filter is `START_MIN_TOKENS`: Claude Code writes small main-thread requests (a few hundred prompt tokens, no system prompt) around a turn; a request that small did not carry the session's context. A session whose every request is smaller has no turns and no starting context. Alternative: take the first request regardless. Its median would be right but its 10th percentile would be the side requests. Task 2.6 checks the constant against a copy of the real store and records what the small requests are.

"Whole session" is deliberate: a session is in the view when it has a request in the range, and its start, growth and compaction are facts about the session, as Activity's peak context and compactions are whole-session figures.

### D5. Starting context

- Per project and for the view: `quantile_cont(start_prompt, 0.5)`, `quantile_cont(start_prompt, 0.1)`, `quantile_cont(start_prompt, 0.9)`, `count(*)` over `starts JOIN sess`. The median is the typical start. The 10th percentile approximates the fixed overhead (system prompt, tool definitions, MCP schemas, `CLAUDE.md`): the sessions with the smallest first prompt start with almost nothing but overhead, while the median also carries pasted text and resumed or forked sessions, which start large. Both are shown; the tip uses the median, since a project whose typical session starts large pays for it every time.
- `window_share`: `quantile_cont(start_prompt / window, 0.5)` over the sessions with a window, per project and for the view.
- `window` per project: the window of the most sessions in the project (`mode(window)`), null when none has one. It labels the share.
- Trend: `week(first_ts)` of the session (`metrics.week`), `quantile_cont(start_prompt, 0.5)` and `count(*)` per week, for the view, weeks with a session only.

### D6. Growth

- Curve: from `turns`, for `turn <= 100` (`GROWTH_MAX_TURN`): `quantile_cont(prompt, 0.5)`, `quantile_cont(prompt, 0.25)`, `quantile_cont(prompt, 0.75)`, `count(*)` grouped by `turn`, keeping rows with `count(*) >= 5` (`GROWTH_MIN_SESSIONS`). The view curve, and one curve per project for the 5 projects with the most sessions in `sess` (`GROWTH_PROJECTS`), computed with `GROUP BY project, turn` and cut in Python.
- Added per prompt: per session, `sum(greatest(prompt - lag(prompt) OVER (PARTITION BY session_id ORDER BY turn), 0))` over `turns`, divided by the session's prompts (`prompts` table, the whole session; sessions with 0 prompts are left out). The median per project and for the view. A fall (compaction, or a model switch that counts tokens differently) adds nothing, so the figure is what the user's prompts and the tool results they cause put in.
- To the first compaction, over `sess` rows with `first_compaction_ts IS NOT NULL`: turns before it are `count(*) FROM turns WHERE ts < first_compaction_ts`; active minutes are the sum of the gaps `<= IDLE_GAP_S` between consecutive events (main-thread requests and tool calls, as `metrics.active_cte`) with `t < first_compaction_ts`, divided by 60. Build it as `active_cte` does with the extra bound, in `context.py`, not by changing `active_cte`. Medians per project and for the view, with the count of compacted sessions.
- Fill: over `sess` with a window, `floor` of `peak_context / window` into the bins `FILL_BINS = (0.25, 0.5, 0.75, 0.9)`: five counts, `[<25%, 25–50%, 50–75%, 75–90%, ≥90%]`, grouped by `window`. A share over 1 (a misresolved window) lands in the last bin.

### D7. What fills context

Over `tool_calls t JOIN sessions s USING (session_id) WHERE W(coalesce(t.start_ts, t.end_ts))` (the view's calls, as Activity's tool tables):

- `tools`: `WHERE NOT t.subagent`, `GROUP BY tool`: `count(*) AS calls`, `count(result_bytes) AS with_bytes`, `sum(result_bytes) AS bytes`, `quantile_cont(result_bytes, 0.5) AS p50_bytes`, `max(result_bytes) AS max_bytes`, ordered by `bytes DESC NULLS LAST`. `est_tokens = bytes // 4` (`BYTES_PER_TOKEN`) in Python. Subagent calls (`Agent`, `Task`, `spawn_agent`) are ordinary tools here: their result is the report the main thread read.
- `mcp`: the same with `mcp_server IS NOT NULL` grouped by `mcp_server`.
- `main_bytes`, `subagent_bytes`: `sum(result_bytes) FILTER (WHERE NOT subagent)`, `… FILTER (WHERE subagent)`. Subagent bytes never entered the main context; the page shows them beside the main figure with that sentence.
- `largest`: the 25 (`LARGEST_RESULTS`) main-thread calls by `result_bytes DESC, tool_use_id`, with `tool_use_id AS id`, `session_id`, `project`, `source`, `tool`, `mcp_server`, `left(input_summary, 200) AS input`, `result_bytes AS bytes`, `coalesce(start_ts, end_ts) AS ts`; titles via `metrics.with_titles`.
- Coverage: `count(*)` and `count(result_bytes)` over the view's calls, both threads.

### D8. Cost and cache breaks

- From `rq` (all requests in range, both threads, as the Cost page): per project and for the view, `sum(cost)`, `sum(cost_cache_read) AS cache_read_cost`, `sum(cost) FILTER (WHERE lg) AS long_cost`, `count(*) FILTER (WHERE lg) AS long_requests`, `sum(cache_read)`, `sum(input + cache_read + cache_5m + cache_1h) AS prompt_tokens`, `cache_hit_ratio = cache_read / prompt_tokens`. `sum` over only-NULL costs is NULL, which the page shows as unknown.
- Cache breaks, over `turns` with `lag(model)`, `lag(ts)` per session: a break is `turn > 1 AND prompt >= 20000 AND cache_read < 0.5 * prompt` (`CACHE_MIN_PROMPT`, `CACHE_BREAK_SHARE`). Cause: `model <> prev_model → 'model_switch'`; else `date_diff('second', prev_ts, ts) > 300 → 'expired'` (`CACHE_TTL_S`: the 5-minute cache lifetime; OpenAI's cache also clears after minutes of inactivity, so the same rule stands for Codex and the page says it is a lifetime, not a measurement); else `'other'` (a changed system prompt or tool set, a `/clear`, an edited earlier message). Per session: `breaks`, `model_switch`, `expired`, `other`, `uncached_tokens = sum(input)` over the break turns, and the cost of those turns' input (`sum(cost_input)`, joined from `rq` on `message_id`; null when unpriced). `breaks`: the 25 sessions with the most uncached tokens; `break_sessions`: how many sessions have one.

### D9. The payload

`/api/context` takes `project`, `range`, `automated` (`1`), `source`, as `/api/usage`. Types as they go in `api.ts`:

```ts
export interface ContextPayload {
  project: string; range: number; automated: boolean; source: Source | ""; start: Day | null; end: Day;
  projects: string[]; project_order: string[]; automated_file: AutomatedFile;
  /** How much of the view the new columns cover; rebuild_needed when any call lacks a size or any compacted session lacks a first compaction. */
  coverage: { sessions: number; with_window: number; calls: number; with_bytes: number; compacted: number; with_first_compaction: number; rebuild_needed: boolean };
  starting: {
    sessions: number; median: number | null; p10: number | null; p90: number | null; window_share: number | null;
    by_project: { project: string | null; sessions: number; median: number; p10: number; p90: number; window: number | null; window_share: number | null }[];
    trend: { week: Day; median: number; sessions: number }[];
  };
  growth: {
    curve: GrowthPoint[];
    by_project_curves: { project: string | null; sessions: number; curve: GrowthPoint[] }[];
    added_per_prompt: number | null;
    by_project: { project: string | null; sessions: number; added_per_prompt: number | null; compacted: number; turns_to_compaction: number | null; minutes_to_compaction: number | null }[];
    to_compaction: { sessions: number; turns: number | null; minutes: number | null };
    /** Five counts per window: <25%, 25–50%, 50–75%, 75–90%, ≥90% of the window. */
    fill: { window: number; sessions: number; bins: [number, number, number, number, number] }[];
  };
  fills: {
    main_bytes: number; subagent_bytes: number;
    tools: FillRow[]; mcp: FillRow[];
    largest: { id: string; session_id: string; title: string | null; project: string | null; source: Source; tool: string; mcp_server: string | null; input: string; bytes: number; est_tokens: number; ts: Ts | null }[];
  };
  cost: {
    cost: number | null; cache_read_cost: number | null; long_cost: number | null; long_requests: number; cache_hit_ratio: number | null;
    by_project: { project: string | null; cost: number | null; cache_read_cost: number | null; long_cost: number | null; long_requests: number; cache_hit_ratio: number | null; prompt_tokens: number; cache_read: number }[];
    break_sessions: number;
    breaks: { session_id: string; title: string | null; project: string | null; source: Source; breaks: number; model_switch: number; expired: number; other: number; uncached_tokens: number; cost: number | null }[];
  };
  tips: Tip[];
}
export interface GrowthPoint { turn: number; median: number; p25: number; p75: number; sessions: number }
/** name: the tool, or the MCP server. est_tokens is bytes / 4, an estimate. */
export interface FillRow { name: string; calls: number; with_bytes: number; bytes: number; est_tokens: number; p50_bytes: number | null; max_bytes: number | null }
export type TipId = "large_start" | "frequent_compactions" | "near_limit" | "large_results" | "cache_breaks" | "long_tier";
export interface Tip {
  id: TipId; severity: "warn" | "critical"; title: string;
  evidence: { label: string; value: string }[];
  advice: string;
  /** The newest 20 matching sessions; matched is how many there are in all. */
  sessions: { session_id: string; title: string | null; project: string | null; source: Source; first_ts: Ts | null }[]; matched: number;
}
```

Numbers are tokens unless the name says bytes, dollars (`cost`), minutes or a ratio. `null` means unknown (no data, no price, no window), never zero. `project` is `null` for sessions with no project, shown as "(no project)" as elsewhere.

### D10. Tip rules

One tip per rule, at most. Rules run in this order; the payload sorts by severity (critical first), then this order. Every threshold is a module constant in `context.py`:

| id | Fires when | Severity | Evidence | Advice | Matching sessions |
| --- | --- | --- | --- | --- | --- |
| `large_start` | a project in `starting.by_project` has `median >= START_LARGE_TOKENS` (30,000) | warn | per such project: median, p10, window share; the MCP servers called in those projects in the view with call counts, fewest first (from `fills.mcp` restricted to those projects) | Trim `CLAUDE.md`/`AGENTS.md` and the files they import; review the project's MCP servers, since every server's tool schemas are in every prompt. Servers configured but never called leave no trace in transcripts, so the list shows only the ones that were called: compare it with your `.mcp.json` or `claude mcp list`. | `starts` with `start_prompt >= START_LARGE_TOKENS` in those projects |
| `frequent_compactions` | a session in `sess` has `compactions >= COMPACTIONS_MANY` (3) | warn; critical when a session has `compactions >= COMPACTIONS_CRITICAL` (6) | sessions matched, most compactions in one session, median turns and active minutes to the first compaction (from `growth.to_compaction`) | Start a new session or `/clear` between tasks; `/compact` before the context fills, while the summary is still cheap; hand bulk reading to a subagent so it compacts there, not in the main thread. | `compactions >= COMPACTIONS_MANY` |
| `near_limit` | a session in `sess` with a window has `peak_context / window >= NEAR_LIMIT` (0.8, `metrics.NEAR_LIMIT`) | critical | sessions matched, the highest share, the windows involved | Start the next task in a new session; the last 20% of the window costs the most and compacts the worst. | `peak_context / window >= NEAR_LIMIT` |
| `large_results` | a main-thread call in the view has `result_bytes >= RESULT_LARGE_BYTES` (100,000) | warn; critical when one has `result_bytes >= RESULT_HUGE_BYTES` (400,000) | count of such results, their summed estimated tokens, the tools and MCP servers that produced them with counts | per tool present among them: `Read` with `offset` and `limit`; shell output through `head`, `tail` or `grep`; `Grep`/`Glob` with `head_limit` or `-l`; MCP tools with a page size; bulk reading delegated to a subagent, which returns a short report. Only the lines for tools present are shown. | sessions holding such a result |
| `cache_breaks` | a session in `cost.breaks` has `breaks >= CACHE_BREAKS_MANY` (2) | warn | sessions matched, breaks by cause summed over them, their uncached tokens and cost, the view's `cache_hit_ratio` | when `model_switch` is the largest cause: keep one model through a session, since a switch rereads the whole context uncached and writes a new cache. When `expired` is: turns more than 5 minutes apart reread the context; that is the cache lifetime, not a mistake, and the figure is what it costs. Otherwise: something in the prompt before the cached part changed (system prompt, tool set, an edited message). | sessions with `breaks >= CACHE_BREAKS_MANY` |
| `long_tier` | `cost.long_cost >= LONG_TIER_MIN_USD` (1.0) and `long_cost / cost >= LONG_TIER_SHARE` (0.10) | warn | long cost, its share, long requests, the `long_above` threshold of each model with long-tier requests (from the price table) | `/compact` or start a new session before the prompt passes the model's threshold: every token of the request is priced higher once it does. | sessions with a request where `lg` |

Evidence values are preformatted strings on the server (`"42,000 tokens"`, `"24%"`, `"$10.20"`), so the page shows them as given and the fixture pins them. Sessions are the 20 newest (`TIP_SESSIONS`) by `first_ts`, with `matched` the full count.

Why these thresholds: 30,000 starting tokens is about 15% of a 200K window, past what a bare system prompt and tool set take; 3 compactions in one session means the session outgrew its window three times; 80% is Activity's near-limit line, reused; 100,000 bytes is about 25,000 estimated tokens in one result, a tenth of a 200K window; 2 breaks in a session is a pattern, one is an accident; $1 and 10% keep the long-tier tip from firing on cents. They are constants so the user can change them in one place.

### D11. The page

Order, each a `section` or `Drawer` with an id for the `SectionIndex`: lede (one sentence: the view's median start, its window share and how many sessions compacted), rebuild notice when `coverage.rebuild_needed`, Tips (InsightCards; `warn` and `critical` map to `Sev`; the tip's sessions count is the card's action), Starting context (ledger per project with median, p10 and share; trend as a small bar chart), Growth (`GrowthChart`: the view's median curve with a p25–p75 band and the project curves in project colours; the added-per-prompt and to-first-compaction figures as tiles; the fill histogram as one row of five bars per window), What fills context (two ledgers: by tool and by MCP server, an estimate badge on every token figure, the subagent bytes sentence, the largest results as a table with a session button), Cost (a table per project, and the cache-break sessions as a table). `UsageSheets` hosts the sheets, with the payload's `top_sessions`/`sessions` fields absent: pass `data={undefined}` and let `sessName` learn titles from the rows the page renders.

Drill-down: a tip's action writes `tip=<id>` (push). The Context page reads it and opens a `Drawer` under the tips, "Sessions matching <title>", listing `tip.sessions` with `openSessionSheet`. Back or the drawer's close clears the key. A `tip` value that names no tip in the payload shows nothing.

Phrasing: the page never says "Claude" for figures of every source (dashboard-app, "Describe agent work without naming one agent"); the tips name `CLAUDE.md` and `AGENTS.md` together, and `/compact`, `/clear` as commands both CLIs have.

## Risks / Trade-offs

- [`START_MIN_TOKENS` misclassifies a real first turn on a tiny prompt with a tiny system prompt (a bare Codex run with no `AGENTS.md`)] → Codex first turns carry the environment context and tool schemas, well over 2,000 tokens in the fixtures (12,267 uncached input alone). Task 2.6 checks the distribution of first-request sizes on a store copy; if the smallest real turns sit under 2,000, lower the constant before the change archives. The spec names the value. Checked on a copy of the real store (1,202 sessions): the first main-thread request of every Codex session is 15,570 tokens or more (median 26,977); the first main-thread request of a Claude Code session is under 2,000 tokens in 25 of 3,423 sessions, and each of those 25 has no larger main-thread request at all: one-off helper sessions (model `claude-sonnet-5-5`, stop reason `end_turn`, an average of 24 output tokens, 573 to 1,617 prompt tokens), not a turn that carried context. No session starts with a small request and goes on to a large one, and no later main-thread request has between 2,000 and 4,999 prompt tokens, so 2,000 stays.
- [Resumed and forked sessions start large and pull the median up] → the 10th percentile is shown next to it, and the design says what each means. Not a correction, a second figure.
- [`result_bytes` counts the stored text; Claude Code truncates very long results before storing them] → the figure is what the model saw after the truncation, which is what fills the context. The design says "as stored".
- [Three columns NULL until rebuild, so a fresh upgrade shows a half-empty page] → `coverage.rebuild_needed` and the notice; the CHANGELOG entry starts with the rebuild instruction, as 0.3.0's does.
- [A per-view `quantile_cont` over `turns` of every session in an all-time view] → `turns` is a filtered scan of `requests` (indexed by session through the join), the same size as Activity's `sessions()` query; the all-time view on the real store is the acceptance check (task 2.7, under 1 s).
- [`model_switch` also catches a Codex turn whose model name changed only in version string] → it is a switch: the cache is per model. The evidence shows the cause counts, not a verdict.
- [Codex's `aggregated_output` may be the CLI's truncated view, not what the model read] → the item is what the transcript holds; the spec says "as the transcript stores it", and the Codex spec names the field.

## Migration Plan

1. Opening the store adds the three columns (NULL). No line is re-read.
2. `ai-ledger rebuild` (app stopped) fills them. Until then the page shows the notice and the figures over known rows.
3. Rollback: an older app ignores the extra columns and the `/context` route is a 404; the frontend build of the older version has no Context tab.
