// The tool-call chart's ECharts option (graph-session-flamechart, decisions 6 and 10): no grid and no axis, three custom
// series on no coordinate system, every shape at the layout's pixels. Pure, and types only from the runtime: this module
// stays out of the ECharts chunk's way. The custom series is already registered, and rect, circle, polygon, polyline and
// text are its own shapes: nothing is added to the ECharts chunk.
import type { CustomSeriesOption, EChartsOption } from "../../echart/echarts";
import { baseOption, type OptionEnv } from "../../echart/option";
import { BAR, ROW, type Span, type SpansLayout } from "./spans";

/** The lane label line's height before the text scale (spans.ts: a lane's top is this much under its label line's). */
const LABEL = 14;
/** A failed bar narrower than this is a tick, taller than its row; a clipped bar's last POINT px narrow to its point. */
const HOLLOW = 4, POINT = 4;
/** The ring's radius, the outlines' width, and the break band's width. */
const RING = 3, LINE = 1.5, BREAK = 6;

/** The chart's option. times: the axis's first and last time as the timeline writes them (`tl.fmtT(tl.start)`,
 *  `tl.fmtT(tl.end)`), drawn under the lanes at the plot's ends; the layout holds no times of the axis. */
export function spansOption(l: SpansLayout, env: OptionEnv, times: readonly [string, string]): EChartsOption {
  const base = baseOption(env), { ink, forced } = env, s = env.textScale;
  const font = { fontFamily: base.textStyle.fontFamily, fontSize: 11 * s };
  const bar = forced ? ink.text : env.color("var(--series-1)");
  const fail = forced ? ink.text : env.color("var(--critical)");
  const top = (sp: Span) => l.lanes[sp.lane]!.top + sp.row * ROW;
  // A shorter span over a longer one: a tick on a long bar stays visible.
  const widths = [...new Set(l.spans.map(sp => sp.x1 - sp.x0))].sort((a, b) => b - a);
  const z2 = new Map(widths.map((w, i) => [w, i]));

  const shape = (sp: Span) => {
    const y = top(sp), w = sp.x1 - sp.x0, cx = sp.x0 + .5, z = z2.get(w)!;
    if (sp.kind === "open")
      return { type: "circle" as const, z2: z, shape: { cx, cy: y + BAR / 2, r: RING }, style: { fill: "none", stroke: forced ? ink.text : ink.muted, lineWidth: LINE } };
    if (sp.kind === "still") return { type: "rect" as const, z2: z, shape: { x: sp.x0, y, width: w, height: BAR }, style: { fill: forced ? ink.text : ink.muted } };
    // A narrow failure: the timeline's 2px failure tick, 2px above its row.
    if (sp.kind === "failed" && w < HOLLOW) return { type: "rect" as const, z2: z, shape: { x: cx - 1, y: y - 2, width: 2, height: BAR + 2 }, style: { fill: fail } };
    // A failure's outline inside the bar's edges: the stroke is centred on the shape.
    const hollow = sp.kind === "failed", inset = hollow ? LINE / 2 : 0;
    const style = hollow ? { fill: ink.surface, stroke: fail, lineWidth: LINE } : { fill: bar };
    const x0 = sp.x0 + inset, y0 = y + inset, y1 = y + BAR - inset;
    if (sp.clipped) {
      // To the plot's edge, the last POINT px narrowing to the edge's middle: it goes on.
      const x1 = l.right - inset, neck = Math.max(x0, x1 - POINT);
      return { type: "polygon" as const, z2: z, shape: { points: [[x0, y0], [neck, y0], [x1, y + BAR / 2], [neck, y1], [x0, y1]] }, style };
    }
    return { type: "rect" as const, z2: z, shape: { x: x0, y: y0, width: w - 2 * inset, height: BAR - 2 * inset }, style };
  };

  const y0 = l.lanes.length ? l.lanes[0]!.top - LABEL * s : 0;
  const breaks: CustomSeriesOption = {
    type: "custom", id: "breaks", coordinateSystem: "none", silent: true, z: 1,
    data: l.breaks.map((_, i) => [i]),
    renderItem: params => {
      const bx = l.breaks[params.dataIndex]!;
      return {
        type: "group",
        children: [
          { type: "rect", emphasisDisabled: true, shape: { x: bx - BREAK / 2, y: y0, width: BREAK, height: l.bottom - y0 }, style: { fill: forced ? ink.grid : env.color("var(--surface-2)") } },
          // The timeline's ⌇, at the band's top.
          { type: "polyline", emphasisDisabled: true, shape: { points: [[bx - 4, y0 + 6], [bx - 1, y0], [bx + 1, y0 + 6], [bx + 4, y0]] },
            style: { fill: "none", stroke: forced ? ink.grid : ink.muted, lineWidth: 1 } },
        ],
      };
    },
  };
  const spans: CustomSeriesOption = {
    type: "custom", id: "spans", coordinateSystem: "none", silent: true, z: 2,
    data: l.spans.map((_, i) => [i]),
    renderItem: params => ({ ...shape(l.spans[params.dataIndex]!), emphasisDisabled: true }),
  };
  const timeY = l.bottom + 8 * s, timeStyle = { ...font, fontSize: 10.5 * s, y: timeY, verticalAlign: "middle" as const, fill: ink.muted };
  const labels: CustomSeriesOption = {
    type: "custom", id: "labels", coordinateSystem: "none", silent: true, z: 3,
    data: [[0]],
    renderItem: () => ({
      type: "group",
      children: [
        ...l.lanes.map(lane => ({
          type: "text" as const, emphasisDisabled: true,
          style: { ...font, fontWeight: 600, text: lane.name, x: l.left, y: lane.top - LABEL * s / 2, align: "left" as const, verticalAlign: "middle" as const,
            width: l.right - l.left, overflow: "truncate" as const, ellipsis: "…", fill: ink.secondary },
        })),
        { type: "text" as const, emphasisDisabled: true, style: { ...timeStyle, text: times[0], x: l.left, align: "left" as const } },
        { type: "text" as const, emphasisDisabled: true, style: { ...timeStyle, text: times[1], x: l.right, align: "right" as const } },
      ],
    }),
  };
  // Never animated, in any mode: a bar growing in would read as a call running.
  return { ...base, animation: false, series: [breaks, spans, labels] };
}
