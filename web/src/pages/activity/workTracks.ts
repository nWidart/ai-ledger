// Activity's work chart as data (echart-activity, design decision 8): workModel() holds its figures, workLayout() its box,
// workOption() the ECharts option drawn from them. All pure. Types only from the runtime: this module stays out of the
// ECharts chunk's way. Not workChart.ts: on a case-insensitive file system that name clashes with WorkChart.tsx.
import type { DailyWorkRow, UsagePayload } from "../../api";
import { lowVolume, niceMax } from "../../components/chart";
import {
  baseOption, type Dot, lineSeries, pointLabel, selectionMark, sliderTrend, trackAxes, trackLayout, type TrackLayout, tracksOption,
  valueAxis, ZOOM_FROM, zoomSlider,
} from "../../components/echart/option";
import { stackSeries } from "../../components/echart/stack";
import type { EChartsOption } from "../../components/echart/echarts";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayLabel, niceStep, num, plural } from "../../format";
import type { Kind } from "../cost/cost";
import { failRate, METRICS, monday, workBuckets, workKinds, workStack, type WorkMetric } from "./work";

/** One series of the option: the series types the runtime registers. */
type Series = Exclude<NonNullable<EChartsOption["series"]>, readonly unknown[]>;

/** The plain bars' color, and the rate line's (the tooltip keys it too). */
const BAR = "var(--series-1)";
export const FAIL = "var(--critical)";

/** The days of a view: a week bar it cuts short is partial. */
export interface WorkView { start: string | null; end: string }
/** The chart's selection: a day, or a week by its Monday. */
export interface WorkPick { day: string; week: boolean }

/** What a partial week bar covers: ", from Sep 9" when the view starts after its Monday, ", so far" for the week that holds
 *  the end of the view (still growing, even on its Sunday); "" for a whole week. */
export const weekCut = (day: string, v: WorkView) =>
  v.start && v.start > day ? `, from ${dayLabel(v.start)}` : monday(v.end) === day ? ", so far" : "";
/** A bar's name: its day, or the week it starts ("Week of Oct 5"); long: with the year, and how much of a week the view
 *  covers when it cuts it short ("Week of Nov 9, 2026, so far"). */
export const bucketLabel = (day: string, week: boolean, long = false, v?: WorkView) =>
  (week ? `Week of ${dayLabel(day, long)}${long && v ? weekCut(day, v) : ""}` : dayLabel(day, long));

/** The rate track's scale: its top (a nice value over the highest steady rate) and the digits its label needs. Buckets with few
 *  calls (when others have enough) are left out, so one quiet day's 2 of 4 can't flatten the busy days. */
export function rateScale(rates: readonly (number | null)[], low: readonly boolean[]): { top: number; digits: number } {
  const top = niceStep(Math.max(...rates.map((r, i) => (low[i] ? 0 : r ?? 0)), 0) * 1.08 || 1);
  return { top, digits: Math.max(0, -Math.floor(Math.log10(top))) };
}

export interface WorkModel {
  metric: WorkMetric;
  /** Bars by week (each a Monday), else by day. */
  week: boolean;
  /** The view's days: what a partial week bar covers (`weekCut`). */
  span: WorkView;
  /** Every bucket of the view from the first with a session, with zeros for idle ones. */
  buckets: DailyWorkRow[];
  /** Stacked by project; else plain bars of one kind. */
  stacked: boolean;
  /** The bars' kinds, bottom first: the projects and Other when stacked, else the measure's one plain kind. */
  kinds: Kind[];
  /** Per bucket, the drawn value of each kind, in `kinds` order. */
  values: number[][];
  /** Per bucket, the measure: what the value axis, the peak and the slider's trend read. */
  totals: number[];
  /** Per bucket, errors per 100 tool calls; null without calls. */
  rates: (number | null)[];
  /** Per bucket, the rate as drawn: stopped at the scale's top. */
  drawn: (number | null)[];
  /** Per bucket, whether it has too few calls for a steady rate (`lowVolume`). */
  low: boolean[];
  /** Per bucket, its dot on the rate line: hollow for a low bucket, solid for a point no line reaches. */
  dots: (Dot | undefined)[];
  /** Some bucket has a tool call: the rate track is drawn. */
  hasRate: boolean;
  /** Some bucket is low: the legend keys the hollow dot. */
  hasLow: boolean;
  /** The rate track's scale (`rateScale`): ticks at 0 and its top. */
  rate: { top: number; digits: number };
  /** The index of the first bucket with the largest total; null with no buckets. */
  peak: number | null;
  /** The bars' value axis: its top and tick step. */
  axis: { max: number; step: number };
  /** Whether the chart can be zoomed, with the slider under it: ZOOM_FROM bars or more. */
  zoom: boolean;
  /** The selected bar's index; null without a selection or when it is not a bar of this chart (a week on a chart by day). */
  selected: number | null;
  /** The view's identity (decision 7): what the user chose and the first bar. Neither the selection nor the figures. */
  view: string;
}

/** The work chart's figures for a view, a measure and a selection. */
export function workModel(d: UsagePayload, metric: WorkMetric, selected: WorkPick | null): WorkModel {
  const week = d.work_bucket === "week";
  const buckets = workBuckets(d);
  const projects = workKinds(d, buckets, metric), stacked = projects.length > 0;
  const M = METRICS.find(x => x.k === metric)!;
  const kinds = stacked ? projects : [{ k: metric, label: M.label, c: BAR }];
  const stack = stacked ? workStack(buckets, d.work_projects, projects, metric) : [];
  const values = buckets.map((p, i) => (stacked ? kinds.map(k => stack[i]?.[k.k] ?? 0) : [p[metric]]));
  const totals = buckets.map(p => p[metric]);
  const rates = buckets.map(failRate), hasRate = rates.some(r => r != null);
  const low = lowVolume(buckets.map(p => p.calls));
  const rate = rateScale(rates, low);
  const dots = rates.map((v, i): Dot | undefined => (v == null ? undefined : low[i] ? "hollow"
    : rates[i - 1] == null && rates[i + 1] == null ? "solid" : undefined));
  const peak = buckets.length ? totals.reduce((b, t, i) => (t > totals[b]! ? i : b), 0) : null;
  const at = selected && selected.week === week ? buckets.findIndex(p => p.day === selected.day) : -1;
  return {
    metric, week, span: { start: d.start, end: d.end }, buckets, stacked, kinds, values, totals, rates,
    drawn: rates.map(v => (v == null ? null : Math.min(v, rate.top))), low, dots, hasRate, hasLow: low.some(Boolean), rate, peak,
    axis: niceMax(Math.max(...totals, 0), niceStep), zoom: buckets.length >= ZOOM_FROM, selected: at < 0 ? null : at,
    view: [d.range, d.work_bucket, buckets[0]?.day, d.project, d.source, d.automated, metric].join("|"),
  };
}

/** The margins at the default text size: room for the value labels on the left and the bucket labels below. */
const MARGIN = { t: 20, r: 16, b: 24, l: 52 };
/** The bars keep their height at any text size; the rate track and the gap over it grow with the text. */
const BARS = 120, GAP = 16, RATE = 36;

/** The box: the bars, and under them the rate track. Without tool calls the bars take the rate track's room, so the box keeps
 *  its height. 216px at the default text size, SLIDER_ROOM more with the slider. */
export const workLayout = (m: WorkModel, textScale: number): TrackLayout => trackLayout(textScale, {
  margin: MARGIN, gap: GAP, slider: m.zoom,
  tracks: m.hasRate ? [{ fixed: BARS }, { scaled: RATE }] : [{ fixed: BARS, scaled: GAP + RATE }],
});

/** The chart's ECharts option: the bars on track 0, the rate line on track 1, the selection mark and the peak label. */
export function workOption(m: WorkModel, env: ChartEnv): EChartsOption {
  const s = env.textScale, layout = workLayout(m, s), bars = trackAxes(0), M = METRICS.find(x => x.k === m.metric)!;
  const y = [valueAxis(env, { ...m.axis, format: v => num(v) })];
  if (m.hasRate) {
    const r = valueAxis(env, { max: m.rate.top, step: m.rate.top, format: v => num(v, v ? m.rate.digits : 0) });
    // The top label hangs under its line, clear of the bars' 0 above it.
    y.push({ ...r, axisLabel: { ...r.axisLabel, verticalAlignMaxLabel: "top" } });
  }
  // The slider's faint trend is the first line series on the lowest x axis it drives that carries one: the totals' hidden line
  // on the bars' track (axis 1) wins over the rate line on axis 2, whatever the order of the list.
  const series: Series[] = m.zoom ? [sliderTrend(m.totals, bars)] : [];
  if (m.selected != null) series.push(selectionMark(env, { index: m.selected }));
  series.push(stackSeries({ kinds: m.kinds, values: m.values, hatched: () => false, env, ...bars }));
  if (m.hasRate) series.push(lineSeries(env, { id: "rate", data: m.drawn, color: FAIL, dots: i => m.dots[i], ...trackAxes(1) }));
  // The label keeps inside the plot, and a plot narrower than its text draws none (pointLabel), as on Cost.
  const pk = m.peak;
  if (pk != null && m.totals[pk]! > 0) {
    const text = `Peak ${plural(m.totals[pk]!, M.one)} · ${bucketLabel(m.buckets[pk]!.day, m.week)}`;
    series.push({ ...pointLabel(env, { index: pk, value: m.totals[pk]!, text }), ...bars, id: "peak" });
  }
  // The slider names no window: the wrapper keeps the bars shown, and both tracks keep the whole view's scales.
  return {
    ...baseOption(env),
    ...tracksOption(env, { layout, labels: m.buckets.map(p => p.day), format: day => bucketLabel(day, m.week), y }),
    series,
    ...(m.zoom ? { dataZoom: [{ ...zoomSlider(env), left: layout.left, right: layout.right }] } : {}),
  };
}
