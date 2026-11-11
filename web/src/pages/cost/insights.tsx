// What stands out in the view's spend, each with one way to act on it.
import type { UsagePayload } from "../../api";
import type { Insight } from "../../components/InsightCard";
import { ProjectName } from "../../components/ProjectDot";
import { knownTitle, sessName, shortId } from "../../components/sheets/session";
import { dayLabel, dur, median, mult, num, pct, plural, usd } from "../../format";
import type { CostDay } from "./cost";

export const OUTLIER_SHARE = 0.02;

/** Ways to act on a finding: each opens the sheet or the table that explains it. */
export interface CostActs {
  project: (name: string) => void;
  session: (id: string) => void;
  day: (day: string) => void;
  /** Cost by project, sorted by cost per commit, the outlier ringed. */
  compare: (name: string, med: number) => void;
  tokens: () => void;
}

/** The biggest project by spend (inside one project: the biggest session), warned about when its cost per commit is over
 *  twice the median project's. */
export function spenderInsight(d: UsagePayload, go: CostActs): Insight | null {
  const total = d.totals.cost || 1;
  if (d.project) {
    const s = d.top_sessions.find(x => (x.cost ?? 0) > 0);
    if (!s) return null;
    return { sev: "info", k: "Biggest session", stake: s.cost!, t: <><span title={s.title || s.session_id}>{sessName(s)}</span>{!s.title && s.git_branch ? ` · ${s.git_branch}` : ""}</>,
      v: <>{usd(s.cost)} <span className="muted">{pct(s.cost! / total)}</span></>,
      b: s.commits ? `${usd(s.cost! / s.commits)} per commit over ${plural(s.commits, "commit")}, ${dur(s.duration_s)} long.` : `No commits in ${dur(s.duration_s)}.`,
      act: { label: "Open session", run: () => go.session(s.session_id) } };
  }
  const p = d.by_project.filter(x => (x.cost ?? 0) > 0).sort((a, b) => b.cost! - a.cost!)[0];
  if (!p) return null;
  const med = median(d.by_project.map(x => x.cost_per_commit));
  const high = p.cost_per_commit != null && !!med && p.cost_per_commit > 2 * med;
  return { sev: high ? "warn" : "info", k: "Biggest spender", stake: p.cost!, t: <ProjectName project={p.project} />,
    v: <>{usd(p.cost)} <span className="muted">{pct(p.cost! / total)} of spend</span></>,
    b: p.cost_per_commit != null && p.commits
      ? `${usd(p.cost_per_commit)} per commit over ${plural(p.commits, "commit")}${high ? `, ${mult(p.cost_per_commit / med!)} the median project` : ""}.`
      : "No commits in this range, so no cost per commit.",
    act: { label: "Inspect project", run: () => go.project(p.project ?? "") } };
}

/** Cost per commit against the median: projects with 3+ commits (inside one project, sessions with 2+), so one lucky or
 *  unlucky commit is not an outlier. An outlier costs more than twice the median and holds at least OUTLIER_SHARE of the
 *  spend, so it is worth acting on; four times is critical. */
export function perCommitInsight(d: UsagePayload, go: CostActs): Insight {
  const t = d.totals, unit = d.project ? "session" : "project";
  if (!t.commits) return { sev: "info", k: "Cost per commit", t: "No commits", v: "n/a", b: "No successful commits in this range to divide the spend by.",
    act: { label: "See cost per prompt", run: go.tokens } };
  const pool = d.project
    ? d.sessions.filter(s => s.commits >= 2 && (s.cost ?? 0) > 0).map(s => ({ id: s.session_id, cpc: s.cost! / s.commits, n: s.commits, cost: s.cost! }))
    : d.by_project.filter(p => p.commits >= 3 && (p.cost ?? 0) > 0 && p.cost_per_commit != null)
      .map(p => ({ id: p.project ?? "", cpc: p.cost_per_commit!, n: p.commits, cost: p.cost! }));
  if (pool.length < 3) return { sev: "info", k: "Cost per commit", t: plural(t.commits, "commit"), v: usd(t.cost_per_commit),
    b: `Too few ${unit}s with commits to compare against a median.`, act: { label: "See cost per prompt", run: go.tokens } };
  const med = median(pool.map(x => x.cpc))!, heavy = pool.filter(x => x.cost >= OUTLIER_SHARE * (t.cost || 0));
  const top = (heavy.length ? heavy : pool).reduce((a, b) => (b.cpc > a.cpc ? b : a)), r = heavy.length ? top.cpc / med : 1;
  const label = d.project ? <span title={top.id}>{knownTitle(top.id) || shortId(top.id)}</span> : <ProjectName project={top.id} />;
  const open = d.project ? () => go.session(top.id) : () => go.compare(top.id, med);
  if (r < 2) return { sev: "good", k: "Cost per commit", t: `Median ${usd(med)}`, v: usd(t.cost_per_commit),
    b: `No ${unit} with ${pct(OUTLIER_SHARE)} or more of the spend costs over twice the median per commit (${pool.length} with commits).`, act: { label: d.project ? "Open the priciest session" : "Compare projects", run: open } };
  return { sev: r >= 4 ? "critical" : "warn", k: "Cost-per-commit outlier", stake: top.cost, t: label, v: <>{usd(top.cpc)}<span className="muted"> / commit</span></>,
    b: `${mult(r)} the median ${unit} (${usd(med)}) over ${plural(top.n, "commit")}.`, act: { label: d.project ? "Open session" : "Compare projects", run: open } };
}

/** The costliest day against the median active day. */
export function peakInsight(d: UsagePayload, days: readonly CostDay[], go: CostActs): Insight | null {
  const pts = days.filter(p => p.cost > 0);
  if (!pts.length) return null;
  const peak = pts.reduce((a, b) => (b.cost > a.cost ? b : a)), med = median(pts.map(p => p.cost))!, r = med ? peak.cost / med : 1;
  return { sev: pts.length >= 5 && r >= 3 ? "warn" : "info", k: "Peak day", stake: peak.cost, t: dayLabel(peak.day, true), v: usd(peak.cost),
    b: pts.length > 1 ? `${mult(r)} the median active day (${usd(med)}), ${pct(peak.cost / (d.totals.cost || 1))} of this range.` : "The only active day in this range.",
    act: { label: "Show that day's sessions", run: () => go.day(peak.day) } };
}

/** Cache efficiency and what subagents cost. */
export function cacheInsight(d: UsagePayload, go: CostActs): Insight | null {
  const t = d.totals;
  if (t.cache_hit_ratio == null) return null;
  return { sev: "info", k: "Cache hit", t: t.write_1h_share == null ? "No cache writes" : `${pct(t.write_1h_share)} of writes are 1-hour`, v: pct(t.cache_hit_ratio, 1),
    b: t.subagent_cost_share == null ? "No priced cost to split by subagents." : `Subagents: ${pct(t.subagent_cost_share)} of cost${t.sub_cost ? `, ${usd(t.sub_cost)}` : ""}.`,
    act: { label: "See tokens and cache", run: go.tokens } };
}

/** The phone's metric pair beside the lead finding: active days and cost per commit. */
export const pairFacts = (d: UsagePayload): { v: string; of?: string; l: string }[] => [
  { v: num(d.totals.active_days), of: d.range ? ` / ${d.range}` : undefined, l: `active days${d.previous ? `, ${num(d.previous.active_days)} before` : ""}` },
  { v: d.totals.commits ? usd(d.totals.cost_per_commit) : "n/a", l: `per commit, ${plural(d.totals.commits, "commit")}` },
];
