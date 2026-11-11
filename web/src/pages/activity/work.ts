// Activity's figures from the usage payload: the work per day and what needs attention.
import type { DailyWorkRow, ToolRow, UsagePayload } from "../../api";
import { dayRange } from "../../format";

export type WorkMetric = "commits" | "prompts" | "sessions";
export const METRICS: { k: WorkMetric; label: string; one: string }[] = [
  { k: "commits", label: "Commits", one: "commit" },
  { k: "prompts", label: "Prompts", one: "prompt" },
  { k: "sessions", label: "Sessions", one: "session" },
];

/** The view's first day with a session; null when it has none. A prompt alone (its session made no request) does not count. */
export const firstWorkDay = (d: Pick<UsagePayload, "daily_work">): string | null => d.daily_work.find(r => r.sessions > 0)?.day ?? null;

/** Every day of the view from its first day with a session, with zeros for idle days. */
export function workDays(d: Pick<UsagePayload, "start" | "end" | "daily_work">): DailyWorkRow[] {
  const have = new Map(d.daily_work.map(r => [r.day, r]));
  const first = firstWorkDay(d) ?? d.start ?? d.end;
  return dayRange(first, d.end).map(day => have.get(day) ?? { day, sessions: 0, prompts: 0, commits: 0, failed_calls: 0 });
}
export const busy = (r: DailyWorkRow) => r.sessions + r.prompts + r.commits + r.failed_calls > 0;

/** Tools failing over 10% of at least 20 calls. */
export const isFlaky = (r: ToolRow) => r.calls >= 20 && (r.failure_rate ?? 0) > .1;
export const flakyTools = (tools: readonly ToolRow[]) => tools.filter(isFlaky);
/** Failing tools first, otherwise in the server's order. */
export const flakyFirst = (tools: readonly ToolRow[]) => tools.slice().sort((a, b) => +isFlaky(b) - +isFlaky(a));
/** A hook command short enough to tell hooks apart: every path cut to its last segment, quotes and a closing
 *  "|| true" or "|| exit 0" dropped. */
export const hookCommand = (cmd: string) => cmd.replace(/\s*\|\|\s*(true|exit 0)\s*$/, "").split(/\s+/).filter(Boolean)
  .map(w => { const u = w.replace(/^["']|["']$/g, ""); return u.includes("/") ? u.replace(/\/+$/, "").split("/").pop() || u : u; }).join(" ");
/** A tool name short enough for a sentence: MCP prefixes dropped, cut at 28 characters. */
export const shortTool = (n: string) => { const s = n.replace(/^mcp__/, "").replace(/__/g, " "); return s.length > 28 ? s.slice(0, 28) + "…" : s; };
