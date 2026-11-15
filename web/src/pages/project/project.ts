// Pure derivations of the Project page: what the Errors block and the Limits block show, taken from the payloads the Errors and
// Limits pages read, through the same model functions, so a figure cannot differ from its page's.
import type { ContextPayload, LimitsPayload, Source } from "../../api";
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
export interface GridRow { key: "start" | "added" | "free"; label: string; tokens: number | null; share: number }
export interface ContextGridModel { start: number; added: number; free: number; rows: GridRow[]; window: number | null; sessions: number }

/** The grid of a typical session: 200 cells of half a percent of the window each, filled for the median start, then for the
 *  median peak less the start, the rest free. null when the start's or the peak's share of the window is not known. */
export function contextGrid(c: ContextPayload): ContextGridModel | null {
  const s = c.starting, p = c.growth.peak;
  if (s.window_share == null || p.window_share == null) return null;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const start = clamp(Math.round(s.window_share * GRID_CELLS), 0, GRID_CELLS);
  const peakCells = clamp(Math.round(p.window_share * GRID_CELLS), start, GRID_CELLS);
  const freeTokens = s.window != null && s.window > 0 && p.median != null ? Math.max(0, s.window - p.median) : null;
  return {
    start, added: peakCells - start, free: GRID_CELLS - peakCells, window: s.window, sessions: Math.max(s.sessions, p.sessions),
    rows: [
      { key: "start", label: "Starting context", tokens: s.median, share: s.window_share },
      { key: "added", label: "Added by the peak", tokens: s.median != null && p.median != null ? Math.max(0, p.median - s.median) : null, share: Math.max(0, Math.min(p.window_share, 1) - s.window_share) },
      { key: "free", label: "Free space", tokens: freeTokens, share: Math.max(0, 1 - p.window_share) },
    ],
  };
}
