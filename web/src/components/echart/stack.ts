import type { CustomSeriesOption, CustomSeriesRenderItem, CustomSeriesRenderItemAPI } from "./echarts";
import { stackHeights } from "../chart";

/** What the stack reads of the chart environment: a structural slice of `ChartEnv`, which satisfies it. */
export interface StackEnv {
  color(css: string): string;
  ink: { text: string; surface: string };
  forced: boolean;
  motion: boolean;
}

/** One painted segment of a bar: `j` is its kind's index, `r` its corner radii (top-left, top-right, bottom-right, bottom-left). */
export interface StackRect { j: number; x: number; y: number; width: number; height: number; r: 0 | [number, number, number, number] }

/**
 * The rectangles of one stacked bar, bottom first, from its values, its baseline `y0`, its top `top` (both in px, `top < y0`),
 * its left edge `x` and its width `w`. A zero value has no rectangle. A positive segment keeps at least 1px, so a thin share
 * is never drawn zero tall while its tooltip gives it, and every segment but the first has a 2px gap below it: its slot is at
 * least 3px. The others shrink to keep the bar its height, so no segment paints over another. When the minimums add up to
 * more than the bar's height, every segment keeps its minimum and the bar rises above `top`: five segments on a 2px bar
 * make a 13px bar. The top segment gets a 3px top radius when it is taller than 4px.
 */
export function stackRects(values: readonly number[], y0: number, top: number, x: number, w: number): StackRect[] {
  const segs = values.flatMap((v, j) => (v > 0 ? [{ v, j }] : []));
  const slots = stackHeights(segs.map(s => s.v), y0 - top, segs.map((_, n) => (n ? 3 : 1)));
  let base = y0;
  return segs.map((s, n) => {
    const y = base - slots[n]!, height = slots[n]! - (n ? 2 : 0);
    base = y;
    return { j: s.j, x, y, width: w, height, r: n === segs.length - 1 && height > 4 ? [3, 3, 0, 0] : 0 };
  });
}

export interface StackSeriesInput {
  /** The stack's kinds, bottom first: `k` names the segment, `c` is its CSS color, such as "var(--proj-2)". */
  kinds: readonly { k: string; c: string }[];
  /** Per day, the drawn value of each kind, in `kinds` order. */
  values: readonly (readonly number[])[];
  /** Whether day i is drawn hatched, as a day still in progress. */
  hatched: (i: number) => boolean;
  env: StackEnv;
  /** The bar's width from the band's, for point i. The default is the band less min(4, band × .25). */
  width?: (band: number, i: number) => number;
  /** The series id, "stack" by default. Each stack in one option needs its own: ECharts rejects two series with one id. */
  id?: string;
  /** The axes the stack sits on, 0 by default. A chart with several grids gives each stack the axes of its own grid. */
  xAxisIndex?: number;
  yAxisIndex?: number;
}

const barWidth = (band: number) => Math.max(1, band - Math.min(4, band * .25));

/**
 * A custom series that draws each day's whole stack from `stackRects`, on a category x axis and a value y axis. Each data row is
 * [day, total, ...values]; the total sets the value axis's extent.
 */
export function stackSeries({ kinds, values, hatched, env, width = barWidth, id = "stack", xAxisIndex = 0, yAxisIndex = 0 }: StackSeriesInput): CustomSeriesOption {
  const colors = kinds.map(k => env.color(k.c));
  // Today's hatch: surface-colored stripes over each segment, so every series color shows through in either theme.
  const decal = { symbol: "rect", color: env.ink.surface, dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: Math.PI / 4 };
  const renderItem: CustomSeriesRenderItem = (params, api: CustomSeriesRenderItemAPI) => {
    const i = Number(api.value(0)), total = Number(api.value(1));
    const [cx, y0] = api.coord([i, 0]) as [number, number], [, top] = api.coord([i, total]) as [number, number];
    const band = (api.size!([1, 0]) as number[])[0]!, w = width(band, i);
    const rects = stackRects(kinds.map((_, j) => Number(api.value(2 + j))), y0, top, cx - w / 2, w);
    if (!rects.length) return null;
    const shape = ({ x, y, width, height, r }: StackRect) => ({ x, y, width, height, r });
    const edge = env.forced ? { stroke: env.ink.text, lineWidth: .75 } : {};
    const children = rects.map(s => ({ type: "rect" as const, name: kinds[s.j]!.k, shape: shape(s), style: { fill: colors[s.j], ...edge } }));
    if (hatched(i)) {
      // `style.decal` takes a decal object here; ECharts turns it into the pattern zrender's type names.
      for (const s of rects) children.push({ type: "rect", name: `${kinds[s.j]!.k}-hatch`, shape: shape(s), style: { fill: "none", opacity: .6, decal } as never });
    }
    // With motion on, the bar grows from its baseline when a drawing first shows it, a little later per day. Not when an
    // action shows it: a zoom out makes the bars the zoom left out again, and they would all grow a second time. The
    // wrapper animates the chart's first drawing only, so a bar that newer data adds does not grow either.
    const grow = env.motion && params.actionType == null
      ? { originX: cx, originY: y0, enterFrom: { scaleY: 0 }, enterAnimation: { delay: 6 * Math.min(i, 60) } } : {};
    return { type: "group", children, ...grow };
  };
  return {
    type: "custom",
    // A stable id: a redraw under `replaceMerge` updates this series in place, so the bars grow on the first draw only.
    id,
    xAxisIndex,
    yAxisIndex,
    renderItem,
    encode: { x: 0, y: 1 },
    data: values.map((v, i) => [i, v.reduce((s, n) => s + n, 0), ...v]),
    silent: true,
  };
}
