import type { ContextPayload } from "../../api";
import { useColors } from "../../colors";
import { DataTable } from "../../components/DataTable";
import { openProjectSheet, pickRow } from "../../components/sheets/session";
import { num } from "../../format";
import { Proj } from "./cells";
import { share, short, START_LARGE_TOKENS, windowLabel } from "./context";
import "./StartRanges.css";

type Starting = ContextPayload["starting"];

/** Where a 10th to 90th percentile range sits on a track that runs from 0 to `max` tokens: left and width as percentages. */
export function rangeBox(p10: number, p90: number, max: number): { left: number; width: number } {
  const left = Math.min(100, Math.max(0, p10 / max * 100));
  return { left, width: Math.max(.6, Math.min(100 - left, (p90 - p10) / max * 100)) };
}

/** The range cell: a track on the shared scale, the 10th to 90th percentile bar, a tick at the median, a dashed line at the large-start threshold.
 *  Decorative: the same numbers are in the cells beside it. */
function RangeCell({ p10, p90, median, max, fill }: { p10: number; p90: number; median: number; max: number; fill: string }) {
  const box = rangeBox(p10, p90, max), at = (v: number) => `${v / max * 100}%`;
  return <td className="num rng" aria-hidden="true"><div className="rng-track">
    <span className="rng-bar" data-testid="rng-bar" style={{ left: `${box.left}%`, width: `${box.width}%`, background: fill }} />
    <span className="rng-med" style={{ left: at(median) }} />
    <span className="rng-mark" data-testid="rng-mark" style={{ left: at(START_LARGE_TOKENS) }} />
  </div></td>;
}

/** Starting context by project: the median, the 10th and 90th percentile, and a range cell drawing the spread of each row on one token scale. */
export function StartRanges({ starting: s }: { starting: Starting }) {
  const color = useColors();
  if (!s.by_project.length) return <p className="empty">No session in this view has a measured start.</p>;
  // One scale for every row: 0 to the largest 90th percentile (or the threshold, if larger) with a little headroom.
  const max = Math.max(s.p90 ?? 0, ...s.by_project.map(p => p.p90), START_LARGE_TOKENS) * 1.08;
  const all = s.by_project.length > 1;
  return (
    <DataTable name="Starting context by project" className="start-ranges">
      <thead><tr><th scope="col">Project</th>
        <th scope="col" className="rng-head">10th to 90th percentile
          <span className="scale" aria-hidden="true"><span>0</span><span>dashed: {short(START_LARGE_TOKENS)}</span><span>{short(Math.round(max))}</span></span></th>
        <th scope="col" className="num">Median</th><th scope="col" className="num">10th percentile</th><th scope="col" className="num">90th percentile</th>
        <th scope="col" className="num">Share of window</th><th scope="col" className="num">Sessions</th></tr></thead>
      <tbody>
        {all && <tr key="total" className="all"><th scope="row" className="name">Whole view</th>
          {s.median != null && s.p10 != null && s.p90 != null ? <RangeCell p10={s.p10} p90={s.p90} median={s.median} max={max} fill="var(--text-muted)" /> : <td />}
          <td className="num">{num(s.median)}</td><td className="num">{num(s.p10)}</td><td className="num">{num(s.p90)}</td>
          <td className="num">{share(s.window_share)}</td><td className="num">{num(s.sessions)}</td></tr>}
        {s.by_project.map(p => <tr key={`project:${p.project ?? ""}`} {...(p.project ? pickRow(p.project, v => openProjectSheet(v)) : {})}>
          <th scope="row" className="name"><Proj project={p.project} button={!!p.project} /></th>
          <RangeCell p10={p.p10} p90={p.p90} median={p.median} max={max} fill={color(p.project)} />
          <td className="num">{num(p.median)}</td><td className="num">{num(p.p10)}</td><td className="num">{num(p.p90)}</td>
          <td className="num">{share(p.window_share)}{p.window != null && p.window_share != null && <span className="muted small"> of {windowLabel(p.window)}</span>}</td>
          <td className="num">{num(p.sessions)}</td></tr>)}
      </tbody>
    </DataTable>
  );
}
