// Payload types, written by hand from metrics.py (src/__fixtures__/ holds real payloads from the test fixture, and
// api.test.ts checks them against these types). Costs are null when no model in the group is priced.
// Timestamps: iso() fields read "2026-11-04T10:01:00.000Z"; the few raw datetimes (error loops, commits) come through
// json.dumps(default=str) as "2026-11-04 10:01:00", in UTC without a zone.

export type Day = string; // YYYY-MM-DD
export type Ts = string;

export interface Tokens {
  input: number; output: number; thinking: number; cache_read: number; cache_5m: number; cache_1h: number;
}

export interface Totals extends Tokens {
  tokens: number; cost: number | null; requests: number; main_requests: number; sub_tokens: number; sub_cost: number | null;
  thinking_ms: number; active_days: number;
  calls: number; errors: number; commits: number; test_runs: number; tests_passed: number; tests_failed: number; main_calls: number;
  prompts: number; interrupted: number; error_loops: number; sessions: number;
  cache_hit_ratio: number | null; write_1h_share: number | null; subagent_token_share: number | null; subagent_cost_share: number | null;
  tokens_per_prompt: number | null; cost_per_prompt: number | null; turns_per_prompt: number | null; tool_calls_per_prompt: number | null;
  interruption_rate: number | null; tokens_per_commit: number | null; cost_per_commit: number | null; errors_per_100_calls: number | null;
  session_seconds: number; median_session_seconds: number | null; near_limit: number;
}

export interface DailyRow extends Tokens { day: Day; cost: number | null; unpriced: number }
export interface DailyProjectRow { day: Day; project: string | null; cost: number | null; tokens: number }
/** Work per day: sessions with a request that day, prompts, commits (as in totals) and failed tool calls. Idle days are left out. */
export interface DailyWorkRow { day: Day; sessions: number; prompts: number; commits: number; failed_calls: number }
export interface UnpricedRow { model: string | null; requests: number; tokens: number }
export interface ModelRow { model: string; effort: string; requests: number; tokens: number; cost: number | null }

export interface ProjectRow {
  project: string | null; sessions: number; tokens: number; cost: number | null; unpriced: number; cache_read: number;
  prompt_tokens: number; cache_1h: number; cache_writes: number; sub_tokens: number | null; sub_cost: number | null;
  calls: number; errors: number; commits: number; prompts: number; error_loops: number;
  cache_hit_ratio: number | null; write_1h_share: number | null; subagent_share: number | null; subagent_cost_share: number | null; tokens_per_commit: number | null;
  cost_per_commit: number | null; errors_per_100_calls: number | null; tokens_per_prompt: number | null;
}

export interface RateRow { calls: number; errors: number; failure_rate: number | null }
export interface ToolRow extends RateRow { tool: string; p50_ms: number | null; p95_ms: number | null }
export interface NamedRateRow extends RateRow { name: string }
export interface HookRow { name: string | null; event: string | null; runs: number; errors: number; avg_ms: number | null; failure_rate: number | null }
export interface ErrorLoop {
  session_id: string; project: string | null; tool: string; failures: number; first_id: string; start_ts: Ts;
  /** The session's title (Activity and the tool sheet; the session sheet's loops are all its own). */
  title?: string | null;
}

export interface SessionRow {
  session_id: string; project: string | null; git_branch: string | null; first_ts: Ts | null; last_ts: Ts | null; duration_s: number | null;
  compactions: number | null; peak_context: number | null; peak_model: string | null; requests: number; tokens: number; cost: number | null;
  unpriced: number; thinking_ms: number; tool_calls: number; errors: number; commits: number; tests_passed: number; tests_failed: number;
  prompts: number; interrupted: number; context_limit: number | null; context_share: number | null; near_limit: boolean;
  tokens_per_prompt: number | null; error_loops: number;
  /** From the first prompt; set on top_sessions and /api/sessions rows only. */
  title?: string | null;
}
export interface TitledSessionRow extends SessionRow { title: string | null }

export interface Previous {
  tokens: number; cost: number | null; requests: number; sessions: number; active_days: number; start: Day; end: Day;
  daily: { day: Day; cost: number | null; tokens: number }[];
  by_project: { project: string | null; cost: number | null; tokens: number; requests: number }[];
}
export interface Change { project: string | null; cost: number; prev_cost: number; delta: number; new: boolean }

/** The coding agent a session came from; "" in a filter is every source. */
export type Source = "claude" | "codex";

export interface UsagePayload {
  project: string; range: number; automated: boolean; source: Source | ""; start: Day | null; end: Day;
  projects: string[]; project_order: string[]; totals: Totals;
  daily: DailyRow[]; daily_projects: DailyProjectRow[]; daily_work: DailyWorkRow[];
  unpriced: UnpricedRow[]; models: ModelRow[]; by_project: ProjectRow[];
  tools: ToolRow[]; mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[]; error_loops: ErrorLoop[];
  sessions: SessionRow[]; top_sessions: TitledSessionRow[]; near_limit: SessionRow[];
  /** null for the all-time view. */
  previous: Previous | null; changes: Change[] | null;
  /** Present when the request named a session: null when it does not exist. */
  session?: SessionDetail | null;
}

export interface SessionsPage { total: number; offset: number; sessions: TitledSessionRow[] }

export interface SessionInfo {
  session_id: string; project: string | null; cwd: string | null; git_branch: string | null; first_ts: Ts | null; last_ts: Ts | null;
  entrypoint: string | null; version: string | null; compactions: number | null; peak_context: number | null; peak_model: string | null;
  source: Source; context_limit: number | null;
}
export interface SessionModelRow extends Tokens { model: string | null; effort: string; subagent: boolean; requests: number; tokens: number; cost: number | null }
export interface SessionDetail {
  info: SessionInfo;
  models: SessionModelRow[];
  timeline: { minute: Ts; tokens: number; cost: number | null; context: number }[];
  tools: { tool: string; calls: number; errors: number; p50_ms: number | null; failure_rate: number | null }[];
  commits: { tool_use_id: string; start_ts: Ts | null; command: string | null }[];
  prompts: { prompts: number; interrupted: number };
  error_loops: ErrorLoop[];
  requests: { ts: Ts | null; model: string | null; subagent: boolean; context: number; output: number; cost: number | null }[];
  calls: { id: string; tool: string; start_ts: Ts | null; end_ts: Ts | null; is_error: boolean; category: string | null; subagent: boolean; is_commit: boolean | null }[];
  compaction_ts: Ts[];
  first_prompt: string | null; first_prompt_cut: boolean; title: string | null; truncated: boolean;
}

export interface PromptPayload { text: string }

export interface Category { id: string; label: string; why: string; fix: string; snippet: string }
/** One failed call. p project, s session, t tool, c category, i input, e error, r followup, d day, n incident index, src source. */
export interface ErrorRow { id: string; ts: Ts; p: string; s: string; t: string; c: string | null; i: string; e: string; r: string; sub: 0 | 1; src: Source; d: Day; n: number | null }
export type Outcome = "recovered" | "failed_again" | "gave_up";
export interface Incident {
  s: string; t: string; c: string | null; p: string; sub: 0 | 1; first: Ts | null; last: Ts | null; ok: number; outcome: Outcome;
  rid: string | null; ri: string; rts: Ts | null;
}
export interface ErrorsPayload {
  generated: string | null; today: Day; project_order: string[]; categories: Category[]; errors: ErrorRow[];
  /** [day, project, calls, subagent calls, source] */
  calls: [Day, string, number, number, Source][];
  /** [day, project, category, errors, subagent errors, source] */
  error_days: [Day, string, string | null, number, number, Source][];
  incidents: Incident[]; incident_gap_minutes: number;
}
// Tool inspector (/api/tool, metrics.tool_detail): one tool, MCP server or skill over the view.
export type ToolKind = "tool" | "mcp" | "skill";
export interface ToolPayload {
  kind: ToolKind; name: string; project: string; range: number; automated: boolean; source: Source | ""; start: Day | null; end: Day;
  totals: RateRow & { subagent_calls: number; subagent_share: number | null; p50_ms: number | null; p95_ms: number | null };
  /** The period before the view; null for all time. */
  previous: (RateRow & { start: Day; end: Day }) | null;
  daily: { day: Day; ok: number; failed: number }[];
  projects: (RateRow & { project: string | null })[];
  sources: (RateRow & { source: Source })[];
  threads: (RateRow & { subagent: boolean })[];
  /** Calls grouped by input pattern (categorize.input_pattern), largest first, with "other" last; null for a skill. */
  patterns: (RateRow & { pattern: string })[] | null;
  categories: { id: string | null; label: string | null; why: string; fix: string; errors: number }[];
  recovery: { incidents: number } & Record<Outcome, number>;
  error_loops: ErrorLoop[];
  /** Test runs and commits; null unless the subject is a shell tool. */
  shell: { test_runs: number; tests_passed: number; tests_failed: number; pass_rate: number | null; commits: number } | null;
  recent: {
    id: string; ts: Ts | null; session_id: string; project: string | null; source: Source; tool: string; input: string;
    is_error: boolean; category: string | null; subagent: boolean; duration_ms: number | null; title: string | null;
  }[];
  /** The tools an MCP server served; null for other kinds. */
  tools: (RateRow & { tool: string; p50_ms: number | null })[] | null;
}

// Command palette (/api/palette, metrics.palette): its suggestions with counts for the view its filter chips describe.
export interface PalettePayload {
  project: string; range: number; automated: boolean; source: Source | "";
  /** Sessions per project under the other filters (the project filter left out). */
  projects: { name: string; sessions: number }[];
  /** Sessions per source under the other filters (the source filter left out). */
  sources: { source: Source; sessions: number }[];
  /** Called ones only. */
  tools: NamedRateRow[]; mcp: NamedRateRow[]; skills: NamedRateRow[];
  /** Failed calls per category, counted as the Errors page does (automated sessions always in). */
  categories: { id: string | null; label: string | null; errors: number }[];
}

export interface ErrorDetail { id: string; i: string; e: string; r: string; cut: ("i" | "e" | "r")[] }

// Limits (/api/limits, limits.py payload): plan-limit windows per provider, their forecast, history and value.
export interface LimitPoint { t: Ts; pct: number; measured: boolean }
export interface ForecastPoint { t: Ts; mid: number; lo: number; hi: number }
export interface Forecast {
  /** shaped: follows the user's hour-of-day profile; flat: a constant rate (too little history). */
  kind: "shaped" | "flat"; curve: ForecastPoint[];
  /** When the middle forecast reaches 100%, with the high (early) and low (late) bounds; null: resets first. */
  hits_at: Ts | null; hits_at_early: Ts | null; hits_at_late: Ts | null;
  /** Percent at reset: null when the middle forecast reaches 100% first. */
  at_reset: number | null; at_reset_low: number; at_reset_high: number;
  /** Points a day: the pace that ends at exactly 100% at reset, and the current one. */
  pace_target: number | null; pace_now: number; pace: "ahead" | "behind" | null;
}
export interface LimitWindow {
  provider: string; provider_label: string; limit_id: string; scope: string; label: string; window_minutes: number | null; plan: string | null;
  start: Ts; resets_at: Ts; current: number | null; measured: boolean; last_snapshot: Ts | null; series: LimitPoint[];
  calibration: { per_pct: number; points: number; windows: number } | null;
  forecast: Forecast | null; no_forecast: string | null; hit_start: Ts | null;
}
export interface LimitHistoryRow {
  provider: string; provider_label: string; label: string; plan: string | null; start: Ts; closed_at: Ts; final: number;
  hit: boolean; hit_minutes: number | null; early: boolean; reason: string | null; estimated: boolean;
}
export interface PlanChange { kind: "plan_change"; provider: string; at: Ts; plan_from: string; plan_to: string }
export interface LimitsPayload {
  now: Ts; windows: LimitWindow[];
  /** Every project, busiest first, for the picker; the filters leave it alone. */
  projects: string[];
  binding: { provider: string; limit_id: string; scope: string; runs_out: boolean } | null;
  suggestion: { provider: string; provider_label: string; label: string; unused_at_reset: number; resets_at: Ts } | null;
  history: LimitHistoryRow[]; events: PlanChange[];
  unused: { provider: string; provider_label: string; label: string; windows: number; estimated: number; avg_unused: number }[];
  value: {
    limits: { provider: string; provider_label: string; label: string; plan: string | null; cost_per_point: number;
      models: { model: string; points: number; tokens_per_point: number | null }[] }[];
    projects: { provider: string; provider_label: string; label: string; project: string; commits: number; points: number; commits_per_point: number | null }[];
  };
  freshness: { provider: string; provider_label: string; last_snapshot: Ts | null; measured: boolean; polled: boolean;
    last_ok: string | null; error: string | null; flags: ("polling failing" | "token expired" | "old" | "no snapshots")[] }[];
}

// Insights (/api/insights, insights.py payload): Claude Code's /insights facets, a model's judgment of each analysed session.
export interface FacetCount { name: string; n: number }
export interface FacetTally extends FacetCount { sessions: number }
export interface InsightSession {
  session_id: string; project: string; start: Ts | null; outcome: string | null; helpfulness: string | null; session_type: string | null;
  brief_summary: string | null; friction_detail: string | null;
  /** Category names, most counted first. */
  friction: string[]; goals: string[]; satisfaction: string[];
  /** false: the facet's session has no transcript in the store, so it has no session sheet. */
  in_store: boolean;
}
export interface InsightsPayload {
  coverage: {
    /** Claude Code sessions in the view, those with a facet and those without; Codex sessions are never analysed. */
    claude_sessions: number; analysed: number; not_analysed: number; codex_sessions: number;
    /** Facets in the view, and those of them whose session is not in the store. */
    facets: number; orphans: number;
    /** Over the whole store, whatever the filters. */
    stored_facets: number; newest_facet: Ts | null;
    /** The usage-data directory the app reads. */
    dir: string | null;
  };
  /** Every project, busiest first, then projects only facets name. */
  projects: string[];
  /** Known values in a fixed order (zeros included), then unknown ones by count. */
  outcomes: FacetCount[]; helpfulness: FacetCount[]; session_types: FacetCount[];
  /** Summed counts and the sessions that reported each, most first. */
  satisfaction: FacetTally[]; friction: FacetTally[]; goals: FacetTally[];
  /** Newest first, at most 200; truncated when there were more. */
  sessions: InsightSession[]; truncated: boolean;
}

// Live (/api/live, /api/live/session, live.py payloads): running sessions from the agent's side. Prompt, reply and
// tool-output text are only present when the session was fetched with text.
export type LiveStateKind = "idle" | "wait" | "tool" | "thinking" | "you";
export interface LiveState {
  /** wait: a shell call pending past 30 s, likely waiting for approval. */
  kind: LiveStateKind; tool: string | null; since: Ts | null;
  /** The transcript does not record this state; it is read from the last lines. */
  inferred: boolean;
}
export interface LiveFigures {
  cost: number | null; requests: number; model: string | null;
  /** The newest main-thread request's context, and the model's window when known. */
  context: number | null; window: number | null;
  /** Share of prompt tokens read from cache. */
  cache_read: number | null; tools: number; errors: number;
}
/** The session's title and where it came from; a title made from the first prompt only with text. */
export interface LiveTitle { title: string | null; title_from: "agent" | "prompt" | null }
export interface LiveListSession extends LiveFigures, LiveTitle {
  session_id: string; project: string | null; source: Source; branch: string | null; last_ts: Ts | null; state: LiveState;
  latest: { kind: "tool" | "prompt"; tool: string | null; summary: string | null; lane: string | null } | null;
}
export interface LivePayload {
  now: Ts; sessions: LiveListSession[];
  /** With no active session: the one in scope that wrote last. */
  newest: { session_id: string; project: string | null; last_ts: Ts | null } | null;
}
interface LiveEventBase { key: string; ts: Ts | null; lane: string | null }
export interface LiveTextEvent extends LiveEventBase { k: "prompt" | "reply"; words: number; text?: string }
export interface LiveToolEvent extends LiveEventBase {
  k: "tool"; id: string; tool: string; summary: string; description: string | null; start: Ts | null; end: Ts | null;
  failed: boolean; error: string | null;
  /** The result's size; its text (cut to 4 KB) only with text. */
  chars: number; output: string | null; cut: boolean;
  /** The subagent this call started, when its result names it. */
  agent: string | null;
}
export interface LiveRequestEvent extends LiveEventBase { k: "request"; id: string; model: string | null; output: number; context: number }
export interface LiveMarkEvent extends LiveEventBase { k: "interrupt" | "turn_end" }
export interface LiveTurnStart extends LiveEventBase { k: "turn_start"; window: number | null }
export interface LiveCompaction extends LiveEventBase { k: "compaction"; pre: number | null }
export type LiveEvent = LiveTextEvent | LiveToolEvent | LiveRequestEvent | LiveMarkEvent | LiveTurnStart | LiveCompaction;
export interface LiveLane {
  id: string; start: Ts | null; end: Ts | null; tools: number; running: boolean;
  /** The main-thread call that started it, when known; name is that call's tool. */
  parent: string | null; name: string; description: string | null; done: boolean;
}
export interface LiveSession extends LiveFigures, LiveTitle {
  session_id: string; project: string | null; source: Source; branch: string | null; last_ts: Ts | null; now: Ts;
  /** Pass back as after= to get only newer events. */
  cursor: string | null; truncated: boolean; state: LiveState;
  events: LiveEvent[]; lanes: LiveLane[];
  compactions: { ts: Ts | null; pre: number | null }[];
  spark: { points: number[]; per_minute: number; step: number };
  limits: { label: string; used_percent: number; observed_at: Ts | null; resets_at: Ts | null }[];
}

export interface IngestStats { files: number; lines: number; inserted: number; seconds: number; usage_files?: number; usage_skipped?: number }
export interface Status {
  ingesting: boolean; last_ingest: string | null; last_stats: IngestStats | null; error: string | null;
  counts: Record<string, number>; interval: number;
  /** Plan-limit pollers by provider; never the credential. */
  limits?: Record<string, { last_ok: string | null; last_attempt: string | null; failures: number; error: string | null; stale: boolean }>;
}

// URLs. automated: Activity and Cost leave automated sessions out unless asked (auto=1 in the page hash). source: "" is all.
const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v));
  return String(p);
};
export interface View { project: string; range: number; automated: boolean; source: Source | "" }
/** The API view of the page hash (useHashState()). */
export const viewOf = (h: { project: string; range: number; auto: boolean; source: Source | "" }): View =>
  ({ project: h.project, range: h.range, automated: h.auto, source: h.source });
const viewQs = (v: View) => ({ project: v.project, range: v.range, automated: v.automated, source: v.source });
export const usageUrl = (v: View, session = "") => `/api/usage?${qs({ ...viewQs(v), session })}`;
export const sessionsUrl = (v: View, o: { q?: string; near?: boolean; offset?: number; day?: Day } = {}) =>
  `/api/sessions?${qs({ ...viewQs(v), q: o.q, near: o.near, offset: o.offset || undefined, day: o.day })}`;
export const sessionUrl = (id: string) => `/api/session?${qs({ id })}`;
export const promptUrl = (session: string) => `/api/prompt?${qs({ session })}`;
export const toolUrl = (kind: ToolKind, name: string, v: View) => `/api/tool?${qs({ kind, name, ...viewQs(v) })}`;
export const paletteUrl = (v: View) => `/api/palette?${qs(viewQs(v))}`;
export const limitsUrl = (v: View) => `/api/limits?${qs({ project: v.project, range: v.range, source: v.source })}`;
export const insightsUrl = (v: View) => `/api/insights?${qs(viewQs(v))}`;
export const liveUrl = (v: View, text = false) => {
  const q = qs({ project: v.project, automated: v.automated, source: v.source, text });
  return q ? `/api/live?${q}` : "/api/live";
};
export const liveSessionUrl = (id: string, o: { after?: string | null; text?: boolean } = {}) =>
  `/api/live/session?${qs({ id, after: o.after, text: o.text })}`;
export const liveEventsUrl = "/api/live/events";
export const errorsUrl = "/api/errors";
export const errorUrl = (id: string) => `/api/error?${qs({ id })}`;
export const statusUrl = "/api/status";
