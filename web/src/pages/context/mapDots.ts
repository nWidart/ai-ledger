// The session map as data (echart-context, design decision 9): mapModel() holds its sessions, mapFit() every pixel of its
// box, dotAt() and quadAtPixel() what a pixel of it reads, mapOption() the ECharts option drawn from the fit. All pure. Types
// only from the runtime: this module stays out of the ECharts chunk's way.
// The fit owns the pixels: the option's grid is the fit's plot, given whole with `outerBoundsMode: "none"`, so ECharts places
// a value on the log axis where the fit does (spike S4), and the map reads the dot under the pointer from the fit alone.
import type { SessionPoint } from "../../api";
import type { CustomSeriesOption, EChartsOption } from "../../components/echart/echarts";
import { baseOption, type OptionEnv, valueAxis } from "../../components/echart/option";
import { NEAR_LIMIT, QUADS, quadAt, quadOf, START_LARGE_TOKENS, short, type Quad } from "./context";

/** The margins at the default text size: they grow with the text, the plot keeps PLOT_HEIGHT. */
const MARGIN = { t: 14, r: 16, b: 46, l: 52 };
const PLOT_HEIGHT = 260;
/** A pointer reads the nearest dot within this many pixels. */
const PICK_PX = 12;
const R = 4, RING = 7.5;
const STEPS = [1, 2, 5, 10];
/** The labels' size, and the axis titles', at the default text size. */
const LABEL = 11, TITLE = 11.5;
const X_TITLE = "Starting context (tokens, log scale)", Y_TITLE = "Peak share of the window", NEAR_TEXT = "80% of window";

/** The round value (1, 2, 5 times a power of ten) at or below v. */
export function roundDown(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * [...STEPS].reverse().find(m => m * p <= v * (1 + 1e-9))!;
}
/** The round value at or above v. */
export function roundUp(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * STEPS.find(m => m * p >= v * (1 - 1e-9))!;
}
/** The x domain: round values around the starts, always spanning the 30k line. */
export function startDomain(starts: number[]): [number, number] {
  const lo = Math.max(1, Math.min(START_LARGE_TOKENS, ...starts)), hi = Math.max(START_LARGE_TOKENS, ...starts);
  const a = roundDown(lo), b = roundUp(hi);
  return [a, b > a ? b : a * 10];
}
/** Where a start sits on the log axis, 0 at the domain's low end and 1 at its high end. */
export const logFraction = (v: number, [lo, hi]: [number, number]): number => (Math.log(Math.max(v, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
/** The round ticks (1, 2, 5 times a power of ten) inside the domain. */
export function startTicks([lo, hi]: [number, number]): number[] {
  const out: number[] = [];
  for (let p = 10 ** Math.floor(Math.log10(lo)); p <= hi * (1 + 1e-9); p *= 10)
    for (const m of [1, 2, 5]) if (m * p >= lo * (1 - 1e-9) && m * p <= hi * (1 + 1e-9)) out.push(m * p);
  return out;
}
/** A point's share of its window as drawn: a peak over the window sits at 100%. */
export const drawnShare = (p: SessionPoint): number => Math.min(1, p.peak / p.window);

/** A quadrant's name as lines that fit room px at font size fs: one line when it fits, else its words wrapped, at a smaller size
 *  (down to 80%) when even its longest word does not fit. measure gives a text's width at fs; a width at another size is in
 *  proportion. */
export function fitLines(label: string, room: number, fs: number, measure: (text: string) => number): { lines: string[]; fs: number } {
  if (measure(label) <= room) return { lines: [label], fs };
  const lines: string[] = [];
  for (const word of label.split(" ")) {
    const last = lines.at(-1);
    if (last != null && measure(`${last} ${word}`) <= room) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const longest = Math.max(...lines.map(measure));
  return { lines, fs: longest <= room ? fs : Math.max(fs * .8, fs * room / longest) };
}

const byDate = (a: SessionPoint, b: SessionPoint) => (a.first_ts ?? "").localeCompare(b.first_ts ?? "") || a.session_id.localeCompare(b.session_id);

/** The map's figures: the sessions oldest first, the x domain and its ticks, and the sessions in each quadrant. */
export interface MapModel {
  points: SessionPoint[];
  domain: [number, number];
  ticks: number[];
  counts: Record<Quad, number>;
}

export function mapModel(points: readonly SessionPoint[]): MapModel {
  const sorted = points.slice().sort(byDate), domain = startDomain(sorted.map(p => p.start));
  const counts: Record<Quad, number> = { lean: 0, heavy: 0, full: 0, both: 0 };
  for (const p of sorted) counts[quadOf(p)]++;
  return { points: sorted, domain, ticks: startTicks(domain), counts };
}

interface Rect { x: number; y: number; width: number; height: number }
/** Where a text goes: its anchor, and how it sits on it. */
interface TextPlace { x: number; y: number; align: "left" | "right"; verticalAlign: "top" | "bottom" }
/** A quadrant's name: its lines (one or more), their size and line height, in its outer corner. */
interface NamePlace extends TextPlace { lines: string[]; size: number; lineHeight: number }

/** Every pixel of the map's box, in px from its top left. */
export interface MapFit {
  model: MapModel;
  textScale: number;
  /** The box's height: the plot and the margins. */
  height: number;
  plot: Rect;
  /** Each session's dot, in the order of model.points. */
  dots: { x: number; y: number }[];
  /** The 30,000-token line's x and the 80% line's y. */
  x30: number;
  y80: number;
  /** The "30k start" label, right of its line; the "80% of window" label, under its line, left of the 30k line or right of it
   *  when the plot left of the line is too narrow for it. */
  startLabel: TextPlace;
  nearLabel: TextPlace;
  names: Record<Quad, NamePlace>;
  /** The y axis's title: the long form, or "Peak share" when the plot is too short for it. */
  yTitle: string;
}

/** A text's width in px at the labels' size (11px times the text scale) and a font weight: `labelWidth` in the component. */
export type Measure = (text: string, weight: number) => number;

/** The map's pixels in a box `width` px wide: the margins grow with the text, the plot stays PLOT_HEIGHT high. */
export function mapFit(model: MapModel, width: number, textScale: number, measure: Measure): MapFit {
  const s = textScale;
  const plot = { x: MARGIN.l * s, y: MARGIN.t * s, width: Math.max(1, width - (MARGIN.l + MARGIN.r) * s), height: PLOT_HEIGHT };
  const right = plot.x + plot.width, bottom = plot.y + plot.height;
  const x = (v: number) => plot.x + logFraction(v, model.domain) * plot.width;
  const y = (share: number) => bottom - Math.min(1, share) * plot.height;
  const x30 = x(START_LARGE_TOKENS), y80 = y(NEAR_LIMIT);
  // Each name in its outer corner, wrapped to the room between the plot's edge and the 30k line.
  const names = Object.fromEntries(QUADS.map(q => {
    const { lines, fs } = fitLines(q.label, Math.max(1, (q.heavy ? right - x30 : x30 - plot.x) - 12), LABEL * s, t => measure(t, 600));
    const place: NamePlace = {
      lines, size: fs, lineHeight: fs * 1.15,
      x: q.heavy ? right - 6 : plot.x + 6, align: q.heavy ? "right" : "left",
      y: q.full ? plot.y + 4 * s : bottom - 4 * s, verticalAlign: q.full ? "top" : "bottom",
    };
    return [q.id, place];
  })) as Record<Quad, NamePlace>;
  const nearLeft = x30 - 4 - measure(NEAR_TEXT, 400) >= plot.x + 2;
  return {
    model, textScale: s, height: PLOT_HEIGHT + (MARGIN.t + MARGIN.b) * s, plot,
    dots: model.points.map(p => ({ x: x(p.start), y: y(drawnShare(p)) })),
    x30, y80,
    startLabel: { x: x30 + 4, y: y(.5), align: "left", verticalAlign: "bottom" },
    nearLabel: { x: nearLeft ? x30 - 4 : x30 + 4, y: y80 + 4 * s, align: nearLeft ? "right" : "left", verticalAlign: "top" },
    names,
    // The long title takes about 6.5px a character, times the text scale, along the axis.
    yTitle: Y_TITLE.length * 6.5 * s <= PLOT_HEIGHT ? Y_TITLE : "Peak share",
  };
}

/** The index (in model.points) of the dot nearest a pixel of the box within PICK_PX, or null. On a tie, the newer. */
export function dotAt(fit: MapFit, x: number, y: number): number | null {
  let best: number | null = null, d2 = PICK_PX ** 2;
  fit.dots.forEach((d, i) => {
    const e = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (e <= d2) { d2 = e; best = i; }
  });
  return best;
}

/** The quadrant under a pixel of the box, or null outside the plot. */
export function quadAtPixel(fit: MapFit, x: number, y: number): Quad | null {
  const { plot } = fit;
  if (x < plot.x || x > plot.x + plot.width || y < plot.y || y > plot.y + plot.height) return null;
  return quadAt(x >= fit.x30 ? START_LARGE_TOKENS : 0, y <= fit.y80 ? NEAR_LIMIT : 0);
}

/** The selected quadrant's wash, under the axes' grid lines (z -1, the axes at 0) as the grid lines show through it: one item,
 *  drawn at the fit's pixels. In forced colors a 2px frame in the highlight color, inset by half its line, and no fill. */
function wash(fit: MapFit, env: OptionEnv, q: (typeof QUADS)[number]): CustomSeriesOption {
  const { plot, x30, y80 } = fit, right = plot.x + plot.width, bottom = plot.y + plot.height;
  const r = { x: q.heavy ? x30 : plot.x, y: q.full ? plot.y : y80, width: q.heavy ? right - x30 : x30 - plot.x, height: q.full ? y80 - plot.y : bottom - y80 };
  const fill = env.color("var(--surface-2)");
  return {
    type: "custom",
    id: "wash",
    data: [[fit.model.domain[0], 0]],
    encode: { x: 0, y: 1 },
    silent: true,
    z: -1,
    renderItem: () => (env.forced
      ? { type: "rect", emphasisDisabled: true, shape: { x: r.x + 1, y: r.y + 1, width: r.width - 2, height: r.height - 2 }, style: { fill: "none", stroke: env.ink.accent, lineWidth: 2 } }
      : { type: "rect", emphasisDisabled: true, shape: r, style: { fill } }),
  } as CustomSeriesOption;
}

/** The 30k and 80% lines, their labels and the four names, under the dots (z 1). One item, drawn at the fit's pixels. Every
 *  text has a 3px halo in the surface's color. */
function guides(fit: MapFit, env: OptionEnv, quad: Quad | null): CustomSeriesOption {
  const { plot, x30, y80 } = fit, right = plot.x + plot.width, bottom = plot.y + plot.height;
  const { fontFamily } = baseOption(env).textStyle, size = LABEL * env.textScale;
  const text = (t: string, at: TextPlace, o: { fill: string; size?: number; weight?: number; lineHeight?: number }) => ({
    type: "text", emphasisDisabled: true,
    style: { text: t, ...at, fontFamily, fontSize: o.size ?? size, fontWeight: o.weight ?? 400, lineHeight: o.lineHeight, fill: o.fill, stroke: env.ink.surface, lineWidth: 3 },
  });
  const line = (x1: number, y1: number, x2: number, y2: number) => ({
    type: "line", emphasisDisabled: true, shape: { x1, y1, x2, y2 }, style: { stroke: env.ink.muted, lineWidth: 1, lineDash: [5, 4] },
  });
  return {
    type: "custom",
    id: "guides",
    data: [[fit.model.domain[0], 0]],
    encode: { x: 0, y: 1 },
    silent: true,
    z: 1,
    renderItem: () => {
      const children: object[] = [];
      children.push(line(x30, plot.y, x30, bottom), line(plot.x, y80, right, y80),
        text("30k start", fit.startLabel, { fill: env.ink.secondary }), text(NEAR_TEXT, fit.nearLabel, { fill: env.ink.secondary }));
      for (const n of QUADS) {
        const at = fit.names[n.id];
        children.push(text(at.lines.join("\n"), at, { fill: n.id === quad ? env.ink.text : env.ink.muted, size: at.size, weight: 600, lineHeight: at.lineHeight }));
      }
      return { type: "group", children };
    },
  } as CustomSeriesOption;
}

/** One dot per session over the guides (z 3), placed by ECharts on the axes: a 4px circle in its project's color at .75 in a
 *  1px surface edge, a 7.5px ring 1.5px wide around a compacted session's, and both at 20% outside the selected quadrant. In
 *  forced colors the edge and the ring are the text color; the dot keeps its project's. */
function dots(fit: MapFit, env: OptionEnv, quad: Quad | null, color: (project: SessionPoint["project"]) => string): CustomSeriesOption {
  const { points, domain } = fit.model, fills = new Map<string, string>();
  const fill = (p: SessionPoint) => {
    const css = color(p.project);
    if (!fills.has(css)) fills.set(css, env.color(css));
    return fills.get(css)!;
  };
  const colors = points.map(fill), edge = env.forced ? env.ink.text : env.ink.surface;
  return {
    type: "custom",
    id: "dots",
    // A start under the domain is drawn at its low end, as logFraction places it.
    data: points.map((p, i) => [Math.max(p.start, domain[0]), drawnShare(p), i]),
    encode: { x: 0, y: 1 },
    silent: true,
    z: 3,
    renderItem: (_params, api) => {
      const i = api.value(2) as number, p = points[i]!, c = colors[i]!;
      const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number];
      const opacity = quad && quadOf(p) !== quad ? .2 : 1;
      const children: object[] = [];
      if (p.compactions > 0) children.push({
        type: "circle", emphasisDisabled: true, shape: { cx, cy, r: RING },
        style: { fill: "none", stroke: env.forced ? env.ink.text : c, lineWidth: 1.5, opacity },
      });
      children.push({
        type: "circle", emphasisDisabled: true, shape: { cx, cy, r: R },
        style: { fill: c, fillOpacity: .75, stroke: edge, lineWidth: 1, opacity },
      });
      return { type: "group", children };
    },
  } as CustomSeriesOption;
}

/** The map's ECharts option: one grid at the fit's plot, a log x axis labelled at the model's ticks, a y axis from 0 to 100% in
 *  fifths, the selected quadrant's wash, the guides and the dots. Never animated: a dot sliding in would read as a session changing. quad: the selected
 *  quadrant, or null; color: a project's CSS color (`useColors`). */
export function mapOption(fit: MapFit, env: OptionEnv, { quad, color }: { quad: Quad | null; color: (project: SessionPoint["project"]) => string }): EChartsOption {
  const { model, plot } = fit, s = env.textScale, title = { color: env.ink.secondary, fontSize: TITLE * s };
  const selected = QUADS.filter(q => q.id === quad);
  return {
    ...baseOption(env),
    animation: false,
    grid: { left: plot.x, top: plot.y, width: plot.width, height: plot.height, outerBoundsMode: "none" },
    xAxis: {
      type: "log",
      min: model.domain[0],
      max: model.domain[1],
      axisLine: { show: false },
      axisTick: { show: false, customValues: [...model.ticks] },
      axisLabel: { customValues: [...model.ticks], color: env.ink.muted, fontSize: LABEL * s, margin: 8 * s, hideOverlap: true, formatter: (v: number) => short(v) },
      splitLine: { show: true, lineStyle: { color: env.ink.grid } },
      name: X_TITLE, nameLocation: "middle", nameGap: 30 * s, nameMoveOverlap: false, nameTextStyle: title,
    },
    yAxis: {
      ...valueAxis(env, { max: 1, step: .2, format: v => `${Math.round(v * 100)}%` }),
      name: fit.yTitle, nameLocation: "middle", nameGap: 34 * s, nameMoveOverlap: false, nameTextStyle: title,
    },
    series: [...selected.map(q => wash(fit, env, q)), guides(fit, env, quad), dots(fit, env, quad, color)],
  };
}
