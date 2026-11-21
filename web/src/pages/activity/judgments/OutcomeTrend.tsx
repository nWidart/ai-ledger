import { useCallback, useMemo } from "react";
import type { TrendWeek } from "../../../api";
import { ChartTable } from "../../../components/DataTable";
import { EChart } from "../../../components/echart/EChart";
import type { ChartEnv } from "../../../components/echart/tokens";
import { Table, type Column } from "../../../components/table/Table";
import { HowMeasured } from "../../../components/HowMeasured";
import { dayLabel, num, pct, plural } from "../../../format";
import { FEW_SESSIONS, FEW_TEXT, isFew, TREND_PARTS, trendCounts, trendText } from "./figures";
import { trendModel, trendOption } from "./outcomeWeeks";

const H = 240;
const weekName = (w: TrendWeek, long = false) => `Week of ${dayLabel(w.week, long)}`;
// The chart's data table: each week's sessions, and its count and share per outcome.
const COLUMNS: Column<TrendWeek>[] = [
  { id: "week", header: "Week", cell: wk => weekName(wk, true) },
  { id: "sessions", header: "Sessions", align: "num", cell: wk => num(wk.n) + (isFew(wk) ? " (few)" : "") },
  ...TREND_PARTS.map((p, j): Column<TrendWeek> => ({ id: p.k, header: p.label, align: "num", cell: wk => `${num(trendCounts(wk)[j]!)} · ${pct(wk.n ? trendCounts(wk)[j]! / wk.n : 0)}` })),
];

/** The outcome mix per week of session start, as bars that each fill the plot (100%), stacked best outcome first, with the
 *  week's analysed sessions over each bar. A week with few sessions is drawn at half width: its mix swings on one session. Shown from
 *  2 weeks. Read by pointer or with the arrow keys; the table below holds the same figures. The figures and the option are
 *  outcomeWeeks.ts'; <EChart> owns the keys, the pointer, the tooltip and the readout. A week opens nothing: no activation.
 *  view: the Judgments view on screen (its request URL). */
export function OutcomeTrend({ weeks, view }: { weeks: TrendWeek[]; view: string }) {
  const m = useMemo(() => trendModel(weeks), [weeks]);
  // One function per set of figures: a new one is drawn.
  const option = useCallback((env: ChartEnv) => trendOption(m, env), [m]);
  // The view, and every week's date: weeks without a session are left out, so an older week can join in the middle and move
  // the bars. Newer figures for the same weeks keep the reading; any change to the list of weeks is another view.
  const key = `${view}|${weeks.map(w => w.week).join(",")}`;
  const few = weeks.some(isFew);
  const tip = (i: number) => {
    const cur = weeks[i]!;
    return <>
      <div className="muted">{weekName(cur, true)}</div>
      {trendCounts(cur).map((n, j) => n > 0 && <div key={TREND_PARTS[j]!.k} className="row">
        <span><i style={{ background: TREND_PARTS[j]!.c }} />{TREND_PARTS[j]!.label}</span><b>{num(n)} · {pct(n / cur.n)}</b></div>)}
      <div className="row tot"><span>Analysed sessions</span><b>{num(cur.n)}</b></div>
      {isFew(cur) && <div className="muted">{FEW_TEXT}</div>}
    </>;
  };
  const read = (i: number) => `${weekName(weeks[i]!, true)}: ${trendText(weeks[i]!)}`;
  const total = weeks.reduce((n, wk) => n + wk.n, 0), achieved = weeks.reduce((n, wk) => n + wk.achieved, 0);
  const name = `Outcome mix per week of session start, ${plural(weeks.length, "week")}: ${pct(total ? achieved / total : 0)} of ${plural(total, "analysed session")} fully or mostly achieved. `
    + "Use the left and right arrow keys to read each week.";

  return (
    <section className="panel sect trend" id="trend" aria-labelledby="trendTitle">
      <h2 id="trendTitle">Outcome trend</h2>
      <p className="hint">Each week's analysed sessions by outcome, as shares of that week. The figure over a bar is its sessions.
        <HowMeasured what="the outcome trend" docs="reference/glossary#judgments">Weeks are by session start and begin on Monday. Every bar is 100% of its week, so a
          week of {FEW_SESSIONS - 1} sessions is as tall as a week of 40: read the figure over it. A week with fewer
          than {FEW_SESSIONS} sessions is drawn at half width. On a narrow chart the figures show over every few bars; the table
          below has each week's.</HowMeasured></p>
      <div className="legend" aria-hidden="true">
        {TREND_PARTS.map(p => <span key={p.k} className="key"><i style={{ background: p.c }} />{p.label}</span>)}
        {few && <span className="key"><i className="few" />{`Under ${FEW_SESSIONS} sessions`}</span>}
      </div>
      <EChart label={name} height={H} option={option} view={key} points={weeks.length} tip={tip} read={read} />
      {/* The chart's text alternative: each week's sessions, and its count and share per outcome. */}
      <ChartTable><Table name="Analysed sessions by outcome per week" region="scroll tall" rows={weeks} columns={COLUMNS} rowId={wk => wk.week} /></ChartTable>
    </section>
  );
}
