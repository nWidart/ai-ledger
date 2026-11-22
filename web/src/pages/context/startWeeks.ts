// The weekly start chart as data (echart-context, decision 8): weeksModel() holds its figures, weeksLayout() its box and
// weeksOption() the ECharts option drawn from them. All pure. Types only from the runtime: this module stays out of the
// ECharts chunk's way. Not startTrend.ts: on a case-insensitive file system that name clashes with StartTrend.tsx.
import type { ContextPayload } from "../../api";
import type { EChartsOption, SeriesOption } from "../../components/echart/echarts";
import { baseOption, categoryAxis, lineDots, lineSeries, trackLayout, valueAxis, type TrackLayout } from "../../components/echart/option";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayLabel, niceStep } from "../../format";
import { bandSeries, calendarSlots, thresholdLine } from "./chartParts";
import { short, START_LARGE_TOKENS, TREND_MIN_SESSIONS } from "./context";

type Week = ContextPayload["starting"]["trend"][number];

export interface WeeksModel {
  /** Every week from the first to the last, 7 days apart: the chart's points. */
  slots: string[];
  /** Per slot, its week, or null for a week with no session started. */
  weeks: (Week | null)[];
  /** Per slot, the median, 25th and 75th percentile starting context, null on an empty week. */
  median: (number | null)[];
  p25: (number | null)[];
  p75: (number | null)[];
  /** Per slot, whether its week has fewer than TREND_MIN_SESSIONS sessions: its dot is hollow. */
  few: boolean[];
  /** The y axis: 0 to max in ticks of step. */
  max: number;
  step: number;
  /** Whether the axis reaches START_LARGE_TOKENS: the dashed line is drawn. */
  large: boolean;
}

/** The chart's figures: the weeks placed in their calendar slots, and the y scale. The scale is the highest median or
 *  75th percentile plus 8%, in round steps of a third of it. */
export function weeksModel(trend: readonly Week[]): WeeksModel {
  const slots = trend.length ? calendarSlots(trend[0]!.week, trend.at(-1)!.week, "week") : [];
  const byWeek = new Map(trend.map(w => [w.week, w]));
  const weeks = slots.map(s => byWeek.get(s) ?? null);
  const top = Math.max(...trend.map(w => w.p75), ...trend.map(w => w.median), 1) * 1.08;
  const step = niceStep(top / 3), max = Math.ceil(top / step) * step;
  return {
    slots,
    weeks,
    median: weeks.map(w => w?.median ?? null),
    p25: weeks.map(w => w?.p25 ?? null),
    p75: weeks.map(w => w?.p75 ?? null),
    few: weeks.map(w => w != null && w.sessions < TREND_MIN_SESSIONS),
    max,
    step,
    large: START_LARGE_TOKENS <= max,
  };
}

/** The margins at the default text size: the value labels on the left, the week labels below. */
const MARGIN = { t: 10, r: 14, b: 26, l: 52 };

/** The box: the margins grow with the text, the plot keeps its 144px. */
export const weeksLayout = (textScale: number): TrackLayout =>
  trackLayout(textScale, { margin: MARGIN, tracks: [{ fixed: 144 }], gap: 0, slider: false });

/** The chart's ECharts option: one grid where the layout puts it, the week slots under it, and over the band (runs of
 *  neighbouring weeks, a span for a lone week) the dashed 30k line when the axis reaches it, the median on its halo, and
 *  the dots: hollow for a week of few sessions, solid for a week no line reaches. */
export function weeksOption(m: WeeksModel, env: ChartEnv): EChartsOption {
  const l = weeksLayout(env.textScale), axes = { xAxisIndex: 0, yAxisIndex: 0 }, x = categoryAxis(env, m.slots, week => dayLabel(week));
  const median = lineSeries(env, { id: "median", data: m.median, color: "var(--text-primary)", ...axes });
  const series: SeriesOption[] = [
    bandSeries(env, { id: "band", lo: m.p25, hi: m.p75, color: env.ink.secondary, opacity: .16, ...axes }),
    ...(m.large ? [thresholdLine(env, { id: "large", value: START_LARGE_TOKENS, text: short(START_LARGE_TOKENS), ...axes })] : []),
    { ...median, id: "halo", lineStyle: { ...median.lineStyle, color: env.ink.surface, width: 4.5 }, itemStyle: { color: env.ink.surface } },
    median,
    lineDots(env, { id: "dots", data: m.median, color: "var(--text-primary)", hollow: i => m.few[i]!, ...axes }),
  ];
  return {
    ...baseOption(env),
    grid: { left: l.left, right: l.right, ...l.tracks[0]!, outerBoundsMode: "none" },
    // The newest week is always labelled, right-aligned on its point so it ends inside the plot, as tracksOption does:
    // ECharts' thinning would drop it (5 weeks at 200% text, 12 in 343px).
    xAxis: { ...x, axisLabel: { ...x.axisLabel, alignMaxLabel: "right", showMaxLabel: true } },
    yAxis: valueAxis(env, { max: m.max, step: m.step, format: short }),
    series,
  };
}
