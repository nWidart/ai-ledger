import { useMemo } from "react";
import type { ContextPayload } from "../../api";
import { useColors } from "../../colors";
import { openProjectSheet } from "../../components/sheets/session";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { num } from "../../format";
import { Proj } from "./cells";
import { share, short, START_LARGE_TOKENS, windowLabel } from "./context";
import "./StartRanges.css";

type Starting = ContextPayload["starting"];

/** Where a 10th to 90th percentile range sits on a track that runs from 0 to `max` tokens: left and width as percentages. */
function rangeBox(p10: number, p90: number, max: number): { left: number; width: number } {
  const left = Math.min(100, Math.max(0, p10 / max * 100));
  return { left, width: Math.max(.6, Math.min(100 - left, (p90 - p10) / max * 100)) };
}

/** The range cell's track on the shared scale, the 10th to 90th percentile bar, a tick at the median, a dashed line at the large-start threshold.
 *  Decorative: the same numbers are in the cells beside it. */
function RangeTrack({ p10, p90, median, max, fill }: { p10: number; p90: number; median: number; max: number; fill: string }) {
  const box = rangeBox(p10, p90, max), at = (v: number) => `${v / max * 100}%`;
  return <div className="rng-track">
    <span className="rng-bar" data-testid="rng-bar" style={{ left: `${box.left}%`, width: `${box.width}%`, background: fill }} />
    <span className="rng-med" style={{ left: at(median) }} />
    <span className="rng-mark" data-testid="rng-mark" style={{ left: at(START_LARGE_TOKENS) }} />
  </div>;
}

/** A row of the table: a project's, or the whole view's (no project, no window label). */
interface StartRow {
  whole: boolean; project: string | null; sessions: number;
  median: number | null; p10: number | null; p90: number | null; window: number | null; window_share: number | null;
}
const PICK: RowPick<StartRow> = {
  value: r => r.project || null, open: v => openProjectSheet(v), subject: r => r.project ? { kind: "project", value: r.project } : undefined,
};
const RANGE_CELL = { className: "num rng", "aria-hidden": true } as const;
const ALL_ROW = { className: "all" };
const figure = (id: string, header: string, f: (r: StartRow) => number | null): Column<StartRow> => ({ id, header, align: "num", cell: r => num(f(r)) });

/** Starting context by project: the median, the 10th and 90th percentile, and a range cell drawing the spread of each row on one token scale. */
export function StartRanges({ starting: s }: { starting: Starting }) {
  const color = useColors();
  // One scale for every row: 0 to the largest 90th percentile (or the threshold, if larger) with a little headroom.
  const max = Math.max(s.p90 ?? 0, ...s.by_project.map(p => p.p90), START_LARGE_TOKENS) * 1.08;
  const columns = useMemo((): Column<StartRow>[] => [
    { id: "project", header: "Project", cellProps: () => ({ className: "name" }), cell: r => r.whole ? "Whole view" : <Proj project={r.project} button={!!r.project} /> },
    // The cell is the track on the row's own td: a whole view with no range leaves a bare td.
    { id: "range", header: null, th: () => <th scope="col" className="rng-head">10th to 90th percentile
      <span className="scale" aria-hidden="true"><span>0</span><span>dashed: {short(START_LARGE_TOKENS)}</span><span>{short(Math.round(max))}</span></span></th>,
    cellProps: r => r.median != null && r.p10 != null && r.p90 != null ? RANGE_CELL : {},
    cell: r => r.median != null && r.p10 != null && r.p90 != null
      ? <RangeTrack p10={r.p10} p90={r.p90} median={r.median} max={max} fill={r.whole ? "var(--text-muted)" : color(r.project)} /> : null },
    figure("median", "Median", r => r.median),
    figure("p10", "10th percentile", r => r.p10),
    figure("p90", "90th percentile", r => r.p90),
    { id: "share", header: "Share of window", align: "num",
      cell: r => <>{share(r.window_share)}{r.window != null && r.window_share != null && <span className="muted small"> of {windowLabel(r.window)}</span>}</> },
    figure("sessions", "Sessions", r => r.sessions),
  ], [max, color]);
  if (!s.by_project.length) return <p className="empty">No session in this view has a measured start.</p>;
  const whole: StartRow = { whole: true, project: null, sessions: s.sessions, median: s.median, p10: s.p10, p90: s.p90, window: null, window_share: s.window_share };
  return <Table name="Starting context by project" className="start-ranges" rows={s.by_project.map((p): StartRow => ({ ...p, whole: false }))} columns={columns}
    rowId={r => r.whole ? "total" : `project:${r.project ?? ""}`} pinned={s.by_project.length > 1 ? [whole] : undefined} pick={PICK}
    rowProps={r => r.whole ? ALL_ROW : {}} />;
}
