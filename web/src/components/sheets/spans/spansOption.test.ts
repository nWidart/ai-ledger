import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import session from "../../../__fixtures__/session";
import type { SessionDetail } from "../../../api";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../echart/echarts";
import type { OptionEnv } from "../../echart/option";
import { FORCED_INK } from "../../echart/tokens";
import { timelineModel } from "../session";
import { spansLayout, type SpanCall } from "./spans";
import { spansOption } from "./spansOption";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: true, ...over });
const forced = env({ forced: true, ink: { ...FORCED_INK } });

const T0 = Date.parse("2026-11-04T10:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60e3).toISOString();
let n = 0;
/** A call from start to end, in minutes after T0. */
const call = (start: number | null, end: number | null, o: Partial<SpanCall> = {}): SpanCall => ({
  id: `c${++n}`, tool: "Bash", start_ts: start == null ? null : at(start), end_ts: end == null ? null : at(end),
  is_error: end == null ? null : false, subagent: false, lane: 0, input: "", ...o,
});
// One of each shape, a squeezed gap from 3 to 42, and the clipped call's end past the axis's end.
const ok = call(0, 1), hollow = call(.5, 1.5, { is_error: true }), tick = call(2, 2.01, { is_error: true }), open = call(2.5, null),
  still = call(3, 3), stillFailed = call(3.5, 3.5, { is_error: true }), clipped = call(42, 50), apart = call(1, 2, { subagent: true, lane: null });
const calls = [ok, hollow, tick, open, still, stillFailed, clipped, apart, call(44, 44.1)];
const W = 400;
const tl = timelineModel({ ...session, requests: [], compaction_ts: [],
  calls: calls.map(c => ({ ...c, category: null, is_commit: false })) } as unknown as SessionDetail, W, 1)!;
const layout = spansLayout(tl, calls, W, 1)!;
const TIMES = ["10:00", "10:42"] as const;

interface Shape { type: string; z2?: number; shape: Record<string, number> & { points?: number[][] }; style: Record<string, unknown>; children?: Shape[] }
const series = (e = env(), l = layout) => spansOption(l, e, TIMES).series as CustomSeriesOption[];
/** The series' item i, drawn on a stubbed api: the series draw from the layout by dataIndex, on no coordinate system. */
const draw = (s: CustomSeriesOption, i: number) =>
  s.renderItem!({ dataIndex: i, dataIndexInside: i } as CustomSeriesRenderItemParams, {} as CustomSeriesRenderItemAPI) as unknown as Shape;
const all = (e = env(), l = layout) => series(e, l).map(s => (s.data as unknown[]).map((_, i) => draw(s, i)));
const spanOf = (c: SpanCall, e = env()) => draw(series(e)[1]!, layout.spans.findIndex(s => s.id === c.id));
const sp = (c: SpanCall) => layout.spans.find(s => s.id === c.id)!;
const top = (c: SpanCall) => layout.lanes[sp(c).lane]!.top + sp(c).row * 10;

describe("spansOption", () => {
  it("draws three silent custom series on no coordinate system and no grid, never animated, one item per span", () => {
    const o = spansOption(layout, env(), TIMES);
    expect(o).not.toHaveProperty("grid");
    expect(o).not.toHaveProperty("xAxis");
    expect(o.animation).toBe(false); // even with motion on
    expect(series().map(s => [s.id, s.type, s.coordinateSystem, s.silent, s.z])).toEqual([
      ["breaks", "custom", "none", true, 1], ["spans", "custom", "none", true, 2], ["labels", "custom", "none", true, 3]]);
    expect([series()[0]!.data, series()[1]!.data]).toEqual([layout.breaks.map((_, i) => [i]), layout.spans.map((_, i) => [i])]);
  });

  it("draws each kind by its shape at the layout's pixels", () => {
    const [x0, x1] = [sp(ok).x0, sp(ok).x1];
    expect(spanOf(ok)).toMatchObject({ type: "rect", shape: { x: x0, y: top(ok), width: x1 - x0, height: 8 }, style: { fill: "var(--series-1)" } });
    // A failure at least 4px wide: hollow, its 1.5px outline inside the bar's edges.
    const h = sp(hollow);
    expect(spanOf(hollow)).toMatchObject({ type: "rect", shape: { x: h.x0 + .75, y: top(hollow) + .75, width: h.x1 - h.x0 - 1.5, height: 6.5 },
      style: { fill: "ink-surface", stroke: "var(--critical)", lineWidth: 1.5 } });
    // Narrower: the timeline's 2px failure tick at the start, 2px above its row.
    expect(sp(tick).x1 - sp(tick).x0).toBeLessThan(4);
    expect(spanOf(tick)).toMatchObject({ type: "rect", shape: { x: sp(tick).x0 - .5, y: top(tick) - 2, width: 2, height: 10 }, style: { fill: "var(--critical)" } });
    expect(spanOf(open)).toMatchObject({ type: "circle", shape: { cx: sp(open).x0 + .5, cy: top(open) + 4, r: 3 }, style: { fill: "none", stroke: "ink-muted", lineWidth: 1.5 } });
    expect(spanOf(still)).toMatchObject({ type: "rect", shape: { x: sp(still).x0, width: 1, height: 8 }, style: { fill: "ink-muted" } });
    // A failure with no duration (Codex writes start = end): the failure tick, not the muted one.
    expect(sp(stillFailed)).toMatchObject({ kind: "still", failed: true });
    expect(spanOf(stillFailed)).toMatchObject({ type: "rect", shape: { x: sp(stillFailed).x0 - .5, y: top(stillFailed) - 2, width: 2, height: 10 }, style: { fill: "var(--critical)" } });
    expect(spanOf(stillFailed, forced).style).toMatchObject({ fill: "CanvasText" });
    // Clipped: to the plot's edge, the last 4px narrowing to the edge's middle.
    const c = sp(clipped), y = top(clipped), r = layout.right;
    expect(c.clipped).toBe(true);
    expect(spanOf(clipped)).toMatchObject({ type: "polygon", shape: { points: [[c.x0, y], [r - 4, y], [r, y + 4], [r - 4, y + 8], [c.x0, y + 8]] }, style: { fill: "var(--series-1)" } });
  });

  it("draws a shorter span over a longer one", () => {
    expect(spanOf(still).z2!).toBeGreaterThan(spanOf(ok).z2!);
    expect(spanOf(ok).z2!).toBeGreaterThan(spanOf(clipped).z2!);
  });

  it("draws each break as a band with the zigzag at its top, over the lanes", () => {
    const [band, zig] = draw(series()[0]!, 0).children!, bx = layout.breaks[0]!, y0 = layout.lanes[0]!.top - 14;
    expect(band).toMatchObject({ type: "rect", shape: { x: bx - 3, y: y0, width: 6, height: layout.bottom - y0 }, style: { fill: "var(--surface-2)" } });
    expect(zig).toMatchObject({ type: "polyline", shape: { points: [[bx - 4, y0 + 6], [bx - 1, y0], [bx + 1, y0 + 6], [bx + 4, y0]] }, style: { stroke: "ink-muted" } });
  });

  it("labels each lane above it, truncated to the plot's width, and the axis's ends under the lanes", () => {
    const s = 2, big = spansLayout(timelineModel({ ...session, requests: [], compaction_ts: [],
      calls: calls.map(c => ({ ...c, category: null, is_commit: false })) } as unknown as SessionDetail, W, s)!, calls, W, s)!;
    const texts = draw(series(env({ textScale: s }), big)[2]!, 0).children!.map(t => t.style);
    expect(texts.map(t => t.text)).toEqual(["Main thread", "Subagents, not told apart", ...TIMES]);
    expect(texts[1]).toMatchObject({ x: big.left, y: big.lanes[1]!.top - 14, verticalAlign: "middle", width: big.right - big.left,
      overflow: "truncate", ellipsis: "…", fontSize: 22, fontWeight: 600, fill: "ink-secondary" });
    expect(texts.slice(2)).toMatchObject([{ x: big.left, align: "left", y: big.bottom + 16, fontSize: 21, fill: "ink-muted" },
      { x: big.right, align: "right", y: big.bottom + 16 }]);
  });

  it("takes system colors for every fill and stroke under forced colors", () => {
    const SYSTEM = new Set(["CanvasText", "Canvas", "GrayText", "none"]);
    const colors = all(forced).flat().flatMap(s => s.children ?? [s]).flatMap(s => [s.style.fill, s.style.stroke].filter(v => v != null));
    expect(colors.length).toBeGreaterThan(10);
    expect(colors.filter(c => !SYSTEM.has(c as string))).toEqual([]);
    expect(spanOf(hollow, forced).style).toMatchObject({ fill: "Canvas", stroke: "CanvasText" });
    expect(draw(series(forced)[0]!, 0).children!.map(c => c.style.fill ?? c.style.stroke)).toEqual(["GrayText", "none"]);
  });

  // A token that is not a color resolves to the inherited text color, with no error (tokens.ts).
  it("hands env.color only color tokens theme.css declares", () => {
    const declared = new Map<string, string>();
    for (const block of readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|\n):root \{([^}]*)\}/g))
      for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
    const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
    const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);
    const seen = new Set<string>();
    all(env({ color: c => { seen.add(c); return c; } }));
    expect([...seen].sort()).toEqual(["var(--critical)", "var(--series-1)", "var(--surface-2)"]);
    for (const css of seen) expect([css, declared.get(/^var\((--[\w-]+)\)$/.exec(css)![1]!)]).toEqual([css, expect.stringMatching(COLOR)]);
  });
});
