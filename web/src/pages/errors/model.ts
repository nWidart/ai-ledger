// Errors data logic, ported from dashboard_template.html: the payload indexed once, then pure functions of it and the view.
// /api/errors returns every error; the page filters on the client, by project and source among others.
import type { Category, Day, ErrorRow, ErrorsPayload, Incident, Source, Ts } from "../../api";
import { dayLabel, num as fmt } from "../../format";
import type { Range } from "../../hash";

export const NOISE = new Set(["infra", "user_denied"]);
export const CATCH_ALL = new Set(["other", "exit_other", "mcp"]); // the types no specific rule matched
export const TOPN = 5;
export const MIN_AFTER_CALLS = 200; // calls since a fix before its rate counts as lower or higher
export const MIN_CMP_CALLS = 200; // tool calls each side of a change needs before the change shows
export const MIN_PCT_ERRORS = 5; // fewer errors than this on either side: a type's change shows as counts, not a percent
export const GAP_FOLD = 8; // a stretch of this many chart buckets or more without a call folds into one
export const LOW_CALLS = 50; // a chart bucket with fewer calls has a noisy rate: marked, and left out of the rate scale
export const PAYLOAD_INPUT = 400; // the payload cuts inputs here; "Show full" loads the rest from /api/error
const DAY = 864e5;
export const toDate = (s: string) => new Date(s + "T00:00:00Z");
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const label = (k: string, long = false) => dayLabel(k, long);
/** A day, with its year when that isn't the year of the payload's today. */
export const yearLabel = (m: Model, k: Day) => dayLabel(k, k.slice(0, 4) !== m.lastDay.slice(0, 4));
export const shortLabel = (s: string) => (s.length > 26 ? s.slice(0, 25) + "…" : s);

export type Gran = "day" | "week";
/** The view the hash holds. source: "" is all; sub: include subagents; noise: hide noise; cat: the open type; focus: the linked example;
 *  at: the chart bucket (as bucketOf returns it) the type table and the detail narrow to; tool: the tool the open type's detail narrows to. */
export interface View { project: string; source: Source | ""; range: Range; gran: Gran; sub: boolean; noise: boolean; cat: string | null; focus: string | null; at: Day | null; tool: string | null }
/** Applied fixes: type id -> YYYY-MM-DD, as the old page stored them. */
export type Fixes = Record<string, Day>;

export type Err = ErrorRow & { c: string };
type CallRow = ErrorsPayload["calls"][number];
export interface Model {
  data: ErrorsPayload; errors: Err[]; cats: Record<string, Category>; byId: Record<string, Err>;
  /** Error types by all-time count: the five busiest keep their color in every view. */
  allRank: string[];
  lastDay: Day; firstDay: Day; incidents: Incident[]; gap: number; maxOk: number;
  /** Every project with errors or tool calls, by all-time errors. */
  projects: [string, number][];
  /** [day, project, category, errors, subagent errors, source] with a category. */
  errorDays: [Day, string, string, number, number, Source][];
}

/** The payload indexed once. A type the rules don't list (or none) still gets a category, named by its id. */
export function makeModel(data: ErrorsPayload): Model {
  const cats: Record<string, Category> = Object.fromEntries(data.categories.map(c => [c.id, c]));
  const known = (c: string | null) => { const id = c ?? "other"; cats[id] ??= { id, label: id, why: "", fix: "", snippet: "" }; return id; };
  const errors = data.errors.map(e => ({ ...e, c: known(e.c) }));
  const errorDays = data.error_days.map(([d, p, c, n, s, src]) => [d, p, known(c), n, s, src] as [Day, string, string, number, number, Source]);
  const byId = Object.fromEntries(errors.filter(e => e.id).map(e => [e.id, e]));
  const allRank = Object.entries(countBy(errors)).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  // Ranges end today on the server, as on Usage.
  const lastDay = data.today || iso(new Date());
  const firstDay = data.calls.reduce((m, c) => (!m || c[0] < m ? c[0] : m), "") || lastDay;
  const count: Record<string, number> = {};
  for (const c of data.calls) count[c[1]] ??= 0;
  for (const e of errors) count[e.p] = (count[e.p] || 0) + 1;
  return { data, errors, cats, byId, allRank, lastDay, firstDay, incidents: data.incidents || [], gap: data.incident_gap_minutes || 10,
    maxOk: data.incident_max_ok ?? 2,
    projects: Object.entries(count).sort((a, b) => b[1] - a[1]), errorDays };
}

export function countBy(errs: readonly { c: string }[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of errs) m[e.c] = (m[e.c] || 0) + 1;
  return m;
}

// ---------- filtering ----------
export const bucketOf = (day: Day, gran: Gran): Day => {
  if (gran === "day") return day;
  const d = toDate(day), wd = (d.getUTCDay() + 6) % 7;
  return iso(new Date(+d - wd * DAY));
};
export const rangeStart = (m: Model, v: View): Day => (v.range ? iso(new Date(+toDate(m.lastDay) - (v.range - 1) * DAY)) : m.firstDay);
/** The errors of the view's selected chart bucket, or all of them with none selected. */
export const inBucket = (v: View, errs: readonly Err[]) => (v.at ? errs.filter(e => bucketOf(e.d, v.gran) === v.at) : errs);
/** The errors of the view's selected tool, or all of them with none selected. Only the type detail applies it: the page's error rate
 *  needs tool calls per tool, which the payload doesn't carry. */
export const inTool = (v: View, errs: readonly Err[]) => (v.tool ? errs.filter(e => e.t === v.tool) : errs);
/** The selected bucket as the page words it: "Mar 3", or "Week of Mar 3". */
export const bucketLabel = (m: Model, v: View) => `${v.gran === "week" ? "Week of " : ""}${yearLabel(m, v.at!)}`;
/** The row's project and source pass the view's filters. */
export const inScope = (v: View, project: string, src: Source) => (!v.project || project === v.project) && (!v.source || src === v.source);
const callIn = (v: View) => (c: CallRow) => inScope(v, c[1], c[4]);
/** start: the range's first day; from: its first day with a tool call (start without any), where charts begin. */
export interface Filtered { start: Day; from: Day; errs: Err[]; calls: CallRow[] }
/** The view's errors and calls, from its first day to the last (today): a day past it, from a clock ahead of the server's,
 *  has no bucket. */
export function filtered(m: Model, v: View): Filtered {
  const start = rangeStart(m, v), scoped = callIn(v), on = (d: Day) => d >= start && d <= m.lastDay;
  const errs = m.errors.filter(e => on(e.d) && inScope(v, e.p, e.src) && (v.sub || !e.sub) && (!v.noise || !NOISE.has(e.c)));
  const calls = m.data.calls.filter(c => on(c[0]) && scoped(c));
  const from = calls.reduce((s, c) => (nCalls(v, c) && (!s || c[0] < s) ? c[0] : s), "") || start;
  return { start, from, errs, calls };
}
/** Tool calls in a [day, project, calls, subagent calls] row, matching the subagent toggle. */
export const nCalls = (v: View, c: CallRow) => (v.sub ? c[2] : c[2] - c[3]);
export const sumCalls = (v: View, arr: readonly CallRow[]) => arr.reduce((s, c) => s + nCalls(v, c), 0);
export function buckets(m: Model, start: Day, gran: Gran): Day[] {
  const out: Day[] = [], seen = new Set<Day>();
  for (let d = toDate(start); d <= toDate(m.lastDay); d = new Date(+d + DAY)) {
    const b = bucketOf(iso(d), gran);
    if (!seen.has(b)) { seen.add(b); out.push(b); }
  }
  return out;
}
export interface Pt { k: Day; e: number; c: number; r: number | null }
export function series(v: View, errs: readonly Err[], calls: readonly CallRow[], keys: readonly Day[], cat?: string | null): Pt[] {
  const e: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0])), c: Record<string, number> = { ...e };
  for (const x of errs) if (!cat || x.c === cat) { const b = bucketOf(x.d, v.gran); if (b in e) e[b]!++; }
  for (const x of calls) { const b = bucketOf(x[0], v.gran); if (b in c) c[b]! += nCalls(v, x); }
  return keys.map(k => ({ k, e: e[k]!, c: c[k]!, r: c[k] ? e[k]! / c[k]! * 100 : null }));
}
/** No calls, no rate: null, never a 0% baseline. */
export const rate = (e: number, c: number): number | null => (c ? e / c * 100 : null);
export interface Delta { text: string; cls: string; title?: string }
/** One side of a comparison: tool calls, errors, and errors per type. */
export interface Tally { c: number; e: number; by: Record<string, number> }
/** What a change compares, the same for the vitals, the table and Rising fastest: this range against the same number of days
 *  just before it. All time has no period before it, so it compares the calls before and since the day that splits its calls
 *  in half (a few early calls can't make a half). why: the reason there's no change to show, or null. */
export interface Compare { a: Tally; b: Tally; cmp: string; why: string | null }
export function compare(m: Model, v: View, f: Filtered): Compare {
  const span = prevSpan(m, v), mid = span ? f.start : midDay(v, f), before = iso(new Date(+toDate(mid) - DAY));
  const [a0, a1] = span ?? [f.start, before], scoped = callIn(v);
  const side = (from: Day, to: Day): Tally => {
    const by: Record<string, number> = {};
    for (const x of errorDays(m, v, from, to)) by[x.c] = (by[x.c] || 0) + x.n;
    return { c: sumCalls(v, m.data.calls.filter(c => c[0] >= from && c[0] <= to && scoped(c))), e: Object.values(by).reduce((s, n) => s + n, 0), by };
  };
  const a = side(a0, a1), b = side(mid, m.lastDay);
  const why = a.c >= MIN_CMP_CALLS && b.c >= MIN_CMP_CALLS ? null
    : span ? `Fewer than ${fmt(MIN_CMP_CALLS)} tool calls in ${a.c < MIN_CMP_CALLS ? `the ${v.range} days before` : "this range"}`
    : `Fewer than ${fmt(MIN_CMP_CALLS)} tool calls ${a.c < MIN_CMP_CALLS ? "before" : "since"} ${yearLabel(m, mid)}`;
  return { a, b, cmp: span ? `vs previous ${v.range} days` : `vs before ${yearLabel(m, mid)}`, why };
}
/** Change of a type's error rate between the sides: "–" with the reason when either side has too few calls; the counts
 *  ("2 → 9") when either side has fewer than MIN_PCT_ERRORS errors, too few for a percent. min: change shown without an arrow. */
export function change(x: Compare, cat: string, min = 0): Delta {
  if (x.why) return { text: "–", cls: "muted", title: x.why };
  const e0 = x.a.by[cat] || 0, e1 = x.b.by[cat] || 0, r0 = e0 / x.a.c * 100, r1 = e1 / x.b.c * 100;
  const title = `Error rate ${x.cmp}: ${fmt(r0, 2)}% → ${fmt(r1, 2)}% (${fmt(e0)} → ${fmt(e1)} errors)`;
  if (e0 < MIN_PCT_ERRORS || e1 < MIN_PCT_ERRORS) return { text: `${fmt(e0)} → ${fmt(e1)}`, cls: "muted", title };
  const d = (r1 - r0) / r0 * 100;
  return { text: `${d > min ? "▲ +" : d < -min ? "▼ " : ""}${fmt(d, 0)}%`, cls: d > min ? "delta-up" : d < -min ? "delta-down" : "muted", title };
}
/** The day that splits the view's calls in half: the calls before it are under half of them. */
export function midDay(v: View, f: Filtered): Day {
  const by: Record<string, number> = {};
  for (const c of f.calls) by[c[0]] = (by[c[0]] || 0) + nCalls(v, c);
  const total = Object.values(by).reduce((s, n) => s + n, 0);
  let acc = 0;
  for (const d of Object.keys(by).sort()) if ((acc += by[d]!) * 2 >= total) return d;
  return f.start;
}

// ---------- per-type counts ----------
/** The view's top types, each with a color: an all-time top-5 type takes its own slot, the rest fill free ones. */
export function typeColors(allRank: readonly string[], top: readonly string[]): Record<string, string> {
  const col: Record<string, number> = {}, used = new Set<number>();
  for (const c of top) { const i = allRank.indexOf(c); if (i >= 0 && i < TOPN) { col[c] = i; used.add(i); } }
  for (const c of top) if (!(c in col)) { let i = 0; while (used.has(i)) i++; col[c] = i; used.add(i); }
  return Object.fromEntries(Object.entries(col).map(([c, i]) => [c, `var(--type-${i + 1})`]));
}
/** Errors per [day, category] from the server's error_days, under the project, source, subagent and noise filters. */
export function errorDays(m: Model, v: View, from: Day, to: Day = "9999") {
  return m.errorDays.filter(r => r[0] >= from && r[0] <= to && inScope(v, r[1], r[5]) && (!v.noise || !NOISE.has(r[2])))
    .map(r => ({ d: r[0], c: r[2], n: v.sub ? r[3] : r[3] - r[4] })).filter(r => r.n);
}
export interface ViewTypes { counts: Record<string, number>; top: string[]; extra: string | null; layers: string[]; colors: Record<string, string> }
/** The view's top types and their colors; a selected type outside them gets its own layer in a neutral ink. */
export function viewTypes(m: Model, v: View, f: Filtered): ViewTypes {
  const counts = countBy(f.errs), top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, TOPN).map(x => x[0]);
  const colors = typeColors(m.allRank, top), extra = v.cat && counts[v.cat] && !top.includes(v.cat) ? v.cat : null;
  if (extra) colors[extra] = "var(--type-sel)";
  return { counts, top, extra, layers: extra ? [...top, extra] : top, colors };
}
export const typeColor = (c: string, vt: ViewTypes) => vt.colors[c] || "var(--type-other)";
/** The same number of days just before the range; all time has none. */
export const prevSpan = (m: Model, v: View): [Day, Day] | null => {
  if (!v.range) return null;
  const s = +toDate(rangeStart(m, v));
  return [iso(new Date(s - v.range * DAY)), iso(new Date(s - DAY))];
};
/** A chart point can be selected unless it stands for a folded stretch without calls. The click, the keys and `settle` share this. */
export const selectable = (p: ChartPt) => !p.to;
/** A selected bucket that isn't a selectable point of the chart the view draws (another granularity, outside the range, before
 *  the first call, inside a fold) clears, so the marker and the filtered lists can't disagree. A hash cat with no errors in the
 *  view's bucket closes, unless an example is linked. A tool with no errors in the open type's bucket (or no open type) clears. */
export function settle(m: Model, v: View): View {
  const f = filtered(m, v);
  if (v.at && !chartData(m, v, f, viewTypes(m, v, f)).pts.some(p => p.k === v.at && selectable(p))) v = { ...v, at: null };
  if (v.cat && !v.focus && !countBy(inBucket(v, f.errs))[v.cat]) v = { ...v, cat: null };
  return v.tool && !(v.cat && inBucket(v, f.errs).some(e => e.c === v.cat && e.t === v.tool)) ? { ...v, tool: null } : v;
}

// ---------- briefing and vitals ----------
export interface Summary {
  totalCalls: number; n: number; r: number | null; r0: number | null; r1: number | null; d: number | null; cmp: string;
  why: string | null; top: string | undefined; vt: ViewTypes; nFix: number; withFix: number; inc: IncSummary; uncat: Uncat;
}
export function summary(m: Model, v: View, f: Filtered, fixes: Fixes): Summary {
  const totalCalls = sumCalls(v, f.calls), n = f.errs.length, r = rate(n, totalCalls), vt = viewTypes(m, v, f);
  const x = compare(m, v, f), r0 = x.why ? null : rate(x.a.e, x.a.c), r1 = x.why ? null : rate(x.b.e, x.b.c);
  const d = r0 && r1 != null ? (r1 - r0) / r0 * 100 : null;
  return { totalCalls, n, r, r0, r1, d, cmp: x.cmp, why: x.why, top: vt.top[0], vt, nFix: Object.keys(fixes).length,
    withFix: Object.keys(vt.counts).filter(c => !fixes[c] && m.cats[c]?.snippet).length, inc: incSummary(m, f.errs), uncat: uncategorized(f.errs) };
}
export interface Uncat { n: number; share: number; bySource: [Source, number, number][] }
/** The catch-all types' errors: all of them, and per source (its catch-all count and share), so a growing catch-all shows.
 *  bySource lists the sources with errors, by name. */
export function uncategorized(errs: readonly Err[]): Uncat {
  const all: Partial<Record<Source, number>> = {}, ca: Partial<Record<Source, number>> = {};
  let n = 0;
  for (const e of errs) {
    all[e.src] = (all[e.src] || 0) + 1;
    if (CATCH_ALL.has(e.c)) { n++; ca[e.src] = (ca[e.src] || 0) + 1; }
  }
  const bySource = (Object.keys(all) as Source[]).sort().map(s => [s, ca[s] || 0, (ca[s] || 0) / all[s]!] as [Source, number, number]);
  return { n, share: errs.length ? n / errs.length : 0, bySource };
}

// ---------- incidents ----------
// The server groups failures into incidents, a retry loop: one tool, one agent (the main thread or one subagent), one error
// type, each failure within incident_gap_minutes of the last and at most incident_max_ok successful calls of that tool apart. A view's incidents come from its errors, so attempts count only the failures that
// pass the filters. outcome is what the agent's next call of that tool did after the last failure ended.
export type Group = Incident & { i: number; errs: Err[] };
export function incidentsOf(m: Model, errs: readonly Err[]): Group[] {
  const g = new Map<number, Group>();
  for (const e of errs) {
    const inc = e.n == null ? undefined : m.incidents[e.n];
    if (e.n == null || !inc) continue;
    let x = g.get(e.n);
    if (!x) g.set(e.n, x = { i: e.n, ...inc, errs: [] });
    x.errs.push(e);
  }
  for (const x of g.values()) x.errs.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)); // the call sequence, in order
  return [...g.values()];
}
export const incSpan = (g: Group) => Math.max(0, Date.parse(g.last ?? "") - Date.parse(g.first ?? "")) || 0;
/** Most attempts first, then the longest, then the latest. */
export const byWeight = (a: Group, b: Group) => b.errs.length - a.errs.length || incSpan(b) - incSpan(a) || ((a.first ?? "") < (b.first ?? "") ? 1 : -1);
// "recovered" means only that the agent's next call of that tool succeeded, so the badge says that.
export const OUTCOME: Record<string, [string, string]> = { recovered: ["Next call OK", "ok"], failed_again: ["Failed again", "warn"], gave_up: ["Gave up", "bad"] };
export const RECOVERED_NOTE = "Recovered means only that the agent's next call of that tool succeeded.";
/** Milliseconds as 42s, 7 min or 1.5 h (this page's own wording). */
export function dur(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${fmt(s / 3600, s < 36000 ? 1 : 0)} h`;
}
/** Time lost per error type: the sum of its incidents' spans, first failure start to last failure end. An incident counts whole
 *  when at least one of its failures is in errs; the span is not clipped to the filtered failures. */
export function timeLost(m: Model, errs: readonly Err[]): Record<string, number> {
  const by: Record<string, number> = {};
  for (const g of incidentsOf(m, errs)) by[g.errs[0]!.c] = (by[g.errs[0]!.c] || 0) + incSpan(g);
  return by;
}
export interface IncSummary { n: number; bad: number; pct: number; groups: Group[] }
/** "1,078 errors in 326 incidents, 3% didn't recover" for a set of errors. */
export function incSummary(m: Model, errs: readonly Err[]): IncSummary {
  const g = incidentsOf(m, errs), bad = g.filter(x => x.outcome !== "recovered").length;
  return { n: g.length, bad, pct: g.length ? bad / g.length * 100 : 0, groups: g };
}

// ---------- main chart ----------
/** to: the last bucket a folded stretch without calls stands for. */
export interface ChartPt { k: Day; c: number; e: number; by: Record<string, number>; other: number; byAll: Record<string, number>; r: number | null; to?: Day }
export function chartData(m: Model, v: View, f: Filtered, vt: ViewTypes) {
  const keys = buckets(m, f.from, v.gran), at = new Map(keys.map((k, i) => [k, i]));
  const pts: ChartPt[] = keys.map(k => ({ k, c: 0, e: 0, by: {}, other: 0, byAll: {}, r: null }));
  for (const x of f.calls) { const i = at.get(bucketOf(x[0], v.gran)); if (i != null) pts[i]!.c += nCalls(v, x); }
  for (const x of errorDays(m, v, f.from, m.lastDay)) {
    const i = at.get(bucketOf(x.d, v.gran)), p = i == null ? undefined : pts[i];
    if (!p) continue;
    p.e += x.n;
    if (vt.layers.includes(x.c)) p.by[x.c] = (p.by[x.c] || 0) + x.n; else p.other += x.n;
    p.byAll[x.c] = (p.byAll[x.c] || 0) + x.n;
  }
  for (const p of pts) p.r = rate(p.e, p.c);
  // A long stretch without a call or an error folds into one bucket, so a few early calls can't push the rest into a corner.
  const out: ChartPt[] = [];
  for (let i = 0; i < pts.length;) {
    let j = i;
    while (j < pts.length && !pts[j]!.c && !pts[j]!.e) j++;
    if (j - i >= GAP_FOLD) { out.push({ ...pts[i]!, to: pts[j - 1]!.k }); i = j; } else { out.push(...pts.slice(i, Math.max(j, i + 1))); i = Math.max(j, i + 1); }
  }
  return { keys: out.map(p => p.k), pts: out };
}
/** A point's rows in the tooltip: the view's layers, then Other. [label, count, color, selected] */
export function pointRows(m: Model, v: View, p: ChartPt, vt: ViewTypes): [string, number, string, boolean][] {
  return [...vt.layers.filter(c => p.by[c]).map(c => [m.cats[c]!.label, p.by[c]!, typeColor(c, vt), c === v.cat] as [string, number, string, boolean]),
    ...(p.other ? [["Other types", p.other, "var(--type-other)", false] as [string, number, string, boolean]] : [])];
}
export const pointWhen = (v: View, p: ChartPt) =>
  p.to ? `${label(p.k, true)} – ${v.gran === "week" ? "week of " : ""}${label(p.to, true)}` : `${v.gran === "week" ? "Week of " : ""}${label(p.k, true)}`;
/** What the keyboard reading of the chart announces for a point. */
export function pointText(m: Model, v: View, p: ChartPt, vt: ViewTypes): string {
  const when = pointWhen(v, p) + (p.k === v.at && !p.to ? " (selected)" : ""), selN = (v.cat && p.byAll[v.cat]) || 0;
  if (!p.c) return `${when}: no activity`;
  return `${when}: ${fmt(p.r, 2)}% rate, ${fmt(p.e)} errors of ${fmt(p.c)} calls. ` + pointRows(m, v, p, vt).map(([l, n]) => `${l} ${fmt(n)}`).join(", ")
    + (v.cat && selN ? `. Selected ${m.cats[v.cat]!.label}: ${fmt(selN)}` : "");
}
/** Rate line: solid across buckets with a value; a bridge over a gap, never a lone dot. */
export function linePath(vals: readonly (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let solid = "", bridge = "", prev: string | null = null, run = 0;
  vals.forEach((v, i) => {
    if (v == null) { run = 0; return; }
    const P = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    if (!run) { if (prev) bridge += `M${prev}L${P}`; solid += `M${P}L${P}`; } else solid += `L${P}`;
    run++; prev = P;
  });
  return { solid, bridge };
}

// ---------- category table ----------
/** lost: the type's time lost in ms (see timeLost). */
export interface TypeRow { cid: string; n: number; lost: number; share: number; color: string; pts: Pt[]; delta: Delta }
export function typeRows(m: Model, v: View, f: Filtered): TypeRow[] {
  const errs = inBucket(v, f.errs), counts = countBy(errs), total = errs.length || 1, vt = viewTypes(m, v, f), keys = buckets(m, f.from, v.gran), x = compare(m, v, f), lost = timeLost(m, errs);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cid, n]) =>
    ({ cid, n, lost: lost[cid] || 0, share: n / total, color: typeColor(cid, vt), pts: series(v, f.errs, f.calls, keys, cid), delta: change(x, cid, 5) }));
}
/** The table's empty row. */
export function emptyTypes(m: Model, v: View, f: Filtered): string {
  if (v.at) return `No errors in this ${v.gran}.`;
  const none = v.project && !m.data.calls.some(c => inScope(v, c[1], c[4])) && !m.errors.some(e => inScope(v, e.p, e.src));
  return none ? `No tool calls recorded for ${v.project}.` : sumCalls(v, f.calls) ? "No errors in this range 🎉" : "No tool calls in this range.";
}

// ---------- detail ----------
export interface Rising { c: string; e1: number; e2: number; r1: number; r2: number; d: number }
/** Where to start: the open types with a ready-made fix that lost the most time (error count breaks a tie), and the types rising fastest: up over 10% in the change the
 *  table shows, with enough recent errors to mean it, the biggest gain in error rate first (a type from 0 to 9 errors can't
 *  outrank one from 1 to 128), Infinity when the side before had none of its errors. why: the reason nothing can rise, or null. */
export function whereToStart(m: Model, v: View, f: Filtered, fixes: Fixes) {
  const counts = countBy(f.errs), x = compare(m, v, f), lost = timeLost(m, f.errs);
  const open = Object.entries(counts).filter(([c]) => !fixes[c] && m.cats[c]?.snippet).map(([c, n]) => ({ c, n, lost: lost[c] || 0 }))
    .sort((a, b) => b.lost - a.lost || b.n - a.n).slice(0, 4);
  const rising: Rising[] = x.why ? [] : Object.keys(x.b.by).map(c => {
    const e1 = x.a.by[c] || 0, e2 = x.b.by[c]!, r1 = e1 / x.a.c * 100, r2 = e2 / x.b.c * 100;
    return { c, e1, e2, r1, r2, d: r1 ? (r2 - r1) / r1 * 100 : Infinity };
  }).filter(r => r.d > 10 && r.e2 >= MIN_PCT_ERRORS).sort((a, b) => b.r2 - b.r1 - (a.r2 - a.r1) || b.e2 - a.e2).slice(0, 4);
  return { open, rising, cmp: x.cmp, why: x.why };
}
export interface Side { name: string; e: number; c: number; r: number | null; empty: string }
export interface BeforeAfter { sides: [Side, Side]; need: number; enough: boolean; verdict: [string, string] }
/** The rate before and since a fix. All time on purpose, so the comparison doesn't shift with the range; project, source and
 *  subagent filters still apply. The verdict waits for enough calls since the fix that the old rate would have produced 5 errors (and at
 *  least MIN_AFTER_CALLS), so a quiet day or two can't read as a win. */
export function beforeAfter(m: Model, v: View, cat: string, fixDay: Day): BeforeAfter {
  const all = m.errors.filter(e => e.c === cat && inScope(v, e.p, e.src) && (v.sub || !e.sub));
  const scoped = m.data.calls.filter(callIn(v));
  const from = scoped.reduce((s, x) => (!s || x[0] < s ? x[0] : s), "");
  const side = (name: string, a: Day, b: Day, empty: string): Side => {
    const e = all.filter(x => x.d >= a && x.d < b).length, c = sumCalls(v, scoped.filter(x => x[0] >= a && x[0] < b));
    return { name, e, c, r: rate(e, c), empty };
  };
  const prev = iso(new Date(+toDate(fixDay) - DAY)), day = (d: Day) => yearLabel(m, d);
  const b4 = side(`Before fix${from && from <= prev ? ` · ${day(from)} – ${day(prev)}` : ""}`, "0000", fixDay, "No calls");
  const af = side(`Since ${day(fixDay)}`, fixDay, "9999", "No calls yet");
  const need = Math.ceil(Math.max(MIN_AFTER_CALLS, b4.r ? 5 / (b4.r / 100) : 0));
  const enough = b4.r != null && af.r != null && af.c >= need;
  // No calls before the fix: nothing to compare with, however many come after.
  const verdict: [string, string] = b4.r == null ? ["No calls before this date", "warn"] : !enough ? ["Not enough calls yet", "warn"]
    : af.r! < b4.r! ? ["Rate lower", "ok"] : af.r! > b4.r! ? ["Rate higher", "bad"] : ["Rate unchanged", "warn"];
  return { sides: [b4, af], need, enough, verdict };
}
/** Where a type happens, by a key of its errors (project, tool, agent): the top five and the rest. keep: a row that shows even
 *  outside the top five (the selected tool), listed after them; folded counts the rows left in the rest. */
export function breakdown(base: readonly Err[], key: (e: Err) => string, keep?: string | null) {
  const by: Record<string, number> = {};
  for (const e of base) by[key(e)] = (by[key(e)] || 0) + 1;
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]), kept = keep ? rows.slice(TOPN).find(r => r[0] === keep) : undefined;
  const top = kept ? [...rows.slice(0, TOPN), kept] : rows.slice(0, TOPN), hidden = rows.slice(TOPN).filter(r => r !== kept);
  return { rows, top, rest: hidden.reduce((s, r) => s + r[1], 0), folded: hidden.length, n: base.length };
}
/** The example search: command, error, follow-up, project and tool. */
export const exHit = (q: string) => { const l = q.toLowerCase(); return (e: Err) => !l || (e.i + e.e + e.r + e.p + e.t).toLowerCase().includes(l); };
export interface ExList { flat: boolean; items: Err[] | Group[] | MsgGroup[]; count: string }
/** The detail's list for a search: errors newest first, or incidents with a matching failure; the linked one first. */
export function exList(base: readonly Err[], groups: readonly Group[], flat: boolean, q: string, focused: Err | undefined, scope = "range"): ExList {
  const hit = exHit(q);
  if (flat) {
    const ex = base.filter(hit);
    if (focused) { const i = ex.indexOf(focused); if (i > 0) { ex.splice(i, 1); ex.unshift(focused); } }
    return { flat, items: ex, count: q ? `${fmt(ex.length)} of ${fmt(base.length)} match` : `${fmt(base.length)} in ${scope}, newest first` };
  }
  const ex = groups.filter(g => g.errs.some(hit)), fi = focused?.n;
  if (fi != null) { const i = ex.findIndex(g => g.i === fi); if (i > 0) ex.unshift(...ex.splice(i, 1)); }
  return { flat, items: ex, count: q ? `${fmt(ex.length)} of ${fmt(groups.length)} match` : `${fmt(groups.length)} in ${scope}, most attempts first` };
}
// ---------- messages ----------
export const NO_TEXT = "(no error text)";
const LABEL_MAX = 120; // the label is the key cut here for display
/** A first line that says nothing alone: "Error:", "Exit code 1", "<tool_use_error>". The next line carries the message. */
const WRAPPER = /^(?:error|exit code \d+|<tool_use_error>)\s*:?$/i;
// The rules, in order: each replaces incidental detail so errors that differ only by it fall together.
const sub = (s: string) => () => s;
const RULES: [RegExp, (m: string) => string][] = [
  // A long quoted string is detail; a short one (a command, a flag) is the message. A quote inside a word (don't) is no quote.
  [/(?<!\w)(["'`])(?:(?!\1).){41,}\1(?!\w)/g, (m: string) => `${m[0]}<…>${m[0]}`],
  // Absolute, ~/, ./ and ../ paths. Not after a word, ":" or "/", so a URL stays whole. A sentence's final dot stays out of the path.
  [/(?<![\w<>:/.~@-])(?:~|\.{1,2})?(?:\/[\w.@+%~-]+)+\/?/g, (m: string) => "<path>" + /\.*$/.exec(m)![0]],
  // Relative paths: two slashes or more, or a final extension, and a letter somewhere ("and/or" and "3/4" are not paths).
  [/(?<![\w<>:/.~@-])(?:[\w.@-]+\/)+[\w.@-]+/g, (m: string) => {
    const t = m.replace(/\.+$/, "");
    return /[A-Za-z]/.test(t) && (t.split("/").length > 2 || /\.\w{1,8}$/.test(t)) ? "<path>" + m.slice(t.length) : m;
  }],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, sub("<id>")], // UUIDs
  [/\b(?:toolu|call|msg|req)_\w{8,}/g, sub("<id>")], // tool-use, message and request ids
  // 7+ hex characters with a digit and a letter: a git hash or an address. Plain digits are a number, plain letters a word.
  [/\b(?:0x)?(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/gi, sub("<id>")],
  // Numbers: line:col, clock times, decimals, thousands, ports, sizes, durations (the unit stays). Not the digits of a word (utf8, sha256, E2BIG).
  [/\b0x[0-9a-f]+\b|(?<![A-Za-z_\d])\d+(?:[.,:]\d+)*/gi, sub("<n>")],
];
export interface Msg { key: string; label: string }
const msgs = new WeakMap<Err, Msg>();
/** An error's group key (its normalized text) and its label (the key cut for display). Computed once per error. */
export function messageOf(e: Err): Msg {
  let r = msgs.get(e);
  if (!r) msgs.set(e, r = normalize(e.e));
  return r;
}
/** The text of the first non-empty line, plus the next non-empty one when the first is only a wrapper; the rules applied; whitespace collapsed. */
export function normalize(text: string): Msg {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let t = lines[0] ?? "";
  if (WRAPPER.test(t) && lines[1]) t += " " + lines[1];
  for (const [re, to] of RULES) t = t.replace(re, to);
  const key = t.replace(/\s+/g, " ").trim() || NO_TEXT;
  return { key, label: key.length > LABEL_MAX ? key.slice(0, LABEL_MAX - 1) + "…" : key };
}
/** One message's errors, newest first, with what the row shows. share: of the grouped errors; tools: by count, then name. */
export interface MsgGroup extends Msg { errs: Err[]; n: number; share: number; last: Ts; projects: number; tools: [string, number][] }
/** The errors grouped by message in one pass: most errors first, the most recent first on a tie. */
export function msgGroups(errs: readonly Err[]): MsgGroup[] {
  const by = new Map<string, Err[]>(), total = errs.length || 1;
  for (const e of errs) { const k = messageOf(e).key, a = by.get(k); if (a) a.push(e); else by.set(k, [e]); }
  return [...by.values()].map(list => {
    list.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const t = new Map<string, number>();
    for (const e of list) t.set(e.t, (t.get(e.t) || 0) + 1);
    return { ...messageOf(list[0]!), errs: list, n: list.length, share: list.length / total, last: list[0]!.ts, projects: new Set(list.map(e => e.p)).size,
      tools: [...t].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)) };
  }).sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}
/** The By message list for a search: the groups with a matching example, the linked example's group first. */
export function msgList(groups: readonly MsgGroup[], q: string, focused: Err | undefined, scope = "range"): ExList {
  const hit = exHit(q), ex = groups.filter(g => g.errs.some(hit)), fk = focused && messageOf(focused).key;
  if (fk != null) { const i = ex.findIndex(g => g.key === fk); if (i > 0) ex.unshift(...ex.splice(i, 1)); }
  return { flat: false, items: ex, count: q ? `${fmt(ex.length)} of ${fmt(groups.length)} match` : `${fmt(groups.length)} message${groups.length === 1 ? "" : "s"} in ${scope}, most errors first` };
}
/** Usage shows the session's own project; only an Errors project or source filter carries over. */
export const sessionHref = (v: View, s: string) =>
  "/usage#" + new URLSearchParams({ range: String(v.range), session: s, ...(v.project && { project: v.project }), ...(v.source && { source: v.source }) });
