// Cost's flow from project to model to token kind as data (design decisions 2, 4, 5, 8, 10 and 11): flowModel() holds its
// nodes and bands, flowFit() and flowLayout() place them in px, flowOption() draws them as ECharts custom series on no
// coordinate system. All pure. Types only from the runtime: this module stays out of the ECharts chunk's way. Not
// costFlow.ts: on a case-insensitive file system ./costFlow would also resolve to CostFlow.tsx.
import type { FlowModel, FlowPair, Totals, UnpricedRow } from "../../../api";
import { color } from "../../../colors";
import type { CustomSeriesOption, EChartsOption } from "../../../components/echart/echarts";
import { baseOption, type OptionEnv } from "../../../components/echart/option";
import { num, usd } from "../../../format";
import { costKinds } from "../cost";

/** The part of the usage payload the flow reads. cost_flow holds priced or reported requests only (decision 3). */
export interface FlowInput {
  project: string;
  totals: Pick<Totals, "requests" | "cost" | "cost_input" | "cost_output" | "cost_cache_read" | "cost_cache_5m" | "cost_cache_1h">;
  unpriced: UnpricedRow[];
  cost_flow: { pairs: FlowPair[]; models: FlowModel[] };
}

export type FlowColumnKey = "project" | "model" | "kind";
export interface FlowNode {
  /** p:<project> ("p:" with no project), m:<model>, k:<kind>; Other is the bare letter ("p", "m"), which no name gives. */
  id: string;
  /** The index of its column. */
  column: number;
  /** Its name in full, as said and listed: "(no project)", a model without "claude-", "Other (3)", "Cache read". */
  label: string;
  value: number;
  /** A CSS color token. */
  color: string;
  /** A named project: the name its sheet opens with. */
  project?: string;
  /** Other's names, costliest first. */
  members?: { label: string; value: number }[];
}
export interface FlowBand { id: `${string}|${string}`; from: string; to: string; value: number }
export interface FlowColumn { key: FlowColumnKey; title: string; nodes: FlowNode[] }
export interface FlowGraph {
  /** Why there is no flow (decision 11), or null. With a sentence, the columns and bands are empty. */
  empty: string | null;
  /** The view's priced cost: every column adds up to it. */
  total: number;
  /** Project, Model, Token kind; with one project selected, Model and Token kind. */
  columns: FlowColumn[];
  bands: FlowBand[];
}

const TITLE: Record<FlowColumnKey, string> = { project: "Project", model: "Model", kind: "Token kind" };
/** The billed kinds, as the Tokens and cache drawer names them (tokenPairs in cost.ts), and the reported cost. */
export const KINDS: { id: string; label: string; of: (m: FlowModel) => number }[] = [
  { id: "k:input", label: "Input", of: m => m.cost_input ?? 0 },
  { id: "k:output", label: "Output + thinking", of: m => m.cost_output ?? 0 },
  { id: "k:write", label: "Cache write", of: m => (m.cost_cache_5m ?? 0) + (m.cost_cache_1h ?? 0) },
  { id: "k:read", label: "Cache read", of: m => m.cost_cache_read ?? 0 },
];
export const REPORTED = "k:reported";
/** A model's cost less its kinds under this is float leftovers, not a reported cost (as costDays' guard). */
export const EPS = 1e-9;
const KIND_COLOR = "var(--text-secondary)";
const FOLD = { keep: 5, floor: .01 };

/** Names with a cost, costliest first, ties A to Z on `tie`. */
const ranked = <T extends { value: number }>(xs: Iterable<T>, tie: (x: T) => string): T[] =>
  [...xs].filter(x => x.value > 0).sort((a, b) => b.value - a.value || (tie(a) < tie(b) ? -1 : tie(a) > tie(b) ? 1 : 0));

/** Decision 4: the first five that hold 1% of the total keep a node, the rest go to one Other, unless only one would.
 *  Ties A to Z on the raw name, as costKinds ranks the daily chart's models, so both give a model the same place and color. */
function fold(names: { key: string; label: string; value: number }[], total: number): { kept: typeof names; rest: typeof names } {
  const on = ranked(names, n => n.key);
  let n = 0;
  while (n < on.length && n < FOLD.keep && on[n]!.value >= FOLD.floor * total) n++;
  if (on.length - n === 1) n++;
  return { kept: on.slice(0, n), rest: on.slice(n) };
}

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/** The flow of a view: its columns of nodes, each by cost with Other and Reported last, and its bands, in dollars. */
export function flowModel(d: FlowInput): FlowGraph {
  const none = (empty: string): FlowGraph => ({ empty, total: 0, columns: [], bands: [] });
  if (!d.totals.requests) return none("No usage in this view, so no cost to follow.");
  if (d.totals.cost == null) return none("No request in this view is priced, so there is no cost to follow.");
  const pairs = d.cost_flow.pairs.filter(p => p.cost > 0);
  const total = pairs.reduce((s, p) => s + p.cost, 0);
  if (!(total > 0)) return none("The priced requests in this view cost $0.00, so there is no cost to follow.");

  // Models: folded on their cost in the view, colored as the daily chart stacked by model colors them.
  const modelCost = new Map<string, number>();
  for (const p of pairs) add(modelCost, p.model, p.cost);
  const modelColor = new Map(costKinds({ project: d.project, by_project: [], daily_models: [...modelCost].map(([model, cost]) => ({ day: "", model, cost })) }, "model")
    .map(k => [k.k, k.c]));
  const models = fold([...modelCost].map(([m, value]) => ({ key: m, label: m.replace(/^claude-/, ""), value })), total);
  const modelId = new Map<string, string>([...models.kept.map(m => [m.key, "m:" + m.key] as const), ...models.rest.map(m => [m.key, "m"] as const)]);

  const columns: FlowColumn[] = [];
  const bands = new Map<string, FlowBand>();
  const flow = (from: string, to: string, v: number) => {
    if (!(v > 0)) return;
    const id = `${from}|${to}` as const, b = bands.get(id);
    if (b) b.value += v;
    else bands.set(id, { id, from, to, value: v });
  };
  const other = (prefix: string, column: number, rest: { label: string; value: number }[]): FlowNode[] =>
    rest.length ? [{ id: prefix, column, label: `Other (${num(rest.length)})`, value: rest.reduce((s, r) => s + r.value, 0), color: color(""),
      members: rest.map(r => ({ label: r.label, value: r.value })) }] : [];

  if (!d.project) {
    const projectCost = new Map<string, number>();
    for (const p of pairs) add(projectCost, p.project ?? "", p.cost);
    const projects = fold([...projectCost].map(([p, value]) => ({ key: p, label: p || "(no project)", value })), total);
    const projectId = new Map<string, string>([...projects.kept.map(p => [p.key, "p:" + p.key] as const), ...projects.rest.map(p => [p.key, "p"] as const)]);
    columns.push({ key: "project", title: TITLE.project, nodes: [
      ...projects.kept.map(p => ({ id: "p:" + p.key, column: 0, label: p.label, value: p.value, color: color(p.key), ...(p.key ? { project: p.key } : {}) })),
      ...other("p", 0, projects.rest),
    ] });
    for (const p of pairs) flow(projectId.get(p.project ?? "")!, modelId.get(p.model)!, p.cost);
  }
  const mc = columns.length, kc = mc + 1;
  columns.push({ key: "model", title: TITLE.model, nodes: [
    ...models.kept.map(m => ({ id: "m:" + m.key, column: mc, label: m.label, value: m.value, color: modelColor.get("m:" + m.key) ?? color("") })),
    ...other("m", mc, models.rest),
  ] });

  // Kinds: each model's estimated cost per kind, and what is left of its cost, reported with no split by kind.
  const kindCost = new Map<string, number>();
  for (const m of d.cost_flow.models) {
    const id = modelId.get(m.model);
    if (!id) continue; // no cost in the view: no node, no band
    let est = 0;
    for (const k of KINDS) { const v = k.of(m); est += v; flow(id, k.id, v); if (v > 0) add(kindCost, k.id, v); }
    const reported = m.cost - est;
    if (reported > EPS) { flow(id, REPORTED, reported); add(kindCost, REPORTED, reported); }
  }
  columns.push({ key: "kind", title: TITLE.kind, nodes: [
    ...ranked(KINDS.map(k => ({ id: k.id, label: k.label, value: kindCost.get(k.id) ?? 0 })), k => k.label),
    ...(kindCost.has(REPORTED) ? [{ id: REPORTED, label: "Reported", value: kindCost.get(REPORTED)! }] : []),
  ].map(k => ({ ...k, column: kc, color: KIND_COLOR })) });

  return { empty: null, total, columns, bands: [...bands.values()] };
}

/** The box's geometry for a width, a text scale and a number of columns (decision 5). */
export interface FlowFit {
  width: number;
  /** The box's height, set before anything is drawn. */
  height: number;
  /** The text scale. */
  s: number;
  /** The plot's top (under the column titles) and height. */
  top: number;
  plot: number;
  bar: number;
  gap: number;
  /** Each column's bars' left edge. */
  xs: number[];
  /** Each column's label width: outside the first and last column's bars, right of the middle one's, over the bands. */
  room: number[];
}

const BAR = 8, GAP = 8;
/** One label line at 11px × s. */
const LINE = 14.3;

export function flowFit(width: number, s: number, columns: 2 | 3): FlowFit {
  const top = 18 * s, plot = Math.max(222, 172 * s + 40);
  const outer = Math.min(200 * s, Math.round(.28 * width)), last = width - outer - BAR;
  const xs = columns === 3 ? [outer, Math.round((width - BAR) / 2), last] : [outer, last];
  const side = Math.max(0, outer - 4 * s);
  const room = columns === 3 ? [side, Math.max(0, last - xs[1]! - BAR - 12 * s), side] : [side, side];
  return { width, height: Math.ceil(top + plot + 2), s, top, plot, bar: BAR, gap: GAP, xs, room };
}

/** A node's bar at its exact place, and `drawn`: the bar drawn, marked and read by the pointer, at least 2px tall. */
export interface PlacedNode extends FlowNode { x: number; y: number; width: number; height: number; drawn: { y: number; h: number } }
/** A band from the right edge of its source's bar (x0, y0) to the left edge of its target's (x1, y1), h thick at both ends;
 *  `drawn`: the band drawn, marked and read by the pointer, at least 1px thick. */
export interface PlacedBand extends FlowBand { x0: number; y0: number; x1: number; y1: number; h: number; drawn: { y0: number; y1: number; h: number } }
/** A node's label: one line (its name) or two (and its cost), in a box `lines × LINE × s` tall from y. */
export interface FlowLabel { node: string; x: number; y: number; align: "left" | "right"; width: number; lines: string[]; halo: boolean }
export interface FlowLayout {
  fit: FlowFit;
  /** px per dollar, one for every column, so a band is as thick at both ends. */
  k: number;
  columns: { key: FlowColumnKey; title: string; nodes: PlacedNode[] }[];
  /** In drawing order: largest first, so a thin band is never under a wide one. */
  bands: PlacedBand[];
  labels: FlowLabel[];
  /** The columns whose labels have no room (under 40px × s): an HTML key names their nodes. */
  keyed: number[];
}

/** The drawn size of a thin thing: at least `min`, centred on its exact place, so a cost above 0 is always seen. */
const grow = (y: number, h: number, min: number) => (h >= min ? { y, h } : { y: y + h / 2 - min / 2, h: min });

/** Every pixel of the flow: the nodes stacked by cost in each column, the bands stacked at each node in the order of the
 *  nodes they reach (out) or come from (in), and the labels that fit. null when the model has no flow. */
export function flowLayout(m: FlowGraph, fit: FlowFit): FlowLayout | null {
  if (m.empty) return null;
  const sum = (ns: { value: number }[]) => ns.reduce((a, n) => a + n.value, 0);
  const k = Math.min(...m.columns.map(c => (fit.plot - fit.gap * (c.nodes.length - 1)) / sum(c.nodes)));
  const at = new Map<string, PlacedNode>(), order = new Map<string, number>();
  const columns = m.columns.map((c, ci) => {
    let y = fit.top;
    return { key: c.key, title: c.title, nodes: c.nodes.map((n, i) => {
      const height = n.value * k, p: PlacedNode = { ...n, x: fit.xs[ci]!, y, width: fit.bar, height, drawn: grow(y, height, 2) };
      y += p.height + fit.gap;
      at.set(n.id, p); order.set(n.id, i);
      return p;
    }) };
  });
  // Stacking: out of a node in its targets' order, into a node in its sources' order.
  const out = new Map<string, number>(), into = new Map<string, number>();
  const rank = (b: FlowBand) => [order.get(b.from)!, order.get(b.to)!] as const;
  const placed = new Map<string, PlacedBand>();
  for (const b of [...m.bands].sort((a, c) => rank(a)[1] - rank(c)[1] || rank(a)[0] - rank(c)[0])) {
    const s = at.get(b.from)!, t = at.get(b.to)!, h = b.value * k;
    placed.set(b.id, { ...b, x0: s.x + s.width, x1: t.x, y0: 0, y1: t.y + (into.get(t.id) ?? 0), h, drawn: { y0: 0, y1: 0, h: 0 } });
    into.set(t.id, (into.get(t.id) ?? 0) + h);
  }
  for (const b of [...placed.values()].sort((a, c) => rank(a)[0] - rank(c)[0] || rank(a)[1] - rank(c)[1])) {
    b.y0 = at.get(b.from)!.y + (out.get(b.from) ?? 0);
    out.set(b.from, (out.get(b.from) ?? 0) + b.h);
    const y0 = grow(b.y0, b.h, 1), y1 = grow(b.y1, b.h, 1);
    b.drawn = { y0: y0.y, y1: y1.y, h: y0.h };
  }
  const bands = [...placed.values()].sort((a, c) => c.value - a.value || (a.id < c.id ? -1 : 1));

  // Labels, column by column in order of cost: one kept when its box overlaps no kept one, and inside the plot.
  const s = fit.s, line = LINE * s, last = columns.length - 1, labels: FlowLabel[] = [], keyed: number[] = [];
  columns.forEach((c, ci) => {
    const width = fit.room[ci]!;
    if (width < 40 * s) { keyed.push(ci); return; }
    const kept: { y0: number; y1: number }[] = [];
    for (const n of [...c.nodes].sort((a, b) => b.value - a.value)) {
      const lines = n.height >= 2 * line ? [n.label, usd(n.value)] : [n.label], h = lines.length * line;
      const y = Math.min(Math.max(n.y + n.height / 2 - h / 2, fit.top), fit.top + fit.plot - h);
      if (kept.some(o => y < o.y1 && y + h > o.y0)) continue;
      kept.push({ y0: y, y1: y + h });
      const left = ci > 0;
      labels.push({ node: n.id, x: left ? n.x + n.width + 4 * s : n.x - 4 * s, y, align: left ? "left" : "right", width, lines, halo: ci > 0 && ci < last });
    }
  });
  return { fit, k, columns, bands, labels, keyed };
}

/** A band's outline: two cubic curves between its ends, joined by its two edges. */
export const bandPath = ({ x0, y0, x1, y1, h }: Pick<PlacedBand, "x0" | "y0" | "x1" | "y1" | "h">): string => {
  const cx = (x0 + x1) / 2;
  return `M${x0} ${y0}C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}L${x1} ${y1 + h}C${cx} ${y1 + h} ${cx} ${y0 + h} ${x0} ${y0 + h}Z`;
};

/** The flow's ECharts option: the bands, then the nodes with their labels and the column titles over them. Silent and
 *  still: the flow reads the pointer and the keys itself (decision 6), and a growing band would read as a change in cost. */
export function flowOption(l: FlowLayout, env: OptionEnv): EChartsOption {
  const base = baseOption(env), font = { fontFamily: base.textStyle.fontFamily, fontSize: 11 * l.fit.s };
  const fill = new Map(l.columns.flatMap(c => c.nodes.map(n => [n.id, n.color])));
  const text = (style: { text: string; x: number; y: number; align: "left" | "right"; width: number; fill: string; stroke?: string; lineWidth?: number }) =>
    ({ type: "text" as const, emphasisDisabled: true, style: { ...font, overflow: "truncate" as const, ellipsis: "…", verticalAlign: "middle" as const, ...style } });
  const bands: CustomSeriesOption = {
    type: "custom", id: "bands", coordinateSystem: "none", silent: true, z: 1,
    data: l.bands.map((_, i) => [i]),
    renderItem: (_, api) => {
      const b = l.bands[api.value(0) as number]!;
      return {
        type: "path", emphasisDisabled: true,
        shape: { pathData: bandPath({ x0: b.x0, x1: b.x1, ...b.drawn }) },
        style: env.forced ? { fill: "none", stroke: env.ink.text, lineWidth: 1 } : { fill: env.color(fill.get(b.from)!), opacity: .4 },
      };
    },
  };
  const nodes: CustomSeriesOption = {
    type: "custom", id: "nodes", coordinateSystem: "none", silent: true, z: 2,
    data: [[0]],
    renderItem: () => ({
      type: "group",
      children: [
        ...l.columns.flatMap(c => c.nodes.map(n => ({ type: "rect" as const, emphasisDisabled: true,
          shape: { x: n.x, y: n.drawn.y, width: n.width, height: n.drawn.h }, style: { fill: env.forced ? env.ink.text : env.color(n.color) } }))),
        ...l.labels.flatMap(lb => lb.lines.map((t, i) => text({
          text: t, x: lb.x, y: lb.y + (i + .5) * LINE * l.fit.s, align: lb.align, width: lb.width,
          fill: i ? env.ink.muted : env.ink.text, ...(lb.halo ? { stroke: env.ink.surface, lineWidth: 3 } : {}),
        }))),
        ...l.columns.map((c, ci) => {
          const x = l.fit.xs[ci]!, first = ci === 0, end = ci === l.columns.length - 1;
          return text({
            text: c.title, x: first ? x + l.fit.bar : x, y: l.fit.top / 2, align: first ? "right" : "left",
            width: first ? x + l.fit.bar : end ? l.fit.width - x : l.fit.xs[ci + 1]! - x, fill: env.ink.muted,
          });
        }),
      ],
    }),
  };
  return { ...base, animation: false, series: [bands, nodes] };
}
