// The option fragments every ECharts chart repeats, so the charts look alike (design decision 7). Pure: each reads only the
// environment it is given. Types only, from echarts.ts: this module stays out of the ECharts chunk's way.
// A chart of several tracks (echart-activity, decision 1) puts a frame at grid 0, over every track: the frame holds the one
// visible x axis, the only axis pointer and what crosses the tracks, such as the selection mark; each track is a grid of
// its own with a hidden x axis over the same points (trackLayout, tracksOption, trackAxes).
import type {
  CustomSeriesOption, EChartsOption, LineSeriesOption, SliderDataZoomComponentOption, XAXisComponentOption, YAXisComponentOption,
} from "./echarts";

/** The part of the chart environment these helpers read: a structural stand-in for `ChartEnv` in `tokens.ts`, which satisfies it. */
export interface OptionEnv {
  /** A CSS color, such as "var(--critical)", as a concrete color. */
  color(css: string): string;
  ink: { text: string; muted: string; grid: string; surface: string; border: string; cursor: string; accent: string; tint: string };
  /** (forced-colors: active): the ink roles are system colors. */
  forced: boolean;
  textScale: number;
  motion: boolean;
}

/** The body font, as `theme.css` sets it on `body` (option.test.ts checks the two match). */
const FONT = '"IBM Plex Sans", ui-sans-serif, -apple-system, system-ui, sans-serif';
const size = (env: OptionEnv) => 11 * env.textScale;

/** Animation (the first draw only, none under reduced motion) and the text style every chart starts from. */
export const baseOption = (env: OptionEnv): Pick<EChartsOption, "animation" | "animationDuration" | "animationDurationUpdate"> & { textStyle: { fontFamily: string; fontSize: number } } => ({
  animation: env.motion,
  animationDuration: 500,
  animationDurationUpdate: 0,
  textStyle: { fontFamily: FONT, fontSize: size(env) },
});

type CategoryAxis = Extract<XAXisComponentOption, { type?: "category" }>;
type ValueAxis = Extract<YAXisComponentOption, { type?: "value" }>;

/** One band per label (a day, a week), with no tick and no line, muted labels that ECharts thins when they overlap, and the
 *  cursor band: the shadow pointer in the cursor ink, with no label. The wrapper moves and hides it. It jumps to the point
 *  read: by default ECharts slides it for 200ms over bands wider than 15px, across days the reading no longer names.
 *  The band alone shows the reading: by default the pointer also highlights every item on the point read
 *  (axisTrigger.js, dispatchHighDownActually), which lifts the colors of a custom series' shapes (states.js,
 *  createEmphasisDefaultState) and gives a line with no symbols a dot in ECharts' own palette (LineView.highlight). */
export const categoryAxis = (env: OptionEnv, labels: readonly string[], format: (label: string) => string): CategoryAxis => ({
  type: "category",
  data: [...labels],
  axisTick: { show: false },
  axisLine: { show: false },
  axisLabel: { color: env.ink.muted, fontSize: size(env), margin: 8 * env.textScale, hideOverlap: true, formatter: (v: string) => format(v) },
  axisPointer: { show: true, type: "shadow", animation: false, triggerEmphasis: false, shadowStyle: { color: env.ink.cursor }, label: { show: false } },
});

/** A value axis from 0 to max in ticks of step (see `niceMax` in chart.ts), on grid lines, with muted labels. */
export const valueAxis = (env: OptionEnv, { max, step, format }: { max: number; step: number; format: (v: number) => string }): ValueAxis => ({
  type: "value",
  min: 0,
  max,
  interval: step,
  axisTick: { show: false },
  axisLine: { show: false },
  splitLine: { lineStyle: { color: env.ink.grid } },
  axisLabel: { color: env.ink.muted, fontSize: size(env), margin: 6 * env.textScale, formatter: (v: number) => format(v) },
});

/** Where a label over a band goes, by the rule of `peakLabelAt` in chart.ts: centred over the band's centre (cx), or, within
 *  56px (times the text scale) of the plot's edge, anchored at the bar's edge and kept inside the plot. */
function labelAnchor(cx: number, bar: number, plot: { x: number; width: number }, s: number): { x: number; align: "left" | "center" | "right" } {
  const near = 56 * s, right = plot.x + plot.width;
  if (cx < plot.x + near) return { x: Math.max(plot.x, cx - bar / 2), align: "left" };
  if (cx > right - near) return { x: Math.min(right, cx + bar / 2), align: "right" };
  return { x: cx, align: "center" };
}

/** A one-item custom series: a haloed label over the point (index, value), such as a peak, above the lines. It follows the
 *  zoom: a point outside the days shown is filtered out and draws nothing. */
export const pointLabel = (env: OptionEnv, { index, value, text }: { index: number; value: number; text: string }): CustomSeriesOption => ({
  type: "custom",
  data: [[index, value]],
  encode: { x: 0, y: 1 },
  silent: true,
  z: 5,
  renderItem: (params, api) => {
    const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number];
    const band = (api.size!([1, 0]) as number[])[0]!, bar = Math.max(1, band - Math.min(4, band * .25));
    const { x, align } = labelAnchor(cx, bar, params.coordSys as unknown as { x: number; width: number }, env.textScale);
    return {
      type: "text",
      emphasisDisabled: true, // no highlight state, as the stack has none
      style: {
        text, x, y: cy - 4 * env.textScale, align, verticalAlign: "bottom",
        fontFamily: FONT, fontSize: size(env), fontWeight: 600,
        fill: env.ink.text, stroke: env.ink.surface, lineWidth: 3,
      },
    };
  },
});

/** The fewest points the zoom shows: the slider's handles and the plus key both stop there. */
export const MIN_SHOWN = 7;
/** The fewest points of a view that a chart can be zoomed in: from here on it draws the slider. */
export const ZOOM_FROM = 14;
/** What the zoom slider (20px, 4px off the bottom) and a 4px gap above it take under the point labels: the box is this much
 *  taller with the slider, so the plot keeps its height. */
export const SLIDER_ROOM = 28;

type GridOption = Exclude<NonNullable<EChartsOption["grid"]>, readonly unknown[]>;
/** The axes a series sits on: a track's (`trackAxes`) or the frame's (`FRAME_AXES`). */
export interface SeriesAxes { xAxisIndex: number; yAxisIndex: number }

/** One track's height before the text scale: `fixed` px that keep their size, plus `scaled` px that grow with the text. */
export interface TrackSpec { fixed?: number; scaled?: number }
/** Where the box puts its grids, in px from its top and from its sides. */
export interface TrackLayout {
  /** The box's height: the margins, the tracks, the gaps between them and, with the slider, SLIDER_ROOM. */
  height: number;
  left: number;
  right: number;
  /** The frame: from the first track's top to the last track's bottom. */
  frame: { top: number; height: number };
  tracks: { top: number; height: number }[];
}

/** The box's height and each grid's place for tracks stacked top to bottom. A track is `fixed + scaled × textScale` tall; the
 *  margins (room for the labels) and the gap between two tracks grow with the text; `slider` adds SLIDER_ROOM under the
 *  bottom margin. It takes the text scale, not the environment: the box's height is needed before any environment exists. */
export function trackLayout(textScale: number, { margin, tracks, gap, slider }: {
  margin: { t: number; r: number; b: number; l: number }; tracks: readonly TrackSpec[]; gap: number; slider: boolean;
}): TrackLayout {
  let y = margin.t * textScale;
  const placed = tracks.map((t, i) => {
    if (i) y += gap * textScale;
    const top = y, height = (t.fixed ?? 0) + (t.scaled ?? 0) * textScale;
    y += height;
    return { top, height };
  });
  const top = placed[0]?.top ?? y;
  return {
    height: y + margin.b * textScale + (slider ? SLIDER_ROOM : 0),
    left: margin.l * textScale,
    right: margin.r * textScale,
    frame: { top, height: y - top },
    tracks: placed,
  };
}

/** The axes of track t: grid t + 1, behind the frame. */
export const trackAxes = (t: number): SeriesAxes => ({ xAxisIndex: t + 1, yAxisIndex: t + 1 });
/** The frame's axes: the visible category axis and a hidden value axis from 0 to 1. */
export const FRAME_AXES: Readonly<SeriesAxes> = { xAxisIndex: 0, yAxisIndex: 0 };

/** The grids and axes of a chart of several tracks, from one layout and one label list, so the tracks cannot drift apart:
 *  grid 0 is the frame, with the labels (under the last track) and the only axis pointer, over a hidden 0-to-1 value axis;
 *  grid t + 1 is track t, with a hidden category axis over the same labels and `y[t]`, its own value axis.
 *  Every grid sits exactly where the layout puts it (`outerBoundsMode: "none"`). By default ECharts 6 fits each grid on its
 *  own: it shrinks a grid whose axis labels would leave the box (Grid.js, layOutGridByOuterBounds). Only the frame has
 *  visible x labels, so only the frame would shrink, and its axis, which holds the band, the selection and the pointer's
 *  reading, would leave the tracks' axes: by half a band at the newest point of 11 weekly bars in 343px. Instead the
 *  layout keeps the labels in: the left margin holds the value labels and half the first bucket label; the newest label
 *  is always shown, right-aligned on its point, so it ends inside the plot (a centred one would pass the right margin),
 *  and the labels it overlaps are hidden. The fake runtime refuses a chart of several grids that leaves one to ECharts'
 *  fit (`refuse` in testing.ts). */
export function tracksOption(env: OptionEnv, { layout, labels, format, y }: {
  layout: TrackLayout; labels: readonly string[]; format: (label: string) => string; y: readonly ValueAxis[];
}): { grid: GridOption[]; xAxis: XAXisComponentOption[]; yAxis: YAXisComponentOption[] } {
  if (y.length !== layout.tracks.length) throw new Error(`tracksOption: ${layout.tracks.length} tracks, ${y.length} value axes`);
  const side = { left: layout.left, right: layout.right, outerBoundsMode: "none" as const };
  const frame = categoryAxis(env, labels, format);
  return {
    grid: [{ ...side, ...layout.frame }, ...layout.tracks.map(t => ({ ...side, ...t }))],
    xAxis: [
      { ...frame, gridIndex: 0, axisLabel: { ...frame.axisLabel, alignMaxLabel: "right", showMaxLabel: true } },
      ...layout.tracks.map((_, t): CategoryAxis => ({ type: "category", gridIndex: t + 1, data: [...labels], show: false, axisPointer: { show: false } })),
    ],
    yAxis: [{ type: "value", gridIndex: 0, min: 0, max: 1, show: false }, ...y.map((a, t) => ({ ...a, gridIndex: t + 1 }))],
  };
}

/** The selected point's mark: a one-item custom series on the frame, drawn over the grid lines and under the marks (z 1). It
 *  frames the point's whole band over the frame's height, inset by half its line, so it reads apart from the reading band,
 *  which has no frame: tinted in a 1.5px accent frame in the theme, unfilled in a 2px frame in forced colors, where the
 *  accent is Highlight. A point outside the zoom window is filtered out and draws nothing. So does an index outside the
 *  axis: ECharts places it by extrapolation, in a margin or off the box, and does not clip a custom series. */
export const selectionMark = (env: OptionEnv, { index }: { index: number }): CustomSeriesOption => ({
  type: "custom",
  id: "selected",
  ...FRAME_AXES,
  data: [[index, 0]],
  encode: { x: 0, y: 1 },
  silent: true,
  z: 1,
  renderItem: (params, api) => {
    const frame = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
    const [cx] = api.coord([api.value(0), 0]) as [number, number];
    if (!(cx >= frame.x && cx <= frame.x + frame.width)) return null;
    const band = (api.size!([1, 0]) as number[])[0]!, line = env.forced ? 2 : 1.5;
    return {
      type: "rect",
      emphasisDisabled: true, // no highlight state, as the stack has none
      shape: { x: cx - band / 2 + line / 2, y: frame.y + line / 2, width: band - line, height: frame.height - line },
      style: { fill: env.forced ? "none" : env.ink.tint, stroke: env.ink.accent, lineWidth: line },
    };
  },
});

/** A dot on a line's point: solid, or hollow (a surface center inside a ring of the line's color). */
export type Dot = "solid" | "hollow";

/** A line with no symbols, broken at a null, not clipped and deaf to the pointer, in its resolved color; `dots(i)` puts a
 *  solid or a hollow dot on point i. Under forced colors the line is the text ink (CanvasText): it is the only line on its
 *  track, told apart by its track and its legend key, and a theme color has no sure contrast on the user's Canvas. */
export function lineSeries(env: OptionEnv, { id, data, color, dots, xAxisIndex, yAxisIndex }: {
  id: string; data: readonly (number | null)[]; color: string; dots?: (i: number) => Dot | undefined;
} & SeriesAxes): LineSeriesOption {
  const ink = env.forced ? env.ink.text : env.color(color), surface = env.ink.surface;
  const dot: Record<Dot, { symbolSize: number; itemStyle: { color: string; borderColor: string; borderWidth: number } }> = {
    solid: { symbolSize: 5, itemStyle: { color: ink, borderColor: surface, borderWidth: 1.5 } },
    hollow: { symbolSize: 6, itemStyle: { color: surface, borderColor: ink, borderWidth: 1.5 } },
  };
  return {
    type: "line",
    id,
    xAxisIndex,
    yAxisIndex,
    data: data.map((v, i) => {
      const d = v == null ? undefined : dots?.(i);
      return d ? { value: v, symbol: "circle", ...dot[d] } : v;
    }),
    // No symbol but on the points `dots` names, and every one of those: "auto" would thin them on a long axis.
    symbol: "none",
    showAllSymbol: true,
    connectNulls: false,
    clip: false,
    silent: true,
    lineStyle: { color: ink, width: 1.75, join: "round", cap: "round" },
    itemStyle: { color: ink },
    emphasis: { disabled: true },
  };
}

/** A line that draws nothing, for the slider's faint trend. ECharts' rule (SliderZoomView._prepareDataShadowInfo): the
 *  slider walks the x axes it drives in index order, and draws the first line, bar, candlestick or scatter series on the
 *  lowest-index axis that carries one; the series' order counts only among the series on that axis. So this line makes
 *  the trend these values (such as the bars' totals) only when it is listed first on the lowest-index axis that carries
 *  a line: put it on the first track that has a line, before that track's lines, and no line on an axis before it. The
 *  fake runtime throws on an option whose slider would draw another series (`sliderShadowOf` in testing.ts).
 *  ECharts still writes its path, so it is transparent too: with no color it would take one of the default palette's. */
export const sliderTrend = (data: readonly number[], axes: SeriesAxes): LineSeriesOption => ({
  type: "line",
  id: "trend",
  ...axes,
  data: [...data],
  symbol: "none",
  showSymbol: false,
  silent: true,
  lineStyle: { color: "transparent", opacity: 0 },
  itemStyle: { color: "transparent" },
  emphasis: { disabled: true },
});

/** A slider handle: a bar with round corners, 8 by 20, drawn at the slider's height. */
const HANDLE = "path://M2,0h4a2,2,0,0,1,2,2v16a2,2,0,0,1-2,2h-4a2,2,0,0,1-2-2v-16a2,2,0,0,1,2-2Z";
/** The trend drawn in the slider: faint, so it does not read as a second chart. */
const TREND = (env: OptionEnv) => ({ lineStyle: { color: env.ink.muted, width: .75, opacity: .5 }, areaStyle: { color: env.ink.grid, opacity: .35 } });

/** The zoom slider under the grid: 20px high, no detail text, no brush, at least MIN_SHOWN points wide, in the ink colors.
 *  The days shown are tinted with the accent between two solid accent handles, in a muted frame, so the slider shows it can
 *  be dragged and where its window is.
 *  Its fixed id lets a redraw merge into it, so the days shown survive a theme change (the wrapper replaces dataZoom, so
 *  an option without the slider removes it); with no id the redraw would make a new slider and show every point again.
 *  It drives every x axis: with none named ECharts zooms the first only, and a chart of several tracks would zoom its
 *  frame and leave its tracks. With one x axis this is the same slider. */
export const zoomSlider = (env: OptionEnv): SliderDataZoomComponentOption => ({
  type: "slider",
  id: "zoom",
  xAxisIndex: "all",
  height: 20,
  bottom: 4,
  showDetail: false,
  brushSelect: false,
  minValueSpan: MIN_SHOWN - 1,
  // Each step of a drag at once. ECharts holds steps back by default (every 20ms with no update animation) and sends
  // the last one late: after the pointer's release, where the days shown would be said a second time. A step redraws
  // a chart of this size well inside a frame.
  throttle: 0,
  backgroundColor: "transparent",
  borderColor: env.ink.muted,
  borderRadius: 3,
  fillerColor: env.ink.tint,
  dataBackground: TREND(env),
  selectedDataBackground: TREND(env),
  handleIcon: HANDLE,
  handleSize: "100%",
  handleStyle: { color: env.ink.accent, borderColor: env.ink.accent },
  moveHandleStyle: { color: env.ink.muted },
  emphasis: { handleStyle: { borderColor: env.ink.text }, moveHandleStyle: { color: env.ink.accent } },
});
