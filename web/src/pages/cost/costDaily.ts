// Cost's daily chart as data (design decision 9): costModel() holds its figures, costOption() the ECharts option drawn from
// them. Both are pure. Types only from the runtime: this module stays out of the ECharts chunk's way. Not costChart.ts: on a
// case-insensitive file system that name clashes with CostChart.tsx.
import type { UsagePayload } from "../../api";
import { niceMax, scaleMargins } from "../../components/chart";
import { baseOption, categoryAxis, pointLabel, SLIDER_ROOM, valueAxis, ZOOM_FROM, zoomSlider } from "../../components/echart/option";
import { stackSeries } from "../../components/echart/stack";
import type { EChartsOption } from "../../components/echart/echarts";
import type { ChartEnv } from "../../components/echart/tokens";
import { big, dayLabel, niceStep, pct, usd, usd0 } from "../../format";
import { costDays, costKinds, KINDS, shares, type CostDay, type Kind, type Stack, type TokenScale } from "./cost";

export type CostMetric = "cost" | "tokens";
/** One series of the option: the series types the runtime registers. */
type Series = Exclude<NonNullable<EChartsOption["series"]>, readonly unknown[]>;

export interface CostModel {
  /** The cost metric (else tokens). */
  cost: boolean;
  /** Tokens on the Share scale: each bar is the day's tokens split by kind, so it fills the plot. */
  share: boolean;
  /** Every token kind is hidden: there is nothing to draw. */
  none: boolean;
  /** The series, bottom of the stack first. */
  kinds: Kind[];
  /** Every day of the view, with the payload's figures. */
  days: CostDay[];
  /** Per day, the sum of its kinds' figures: the bar's value outside Share, and what the average and the peak read. */
  totals: number[];
  /** Per day, the drawn value of each kind, in `kinds` order: its figure, or in Share its fraction of the day. */
  values: number[][];
  /** Whether the 7-day average is drawn: 14 days or more, and not in Share. */
  showAvg: boolean;
  /** Whether the chart can be zoomed, with the slider under it: 14 days or more. */
  zoom: boolean;
  /** Per day, the trailing 7-day mean of the totals, from the seventh day on; null without an average, and for today. */
  avg: (number | null)[];
  /** Today's index: the view ends on a day still in progress. */
  live: number;
  /** The index of the first day with the largest total; null with no days. */
  peak: number | null;
  /** The value axis's top and tick step: 0 to 100% in quarters in Share, round ticks otherwise. */
  axis: { max: number; step: number };
}

/** The chart's figures for a view: its series, its days and what each bar, the average and the peak show. */
export function costModel(d: UsagePayload, metric: CostMetric, hidden: readonly string[], stack: Stack, scale: TokenScale): CostModel {
  const cost = metric === "cost";
  const kinds = cost ? costKinds(d, stack) : KINDS.filter(k => !hidden.includes(k.k));
  const days = costDays(d, cost ? kinds : [], stack);
  const totals = days.map(p => kinds.reduce((s, k) => s + (p.v[k.k] || 0), 0));
  const share = !cost && scale === "share";
  const values = days.map(p => {
    const v = share ? shares(p.v, kinds) : p.v;
    return kinds.map(k => v[k.k] ?? 0);
  });
  // Today is still in progress: the average leaves it out, so the line ends yesterday. A share bar has no total to average.
  const live = days.length - 1;
  const showAvg = days.length >= 14 && !share;
  const avg = days.map((_, i) => (!showAvg || i < 6 || i === live ? null : totals.slice(i - 6, i + 1).reduce((s, t) => s + t, 0) / 7));
  const peak = days.length ? totals.reduce((b, t, i) => (t > totals[b]! ? i : b), 0) : null;
  const axis = share ? { max: 1, step: .25 } : niceMax(Math.max(...totals, 0), niceStep);
  return { cost, share, none: !cost && !kinds.length, kinds, days, totals, values, showAvg, zoom: days.length >= ZOOM_FROM, avg, live, peak, axis };
}

/** The box is this much taller with the slider; CostChart.tsx reads it from here. */
export { SLIDER_ROOM };
/** The plot's margins at the default text size: room for the day labels below and the value labels on the left. */
const MARGIN = { t: 22, r: 8, b: 26, l: 52 };

/** The average line, or its halo: a line over the same data, with no symbols. */
const avgLine = (id: string, data: (number | null)[], color: string, width: number): Series => ({
  type: "line", id, data, z: 3, silent: true, symbol: "none", showSymbol: false, connectNulls: false,
  lineStyle: { color, width, join: "round", cap: "round" }, emphasis: { disabled: true },
});

/** The chart's ECharts option: the stack, the 7-day average (haloed in the surface color so it reads across bars of any hue)
 *  and the peak label. */
export function costOption(m: CostModel, env: ChartEnv): EChartsOption {
  const s = env.textScale, g = scaleMargins(MARGIN, s);
  const fy = m.cost ? usd : big, ty = m.share ? (v: number) => pct(v) : m.cost ? usd0 : big;
  const series: Series[] = [stackSeries({ kinds: m.kinds, values: m.values, hatched: i => i === m.live, env })];
  if (m.showAvg) series.push(avgLine("avg-halo", m.avg, env.ink.surface, 4.5), avgLine("avg", m.avg, env.ink.text, 1.75));
  // The label keeps inside the plot, and a plot narrower than its text draws none (pointLabel).
  const pk = m.peak;
  if (pk != null && !m.share && m.totals[pk]! > 0) {
    const text = `Peak ${fy(m.totals[pk])} · ${dayLabel(m.days[pk]!.day)}${pk === m.live ? " so far" : ""}`;
    series.push({ ...pointLabel(env, { index: pk, value: m.totals[pk]!, text }), id: "peak" });
  }
  // The slider names no window: the wrapper keeps the days shown, and the value axis and the average stay the whole view's.
  return {
    ...baseOption(env),
    grid: { left: g.l, right: g.r, top: g.t, bottom: g.b + (m.zoom ? SLIDER_ROOM : 0) },
    xAxis: categoryAxis(env, m.days.map(p => p.day), day => dayLabel(day)),
    yAxis: valueAxis(env, { ...m.axis, format: ty }),
    series,
    ...(m.zoom ? { dataZoom: [{ ...zoomSlider(env), left: g.l, right: g.r }] } : {}),
  };
}
