// The Judgments outcome trend as data (echart-activity, decision 9): trendModel() holds its figures, trendOption() the
// ECharts option drawn from them. Both are pure. Types only from the runtime: this module stays out of the ECharts chunk's
// way. Not outcomeTrend.ts: on a case-insensitive file system that name clashes with OutcomeTrend.tsx.
import type { TrendWeek } from "../../../api";
import { scaleMargins } from "../../../components/chart";
import type { EChartsOption, XAXisComponentOption } from "../../../components/echart/echarts";
import { baseOption, categoryAxis, valueAxis } from "../../../components/echart/option";
import { stackSeries } from "../../../components/echart/stack";
import type { ChartEnv } from "../../../components/echart/tokens";
import { dayLabel, num, pct } from "../../../format";
import { isFew, TREND_PARTS, trendCounts } from "./figures";

export interface TrendModel {
  /** The weeks of the view, oldest first, as the payload sends them: weeks without a session are left out. */
  weeks: TrendWeek[];
  /** Per week, each part's share of its analysed sessions, in TREND_PARTS order: they add up to 1, and a part without a
   *  session is 0. */
  shares: number[][];
  /** Per week, its analysed sessions: the count over its bar. */
  counts: number[];
  /** Per week, whether it has fewer than FEW_SESSIONS sessions: its bar is drawn at half width. */
  few: boolean[];
}

/** The trend's figures: every week's shares, count and whether it has few sessions. */
export function trendModel(weeks: readonly TrendWeek[]): TrendModel {
  return {
    weeks: [...weeks],
    shares: weeks.map(w => trendCounts(w).map(n => (w.n ? n / w.n : 0))),
    counts: weeks.map(w => w.n),
    few: weeks.map(isFew),
  };
}

/** The plot's margins at the default text size: the counts above, the week labels below, the percent labels on the left. */
const MARGIN = { t: 20, r: 8, b: 26, l: 40 };

/** A bar's width from its band's: the band less min(6, a quarter of it), at least 1px; half that for a week of few sessions,
 *  centred in the band and in full color, so its parts keep their contrast. */
const barWidth =(few: readonly boolean[]) => (band: number, i: number) => {
  const w = Math.max(1, band - Math.min(6, band * .25));
  return few[i] ? w / 2 : w;
};

/** The chart's ECharts option: one grid, the weeks under the bars, each week's sessions over its bar on a second x axis
 *  (whose labels ECharts thins when they would overlap, as it does the weeks), a 0 to 100% axis in quarters, and one bar per
 *  week that fills the plot, stacked best outcome first. No zoom: the trend never holds more than 26 weeks. */
export function trendOption(m: TrendModel, env: ChartEnv): EChartsOption {
  const s = env.textScale, g = scaleMargins(MARGIN, s);
  const labels = m.weeks.map(w => w.week), count = new Map(m.weeks.map(w => [w.week, w.n]));
  // The sample size: every bar is as tall as the next, so the count says how much each one stands on. It reads no
  // pointer: the first x axis holds the only one.
  const counts: XAXisComponentOption = {
    type: "category",
    position: "top",
    data: labels,
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: env.ink.muted, fontSize: 11 * s, margin: 6 * s, hideOverlap: true, formatter: (week: string) => num(count.get(week) ?? 0) },
    axisPointer: { show: false },
  };
  return {
    ...baseOption(env),
    grid: { left: g.l, right: g.r, top: g.t, bottom: g.b },
    xAxis: [categoryAxis(env, labels, week => dayLabel(week)), counts],
    yAxis: valueAxis(env, { max: 1, step: .25, format: v => pct(v) }),
    series: [stackSeries({
      kinds: TREND_PARTS.map(p => ({ k: p.k, c: p.c })),
      values: m.shares,
      hatched: () => false,
      env,
      width: barWidth(m.few),
    })],
  };
}
