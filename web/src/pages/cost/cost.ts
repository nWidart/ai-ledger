// Cost's figures from the usage payload: the headline comparison, the daily series and the chart's stack.
import type { Change, Source, UsagePayload } from "../../api";
import { color, hasHue } from "../../colors";
import { SOURCE_LABELS } from "../../components/Filters";
import { dayRange, mult, num, pct, usd, usd0 } from "../../format";

/** A series in the chart: a token kind, or one of a cost stacking's ("p:<project>", "m:<model>", "s:<source>"; the bare
 *  prefix is Other). project and source: the filter the legend key sets. */
export interface Kind { k: string; label: string; c: string; project?: string; source?: Source }
export const KINDS: Kind[] = [
  { k: "input", label: "Input", c: "var(--series-1)" },
  { k: "text_out", label: "Output", c: "var(--series-2)" },
  { k: "thinking", label: "Thinking", c: "var(--series-3)" },
  { k: "cache_read", label: "Cache read", c: "var(--series-4)" },
  { k: "cache_5m", label: "Cache write 5m", c: "var(--series-5)" },
  { k: "cache_1h", label: "Cache write 1h", c: "var(--series-6)" },
];

/** What the cost chart stacks by: the project, the model or the agent (the session's source). */
export type Stack = "project" | "model" | "source";
export const STACKS: readonly Stack[] = ["project", "model", "source"];
const PREFIX: Record<Stack, string> = { project: "p:", model: "m:", source: "s:" };
/** The stacking in words, for titles and hints; label: its switch button. */
export const STACK_WORD: Record<Stack, { label: string; noun: string }> = {
  project: { label: "Project", noun: "project" }, model: { label: "Model", noun: "model" }, source: { label: "Agent", noun: "agent" },
};
/** The series that holds the rest of a stacking (a bare prefix). */
export const isOther = (k: Kind): boolean => k.k.length === 2;

/** One day of the view: its cost, unpriced requests, a value per series key (token kinds, plus the stacked series), and
 *  with Other stacked, the names inside it, costliest first. */
export interface CostDay { day: string; cost: number; unpriced: number; v: Record<string, number>; other?: { name: string; cost: number }[] }

type StackRows = Partial<Pick<UsagePayload, "daily_projects" | "daily_models" | "daily_sources">>;
/** The per-day cost rows of a stacking, named (a project with no name is ""). */
const stackRows = (d: StackRows, by: Stack): { day: string; name: string; cost: number }[] =>
  (by === "project" ? (d.daily_projects ?? []).map(r => ({ ...r, name: r.project ?? "" }))
    : by === "model" ? (d.daily_models ?? []).map(r => ({ ...r, name: r.model }))
      : (d.daily_sources ?? []).map(r => ({ ...r, name: r.source }))).map(r => ({ day: r.day, name: r.name, cost: r.cost || 0 }));

/** Every day of the view, with zeros for idle days. tops: the stacked series of stacking `by`; Other (if stacked) takes the
 *  remainder of the day's cost, never below zero from rounding, and lists the names inside it. */
export function costDays(d: Pick<UsagePayload, "start" | "end" | "daily"> & StackRows, tops: readonly Kind[] = [], by: Stack = "project"): CostDay[] {
  const have = new Map(d.daily.map(r => [r.day, r])), byDay = new Map<string, Map<string, number>>(), pre = PREFIX[by];
  for (const r of stackRows(d, by)) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Map());
    byDay.get(r.day)!.set(r.name, r.cost);
  }
  const named = new Set(tops.filter(t => !isOther(t)).map(t => t.k.slice(pre.length)));
  return dayRange(d.start || d.daily[0]?.day || d.end, d.end).map(day => {
    const r = have.get(day), pd = byDay.get(day), cost = r?.cost || 0;
    const v: Record<string, number> = {
      input: r?.input || 0, text_out: (r?.output || 0) - (r?.thinking || 0), thinking: r?.thinking || 0,
      cache_read: r?.cache_read || 0, cache_5m: r?.cache_5m || 0, cache_1h: r?.cache_1h || 0,
    };
    let sum = 0;
    for (const t of tops) if (!isOther(t)) { v[t.k] = pd?.get(t.k.slice(pre.length)) || 0; sum += v[t.k]!; }
    if (!tops.some(isOther)) return { day, cost, unpriced: r?.unpriced || 0, v };
    const rest = cost - sum;
    v[pre] = rest < .005 ? 0 : rest; // float leftovers of the subtraction are not a remainder
    const other = [...(pd ?? [])].filter(([n, c]) => c > 0 && !named.has(n))
      .sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ name: n ? (by === "model" ? n.replace(/^claude-/, "") : n) : "(no project)", cost: c }));
    return { day, cost, unpriced: r?.unpriced || 0, v, other };
  });
}

/** The cost chart's stack. project: the projects that own a hue (the all-time busiest) by spend in this view, then Other in
 *  grey for everyone else, so a color means the same project in every range; one project selected: just that project.
 *  model: the costliest models of the view, one series color each, then Other. source: one series per agent, no Other. */
export function costKinds(d: Pick<UsagePayload, "project" | "by_project"> & StackRows, by: Stack = "project"): Kind[] {
  if (by === "model") return modelKinds(spend(stackRows(d, "model")));
  if (by === "source") return spend(stackRows(d, "source")).filter(r => r.v > 0)
    .map(r => ({ k: PREFIX.source + r.name, label: SOURCE_LABELS[r.name as Source] ?? r.name, c: SOURCE_COLORS[r.name as Source] ?? color(""), source: r.name as Source }));
  if (d.project) return [{ k: "p:" + d.project, label: d.project, c: color(d.project), project: d.project }];
  return projectKinds(d.by_project.map(p => ({ project: p.project, v: p.cost ?? 0 })));
}

const SOURCE_COLORS: Record<Source, string> = { claude: "var(--series-1)", codex: "var(--series-2)" };
/** A stacking's total cost per name over the view, costliest first. */
const spend = (rows: { name: string; cost: number }[]): { name: string; v: number }[] => {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.name, (by.get(r.name) ?? 0) + r.cost);
  return [...by].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v || (a.name < b.name ? -1 : 1));
};
const MODEL_COLORS = 6; // the --series-N colors in theme.css

/** The models of the view with a cost, costliest first: the top few each in a series color, the rest counted in Other (grey). */
function modelKinds(ranked: { name: string; v: number }[]): Kind[] {
  const on = ranked.filter(m => m.v > 0), tops = on.slice(0, MODEL_COLORS);
  const out = tops.map((m, i) => ({ k: PREFIX.model + m.name, label: m.name.replace(/^claude-/, ""), c: `var(--series-${i + 1})` }));
  return on.length > tops.length ? [...out, { k: PREFIX.model, label: `Other (${num(on.length - tops.length)})`, c: color("") }] : out;
}

/** A chart stack of projects with a value, most first: the ones that own a hue in their colors, then Other in grey for
 *  the rest (a project with no name among them), counted. */
export function projectKinds(ranked: readonly { project: string | null; v: number }[]): Kind[] {
  const on = ranked.filter(p => p.v > 0).sort((a, b) => b.v - a.v);
  const tops = on.filter(p => hasHue(p.project)).map(p => ({ k: "p:" + p.project, label: p.project!, c: color(p.project), project: p.project! }));
  const rest = on.length - tops.length;
  return rest ? [...tops, { k: "p:", label: `Other (${num(rest)})`, c: color(""), project: "" }] : tops;
}

/** A period's estimated cost: 0 when it had no requests, null (unknown) when all of them were on unpriced models. */
export const periodCost = (p: { cost: number | null; requests: number }): number | null => (p.requests ? p.cost : 0);
/** A cost that may be unknown: "–", else as usd0 ("$0" for nothing). */
export const money = (n: number | null | undefined): string => (n == null ? "–" : usd0(n));

/** A change in cost with its sign ("+$12", "−$3"), "–" when unknown. */
export const sgn = (v: number | null): string => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + usd0(Math.abs(v)));

/** The plan line: what the plan(s) in the view cost a month, and the list-price cost as a multiple of that price prorated to
 *  the view's days (30 to the month). null without a known plan, a priced cost or days to compare. */
export function planText(d: Pick<UsagePayload, "plans" | "totals" | "range" | "daily" | "end" | "daily_sources">): string | null {
  // Only the agents with a known plan count: the server leaves the others' plans out, so the whole cost would overstate the multiple.
  const covered = new Set<string>(d.plans.map(p => p.provider)), cost = d.daily_sources.reduce((a, r) => a + (covered.has(r.source) ? r.cost || 0 : 0), 0), days = d.range || dayRange(d.daily[0]?.day || d.end, d.end).length, monthly = d.plans.reduce((a, p) => a + p.monthly, 0);
  if (!d.plans.length || !d.totals.requests || !cost || !monthly) return null;
  // When an agent without a plan also spent, name the agents counted, so the multiple does not read as the whole headline cost.
  const partial = d.daily_sources.some(r => !covered.has(r.source) && (r.cost || 0) > 0);
  const what = partial ? `this period's ${d.plans.map(p => SOURCE_LABELS[p.provider]).join(" + ")} use` : "this period";
  return `You pay about ${usd(monthly)} a month (${d.plans.map(p => p.label).join(" + ")}); at list prices ${what} is ${mult(cost / (monthly * days / 30))} your plan${d.plans.length > 1 ? "s" : ""}.`;
}

/** The headline's comparison: "17.8× the previous 30 days" from 2× up, a percentage below; sr: the same, read aloud. */
export function compareText(d: Pick<UsagePayload, "totals" | "previous" | "range">): { text: string; sr: string } | null {
  const t = d.totals, prev = d.previous;
  if (!prev || !t.requests) return null;
  if (t.cost == null) return { text: "no priced usage in this period", sr: "no priced usage in this period" };
  const was = `the previous ${d.range} days`;
  if (!((prev.cost ?? 0) > 0)) {
    const none = `${prev.requests ? "no priced usage" : "nothing"} in ${was}`;
    return { text: none, sr: none };
  }
  const r = t.cost / prev.cost!;
  if (Math.abs(r - 1) < .005) return { text: `flat vs ${was}`, sr: `flat versus ${was}` };
  if (r >= 2) return { text: `${mult(r)} ${was}`, sr: `${num(r, 1)} times ${was}` };
  const up = r > 1;
  return { text: `${up ? "+" : "−"}${pct(Math.abs(r - 1))} vs ${was}`, sr: `${up ? "up" : "down"} ${pct(Math.abs(r - 1))} versus ${was}` };
}

/** The previous window has usage on fewer than half as many days as this one, so its multiple says little. */
export const thinHistory = (d: Pick<UsagePayload, "totals" | "previous" | "range">): boolean =>
  !!d.previous && d.previous.active_days < Math.min(d.totals.active_days, d.range) / 2;

/** Projects whose cost moved, biggest move first (the server's order). */
export const moved = (d: Pick<UsagePayload, "changes">): Change[] => (d.changes ?? []).filter(c => c.cost !== 0 || c.prev_cost !== 0);

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
