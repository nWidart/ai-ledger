// The option fragments every ECharts chart repeats, so the charts look alike (design decision 7). Pure: each reads only the
// environment it is given. Types only, from echarts.ts: this module stays out of the ECharts chunk's way.
import type { CustomSeriesOption, EChartsOption, SliderDataZoomComponentOption, XAXisComponentOption, YAXisComponentOption } from "./echarts";

/** The part of the chart environment these helpers read: a structural stand-in for `ChartEnv` in `tokens.ts`, which satisfies it. */
export interface OptionEnv {
  ink: { text: string; muted: string; grid: string; surface: string; border: string; cursor: string; accent: string };
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
 *  cursor band: the shadow pointer in the cursor ink, with no label. The wrapper moves and hides it. */
export const categoryAxis = (env: OptionEnv, labels: readonly string[], format: (label: string) => string): CategoryAxis => ({
  type: "category",
  data: [...labels],
  axisTick: { show: false },
  axisLine: { show: false },
  axisLabel: { color: env.ink.muted, fontSize: size(env), margin: 8 * env.textScale, hideOverlap: true, formatter: (v: string) => format(v) },
  axisPointer: { show: true, type: "shadow", shadowStyle: { color: env.ink.cursor }, label: { show: false } },
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

/** The zoom slider under the grid: 20px high, no detail text, no brush, at least 7 points wide, in the ink colors. */
export const zoomSlider = (env: OptionEnv): SliderDataZoomComponentOption => ({
  type: "slider",
  height: 20,
  bottom: 4,
  showDetail: false,
  brushSelect: false,
  minValueSpan: 6,
  backgroundColor: "transparent",
  borderColor: env.ink.border,
  fillerColor: env.ink.cursor,
  dataBackground: { lineStyle: { color: env.ink.muted }, areaStyle: { color: env.ink.grid } },
  selectedDataBackground: { lineStyle: { color: env.ink.accent }, areaStyle: { color: env.ink.cursor } },
  handleStyle: { color: env.ink.surface, borderColor: env.ink.border },
  moveHandleStyle: { color: env.ink.muted },
  emphasis: { handleStyle: { borderColor: env.ink.accent }, moveHandleStyle: { color: env.ink.accent } },
});
