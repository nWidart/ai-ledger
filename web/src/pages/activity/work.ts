// Activity's figures from the usage payload: the work per day and what needs attention.
import type { DailyWorkRow, ToolRow, UsagePayload } from "../../api";
import { dayRange } from "../../format";

export type WorkMetric = "commits" | "prompts" | "sessions";
export const METRICS: { k: WorkMetric; label: string; one: string }[] = [
  { k: "commits", label: "Commits", one: "commit" },
  { k: "prompts", label: "Prompts", one: "prompt" },
  { k: "sessions", label: "Sessions", one: "session" },
];

/** Every day of the view, with zeros for idle days. All time: from the first day with work. */
export function workDays(d: Pick<UsagePayload, "start" | "end" | "daily_work">): DailyWorkRow[] {
  const have = new Map(d.daily_work.map(r => [r.day, r]));
  const first = d.start || d.daily_work[0]?.day || d.end;
  return dayRange(first, d.end).map(day => have.get(day) ?? { day, sessions: 0, prompts: 0, commits: 0, failed_calls: 0 });
}
export const busy = (r: DailyWorkRow) => r.sessions + r.prompts + r.commits + r.failed_calls > 0;

/** Tools failing over 10% of at least 20 calls. */
export const isFlaky = (r: ToolRow) => r.calls >= 20 && (r.failure_rate ?? 0) > .1;
export const flakyTools = (tools: readonly ToolRow[]) => tools.filter(isFlaky);
/** Failing tools first, otherwise in the server's order. */
export const flakyFirst = (tools: readonly ToolRow[]) => tools.slice().sort((a, b) => +isFlaky(b) - +isFlaky(a));
/** A tool name short enough for a sentence: MCP prefixes dropped, cut at 28 characters. */
export const shortTool = (n: string) => { const s = n.replace(/^mcp__/, "").replace(/__/g, " "); return s.length > 28 ? s.slice(0, 28) + "…" : s; };
