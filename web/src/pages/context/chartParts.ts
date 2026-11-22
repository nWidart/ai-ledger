// The chart parts two charts or more of the Context page need (echart-context, decision 5): the calendar's slots, a band
// between two series, a dashed line across the plot at a value, and a track title that drops its figure where it would not
// fit. Pure, typed from echarts.ts. Shared chart files stay as they are: a later page that needs a part moves it to option.ts.
import type { CustomSeriesOption } from "../../components/echart/echarts";
import { baseOption, labelWidth, type OptionEnv, type SeriesAxes } from "../../components/echart/option";
import { dayRange } from "../../format";

interface Rect { x: number; y: number; width: number; height: number }

/** The slots of a calendar view: every YYYY-MM-DD day from `first` to `last`, or by week the days 7 days apart from
 *  `first` (each a week's first day), both ends included. */
export function calendarSlots(first: string, last: string, bucket: "day" | "week"): string[] {
  if (bucket === "day") return dayRange(first, last);
  const start = +new Date(first + "T00:00:00Z"), weeks = Math.floor((+new Date(last + "T00:00:00Z") - start) / (7 * 864e5)) + 1;
  return Array.from({ length: Math.max(0, weeks) }, (_, i) => new Date(start + i * 7 * 864e5).toISOString().slice(0, 10));
}

/** A band between `lo` and `hi`, given per slot, `null` where there is no point: a silent custom series under the lines
 *  (z 1), one item per run of neighbouring slots with both values. A run draws one polygon through its `hi` points and back
 *  along its `lo` points, filled with `color` (a concrete color) at `opacity`. A run of one slot draws a line from its `hi`
 *  to its `lo`, 7px wide with round caps, at `opacity` plus .12 (spike S1). The band does not follow a zoom: a run's item
 *  is placed at its first slot, so a window that cuts it off would drop the whole run. */
export function bandSeries(_env: OptionEnv, { id, lo, hi, color, opacity, xAxisIndex, yAxisIndex }: {
  id: string; lo: readonly (number | null)[]; hi: readonly (number | null)[]; color: string; opacity: number;
} & SeriesAxes): CustomSeriesOption {
  const has = (i: number) => lo[i] != null && hi[i] != null;
  const runs: number[][] = [];
  for (let i = 0; i < lo.length; i++) {
    if (!has(i)) continue;
    const first = i;
    while (has(i + 1)) i++;
    runs.push([first, 0, i]);
  }
  return {
    type: "custom",
    id,
    xAxisIndex,
    yAxisIndex,
    data: runs,
    encode: { x: 0, y: 1 },
    silent: true,
    z: 1,
    renderItem: (_params, api) => {
      const first = api.value(0) as number, last = api.value(2) as number;
      const at = (i: number, v: number) => api.coord([i, v]) as [number, number];
      if (first === last) {
        const [x1, y1] = at(first, hi[first]!), [x2, y2] = at(first, lo[first]!);
        return {
          type: "line",
          emphasisDisabled: true, // no highlight state, as the stack has none
          shape: { x1, y1, x2, y2 },
          style: { stroke: color, lineWidth: 7, lineCap: "round", opacity: opacity + .12 },
        };
      }
      const slots = Array.from({ length: last - first + 1 }, (_, k) => first + k);
      return {
        type: "polygon",
        emphasisDisabled: true,
        shape: { points: [...slots.map(i => at(i, hi[i]!)), ...slots.reverse().map(i => at(i, lo[i]!))] },
        style: { fill: color, opacity },
      };
    },
  };
}

/** A one-item silent custom series over the lines (z 2): a 1px line dashed [4, 3] in the muted ink across the plot at
 *  `value`, and `text` right-aligned at the plot's right edge, 4px (times the text scale) over the line, or as far under it
 *  where over it the text would pass the plot's top. */
export function thresholdLine(env: OptionEnv, { id, value, text, xAxisIndex, yAxisIndex }: {
  id: string; value: number; text: string;
} & SeriesAxes): CustomSeriesOption {
  const { fontFamily, fontSize } = baseOption(env).textStyle, gap = 4 * env.textScale, ink = env.ink.muted;
  return {
    type: "custom",
    id,
    xAxisIndex,
    yAxisIndex,
    data: [[0, value]],
    encode: { x: 0, y: 1 },
    silent: true,
    z: 2,
    renderItem: (params, api) => {
      const plot = params.coordSys as unknown as Rect, [, y] = api.coord([0, api.value(1)]) as [number, number];
      const right = plot.x + plot.width, over = y - gap - fontSize >= plot.y;
      return {
        type: "group",
        children: [
          { type: "line", emphasisDisabled: true, shape: { x1: plot.x, y1: y, x2: right, y2: y }, style: { stroke: ink, lineWidth: 1, lineDash: [4, 3] } },
          {
            type: "text",
            emphasisDisabled: true,
            style: {
              text, x: right, y: over ? y - gap : y + gap, align: "right", verticalAlign: over ? "bottom" : "top",
              fontFamily, fontSize, fill: ink,
            },
          },
        ],
      };
    },
  };
}

/** A track's title with a figure: `title · figure` for the first of `figures` (the long form, then the short) that fits
 *  `maxWidth` px as `axisTitle` draws it (weight 500), else `title` alone. `axisTitle` cuts what still does not fit. */
export function fitTitle(env: OptionEnv, title: string, figures: readonly string[], maxWidth: number): string {
  for (const f of figures) {
    const t = `${title} · ${f}`;
    if (labelWidth(env, t, 500) <= maxWidth) return t;
  }
  return title;
}
