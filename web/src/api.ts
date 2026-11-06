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
export interface ErrorLoop { session_id: string; project: string | null; tool: string; failures: number; first_id: string; start_ts: Ts }

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

export interface UsagePayload {
  project: string; range: number; automated: boolean; start: Day | null; end: Day;
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
  context_limit: number | null;
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
/** One failed call. p project, s session, t tool, c category, i input, e error, r followup, d day, n incident index. */
export interface ErrorRow { id: string; ts: Ts; p: string; s: string; t: string; c: string | null; i: string; e: string; r: string; sub: 0 | 1; d: Day; n: number | null }
export type Outcome = "recovered" | "failed_again" | "gave_up";
export interface Incident {
  s: string; t: string; c: string | null; p: string; sub: 0 | 1; first: Ts | null; last: Ts | null; ok: number; outcome: Outcome;
  rid: string | null; ri: string; rts: Ts | null;
}
export interface ErrorsPayload {
  generated: string | null; today: Day; project_order: string[]; categories: Category[]; errors: ErrorRow[];
  /** [day, project, calls, subagent calls] */
  calls: [Day, string, number, number][];
  /** [day, project, category, errors, subagent errors] */
  error_days: [Day, string, string | null, number, number][];
  incidents: Incident[]; incident_gap_minutes: number;
}
export interface ErrorDetail { id: string; i: string; e: string; r: string; cut: ("i" | "e" | "r")[] }

export interface IngestStats { files: number; lines: number; inserted: number; seconds: number }
export interface Status {
  ingesting: boolean; last_ingest: string | null; last_stats: IngestStats | null; error: string | null;
  counts: Record<string, number>; interval: number;
}

// URLs. automated: Activity and Cost leave automated sessions out unless asked (auto=1 in the page hash).
const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v));
  return String(p);
};
export interface View { project: string; range: number; automated: boolean }
/** The API view of the page hash (useHashState()). */
export const viewOf = (h: { project: string; range: number; auto: boolean }): View => ({ project: h.project, range: h.range, automated: h.auto });
export const usageUrl = (v: View, session = "") => `/api/usage?${qs({ project: v.project, range: v.range, automated: v.automated, session })}`;
export const sessionsUrl = (v: View, o: { q?: string; near?: boolean; offset?: number; day?: Day } = {}) =>
  `/api/sessions?${qs({ project: v.project, range: v.range, automated: v.automated, q: o.q, near: o.near, offset: o.offset || undefined, day: o.day })}`;
export const sessionUrl = (id: string) => `/api/session?${qs({ id })}`;
export const promptUrl = (session: string) => `/api/prompt?${qs({ session })}`;
export const errorsUrl = "/api/errors";
export const errorUrl = (id: string) => `/api/error?${qs({ id })}`;
export const statusUrl = "/api/status";
