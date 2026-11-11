// Activity's figures from the usage payload: the work per day and what needs attention.
import type { DailyWorkRow, ToolRow, UsagePayload } from "../../api";
import { dayRange } from "../../format";
import { projectKinds, type Kind } from "../cost/cost";

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
  return dayRange(first, d.end).map(day => have.get(day) ?? { day, sessions: 0, prompts: 0, commits: 0, calls: 0, failed_calls: 0 });
}
export const busy = (r: DailyWorkRow) => r.sessions + r.prompts + r.commits + r.failed_calls > 0;

/** The Monday starting the week of a YYYY-MM-DD day. */
export const monday = (k: string): string => {
  const t = new Date(k + "T00:00:00Z");
  return new Date(+t - ((t.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
};
/** The chart's bars: the work rows in the payload's buckets from the first with a session, with zeros for idle ones. Days
 *  as workDays; weeks one per Monday up to the week of the end. */
export function workBuckets(d: Pick<UsagePayload, "start" | "end" | "work" | "work_bucket">): DailyWorkRow[] {
  if (d.work_bucket === "day") return workDays({ start: d.start, end: d.end, daily_work: d.work });
  const have = new Map(d.work.map(r => [r.day, r]));
  const first = monday(d.work.find(r => r.sessions > 0)?.day ?? d.start ?? d.end);
  return dayRange(first, d.end).filter((_, i) => i % 7 === 0)
    .map(day => have.get(day) ?? { day, sessions: 0, prompts: 0, commits: 0, calls: 0, failed_calls: 0 });
}
/** Errors per 100 tool calls; null without calls. */
export const failRate = (r: DailyWorkRow): number | null => (r.calls ? 100 * r.failed_calls / r.calls : null);

type WorkProjectRow = UsagePayload["work_projects"][number];
/** The chart's stack for a metric, as Cost stacks: the projects that own a hue, most of it over the bars first, then Other.
 *  None (plain bars) when the view has a single project or none of its projects has a hue. */
export function workKinds(d: Pick<UsagePayload, "project" | "work_projects">, rows: readonly DailyWorkRow[], metric: WorkMetric): Kind[] {
  if (d.project) return [];
  const on = new Set(rows.map(r => r.day)), by = new Map<string | null, number>();
  for (const r of d.work_projects) if (on.has(r.day)) by.set(r.project, (by.get(r.project) ?? 0) + r[metric]);
  const ks = projectKinds([...by].map(([project, v]) => ({ project, v })));
  return ks.length > 1 ? ks : [];
}
/** Each bar's value per stack key: a project's own, Other the rest of the bar (never below zero), so the segments add up
 *  to the bar. A session belongs to one project, so sessions add up as well. */
export function workStack(rows: readonly DailyWorkRow[], wp: readonly WorkProjectRow[], kinds: readonly Kind[], metric: WorkMetric): Record<string, number>[] {
  const by = new Map(wp.map(r => [`${r.day} ${r.project ?? ""}`, r[metric]]));
  return rows.map(r => {
    const v: Record<string, number> = {};
    let named = 0;
    for (const k of kinds) if (k.project) { v[k.k] = by.get(`${r.day} ${k.project}`) ?? 0; named += v[k.k]!; }
    if (kinds.some(k => k.k === "p:")) v["p:"] = Math.max(0, r[metric] - named);
    return v;
  });
}

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
