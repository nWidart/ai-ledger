import { waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderApp } from "../../../testing";
import { CostFlow, type CostFlowProps } from "./CostFlow";
import { flowFit, flowLayout, flowModel, type FlowLayout } from "./flowModel";

// The flow's one test on real ECharts (design decision 13): every other test draws on the fake runtime from test-setup,
// which draws nothing. It checks that real ECharts accepts and draws the custom series: a path per band and per node at
// the layout's pixels, the labels as text, a redraw with no path of the old figures left, and a forced-colors drawing.
// What each path's style is, is flowOption's, tested in flowModel.test.ts.
vi.unmock("../../../components/echart/load");

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
/** Waits for a drawing of the layout's bands and nodes, and no other path: ECharts paints on an animation frame, and a
 *  cold load of it under load can take seconds; the test's own timeout leaves room for two such waits. */
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
const near = (p: readonly [number, number], x: number, y: number) =>
  expect([p[0], p[1]].map(v => Math.round(v * 100) / 100)).toEqual([x, y].map(v => Math.round(v * 100) / 100));

/** What the test logged as an error or a warning: nothing, on a drawing ECharts accepts. */
let logged: () => unknown[][] = () => [];
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
  const spies = (["error", "warn"] as const).map(level => vi.spyOn(console, level).mockImplementation(() => {}));
  logged = () => spies.flatMap(s => s.mock.calls);
});

it("draws the bands and nodes at the layout's pixels and the labels as text, and redraws newer figures with no path left", async () => {
  const { rerender } = renderApp(<CostFlow d={d} onProject={() => {}} />);
  const l = laid(d);
  await drawnAs(l);
  const { bands, nodes } = drawn();

  // The widest band, drawn first: from the source bar's right edge at its stacked y to the target bar's left edge.
  const top = l.bands[0]!, at = points(bands[0]!);
  near(at[0]!, top.x0, top.y0);
  near(at[3]!, top.x1, top.y1);
  near(at.at(-1)!, top.x0, top.y0 + top.h);
  const first = l.columns[0]!.nodes[0]!;
  near(points(nodes[0]!)[0]!, first.x, first.y);

  // The labels, as text: the long name cut by zrender.
  const texts = [...plot().querySelectorAll("svg text")].map(t => t.textContent ?? "");
  expect(texts).toEqual(expect.arrayContaining(["Project", "Model", "Token kind", "beacon", "opus-4-5", "Input"]));
  expect(texts.find(t => t.startsWith("atlas-"))).toMatch(/^atlas-[^…]+…$/);

  // Newer figures with one more model: its node and bands, and nothing of the old drawing.
  rerender(<CostFlow d={newer} onProject={() => {}} />);
  await drawnAs(laid(newer));
  expect(logged()).toEqual([]);
}, COLD);

it("draws under forced colors", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(forced-colors: active)", media: q, addEventListener() {}, removeEventListener() {} }));
  try {
    renderApp(<CostFlow d={d} onProject={() => {}} />);
    await drawnAs(laid(d));
    expect(drawn().bands[0]!.getAttribute("fill")).toBe("none");
    expect(logged()).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
}, COLD);
