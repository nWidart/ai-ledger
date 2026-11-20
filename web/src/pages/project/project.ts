// Pure derivations of the Project page: what the Errors block and the Limits block show, taken from the payloads the Errors and
// Limits pages read, through the same model functions, so a figure cannot differ from its page's.
import type { ContextOverhead, ContextPayload, LimitsPayload, OverheadPart, Source, Ts } from "../../api";
import { windowName } from "../limits/limits";
import { DEFAULT_VIEW } from "../errors/view";
import { compare, filtered, rate, sumCalls, TOPN, typeRows, type Delta, type Model, type TypeRow } from "../errors/model";

export interface ErrorTypeRow { cid: string; label: string; n: number; rate: number | null; delta: Delta; row: TypeRow }
export interface ErrorsBlock {
  /** Failed tool calls and all tool calls in the view; rate is a percent, null with no call. */
  errors: number; calls: number; rate: number | null;
  /** The five most frequent types, in the type table's order, with the comparison's words ("vs previous 30 days"). */
  types: ErrorTypeRow[]; cmp: string;
}

/** The Errors page's default view (day granularity, subagents in, noise shown) for the project, range and source. The page's
 *  other filters belong to the Errors page and are not in the Project page's URL. */
export const errorsView = (v: { project: string; range: number; source: Source | "" }) => ({ ...DEFAULT_VIEW, project: v.project, range: v.range as typeof DEFAULT_VIEW.range, source: v.source });

/** The project's errors as the Errors page counts them by default: failed calls, their rate, and the top types. */
export function errorsBlock(m: Model, v: { project: string; range: number; source: Source | "" }): ErrorsBlock {
  const view = errorsView(v), f = filtered(m, view), calls = sumCalls(view, f.calls), errors = f.errs.length;
  const types = typeRows(m, view, f).slice(0, TOPN).map(row => ({ cid: row.cid, label: m.cats[row.cid]?.label ?? row.cid, n: row.n, rate: row.rate, delta: row.delta, row }));
  return { errors, calls, rate: rate(errors, calls), types, cmp: compare(m, view, f).cmp };
}

export interface LimitWindowRow { key: string; name: string; share: number; points: number | null }
export interface LimitCommitRow { key: string; name: string; commits: number; points: number; commitsPerPoint: number }
export interface LimitsBlock { windows: LimitWindowRow[]; commits: LimitCommitRow[] }

/** The project's part of the plan limits: its share of each open window that names it among the top three users, and the
 *  commits per point of each limit with a figure for it. null when there is neither. A project outside a window's top three
 *  has no row there: the payload does not say its share. */
export function limitsBlock(d: LimitsPayload, project: string): LimitsBlock | null {
  const windows = d.windows.flatMap(w => {
    const r = w.used?.projects.find(p => p.project === project);
    return r ? [{ key: `${w.provider}-${w.limit_id}-${w.scope}-${w.start}`, name: windowName(w), share: r.share, points: r.points }] : [];
  });
  const commits = d.value.projects.flatMap(p => p.project === project && p.commits_per_point != null
    ? [{ key: `${p.provider}-${p.label}`, name: windowName(p), commits: p.commits, points: p.points, commitsPerPoint: p.commits_per_point }] : []);
  return windows.length || commits.length ? { windows, commits } : null;
}

export const GRID_CELLS = 200;
/** The overhead categories' colors: one per category, in the snapshot's order (Claude Code's own, so stable), then again. */
export const PART_TONES = 7;
/** A cell's color: the starting context whole, one overhead category (p0…), the rest of the start, the peak's part, free. */
export type GridTone = "start" | `p${number}` | "rest" | "added" | "free";
/** One part of the grid, in cell order. key: "start", "part:<category>", "rest", "added" or "free". cells: how many it fills. */
export interface GridRow { key: string; tone: GridTone; label: string; tokens: number | null; share: number; cells: number }
/** What the legend says of the snapshot. deferred: the deferred tools' tokens, not in the context. overflow: the categories
 *  exceed the median start, so the start is split among them alone. */
export interface GridOverhead { ts: Ts; model: string | null; deferred: number; overflow: boolean; top: ContextOverhead["top"] }
export interface ContextGridModel {
  start: number; added: number; free: number; rows: GridRow[]; window: number | null; sessions: number;
  /** null without a snapshot: the start is one part. */
  overhead: GridOverhead | null;
}

export const REST_LABEL = "First prompt and other";

/** Counts summing exactly to n, in proportion to the weights (largest remainder; a tie goes to the earlier weight). */
export function apportion(n: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map(w => (n * w) / total), out = exact.map(Math.floor);
  let left = n - out.reduce((a, c) => a + c, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; out[i]! += 1; left--; }
  return out;
}

/** The snapshot's overhead: its used categories other than Messages, which are loaded before the first prompt. */
export const overheadParts = (o: ContextOverhead): OverheadPart[] =>
  o.categories.filter(c => c.state === "used" && c.name !== "Messages" && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens }));

/** What the legend says of the snapshot, against the median start (null: none to compare, so no overflow). */
export function gridOverhead(o: ContextOverhead, start: number | null): GridOverhead {
  const sum = overheadParts(o).reduce((a, x) => a + x.tokens, 0);
  return { ts: o.ts, model: o.model, deferred: o.categories.filter(x => x.state === "deferred").reduce((a, x) => a + x.tokens, 0),
    overflow: start != null && sum > start, top: o.top };
}

/** The grid of a typical session: 200 cells of half a percent of the window each, filled for the median start, then for the
 *  median peak less the start, the rest free. null when the start's or the peak's share of the window is not known. With a
 *  snapshot, the start's cells are split among its overhead categories and the rest of the median start ("First prompt and
 *  other"), or among the categories alone when they exceed the median start. */
export function contextGrid(c: ContextPayload): ContextGridModel | null {
  const s = c.starting, p = c.growth.peak;
  const ws = s.window_share, pws = p.window_share;
  if (ws == null || pws == null) return null;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const start = clamp(Math.round(ws * GRID_CELLS), 0, GRID_CELLS);
  const peakCells = clamp(Math.round(pws * GRID_CELLS), start, GRID_CELLS);
  const freeTokens = s.window != null && s.window > 0 && p.median != null ? Math.max(0, s.window - p.median) : null;
  const o = c.overhead ?? null;
  let starts: GridRow[] = [{ key: "start", tone: "start", label: "Starting context", tokens: s.median, share: ws, cells: start }];
  let overhead: GridOverhead | null = null;
  if (o) {
    const parts = overheadParts(o), sum = parts.reduce((a, x) => a + x.tokens, 0), S = s.median;
    overhead = gridOverhead(o, S);
    const overflow = overhead.overflow;
    // Without a median start there is nothing to split.
    if (S != null && S > 0) {
      const whole = overflow ? sum : S;
      const split = [...parts.map((x, i) => ({ key: "part:" + x.name, tone: `p${i % PART_TONES}` as GridTone, label: x.name, tokens: x.tokens })),
        ...(overflow || S - sum <= 0 ? [] : [{ key: "rest", tone: "rest" as GridTone, label: REST_LABEL, tokens: S - sum }])];
      const cells = apportion(start, split.map(x => x.tokens));
      starts = split.map((x, i) => ({ ...x, share: (x.tokens / whole) * ws, cells: cells[i]! }));
    }
  }
  return {
    start, added: peakCells - start, free: GRID_CELLS - peakCells, window: s.window, sessions: Math.max(s.sessions, p.sessions), overhead,
    rows: [
      ...starts,
      { key: "added", tone: "added", label: "Added by the peak", tokens: s.median != null && p.median != null ? Math.max(0, p.median - s.median) : null, share: Math.max(0, Math.min(pws, 1) - ws), cells: peakCells - start },
      { key: "free", tone: "free", label: "Free space", tokens: freeTokens, share: Math.max(0, 1 - pws), cells: GRID_CELLS - peakCells },
    ],
  };
}
