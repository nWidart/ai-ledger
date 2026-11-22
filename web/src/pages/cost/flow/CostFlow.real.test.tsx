import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setOrder } from "../../../colors";
import { renderApp } from "../../../testing";
import { CostFlow, type CostFlowProps } from "./CostFlow";
import { flowFit, flowLayout, flowModel, type FlowLayout } from "./flowModel";

// The flow's one test on real ECharts (design decision 13): every other test draws on the fake runtime from test-setup,
// which draws nothing. It checks that real ECharts draws the custom series: a path per band from the layout's ends in its
// source's color, a path per node in its own, the labels as text, a redraw with no path of the old figures left, the
// outlines of forced colors, and an unmount that takes the drawing with it.
vi.unmock("../../../components/echart/load");

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills and strokes can be told apart by.
const rgb = new Map<string, string>();
const resolved = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};
/** The token a drawn color resolved from: the renderer writes rgb() with or without spaces. */
const tokenOf = (c: string | null) => (c ? [...rgb].find(([, v]) => v === c || v.replaceAll(" ", "") === c)?.[0] : undefined);

const LONG = "atlas-api-gateway-service";
type Pair = [string, string, number];
/** A view of three projects on its models, each model's cost split half input, half output. */
function view(pairs: Pair[]): CostFlowProps["d"] {
  const cost = new Map<string, number>();
  for (const [, m, c] of pairs) cost.set(m, (cost.get(m) ?? 0) + c);
  const models = [...cost].map(([model, c]) => ({ model, cost: c, cost_input: c / 2, cost_output: c / 2, cost_cache_read: 0, cost_cache_5m: 0, cost_cache_1h: 0 }));
  const all = models.reduce((s, m) => s + m.cost, 0);
  return { project: "", range: 30, start: "2026-10-23", source: "", automated: true, unpriced: [],
    totals: { requests: pairs.length, cost: all, cost_input: all / 2, cost_output: all / 2, cost_cache_read: 0, cost_cache_5m: 0, cost_cache_1h: 0 },
    cost_flow: { pairs: pairs.map(([project, model, c]) => ({ project, model, cost: c })), models } };
}
const PAIRS: Pair[] = [[LONG, "claude-opus-4-5", 60], [LONG, "claude-sonnet-4-5", 20], ["beacon", "claude-sonnet-4-5", 30], ["comet", "claude-opus-4-5", 20]];
const d = view(PAIRS);
const newer = view([...PAIRS, ["comet", "gpt-5.1-codex", 25]]);
const WIDTH = 343;
const laid = (v: CostFlowProps["d"]) => flowLayout(flowModel(v), flowFit(WIDTH, 1, 3))!;

const plot = () => document.querySelector<HTMLElement>("#flow .echart-plot")!;
const paths = () => [...plot().querySelectorAll("svg path")];
/** The bands and the nodes, as drawn: a band is two curves, a node a rect, which the renderer writes as lines. */
const drawn = () => {
  const bands = paths().filter(p => p.getAttribute("d")!.includes("C"));
  return { bands, nodes: paths().filter(p => !bands.includes(p)) };
};
/** Waits for a drawing of the layout's bands and nodes: ECharts paints on an animation frame, and a cold load of it under
 *  load can take seconds; the test's own timeout leaves room for two such waits. */
const drawnAs = (l: FlowLayout) => waitFor(() => {
  const { bands, nodes } = drawn();
  expect([bands.length, nodes.length]).toEqual([l.bands.length, l.columns.reduce((n, c) => n + c.nodes.length, 0)]);
}, { timeout: 5000 });
const COLD = 15000;
/** A path's points, as numbers in pairs. */
const points = (p: Element) => {
  const n = (p.getAttribute("d")!.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
  return n.flatMap((_, i) => (i % 2 ? [] : [[n[i]!, n[i + 1]!] as const]));
};

/** What the test logged as an error or a warning: nothing, on a drawing ECharts accepts. */
let logged: () => unknown[][] = () => [];
beforeEach(() => {
  setOrder([LONG, "beacon", "comet"]);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
  const spies = (["error", "warn"] as const).map(level => vi.spyOn(console, level).mockImplementation(() => {}));
  logged = () => spies.flatMap(s => s.mock.calls);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: resolved(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
});
afterEach(() => setOrder([]));

it("draws the bands from the layout's ends in their sources' colors, the nodes and labels, redraws newer figures with no path left, and unmount removes the svg", async () => {
  const { rerender, unmount } = renderApp(<CostFlow d={d} onProject={() => {}} />);
  const l = laid(d);
  await drawnAs(l);
  const { bands, nodes } = drawn();

  // The widest band, drawn first: from the source bar's right edge at its stacked y to the target bar's left edge.
  const top = l.bands[0]!, at = points(bands[0]!);
  const near = (p: readonly [number, number], x: number, y: number) => expect([p[0], p[1]].map(v => Math.round(v * 100) / 100)).toEqual([x, y].map(v => Math.round(v * 100) / 100));
  near(at[0]!, top.x0, top.y0);
  near(at[3]!, top.x1, top.y1);
  near(at.at(-1)!, top.x0, top.y0 + top.h);
  // Each band in its source's color, each node in its own.
  const source = new Map(l.columns.flatMap(c => c.nodes.map(n => [n.id, n.color])));
  expect(bands.map(p => [tokenOf(p.getAttribute("fill")), p.getAttribute("fill-opacity")])).toEqual(l.bands.map(b => [source.get(b.from), "0.4"]));
  expect(nodes.map(p => tokenOf(p.getAttribute("fill")))).toEqual(l.columns.flatMap(c => c.nodes.map(n => n.color)));
  // The first and the last node at their place.
  const first = l.columns[0]!.nodes[0]!, last = l.columns.at(-1)!.nodes.at(-1)!;
  near(points(nodes[0]!)[0]!, first.x, first.y);
  near(points(nodes.at(-1)!)[0]!, last.x, last.y);

  // The labels, as text: the long name cut by zrender.
  const texts = [...plot().querySelectorAll("svg text")].map(t => t.textContent ?? "");
  expect(texts).toEqual(expect.arrayContaining(["Project", "Model", "Token kind", "beacon", "opus-4-5", "Input"]));
  expect(texts.find(t => t.startsWith("atlas-"))).toMatch(/^atlas-[^…]+…$/);

  // Newer figures with one more model: its node and bands, and nothing of the old drawing.
  rerender(<CostFlow d={newer} onProject={() => {}} />);
  const next = laid(newer);
  await drawnAs(next);
  expect(drawn().nodes.map(p => tokenOf(p.getAttribute("fill")))).toEqual(next.columns.flatMap(c => c.nodes.map(n => n.color)));
  const drawing = plot();
  expect(drawing.querySelector("svg")).not.toBeNull();
  unmount();
  expect(drawing.querySelector("svg")).toBeNull();
  expect(logged()).toEqual([]);
}, COLD);

it("draws every band unfilled in the system text color and every node filled in it, under forced colors", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(forced-colors: active)", media: q, addEventListener() {}, removeEventListener() {} }));
  const { unmount } = renderApp(<CostFlow d={d} onProject={() => {}} />);
  try {
    await drawnAs(laid(d));
    const { bands, nodes } = drawn();
    expect(new Set(bands.map(p => [p.getAttribute("fill"), tokenOf(p.getAttribute("stroke"))].join()))).toEqual(new Set(["none,CanvasText"]));
    expect(new Set(nodes.map(p => tokenOf(p.getAttribute("fill"))))).toEqual(new Set(["CanvasText"]));
    expect(logged()).toEqual([]);
  } finally {
    unmount();
    vi.unstubAllGlobals();
  }
}, COLD);
