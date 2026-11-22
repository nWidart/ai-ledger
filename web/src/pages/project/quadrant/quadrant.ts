// The session quadrant, pure: one project's sessions as dots by estimated cost (across) and tool calls (up), both on log
// scales, split at the medians into four named quadrants. The model holds the dots in their reading order, the medians and
// the counts; the fit places them in pixels, as ECharts does with outerBoundsMode "none"; the rest is the graph's own
// reading (the dot under a pointer, the dot a key reads) and its sentences.
import type { SessionRow } from "../../../api";
import { labelWidth, type OptionEnv } from "../../../components/echart/option";
import { sessName } from "../../../components/sheets/session";
import { median, num, plural, usd0, when } from "../../../format";

/** The part of a usage session row the graph reads. */
export type QuadRow = Pick<SessionRow, "session_id" | "title" | "first_ts" | "cost" | "unpriced" | "tool_calls" | "commits">;

export type Quadrant = "cheapMuch" | "costlyMuch" | "cheapLittle" | "costlyLittle";
/** The quadrants in the order of their corners: top left, top right, bottom left, bottom right. */
export const QUADRANTS: readonly { id: Quadrant; label: string }[] = [
  { id: "cheapMuch", label: "Cheap, much done" },
  { id: "costlyMuch", label: "Costly, much done" },
  { id: "cheapLittle", label: "Cheap, little done" },
  { id: "costlyLittle", label: "Costly, little done" },
];
/** Each quadrant's name, by its id. */
export const QUADRANT_LABEL = Object.fromEntries(QUADRANTS.map(q => [q.id, q.label])) as Record<Quadrant, string>;

/** A session with a known cost. quadrant: null with fewer than three dots. */
export interface Dot { row: QuadRow; cost: number; calls: number; filled: boolean; quadrant: Quadrant | null }
/** An axis's round ends around its positive values, and whether a shown value is 0 (it then needs a lane). */
export interface Extent { lo: number; hi: number; zero: boolean }
export interface QuadrantModel {
  /** Cheapest first; equal costs by tool calls, fewer first; then by start, then by id. */
  dots: Dot[];
  /** The median cost and tool calls of the dots; null with fewer than three. */
  split: { cost: number; calls: number } | null;
  /** The dots in each quadrant; null with no split. */
  counts: Record<Quadrant, number> | null;
  /** Rows with no known cost, and rows with a cost below $0 (a custom price list may hold negative rates): no dot. */
  leftOut: number; negative: number;
  /** The rows given, and the sessions of the view; cut when the view holds more sessions than the rows. */
  rows: number; total: number; cut: boolean;
  x: Extent; y: Extent;
}

const STEPS = [1, 2, 5, 10];
/** The round value (1, 2 or 5 times a power of ten) at or below v > 0. */
const roundDown = (v: number): number => {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * [...STEPS].reverse().find(m => m * p <= v * (1 + 1e-9))!;
};
/** The round value at or above v > 0. */
const roundUp = (v: number): number => {
  const p = 10 ** Math.floor(Math.log10(v));
  return p * STEPS.find(m => m * p >= v * (1 - 1e-9))!;
};
/** The round ends around the positive values; equal ends span a decade. With no positive value, the fallback decade. */
function extent(values: number[], fallback: number): Extent {
  const pos = values.filter(v => v > 0), zero = values.some(v => v <= 0);
  if (!pos.length) return { lo: fallback, hi: fallback * 10, zero };
  const lo = roundDown(Math.min(...pos)), hi = roundUp(Math.max(...pos));
  return { lo, hi: hi > lo ? hi : lo * 10, zero };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byReading = (a: Dot, b: Dot) =>
  a.cost - b.cost || a.calls - b.calls || cmp(a.row.first_ts ?? "", b.row.first_ts ?? "") || cmp(a.row.session_id, b.row.session_id);

/** rows: the view's sessions as the usage payload lists them (the newest, cut); totalSessions: the view's count before the cut. */
export function quadrantModel(rows: readonly QuadRow[], totalSessions: number): QuadrantModel {
  // A log axis holds no value below 0, and the zero lane reads "$0": a session below $0 has no true place on either.
  const negative = rows.filter(r => r.cost != null && r.cost < 0).length;
  const dots: Dot[] = rows.filter(r => r.cost != null && r.cost >= 0)
    .map(row => ({ row, cost: row.cost!, calls: row.tool_calls, filled: row.commits > 0, quadrant: null as Quadrant | null }))
    .sort(byReading);
  let split: QuadrantModel["split"] = null, counts: QuadrantModel["counts"] = null;
  if (dots.length >= 3) {
    split = { cost: median(dots.map(d => d.cost))!, calls: median(dots.map(d => d.calls))! };
    counts = { cheapMuch: 0, costlyMuch: 0, cheapLittle: 0, costlyLittle: 0 };
    for (const d of dots) {
      // A dot on a line counts as cheap, or as little done.
      d.quadrant = d.cost > split.cost ? (d.calls > split.calls ? "costlyMuch" : "costlyLittle") : d.calls > split.calls ? "cheapMuch" : "cheapLittle";
      counts[d.quadrant]++;
    }
  }
  return {
    dots, split, counts, leftOut: rows.length - dots.length - negative, negative, rows: rows.length, total: Math.max(totalSessions, rows.length), cut: totalSessions > rows.length,
    x: extent(dots.map(d => d.cost), 0.01), y: extent(dots.map(d => d.calls), 1),
  };
}

/** An axis as drawn: min is under lo by the zero lane when the axis has one. */
export interface FitAxis { min: number; max: number; lane: boolean }
/** A dot as drawn: its axis values (a 0 moved to the lane's min) and its pixel in the box. */
export interface FitDot { x: number; y: number; px: number; py: number; filled: boolean }
/** A quadrant name that fits its corner: its anchor in the box, and how the text sits on it. */
export interface FitName { quadrant: Quadrant; label: string; px: number; py: number; align: "left" | "right"; verticalAlign: "top" | "bottom" }
export interface QuadrantFit {
  /** The box: width as measured, height 210 + 54 × s, rounded. */
  width: number; height: number;
  /** The plot's rectangle in the box: the ECharts grid, with outerBoundsMode "none". */
  plot: { x: number; y: number; w: number; h: number };
  /** The tool-call axis name's gap from the axis line, in px: past the widest label. */
  nameGap: number;
  /** How far left of the plot's centre the cost axis name sits, in px: 0 unless it would pass the box's right edge. */
  costNameShift: number;
  x: FitAxis; y: FitAxis;
  /** In the model's order. */
  dots: FitDot[];
  /** The medians as drawn; null with no split. */
  guides: { x: number; y: number; px: number; py: number } | null;
  /** The corner names that fit; none with no split. */
  names: FitName[];
}

const PLOT_H = 210;
/** The margins at text scale 1: room for the labels and the axis names, the least the left and right ones take. */
const M = { left: 58, right: 14, top: 10, bottom: 44 };
/** The tool-call axis name's least gap from the axis line, and how far its centre sits past the widest label (the label's
 *  6px margin and half the name's line), at text scale 1: a four-digit label keeps the least gap. The left margin ends
 *  16px past the name's centre. */
const NAME_GAP = 42, NAME_PAST = 12;
/** The axes' names. */
export const COST_NAME = "Estimated cost (log scale)", CALLS_NAME = "Tool calls (log scale)";

/** A cost tick: "$" and the value, with the decimals a 1, 2 or 5 times a power of ten needs ("$0.02", "$0.1", "$10"). */
export const costLabel = (v: number) => "$" + num(v, Math.max(0, Math.ceil(-Math.log10(v) - 1e-9)));
/** The room the texts take at text scale s, measured as zrender lays them out: the widest tool-call label (the top end's,
 *  or the power of ten under it, which has as many digits), the cost axis's last, at the plot's right end, and its name. */
function textRoom(model: QuadrantModel, s: number) {
  const env = { textScale: s } as OptionEnv, top = model.y.hi;
  return {
    y: Math.max(labelWidth(env, num(top)), labelWidth(env, num(10 ** Math.floor(Math.log10(top) + 1e-9)))),
    x: labelWidth(env, costLabel(model.x.hi)),
    name: labelWidth(env, COST_NAME),
  };
}
/** The zero lanes at text scale 1: half a "$0.01" label across, one line up. */
const LANE_X = 30, LANE_Y = 16;

/** The axis drawn over a plot length of p px: with a lane, min sits so the stretch under the smallest tick is l px, and at
 *  most a decade. ECharts ticks a log axis at its ends and at the powers of ten, so the smallest tick over the lane is the
 *  power of ten at or under lo, and a lane of more than a decade holds another: either tick, drawn in the lane, would hide
 *  the lane's "0" label. A lane of a decade has its power of ten at min, where it reads "0". */
function fitAxis(e: Extent, p: number, l: number): FitAxis {
  if (!e.zero) return { min: e.lo, max: e.hi, lane: false };
  const room = Math.max(p, 2 * l); // a plot too short for its lane gives it half
  const tick = 10 ** Math.floor(Math.log10(e.lo) + 1e-9);
  return { min: Math.max(tick * (tick / e.hi) ** (l / (room - l)), tick / 10), max: e.hi, lane: true };
}
/** Where v sits on the axis, 0 at min and 1 at max; a 0 sits at min. */
const frac = (v: number, a: FitAxis) => (Math.log(Math.max(v, a.min)) - Math.log(a.min)) / (Math.log(a.max) - Math.log(a.min));

/** width: the box's width in px; s: the text scale (textScale()). */
export function quadrantFit(model: QuadrantModel, width: number, s: number): QuadrantFit {
  // A label wider than a four-digit count, or a last cost label wider than "$200", widens its margin: with
  // outerBoundsMode "none" ECharts would draw it over the axis name, or past the box. A wider left margin moves the
  // plot's centre right, and the cost axis name with it: past the box's right edge, the name moves back left.
  const room = textRoom(model, s), nameGap = Math.max(NAME_GAP * s, room.y + NAME_PAST * s);
  const left = nameGap + (M.left - NAME_GAP) * s, right = Math.max(M.right * s, room.x / 2);
  const plot = { x: left, y: M.top * s, w: Math.max(0, width - left - right), h: PLOT_H };
  const costNameShift = Math.max(0, Math.min(plot.x + plot.w / 2 + room.name / 2 - width, plot.x + plot.w / 2 - room.name / 2));
  const x = fitAxis(model.x, plot.w, LANE_X * s), y = fitAxis(model.y, plot.h, LANE_Y * s);
  const at = (cost: number, calls: number) => {
    const vx = Math.max(cost, x.min), vy = Math.max(calls, y.min);
    return { x: vx, y: vy, px: plot.x + frac(vx, x) * plot.w, py: plot.y + plot.h - frac(vy, y) * plot.h };
  };
  const guides = model.split && at(model.split.cost, model.split.calls);
  const names: FitName[] = [];
  if (guides) {
    const pad = 6 * s, right = plot.x + plot.w, bottom = plot.y + plot.h, charW = .6 * 11 * s;
    for (const { id, label } of QUADRANTS) {
      const left = id.startsWith("cheap"), top = id.endsWith("Much");
      if (label.length * charW > (left ? guides.px - plot.x : right - guides.px) - 2 * pad) continue;
      names.push({ quadrant: id, label, px: left ? plot.x + pad : right - pad, py: top ? plot.y + pad : bottom - pad,
        align: left ? "left" : "right", verticalAlign: top ? "top" : "bottom" });
    }
  }
  return {
    width, height: Math.round(PLOT_H + (M.top + M.bottom) * s), plot, nameGap, costNameShift, x, y,
    dots: model.dots.map(d => ({ ...at(d.cost, d.calls), filled: d.filled })), guides, names,
  };
}

/** A pointer picks the nearest dot centre within this many px; dots within PILE_PX of it are said to sit with it. */
const PICK_PX = 12, PILE_PX = 4;
const dist2 = (d: FitDot, x: number, y: number) => (d.px - x) ** 2 + (d.py - y) ** 2;

/** The index of the dot nearest (x, y), in the box's px, within 12px; equal distances go to the costlier. Null outside every dot. */
export function dotAt(fit: QuadrantFit, x: number, y: number): number | null {
  let best: number | null = null, d2 = PICK_PX ** 2;
  fit.dots.forEach((d, i) => { const e = dist2(d, x, y); if (e <= d2) { d2 = e; best = i; } });
  return best;
}
/** The other dots whose centres are within 4px of dot i's. */
const pile = (fit: QuadrantFit, i: number) => fit.dots.filter((d, j) => j !== i && dist2(d, fit.dots[i]!.px, fit.dots[i]!.py) <= PILE_PX ** 2).length;

/** The session a key reads from the session at (null for none): Right and Left the next and previous, stopping at the ends; Home
 *  and End the ends; Right with none read the cheapest, Left the costliest. order: session ids, cheapest first. Undefined for any
 *  other key, or with no session. */
export function stepDot(order: readonly string[], at: string | null, key: string): string | undefined {
  if (!order.length) return undefined;
  const i = at == null ? -1 : order.indexOf(at), last = order.length - 1;
  switch (key) {
    case "ArrowRight": return order[i < 0 ? 0 : Math.min(i + 1, last)];
    case "ArrowLeft": return order[i < 0 ? last : Math.max(i - 1, 0)];
    case "Home": return order[0];
    case "End": return order[last];
    default: return undefined;
  }
}

const subCent = (n: number) => n > 0 && n < .005;
/** A cost as usd0() writes it, "$0" as the zero lane reads, except a positive cost that rounds to $0.00: "<$0.01", or "under
 *  $0.01" in a sentence. */
const dollars = (n: number, sentence = false) => (subCent(n) ? (sentence ? "under $0.01" : "<$0.01") : usd0(n));
/** A dot's cost; with unpriced requests it is a floor: "at least $1.10" ("$1.10" bare, beside an Unpriced chip), or "more
 *  than $0" under a cent. */
export const costText = (d: Dot, { sentence = false, bare = false } = {}) =>
  !d.row.unpriced ? dollars(d.cost, sentence) : subCent(d.cost) ? "more than $0" : (bare ? "" : "at least ") + usd0(d.cost);
const count = (n: number, one: string) => (n ? plural(n, one) : `no ${one}`);
/** A median of counts is a whole number or a half; plural() rounds to a whole number, so it would say "23" for 22.5. */
const calls = (n: number) => `${num(n, n % 1 ? 1 : 0)} ${n === 1 ? "tool call" : "tool calls"}`;

/** Dot i in one sentence, as the live region says it. */
export function readDot(model: QuadrantModel, i: number): string {
  const d = model.dots[i]!;
  return `${sessName(d.row)}, started ${when(d.row.first_ts)}: ${costText(d, { sentence: true })}, ${count(d.calls, "tool call")}, ${count(d.row.commits, "commit")}.`
    + (d.quadrant ? ` ${QUADRANT_LABEL[d.quadrant]}.` : "");
}

/** Dot i's tooltip: the name, its figures, the quadrant and the dots that sit with it. unpriced: some requests have no price. */
export function tipRows(model: QuadrantModel, fit: QuadrantFit, i: number) {
  const d = model.dots[i]!, more = pile(fit, i);
  return {
    name: sessName(d.row),
    rows: [["Started", when(d.row.first_ts)], ["Est. cost", costText(d)], ["Tool calls", num(d.calls)], ["Commits", num(d.row.commits)]] as [string, string][],
    unpriced: d.row.unpriced > 0,
    quadrant: d.quadrant && QUADRANT_LABEL[d.quadrant],
    more: more ? `and ${plural(more, "more session")} here` : null,
  };
}

const few = (n: number) => `${plural(n, "session")}: too few to split at a median.`;

/** The plot's label, on the wrapper's focusable box. */
export function groupLabel(model: QuadrantModel, project: string): string {
  const { split, counts } = model, n = model.dots.length;
  const body = split && counts
    ? `${plural(n, "session")}, split at the medians of ${dollars(split.cost, true)} and ${calls(split.calls)}. `
      + `Costly, little done: ${num(counts.costlyLittle)}; cheap, much done: ${num(counts.cheapMuch)}; `
      + `costly, much done: ${num(counts.costlyMuch)}; cheap, little done: ${num(counts.cheapLittle)}.`
    : few(n);
  return `Sessions of ${project} by estimated cost and tool calls, both on log scales: ${body} Filled dots made a commit. `
    + "Use the left and right arrow keys to step from the cheapest session to the costliest, Home and End for the ends, Enter to open one.";
}

/** The block's lines around the plot, each null when it does not apply. none: in place of the plot; few: in place of the split;
 *  cut: above the plot; leftOut: under it. */
export function notes(model: QuadrantModel) {
  const n = model.dots.length, out = model.leftOut, neg = model.negative;
  const one = (k: number, what: string) => `${plural(k, "session")} with ${what} ${k === 1 ? "is" : "are"} left out.`;
  return {
    none: n ? null : `No session in this view has a known cost${neg ? " of $0 or more" : ""}, so none can be placed.`,
    few: n && !model.split ? few(n) : null,
    cut: model.cut ? `The newest ${num(model.rows)} of ${num(model.total)} sessions in this view; the medians are theirs.` : null,
    leftOut: !n || !(out + neg) ? null
      : out && neg ? `${plural(out + neg, "session")} are left out: ${num(out)} with no known cost and ${num(neg)} with a negative cost.`
      : out ? one(out, "no known cost") : one(neg, "a negative cost"),
  };
}
