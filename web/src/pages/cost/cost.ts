// Cost's figures from the usage payload: the headline comparison, the daily series and the chart's stack.
import type { Change, UsagePayload } from "../../api";
import { color, hasHue } from "../../colors";
import { dayRange, mult, num, pct, usd0 } from "../../format";

/** A series in the chart: a token kind, or a project ("p:<name>"; "p:" is Other). */
export interface Kind { k: string; label: string; c: string; project?: string }
export const KINDS: Kind[] = [
  { k: "input", label: "Input", c: "var(--series-1)" },
  { k: "text_out", label: "Output", c: "var(--series-2)" },
  { k: "thinking", label: "Thinking", c: "var(--series-3)" },
  { k: "cache_read", label: "Cache read", c: "var(--series-4)" },
  { k: "cache_5m", label: "Cache write 5m", c: "var(--series-5)" },
  { k: "cache_1h", label: "Cache write 1h", c: "var(--series-6)" },
];

/** One day of the view: its cost, unpriced requests, and a value per series key (token kinds, plus the stacked projects). */
export interface CostDay { day: string; cost: number; unpriced: number; v: Record<string, number> }

/** Every day of the view, with zeros for idle days. tops: the stacked projects; Other ("p:") takes the remainder of the
 *  day's cost, never below zero from rounding. */
export function costDays(d: Pick<UsagePayload, "start" | "end" | "daily" | "daily_projects">, tops: readonly Kind[] = []): CostDay[] {
  const have = new Map(d.daily.map(r => [r.day, r])), byDay = new Map<string, Map<string, number>>();
  for (const r of d.daily_projects) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Map());
    byDay.get(r.day)!.set(r.project ?? "", r.cost || 0);
  }
  return dayRange(d.start || d.daily[0]?.day || d.end, d.end).map(day => {
    const r = have.get(day), pd = byDay.get(day), cost = r?.cost || 0;
    const v: Record<string, number> = {
      input: r?.input || 0, text_out: (r?.output || 0) - (r?.thinking || 0), thinking: r?.thinking || 0,
      cache_read: r?.cache_read || 0, cache_5m: r?.cache_5m || 0, cache_1h: r?.cache_1h || 0,
    };
    let named = 0;
    for (const t of tops) if (t.project) { v[t.k] = pd?.get(t.project) || 0; named += v[t.k]!; }
    if (tops.some(t => t.k === "p:")) v["p:"] = Math.max(0, cost - named);
    return { day, cost, unpriced: r?.unpriced || 0, v };
  });
}

/** The cost chart's stack: the projects that own a hue (the all-time busiest) by spend in this view, then Other in grey for
 *  everyone else, so a color means the same project in every range. One project selected: just that project. */
export function costKinds(d: Pick<UsagePayload, "project" | "by_project">): Kind[] {
  if (d.project) return [{ k: "p:" + d.project, label: d.project, c: color(d.project), project: d.project }];
  const spent = d.by_project.filter(p => (p.cost ?? 0) > 0).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
  const tops = spent.filter(p => hasHue(p.project)).map(p => ({ k: "p:" + p.project, label: p.project!, c: color(p.project), project: p.project! }));
  const rest = spent.length - tops.length;
  return rest ? [...tops, { k: "p:", label: `Other (${num(rest)})`, c: color(""), project: "" }] : tops;
}

/** A period's estimated cost: 0 when it had no requests, null (unknown) when all of them were on unpriced models. */
export const periodCost = (p: { cost: number | null; requests: number }): number | null => (p.requests ? p.cost : 0);
/** A cost that may be unknown: "–", else as usd0 ("$0" for nothing). */
export const money = (n: number | null | undefined): string => (n == null ? "–" : usd0(n));

/** The headline's comparison: "17.8× the previous 30 days" from 2× up, a percentage below; sr: the same, read aloud. */
export function compareText(d: Pick<UsagePayload, "totals" | "previous" | "range">): { text: string; sr: string } | null {
  const t = d.totals, prev = d.previous;
  if (!prev || !t.requests) return null;
  const was = `the previous ${d.range} days`;
  if (!((prev.cost ?? 0) > 0)) {
    const none = `${prev.requests ? "no priced usage" : "nothing"} in ${was}`;
    return { text: none, sr: none };
  }
  const r = (t.cost || 0) / prev.cost!;
  if (Math.abs(r - 1) < .005) return { text: `flat vs ${was}`, sr: `flat versus ${was}` };
  if (r >= 2) return { text: `${mult(r)} ${was}`, sr: `${num(r, 1)} times ${was}` };
  const up = r > 1;
  return { text: `${up ? "+" : "−"}${pct(Math.abs(r - 1))} vs ${was}`, sr: `${up ? "up" : "down"} ${pct(Math.abs(r - 1))} versus ${was}` };
}

/** The previous window has usage on fewer than half as many days as this one, so its multiple says little. */
export const thinHistory = (d: Pick<UsagePayload, "totals" | "previous" | "range">): boolean =>
  !!d.previous && d.previous.active_days < Math.min(d.totals.active_days, d.range) / 2;

/** Projects whose cost moved, biggest move first (the server's order). */
export const moved = (d: Pick<UsagePayload, "changes">): Change[] => (d.changes ?? []).filter(c => c.cost || c.prev_cost);

/** Daily cost across twice the range: the previous period, then this one (all time: the whole history). split: where this one starts. */
export function sparkPoints(d: Pick<UsagePayload, "previous" | "daily" | "start" | "end">): { pts: { k: string; v: number }[]; split: number } | null {
  const prev = d.previous, byDay = new Map<string, number>();
  for (const r of [...(prev?.daily ?? []), ...d.daily]) byDay.set(r.day, (byDay.get(r.day) ?? 0) + (r.cost || 0));
  const first = prev ? prev.start : d.daily[0]?.day;
  if (!first) return null;
  const pts = dayRange(first, d.end).map(k => ({ k, v: byDay.get(k) ?? 0 }));
  if (pts.length < 2) return null;
  return { pts, split: prev && d.start ? Math.max(0, pts.findIndex(p => p.k >= d.start!)) : 0 };
}
