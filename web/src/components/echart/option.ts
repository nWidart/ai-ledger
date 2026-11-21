// The option fragments every ECharts chart repeats, so the charts look alike (design decision 7). Pure: each reads only the
// environment it is given. Types only, from echarts.ts: this module stays out of the ECharts chunk's way.
import type { CustomSeriesOption, EChartsOption, SliderDataZoomComponentOption, XAXisComponentOption, YAXisComponentOption } from "./echarts";

/** The part of the chart environment these helpers read: a structural stand-in for `ChartEnv` in `tokens.ts`, which satisfies it. */
export interface OptionEnv {
  ink: { text: string; muted: string; grid: string; surface: string; border: string; cursor: string; accent: string; tint: string };
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
 *  read: by default ECharts slides it for 200ms over bands wider than 15px, across days the reading no longer names. */
export const categoryAxis = (env: OptionEnv, labels: readonly string[], format: (label: string) => string): CategoryAxis => ({
  type: "category",
  data: [...labels],
  axisTick: { show: false },
  axisLine: { show: false },
  axisLabel: { color: env.ink.muted, fontSize: size(env), margin: 8 * env.textScale, hideOverlap: true, formatter: (v: string) => format(v) },
  axisPointer: { show: true, type: "shadow", animation: false, shadowStyle: { color: env.ink.cursor }, label: { show: false } },
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

/** A slider handle: a bar with round corners, 8 by 20, drawn at the slider's height. */
const HANDLE = "path://M2,0h4a2,2,0,0,1,2,2v16a2,2,0,0,1-2,2h-4a2,2,0,0,1-2-2v-16a2,2,0,0,1,2-2Z";
/** The trend drawn in the slider: faint, so it does not read as a second chart. */
const TREND = (env: OptionEnv) => ({ lineStyle: { color: env.ink.muted, width: .75, opacity: .5 }, areaStyle: { color: env.ink.grid, opacity: .35 } });

/** The zoom slider under the grid: 20px high, no detail text, no brush, at least MIN_SHOWN points wide, in the ink colors.
 *  The days shown are tinted with the accent between two solid accent handles, in a muted frame, so the slider shows it can
 *  be dragged and where its window is.
 *  Its fixed id lets a redraw merge into it, so the days shown survive a theme change (the wrapper replaces dataZoom, so
 *  an option without the slider removes it); with no id the redraw would make a new slider and show every point again. */
export const zoomSlider = (env: OptionEnv): SliderDataZoomComponentOption => ({
  type: "slider",
  id: "zoom",
  height: 20,
  bottom: 4,
  showDetail: false,
  brushSelect: false,
  minValueSpan: MIN_SHOWN - 1,
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
