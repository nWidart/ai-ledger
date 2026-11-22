import { describe, expect, it } from "vitest";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../../components/echart/echarts";
import { FORCED_INK, type ChartEnv } from "../../../components/echart/tokens";
import { quadrantFit, quadrantModel, type QuadRow } from "./quadrant";
import { quadrantOption } from "./quadrantOption";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: true, width: 343, height: 264, ...over });
const forced = env({ forced: true, ink: { ...FORCED_INK } });
const HUE = "var(--proj-3)";

let n = 0;
const row = (cost: number | null, calls: number, commits = 0): QuadRow =>
  ({ session_id: `s${++n}`, title: null, first_ts: "2026-11-03T14:20:00Z", cost, unpriced: 0, tool_calls: calls, commits });
const fitOf = (rows: QuadRow[], s = 1) => quadrantFit(quadrantModel(rows, rows.length), 343, s);
// A session at $0 and one at 0 tool calls: a lane on each axis.
const lanes = fitOf([row(0, 12, 1), row(0.04, 0), row(0.9, 30, 2), row(1.42, 23), row(4.2, 1200)]);
const plain = fitOf([row(0.04, 2), row(1.42, 23, 1), row(19.5, 140)]);

type Axis = { type: string; min: number; max: number; name: string; nameRotate?: number; nameGap: number; axisLabel: { color: string; hideOverlap: boolean; formatter: (v: number) => string };
  nameTextStyle: { color: string }; splitLine: { lineStyle: { color: string } } };
const axes = (o: ReturnType<typeof quadrantOption>) => [o.xAxis, o.yAxis] as Axis[];
const series = (o: ReturnType<typeof quadrantOption>) => o.series as CustomSeriesOption[];

// A stubbed renderItem API: x across at 100px a unit, y up from 1000.
const PLOT = { x: 58, y: 10, width: 271, height: 210 };
const coord = ([x, y]: number[]) => [x! * 100, 1000 - y!];
type Shape = { type: string; shape?: Record<string, number>; style: Record<string, unknown>; children?: Shape[] };
function draw(s: CustomSeriesOption, i: number): Shape | null {
  const data = s.data as number[][];
  const api = { value: (dim: number) => data[i]![dim]!, coord } as unknown as CustomSeriesRenderItemAPI;
  const params = { dataIndex: i, dataIndexInside: i, coordSys: PLOT } as unknown as CustomSeriesRenderItemParams;
  return s.renderItem!(params, api) as unknown as Shape | null;
}

describe("quadrantOption", () => {
  it("draws two log axes over the fit's extents on a grid at the fit's plot, never animated, both series silent", () => {
    const o = quadrantOption(lanes, env(), HUE), [x, y] = axes(o);
    expect(o.grid).toEqual({ left: lanes.plot.x, top: lanes.plot.y, width: lanes.plot.w, height: lanes.plot.h, outerBoundsMode: "none" });
    expect([x, y].map(a => [a!.type, a!.min, a!.max])).toEqual([["log", lanes.x.min, lanes.x.max], ["log", lanes.y.min, lanes.y.max]]);
    expect([x!.name, y!.name, y!.nameRotate]).toEqual(["Estimated cost (log scale)", "Tool calls (log scale)", 90]);
    // The tool-call name sits past the widest label, where the fit's left margin leaves it room.
    const wide = fitOf([row(0.4, 3), row(9, 120000)], 2);
    expect(axes(quadrantOption(wide, env({ textScale: 2 }), HUE)).map(a => a.nameGap)).toEqual([52, wide.nameGap]);
    expect(wide.nameGap).toBeGreaterThan(84);
    // Moved left inside the box: zrender moves a centred text by half its right padding.
    const nameStyle = (f: typeof wide, e: ChartEnv) => (quadrantOption(f, e, HUE).xAxis as { nameTextStyle: { padding?: number[] } }).nameTextStyle.padding;
    expect([wide.costNameShift > 0, nameStyle(wide, env({ textScale: 2 })), nameStyle(lanes, env())]).toEqual([true, [0, 2 * wide.costNameShift, 0, 0], undefined]);
    expect([x!.axisLabel.hideOverlap, y!.axisLabel.hideOverlap]).toEqual([true, true]);
    expect(o.animation).toBe(false); // even with motion on
    expect(series(o).map(s => [s.id, s.silent])).toEqual([["guides", true], ["dots", true]]);
  });

  it("labels the ticks in dollars and counts, and a lane's min as zero", () => {
    const [x, y] = axes(quadrantOption(lanes, env(), HUE)), [px, py] = axes(quadrantOption(plain, env(), HUE));
    // ECharts gives a log axis's ends back through pow(), a few ulps off.
    expect([x!.axisLabel.formatter(lanes.x.min * (1 + 1e-15)), y!.axisLabel.formatter(lanes.y.min)]).toEqual(["$0", "0"]);
    expect([0.01, 0.1, 1, 10, 20].map(x!.axisLabel.formatter)).toEqual(["$0.01", "$0.1", "$1", "$10", "$20"]);
    expect([1, 10, 1000, 2000].map(y!.axisLabel.formatter)).toEqual(["1", "10", "1,000", "2,000"]);
    // No lane: the min is a tick like the others.
    expect([px!.axisLabel.formatter(plain.x.min), py!.axisLabel.formatter(plain.y.min)]).toEqual(["$0.02", "2"]);
  });

  it("draws a filled dot in the hue in a surface ring and a hollow one in a ring of the hue, at its values", () => {
    const dots = series(quadrantOption(lanes, env(), HUE))[1]!;
    expect(dots.data).toEqual(lanes.dots.map(d => [d.x, d.y, d.filled ? 1 : 0]));
    const filled = lanes.dots.findIndex(d => d.filled), hollow = lanes.dots.findIndex(d => !d.filled);
    expect(draw(dots, filled)).toMatchObject({ type: "circle", shape: { cx: lanes.dots[filled]!.x * 100, cy: 1000 - lanes.dots[filled]!.y, r: 4 },
      style: { fill: HUE, fillOpacity: .7, stroke: "ink-surface", lineWidth: 1 } });
    expect(draw(dots, hollow)).toMatchObject({ type: "circle", style: { fill: "ink-surface", stroke: HUE, lineWidth: 1.5 } });
  });

  it("draws the medians' dashed guides across the plot, and the corner names that fit with their halo", () => {
    const guides = series(quadrantOption(lanes, env(), HUE))[0]!, [cx, cy] = coord([lanes.guides!.x, lanes.guides!.y]);
    const [v, h, ...names] = draw(guides, 0)!.children!;
    expect([v!.shape, h!.shape]).toEqual([{ x1: cx, y1: 10, x2: cx, y2: 220 }, { x1: 58, y1: cy, x2: 329, y2: cy }]);
    expect(v!.style).toEqual({ stroke: "ink-muted", lineWidth: 1, lineDash: [5, 4] });
    expect(names.length).toBeGreaterThan(0);
    expect(names.map(t => t.style.text)).toEqual(lanes.names.map(n => n.label));
    expect(names[0]!.style).toMatchObject({ x: lanes.names[0]!.px, y: lanes.names[0]!.py, align: lanes.names[0]!.align, verticalAlign: lanes.names[0]!.verticalAlign,
      fontSize: 11, fontWeight: 600, fill: "ink-secondary", stroke: "ink-surface", lineWidth: 3 });
  });

  it("draws no guide and no name under three dots", () => {
    const two = fitOf([row(0.5, 3), row(3, 8, 1)]);
    expect(series(quadrantOption(two, env(), HUE))[0]!.data).toEqual([]);
    expect(series(quadrantOption(two, env(), HUE))[1]!.data).toHaveLength(2);
  });

  it("takes the system colors under forced colors", () => {
    const o = quadrantOption(lanes, forced, HUE), [guides, dots] = series(o);
    const filled = lanes.dots.findIndex(d => d.filled), hollow = lanes.dots.findIndex(d => !d.filled);
    expect(draw(dots!, filled)!.style).toMatchObject({ fill: "CanvasText", fillOpacity: 1, stroke: "Canvas" });
    expect(draw(dots!, hollow)!.style).toMatchObject({ fill: "Canvas", stroke: "CanvasText" });
    const [v, , name] = draw(guides!, 0)!.children!;
    expect([v!.style.stroke, name!.style.fill, name!.style.stroke]).toEqual(["CanvasText", "CanvasText", "Canvas"]);
    for (const a of axes(o)) expect([a.axisLabel.color, a.nameTextStyle.color, a.splitLine.lineStyle.color]).toEqual(["CanvasText", "CanvasText", "GrayText"]);
  });

  // The option resolves only the project's hue through env.color; every other color is one of the env's inks, whose
  // tokens tokens.test.ts checks against theme.css.
  it("hands env.color only the hue it was given", () => {
    const seen = new Set<string>(), recording = env({ color: s => { seen.add(s); return s; } });
    const o = quadrantOption(lanes, recording, HUE);
    series(o).forEach(s => (s.data as unknown[]).forEach((_, i) => draw(s, i)));
    expect([...seen]).toEqual([HUE]);
  });
});
