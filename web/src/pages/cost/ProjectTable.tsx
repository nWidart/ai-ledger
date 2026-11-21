import { useEffect, useMemo, useRef, useState } from "react";
import type { UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { motion } from "../../components/chart";
import { ExportButtons } from "../../components/ExportButtons";
import { dayStamp } from "../../components/export";
import { ProjectName } from "../../components/ProjectDot";
import { openProjectSheet } from "../../components/sheets/session";
import type { SortBy } from "../../components/Sort";
import { Table, type Column, type RowAttrs, type RowPick } from "../../components/table/Table";
import { tint, ToneKey } from "../../components/tone";
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

const SORT_NAMES: Record<MatrixKey, string> = { project: "project", trend: "trend", cost: "spend", delta: "change", cpc: "cost per commit", hit: "cache hit" };
/** What a sort did, for the status line: "Sorted by spend, highest first". */
export const sortedText = (s: SortBy<MatrixKey>) =>
  `Sorted by ${SORT_NAMES[s.key]}, ${s.key === "project" ? (s.desc ? "Z to A" : "A to Z") : s.desc ? "highest first" : "lowest first"}`;

const NAME_CELL = { className: "name" }, TREND_CELL = { className: "trend-cell" }, SPEND_CELL = { className: "spend" }, CHG_CELL = { className: "chg" };
const projectId = (r: MatrixRow) => r.project ?? "";
/** A row opens its project's sheet; a project-less row too, by its empty name. */
const PICK: RowPick<MatrixRow> = { value: projectId, open: v => openProjectSheet(v), subject: r => ({ kind: "project", value: projectId(r) }) };

/** A change as a bar on one side of a center line, scaled to the largest change of the table. */
const Diverge = ({ v, max, color }: { v: number | null; max: number; color: string }) => {
  const bar = <i style={{ width: `${Math.max(2, Math.abs(v ?? 0) / max * 100)}%`, background: color }} />;
  return <span className="dv" aria-hidden="true"><span className="neg">{v != null && v < 0 && bar}</span><span className="pos">{v != null && v > 0 && bar}</span></span>;
};

/** Project spend and change: each project's daily trend, cost and share, change against the previous period, cost per commit
 *  and cache hit, sortable by any column. Projects too small to compare fold into one row. A row opens the project sheet.
 *  The export also holds tokens, 1h writes, subagent cost share and cost per prompt. */
export function ProjectTable({ d, sort, onSort, spot: pin, onSpot, smallOpen, onSmallOpen }: {
  d: UsagePayload; sort: SortBy<MatrixKey>; onSort: (s: SortBy<MatrixKey>) => void; spot: CostSpot | null; onSpot: (s: CostSpot | null) => void;
  smallOpen: boolean; onSmallOpen: (open: boolean) => void;
}) {
  const color = useColors(), [body, setBody] = useState<HTMLTableSectionElement | null>(null);
  const rows = useMemo(() => projectMatrix(d), [d]), m = useMemo(() => projectMedians(d.by_project), [d]), many = m.n >= 3;
  const total = d.totals.cost || 0, prev = !!d.previous && !!d.start, range = d.range;
  // The table sorts here, not in Table: the folded projects follow the big ones in the same order, and the export keeps it.
  const { head, small } = useMemo(() => foldMatrix(sortMatrix(rows, sort), m.big, total), [rows, sort, m, total]), fold = small.length > 0;
  const forced = small.some(r => r.project === pin?.spot), open = fold && (smallOpen || forced);
  const ps = [...head, ...small], spot = pin ? ps.find(r => r.project === pin.spot) : undefined;
  const maxCost = Math.max(...ps.map(r => r.cost || 0), 0) || 1, maxDelta = Math.max(...ps.map(r => Math.abs(r.delta ?? 0)), 0) || 1;
  // A sort says what it did, politely: aria-sort alone is read only when focus lands on the header. The one region follows the
  // table's sort whoever set it (a header, Compare projects, Sort by cost again, a new view's reset), each set is a new object, and
  // the text is cleared first, so a sort that reads as the last one did is said again.
  const [said, setSaid] = useState(""), mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setSaid("");
    const f = requestAnimationFrame(() => setSaid(sortedText(sort)));
    return () => cancelAnimationFrame(f);
  }, [sort]);
  const sortBy = (s: SortBy<MatrixKey>) => { onSort({ ...s }); onSpot(null); };
  // The outlier row in view and focused once the table shows it.
  useEffect(() => {
    if (!pin || !body) return;
    const row = body.querySelector<HTMLElement>(`tr[data-v="${CSS.escape(pin.spot)}"]`), sect = document.getElementById("projects");
    (row ?? sect)?.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: row ? "center" : "start" });
    row?.querySelector("button")?.focus({ preventScroll: true });
  }, [pin, body]);

  const exported = ps.map(r => [r.project, r4(r.cost), r.p?.tokens ?? 0, r4(r.hit), r4(r.p?.write_1h_share ?? null), r4(r.p?.subagent_cost_share ?? null),
    r.p?.commits ?? 0, r4(r.cpc), r4(r.p ? perPrompt(r.p) : null), r4(r.delta)]);
  const columns = useMemo((): Column<MatrixRow, MatrixKey>[] => {
    const cmp = (r: MatrixRow) => !!r.p && m.big.has(r.p);
    const cpcTint = (r: MatrixRow) => !r.p?.commits || r.cpc == null ? null : tint({ v: r.cpc, med: cmp(r) && r.p.commits >= 3 ? m.cpc : null,
      better: "down", kind: "ratio", medText: usd(m.cpc), zeroText: `no cost; median ${usd(m.cpc)} per commit` });
    const hitTint = (r: MatrixRow) => r.hit == null ? null : tint({ v: r.hit, med: cmp(r) ? m.hit : null, better: "up", kind: "points", medText: pct(m.hit) });
    const tinted = (t: ReturnType<typeof tint>) => t ? { className: t.className, title: t.title } : {};
    const cols: (Column<MatrixRow, MatrixKey> | false)[] = [
      { id: "project", header: "Project", sort: "asc", value: r => r.project, cellProps: () => NAME_CELL,
        cell: r => <ProjectName project={r.project}><button type="button" className="cellbtn" title={r.project ?? ""}>{r.project ?? "(no project)"}</button></ProjectName> },
      { id: "trend", header: "Trend", sort: "desc", value: r => r.recent, hide: 0, cellProps: () => TREND_CELL,
        tip: `Daily cost over the view. Sorts by the cost of the last ${RECENT_DAYS} days.`,
        cell: r => <><Trend values={r.trend} color={color(r.project)} /><span className="sr">last {RECENT_DAYS} days {usd(r.recent)}</span></> },
      { id: "cost", header: "Spend", sort: "desc", value: r => r.cost, align: "num", cellProps: () => SPEND_CELL,
        cell: r => <><span className="ibar" aria-hidden="true"><i style={{ width: `${Math.max(2, (r.cost || 0) / maxCost * 100)}%`, background: color(r.project) }} /></span>
          <b>{usd(r.cost)}</b><Unpriced n={r.unpriced} /><span className="pc">{pct(r.share)}</span></> },
      prev && { id: "delta", header: <><span aria-hidden="true">Δ</span><span className="sr">Change</span> vs prev {range}d</>, sort: "desc", value: r => r.delta,
        align: "num", cellProps: () => CHG_CELL,
        cell: r => <><Diverge v={r.delta} max={maxDelta} color={color(r.project)} /><span className="d">{sgn(r.delta)}</span>
          {r.isNew && <span className="chip new" title="No usage in the previous period">new</span>}</> },
      { id: "cpc", header: "Cost / commit", sort: "desc", value: r => r.cpc, align: "num", hide: 0, cellProps: r => tinted(cpcTint(r)),
        cell: r => !r.p?.commits ? <NA /> : <>{usd(r.cpc)}{cpcTint(r)?.mark}</> },
      { id: "hit", header: "Cache hit", sort: "desc", value: r => r.hit, align: "num", hide: 0, cellProps: r => tinted(hitTint(r)),
        cell: r => <>{pct(r.hit)}{hitTint(r)?.mark}</> },
    ];
    return cols.filter(c => c !== false);
  }, [m, prev, range, maxCost, maxDelta, color]);
  const rowProps = (r: MatrixRow): RowAttrs => ({ className: spot === r ? "spot" : undefined });
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
      {pin && <div className="proj-note"><span>Sorted by cost per commit, highest first.</span>
        {spot && <span><ProjectName project={spot.project}><b>{spot.project}</b></ProjectName>: <b>{usd(spot.cpc)}</b> per commit over {plural(spot.p?.commits ?? 0, "commit")}
          {r ? `, ${mult(r)} the median project with 3+ commits (${usd(pin.med)})` : ""}.</span>}
        <button type="button" className="linkish" onClick={() => {
          // The button goes with the note: focus moves to the header the table is now sorted by.
          document.querySelector<HTMLElement>(`#projects th[data-sort="${MATRIX_SORT.key}"] .sortbtn`)?.focus();
          sortBy(MATRIX_SORT);
        }}>Sort by cost again</button></div>}
      <p className="sr" role="status">{said}</p>
      {many && <ToneKey note={`median of the ${m.n} projects with ${pct(OUTLIER_SHARE)}+ of cost or ${COMPARE_PROMPTS}+ prompts`} />}
      <Table name="Project spend and change" className="matrix" rows={head} columns={columns} rowId={projectId} sort={sort} onSort={sortBy} manualSort
        pick={PICK} rowProps={rowProps} body={{ ref: setBody }} empty={ps.length ? undefined : "No usage in this range."}
        after={row => <>{fold && bucket}{open && small.map(row)}</>} />
    </section>
  );
}
