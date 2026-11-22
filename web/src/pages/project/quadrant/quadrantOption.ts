// The session quadrant's ECharts option (graph-project-quadrant, decisions 3, 4, 8 and 11): two log axes on one grid that
// sits exactly where the fit puts the plot, the medians' dashed guides with the corner names that fit, and the dots. Pure,
// and types only from the runtime: this module stays out of the ECharts chunk's way. Both series are custom, already
// registered: nothing is added to the ECharts chunk.
import type { CustomSeriesOption, EChartsOption, XAXisComponentOption, YAXisComponentOption } from "../../../components/echart/echarts";
import { baseOption } from "../../../components/echart/option";
import type { ChartEnv } from "../../../components/echart/tokens";
import { num } from "../../../format";
import type { FitAxis, QuadrantFit } from "./quadrant";

/** A log axis that is both an x and a y axis: it sets no position. */
type LogAxis = Extract<XAXisComponentOption, { type?: "log" }> & Extract<YAXisComponentOption, { type?: "log" }>;

/** A dot's radius, its fill's opacity in the theme (a pile reads darker), and the guides' dash. */
const DOT_R = 4, DOT_FILL = .7, DASH = [5, 4];

/** At the axis's min: ECharts gives a log axis's ends back through pow(), off by a few ulps. */
const atMin = (v: number, a: FitAxis) => Math.abs(v - a.min) <= a.min * 1e-9;
/** A cost tick: "$" and the value, with the decimals a 1, 2 or 5 times a power of ten needs ("$0.02", "$0.1", "$10"). */
const costLabel = (v: number) => "$" + num(v, Math.max(0, Math.ceil(-Math.log10(v) - 1e-9)));

/** A log axis from the fit's min to its max, its ticks at the powers of ten and the ends, thinned when they overlap; with a
 *  lane, the min tick is the lane's and reads zero. */
function logAxis(env: ChartEnv, a: FitAxis, { name, gap, zero, format }: { name: string; gap: number; zero: string; format: (v: number) => string }): LogAxis {
  const s = env.textScale, fontSize = 11 * s;
  return {
    type: "log",
    min: a.min,
    max: a.max,
    name,
    nameLocation: "middle",
    nameGap: gap * s,
    nameTextStyle: { color: env.ink.secondary, fontSize },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: env.ink.grid } },
    axisLabel: { color: env.ink.muted, fontSize, margin: 6 * s, hideOverlap: true, formatter: (v: number) => (a.lane && atMin(v, a) ? zero : format(v)) },
  };
}

/** The plot's option. hue: the project's color as CSS, such as `color(project)`; the dots take it, or CanvasText under
 *  forced colors. */
export function quadrantOption(fit: QuadrantFit, env: ChartEnv, hue: string): EChartsOption {
  const base = baseOption(env), { ink } = env, s = env.textScale;
  const dot = env.forced ? ink.text : env.color(hue);
  const guides: CustomSeriesOption = {
    type: "custom",
    id: "guides",
    silent: true,
    data: fit.guides ? [[fit.guides.x, fit.guides.y]] : [],
    encode: { x: 0, y: 1 },
    renderItem: (params, api) => {
      const plot = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number];
      const line = { stroke: ink.muted, lineWidth: 1, lineDash: DASH };
      return {
        type: "group",
        children: [
          { type: "line", emphasisDisabled: true, shape: { x1: cx, y1: plot.y, x2: cx, y2: plot.y + plot.height }, style: line },
          { type: "line", emphasisDisabled: true, shape: { x1: plot.x, y1: cy, x2: plot.x + plot.width, y2: cy }, style: line },
          ...fit.names.map(n => ({
            type: "text" as const,
            emphasisDisabled: true,
            style: {
              text: n.label, x: n.px, y: n.py, align: n.align, verticalAlign: n.verticalAlign,
              fontFamily: base.textStyle.fontFamily, fontSize: 11 * s, fontWeight: 600,
              fill: ink.secondary, stroke: ink.surface, lineWidth: 3,
            },
          })),
        ],
      };
    },
  };
  const dots: CustomSeriesOption = {
    type: "custom",
    id: "dots",
    silent: true,
    z: 3,
    data: fit.dots.map(d => [d.x, d.y, d.filled ? 1 : 0]),
    encode: { x: 0, y: 1 },
    renderItem: (_params, api) => {
      const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number];
      const filled = !!api.value(2);
      return {
        type: "circle",
        emphasisDisabled: true,
        shape: { cx, cy, r: DOT_R },
        // Filled: the hue in a 1px surface ring. Hollow: the surface in a 1.5px ring of the hue.
        style: filled
          ? { fill: dot, fillOpacity: env.forced ? 1 : DOT_FILL, stroke: ink.surface, lineWidth: 1 }
          : { fill: ink.surface, stroke: dot, lineWidth: 1.5 },
      };
    },
  };
  return {
    ...base,
    // Never animated: a dot sliding in would read as a session changing.
    animation: false,
    // The fit's plot, exactly: with outerBoundsMode "none" ECharts maps a value to the fit's pixel. Top and height, not
    // bottom: the box's height is rounded, the plot's is not.
    grid: { left: fit.plot.x, top: fit.plot.y, width: fit.plot.w, height: fit.plot.h, outerBoundsMode: "none" },
    xAxis: logAxis(env, fit.x, { name: "Estimated cost (log scale)", gap: 26, zero: "$0", format: costLabel }),
    yAxis: { ...logAxis(env, fit.y, { name: "Tool calls (log scale)", gap: 42, zero: "0", format: v => num(v) }), nameRotate: 90 },
    series: [guides, dots],
  };
}
