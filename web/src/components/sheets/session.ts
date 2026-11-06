// Pieces the sheets and the pages share: session names, links to Errors, opening a sheet, and the session timeline's model.
import type { MouseEvent } from "react";
import type { SessionDetail, Source, ToolKind } from "../../api";
import { big, num, pct, plural, usd } from "../../format";
import { navigate, setHash } from "../../hash";

// A session's readable name: the title the server took from its first prompt, else its short id. Remembered so a sheet
// can name a session before its details arrive.
const titles = new Map<string, string>();
export const shortId = (id: string) => `#${id.slice(0, 8)}`;
export function sessName(s: { session_id: string; title?: string | null }): string {
  if (s.title) titles.set(s.session_id, s.title);
  return s.title || shortId(s.session_id);
}
export const knownTitle = (id: string): string | undefined => titles.get(id);

/** Opens the project sheet (Back retraces it); from a session sheet it replaces the session. */
export const openProjectSheet = (name: string | null | undefined) => setHash({ inspect: name || null, session: null });
/** Opens the session sheet; over a project or tool sheet, Back returns to it. */
export const openSessionSheet = (id: string) => setHash({ session: id });
/** Opens the sheet of a tool, MCP server or skill in place of any other sheet (Back retraces it). */
export const openToolSheet = (kind: ToolKind, name: string) =>
  setHash({ tool: kind === "tool" ? name : null, mcp: kind === "mcp" ? name : null, skill: kind === "skill" ? name : null, inspect: null, session: null });

/** The Errors page for a project, its range when given, focused on one failure when ex is set, else on type cat. */
export function errorsHref(project: string | null | undefined, range?: number | null, ex?: string, o: { source?: Source | ""; cat?: string | null } = {}): string {
  const p = new URLSearchParams();
  if (project) p.set("project", project);
  if (range != null) p.set("range", String(range));
  if (o.source) p.set("source", o.source);
  if (ex) p.set("ex", ex);
  else if (o.cat) p.set("cat", o.cat);
  const s = String(p);
  return "/errors" + (s ? "#" + s : "");
}
/** Follows an in-app link without a reload; modified clicks open as the browser does. */
export function appLink(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(e.currentTarget.getAttribute("href")!);
}
/** Error loops and commits carry a raw UTC datetime without a zone ("2026-11-04 10:01:00"); read it as UTC. */
export const utc = (ts: string | null | undefined): string | null =>
  !ts ? null : /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(" ", "T") + "Z";

// ---------- timeline ----------
// Context per main-thread request over time, the 80% context line, compactions and commits, and a strip of tool calls on
// the same axis. Idle gaps over 20 minutes are squeezed to a short break so a session resumed the next day still reads.
export const EV_TOP = 8; // events listed before "Show all"
const GAP = 20 * 60e3;

export interface TlReq { t: number; context: number; model: string; cost: number | null }
export interface TlCall { id: string; tool: string; t: number; is_error: boolean; category: string | null; is_commit: boolean }
export type TlEvent =
  | { kind: "fail"; t: number; t1: number; calls: TlCall[] }
  | { kind: "compact"; t: number; t1: number }
  | { kind: "commit"; t: number; t1: number; call: TlCall };

export interface TimelineModel {
  W: number; H: number; m: { l: number; r: number; t: number }; ph: number; iw: number; pb: number; sy: number; sh: number;
  x: (t: number) => number; y: (v: number) => number; yMax: number; limit: number | null; near: number | null; nearShown: boolean;
  reqs: TlReq[]; calls: TlCall[]; comps: number[]; fails: TlCall[]; commits: TlCall[];
  gaps: { a: number; b: number; bx: number }[]; events: TlEvent[]; cmd: Record<string, string>;
  start: number; end: number; maxC: number; summary: string; fmtT: (t: number) => string;
}

export function timelineModel(s: SessionDetail, width: number): TimelineModel | null {
  const i = s.info, limit = i.context_limit || null;
  const reqs: TlReq[] = s.requests.filter(r => !r.subagent && r.ts)
    .map(r => ({ t: Date.parse(r.ts!), context: r.context, model: r.model ?? "", cost: r.cost }));
  const calls: TlCall[] = s.calls.map(c => ({ id: c.id, tool: c.tool, t: Date.parse(c.start_ts || c.end_ts || ""), is_error: c.is_error,
    category: c.category, is_commit: !!c.is_commit })).filter(c => !isNaN(c.t));
  const comps = (s.compaction_ts || []).map(t => Date.parse(t)).filter(t => !isNaN(t));
  const times = [...reqs.map(r => r.t), ...calls.map(c => c.t), ...comps].sort((a, b) => a - b);
  const start = times[0]!, end = times.at(-1)!;
  if (times.length < 2 || end === start) return null;
  const raw: { a: number; b: number }[] = [];
  for (let k = 1; k < times.length; k++) if (times[k]! - times[k - 1]! > GAP) raw.push({ a: times[k - 1]!, b: times[k]! });
  const active = end - start - raw.reduce((n, g) => n + g.b - g.a, 0);
  const keep = Math.max(active * .03, 30e3);
  const ct = (t: number) => t - start - raw.reduce((n, g) => n + (g.b <= t ? g.b - g.a - keep : 0), 0);
  const total = ct(end) || 1;
  const W = Math.max(300, width);
  const m = { l: 40, r: 8, t: 14 }, ph = 130, iw = W - m.l - m.r, pb = m.t + ph, sy = pb + 10, sh = 22, H = sy + sh + 20;
  const x = (t: number) => m.l + ct(t) / total * iw;
  const maxC = Math.max(...reqs.map(r => r.context), 1);
  const yMax = limit && maxC >= .5 * limit ? limit * 1.02 : maxC * 1.15;
  const y = (v: number) => pb - v / yMax * ph;
  const long = end - start > 20 * 3600e3;
  const fmtT = (t: number) => new Date(t).toLocaleString(undefined, long ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
  const near = limit ? .8 * limit : null;
  const cmd: Record<string, string> = Object.fromEntries(s.commits.map(c => [c.tool_use_id, c.command ?? ""]));
  const commits = calls.filter(c => c.is_commit), fails = calls.filter(c => c.is_error);
  // Events: failures grouped while no call succeeds between them, then compactions and commits, in time order.
  const events: TlEvent[] = [];
  let run: Extract<TlEvent, { kind: "fail" }> | null = null;
  for (const c of calls) {
    if (!c.is_error) { run = null; continue; }
    if (!run) events.push(run = { kind: "fail", t: c.t, t1: c.t, calls: [] });
    run.calls.push(c); run.t1 = c.t;
  }
  for (const t of comps) events.push({ kind: "compact", t, t1: t });
  for (const c of commits) events.push({ kind: "commit", t: c.t, t1: c.t, call: c });
  events.sort((a, b) => a.t - b.t || (a.kind === "fail" ? -1 : 1));
  const summary = reqs.length
    ? `Context grew from ${big(reqs[0]!.context)} to a peak of ${big(maxC)} over ${plural(reqs.length, "main-thread request")}; ${plural(calls.length, "tool call")}, ${num(fails.length)} failed.`
    : `${plural(calls.length, "tool call")}, ${num(fails.length)} failed.`;
  return {
    W, H, m, ph, iw, pb, sy, sh, x, y, yMax, limit, near, nearShown: !!near && near <= yMax,
    reqs, calls, comps, fails, commits, events, cmd, start, end, maxC, summary, fmtT,
    gaps: raw.map(g => ({ ...g, bx: x(g.a) + keep / total * iw / 2 })),
  };
}

/** One request read aloud: "Request 3 of 40 · 10:04 · context 120k (60%) · opus-4 · $0.31". */
export function readRequest(tl: TimelineModel, k: number): string {
  const r = tl.reqs[k]!;
  return `Request ${num(k + 1)} of ${num(tl.reqs.length)} · ${tl.fmtT(r.t)} · context ${big(r.context)}${tl.limit ? ` (${pct(r.context / tl.limit)})` : ""}`
    + ` · ${r.model.replace(/^claude-/, "")}${r.cost != null ? ` · ${usd(r.cost)}` : ""}`;
}
/** The request nearest to an x position (xs ascending). */
export function nearestIndex(xs: readonly number[], px: number): number {
  let lo = 0, hi = xs.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid]! < px) lo = mid + 1; else hi = mid; }
  return lo > 0 && px - xs[lo - 1]! < xs[lo]! - px ? lo - 1 : lo;
}

/** A table row that opens something: a click anywhere on it (not on a link, not while selecting text) runs pick with the
 *  row's button, the keyboard target. */
export function pickRow(v: string, pick: (v: string, el: HTMLElement) => void, className = "") {
  return {
    className: "pick" + (className ? " " + className : ""), "data-v": v,
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      if ((e.target as Element).closest("a") || String(window.getSelection() ?? "")) return;
      pick(v, e.currentTarget.querySelector("button") ?? e.currentTarget);
    },
  };
}
