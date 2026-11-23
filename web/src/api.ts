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
  /** Estimated cost of each billed kind (thinking is billed as output); they add up to cost, and are null when no request is priced. */
  cost_input: number | null; cost_output: number | null; cost_cache_read: number | null; cost_cache_5m: number | null; cost_cache_1h: number | null;
  calls: number; errors: number; commits: number; test_runs: number; tests_passed: number; tests_failed: number; main_calls: number;
  prompts: number; interrupted: number; error_loops: number; sessions: number;
  cache_hit_ratio: number | null; write_1h_share: number | null; subagent_token_share: number | null; subagent_cost_share: number | null;
  tokens_per_prompt: number | null; cost_per_prompt: number | null; turns_per_prompt: number | null; tool_calls_per_prompt: number | null;
  interruption_rate: number | null; tokens_per_commit: number | null; cost_per_commit: number | null; errors_per_100_calls: number | null;
  session_seconds: number; median_session_seconds: number | null; near_limit: number;
  /** Model and tool time summed over the sessions that record them (timed_sessions; Claude Code's cost-state line), whole-session;
   *  output_per_s is those sessions' output tokens over their model time, null when there is none. tool_ms is null when
   *  timed sessions state no tool time (Grok's record none). */
  model_ms: number; tool_ms: number | null; timed_sessions: number; output_per_s: number | null;
  /** The sources of the view's sessions (a session is in the view when it has requests in it), A to Z. */
  session_sources: Source[];
}

export interface DailyRow extends Tokens { day: Day; cost: number | null; unpriced: number }
export interface DailyProjectRow { day: Day; project: string | null; cost: number | null; tokens: number }
/** A day's cost by model, and by agent: priced requests only, so a day's rows add up to its cost in daily. */
export interface DailyModelRow { day: Day; model: string; cost: number }
export interface DailySourceRow { day: Day; source: Source; cost: number }
/** The cost flow's rows (cost_flow), from the view's priced or reported requests only, so they add up to totals.cost.
 *  A pair: a project (null for sessions with no project) and a model, costliest first. A model is null for Grok's requests
 *  with no breakdown by model, which carry a reported cost. */
export interface FlowPair { project: string | null; model: string | null; cost: number }
/** A model's cost, its estimate split by kind, which add up to the totals' kinds, and the cost an agent reported with no
 *  split by kind: together its cost. A kind is null when no request of the model is estimated, cost_reported when none
 *  carries a reported cost. */
export interface FlowModel {
  model: string | null; cost: number; cost_input: number | null; cost_output: number | null; cost_cache_read: number | null;
  cost_cache_5m: number | null; cost_cache_1h: number | null; cost_reported: number | null;
}
/** Work per day (or per week, named by its Monday, in work): sessions with a request in it, each counted once, prompts,
 *  commits (as in totals), tool calls and failed tool calls. Idle days are left out. */
export interface DailyWorkRow { day: Day; sessions: number; prompts: number; commits: number; calls: number; failed_calls: number }
export interface UnpricedRow { model: string | null; requests: number; tokens: number }
export interface ModelRow { model: string; effort: string; fast: boolean; requests: number; tokens: number; cost: number | null }

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
  /** A stored title, else one from the first prompt; set on sessions, top_sessions and /api/sessions rows. On a
   * sessions row the first prompt is read only for one project's view or a top_sessions row; else it is a stored title or null. */
  title?: string | null;
}
export interface TitledSessionRow extends SessionRow { title: string | null }

export interface Previous {
  tokens: number; cost: number | null; requests: number; sessions: number; active_days: number; start: Day; end: Day;
  /** As the same totals of the view. */
  prompts: number; commits: number; calls: number; errors: number; test_runs: number; tests_passed: number; interrupted: number;
  sub_tokens: number; median_session_seconds: number | null;
  output_per_s: number | null;
  daily: { day: Day; cost: number | null; tokens: number }[];
  by_project: { project: string | null; cost: number | null; tokens: number; requests: number }[];
}
/** cost or prev_cost is null when that period's requests were all on unpriced models; delta is then null too. */
export interface Change { project: string | null; cost: number | null; prev_cost: number | null; delta: number | null; new: boolean }

/** The coding agent a session came from; "" in a filter is every source. */
export type Source = "claude" | "codex" | "grok";
/** One agent's share of the month's run rate. */
export interface RunRateSource { source: Source; month_cost: number; daily_avg: number; projected: number }

export interface UsagePayload {
  project: string; range: number; automated: boolean; source: Source | ""; start: Day | null; end: Day;
  projects: string[]; project_order: string[]; totals: Totals;
  daily: DailyRow[]; daily_projects: DailyProjectRow[]; daily_models: DailyModelRow[]; daily_sources: DailySourceRow[]; daily_work: DailyWorkRow[];
  /** The view's cost from project to model (pairs) and by model with its kinds (models); unpriced requests add no row. */
  cost_flow: { pairs: FlowPair[]; models: FlowModel[] };
  /** The work rows by work_bucket: weeks (Monday start, local) when the first work day is over 60 days before the end. */
  work_bucket: "day" | "week"; work: DailyWorkRow[];
  /** work split by project; a bucket's rows add up to its work row. */
  work_projects: { day: Day; project: string | null; sessions: number; prompts: number; commits: number; calls: number; failed_calls: number }[];
  /** Output speed per work bucket (day as work's), over the sessions that record model time, each in the bucket of its first
   *  request in the view; buckets with none left out. */
  speed_trend: { day: Day; output_per_s: number; sessions: number }[];
  /** The newest 50 failed test runs; id is the failed call's id on the Errors page. */
  failed_tests: { id: string; session_id: string; title: string | null; project: string | null; source: Source; command: string; ts: Ts | null }[];
  unpriced: UnpricedRow[]; models: ModelRow[]; by_project: ProjectRow[];
  tools: ToolRow[]; mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[]; error_loops: ErrorLoop[];
  sessions: SessionRow[]; top_sessions: TitledSessionRow[]; near_limit: SessionRow[];
  /** null for the all-time view. */
  previous: Previous | null; changes: Change[] | null;
  /** The calendar month's projection under the view's scope (any range): month_cost up to yesterday, plus daily_avg (the last
   *  7 complete days) over days_left, today counted. null without 7 complete days of priced history. by_source: the same per
   *  agent with a cost in either window; they add up to the totals. */
  run_rate: { month_cost: number; daily_avg: number; days_left: number; projected: number; by_source: RunRateSource[] } | null;
  /** The user prices file next to the store (path), and why it was ignored (error; null when read or absent). */
  prices_file: { path: string; error: string | null };
  /** The plan each provider in the view is on (from its newest limit snapshot), priced monthly in USD; none when unknown. */
  plans: { provider: Source; label: string; monthly: number }[];
  automated_file: AutomatedFile;
  /** Present when the request named a session: null when it does not exist. */
  session?: SessionDetail | null;
}

/** A /api/sessions row: also its whole-session model time and output tokens per second of it, null when the session records
 *  no model time (every Codex session, older Claude Code ones). */
export interface ListedSessionRow extends TitledSessionRow { model_ms: number | null; output_per_s: number | null }
export interface SessionsPage { total: number; offset: number; sessions: ListedSessionRow[] }
export type SessionSort = "first_ts" | "duration_s" | "prompts" | "tokens" | "cost" | "peak_context" | "errors" | "compactions" | "commits" | "tests_failed"
  | "model_ms" | "output_per_s";
/** One key of a /api/sessions sort and its direction. */
export interface SessionSortKey { key: SessionSort; desc: boolean }

/** /api/day: the usage payload's project, tool, hook, error-loop and failed-test rows, limited to the view's local days from
 *  day: one, or the week a work chart bar holds (days 7), clipped to the view's range: start and end are the days counted. */
export interface DayView {
  day: Day; days: Span; start: Day; end: Day; by_project: ProjectRow[]; tools: ToolRow[]; mcp: NamedRateRow[]; skills: NamedRateRow[]; hooks: HookRow[];
  error_loops: ErrorLoop[]; error_loops_total: number; failed_tests: UsagePayload["failed_tests"]; tests_failed: number;
}
/** The days a selection of the work chart covers: a day, or a week from its Monday. */
export type Span = 1 | 7;
/** /api/calendar: the work per day of the 53 weeks from start (a Monday) to end (today), whatever the page's range; days
 *  with none left out. first: the first day with a request under the same filters, over all time; null for none. */
export interface CalendarPayload {
  project: string; automated: boolean; source: Source | ""; start: Day; end: Day; first: Day | null; days: DailyWorkRow[];
}

export interface SessionInfo {
  session_id: string; project: string | null; cwd: string | null; git_branch: string | null; first_ts: Ts | null; last_ts: Ts | null;
  entrypoint: string | null; version: string | null; compactions: number | null; peak_context: number | null; peak_model: string | null;
  source: Source; context_limit: number | null;
  /** The window the source stated (Codex), else null; first_compaction_ts: when the first compaction was recorded. */
  context_window: number | null; first_compaction_ts: Ts | null;
  /** Active time, as the sessions table's duration_s: pauses over 20 minutes left out. */
  active_s: number | null;
  /** From Claude Code's cost-state line, subagents included; null when the session records none (every Codex session). */
  runs: SessionRuns | null;
}
/** tool_ms and lines are null when the runs state none (a Grok session's). */
export interface SessionRuns { model_ms: number; tool_ms: number | null; lines_added: number | null; lines_removed: number | null; output_per_s: number | null }
export interface SessionModelRow extends Tokens { model: string | null; effort: string; subagent: boolean; requests: number; tokens: number; cost: number | null }
/** The session's /insights judgment (a facet): a model's opinion, not a measurement. Name lists run most counted first. */
export type SessionInsight = Pick<InsightSession, "outcome" | "helpfulness" | "session_type" | "brief_summary" | "friction_detail" | "friction" | "goals" | "satisfaction">;
export interface SessionDetail {
  info: SessionInfo;
  /** null when /insights has not analysed the session (every Codex session). */
  insight: SessionInsight | null;
  models: SessionModelRow[];
  /** context: the minute's largest request context; null when no request of it states one. */
  timeline: { minute: Ts; tokens: number; cost: number | null; context: number | null }[];
  tools: { tool: string; calls: number; errors: number; p50_ms: number | null; failure_rate: number | null }[];
  commits: { tool_use_id: string; start_ts: Ts | null; command: string | null }[];
  prompts: { prompts: number; interrupted: number };
  error_loops: ErrorLoop[];
  /** context: null when unknown: a Grok request whose tokens are a whole turn's, not one model call's. */
  requests: { ts: Ts | null; model: string | null; subagent: boolean; context: number | null; output: number; cost: number | null }[];
  /** lane: 0 on the main thread; a subagent's rank among the session's subagent result files, by its first call; null when its agent cannot be told (no result file, or the main thread's file). input: the input summary, cut to 120. */
  calls: { id: string; tool: string; start_ts: Ts | null; end_ts: Ts | null; is_error: boolean; category: string | null; subagent: boolean; is_commit: boolean | null; lane: number | null; input: string }[];
  compaction_ts: Ts[];
  first_prompt: string | null; first_prompt_cut: boolean; title: string | null; truncated: boolean; calls_truncated: boolean;
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
  incidents: Incident[]; incident_gap_minutes: number; incident_max_ok: number;
  /** The fix markers kept in the store, error type -> the day the fix went in; they follow the user across ports and browsers. */
  fixes: Record<string, Day>;
  /** The error types the user muted (sorted): the page counts them as noise. */
  muted: string[];
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
/** recent: the "if the last 24 hours continue" line; null when the forecast has no such scenario. */
export interface ForecastPoint { t: Ts; mid: number; lo: number; hi: number; recent: number | null }
export interface Forecast {
  /** shaped: follows the user's hour-of-day profile; flat: a constant rate (too little history). */
  kind: "shaped" | "flat"; curve: ForecastPoint[];
  /** When the middle forecast reaches 100%, with the high (early) and low (late) bounds; null: resets first. */
  hits_at: Ts | null; hits_at_early: Ts | null; hits_at_late: Ts | null;
  /** Percent at reset: null when the middle forecast reaches 100% first. */
  at_reset: number | null; at_reset_low: number; at_reset_high: number;
  /** Points a day: the pace that ends at exactly 100% at reset, and the forecast's own: halfway between the usual pace
   *  (recent weeks) and the window's pace over its last seventh (pace_window, over pace_window_hours; null until then). */
  pace_target: number | null; pace_now: number; pace: "ahead" | "behind" | null;
  pace_usual: number; pace_window: number | null; pace_window_hours: number | null;
  /** The scenario "if the last 24 hours continue": the provider's counted use over the last 24 hours (for the models the
   *  limit covers) carried to the reset on the same hour shape. Points a day, when it reaches 100% (null: resets first) and
   *  the percent at reset (null when it reaches 100% first). All null when there is no scenario. */
  recent_pace: number | null; recent_hits_at: Ts | null; recent_at_reset: number | null;
}
export interface LimitWindow {
  provider: string; provider_label: string; limit_id: string; scope: string; label: string; window_minutes: number | null; plan: string | null;
  start: Ts; resets_at: Ts; current: number | null; measured: boolean; last_snapshot: Ts | null; series: LimitPoint[];
  calibration: { per_pct: number; points: number; windows: number } | null;
  forecast: Forecast | null; no_forecast: string | null; hit_start: Ts | null;
  /** At 100% (or reported as reached) now, until it resets. */
  at_limit: boolean;
  /** What the counted, priced use since the window started was spent on, at list prices: the top three projects and models
   *  by cost. points is null until the window is calibrated. null when nothing was counted. */
  used: { total: number; projects: (WindowUsedRow & { project: string })[]; models: (WindowUsedRow & { model: string })[] } | null;
  /** A scoped limit's share of the weekly allowance, from the provider's newest poll of this window: the part of the whole
   *  allowance the limit may use, and the part of it used through the limit (both percents of the whole weekly allowance).
   *  null for any other window, and when the newest poll is of another window or has no share. */
  weekly_share: { used: number; allowance: number } | null;
  /** The weekly window's use so far by surface (Claude Code, chat, cowork), each row's percent of that use, in the
   *  provider's order; as_of is when the provider measured it. null on any window but the unscoped weekly one, and when the
   *  newest poll is of another window or has no breakdown. */
  surfaces: { as_of: Ts | null; rows: { key: string; label: string; percent: number }[] } | null;
}
export interface WindowUsedRow { cost: number; share: number; points: number | null }
export interface LimitHistoryRow {
  provider: string; provider_label: string; label: string; plan: string | null; start: Ts; closed_at: Ts; final: number;
  hit: boolean; hit_minutes: number | null; early: boolean; reason: string | null; estimated: boolean;
  /** Which window it was, so /api/limits/window can be asked for its curve: the limit, and the window's length (null when
   *  the provider gave none) and reset. A window that ended early closed before its resets_at. */
  limit_id: string; scope: string; window_minutes: number | null; resets_at: Ts;
}
/** /api/limits/window (limits.py window_curve): one closed window of the history, with its curve and the plan changes inside it. */
export interface LimitWindowCurve { window: LimitHistoryRow; series: LimitPoint[]; events: PlanChange[] }
export interface PlanChange { kind: "plan_change"; provider: string; at: Ts; plan_from: string; plan_to: string }
export interface LimitsPayload {
  now: Ts; windows: LimitWindow[];
  /** Every project, busiest first, for the picker; the filters leave it alone. */
  projects: string[];
  binding: { provider: string; limit_id: string; scope: string; runs_out: boolean } | null;
  suggestion: { provider: string; provider_label: string; label: string; unused_at_reset: number; resets_at: Ts } | null;
  history: LimitHistoryRow[]; events: PlanChange[];
  /** Over full-length windows only: early counts those cut short, and avg_unused is null when none ran their length. */
  unused: { provider: string; provider_label: string; label: string; windows: number; estimated: number; early: number; avg_unused: number | null }[];
  value: {
    /** past_plan: calibrated on a plan the provider no longer reports. A model without a price has no points. */
    limits: { provider: string; provider_label: string; label: string; plan: string | null; past_plan: boolean; cost_per_point: number;
      models: { model: string; priced: boolean; points: number | null; tokens_per_point: number | null }[] }[];
    projects: { provider: string; provider_label: string; label: string; project: string; commits: number; points: number; commits_per_point: number | null }[];
  };
  freshness: { provider: string; provider_label: string; last_snapshot: Ts | null; measured: boolean; polled: boolean;
    last_ok: string | null; error: string | null; flags: ("polling failing" | "token expired" | "old" | "no snapshots")[] }[];
}

// Insights (/api/insights, insights.py payload): Claude Code's /insights facets, a model's judgment of each analysed session.
export interface FacetCount { name: string; n: number }
export interface FacetTally extends FacetCount { sessions: number }
/** A session's figures counted by /insights from the transcript (session meta); a measurement, not a judgment. null: not written. */
export interface SessionFigures {
  duration_minutes: number | null; lines_added: number | null; lines_removed: number | null; files_modified: number | null; git_pushes: number | null;
}
/** Similar goal or friction labels grouped by keyword: n sums the members' counts, sessions counts the distinct sessions with any
 *  member. Members most counted first. A label no rule matches is a family of its own. */
export interface FacetFamily { family: string; n: number; sessions: number; members: FacetTally[] }
/** What the sessions that reported a friction label or family weigh: their cost in dollars and their active time in seconds,
 *  each session once and whole, whatever the view's range. A session with no transcript in the store, or no price, adds nothing. */
export interface FrictionWeight { cost: number; active_s: number }
export interface FrictionFamily extends FacetFamily, FrictionWeight { members: (FacetTally & FrictionWeight)[] }
export interface InsightSession {
  session_id: string; project: string; start: Ts | null; outcome: string | null; helpfulness: string | null; session_type: string | null;
  brief_summary: string | null; friction_detail: string | null;
  /** The session's title (session-titles), or null. */
  title: string | null;
  /** Category names, most counted first. */
  friction: string[]; goals: string[]; satisfaction: string[];
  /** false: the facet's session has no transcript in the store, so it has no session sheet. */
  in_store: boolean;
  /** Counted by /insights; null when the session has no session-meta row. */
  meta: SessionFigures | null;
  /** Measured from the stored transcript over the whole session, as the Sessions table measures them: its cost (null when no
   *  request is priced), its failed tool calls, and its peak context as a share of the model's window (null without a known
   *  window). All null when the session has no transcript in the store. */
  cost: number | null; errors: number | null; context_share: number | null;
}
export interface TrendWeek { week: string; n: number; achieved: number; fully: number; mostly: number; partially: number; not_achieved: number }
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
    /** Claude Code sessions of the view by project, and those of them analysed, busiest project first; empty for Codex or
     *  without stored facets. */
    by_project: { project: string; sessions: number; analysed: number }[];
    /** The /insights runs that wrote a facet in the view, newest first, at most 20: its newest file time and the facets
     *  of the view it wrote. A run is facets written within an hour of each other, over the whole store. */
    runs: { at: Ts; facets: number }[];
    /** Facets per run over the newest 20 runs of the whole store, whatever the filters; null without a dated facet. */
    run_sizes: { runs: number; min: number; median: number; max: number } | null;
  };
  /** Every project, busiest first, then projects only facets name. */
  projects: string[];
  /** Known values in a fixed order (zeros included), then unknown ones by count. */
  outcomes: FacetCount[]; helpfulness: FacetCount[]; session_types: FacetCount[];
  /** Summed counts and the sessions that reported each, most first. */
  satisfaction: FacetTally[]; friction: FacetTally[]; goals: FacetTally[];
  /** friction and goals grouped into families, most counted first. A friction family and its labels carry their weight. */
  friction_families: FrictionFamily[]; goal_families: FacetFamily[];
  /** Per week of session start (the Monday, YYYY-MM-DD), oldest first, at most 26 weeks with a session: the view's analysed
   *  sessions (n), those fully or mostly achieved, and those of each outcome. n less the four outcomes is the sessions with no
   *  clear outcome, or with one /insights added later. */
  trend: TrendWeek[];
  /** Newest first, at most 200; truncated when there were more. */
  sessions: InsightSession[]; truncated: boolean;
  /** The view's session figures, counted by /insights from each transcript (not model-judged), for Claude Code sessions with a
   *  session-meta row, which can be more than have a facet. Sums take a missing figure as 0; the medians are null when no row
   *  has the value, and the response time is the median of the session medians. Zero sessions for Codex. */
  meta: {
    sessions: number; lines_added: number; lines_removed: number; files_modified: number; git_pushes: number;
    duration_p50_min: number | null; response_p50_s: number | null;
    /** Every language, most counted first: its summed count and the sessions that named it. */
    languages: { name: string; n: number; sessions: number }[];
  };
}

// Live (/api/live, /api/live/session, live.py payloads): running sessions from the agent's side. Prompt, reply and
// tool-output text are only present when the session was fetched with text.
export type LiveStateKind = "idle" | "wait" | "tool" | "thinking" | "you" | "ended";
export interface LiveState {
  /** wait: a shell call pending past 30 s, likely waiting for approval. ended: the transcript shows the session closed
   *  (Claude Code only; Codex writes no such line). */
  kind: LiveStateKind; tool: string | null; since: Ts | null;
  /** The transcript does not record this state; it is read from the last lines. */
  inferred: boolean;
  /** tool: the running call is a long one (see LiveToolEvent.long), which never turns into wait. */
  long: boolean;
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
  session_id: string; project: string | null; source: Source; branch: string | null;
  /** Its first line's time (the session's start) and its newest line's. */
  first_ts: Ts | null; last_ts: Ts | null; state: LiveState;
  /** Only when asked for (agents=1): the session's subagents and delegation calls, at most 200, and how many more were left out. */
  agents?: LiveAgent[]; agents_more?: number;
}
/** A subagent or a delegation call of a session, flat: parent names the subagent lane that started it. */
export interface LiveAgent {
  /** A lane id, or a delegation's call id. */
  id: string;
  kind: "agent" | "delegation";
  /** A lane id; null: the main thread. */
  parent: string | null;
  /** The starting call's tool, else "Subagent"; a delegation's tool. */
  name: string;
  /** At most 300 characters. */
  description: string | null;
  /** running or done for a subagent; pending (no result yet), started, done or failed for a delegation. */
  status: "running" | "done" | "pending" | "started" | "failed";
  start: Ts | null; end: Ts | null;
  /** null for a delegation. */
  tools: number | null; errors: number | null; cost: number | null;
  /** provider: a delegation's target provider. */
  model: string | null; provider: string | null;
}
/** The user automated projects file next to the store, why it was ignored, and the projects it adds. */
export interface AutomatedFile { path: string; error: string | null; projects: string[] }
export interface LivePayload {
  now: Ts; sessions: LiveListSession[]; automated_file: AutomatedFile;
  /** With no active session: the one in scope that wrote last. */
  newest: { session_id: string; project: string | null; last_ts: Ts | null } | null;
}
/** lane: the subagent whose work it is, null on the main thread. */
interface LiveEventBase { key: string; ts: Ts | null; lane: string | null }
export interface LiveTextEvent extends LiveEventBase { k: "prompt" | "reply"; words: number; text?: string }
export interface LiveToolEvent extends LiveEventBase {
  /** The input, whole only with text: without, a subagent call's description, and other inputs cut to 300 characters.
   *  description: the label the agent gave the call (a shell call's row text), cut the same way. */
  k: "tool"; id: string; tool: string; summary: string; description: string | null; start: Ts | null; end: Ts | null;
  failed: boolean; error: string | null;
  /** The result's size; its text (cut to 4 KB) only with text. */
  chars: number; output: string | null; cut: boolean;
  /** The subagent this call started, when its result or the subagent's start names it. */
  agent: string | null;
  /** Its input sets a timeout above 120 s: pending past 30 s, such a call does not read as waiting for approval. */
  long: boolean;
  /** It only reads: Read, Grep or Glob, or a shell call whose every command reads or searches. Hide read-only leaves it out. */
  quiet: boolean;
}
export interface LiveMarkEvent extends LiveEventBase { k: "interrupt" | "turn_end" }
export interface LiveTurnStart extends LiveEventBase { k: "turn_start"; window: number | null }
export interface LiveCompaction extends LiveEventBase { k: "compaction"; pre: number | null }
export type LiveEvent = LiveTextEvent | LiveToolEvent | LiveMarkEvent | LiveTurnStart | LiveCompaction;
/** The session over its last 10 minutes, oldest first: each main-thread request's context (what it read), the first
 *  being the last one before start when there is one, and each tool call that ended, subagents' included. */
export interface LivePulse {
  start: Ts; end: Ts;
  context: { ts: Ts; tokens: number }[];
  ticks: { ts: Ts; failed: boolean }[];
}
export interface LiveSession extends LiveFigures, LiveTitle {
  session_id: string; project: string | null; source: Source; branch: string | null; last_ts: Ts | null; now: Ts;
  /** Pass back as after= to get newer events, with those of the minute before sent again. */
  cursor: string | null; truncated: boolean; state: LiveState;
  events: LiveEvent[];
  /** Per subagent lane with a request, by the events' lane id: its cost (null when unpriced) and its newest request's model. */
  lanes: Record<string, { cost: number | null; model: string | null }>;
  compactions: { ts: Ts | null; pre: number | null }[];
  pulse: LivePulse;
}

export interface IngestStats { files: number; lines: number; inserted: number; seconds: number; usage_files?: number; usage_skipped?: number }
/** The one alert the nav's Limits tab shows (limits.alert_of): the worst state any open window is in. at is when the window
 *  resets (at_limit, high) or is forecast to run out (runs_out); count is every open window in alert. */
export interface LimitsAlert {
  kind: "at_limit" | "runs_out" | "high"; provider: string; provider_label: string; label: string; current: number | null;
  at: Ts; resets_at: Ts;
  /** Whether the window's percent is a reading (false: an estimate, or a reading too old to measure now). */
  measured: boolean; count: number;
}
/** The fullest open window (limits.peak_of). measured: as LimitsAlert's. */
export interface LimitsPeak { provider: string; provider_label: string; label: string; current: number; measured: boolean }
export interface Status {
  ingesting: boolean; last_ingest: string | null; last_stats: IngestStats | null; error: string | null;
  /** The last ingest that stored new lines or usage data; null until one does. */
  last_change: string | null;
  counts: Record<string, number>; interval: number;
  /** Projects by all-time tokens, for project colors on every page (colors.setOrder). */
  project_order: string[];
  /** The Limits tab's alert, worked out once per ingest cycle; null when no window is in alert or before the first cycle ends.
   *  Absent from an older app. */
  limits_alert?: LimitsAlert | null;
  /** The fullest open window, for the Limits tab's pill, worked out with the alert; null when no open window has a percent.
   *  Absent from an older app. */
  limits_peak?: LimitsPeak | null;
  /** How many active sessions wait on the user (a likely approval wait, or your turn), over every project and source,
   *  automated sessions left out: the Live tab's badge. null when the count failed; absent from an older app. */
  live_waiting?: number | null;
  /** Plan-limit pollers by provider; never the credential. */
  limits?: Record<string, { last_ok: string | null; last_attempt: string | null; failures: number; error: string | null; stale: boolean }>;
  /** The user automated projects file and why it was ignored, for the toggle's hint and the app's warning. Absent from an older app. */
  automated_file?: AutomatedFile;
}

// Context page: /api/context. Numbers are tokens unless the name says bytes, dollars (cost), minutes or a ratio; null is unknown
// (no data, no price, no window), never zero. A project of null is a session with no project.
export interface GrowthPoint { turn: number; median: number; p25: number; p75: number; sessions: number }
/** name: the tool, or the MCP server. est_tokens is bytes / 4, an estimate. */
export interface FillRow {
  name: string; calls: number; with_bytes: number; bytes: number; est_tokens: number; p50_bytes: number | null;
  /** The 95th percentile result size in bytes, rounded like p50_bytes; null when no call has a size. */
  p95_bytes: number | null;
  max_bytes: number | null;
}
/** One session on the session map. The title is not carried: the session sheet shows it. */
export interface SessionPoint {
  session_id: string; project: string | null; source: Source;
  /** When the session began; null when unknown. */
  first_ts: Ts | null;
  /** The session's starting context: the prompt tokens of its first turn. */
  start: number;
  /** Its peak context in tokens. It can exceed `window` by a little. */
  peak: number;
  /** Its resolved context window in tokens. */
  window: number;
  /** The number of turns (main-thread requests of at least 2,000 prompt tokens). */
  turns: number;
  compactions: number;
  /** The session's name (see titles.titles); null when it has none. */
  title: string | null;
}
/** One bucket (a day, or the Monday of a week) of cache use. input, cache_read and cache_write are prompt tokens summed over the view's requests. */
export interface CacheBucket {
  /** The bucket's first day. */
  day: Day;
  /** Uncached input tokens. */
  input: number; cache_read: number;
  /** Cache writes, 5-minute and 1-hour together. */
  cache_write: number;
  /** Cache breaks in the bucket by inferred cause (not reported by the provider). */
  model_switch: number; expired: number; other: number;
}
export type TipId = "large_start" | "frequent_compactions" | "near_limit" | "large_results" | "cache_breaks" | "long_tier";
export interface Tip {
  id: TipId; severity: "warn" | "critical"; title: string;
  /** Preformatted by the server ("42,000 tokens", "24%", "$10.20"). */
  evidence: { label: string; value: string }[];
  advice: string;
  /** The newest 20 matching sessions; matched is how many there are in all. */
  sessions: { session_id: string; title: string | null; project: string | null; source: Source; first_ts: Ts | null }[]; matched: number;
}
export interface ContextPayload {
  project: string; range: number; automated: boolean; source: Source | ""; start: Day | null; end: Day;
  projects: string[]; project_order: string[]; automated_file: AutomatedFile;
  /** How much of the view the new columns cover; rebuild_needed when a completed call lacks a size or a compacted session lacks a first compaction. */
  coverage: { sessions: number; with_window: number; calls: number; with_bytes: number; compacted: number; with_first_compaction: number; rebuild_needed: boolean };
  starting: {
    sessions: number; median: number | null; p10: number | null; p90: number | null;
    /** The most common window of the sessions with a measured start; null when none is known. */
    window: number | null; window_share: number | null;
    by_project: { project: string | null; sessions: number; median: number; p10: number; p90: number; window: number | null; window_share: number | null }[];
    /** week is the Monday that starts the week. p25 and p75 are the quartiles of the starting context of the week's sessions. */
    trend: { week: Day; median: number; p25: number; p75: number; sessions: number }[];
  };
  growth: {
    curve: GrowthPoint[];
    /** The curve as fractions of each session's window, over the sessions with a known window (so each point's `sessions` can be fewer than the token curve's); same turn cap and 5-session minimum. Can be empty. */
    share_curve: GrowthPoint[];
    /** share_curve of a project is that project's share curve; can be empty. */
    by_project_curves: { project: string | null; sessions: number; curve: GrowthPoint[]; share_curve: GrowthPoint[] }[];
    added_per_prompt: number | null;
    by_project: { project: string | null; sessions: number; added_per_prompt: number | null; compacted: number; turns_to_compaction: number | null; minutes_to_compaction: number | null }[];
    to_compaction: { sessions: number; turns: number | null; minutes: number | null };
    /** Five counts per window: <25%, 25-50%, 50-80%, 80-90%, >=90% of the window. */
    fill: { window: number; sessions: number; bins: [number, number, number, number, number] }[];
    /** The median peak context of the view's sessions, in tokens and as a share of the window (over the sessions with a known window). */
    peak: { sessions: number; median: number | null; window_share: number | null };
  };
  /** Per project, most sessions first: the sessions with a measured start, a known window and a peak, their most common window, and
   *  the medians of their start and peak in tokens and as shares of each session's window. One population per project. */
  grids: { project: string | null; sessions: number; window: number; start: number; start_share: number; peak: number; peak_share: number }[];
  /** The sessions with a measured start, a known window and a peak. `points` holds the newest 1,000 (by first_ts, then session_id); `total` counts them all. */
  sessions_map: { total: number; points: SessionPoint[] };
  fills: {
    main_bytes: number; subagent_bytes: number;
    tools: FillRow[]; mcp: FillRow[];
    largest: { id: string; session_id: string; title: string | null; project: string | null; source: Source; tool: string; mcp_server: string | null; input: string; bytes: number; est_tokens: number; ts: Ts | null }[];
  };
  cost: {
    /** Cache use over time: per day, or per week when the view's first request is more than 60 days old. Buckets with no request are left out. */
    series: { bucket: "day" | "week"; rows: CacheBucket[] };
    cost: number | null; cache_read_cost: number | null; long_cost: number | null; long_requests: number; cache_hit_ratio: number | null;
    by_project: { project: string | null; cost: number | null; cache_read_cost: number | null; long_cost: number | null; long_requests: number; cache_hit_ratio: number | null; prompt_tokens: number; cache_read: number }[];
    break_sessions: number;
    breaks: { session_id: string; title: string | null; project: string | null; source: Source; breaks: number; model_switch: number; expired: number; other: number; uncached_tokens: number; cost: number | null }[];
  };
  tips: Tip[];
  /** The project's latest /context snapshot (configuration overhead), whatever the range; null without a project filter or a snapshot. */
  overhead: ContextOverhead | null;
}

/** A part of a /context snapshot: an overhead category and its tokens. */
export interface OverheadPart { name: string; tokens: number }
/** An item of a /context snapshot. seq: its identity, unique within the snapshot. name: the MCP tool's or skill's name, the
 *  memory file's path or the agent's type; detail: the tool's server name, the file's type or the agent's or skill's source; both
 *  null when the snapshot has none. server: the key the tool's calls are stored under (from the name's mcp__<server>__ prefix,
 *  else detail); null for other kinds or when neither gives one. tokens: never negative. */
export interface OverheadItem {
  seq: number; kind: "mcp_tool" | "memory_file" | "agent" | "skill"; name: string | null; detail: string | null; server: string | null; tokens: number;
}
/** What /context measured in a session of the project: categories in the order /context lists them (state is the category's
 *  kind: used, deferred, buffer or free), and every item the categories hold (items) with how often Claude Code called each. */
export interface ContextOverhead {
  /** The snapshot's own id: unique where session_id and ts are not (two snapshots of one session at one time). */
  uuid: string;
  ts: Ts; session_id: string; model: string | null; version: string | null; window: number | null;
  categories: { name: string; tokens: number; state: "used" | "deferred" | "buffer" | "free" }[];
  /** The snapshot was taken before the view's first day (false for all time). */
  before_view: boolean;
  /** Every MCP tool, memory file, custom agent and skill, by tokens (largest first), then name (none last), then seq. */
  items: OverheadItem[];
  /** Claude Code's calls in the view (main thread and subagents) per server key and skill name of the snapshot; only those
   *  called, so a missing one is 0. Lists, not objects keyed by name: a skill named "constructor" stays a name. */
  calls: { mcp: { server: string; calls: number }[]; skill: { name: string; calls: number }[] };
}

// URLs. automated: Activity and Cost leave automated sessions out unless asked (auto=1 in the page URL). source: "" is all.
const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v));
  return String(p);
};
export interface View { project: string; range: number; automated: boolean; source: Source | "" }
/** The API view of the page URL (useView()). */
export const viewOf = (h: { project: string; range: number; auto: boolean; source: Source | "" }): View =>
  ({ project: h.project, range: h.range, automated: h.auto, source: h.source });
const viewQs = (v: View) => ({ project: v.project, range: v.range, automated: v.automated, source: v.source });
export const usageUrl = (v: View, session = "") => `/api/usage?${qs({ ...viewQs(v), session })}`;
/** sort: the keys, first key first; one key goes as sort=<key>&desc=1, as before, several as one list (sort=-cost,prompts). */
const sortQs = (sort: readonly SessionSortKey[] = []) => sort.length === 1 ? { sort: sort[0]!.key, desc: sort[0]!.desc }
  : { sort: sort.map(s => (s.desc ? "-" : "") + s.key).join(",") };
export const sessionsUrl = (v: View, o: { q?: string; near?: boolean; offset?: number; limit?: number; day?: Day; days?: Span; sort?: readonly SessionSortKey[] } = {}) =>
  `/api/sessions?${qs({ ...viewQs(v), q: o.q, near: o.near, offset: o.offset || undefined, limit: o.limit, day: o.day, days: o.day && o.days !== 1 ? o.days : undefined, ...sortQs(o.sort) })}`;
export const dayUrl = (v: View, day: Day, days: Span = 1) => `/api/day?${qs({ ...viewQs(v), day, days: days === 1 ? undefined : days })}`;
/** The calendar takes no range. */
export const calendarUrl = (v: View) => `/api/calendar?${qs({ project: v.project, automated: v.automated, source: v.source })}`;
export const sessionUrl = (id: string) => `/api/session?${qs({ id })}`;
export const promptUrl = (session: string) => `/api/prompt?${qs({ session })}`;
export const toolUrl = (kind: ToolKind, name: string, v: View) => `/api/tool?${qs({ kind, name, ...viewQs(v) })}`;
export const paletteUrl = (v: View) => `/api/palette?${qs(viewQs(v))}`;
export const limitsUrl = (v: View) => `/api/limits?${qs({ project: v.project, range: v.range, source: v.source })}`;
/** One closed window's curve. Its start and reset name it: two windows that one poll reported can share a start. */
export const limitWindowUrl = (h: Pick<LimitHistoryRow, "provider" | "limit_id" | "scope" | "start" | "resets_at">) =>
  `/api/limits/window?${qs({ provider: h.provider, limit_id: h.limit_id, scope: h.scope, start: h.start, resets_at: h.resets_at })}`;
export const contextUrl = (v: View) => `/api/context?${qs(viewQs(v))}`;
export const insightsUrl = (v: View) => `/api/insights?${qs(viewQs(v))}`;
/** agents: each session's agents too, for the Tree. */
export const liveUrl = (v: View, text = false, agents = false) => {
  const q = qs({ project: v.project, automated: v.automated, source: v.source, text, agents });
  return q ? `/api/live?${q}` : "/api/live";
};
export const liveSessionUrl = (id: string, o: { after?: string | null; text?: boolean } = {}) =>
  `/api/live/session?${qs({ id, after: o.after, text: o.text })}`;
export const liveEventsUrl = "/api/live/events";
export const errorsUrl = "/api/errors";
/** POST {category, day: Day | null} (null removes the marker); answers the full marks, {fixes, muted}. */
export const errorFixUrl = "/api/errors/fix";
/** POST {category, muted: boolean}: mutes or unmutes a type, leaving its fix day as it is; answers the full marks. */
export const errorMuteUrl = "/api/errors/mute";
/** GET: the marks alone, the page's read of the store after a write it cannot account for. */
export const errorMarksUrl = "/api/errors/marks";
/** POST {fixes: {category: Day}}: the store takes the ones it has no row for (never marked or muted, or marked and undone) and answers the full marks; an invalid one is skipped. */
export const errorFixesImportUrl = "/api/errors/fixes/import";
export const errorUrl = (id: string) => `/api/error?${qs({ id })}`;
export const statusUrl = "/api/status";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** GET (or, with init, any request) answering JSON. init carries the caller's signal and priority to fetch. */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}
