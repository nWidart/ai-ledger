// Errors data logic, ported from dashboard_template.html: the payload indexed once, then pure functions of it and the view.
// /api/errors returns every error; the page filters on the client.
import type { Category, Day, ErrorRow, ErrorsPayload, Incident } from "../../api";
import { dayLabel, num as fmt } from "../../format";
import type { Range } from "../../hash";

export const NOISE = new Set(["infra", "user_denied"]);
export const TOPN = 5;
export const MIN_AFTER_CALLS = 200; // calls since a fix before its rate counts as lower or higher
export const PAYLOAD_INPUT = 400; // the payload cuts inputs here; "Show full" loads the rest from /api/error
const DAY = 864e5;
export const toDate = (s: string) => new Date(s + "T00:00:00Z");
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const label = (k: string, long = false) => dayLabel(k, long);
export const shortLabel = (s: string) => (s.length > 26 ? s.slice(0, 25) + "…" : s);

export type Gran = "day" | "week";
/** The view the hash holds. sub: include subagents; noise: hide noise; cat: the open type; focus: the linked example. */
export interface View { project: string; range: Range; gran: Gran; sub: boolean; noise: boolean; cat: string | null; focus: string | null }
/** Applied fixes: type id -> YYYY-MM-DD, as the old page stored them. */
export type Fixes = Record<string, Day>;

export type Err = ErrorRow & { c: string };
type CallRow = ErrorsPayload["calls"][number];
export interface Model {
  data: ErrorsPayload; errors: Err[]; cats: Record<string, Category>; byId: Record<string, Err>;
  /** Error types by all-time count: the five busiest keep their color in every view. */
  allRank: string[];
  lastDay: Day; firstDay: Day; incidents: Incident[]; gap: number;
  /** Every project with errors or tool calls, by all-time errors. */
  projects: [string, number][];
  /** [day, project, category, errors, subagent errors] with a category. */
  errorDays: [Day, string, string, number, number][];
}

/** The payload indexed once. A type the rules don't list (or none) still gets a category, named by its id. */
export function makeModel(data: ErrorsPayload): Model {
  const cats: Record<string, Category> = Object.fromEntries(data.categories.map(c => [c.id, c]));
  const known = (c: string | null) => { const id = c ?? "other"; cats[id] ??= { id, label: id, why: "", fix: "", snippet: "" }; return id; };
  const errors = data.errors.map(e => ({ ...e, c: known(e.c) }));
  const errorDays = data.error_days.map(([d, p, c, n, s]) => [d, p, known(c), n, s] as [Day, string, string, number, number]);
  const byId = Object.fromEntries(errors.filter(e => e.id).map(e => [e.id, e]));
  const allRank = Object.entries(countBy(errors)).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  // Ranges end today on the server, as on Usage.
  const lastDay = data.today || iso(new Date());
  const firstDay = data.calls.reduce((m, c) => (!m || c[0] < m ? c[0] : m), "") || lastDay;
  const count: Record<string, number> = {};
  for (const c of data.calls) count[c[1]] ??= 0;
  for (const e of errors) count[e.p] = (count[e.p] || 0) + 1;
  return { data, errors, cats, byId, allRank, lastDay, firstDay, incidents: data.incidents || [], gap: data.incident_gap_minutes || 10,
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
export interface Filtered { start: Day; errs: Err[]; calls: CallRow[] }
export function filtered(m: Model, v: View): Filtered {
  const start = rangeStart(m, v);
  const errs = m.errors.filter(e => e.d >= start && (!v.project || e.p === v.project) && (v.sub || !e.sub) && (!v.noise || !NOISE.has(e.c)));
  const calls = m.data.calls.filter(c => c[0] >= start && (!v.project || c[1] === v.project));
  return { start, errs, calls };
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
/** Change from rate a to rate b: "–" when either half has no calls, "New" when a is 0 and b isn't, "–" when both are 0.
 *  min: change shown without an arrow. */
export function change(a: number | null, b: number | null, min = 0): Delta {
  if (a == null || b == null) return { text: "–", cls: "muted", title: `Not enough data in the ${a == null ? "first" : "second"} half` };
  if (!a) return b ? { text: "New", cls: "delta-up" } : { text: "–", cls: "muted" };
  const d = (b - a) / a * 100;
  return { text: `${d > min ? "▲ +" : d < -min ? "▼ " : ""}${fmt(d, 0)}%`, cls: d > min ? "delta-up" : d < -min ? "delta-down" : "muted" };
}
/** The middle day of the range: the trend compares the halves on either side. */
export const midDay = (m: Model, f: Filtered) => iso(new Date((+toDate(f.start) + +toDate(m.lastDay)) / 2));

// ---------- per-type counts ----------
/** The view's top types, each with a color: an all-time top-5 type takes its own slot, the rest fill free ones. */
export function typeColors(allRank: readonly string[], top: readonly string[]): Record<string, string> {
  const col: Record<string, number> = {}, used = new Set<number>();
  for (const c of top) { const i = allRank.indexOf(c); if (i >= 0 && i < TOPN) { col[c] = i; used.add(i); } }
  for (const c of top) if (!(c in col)) { let i = 0; while (used.has(i)) i++; col[c] = i; used.add(i); }
  return Object.fromEntries(Object.entries(col).map(([c, i]) => [c, `var(--type-${i + 1})`]));
}
/** Errors per [day, category] from the server's error_days, under the project, subagent and noise filters. */
export function errorDays(m: Model, v: View, from: Day, to: Day = "9999") {
  return m.errorDays.filter(r => r[0] >= from && r[0] <= to && (!v.project || r[1] === v.project) && (!v.noise || !NOISE.has(r[2])))
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
/** A hash cat with no errors in the view closes, unless an example is linked. */
export const settle = (m: Model, v: View): View => (v.cat && !v.focus && !countBy(filtered(m, v).errs)[v.cat] ? { ...v, cat: null } : v);

// ---------- briefing and vitals ----------
export interface Summary {
  totalCalls: number; n: number; r: number | null; r0: number | null; r1: number | null; d: number | null; cmp: string;
  top: string | undefined; vt: ViewTypes; nFix: number; withFix: number; inc: IncSummary;
}
export function summary(m: Model, v: View, f: Filtered, fixes: Fixes): Summary {
  const totalCalls = sumCalls(v, f.calls), n = f.errs.length, r = rate(n, totalCalls), vt = viewTypes(m, v, f);
  // Previous period: the same number of days just before this range. All time compares its two halves instead.
  const span = prevSpan(m, v);
  let r0: number | null, r1: number | null, cmp: string;
  if (span) {
    const pc = sumCalls(v, m.data.calls.filter(c => c[0] >= span[0] && c[0] <= span[1] && (!v.project || c[1] === v.project)));
    r0 = rate(errorDays(m, v, span[0], span[1]).reduce((s, x) => s + x.n, 0), pc); r1 = r; cmp = `vs previous ${v.range} days`;
  } else {
    const mid = midDay(m, f);
    r0 = rate(f.errs.filter(e => e.d < mid).length, sumCalls(v, f.calls.filter(c => c[0] < mid))); cmp = "vs the first half";
    r1 = rate(f.errs.filter(e => e.d >= mid).length, sumCalls(v, f.calls.filter(c => c[0] >= mid)));
  }
  const d = r0 && r1 != null ? (r1 - r0) / r0 * 100 : null;
  return { totalCalls, n, r, r0, r1, d, cmp, top: vt.top[0], vt, nFix: Object.keys(fixes).length,
    withFix: Object.keys(vt.counts).filter(c => !fixes[c] && m.cats[c]?.snippet).length, inc: incSummary(m, f.errs) };
}

// ---------- incidents ----------
// The server groups failures into incidents: one tool, one session (main thread or subagents), one error type, each failure
// within incident_gap_minutes of the last. A view's incidents come from its errors, so attempts count only the failures that
// pass the filters. outcome is what the tool's next call in that session did after the last failure.
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
// "recovered" means only that the tool's next call in that session succeeded, so the badge says that.
export const OUTCOME: Record<string, [string, string]> = { recovered: ["Next call OK", "ok"], failed_again: ["Failed again", "warn"], gave_up: ["Gave up", "bad"] };
export const RECOVERED_NOTE = "Recovered means only that the tool's next call in that session succeeded.";
/** Milliseconds as 42s, 7 min or 1.5 h (this page's own wording). */
export function dur(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${fmt(s / 3600, s < 36000 ? 1 : 0)} h`;
}
export interface IncSummary { n: number; bad: number; pct: number; groups: Group[] }
/** "1,078 errors in 326 incidents, 3% didn't recover" for a set of errors. */
export function incSummary(m: Model, errs: readonly Err[]): IncSummary {
  const g = incidentsOf(m, errs), bad = g.filter(x => x.outcome !== "recovered").length;
  return { n: g.length, bad, pct: g.length ? bad / g.length * 100 : 0, groups: g };
}

// ---------- main chart ----------
export interface ChartPt { k: Day; c: number; e: number; by: Record<string, number>; other: number; byAll: Record<string, number>; r: number | null }
export function chartData(m: Model, v: View, f: Filtered, vt: ViewTypes) {
  const keys = buckets(m, f.start, v.gran), at = new Map(keys.map((k, i) => [k, i]));
  const pts: ChartPt[] = keys.map(k => ({ k, c: 0, e: 0, by: {}, other: 0, byAll: {}, r: null }));
  for (const x of f.calls) { const i = at.get(bucketOf(x[0], v.gran)); if (i != null) pts[i]!.c += nCalls(v, x); }
  for (const x of errorDays(m, v, f.start)) {
    const i = at.get(bucketOf(x.d, v.gran)), p = i == null ? undefined : pts[i];
    if (!p) continue;
    p.e += x.n;
    if (vt.layers.includes(x.c)) p.by[x.c] = (p.by[x.c] || 0) + x.n; else p.other += x.n;
    p.byAll[x.c] = (p.byAll[x.c] || 0) + x.n;
  }
  for (const p of pts) p.r = rate(p.e, p.c);
  return { keys, pts };
}
/** A point's rows in the tooltip: the view's layers, then Other. [label, count, color, selected] */
export function pointRows(m: Model, v: View, p: ChartPt, vt: ViewTypes): [string, number, string, boolean][] {
  return [...vt.layers.filter(c => p.by[c]).map(c => [m.cats[c]!.label, p.by[c]!, typeColor(c, vt), c === v.cat] as [string, number, string, boolean]),
    ...(p.other ? [["Other types", p.other, "var(--type-other)", false] as [string, number, string, boolean]] : [])];
}
export const pointWhen = (v: View, p: ChartPt) => `${v.gran === "week" ? "Week of " : ""}${label(p.k, true)}`;
/** What the keyboard reading of the chart announces for a point. */
export function pointText(m: Model, v: View, p: ChartPt, vt: ViewTypes): string {
  const when = pointWhen(v, p), selN = (v.cat && p.byAll[v.cat]) || 0;
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
export interface TypeRow { cid: string; n: number; share: number; color: string; pts: Pt[]; delta: Delta }
export function typeRows(m: Model, v: View, f: Filtered): TypeRow[] {
  const counts = countBy(f.errs), total = f.errs.length || 1, vt = viewTypes(m, v, f), keys = buckets(m, f.start, v.gran);
  const mid = midDay(m, f), c1 = sumCalls(v, f.calls.filter(c => c[0] < mid)), c2 = sumCalls(v, f.calls.filter(c => c[0] >= mid));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cid, n]) => {
    const e1 = f.errs.filter(e => e.c === cid && e.d < mid).length;
    return { cid, n, share: n / total, color: typeColor(cid, vt), pts: series(v, f.errs, f.calls, keys, cid), delta: change(rate(e1, c1), rate(n - e1, c2), 5) };
  });
}
/** The table's empty row. */
export function emptyTypes(m: Model, v: View, f: Filtered): string {
  const none = v.project && !m.data.calls.some(c => c[1] === v.project) && !m.errors.some(e => e.p === v.project);
  return none ? `No tool calls recorded for ${v.project}.` : sumCalls(v, f.calls) ? "No errors in this range 🎉" : "No tool calls in this range.";
}

// ---------- detail ----------
export interface Rising { c: string; e1: number; e2: number; d: number }
/** Where to start: the biggest open types with a ready-made fix, and the types rising fastest (second half against the first,
 *  among types with enough recent errors to mean it). */
export function whereToStart(m: Model, v: View, f: Filtered, fixes: Fixes) {
  const counts = countBy(f.errs);
  const open = Object.entries(counts).filter(([c]) => !fixes[c] && m.cats[c]?.snippet).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const mid = midDay(m, f), c1 = sumCalls(v, f.calls.filter(c => c[0] < mid)), c2 = sumCalls(v, f.calls.filter(c => c[0] >= mid));
  const rising: Rising[] = Object.keys(counts).map(c => {
    const e1 = f.errs.filter(e => e.c === c && e.d < mid).length, e2 = counts[c]! - e1, r1 = rate(e1, c1), r2 = rate(e2, c2);
    return { c, e1, e2, d: r1 == null || r2 == null ? null : r1 ? (r2 - r1) / r1 * 100 : Infinity };
  }).filter((x): x is Rising => x.d != null && x.d > 10 && x.e2 >= 5).sort((a, b) => b.d - a.d || b.e2 - a.e2).slice(0, 4);
  return { open, rising };
}
export interface Side { name: string; e: number; c: number; r: number | null; empty: string }
export interface BeforeAfter { sides: [Side, Side]; need: number; enough: boolean; verdict: [string, string] }
/** The rate before and since a fix. All time on purpose, so the comparison doesn't shift with the range; project and subagent
 *  filters still apply. The verdict waits for enough calls since the fix that the old rate would have produced 5 errors (and at
 *  least MIN_AFTER_CALLS), so a quiet day or two can't read as a win. */
export function beforeAfter(m: Model, v: View, cat: string, fixDay: Day): BeforeAfter {
  const all = m.errors.filter(e => e.c === cat && (!v.project || e.p === v.project) && (v.sub || !e.sub));
  const scoped = m.data.calls.filter(x => !v.project || x[1] === v.project);
  const from = scoped.reduce((s, x) => (!s || x[0] < s ? x[0] : s), "");
  const side = (name: string, a: Day, b: Day, empty: string): Side => {
    const e = all.filter(x => x.d >= a && x.d < b).length, c = sumCalls(v, scoped.filter(x => x[0] >= a && x[0] < b));
    return { name, e, c, r: rate(e, c), empty };
  };
  const prev = iso(new Date(+toDate(fixDay) - DAY));
  const b4 = side(`Before fix${from && from <= prev ? ` · ${label(from)} – ${label(prev)}` : ""}`, "0000", fixDay, "No calls");
  const af = side(`Since ${label(fixDay)}`, fixDay, "9999", "No calls yet");
  const need = Math.ceil(Math.max(MIN_AFTER_CALLS, b4.r ? 5 / (b4.r / 100) : 0));
  const enough = b4.r != null && af.r != null && af.c >= need;
  const verdict: [string, string] = !enough ? ["Not enough calls yet", "warn"] : af.r! < b4.r! ? ["Rate lower", "ok"] : af.r! > b4.r! ? ["Rate higher", "bad"] : ["Rate unchanged", "warn"];
  return { sides: [b4, af], need, enough, verdict };
}
/** Where a type happens, by project: the top five and the rest. */
export function byProject(base: readonly Err[]) {
  const rows = Object.entries(countBy(base.map(e => ({ c: e.p })))).sort((a, b) => b[1] - a[1]);
  return { rows, top: rows.slice(0, 5), rest: rows.slice(5).reduce((s, r) => s + r[1], 0), n: base.length };
}
/** The type's three busiest tools. */
export const topTools = (base: readonly Err[]) =>
  Object.entries(base.reduce<Record<string, number>>((s, e) => (s[e.t] = (s[e.t] || 0) + 1, s), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
/** The example search: command, error, follow-up, project and tool. */
export const exHit = (q: string) => { const l = q.toLowerCase(); return (e: Err) => !l || (e.i + e.e + e.r + e.p + e.t).toLowerCase().includes(l); };
export interface ExList { flat: boolean; items: Err[] | Group[]; count: string }
/** The detail's list for a search: errors newest first, or incidents with a matching failure; the linked one first. */
export function exList(base: readonly Err[], groups: readonly Group[], flat: boolean, q: string, focused: Err | undefined): ExList {
  const hit = exHit(q);
  if (flat) {
    const ex = base.filter(hit);
    if (focused) { const i = ex.indexOf(focused); if (i > 0) { ex.splice(i, 1); ex.unshift(focused); } }
    return { flat, items: ex, count: q ? `${fmt(ex.length)} of ${fmt(base.length)} match` : `${fmt(base.length)} in range, newest first` };
  }
  const ex = groups.filter(g => g.errs.some(hit)), fi = focused?.n;
  if (fi != null) { const i = ex.findIndex(g => g.i === fi); if (i > 0) ex.unshift(...ex.splice(i, 1)); }
  return { flat, items: ex, count: q ? `${fmt(ex.length)} of ${fmt(groups.length)} match` : `${fmt(groups.length)} in range, most attempts first` };
}
/** Usage shows the session's own project; only an Errors project filter carries over. */
export const sessionHref = (v: View, s: string) => "/usage#" + new URLSearchParams({ range: String(v.range), session: s, ...(v.project && { project: v.project }) });
