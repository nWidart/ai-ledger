import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { color, setOrder } from "../../../colors";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../../components/echart/echarts";
import type { OptionEnv } from "../../../components/echart/option";
import { bandPath, flowFit, flowLayout, flowModel, flowOption, type FlowInput, type FlowLayout, type FlowModel } from "./flowModel";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: true, ...over });

/** A model's kinds: input, output, cache read, cache write 5m, cache write 1h; null: none estimated (all reported). */
type Split = [number, number, number, number, number] | null;
/** A view of (project, model, cost) pairs. Each model's cost is all input unless `split` names its kinds. */
function view(pairs: [string | null, string, number][], split: Record<string, Split> = {}, project = ""): FlowInput {
  const cost = new Map<string, number>();
  for (const [, m, c] of pairs) cost.set(m, (cost.get(m) ?? 0) + c);
  const models = [...cost].map(([model, c]) => {
    const k = model in split ? split[model]! : [c, 0, 0, 0, 0];
    return { model, cost: c, cost_input: k?.[0] ?? null, cost_output: k?.[1] ?? null, cost_cache_read: k?.[2] ?? null, cost_cache_5m: k?.[3] ?? null, cost_cache_1h: k?.[4] ?? null };
  });
  const sum = (f: (m: (typeof models)[number]) => number | null) => models.reduce((s, m) => s + (f(m) ?? 0), 0);
  return { project, unpriced: [],
    totals: { requests: pairs.length, cost: sum(m => m.cost), cost_input: sum(m => m.cost_input), cost_output: sum(m => m.cost_output),
      cost_cache_read: sum(m => m.cost_cache_read), cost_cache_5m: sum(m => m.cost_cache_5m), cost_cache_1h: sum(m => m.cost_cache_1h) },
    cost_flow: { pairs: pairs.map(([p, model, c]) => ({ project: p, model, cost: c })), models } };
}
const labels = (m: FlowModel, c: number) => m.columns[c]!.nodes.map(n => n.label);
const ids = (m: FlowModel, c: number) => m.columns[c]!.nodes.map(n => n.id);

// Eight projects over five models, one session with no project, and a Grok model whose cost was reported.
const rich = view([
  ["atlas", "claude-opus-4-5", 40], ["atlas", "claude-sonnet-4-5", 20], ["atlas", "gpt-5.1-codex", 4],
  ["beacon", "claude-opus-4-5", 30], ["beacon", "grok-4", 6], [null, "claude-sonnet-4-5", 12],
  ["comet", "gpt-5.1-codex", 10], ["delta", "claude-haiku-4-5", 0.5], ["echo", "claude-sonnet-4-5", 3],
  ["foxtrot", "claude-opus-4-5", 2], ["golf", "m-tiny", 0.3], ["golf", "claude-haiku-4-5", 0.2],
], { "claude-opus-4-5": [20, 40, 8, 3, 1], "claude-sonnet-4-5": [10, 15, 6, 4, 0], "grok-4": null, "gpt-5.1-codex": [5, 5, 4, 0, 0] });

afterEach(() => setOrder([]));

describe("flowModel", () => {
  // Decision 4, on the project column; the model column folds by the same rule.
  it.each([
    { rule: "a long tail: the five costliest, then Other", costs: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 3],
      want: ["P01", "P02", "P03", "P04", "P05", "Other (7)"] },
    { rule: "one name that would fold keeps its node", costs: [60, 30, 5, 3, 1, 0.5], want: ["P01", "P02", "P03", "P04", "P05", "P06"] },
    { rule: "a name under 1% among the first five folds", costs: [90, 8, 0.5, 0.4], want: ["P01", "P02", "Other (2)"] },
    { rule: "a name at $0.00 is no node and not counted", costs: [90, 8, 0.5, 0], want: ["P01", "P02", "P03"] },
    { rule: "ties A to Z", costs: [5, 5, 5], want: ["P01", "P02", "P03"] },
  ])("folds: $rule", ({ costs, want }) => {
    const pairs = costs.map((c, i): [string, string, number] => [`P${String(i + 1).padStart(2, "0")}`, "m1", c]);
    const m = flowModel(view([...pairs].reverse()));
    expect(labels(m, 0)).toEqual(want);
    // Other holds every folded name and loses no cent of them, the costliest first.
    const other = m.columns[0]!.nodes.find(n => n.id === "p"), rest = costs.slice(want.filter(w => !w.startsWith("Other")).length);
    expect(other?.members?.map(x => x.value) ?? []).toEqual(rest.filter(c => c > 0));
    expect(other?.value ?? 0).toBeCloseTo(rest.reduce((a, b) => a + b, 0), 9);
  });

  it("names the kinds as the drawer bills them, and Reported last", () => {
    const m = flowModel(view([["a", "est", 3.5], ["a", "grok", 9], ["a", "mixed", 0.1 + 0.2]],
      { est: [1, 2, 0, 0.3, 0.2], grok: null, mixed: [0.1, 0.2, 0, 0, 0] }));
    // Output + thinking is one node, both cache write lifetimes are one, Cache read at 0 is none, and the float leftover of
    // "mixed" (0.30000000000000004 − 0.3) is not reported cost; Reported comes last though it is the largest.
    expect(m.columns[2]!.nodes.map(n => [n.label, n.value])).toEqual([["Output + thinking", 2.2], ["Input", 1.1], ["Cache write", 0.5], ["Reported", 9]]);
    expect(ids(m, 2)).toEqual(["k:output", "k:input", "k:write", "k:reported"]);
    expect(m.bands.filter(b => b.to === "k:reported").map(b => b.from)).toEqual(["m:grok"]);
  });

  it("adds every column up to the priced cost, and every node's bands in up to its bands out", () => {
    const m = flowModel(rich), total = rich.cost_flow.pairs.reduce((s, p) => s + p.cost, 0);
    expect(m.total).toBeCloseTo(total, 9);
    expect(m.total).toBeCloseTo(rich.totals.cost!, 9);
    for (const c of m.columns) expect(c.nodes.reduce((s, n) => s + n.value, 0)).toBeCloseTo(total, 9);
    const flow = (side: "from" | "to", id: string) => m.bands.filter(b => b[side] === id).reduce((s, b) => s + b.value, 0);
    for (const n of [...m.columns[0]!.nodes, ...m.columns[1]!.nodes]) expect(flow("from", n.id)).toBeCloseTo(n.value, 9);
    for (const n of [...m.columns[1]!.nodes, ...m.columns[2]!.nodes]) expect(flow("to", n.id)).toBeCloseTo(n.value, 9);
    // The fold on both columns: Other's members are every folded name, with every cent.
    expect(labels(m, 0)).toEqual(["atlas", "beacon", "(no project)", "comet", "echo", "Other (3)"]);
    expect(m.columns[0]!.nodes.at(-1)!.members).toEqual([{ label: "foxtrot", value: 2 }, { label: "delta", value: 0.5 }, { label: "golf", value: 0.5 }]);
    expect(labels(m, 1)).toEqual(["opus-4-5", "sonnet-4-5", "gpt-5.1-codex", "grok-4", "Other (2)"]);
    expect(m.columns[1]!.nodes.at(-1)!.members).toEqual([{ label: "haiku-4-5", value: 0.7 }, { label: "m-tiny", value: 0.3 }]);
    // A session with no project is a node that opens no sheet; a named project opens its own.
    expect(m.columns[0]!.nodes.map(n => [n.id, n.project])).toEqual([["p:atlas", "atlas"], ["p:beacon", "beacon"], ["p:", undefined], ["p:comet", "comet"], ["p:echo", "echo"], ["p", undefined]]);
    expect(m.bands.find(b => b.id === "p|m")!.value).toBeCloseTo(1, 9); // delta's and golf's haiku, golf's m-tiny
  });

  it("drops the project column for one project", () => {
    const m = flowModel(view([["atlas", "opus", 3], ["atlas", "sonnet", 1]], {}, "atlas"));
    expect(m.columns.map(c => c.title)).toEqual(["Model", "Token kind"]);
    expect(m.bands.map(b => b.id).sort()).toEqual(["m:opus|k:input", "m:sonnet|k:input"]);
  });

  // Decision 11: the sentence in place of the graph, and no layout.
  it.each([
    { rule: "no request", d: { ...view([]), totals: { ...view([]).totals, requests: 0, cost: null } }, want: "No usage in this view, so no cost to follow." },
    { rule: "only unpriced requests", d: { ...view([]), totals: { ...view([]).totals, requests: 4, cost: null } }, want: "No request in this view is priced, so there is no cost to follow." },
    { rule: "priced at zero", d: view([["a", "free", 0]], { free: [0, 0, 0, 0, 0] }), want: "The priced requests in this view cost $0.00, so there is no cost to follow." },
  ])("says why there is no flow: $rule", ({ d, want }) => {
    const m = flowModel(d);
    expect(m.empty).toBe(want);
    expect(flowLayout(m, flowFit(800, 1, 3))).toBeNull();
  });
});

describe("flowFit", () => {
  // Decision 5's table: outer label room, the band gap right of the middle bars and the middle label room.
  it.each([
    [1174, 1, 200, 375, 363], [800, 1, 200, 188, 176], [343, 1, 96, 63, 51], [343, 2, 96, 63, 39], [1174, 2, 329, 246, 222],
  ])("fits %ipx at text scale %d", (width, s, outer, gap, middle) => {
    const f = flowFit(width, s, 3);
    expect([f.xs[0], width - f.xs[2]! - f.bar, f.xs[2]! - f.xs[1]! - f.bar, f.room[1]]).toEqual([outer, outer, gap, middle]);
    expect(f.room[0]).toBe(outer - 4 * s);
  });

  it.each([[1, 242], [1.25, 280], [2, 422]])("sets the box's height at text scale %d", (s, height) => {
    expect(flowFit(800, s, 3).height).toBe(height);
  });

  it("puts two columns at the outer edges", () => {
    expect(flowFit(800, 1, 2).xs).toEqual([200, 592]);
  });
});

describe("flowLayout", () => {
  const fit = flowFit(800, 1, 3);
  const layout = (d = rich, f = fit) => flowLayout(flowModel(d), f)!;

  it("uses one scale for every column, the tallest stack filling the plot", () => {
    const l = layout(), stack = (c: FlowLayout["columns"][number]) => c.nodes.reduce((s, n) => s + n.height, 0);
    for (const c of l.columns) {
      expect(stack(c)).toBeCloseTo(l.columns[0]!.nodes.reduce((s, n) => s + n.height, 0), 9);
      for (const n of c.nodes) expect(n.height).toBeCloseTo(n.value * l.k, 9);
      c.nodes.slice(1).forEach((n, i) => expect(n.y).toBeCloseTo(c.nodes[i]!.y + c.nodes[i]!.height + fit.gap, 9));
      expect(c.nodes[0]!.y).toBe(fit.top);
    }
    expect(Math.max(...l.columns.map(c => stack(c) + fit.gap * (c.nodes.length - 1)))).toBeCloseTo(fit.plot, 9);
    for (const b of l.bands) expect(b.h).toBeCloseTo(b.value * l.k, 9);
  });

  it("stacks the bands at a node to its exact height, in the order of the nodes they reach or come from", () => {
    const l = layout(), nodes = l.columns.flatMap(c => c.nodes), pos = new Map(l.columns.flatMap(c => c.nodes.map((n, i) => [n.id, i])));
    for (const n of nodes) for (const [side, end, other] of [["from", "y0", "to"], ["to", "y1", "from"]] as const) {
      const bs = l.bands.filter(b => b[side] === n.id).sort((a, b) => a[end] - b[end]);
      if (!bs.length) continue;
      expect(bs.map(b => pos.get(b[other]))).toEqual(bs.map(b => pos.get(b[other])).sort((a, b) => a! - b!));
      let y = n.y;
      for (const b of bs) { expect(b[end]).toBeCloseTo(y, 9); y += b.h; }
      expect(y).toBeCloseTo(n.y + n.height, 9);
      for (const b of bs) expect(side === "from" ? b.x0 : b.x1).toBe(side === "from" ? n.x + n.width : n.x);
    }
    // Drawn largest first, so a thin band is never under a wide one.
    expect(l.bands.map(b => b.value)).toEqual(l.bands.map(b => b.value).sort((a, b) => b - a));
  });

  it("labels a column only with room for six characters, and lists the others for the key", () => {
    const phone = (s: number) => layout(rich, flowFit(343, s, 3));
    expect(phone(1).keyed).toEqual([]);
    expect(new Set(phone(1).labels.map(lb => lb.node.slice(0, 1)))).toEqual(new Set(["p", "m", "k"]));
    expect(phone(2).keyed).toEqual([1]);
    expect(phone(2).labels.filter(lb => lb.node.startsWith("m"))).toEqual([]);
  });

  it("places labels outside the outer bars and haloed right of the middle ones, the cost under a name with room", () => {
    const l = layout(), at = (id: string) => l.labels.find(lb => lb.node === id)!;
    expect(at("p:atlas")).toMatchObject({ x: 196, align: "right", width: 196, lines: ["atlas", "$64"], halo: false });
    expect(at("m:claude-opus-4-5")).toMatchObject({ x: 408, align: "left", width: 176, lines: ["opus-4-5", "$72"], halo: true });
    expect(at("k:output")).toMatchObject({ x: 604, align: "left", width: 196, halo: false });
  });

  it("leaves out a label that would overlap a costlier one", () => {
    // B and C are 3px nodes 8px apart: C's line would cross B's.
    const l = layout(view([["A", "m", 960], ["B", "m", 15], ["C", "m", 14], ["D", "m", 11]]));
    expect(l.labels.filter(lb => lb.node.startsWith("p:")).map(lb => lb.node)).toEqual(["p:A", "p:B", "p:D"]);
    const boxes = l.labels.filter(lb => lb.node.startsWith("p:")).map(lb => [lb.y, lb.y + lb.lines.length * 14.3]);
    boxes.forEach(([y0, y1], i) => boxes.slice(i + 1).forEach(([z0, z1]) => expect(y0! < z1! && y1! > z0!).toBe(false)));
  });
});

it("draws a band as two cubic curves between its ends", () => {
  expect(bandPath({ x0: 100, y0: 20, x1: 220, y1: 60, h: 30 })).toBe("M100 20C160 20 160 60 220 60L220 90C160 90 160 50 100 50Z");
});

describe("flowOption", () => {
  interface Shape { type: string; shape: { x?: number; y?: number; width?: number; height?: number; pathData?: string }; style: Record<string, unknown> }
  const run = (s: CustomSeriesOption, i: number) => s.renderItem!({ dataIndex: i } as CustomSeriesRenderItemParams,
    { value: (dim: number) => (s.data as number[][])[i]![dim]! } as unknown as CustomSeriesRenderItemAPI) as unknown;
  const draw = (l: FlowLayout, e = env()) => {
    const [bands, nodes] = flowOption(l, e).series as CustomSeriesOption[];
    return { bands: l.bands.map((_, i) => run(bands!, i) as Shape), nodes: (run(nodes!, 0) as { children: Shape[] }).children };
  };
  // A 1000:1 view: B's node is 0.2px and its band too.
  const thin = flowLayout(flowModel(view([["A", "m", 1000], ["B", "m", 1]])), flowFit(800, 1, 3))!;

  it("draws on no coordinate system, silent and still", () => {
    const o = flowOption(thin, env());
    expect(o).not.toHaveProperty("grid");
    expect(o).not.toHaveProperty("xAxis");
    expect(o).not.toHaveProperty("yAxis");
    expect(o).not.toHaveProperty("dataZoom");
    expect(o.animation).toBe(false);
    for (const s of o.series as CustomSeriesOption[]) expect(s).toMatchObject({ type: "custom", coordinateSystem: "none", silent: true });
  });

  it("draws a band in its source's color at 0.4 and a node as a rect, a thin one grown about its exact place", () => {
    const { bands, nodes } = draw(thin), b = thin.bands.at(-1)!, n = thin.columns[0]!.nodes[1]!;
    expect(b.h).toBeLessThan(1);
    expect(bands.at(-1)).toMatchObject({ type: "path", style: { fill: "var(--proj-other)", opacity: .4 },
      shape: { pathData: bandPath({ ...b, y0: b.y0 + b.h / 2 - .5, y1: b.y1 + b.h / 2 - .5, h: 1 }) } });
    expect(n.height).toBeLessThan(2);
    expect(nodes.find(c => c.type === "rect" && c.shape.y === n.y + n.height / 2 - 1)).toMatchObject({ shape: { x: n.x, width: 8, height: 2 }, style: { fill: "var(--proj-other)" } });
    expect(nodes.filter(c => c.type === "rect")).toHaveLength(thin.columns.flatMap(c => c.nodes).length);
    // The stacking stays exact: B's node starts a gap under A's.
    expect(n.y).toBe(thin.columns[0]!.nodes[0]!.y + thin.columns[0]!.nodes[0]!.height + 8);
  });

  it("draws the labels with an ellipsis in their room, and the titles", () => {
    const l = flowLayout(flowModel(rich), flowFit(800, 1, 3))!, texts = draw(l).nodes.filter(c => c.type === "text").map(c => c.style);
    expect(texts.find(t => t.text === "opus-4-5")).toMatchObject({ x: 408, align: "left", width: 176, overflow: "truncate", ellipsis: "…", fill: "ink-text", stroke: "ink-surface", lineWidth: 3, fontSize: 11 });
    expect(texts.find(t => t.text === "$72")).toMatchObject({ fill: "ink-muted" });
    expect(texts.filter(t => ["Project", "Model", "Token kind"].includes(t.text as string)).map(t => t.fill)).toEqual(["ink-muted", "ink-muted", "ink-muted"]);
    expect(flowOption(l, env({ textScale: 2 }))).toMatchObject({ textStyle: { fontSize: 22 } });
  });

  it("outlines the bands and fills the nodes in the text ink under forced colors", () => {
    const { bands, nodes } = draw(thin, env({ forced: true }));
    for (const b of bands) expect(b.style).toEqual({ fill: "none", stroke: "ink-text", lineWidth: 1 });
    for (const n of nodes.filter(c => c.type === "rect")) expect(n.style).toEqual({ fill: "ink-text" });
  });
});

// The colors handed to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that is not a
// color resolves to the inherited text color, with no error. As in costDaily.test.ts.
it("hands env.color only declared color tokens", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Map<string, string>();
  for (const block of strip(readFileSync("src/theme.css", "utf8")).matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);
  setOrder(["atlas", "beacon"]);
  const seen = new Set<string>();
  const l = flowLayout(flowModel(rich), flowFit(800, 1, 3))!;
  const [bands, nodes] = flowOption(l, env({ color: s => { seen.add(s); return s; } })).series as CustomSeriesOption[];
  l.bands.forEach((_, i) => bands!.renderItem!({} as CustomSeriesRenderItemParams, { value: () => i } as unknown as CustomSeriesRenderItemAPI));
  nodes!.renderItem!({} as CustomSeriesRenderItemParams, {} as CustomSeriesRenderItemAPI);
  // Project hues, model series colors, Other's grey and the kinds' neutral.
  expect([...seen].sort()).toEqual([color("atlas"), color("beacon"), "var(--proj-other)","var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--text-secondary)"].sort());
  for (const css of seen) {
    const m = /^var\((--[\w-]+)\)$/.exec(css)!;
    expect(declared.get(m[1]!), `${m[1]} is not a declared hex or rgb() color`).toMatch(COLOR);
  }
});
