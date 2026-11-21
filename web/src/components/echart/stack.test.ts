import { describe, expect, it } from "vitest";
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "./echarts";
import { stackRects, stackSeries, type StackEnv, type StackRect } from "./stack";
import type { ChartEnv } from "./tokens";

// Type-level: a chart passes its own `ChartEnv` as the stack's environment; tsc fails here if that stops holding.
export const chartEnvIsStackEnv = (e: ChartEnv): StackEnv => e;

const env = (over: Partial<StackEnv> = {}): StackEnv => ({
  color: s => `resolved(${s})`, ink: { text: "ink-text", surface: "ink-surface" }, forced: false, motion: false, ...over,
});
const kinds = [{ k: "input", c: "var(--proj-1)" }, { k: "output", c: "var(--proj-2)" }, { k: "cache_read", c: "var(--proj-3)" }];

// A 200px plot: the baseline at y 220, the 100% line at y 20.
const Y0 = 220, TOP = 20;
const rects = (values: number[], top = TOP) => stackRects(values, Y0, top, 10, 30);
// Bottom first, so each rectangle sits above the one before it.
const gapsKept = (r: StackRect[]) => r.slice(1).every((s, j) => s.y + s.height + 2 <= r[j]!.y + 1e-9);

describe("stackRects", () => {
  it("gives two 0.1% shares room of their own, so no segment paints over another and the bar still fills the plot", () => {
    const r = rects([998, 1, 1]);
    expect(r).toHaveLength(3);
    for (const s of r) expect(s.height).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(gapsKept(r)).toBe(true);
    expect(r[0]!.y + r[0]!.height).toBeCloseTo(Y0, 9);
    expect(r.at(-1)!.y).toBeCloseTo(TOP, 9);
  });

  it("splits the bar's height by value, less a 2px gap under every segment but the first", () => {
    const r = rects([1, 3]);
    expect(r.map(s => [s.y, s.height])).toEqual([[170, 50], [20, 148]]);
    expect(r.every(s => s.x === 10 && s.width === 30)).toBe(true);
  });

  it("rounds the top segment's top corners only when it is taller than 4px", () => {
    expect(rects([1, 3]).map(s => s.r)).toEqual([0, [3, 3, 0, 0]]);
    // A 6px bar: the top segment's 3px slot paints 1px, too short to round.
    expect(rects([1, 1], Y0 - 6).map(s => s.r)).toEqual([0, 0]);
    // One segment is the top one too.
    expect(rects([5]).map(s => s.r)).toEqual([[3, 3, 0, 0]]);
  });

  it("keeps every segment's minimum when they add up to more than the bar, so the bar rises above its top", () => {
    // Five segments on a 2px bar: 1px, then 1px over a 2px gap four times, a 13px bar from the baseline.
    const r = rects([1, 1, 1, 1, 1], Y0 - 2);
    expect(r.map(s => s.height)).toEqual([1, 1, 1, 1, 1]);
    expect(gapsKept(r)).toBe(true);
    expect(r[0]!.y + r[0]!.height).toBe(Y0);
    expect(r.at(-1)!.y).toBe(Y0 - 13);
  });

  it("draws no rectangle for a zero value, and keeps each rectangle's kind", () => {
    expect(rects([0, 0, 0])).toEqual([]);
    expect(rects([5, 0, 5]).map(s => s.j)).toEqual([0, 2]);
  });
});

// A stubbed renderItem API over a category axis: 40px bands from x 0, the value axis 0 to 1 over the plot above.
// `action`: the action that made ECharts render, such as "dataZoom"; none for a drawing (setOption).
function draw(series: ReturnType<typeof stackSeries>, i: number, action?: string) {
  const row = (series.data as number[][])[i]!;
  const api = {
    value: (dim: number) => row[dim]!,
    coord: ([x, v]: number[]) => [(x! + .5) * 40, Y0 - v! * (Y0 - TOP)],
    size: ([dx, dy]: number[]) => [dx! * 40, dy! * (Y0 - TOP)],
  } as unknown as CustomSeriesRenderItemAPI;
  const params = { dataIndex: i, dataIndexInside: i, actionType: action ?? null } as unknown as CustomSeriesRenderItemParams;
  return series.renderItem!(params, api) as unknown as Group | null;
}
interface Shape { type: string; name?: string; shape: StackRect & { r: number | number[] }; style: Record<string, unknown> }
interface Group { type: string; children: Shape[]; originX?: number; originY?: number; enterFrom?: { scaleY: number }; enterAnimation?: { delay: number } }

const shares = [[.98, .01, .01], [.5, .5, 0], [0, 0, 0], [.2, .3, .5]];

describe("stackSeries", () => {
  it("is a custom series with one row per day: its index, its total and its values", () => {
    const s = stackSeries({ kinds, values: shares, hatched: () => false, env: env() });
    expect(s.type).toBe("custom");
    // A redraw under replaceMerge keeps the series, so its bars do not grow again.
    expect(s.id).toBe("stack");
    expect(s.encode).toEqual({ x: 0, y: 1 });
    expect([s.xAxisIndex, s.yAxisIndex]).toEqual([0, 0]);
    expect(s.data).toEqual([[0, 1, .98, .01, .01], [1, 1, .5, .5, 0], [2, 0, 0, 0, 0], [3, 1, .2, .3, .5]]);
  });

  it("puts two stacks with ids of their own on two grids of one option, in ECharts", async () => {
    const { init } = await import("./echarts"); // the real runtime, not the fake that test-setup gives the load module
    const dom = document.createElement("div");
    const chart = init(dom, null, { renderer: "svg", width: 400, height: 300 });
    const days = ["d0", "d1", "d2", "d3"];
    const stack = (over: Partial<Parameters<typeof stackSeries>[0]>) => stackSeries({ kinds, values: shares, hatched: () => false, env: env(), ...over });
    const option = (series: ReturnType<typeof stackSeries>[]) => ({
      grid: [{ top: 10, height: 100 }, { top: 160, height: 100 }],
      xAxis: [{ type: "category" as const, data: days, gridIndex: 0 }, { type: "category" as const, data: days, gridIndex: 1 }],
      yAxis: [{ type: "value" as const, gridIndex: 0 }, { type: "value" as const, gridIndex: 1 }],
      series,
    });
    try {
      chart.setOption(option([stack({ id: "work" }), stack({ id: "errors", xAxisIndex: 1, yAxisIndex: 1 })]));
      const series = chart.getOption().series as { id: string; xAxisIndex: number; yAxisIndex: number }[];
      expect(series.map(s => [s.id, s.xAxisIndex, s.yAxisIndex])).toEqual([["work", 0, 0], ["errors", 1, 1]]);
      // Two stacks left on the default id: ECharts throws and draws nothing.
      expect(() => chart.setOption(option([stack({}), stack({ xAxisIndex: 1, yAxisIndex: 1 })]), { replaceMerge: ["series"] })).toThrow("id duplicates: stack");
    } finally {
      chart.dispose();
    }
  });

  it("draws each segment in its kind's resolved color, on the band less min(4, band × .25)", () => {
    const g = draw(stackSeries({ kinds, values: shares, hatched: () => false, env: env() }), 0)!;
    expect(g.type).toBe("group");
    expect(g.children.map(c => c.style.fill)).toEqual(["resolved(var(--proj-1))", "resolved(var(--proj-2))", "resolved(var(--proj-3))"]);
    for (const c of g.children) expect([c.shape.x, c.shape.width]).toEqual([2, 36]);
    // The 1% shares keep their pixel and their gap.
    expect(g.children.map(c => c.shape.height).every(h => h >= 1)).toBe(true);
    expect(g.children[0]!.shape.y + g.children[0]!.shape.height).toBeCloseTo(Y0, 9);
    expect(g.children[2]!.shape.y).toBeCloseTo(TOP, 9);
  });

  it("takes a bar width rule of its own", () => {
    const g = draw(stackSeries({ kinds, values: shares, hatched: () => false, env: env(), width: band => band / 2 }), 3)!;
    for (const c of g.children) expect([c.shape.x, c.shape.width]).toEqual([130, 20]);
  });

  it("gives the width rule each point's index, so a point can take a width of its own", () => {
    const seen: [number, number][] = [];
    const s = stackSeries({ kinds, values: shares, hatched: () => false, env: env(), width: (band, i) => (seen.push([band, i]), i === 3 ? band / 2 : band) });
    expect(draw(s, 0)!.children[0]!.shape.width).toBe(40);
    expect(draw(s, 3)!.children[0]!.shape.width).toBe(20);
    expect(seen).toEqual([[40, 0], [40, 3]]);
  });

  it("draws nothing for a day of zeros, and skips a zero segment", () => {
    const s = stackSeries({ kinds, values: shares, hatched: () => true, env: env() });
    expect(draw(s, 2)).toBeNull();
    expect(draw(s, 1)!.children.filter(c => !c.style.decal).map(c => c.name)).toEqual(["input", "output"]);
  });

  it("draws a hatched day's segments a second time, under surface stripes at 60%", () => {
    const s = stackSeries({ kinds, values: shares, hatched: i => i === 3, env: env() });
    expect(draw(s, 0)!.children.some(c => c.style.decal)).toBe(false);
    const g = draw(s, 3)!;
    expect(g.children).toHaveLength(6);
    const plain = g.children.filter(c => !c.style.decal), twins = g.children.filter(c => c.style.decal);
    expect(twins.map(t => t.shape)).toEqual(plain.map(p => p.shape));
    for (const t of twins) {
      expect(t.style.opacity).toBe(.6);
      expect(t.style.fill).toBe("none");
      expect(t.style.decal).toMatchObject({ color: "ink-surface" });
    }
  });

  it("gives each bar no highlight state, hatched or not, with motion or not", () => {
    // ECharts would redraw a highlighted bar's segments in lifted colors that no token gives.
    for (const motion of [false, true]) {
      const s = stackSeries({ kinds, values: shares, hatched: i => i === 3, env: env({ motion }) });
      for (const i of [0, 3]) expect(draw(s, i)).toMatchObject({ emphasisDisabled: true });
    }
  });

  it("edges each segment in the text ink under forced colors only", () => {
    const plain = draw(stackSeries({ kinds, values: shares, hatched: () => false, env: env() }), 0)!;
    for (const c of plain.children) expect(c.style.stroke).toBeUndefined();
    const forced = draw(stackSeries({ kinds, values: shares, hatched: () => false, env: env({ forced: true }) }), 0)!;
    for (const c of forced.children) expect([c.style.stroke, c.style.lineWidth]).toEqual(["ink-text", .75]);
  });

  it("grows each bar from its baseline when motion is on, 6ms later per day up to 60 days", () => {
    const days = Array.from({ length: 80 }, () => [1, 1, 1]);
    const s = stackSeries({ kinds, values: days, hatched: () => false, env: env({ motion: true }) });
    const g = draw(s, 3)!;
    expect(g.enterFrom).toEqual({ scaleY: 0 });
    expect([g.originX, g.originY]).toEqual([140, Y0]);
    expect(g.enterAnimation!.delay).toBe(18);
    expect(draw(s, 70)!.enterAnimation!.delay).toBe(360);
    const still = draw(stackSeries({ kinds, values: days, hatched: () => false, env: env() }), 3)!;
    expect(still.enterFrom).toBeUndefined();
  });

  it("does not grow a bar that an action brings back: a zoom out, a resize", () => {
    // ECharts makes a bar the zoom left out again when the zoom shows it, and would play its enter animation.
    const s = stackSeries({ kinds, values: [[1, 1, 1], [1, 1, 1]], hatched: () => false, env: env({ motion: true }) });
    expect(draw(s, 1)!.enterFrom).toEqual({ scaleY: 0 });
    for (const action of ["dataZoom", "resize"]) {
      const g = draw(s, 1, action)!;
      expect(g.enterFrom).toBeUndefined();
      expect(g.enterAnimation).toBeUndefined();
      expect(g.children).toHaveLength(3); // drawn whole, at once
    }
  });
});
