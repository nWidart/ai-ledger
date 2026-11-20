// The project table's rows: each project's spend, daily trend, change against the previous period and efficiency, from
// by_project, changes and daily_projects; their sort and the fold of the small projects.
import type { ProjectRow, UsagePayload } from "../../api";
import { sortRows, type SortBy } from "../../components/Sort";
import { dayRange } from "../../format";
import { OUTLIER_SHARE, perCommit } from "./insights";

/** One project. p: its row in by_project, null for a project used only in the previous period. cost: null when unknown (only
 *  unpriced models); 0 for a project used only before. share: of the view's cost. prev and delta: null without a previous
 *  period, or when unknown. trend: its cost on each day of the view. recent: its cost over the view's last 7 days. */
export interface MatrixRow {
  project: string | null; p: ProjectRow | null; cost: number | null; share: number | null; unpriced: number;
  prev: number | null; delta: number | null; isNew: boolean; trend: number[]; recent: number; cpc: number | null; hit: number | null;
}
export type MatrixKey = "project" | "trend" | "cost" | "delta" | "cpc" | "hit";
export const MATRIX_SORT: SortBy<MatrixKey> = { key: "cost", desc: true };
export const RECENT_DAYS = 7;

type Src = Pick<UsagePayload, "by_project" | "changes" | "daily_projects" | "start" | "end" | "daily" | "totals">;

/** Every project of the view or of its previous period, in by_project's order, then the ones used only before. */
export function projectMatrix(d: Src): MatrixRow[] {
  const days = dayRange(d.start || d.daily[0]?.day || d.end, d.end), at = new Map(days.map((k, i) => [k, i]));
  const trends = new Map<string, number[]>();
  for (const r of d.daily_projects) {
    const i = at.get(r.day), k = r.project ?? "";
    if (i == null) continue;
    if (!trends.has(k)) trends.set(k, days.map(() => 0));
    trends.get(k)![i]! += r.cost || 0;
  }
  const total = d.totals.cost || 0, changes = new Map((d.changes ?? []).map(c => [c.project ?? "", c]));
  const row = (project: string | null, p: ProjectRow | null): MatrixRow => {
    const c = changes.get(project ?? ""), cost = p ? p.cost : 0, trend = trends.get(project ?? "") ?? days.map(() => 0);
    return { project, p, cost, share: cost == null || !total ? null : cost / total, unpriced: p?.unpriced ?? 0,
      prev: c ? c.prev_cost : null, delta: c ? c.delta : null, isNew: !!c?.new && (cost ?? 0) > 0,
      trend, recent: trend.slice(-RECENT_DAYS).reduce((a, v) => a + v, 0), cpc: p ? perCommit(p) : null, hit: p?.cache_hit_ratio ?? null };
  };
  const seen = new Set(d.by_project.map(p => p.project ?? ""));
  const gone = (d.changes ?? []).filter(c => !seen.has(c.project ?? "") && (c.prev_cost ?? 1) !== 0);
  return [...d.by_project.map(p => row(p.project, p)), ...gone.map(c => row(c.project, null))];
}

const GET: Record<MatrixKey, (r: MatrixRow) => number | string | null> = {
  project: r => r.project, trend: r => r.recent, cost: r => r.cost, delta: r => r.delta, cpc: r => r.cpc, hit: r => r.hit,
};
/** The rows in a column's order; rows with no value last either way. */
export const sortMatrix = (rows: readonly MatrixRow[], s: SortBy<MatrixKey>): MatrixRow[] => sortRows(rows, GET[s.key], s.desc);

/** The rows shown above the fold and the small ones folded under them. A row stays above when its project is big enough to
 *  compare (in the medians' set) or its change is at least OUTLIER_SHARE of the view's cost, so a large drop is never hidden.
 *  Folding needs 3+ small rows beside 1+ big one; otherwise every row is in head and small is empty. Sorted rows keep their order. */
export function foldMatrix(sorted: readonly MatrixRow[], big: ReadonlySet<ProjectRow>, total: number): { head: MatrixRow[]; small: MatrixRow[] } {
  const above = (r: MatrixRow) => (!!r.p && big.has(r.p)) || (total > 0 && Math.abs(r.delta ?? 0) >= OUTLIER_SHARE * total);
  const head = sorted.filter(above), small = sorted.filter(r => !above(r));
  return small.length >= 3 && head.length > 0 ? { head, small } : { head: sorted.slice(), small: [] };
}

/** A sum over rows: null when every value is unknown (a bucket of unknown costs is not $0), else the known ones added. */
export const sumKnown = (rows: readonly MatrixRow[], f: (r: MatrixRow) => number | null): number | null =>
  rows.every(r => f(r) == null) ? null : rows.reduce((a, r) => a + (f(r) ?? 0), 0);
