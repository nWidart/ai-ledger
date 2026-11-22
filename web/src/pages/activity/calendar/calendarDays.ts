// The Activity calendar as data (graph-activity-calendar, decisions 2, 5, 7, 8 and 10): calendarFit() lays the weeks out in
// a box, calendarModel() holds the days shown with their figures and shades, calendarOption() draws them as custom series on
// no coordinate system, every pixel from the fit. All pure. Types only from the runtime: this module stays out of the
// ECharts chunk's way, and the layout is known without the chart, so the reading works before the drawing loads.
import type { DailyWorkRow, Day } from "../../../api";
import type { CustomSeriesOption, EChartsOption } from "../../../components/echart/echarts";
import { baseOption } from "../../../components/echart/option";
import type { ChartEnv } from "../../../components/echart/tokens";
import { dayRange } from "../../../format";
import { RANGES, type Range } from "../../../url";
import { busy, monday, type WorkMetric } from "../work";

/** The weeks the server sends: the current one and the 52 before it. */
const WEEKS = 53;
/** The right and bottom margins, in px at every text size. */
const EDGE = 2;

/** Where the weeks go in a box `width` px wide: the number of columns shown, the pitch (a cell and its gap) and the
 *  margins that hold the labels, in px from the box's left and top. */
export interface CalendarFit {
  width: number;
  /** The newest weeks that fit, at most 53. */
  weeks: number;
  pitch: number;
  gap: number;
  /** A cell's side: the pitch less the gap. */
  cell: number;
  /** The weekday labels' margin. */
  left: number;
  /** The month labels' margin. */
  top: number;
  /** The box's height: the margins and seven rows, less the last gap. */
  height: number;
}

/** The fit of decision 2: all 53 weeks at a pitch of up to 20px when they fit at the smallest pitch, else as many weeks as
 *  fit at the smallest. The smallest grows with the text, so two weekday labels two rows apart never touch; the cells
 *  keep their size otherwise. The block is never wider than the plot, so a phone shows fewer weeks and never scrolls. */
export function calendarFit(width: number, textScale: number): CalendarFit {
  const left = 30 * textScale, top = 18 * textScale, room = width - left - EDGE + 2; // the plot, and the last week's gap
  const smallest = Math.max(12, Math.ceil(.6 * 11 * textScale)), fit = Math.floor(room / WEEKS);
  const [weeks, pitch] = fit >= smallest ? [WEEKS, Math.min(20, fit)] : [Math.floor(room / smallest), smallest];
  const gap = pitch >= 16 ? 3 : 2;
  return { width, weeks, pitch, gap, cell: pitch - gap, left, top, height: top + 7 * pitch - gap + EDGE };
}

/** A shade, lightest to darkest of four; 0 is a day with none of the measure. */
export type Shade = 0 | 1 | 2 | 3 | 4;
/** A step of the scale: the values from `from` to `to`, or every value from `from` when `to` is null. */
export interface CalendarStep { from: number; to: number | null; shade: Exclude<Shade, 0> }
/** The shades of 1 to 4 steps in use: one step is the middle shade, and the darkest always marks the busiest days. */
const SHADES: readonly (readonly Exclude<Shade, 0>[])[] = [[3], [2, 4], [1, 3, 4], [1, 2, 3, 4]];

/** The scale of decision 5, from the values above 0: the upper bounds are the distinct nearest-rank cuts at 50, 80 and 95%,
 *  with an open step over the last when the largest value is above it. None without a value above 0. */
export function calendarSteps(values: readonly number[]): CalendarStep[] {
  const s = values.filter(v => v > 0).sort((a, b) => a - b), n = s.length;
  if (!n) return [];
  const bounds = [...new Set([50, 80, 95].map(p => s[Math.ceil(n * p / 100) - 1]!))]; // n × p is exact, n × .95 is not
  const tos = s[n - 1]! > bounds.at(-1)! ? [...bounds, null] : bounds, shades = SHADES[tos.length - 1]!;
  return tos.map((to, i) => ({ from: i ? bounds[i - 1]! + 1 : 1, to, shade: shades[i]! }));
}

/** What the model reads of the calendar's payload: its 53 weeks from `start` (a Monday) to `end` (today), the first day
 *  recorded under the same filters (over all time, or null), and a row per day with work. */
export interface CalendarDays { start: Day; end: Day; first: Day | null; days: readonly DailyWorkRow[] }
/** The page's selection: a day, or a week by its Monday. */
export interface CalendarSelection { day: Day; days: 1 | 7 }

/** A day shown, with its cell: the column (0 the oldest week shown) and the row (0 Monday). */
export interface CalendarDay {
  day: Day;
  col: number;
  row: number;
  /** The day's figures, zeros for a day with none. */
  work: DailyWorkRow;
  /** Some session, prompt, commit or failed call (`busy` of the work chart): a pick selects only such a day, and any other
   *  reads "No activity". */
  busy: boolean;
  /** The measure's figure. */
  value: number;
  /** Its step, from 1, or 0 for none of the measure. */
  step: number;
  shade: Shade;
}

export interface CalendarModel {
  metric: WorkMetric;
  /** The Monday of the first week shown. */
  from: Day;
  /** The weeks shown: the fit's, or fewer when the payload holds fewer. */
  weeks: number;
  /** The readable days, oldest first: from the later of `from` and the first recorded day, to today. */
  days: CalendarDay[];
  /** The scale, over every day of the payload, shown or not: a day has the same shade at every width. */
  steps: CalendarStep[];
  /** The oldest day shown with the most of the measure; null when no day shown has any. */
  peak: CalendarDay | null;
  /** The days shown with some of the measure. */
  active: number;
  /** The selection's cells: `rows` cells down from (col, row). Null for none, or when no cell of it is shown. */
  selection: { col: number; row: number; rows: number } | null;
  /** What makes this the same chart (EChart's `view`): the measure and the weeks shown, never the figures or the selection. */
  view: string;
}

const at = (k: Day) => Date.parse(k + "T00:00:00Z");
const shift = (k: Day, n: number): Day => new Date(at(k) + n * 864e5).toISOString().slice(0, 10);
/** The days from a to b. */
const between = (a: Day, b: Day) => Math.round((at(b) - at(a)) / 864e5);
const none = (day: Day): DailyWorkRow => ({ day, sessions: 0, prompts: 0, commits: 0, calls: 0, failed_calls: 0 });

/** The newest `weeks` weeks of the payload, shaded by `metric`, with the selection's place. */
export function calendarModel(d: CalendarDays, metric: WorkMetric, weeks: number, selected: CalendarSelection | null): CalendarModel {
  const last = monday(d.end), shown = Math.min(weeks, between(monday(d.start), last) / 7 + 1);
  const from = shift(last, -7 * (shown - 1)), steps = calendarSteps(d.days.map(r => r[metric]));
  const have = new Map(d.days.map(r => [r.day, r]));
  const begin = d.first && d.first > from ? d.first : from;
  const days = !d.first || begin > d.end ? [] : dayRange(begin, d.end).map((day): CalendarDay => {
    const i = between(from, day), work = have.get(day) ?? none(day), value = work[metric];
    const step = value > 0 ? steps.findIndex(s => s.to == null || value <= s.to) + 1 : 0;
    return { day, col: Math.floor(i / 7), row: i % 7, work, busy: busy(work), value, step, shade: step ? steps[step - 1]!.shade : 0 };
  });
  const active = days.filter(c => c.value > 0);
  const cells = !selected ? [] : days.filter(c => (selected.days === 1 ? c.day === selected.day : monday(c.day) === selected.day));
  return {
    metric, from, weeks: shown, days, steps, active: active.length,
    peak: active.reduce<CalendarDay | null>((p, c) => (!p || c.value > p.value ? c : p), null),
    selection: cells[0] ? { col: cells[0].col, row: cells[0].row, rows: cells.length } : null,
    view: `${metric} ${from} ${shown}`,
  };
}

/** The range a pick of `day` needs (decision 7): the page's when it holds the day, else the smallest that does, else all
 *  time. A range of r days ends with `end` and starts r − 1 days before it. */
export function rangeFor(day: Day, end: Day, range: Range): Range {
  const back = between(day, end), holds = (r: Range) => r === 0 || back < r;
  return holds(range) ? range : RANGES.find(holds)!;
}

let measure: CanvasRenderingContext2D | null | undefined;
/** A label's width in px, by zrender's measure (a canvas); jsdom has none, so there it estimates 0.6em a character.
 *  The same measure as option.ts's own, which it does not export. */
function textWidth(text: string, font: string, size: number): number {
  measure ||= document.createElement("canvas").getContext("2d");
  if (!measure) return text.length * size * .6;
  measure.font = `${size}px ${font}`;
  return measure.measureText(text).width;
}
const monthName = (k: Day) => new Date(at(k)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
const weekdayName = (row: number) => new Date(Date.UTC(2024, 0, 1 + row)).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

type Shape = { type: "rect"; emphasisDisabled: true; shape: { x: number; y: number; width: number; height: number }; style: { fill: string; stroke?: string; lineWidth?: number } };
const rect = (x: number, y: number, side: number, style: Shape["style"], height = side): Shape =>
  ({ type: "rect", emphasisDisabled: true, shape: { x, y, width: side, height }, style });

/** A day's cell. In the theme, a square in its shade's token, or the grid ink for none of the measure. Under forced colors a
 *  shade is no system color, so the shade is a size: a centred square in the text ink, a quarter of the cell per shade
 *  (3px at least), and none of the measure an unfilled square edged in the grid ink (GrayText), quieter than a day of work. */
function cell(c: CalendarDay, fit: CalendarFit, env: ChartEnv): Shape {
  const x = fit.left + c.col * fit.pitch, y = fit.top + c.row * fit.pitch, side = fit.cell;
  if (!env.forced) return rect(x, y, side, { fill: c.shade ? env.color(`var(--heat-${c.shade})`) : env.ink.grid });
  if (!c.shade) return rect(x + .5, y + .5, side - 1, { fill: "none", stroke: env.ink.grid, lineWidth: 1 });
  const s = Math.max(3, Math.round(side * c.shade / 4)), inset = (side - s) / 2;
  return rect(x + inset, y + inset, s, { fill: env.ink.text });
}

/** The weekday and month labels, in the muted ink at the charts' font. Mon, Wed and Fri end 6px (times the text scale)
 *  before the first column. A month's name starts over the first column whose Monday is in it; it is left out when the next
 *  name starts less than 28px (times the text scale) after it, or when it would end past the box. */
function labels(m: CalendarModel, fit: CalendarFit, env: ChartEnv) {
  const { fontFamily, fontSize } = baseOption(env).textStyle, s = env.textScale;
  const text = (t: string, x: number, y: number, align: "left" | "right", verticalAlign: "middle" | "bottom") =>
    ({ type: "text" as const, style: { text: t, x, y, align, verticalAlign, fontFamily, fontSize, fill: env.ink.muted } });
  const days = [0, 2, 4].map(row => text(weekdayName(row), fit.left - 6 * s, fit.top + row * fit.pitch + fit.cell / 2, "right", "middle"));
  const starts: { x: number; name: string }[] = [];
  for (let col = 0; col < m.weeks; col++) {
    const name = monthName(shift(m.from, 7 * col));
    if (name !== starts.at(-1)?.name || !col) starts.push({ x: fit.left + col * fit.pitch, name });
  }
  const months = starts.filter((l, i) => (starts[i + 1]?.x ?? Infinity) - l.x >= 28 * s && l.x + textWidth(l.name, fontFamily, fontSize) <= fit.width)
    .map(l => text(l.name, l.x, fit.top - 4 * s, "left", "bottom"));
  return [...days, ...months];
}

/** The calendar's option (decision 10): the cells, the labels and, with a selection shown, its frame, as custom series on
 *  no coordinate system, so there is no grid, axis or zoom. Nothing animates. The cells take the pointer only with
 *  `pick` (zrender's hand cursor); the labels and the frame never do. */
export function calendarOption(m: CalendarModel, fit: CalendarFit, env: ChartEnv, pick: boolean): EChartsOption {
  const children = labels(m, fit, env);
  const series: CustomSeriesOption[] = [
    {
      type: "custom", id: "cells", coordinateSystem: "none", silent: !pick,
      data: m.days.map((_, i) => [i]),
      renderItem: (_, api) => cell(m.days[api.value(0) as number]!, fit, env),
    },
    { type: "custom", id: "labels", coordinateSystem: "none", silent: true, data: [0], renderItem: () => ({ type: "group", children }) },
  ];
  const sel = m.selection;
  if (sel) {
    // On the cells' edge, inset by half the line and unfilled, so the shade stays readable: 1.5px in the accent, 2px in
    // forced colors, where the accent is Highlight.
    const line = env.forced ? 2 : 1.5;
    const frame = rect(fit.left + sel.col * fit.pitch + line / 2, fit.top + sel.row * fit.pitch + line / 2, fit.cell - line,
      { fill: "none", stroke: env.ink.accent, lineWidth: line }, sel.rows * fit.pitch - fit.gap - line);
    series.push({ type: "custom", id: "selected", coordinateSystem: "none", silent: true, z: 3, data: [0], renderItem: () => frame });
  }
  return { ...baseOption(env), animation: false, series };
}
