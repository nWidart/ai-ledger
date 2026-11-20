import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { motion } from "../../components/chart";
import { DataTable } from "../../components/DataTable";
import { ExportButtons } from "../../components/ExportButtons";
import { dayStamp } from "../../components/export";
import { ProjectName } from "../../components/ProjectDot";
import { openProjectSheet, pickRow } from "../../components/sheets/session";
import { SortTh, type SortBy } from "../../components/Sort";
import { Toned, ToneKey } from "../../components/tone";
import { mult, num, pct, plural, usd } from "../../format";
import { sgn, thinHistory } from "./cost";
import { NA, r4, Unpriced } from "./drawers";
import { COMPARE_PROMPTS, OUTLIER_SHARE, perPrompt, projectMedians } from "./insights";
import { foldMatrix, MATRIX_SORT, projectMatrix, RECENT_DAYS, sortMatrix, sumKnown, type MatrixKey, type MatrixRow } from "./matrix";

/** From "Compare projects": ring this project, and say how far it sits from the median. The table is sorted by cost per commit. */
export interface CostSpot { spot: string; med: number }

const HEAD = ["Project", "Est. cost (USD)", "Tokens", "Cache hit", "1h writes", "Subagent cost share", "Commits", "Cost per commit (USD)",
  "Cost per prompt (USD)", "Change vs previous (USD)"];

/** A project's daily cost over the view, as a line in its color. */
function Trend({ values, color }: { values: readonly number[]; color: string }) {
  const W = 72, H = 20, max = Math.max(...values, 0) || 1, n = values.length;
  if (n < 2) return null;
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i / (n - 1) * W).toFixed(1)},${(H - 1.5 - v / max * (H - 3)).toFixed(1)}`).join("");
  return <svg className="trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

/** A change as a bar on one side of a center line, scaled to the largest change of the table. */
const Diverge = ({ v, max, color }: { v: number | null; max: number; color: string }) => {
  const bar = <i style={{ width: `${Math.max(2, Math.abs(v ?? 0) / max * 100)}%`, background: color }} />;
  return <span className="dv" aria-hidden="true"><span className="neg">{v != null && v < 0 && bar}</span><span className="pos">{v != null && v > 0 && bar}</span></span>;
};

/** Project spend and change: each project's daily trend, cost and share, change against the previous period, cost per commit
 *  and cache hit, sortable by any column. Projects too small to compare fold into one row. A row opens the project sheet.
 *  Every figure of the old Cost by project table stays in the export. */
export function ProjectTable({ d, sort, onSort, spot: pin, onSpot, smallOpen, onSmallOpen }: {
  d: UsagePayload; sort: SortBy<MatrixKey>; onSort: (s: SortBy<MatrixKey>) => void; spot: CostSpot | null; onSpot: (s: CostSpot | null) => void;
  smallOpen: boolean; onSmallOpen: (open: boolean) => void;
}) {
  const color = useColors(), [body, setBody] = useState<HTMLTableSectionElement | null>(null);
  const rows = useMemo(() => projectMatrix(d), [d]), m = useMemo(() => projectMedians(d.by_project), [d]), many = m.n >= 3;
  const total = d.totals.cost || 0, prev = !!d.previous && !!d.start;
  const { head, small } = foldMatrix(sortMatrix(rows, sort), m.big, total), fold = small.length > 0;
  const forced = small.some(r => r.project === pin?.spot), open = fold && (smallOpen || forced);
  const ps = [...head, ...small], spot = pin ? ps.find(r => r.project === pin.spot) : undefined;
  const maxCost = Math.max(...ps.map(r => r.cost || 0), 0) || 1, maxDelta = Math.max(...ps.map(r => Math.abs(r.delta ?? 0)), 0) || 1;
  const cols = prev ? 6 : 5;
  const th = (k: MatrixKey, label: ReactNode, cls?: string, asc?: boolean, title?: string) =>
    <SortTh k={k} sort={sort} onSort={s => { onSort(s); onSpot(null); }} asc={asc} className={cls} title={title}>{label}</SortTh>;
  // The outlier row in view and focused once the table shows it.
  useEffect(() => {
    if (!pin || !body) return;
    const row = body.querySelector<HTMLElement>(`tr[data-v="${CSS.escape(pin.spot)}"]`), sect = document.getElementById("projects");
    (row ?? sect)?.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: row ? "center" : "start" });
    row?.querySelector("button")?.focus({ preventScroll: true });
  }, [pin, body]);

  const exported = ps.map(r => [r.project, r4(r.cost), r.p?.tokens ?? 0, r4(r.hit), r4(r.p?.write_1h_share ?? null), r4(r.p?.subagent_cost_share ?? null),
    r.p?.commits ?? 0, r4(r.cpc), r4(r.p ? perPrompt(r.p) : null), r4(r.delta)]);
  const row = (r: MatrixRow) => {
    const cmp = !!r.p && m.big.has(r.p), c = color(r.project);
    return <tr key={r.project ?? ""} {...pickRow(r.project ?? "", v => openProjectSheet(v), { kind: "project", value: r.project ?? "" },
      spot === r ? "spot" : "")}>
      <th scope="row" className="name"><ProjectName project={r.project}><button type="button" className="cellbtn" title={r.project ?? ""}>{r.project ?? "(no project)"}</button></ProjectName></th>
      <td className="opt trend-cell"><Trend values={r.trend} color={c} /><span className="sr">last {RECENT_DAYS} days {usd(r.recent)}</span></td>
      <td className="num spend"><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, (r.cost || 0) / maxCost * 100)}%`, background: c }} /></span>
        <b>{usd(r.cost)}</b><Unpriced n={r.unpriced} /><span className="pc">{pct(r.share)}</span></td>
      {prev && <td className="num chg"><Diverge v={r.delta} max={maxDelta} color={c} /><span className="d">{sgn(r.delta)}</span>
        {r.isNew && <span className="chip new" title="No usage in the previous period">new</span>}</td>}
      {!r.p || !r.p.commits ? <td className="num opt"><NA /></td> : r.cpc == null ? <td className="num opt">{usd(null)}</td>
        : <Toned v={r.cpc} text={usd(r.cpc)} med={cmp && r.p.commits >= 3 ? m.cpc : null} better="down" kind="ratio" medText={usd(m.cpc)} zeroText={`no cost; median ${usd(m.cpc)} per commit`} opt />}
      {r.hit == null ? <td className="num opt">{pct(null)}</td>
        : <Toned v={r.hit} text={pct(r.hit)} med={cmp ? m.hit : null} better="up" kind="points" medText={pct(m.hit)} opt />}
    </tr>;
  };
  const smallCost = sumKnown(small, r => r.cost), smallDelta = small.some(r => r.delta == null) ? null : small.reduce((a, r) => a + r.delta!, 0);
  const bucket = <tr key="small-projects" className="small-bucket"><th scope="row" className="name"><b>Small projects ({small.length})</b>{" "}
    <button type="button" className="linkish" aria-expanded={open} disabled={forced} title={forced ? "A ringed project is small" : undefined}
      onClick={() => onSmallOpen(!open)}>{open ? "Hide small projects" : `Show ${small.length} small projects`}</button></th>
    <td className="opt" /><td className="num spend"><b>{usd(smallCost)}</b><Unpriced n={small.reduce((a, r) => a + r.unpriced, 0)} />
      <span className="pc">{pct(smallCost == null || !total ? null : smallCost / total)}</span></td>
    {prev && <td className="num chg"><Diverge v={smallDelta} max={maxDelta} color={color("")} /><span className="d">{sgn(smallDelta)}</span></td>}
    <td className="opt" /><td className="opt" /></tr>;
  const r = spot?.cpc != null && pin ? spot.cpc / pin.med : null;
  const fresh = rows.filter(x => x.isNew);

  return (
    <section className="panel sect projects" id="projects" aria-labelledby="projTitle">
      <div className="chart-head">
        <div><h2 id="projTitle">Project spend and change <span className="count">{num(rows.length)}</span></h2>
          <div className="hint">{prev ? `Estimated cost by project, and its change against the previous ${d.range} days${fresh.length ? `; ${plural(fresh.length, "project")} marked new` : ""}.`
            : "Estimated cost by project."} Select a project for details.</div></div>
        {ps.length > 0 && <div className="tools-row"><ExportButtons name={`ai-ledger-cost-projects-${dayStamp()}.csv`} headers={HEAD} rows={exported} /></div>}
      </div>
      {prev && thinHistory(d) && <div className="chg-note">The previous {d.range} days have prompts on only {plural(d.previous!.active_days, "day")} against {num(d.totals.active_days)} now,
        so read a change as "more than before", not an exact growth.</div>}
      {pin && <div className="proj-note" role="status"><span>Sorted by cost per commit, highest first.</span>
        {spot && <span><ProjectName project={spot.project}><b>{spot.project}</b></ProjectName>: <b>{usd(spot.cpc)}</b> per commit over {plural(spot.p?.commits ?? 0, "commit")}
          {r ? `, ${mult(r)} the median project with 3+ commits (${usd(pin.med)})` : ""}.</span>}
        <button type="button" className="linkish" onClick={() => { onSort(MATRIX_SORT); onSpot(null); document.querySelector<HTMLElement>("#projects .sortbtn")?.focus(); }}>Sort by cost again</button></div>}
      {many && <ToneKey note={`median of the ${m.n} projects with ${pct(OUTLIER_SHARE)}+ of cost or ${COMPARE_PROMPTS}+ prompts`} />}
      <DataTable name="Project spend and change" className="matrix">
        <thead><tr>{th("project", "Project", undefined, true)}
          {th("trend", "Trend", "opt", false, `Daily cost over the view. Sorts by the cost of the last ${RECENT_DAYS} days.`)}
          {th("cost", "Spend", "num")}
          {prev && th("delta", <><span aria-hidden="true">Δ</span><span className="sr">Change</span> vs prev {d.range}d</>, "num")}
          {th("cpc", "Cost / commit", "num opt")}{th("hit", "Cache hit", "num opt")}</tr></thead>
        <tbody ref={setBody}>{ps.length ? <>{head.map(row)}{fold && bucket}{open && small.map(row)}</>
          : <tr><td colSpan={cols} className="empty">No usage in this range.</td></tr>}</tbody>
      </DataTable>
    </section>
  );
}
