import { useCallback, useMemo } from "react";
import type { ContextPayload } from "../../api";
import { textScale } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart } from "../../components/echart/EChart";
import type { ChartEnv } from "../../components/echart/tokens";
import { Table, type Column } from "../../components/table/Table";
import { dayLabel, num, plural } from "../../format";
import { short, TREND_MIN_SESSIONS } from "./context";
import { weeksLayout, weeksModel, weeksOption } from "./startWeeks";
import "./StartTrend.css";

type Trend = ContextPayload["starting"]["trend"];
type Week = Trend[number];
// The chart's data table: one row per week.
const COLUMNS: Column<Week>[] = [
  { id: "week", header: "Week of", cell: w => dayLabel(w.week, true) },
  { id: "median", header: "Median", align: "num", cell: w => short(w.median) },
  { id: "p25", header: "25th percentile", align: "num", cell: w => short(w.p25) },
  { id: "p75", header: "75th percentile", align: "num", cell: w => short(w.p75) },
  { id: "sessions", header: "Sessions", align: "num", cell: w => num(w.sessions) },
];
const FEW_TEXT = "Rests on few sessions";

/** What the chart reads at a week, in words: "Week of Nov 2: median 24k tokens (25th to 75th percentile 20k to 31k), 9 sessions". */
const readWeek = (w: Week) =>
  `Week of ${dayLabel(w.week)}: median ${short(w.median)} tokens (25th to 75th percentile ${short(w.p25)} to ${short(w.p75)}), ${plural(w.sessions, "session")}`
  + (w.sessions < TREND_MIN_SESSIONS ? ", which rests on few sessions" : "");

/** The view's median starting context per week of session start with its 25th to 75th percentile band. Weeks sit by date: a
 *  week with no session is a slot of its own, a gap in the line, and is read as "no session started". A week under
 *  TREND_MIN_SESSIONS sessions is drawn as a hollow dot. The figures and the option are startWeeks.ts'; <EChart> owns the keys,
 *  the pointer, the tooltip and the live sentence. view: the page's key. */
export function StartTrend({ trend, view }: { trend: Trend; view: string }) {
  const m = useMemo(() => weeksModel(trend), [trend]);
  // One function per set of figures and text size: a new one is drawn, laid out at the scale the box has.
  const scale = textScale();
  const option = useCallback((env: ChartEnv) => weeksOption(m, { ...env, textScale: scale }), [m, scale]);
  if (!m.slots.length) return null;
  const first = trend[0]!, last = trend.at(-1)!;
  const label = (trend.length > 1
    ? `Median starting context per week: ${short(first.median)} tokens the week of ${dayLabel(first.week)}, ${short(last.median)} the week of ${dayLabel(last.week)}. `
    : `Median starting context, the only week: ${short(first.median)} tokens the week of ${dayLabel(first.week)}. `)
    + `The band shows the 25th to 75th percentile. Use the left and right arrow keys to read each week, Escape to dismiss it.`;
  const read = (i: number) => {
    const w = m.weeks[i];
    return w ? readWeek(w) : `Week of ${dayLabel(m.slots[i]!)}: no session started.`;
  };
  const tip = (i: number) => {
    const w = m.weeks[i];
    return <>
      <div className="muted">Week of {dayLabel(m.slots[i]!)}</div>
      {w ? <>
        <div className="row"><span>Median</span><b>{short(w.median)}</b></div>
        <div className="row"><span>25th to 75th percentile</span><b>{short(w.p25)} to {short(w.p75)}</b></div>
        <div className="row"><span>Sessions</span><b>{num(w.sessions)}</b></div>
        {w.sessions < TREND_MIN_SESSIONS && <div className="muted">{FEW_TEXT}</div>}
      </> : <div className="muted">No session started</div>}
    </>;
  };

  return (
    <div className="start-trend">
      <div className="legend">
        <span className="key"><i className="line" />Median start</span>
        <span className="key"><i className="band" />25th to 75th percentile</span>
        <span className="key muted">hollow dot: fewer than {TREND_MIN_SESSIONS} sessions</span>
      </div>
      {/* Each slot's week is its key: a week that joins before the first keeps the reading on its week. */}
      <EChart label={label} height={weeksLayout(scale).height} option={option} view={view} pointKeys={m.slots} points={m.slots.length}
        tip={tip} read={read} />
      <ChartTable><Table name="Median starting context per week of session start" rows={trend} columns={COLUMNS} rowId={w => w.week} /></ChartTable>
    </div>
  );
}
