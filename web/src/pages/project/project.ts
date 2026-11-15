// Pure derivations of the Project page: what the Errors block and the Limits block show, taken from the payloads the Errors and
// Limits pages read, through the same model functions, so a figure cannot differ from its page's.
import type { LimitsPayload, Source } from "../../api";
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
