// The cache chart as data (echart-context, decision 6): cacheModel() holds its figures, cacheLayout() its box,
// cacheOption() the ECharts option drawn from them, cacheZoomWords() what the zoom says. All pure. Types only from the
// runtime: this module stays out of the ECharts chunk's way. Not cacheChart.ts: on a case-insensitive file system that
// name clashes with CacheChart.tsx.
// Three tracks under the frame over the calendar's slots (decision 3): the tokens the bars draw, the cache breaks by cause,
// the cache-hit ratio. A slot with no request is empty on every track, and still a point the reading stops on (decision 4).
import type { CacheBucket, ContextPayload } from "../../api";
import { niceMax } from "../../components/chart";
import type { Shown } from "../../components/echart/EChart";
import type { CustomSeriesOption, EChartsOption } from "../../components/echart/echarts";
import {
  axisTitle, baseOption, lineDots, lineSeries, sliderTrend, trackAxes, trackLayout, type TrackLayout, tracksOption, valueAxis,
  ZOOM_FROM, zoomSlider,
} from "../../components/echart/option";
import { stackRects, stackSeries } from "../../components/echart/stack";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayLabel, niceStep, num, pct } from "../../format";
import { calendarSlots, fitTitle } from "./chartParts";
import { BREAK_CAUSES, short } from "./context";

type Series = ContextPayload["cost"]["series"];
/** One series of the option: the series types the runtime registers. */
type OptionSeries = Exclude<NonNullable<EChartsOption["series"]>, readonly unknown[]>;
/** One place on the calendar axis: the bucket's first day, and its row (null when nothing happened that day or week). */
export interface Slot { day: string; row: CacheBucket | null }
/** A track's title, and its figure's forms for `fitTitle`: the long one first. None where there is no figure. */
export interface CacheTitle { title: string; figures: string[] }
type Kind<K> = { k: K; c: string };

/** The prompt tokens not read from the cache: uncached input and cache writes, the part that costs full price or more. */
export const waste = (r: { input: number; cache_write: number }) => r.input + r.cache_write;
/** cache_read over the prompt tokens, null when the bucket has none. */
export const hitRatio = (r: { input: number; cache_read: number; cache_write: number }): number | null => {
  const t = r.input + r.cache_read + r.cache_write;
  return t ? r.cache_read / t : null;
};
/** The ratio track's low end: 90%, or the lowest ratio rounded down to a tenth when it is lower, so the usual 85-98% spread is readable. */
export const ratioFloor = (ratios: number[]): number => Math.max(0, Math.min(.9, Math.floor(Math.min(...ratios, 1) * 10 + 1e-9) / 10));

/** The bars' kinds, bottom first: the biggest part first; the cache reads, on request, on top (decision 6). */
const KINDS: readonly Kind<"input" | "cache_write" | "cache_read">[] = [
  { k: "input", c: "var(--accent)" }, { k: "cache_write", c: "var(--series-1)" }, { k: "cache_read", c: "var(--track)" },
];
/** The breaks' kinds, bottom first, in BREAK_CAUSES' order (decision 13). */
const BREAK_COLOR = { model_switch: "var(--cache-switch)", expired: "var(--cache-expired)", other: "var(--text-muted)" } as const;
const BREAK_KINDS = BREAK_CAUSES.map(([k]): Kind<typeof k> => ({ k, c: BREAK_COLOR[k] }));
const sum = (v: readonly number[]) => v.reduce((s, n) => s + n, 0);

export interface CacheModel {
  week: boolean;
  /** Every bucket's place by date from the first row to the last: a day (or week) with no row is an empty slot. */
  slots: Slot[];
  /** Whether the bars draw the cache reads. */
  reads: boolean;
  /** The bars' kinds, bottom first: uncached input and cache writes, then the cache reads with `reads`. */
  kinds: Kind<string>[];
  /** Per slot, the tokens of each kind, in `kinds` order: all 0 on an empty slot. */
  values: number[][];
  /** Per slot, what its bar draws: the waste, or the prompt tokens with `reads`. The slider's trend. */
  totals: number[];
  /** The bars' scale: `niceMax` over the highest total. */
  scale: { max: number; step: number };
  /** The breaks' kinds, bottom first, one per cause. */
  breakKinds: Kind<string>[];
  /** Per slot, the breaks of each cause, in `breakKinds` order. */
  breaks: number[][];
  /** The breaks' scale: the busiest slot's breaks, at least 1. */
  breakMax: number;
  /** Per slot, the cache-hit ratio; null on an empty slot or one with no prompt token. */
  ratios: (number | null)[];
  /** The ratio track's low end (`ratioFloor`); its top is 100%. */
  floor: number;
  titles: { bars: CacheTitle; breaks: CacheTitle; ratio: CacheTitle };
  /** Whether the chart can be zoomed, with the slider under it: ZOOM_FROM slots or more (decision 10). */
  zoom: boolean;
}

/** The chart's figures for a view's series, with or without the cache reads in the bars. */
export function cacheModel(series: Series, reads: boolean): CacheModel {
  const rows = series.rows, week = series.bucket === "week", by = new Map(rows.map(r => [r.day, r]));
  const slots = rows.length ? calendarSlots(rows[0]!.day, rows.at(-1)!.day, series.bucket).map(day => ({ day, row: by.get(day) ?? null })) : [];
  const kinds = reads ? KINDS : KINDS.slice(0, 2);
  const values = slots.map(s => kinds.map(k => s.row?.[k.k] ?? 0)), totals = values.map(sum);
  const breaks = slots.map(s => BREAK_KINDS.map(k => s.row?.[k.k] ?? 0)), breakMax = Math.max(1, ...breaks.map(sum));
  const ratios = slots.map(s => (s.row ? hitRatio(s.row) : null));
  const all = rows.reduce((t, r) => ({ input: t.input + r.input, cache_read: t.cache_read + r.cache_read, cache_write: t.cache_write + r.cache_write }),
    { input: 0, cache_read: 0, cache_write: 0 });
  const overall = hitRatio(all), drawn = short(sum(totals)), most = breaks.some(v => sum(v) > 0);
  return {
    week, slots, reads, kinds: [...kinds], values, totals,
    scale: niceMax(Math.max(...totals, 1), niceStep),
    breakKinds: BREAK_KINDS, breaks, breakMax,
    ratios, floor: ratioFloor(ratios.filter((r): r is number => r != null)),
    titles: {
      bars: { title: reads ? "Prompt tokens" : "Tokens not read from the cache", figures: [`${drawn} in this view`, drawn] },
      breaks: {
        title: "Cache breaks",
        figures: most ? [`most in a ${week ? "week" : "day"}: ${num(breakMax)}`, `most: ${num(breakMax)}`] : ["none in this view", "none"],
      },
      ratio: { title: "Cache-hit ratio", figures: overall == null ? [] : [`${pct(overall)} in this view`, pct(overall)] },
    },
    zoom: slots.length >= ZOOM_FROM,
  };
}

/** The margins at the default text size: room for the bars' title above, the value labels on the left ("120k", "100%")
 *  and the bucket labels below. */
const MARGIN = { t: 20, r: 8, b: 24, l: 52 };
/** The three tracks keep their height at any text size; the gaps between them hold the lower tracks' titles and grow
 *  with the text. */
const BARS = 180, BREAKS = 48, RATIO = 44, GAP = 24;

/** The box: the bars, the breaks and the ratio, top to bottom. 364px at the default text size, SLIDER_ROOM more with the slider. */
export const cacheLayout = (m: CacheModel, textScale: number): TrackLayout => trackLayout(textScale, {
  margin: MARGIN, gap: GAP, slider: m.zoom, tracks: [{ fixed: BARS }, { fixed: BREAKS }, { fixed: RATIO }],
});

/** The bar: its band less min(4, band × .25), the stack's own default, named here so the cache-read edge frames the same bar. */
const barWidth = (band: number) => Math.max(1, band - Math.min(4, band * .25));

/** What the zoom says (decision 10), in days or weeks: an empty slot counts as its day or week. */
export function cacheZoomWords(m: CacheModel, shown: Shown | null): string {
  const units = m.week ? "weeks" : "days", all = m.slots.length;
  if (!shown) return `Showing all ${all} ${units}.`;
  return `Showing ${m.week ? "the weeks of " : ""}${dayLabel(m.slots[shown.from]!.day)} to ${dayLabel(m.slots[shown.to]!.day)}, `
    + `${shown.to - shown.from + 1} of ${all} ${units}.`;
}

/** The cache reads' edge (decision 6): 1px of the muted ink around each cache-read part, inset by half its line, on the
 *  bars' track over the stack, so the pale part keeps a 3:1 edge. The part is the one `stackRects` gives the stack, at the
 *  same bar width. It grows with its bar on a first drawing, as the stack does. */
function readsEdge(m: CacheModel, env: ChartEnv): CustomSeriesOption {
  const read = m.kinds.findIndex(k => k.k === "cache_read"), stroke = env.ink.muted;
  return {
    type: "custom",
    id: "reads-edge",
    ...trackAxes(0),
    data: m.totals.map((t, i) => [i, t]),
    encode: { x: 0, y: 1 },
    silent: true,
    renderItem: (params, api) => {
      const i = Number(api.value(0)), total = Number(api.value(1));
      const [cx, y0] = api.coord([i, 0]) as [number, number], [, top] = api.coord([i, total]) as [number, number];
      const w = barWidth((api.size!([1, 0]) as number[])[0]!);
      const part = stackRects(m.values[i]!, y0, top, cx - w / 2, w).find(s => s.j === read);
      if (!part) return null;
      const grow = env.motion && params.actionType == null
        ? { originX: cx, originY: y0, enterFrom: { scaleY: 0 }, enterAnimation: { delay: 6 * Math.min(i, 60) } } : {};
      return {
        type: "group",
        emphasisDisabled: true, // no highlight state, as the stack has none
        ...grow,
        children: [{
          type: "rect",
          shape: { x: part.x + .5, y: part.y + .5, width: Math.max(0, part.width - 1), height: Math.max(0, part.height - 1), r: part.r },
          style: { fill: "none", stroke, lineWidth: 1 },
        }],
      };
    },
  };
}

/** The chart's ECharts option: the bars (track 0), the breaks (1) and the ratio (2), the slider from ZOOM_FROM slots. */
export function cacheOption(m: CacheModel, env: ChartEnv): EChartsOption {
  const layout = cacheLayout(m, env.textScale), plot = env.width - layout.left - layout.right, ratioAxes = trackAxes(2);
  const title = (t: CacheTitle) => axisTitle(env, fitTitle(env, t.title, t.figures, plot), plot);
  const breaksAxis = valueAxis(env, { max: m.breakMax, step: m.breakMax, format: v => num(v) });
  // The ratio's one step from its floor to 100%, rounded off its float error (1 - .9 is 0.09999999999999998).
  const y = [
    { ...valueAxis(env, { ...m.scale, format: v => short(v) }), ...title(m.titles.bars) },
    { ...breaksAxis, axisLabel: { ...breaksAxis.axisLabel, show: false }, ...title(m.titles.breaks) },
    { ...valueAxis(env, { max: 1, step: +(1 - m.floor).toFixed(10), format: v => pct(v) }), min: m.floor, ...title(m.titles.ratio) },
  ];
  // The slider's faint trend is the first line on the lowest axis it drives that carries one: the totals' hidden line on the
  // ratio track, before the ratio line (S5). The bars and the breaks are custom series, which the slider does not read.
  const series: OptionSeries[] = m.zoom ? [sliderTrend(m.totals, ratioAxes)] : [];
  series.push(stackSeries({ kinds: m.kinds, values: m.values, hatched: () => false, env, width: barWidth, ...trackAxes(0) }));
  // In forced colors the stack edges every part in the text ink: the cache reads need no edge of their own.
  if (m.reads && !env.forced) series.push(readsEdge(m, env));
  series.push(
    stackSeries({ id: "breaks", kinds: m.breakKinds, values: m.breaks, hatched: () => false, env, width: barWidth, ...trackAxes(1) }),
    lineSeries(env, { id: "ratio", data: m.ratios, color: "var(--text-primary)", ...ratioAxes }),
    lineDots(env, { id: "ratio-dots", data: m.ratios, color: "var(--text-primary)", ...ratioAxes }),
  );
  // The slider names no window: the wrapper keeps the slots shown, and the three tracks keep the whole view's scales.
  return {
    ...baseOption(env),
    ...tracksOption(env, { layout, labels: m.slots.map(s => s.day), format: d => dayLabel(d), y }),
    series,
    ...(m.zoom ? { dataZoom: [{ ...zoomSlider(env), left: layout.left, right: layout.right }] } : {}),
  };
}
