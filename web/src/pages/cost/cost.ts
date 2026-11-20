// Cost's figures from the usage payload: the headline comparison, the daily series and the chart's stack.
import type { Source, Totals, UsagePayload } from "../../api";
import { color, hasHue } from "../../colors";
import { SOURCE_LABELS } from "../../components/Filters";
import { dayRange, mult, num, pct, usd0 } from "../../format";

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
    v[pre] = rest < 1e-9 ? 0 : rest; // float leftovers of the subtraction are not a remainder; a real sub-cent cost is
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

/** The plan gauge's figures for the calendar month: the cost so far (to yesterday) and the pace projection. plan: the listed
 *  plans' monthly price, their names and the pace as a multiple of that price. Only the agents with a listed plan count, so the
 *  multiple does not set another agent's spend against the plan; counted names them when another agent also spent. Without a
 *  plan, or with no spend from an agent that has one, the whole view's figures and no plan. null without a run rate. */
export interface Gauge { now: number; pace: number; plan: { monthly: number; labels: string[]; multiple: number } | null; counted: Source[] | null }
export function gaugeFigures(d: Pick<UsagePayload, "run_rate" | "plans">): Gauge | null {
  const r = d.run_rate;
  if (!r) return null;
  const covered = new Set<Source>(d.plans.map(p => p.provider)), monthly = d.plans.reduce((a, p) => a + p.monthly, 0);
  const mine = r.by_source.filter(s => covered.has(s.source)), pace = mine.reduce((a, s) => a + s.projected, 0);
  if (!monthly || !(pace > 0)) return { now: r.month_cost, pace: r.projected, plan: null, counted: null };
  const partial = r.by_source.some(s => !covered.has(s.source) && s.projected > 0);
  return { now: mine.reduce((a, s) => a + s.month_cost, 0), pace, plan: { monthly, labels: d.plans.map(p => p.label), multiple: pace / monthly },
    counted: partial ? mine.map(s => s.source) : null };
}
/** Agents by name, joined: "Claude Code + Codex". */
export const agentNames = (ss: readonly Source[]): string => ss.map(s => SOURCE_LABELS[s]).join(" + ");

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

/** The tokens chart's scale: each day's volume, or its kinds' shares of that day's tokens (every bar the full height). */
export type TokenScale = "volume" | "share";
export const SCALES: readonly TokenScale[] = ["volume", "share"];

/** A day's value per kind as a fraction of the shown kinds' total; every kind 0 on a day with no tokens. */
export function shares(v: Record<string, number>, kinds: readonly Kind[]): Record<string, number> {
  const sum = kinds.reduce((s, k) => s + (v[k.k] || 0), 0);
  return Object.fromEntries(kinds.map(k => [k.k, sum ? (v[k.k] || 0) / sum : 0]));
}

/** One billed token kind: its tokens and the share of all tokens, its estimated cost (null when unknown) and the share of all cost. */
export interface TokenPair { key: "input" | "output" | "write" | "read"; label: string; c: string; tokens: number; tokenShare: number; cost: number | null; costShare: number | null;
  /** What the row holds beyond its name: thinking inside Output, the two lifetimes inside Cache write. */
  parts: { label: string; tokens: number; cost: number | null }[] }

/** The view's token kinds as billed (thinking inside Output, the two cache write lifetimes joined), each with its share of tokens beside
 *  its share of the estimated cost. Costliest first, by tokens when no request is priced. */
export function tokenPairs(t: Pick<Totals, "tokens" | "cost" | "input" | "output" | "thinking" | "cache_read" | "cache_5m" | "cache_1h" | "cost_input" | "cost_output" | "cost_cache_read" | "cost_cache_5m" | "cost_cache_1h">): TokenPair[] {
  const all = t.tokens || 1, known = t.cost != null && t.cost > 0;
  const sum = (a: number | null, b: number | null) => (a == null || b == null ? null : a + b);
  const row = (key: TokenPair["key"], label: string, c: string, tokens: number, cost: number | null, parts: TokenPair["parts"] = []): TokenPair =>
    ({ key, label, c, tokens, tokenShare: tokens / all, cost, costShare: known && cost != null ? cost / t.cost! : null, parts });
  return [
    row("input", "Input", "var(--series-1)", t.input, t.cost_input),
    row("output", "Output + thinking", "var(--series-2)", t.output, t.cost_output, [{ label: "Thinking", tokens: t.thinking, cost: null }]),
    row("write", "Cache write", "var(--series-5)", t.cache_5m + t.cache_1h, sum(t.cost_cache_5m, t.cost_cache_1h),
      [{ label: "5-minute", tokens: t.cache_5m, cost: t.cost_cache_5m }, { label: "1-hour", tokens: t.cache_1h, cost: t.cost_cache_1h }]),
    row("read", "Cache read", "var(--series-4)", t.cache_read, t.cost_cache_read),
  ].sort((a, b) => (known ? (b.cost ?? 0) - (a.cost ?? 0) : b.tokens - a.tokens));
}
