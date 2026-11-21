import { describe, expect, it } from "vitest";
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "echarts";
import { dayAxis, peakLabelAt } from "../chart";
import { baseOption, categoryAxis, pointLabel, valueAxis, zoomSlider, type OptionEnv } from "./option";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ ink, textScale: 1, motion: true, ...over });
const step = (r: number) => Math.max(1, Math.ceil(r));

describe("baseOption", () => {
  it("animates the first draw only, and not at all under reduced motion", () => {
    expect(baseOption(env())).toMatchObject({ animation: true, animationDuration: 500, animationDurationUpdate: 0 });
    expect(baseOption(env({ motion: false }))).toMatchObject({ animation: false, animationDurationUpdate: 0 });
  });

  it("sets the body font at 11px times the text scale", () => {
    expect(baseOption(env()).textStyle).toMatchObject({ fontSize: 11 });
    expect(baseOption(env({ textScale: 2 })).textStyle).toMatchObject({ fontSize: 22 });
    expect(baseOption(env()).textStyle?.fontFamily).toContain("IBM Plex Sans");
  });
});

describe("categoryAxis", () => {
  it("draws muted labels that hide on overlap, with no tick and no line", () => {
    const x = categoryAxis(env(), ["2026-10-01", "2026-10-02"], d => d.slice(5));
    expect(x).toMatchObject({ type: "category", data: ["2026-10-01", "2026-10-02"], axisTick: { show: false }, axisLine: { show: false } });
    expect(x.axisLabel).toMatchObject({ color: "ink-muted", hideOverlap: true, fontSize: 11 });
    expect((x.axisLabel!.formatter as (v: string) => string)("2026-10-02")).toBe("10-02");
  });

  it("puts the shadow pointer in the cursor ink, with no label", () => {
    expect(categoryAxis(env(), [], String).axisPointer).toMatchObject({ show: true, type: "shadow", shadowStyle: { color: "ink-cursor" }, label: { show: false } });
  });

  it("grows the label size and margin with the text scale", () => {
    const one = categoryAxis(env(), [], String).axisLabel!, two = categoryAxis(env({ textScale: 2 }), [], String).axisLabel!;
    expect(two.fontSize).toBe(2 * (one.fontSize as number));
    expect(two.margin).toBe(2 * one.margin!);
  });
});

describe("valueAxis", () => {
  it("runs from 0 to the given max in the given steps, on grid lines", () => {
    const y = valueAxis(env(), { max: 40, step: 10, format: v => `$${v}` });
    expect(y).toMatchObject({ type: "value", min: 0, max: 40, interval: 10, splitLine: { lineStyle: { color: "ink-grid" } } });
    expect(y.axisLabel).toMatchObject({ color: "ink-muted", fontSize: 11 });
    expect((y.axisLabel!.formatter as (v: number) => string)(20)).toBe("$20");
  });

  it("grows the label size and margin with the text scale", () => {
    const one = valueAxis(env(), { max: 1, step: .25, format: String }).axisLabel!;
    const two = valueAxis(env({ textScale: 2 }), { max: 1, step: .25, format: String }).axisLabel!;
    expect(two.fontSize).toBe(2 * (one.fontSize as number));
    expect(two.margin).toBe(2 * one.margin!);
  });
});

describe("pointLabel", () => {
  // Draw the label through renderItem with a stubbed coordinate system laid out as dayAxis lays out the same plot.
  const draw = (s: number, i: number) => {
    const a = dayAxis(800, 240, 30, 10, step, undefined, s), v = 8;
    const series = pointLabel(env({ textScale: s }), { index: i, value: v, text: "Peak" });
    const values = series.data as number[][];
    const api = { value: (dim: number) => values[0]![dim], coord: ([x, y]: number[]) => [a.cx(x!), a.y(y!)], size: () => [a.bw, 0] };
    const params = { coordSys: { type: "cartesian2d", x: a.m.l, y: a.m.t, width: a.iw, height: a.ih } };
    const el = series.renderItem!(params as unknown as CustomSeriesRenderItemParams, api as unknown as CustomSeriesRenderItemAPI) as
      { type: string; style: { x: number; y: number; align: string; text: string; fill: string; stroke: string; fontSize: number } };
    return { el, a, v };
  };
  const align = { start: "left", middle: "center", end: "right" };

  it.each([[1, 0], [1, 1], [1, 15], [1, 28], [1, 29], [2, 0], [2, 2], [2, 15], [2, 27], [2, 29]])(
    "anchors as peakLabelAt does (scale %d, day %d)", (s, i) => {
      const { el, a } = draw(s, i), want = peakLabelAt(a, i);
      expect(el.style.align).toBe(align[want.anchor]);
      expect(el.style.x).toBeCloseTo(want.x);
    });

  it("covers all three anchors", () => {
    expect(new Set([0, 15, 29].map(i => draw(1, i).el.style.align))).toEqual(new Set(["left", "center", "right"]));
  });

  it("draws the text above the point, haloed in the surface ink, at the scaled size", () => {
    const { el, a, v } = draw(2, 15);
    expect(el.type).toBe("text");
    expect(el.style).toMatchObject({ text: "Peak", fill: "ink-text", stroke: "ink-surface", fontSize: 22 });
    expect(el.style.y).toBeLessThan(a.y(v));
  });

  it("is one item, drawn above the lines and deaf to the pointer", () => {
    const series = pointLabel(env(), { index: 3, value: 5, text: "x" });
    expect(series).toMatchObject({ type: "custom", data: [[3, 5]], silent: true });
    expect(series.z).toBeGreaterThan(2);
  });
});

describe("zoomSlider", () => {
  it("is a 20px slider with no detail text and no brush, at least 7 days wide", () => {
    expect(zoomSlider(env())).toMatchObject({ type: "slider", height: 20, showDetail: false, brushSelect: false, minValueSpan: 6 });
  });

  it("takes its colors from the ink roles", () => {
    const z = zoomSlider(env());
    expect(z).toMatchObject({ borderColor: "ink-border", fillerColor: "ink-cursor", handleStyle: { color: "ink-surface", borderColor: "ink-border" } });
    const colors = JSON.stringify(z).match(/"(#|rgb)[^"]*"/g);
    expect(colors).toBeNull(); // no color but the ink roles
  });
});
