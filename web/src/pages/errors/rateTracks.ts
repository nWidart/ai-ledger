// The Errors rate chart as data (echart-errors, design decision 10): rateModel() holds its figures, rateLayout() its box,
// rateOption() the ECharts option drawn from them, rateZoomWords() what the zoom says. All pure. Types only from the
// runtime: this module stays out of the ECharts chunk's way. Not rateChart.ts: on a case-insensitive file system that
// name clashes with RateChart.tsx.
// Two tracks under the frame (decision 1): the rate line above, the failed calls stacked by type below. The marks that
// cross both tracks (the no-activity bands, the fix markers, the selection) are custom series on the frame (decision 5).
import { lowVolume } from "../../components/chart";
import type { Shown } from "../../components/echart/EChart";
import type { CustomSeriesOption, EChartsOption } from "../../components/echart/echarts";
import {
  axisTitle, baseOption, FRAME_AXES, labelWidth, lineDots, lineSeries, selectionMark, sliderTrend, trackAxes, trackLayout,
  type TrackLayout, tracksOption, valueAxis, ZOOM_FROM, zoomSlider,
} from "../../components/echart/option";
import { stackSeries } from "../../components/echart/stack";
import type { ChartEnv } from "../../components/echart/tokens";
import { num as fmt, niceStep } from "../../format";
import { bucketOf, chartData, type ChartPt, type Filtered, type Fixes, idle, label, type Model, selectable, shortLabel, toDate, typeColor, type View, type ViewTypes } from "./model";

/** One series of the option: the series types the runtime registers. */
type Series = Exclude<NonNullable<EChartsOption["series"]>, readonly unknown[]>;
/** The rectangle of the grid a custom series sits on: the frame's for every mark here. */
interface Rect { x: number; y: number; width: number; height: number }

/** The stack's kind for the failed calls outside the view's layers. Not "other": that is a type id (CATCH_ALL). */
export const OTHER = "__other";
const DAY = 864e5;

/** One applied fix the chart marks: on point `i`, `row` below the first label of its point, of type `c`. */
export interface FixItem { i: number; row: number; c: string; label: string; o?: number }

export interface RateModel {
  week: boolean;
  /** The points: `chartData()`'s, from the first bucket with a tool call, long idle stretches folded. */
  pts: ChartPt[];
  /** Per point, errors per 100 tool calls (the selected type's when one is); null without calls. The reading gives it. */
  rates: (number | null)[];
  /** Per point, the rate as drawn: stopped at the scale's top. */
  drawn: (number | null)[];
  /** Per point, whether it has too few calls for a steady rate (`lowVolume`): a hollow dot, and left out of the scale. */
  low: boolean[];
  /** The rate track's scale: the highest steady rate plus 10%, in three nice steps; `digits` for its labels. */
  rate: { max: number; step: number; digits: number };
  /** The bars' scale: the highest count plus 5%, in three nice steps of at least 1. */
  count: { max: number; step: number };
  /** The stack's kinds, bottom first: the view's layers, then Other when a point has it. With a type selected every kind
   *  but its layer (Other for a type with no layer of its own) has `o: .2`. */
  kinds: { k: string; c: string; o?: number }[];
  /** Per point, the failed calls of each kind, in `kinds` order. */
  values: number[][];
  /** Per point, its failed calls: the slider's trend. */
  totals: number[];
  /** One item per idle point (no call and no error): its index and its run's first and last index. */
  idle: { i: number; first: number; last: number }[];
  /** The applied fixes on a point of the chart, of a type the page knows. */
  fixes: FixItem[];
  /** The rate line's color: the text color, or the selected type's. */
  line: string;
  /** The dotted bridge's color: the muted ink, or the selected type's. */
  bridge: string;
  /** The track titles. */
  titles: { rate: string; bars: string };
  /** The index of the selected point (`v.at`) when it can be selected; else null. */
  selected: number | null;
  /** Whether the chart can be zoomed, with the slider under it: ZOOM_FROM points or more, and a chart drawn (not `bare`). */
  zoom: boolean;
  /** Per point, how many buckets (days or weeks) it stands for: more than 1 for a folded stretch. */
  span: number[];
  /** Why the chart draws nothing: no tool call, or no error; null when it draws. */
  bare: "empty" | "noErrors" | null;
  /** The view's identity (decision 8): what the user chose, the first point and each fold. */
  view: string;
}

/** The chart's figures for a view, its filtered data, its types and the applied fixes. */
export function rateModel(m: Model, v: View, f: Filtered, vt: ViewTypes, fixes: Fixes): RateModel {
  const { keys, pts } = chartData(m, v, f, vt), cat = v.cat, week = v.gran === "week";
  const rates = pts.map(p => (cat ? (p.c ? (p.byAll[cat] || 0) / p.c * 100 : null) : p.r));
  const low = lowVolume(pts.map(p => p.c));
  // Buckets with few calls (when others have more) are left out of the scale: one quiet day's 3 of 12 can't flatten the rest.
  const r0 = Math.max(.1, ...rates.map((r, i) => (low[i] ? 0 : r || 0))) * 1.1, rStep = niceStep(r0 / 3);
  // The max rounded off its float error: a max a hair over its last step (0.30000000000000004) makes ECharts 6 add a tick on
  // the top one, a doubled grid line. Labels in hundredths for steps of 0.05, so no two read the same.
  const rate = { max: +(Math.ceil(r0 / rStep) * rStep).toFixed(10), step: rStep, digits: rStep < .1 ? 2 : rStep < 1 ? 1 : 0 };
  // Counts are whole: whole steps.
  const e0 = Math.max(1, ...pts.map(p => p.e)) * 1.05, eStep = Math.max(1, niceStep(e0 / 3));
  const other = pts.some(p => p.other), layer = cat && (vt.layers.includes(cat) ? cat : OTHER);
  const kinds = [...vt.layers.map(c => ({ k: c, c: typeColor(c, vt) })), ...(other ? [{ k: OTHER, c: "var(--type-other)" }] : [])]
    .map(k => (layer && k.k !== layer ? { ...k, o: .2 } : k));
  const runs: RateModel["idle"] = [];
  pts.forEach((p, i) => {
    if (!idle(p)) return;
    const first = i && idle(pts[i - 1]!) ? runs.at(-1)!.first : i;
    let last = i;
    while (last + 1 < pts.length && idle(pts[last + 1]!)) last++;
    runs.push({ i, first, last });
  });
  // Rows on a point in the order of the type labels, so two fixes on one day stack the same way every time.
  const on = Object.entries(fixes).flatMap(([c, day]) => {
    const i = keys.indexOf(bucketOf(day, v.gran));
    return i < 0 || !m.cats[c] ? [] : [{ i, c, label: shortLabel(m.cats[c].label) }];
  }).sort((a, b) => a.i - b.i || a.label.localeCompare(b.label) || (a.c < b.c ? -1 : 1));
  const marks: FixItem[] = [];
  for (const x of on) {
    const prev = marks.at(-1);
    marks.push({ ...x, row: prev?.i === x.i ? prev.row + 1 : 0, ...(cat && x.c !== cat ? { o: .2 } : {}) });
  }
  const at = v.at ? pts.findIndex(p => p.k === v.at && selectable(p)) : -1;
  const per = week ? 7 : 1, line = cat ? typeColor(cat, vt) : "var(--text-primary)";
  const bare = !pts.some(p => p.c) ? "empty" : !pts.some(p => p.e) ? "noErrors" : null;
  return {
    week, pts, rates, drawn: rates.map(r => (r == null ? null : Math.min(r, rate.max))), low, rate,
    count: { max: Math.ceil(e0 / eStep) * eStep, step: eStep },
    kinds, values: pts.map(p => kinds.map(k => (k.k === OTHER ? p.other : p.by[k.k] || 0))), totals: pts.map(p => p.e),
    idle: runs, fixes: marks, line, bridge: cat ? line : "var(--text-muted)",
    titles: {
      rate: cat ? `${shortLabel(m.cats[cat]!.label)} rate, % of tool calls` : "Error rate, % of tool calls",
      bars: `Failed calls per ${v.gran}, by type`,
    },
    selected: at < 0 ? null : at, zoom: !bare && pts.length >= ZOOM_FROM,
    span: pts.map(p => (p.to ? Math.round((+toDate(p.to) - +toDate(p.k)) / DAY / per) + 1 : 1)),
    bare,
    view: [v.range, v.gran, v.project, v.source, v.sub, v.noise, pts[0]?.k, ...pts.flatMap(p => (p.to ? [`${p.k}-${p.to}`] : []))].join("|"),
  };
}

/** The margins at the default text size: room for the value labels on the left (a count of six digits) and the bucket labels below. */
const MARGIN = { t: 18, r: 10, b: 24, l: 52 };
/** Both tracks keep their height at any text size; the gap between them holds the bars' title and grows with the text. */
const RATE = 100, BARS = 152, GAP = 26;

/** The box: the rate track above the bars. 320px at the default text size, SLIDER_ROOM more with the slider. */
export const rateLayout = (m: RateModel, textScale: number): TrackLayout => trackLayout(textScale, {
  margin: MARGIN, gap: GAP, slider: m.zoom, tracks: [{ fixed: RATE }, { fixed: BARS }],
});

/** The bar: 72% of its band, 26px at most. */
const barWidth = (band: number) => Math.max(1, Math.min(26, band * .72));

/** What the zoom says (decision 7), in days or weeks: a folded stretch counts every bucket it stands for, and a window that
 *  ends on it ends at its last one. */
export function rateZoomWords(m: RateModel, shown: Shown | null): string {
  const units = m.week ? "weeks" : "days", sum = (a: number, b: number) => m.span.slice(a, b + 1).reduce((s, n) => s + n, 0);
  const all = sum(0, m.pts.length - 1);
  if (!shown) return `Showing all ${all} ${units}.`;
  const last = m.pts[shown.to]!;
  return `Showing ${m.week ? "the weeks of " : ""}${label(m.pts[shown.from]!.k)} to ${label(last.to ?? last.k)}, ${sum(shown.from, shown.to)} of ${all} ${units}.`;
}

/** The no-activity bands (decision 5), on the frame over the grid lines (z 0). One item per idle point, so the slider keeps
 *  or drops each on its own: it drops a whole item the window cuts. The first point of a run that is shown draws the run's
 *  shown part as one rectangle, from its own left edge, so a run the window cuts starts at the plot's edge. A point is
 *  shown when the middle of its band is inside the plot, as in `lineDots`. A folded stretch draws "//" on the frame's
 *  bottom line. */
function idleBands(m: RateModel, env: ChartEnv, barsMid: number): CustomSeriesOption {
  const { fontFamily, fontSize } = baseOption(env).textStyle, muted = env.ink.muted, fill = env.color("var(--surface-2)");
  const text = "no activity", room = labelWidth(env, text) + 8;
  const word = (t: string, x: number, y: number) => ({
    type: "text" as const, emphasisDisabled: true,
    style: { text: t, x, y, align: "center" as const, verticalAlign: "middle" as const, fontFamily, fontSize, fill: muted },
  });
  return {
    type: "custom",
    id: "idle",
    ...FRAME_AXES,
    data: m.idle.map(x => [x.i, 0, x.first, x.last]),
    encode: { x: 0, y: 1 },
    silent: true,
    z: 0,
    renderItem: (params, api) => {
      const frame = params.coordSys as unknown as Rect, i = api.value(0) as number, first = api.value(2) as number, last = api.value(3) as number;
      const cx = (j: number) => (api.coord([j, 0]) as number[])[0]!;
      const shown = (j: number) => cx(j) >= frame.x && cx(j) <= frame.x + frame.width;
      if (!shown(i)) return null;
      const band = (api.size!([1, 0]) as number[])[0]!, children: object[] = [];
      if (i === first || !shown(i - 1)) {
        let j = i;
        while (j < last && shown(j + 1)) j++;
        const x = cx(i) - band / 2, width = cx(j) + band / 2 - x;
        // Forced colors: a dashed frame and no fill, inset by half its line, which is at most half the run's width.
        const line = env.forced ? Math.min(1, width / 2) : 0;
        children.push({
          type: "rect", emphasisDisabled: true,
          shape: { x: x + line / 2, y: frame.y + line / 2, width: width - line, height: frame.height - line },
          style: env.forced ? { fill: "none", stroke: env.ink.grid, lineWidth: line, lineDash: [3, 2] } : { fill, opacity: .75 },
        });
        if (room <= width) children.push(word(text, x + width / 2, frame.y + barsMid));
      }
      if (m.pts[i]!.to) children.push(word("//", cx(i), frame.y + frame.height));
      return children.length ? { type: "group", children } : null;
    },
  } as CustomSeriesOption;
}

/** The fix markers (decision 5), on the frame over the line and its dots (z 4): a dashed line at the middle of the point's
 *  band over the frame's height, and "✓ type" at the frame's top, one row lower for each fix before it on the point. The
 *  label sits right of the line, left of it where it would pass the plot's right edge, and is left out where neither side
 *  has room. A fix outside the points shown is not drawn. */
function fixMarks(m: RateModel, env: ChartEnv): CustomSeriesOption {
  const { fontFamily, fontSize } = baseOption(env).textStyle, s = env.textScale;
  const stroke = env.forced ? env.ink.text : env.color("var(--good)"), fill = env.forced ? env.ink.text : env.color("var(--good-text)");
  return {
    type: "custom",
    id: "fixes",
    ...FRAME_AXES,
    data: m.fixes.map((x, n) => [x.i, 0, n]),
    encode: { x: 0, y: 1 },
    silent: true,
    z: 4,
    renderItem: (params, api) => {
      const frame = params.coordSys as unknown as Rect, fx = m.fixes[api.value(2) as number]!;
      const [cx] = api.coord([api.value(0), 0]) as [number, number], right = frame.x + frame.width;
      if (!(cx >= frame.x && cx <= right)) return null;
      // The line is never wider than its band (98 weeks in 246px is a 2.5px band).
      const band = (api.size!([1, 0]) as number[])[0]!, opacity = fx.o ?? 1;
      const children: object[] = [{
        type: "line", emphasisDisabled: true,
        shape: { x1: cx, y1: frame.y, x2: cx, y2: frame.y + frame.height },
        style: { stroke, lineWidth: Math.min(1.5, band), lineDash: [4, 3], opacity },
      }];
      const text = `✓ ${fx.label}`, w = labelWidth(env, text), gap = 4 * s;
      const at = cx + gap + w <= right ? { x: cx + gap, align: "left" as const } : cx - gap - w >= frame.x ? { x: cx - gap, align: "right" as const } : null;
      if (at) children.push({
        type: "text", emphasisDisabled: true,
        style: { text, ...at, y: frame.y + (2 + 13 * fx.row) * s, verticalAlign: "top", fontFamily, fontSize, fill, opacity },
      });
      return { type: "group", children };
    },
  } as CustomSeriesOption;
}

/** The chart's ECharts option: the rate track (0) above the bars (1), the marks on the frame, the slider from ZOOM_FROM points. */
export function rateOption(m: RateModel, env: ChartEnv): EChartsOption {
  const layout = rateLayout(m, env.textScale), rateAxes = trackAxes(0), plot = env.width - layout.left - layout.right;
  const bars = layout.tracks[1]!;
  const y = [
    { ...valueAxis(env, { max: m.rate.max, step: m.rate.step, format: x => `${fmt(x, m.rate.digits)}%` }), ...axisTitle(env, m.titles.rate, plot) },
    { ...valueAxis(env, { ...m.count, format: x => fmt(x) }), ...axisTitle(env, m.titles.bars, plot) },
  ];
  // The slider's faint trend is the first line on the lowest axis it drives that carries one: the totals' hidden line on the
  // rate track, before the bridge and the rate line (S6).
  const series: Series[] = m.zoom ? [sliderTrend(m.totals, rateAxes)] : [];
  series.push(idleBands(m, env, bars.top - layout.frame.top + bars.height / 2));
  if (m.selected != null) series.push(selectionMark(env, { index: m.selected }));
  series.push(stackSeries({ kinds: m.kinds, values: m.values, hatched: () => false, env, width: barWidth, ...trackAxes(1) }));
  // The bridge: the same data again with nulls connected, dotted and under the solid line, so a gap reads as a gap (S8).
  const bridge = lineSeries(env, { id: "bridge", data: m.drawn, color: m.bridge, ...rateAxes });
  series.push(
    { ...bridge, connectNulls: true, lineStyle: { ...bridge.lineStyle, width: 1.25, type: [1, 4], cap: "round", opacity: .7 } },
    lineSeries(env, { id: "rate", data: m.drawn, color: m.line, ...rateAxes }),
    lineDots(env, { id: "rate-dots", data: m.drawn, color: m.line, hollow: i => m.low[i]!, ...rateAxes }),
    fixMarks(m, env),
  );
  // The slider names no window: the wrapper keeps the points shown, and both tracks keep the whole view's scales.
  return {
    ...baseOption(env),
    ...tracksOption(env, { layout, labels: m.pts.map(p => p.k), format: k => label(k), y }),
    series,
    ...(m.zoom ? { dataZoom: [{ ...zoomSlider(env), left: layout.left, right: layout.right }] } : {}),
  };
}
