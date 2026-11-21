import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "./echarts";
import { dayAxis, peakLabelAt } from "../chart";
import {
  baseOption, categoryAxis, FRAME_AXES, labelAnchor, lineSeries, pointLabel, selectionMark, SLIDER_ROOM, sliderTrend, trackAxes, trackLayout,
  tracksOption, valueAxis, zoomSlider, type OptionEnv,
} from "./option";
import { sliderShadowOf } from "./testing";
import type { ChartEnv } from "./tokens";

// Type-level: a chart passes its own `ChartEnv` to these helpers; tsc fails here if that stops holding.
export const chartEnvIsOptionEnv = (e: ChartEnv): OptionEnv => e;

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ color: s => `resolved(${s})`, ink, forced: false, textScale: 1, motion: true, ...over });
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

  it("uses the font family theme.css gives the body", () => {
    const body = /(?:^|\n)body \{([^}]*)\}/.exec(readFileSync("src/theme.css", "utf8"))![1]!; // vitest runs from web/
    const font = /(?:^|[\s;])font:\s*([^;]+);/.exec(body)![1]!.trim();
    // The shorthand is "<size>/<line-height> <family>": the family is everything after the first space.
    expect(baseOption(env()).textStyle.fontFamily).toBe(font.slice(font.indexOf(" ") + 1));
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
    // The band jumps to the point read: ECharts would slide it for 200ms over bands wider than 15px, across days the
    // tooltip and the readout no longer name.
    expect(categoryAxis(env({ motion: true }), [], String).axisPointer).toMatchObject({ animation: false });
  });

  it("highlights nothing on the point read: the band alone shows the reading", () => {
    // By default the pointer highlights every item on its point: ECharts lifts a custom series' colors and draws a dot in its
    // own palette on a line with no symbols.
    expect(categoryAxis(env(), [], String).axisPointer).toMatchObject({ triggerEmphasis: false });
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

  it("has no highlight state, so no highlight changes its colors", () => {
    expect(draw(1, 15).el).toMatchObject({ emphasisDisabled: true });
  });

  it("is one item, drawn above the lines and deaf to the pointer", () => {
    const series = pointLabel(env(), { index: 3, value: 5, text: "x" });
    expect(series).toMatchObject({ type: "custom", data: [[3, 5]], silent: true });
    expect(series.z).toBeGreaterThan(2);
  });

  // The label measured in its drawn font: a canvas whose text is 5px a character at 11px (the long label below is 160px,
  // as "Peak 66 sessions · Week of Nov 2" is 170px in Chromium), drawn over 11 weekly bars in a 343px box's 275px plot.
  it("measures the text in its font, keeps it inside the plot at every bar, and draws none in a plot narrower than it", () => {
    const fonts: string[] = [];
    const ctx = { font: "", measureText(t: string) { fonts.push(this.font); return { width: t.length * 5 * parseFloat(/(\d+)px/.exec(this.font)![1]!) / 11 }; } };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const long = "Peak 66 sessions · Week of Nov 2", plot = { x: 52, y: 20, width: 275, height: 120 }, band = plot.width / 11;
    const drawAt = (s: number, i: number) => {
      const series = pointLabel(env({ textScale: s }), { index: i, value: 5, text: long });
      const api = { value: (dim: number) => [i, 5][dim], coord: ([x]: number[]) => [plot.x + (x! + .5) * band, 40], size: () => [band, 0] };
      return series.renderItem!({ coordSys: { type: "cartesian2d", ...plot } } as unknown as CustomSeriesRenderItemParams, api as unknown as CustomSeriesRenderItemAPI) as
        { style: { x: number; align: "left" | "center" | "right" } } | null;
    };
    for (let i = 0; i < 11; i++) {
      const el = drawAt(1, i)!, lead = { left: 0, center: 80, right: 160 }[el.style.align];
      expect(el.style.x - lead, `bar ${i}: left end`).toBeGreaterThanOrEqual(plot.x);
      expect(el.style.x - lead + 160, `bar ${i}: right end`).toBeLessThanOrEqual(plot.x + plot.width);
    }
    for (let i = 0; i < 11; i++) expect(drawAt(2, i), `bar ${i} at scale 2: a 320px label in a 275px plot`).toBeNull();
    expect(fonts).toContain(`600 11px ${baseOption(env()).textStyle.fontFamily}`);
    expect(fonts).toContain(`600 22px ${baseOption(env()).textStyle.fontFamily}`);
  });
});

describe("labelAnchor", () => {
  /** The rule of peakLabelAt, which assumes a short label: where a label goes when it fits there. */
  const rule = (cx: number, bar: number, plot: { x: number; width: number }, s: number) =>
    cx < plot.x + 56 * s ? { x: Math.max(plot.x, cx - bar / 2), align: "left" }
    : cx > plot.x + plot.width - 56 * s ? { x: Math.min(plot.x + plot.width, cx + bar / 2), align: "right" }
    : { x: cx, align: "center" };
  /** A label's two ends, from its anchor. */
  const ends = ({ x, align }: { x: number; align: string }, w: number) => {
    const left = x - (align === "left" ? 0 : align === "center" ? w / 2 : w);
    return [left, left + w] as const;
  };
  /** n bars over a plot from x 52, as a category axis lays them out. */
  const bars = (width: number, n = 11) => {
    const band = width / n;
    return { plot: { x: 52, width }, bar: Math.max(1, band - Math.min(4, band * .25)), cx: (i: number) => 52 + (i + .5) * band };
  };
  // Cost's "Peak $53 · Nov 4" is 86px at 11px, the work chart's "Peak 66 sessions · Week of Nov 2" 170px; a 343px box has
  // a 275px plot, a 1440px window a 1372px one. The peak at the first bar, early, two in, the middle, late and the last.
  const cases = [275, 1372].flatMap(pw => [1, 2].flatMap(s => [86, 170].flatMap(w => [0, 1, 2, 5, 8, 9, 10].map(i => ({ pw, s, w: w * s, i })))));

  it.each(cases)("puts a $w px label inside a $pw px plot at scale $s, the peak at bar $i, or none when it cannot fit", ({ pw, s, w, i }) => {
    const { plot, bar, cx } = bars(pw), at = labelAnchor(cx(i), bar, plot, s, w);
    if (w > pw) return void expect(at).toBeNull();
    const [l, r] = ends(at!, w);
    expect(l).toBeGreaterThanOrEqual(plot.x);
    expect(r).toBeLessThanOrEqual(plot.x + pw);
    // Where the old rule's place fits, the label stays there; elsewhere it keeps the rule's anchor and slides inside.
    const old = rule(cx(i), bar, plot, s), [ol, or] = ends(old, w);
    if (ol >= plot.x && or <= plot.x + pw) expect(at).toEqual(old);
    else expect(at!.align).toBe(old.align);
  });

  it("moves the long label that the old rule put out of a phone's plot, by just as much as it left", () => {
    const { plot, bar, cx } = bars(275);
    // Two bars in, the label centred over the bar would start 22.5px left of the plot; two from the end, end 22.5px right.
    expect(ends(rule(cx(2), bar, plot, 1), 170)[0]).toBeCloseTo(29.5);
    expect(labelAnchor(cx(2), bar, plot, 1, 170)).toEqual({ x: 52 + 85, align: "center" });
    expect(ends(rule(cx(8), bar, plot, 1), 170)[1]).toBeCloseTo(349.5);
    expect(labelAnchor(cx(8), bar, plot, 1, 170)).toEqual({ x: 327 - 85, align: "center" });
    // The edge bars' labels, anchored at the bar's outer edge, fit as they are.
    expect(labelAnchor(cx(0), bar, plot, 1, 170)).toEqual(rule(cx(0), bar, plot, 1));
    expect(labelAnchor(cx(10), bar, plot, 1, 170)).toEqual(rule(cx(10), bar, plot, 1));
  });

  it("fills a plot exactly as wide as the label, and draws none in a narrower one", () => {
    const { plot, bar, cx } = bars(275);
    for (const i of [0, 5, 10]) expect(ends(labelAnchor(cx(i), bar, plot, 1, 275)!, 275)).toEqual([52, 327]);
    expect(labelAnchor(cx(5), bar, plot, 1, 275.5)).toBeNull();
  });
});

describe("zoomSlider", () => {
  it("is a 20px slider with no detail text and no brush, at least 7 days wide", () => {
    expect(zoomSlider(env())).toMatchObject({ type: "slider", height: 20, showDetail: false, brushSelect: false, minValueSpan: 6 });
    // The slider sends each step of a drag at once. ECharts would hold steps back (every 20ms here) and send the last
    // one late, after the pointer's release, where the wrapper would say the days shown a second time.
    expect(zoomSlider(env())).toMatchObject({ throttle: 0 });
  });

  it("has a fixed id, so a redraw merges into it and keeps the window", () => {
    expect(zoomSlider(env()).id).toBe("zoom");
  });

  it("drives every x axis: with none named, ECharts zooms a frame and leaves its tracks", () => {
    expect(zoomSlider(env()).xAxisIndex).toBe("all");
  });

  it("tints the days shown and fills both handles with the accent, in a muted frame, over a muted trend", () => {
    const z = zoomSlider(env());
    expect(z).toMatchObject({ borderColor: "ink-muted", fillerColor: "ink-tint", handleStyle: { color: "ink-accent", borderColor: "ink-accent" } });
    for (const trend of [z.dataBackground, z.selectedDataBackground]) {
      expect(trend).toMatchObject({ lineStyle: { color: "ink-muted" }, areaStyle: { color: "ink-grid" } });
      expect(trend!.lineStyle!.opacity).toBeLessThan(1);
    }
    expect(z.handleIcon).toMatch(/^path:\/\//);
  });

  it("takes its colors from the ink roles", () => {
    const z = zoomSlider(env());
    const colors = JSON.stringify(z).match(/"(#|rgb)[^"]*"/g);
    expect(colors).toBeNull(); // no color but the ink roles
  });
});

// The work chart's tracks at the default text size: bars 120px that keep their height, a 16px gap, a rate track of 36px
// that grows with the text, under margins for the labels.
const WORK = { margin: { t: 20, r: 16, b: 24, l: 52 }, tracks: [{ fixed: 120 }, { scaled: 36 }], gap: 16 };

describe("trackLayout", () => {
  it("gives the work chart's tracks 216px, and 244px with the slider", () => {
    expect(trackLayout(1, { ...WORK, slider: false })).toEqual({
      height: 216, left: 52, right: 16, frame: { top: 20, height: 172 }, tracks: [{ top: 20, height: 120 }, { top: 156, height: 36 }],
    });
    expect(trackLayout(1, { ...WORK, slider: true }).height).toBe(244);
    expect(SLIDER_ROOM).toBe(28);
  });

  it("keeps a fixed track's height at twice the text size, and doubles a scaled track, the gap and the margins", () => {
    const l = trackLayout(2, { ...WORK, slider: true });
    expect(l.tracks).toEqual([{ top: 40, height: 120 }, { top: 192, height: 72 }]);
    expect([l.left, l.right]).toEqual([104, 32]);
    expect(l.height).toBe(40 + 120 + 32 + 72 + 48 + SLIDER_ROOM);
  });

  it("runs the frame from the first track's top to the last track's bottom", () => {
    for (const s of [1, 1.5, 2]) {
      const l = trackLayout(s, { margin: WORK.margin, tracks: [{ fixed: 80 }, { scaled: 30 }, { fixed: 10, scaled: 20 }], gap: 12, slider: false });
      const first = l.tracks[0]!, last = l.tracks.at(-1)!;
      expect(l.frame).toEqual({ top: first.top, height: last.top + last.height - first.top });
      expect(l.height - last.top - last.height).toBeCloseTo(24 * s);
    }
  });
});

describe("trackAxes and FRAME_AXES", () => {
  it("puts track t on the axes t + 1, behind the frame's axes 0", () => {
    expect(trackAxes(0)).toEqual({ xAxisIndex: 1, yAxisIndex: 1 });
    expect(trackAxes(1)).toEqual({ xAxisIndex: 2, yAxisIndex: 2 });
    expect(FRAME_AXES).toEqual({ xAxisIndex: 0, yAxisIndex: 0 });
  });
});

describe("tracksOption", () => {
  const labels = ["2026-10-01", "2026-10-02", "2026-10-03"];
  const y = (max: number) => valueAxis(env(), { max, step: max, format: String });
  const option = () => tracksOption(env(), { layout: trackLayout(1, { ...WORK, slider: false }), labels, format: d => d.slice(5), y: [y(10), y(.2)] });
  type Axis = { type?: string; gridIndex?: number; data?: string[]; show?: boolean; axisPointer?: { show?: boolean }; axisLabel?: { formatter?: unknown } };

  it("gives the frame and each track a grid, an x axis and a y axis, all on one left and right", () => {
    const o = option();
    expect([o.grid.length, o.xAxis.length, o.yAxis.length]).toEqual([3, 3, 3]);
    expect(o.grid).toEqual([
      { left: 52, right: 16, top: 20, height: 172, outerBoundsMode: "none" },
      { left: 52, right: 16, top: 20, height: 120, outerBoundsMode: "none" },
      { left: 52, right: 16, top: 156, height: 36, outerBoundsMode: "none" },
    ]);
  });

  it("opts every grid out of ECharts' own fit, which would shrink the frame alone, the one grid with visible labels", () => {
    expect(option().grid.map(g => g.outerBoundsMode)).toEqual(["none", "none", "none"]);
  });

  it("keeps the newest label, right-aligned on its point, so it ends inside the plot: with no fit, the box would clip it", () => {
    const [frame] = option().xAxis as (Axis & { axisLabel: Record<string, unknown> })[];
    expect(frame!.axisLabel).toMatchObject({ hideOverlap: true, alignMaxLabel: "right", showMaxLabel: true });
    expect(frame!.axisLabel.alignMinLabel).toBeUndefined(); // the left margin holds half the first label
  });

  it("puts the labels and the only axis pointer on x axis 0, the frame's", () => {
    const [frame, ...tracks] = option().xAxis as Axis[];
    expect(frame).toMatchObject({ type: "category", gridIndex: 0, data: labels, axisPointer: { show: true, triggerEmphasis: false } });
    expect((frame!.axisLabel!.formatter as (v: string) => string)("2026-10-02")).toBe("10-02");
    expect((option().xAxis as Axis[]).filter(a => a.axisPointer?.show)).toHaveLength(1);
    // Each track's x axis: hidden, on its own grid, over the same labels, with no pointer.
    tracks.forEach((a, t) => expect(a).toEqual({ type: "category", gridIndex: t + 1, data: labels, show: false, axisPointer: { show: false } }));
  });

  it("gives the frame a hidden value axis from 0 to 1, and each track its own value axis on its grid", () => {
    const [frame, bars, rate] = option().yAxis as (Axis & { min?: number; max?: number })[];
    expect(frame).toEqual({ type: "value", gridIndex: 0, min: 0, max: 1, show: false });
    expect(bars).toMatchObject({ type: "value", gridIndex: 1, max: 10 });
    expect(rate).toMatchObject({ type: "value", gridIndex: 2, max: .2 });
  });

  it("refuses a list of value axes that does not match the tracks", () => {
    expect(() => tracksOption(env(), { layout: trackLayout(1, { ...WORK, slider: false }), labels, format: String, y: [y(1)] })).toThrow("2 tracks, 1 value axes");
  });
});

describe("selectionMark", () => {
  // Drawn through renderItem over a stubbed frame: from y 20, 172px tall, with 40px bands from x 52.
  const draw = (e: OptionEnv, index: number) => {
    const s = selectionMark(e, { index }), row = (s.data as number[][])[0]!;
    const api = { value: (dim: number) => row[dim], coord: ([x]: number[]) => [52 + (x! + .5) * 40, 0], size: ([dx]: number[]) => [dx! * 40, 0] };
    const params = { coordSys: { type: "cartesian2d", x: 52, y: 20, width: 532, height: 172 } };
    return s.renderItem!(params as unknown as CustomSeriesRenderItemParams, api as unknown as CustomSeriesRenderItemAPI) as
      { type: string; shape: Record<string, number>; style: Record<string, unknown> };
  };

  it("is one silent item on the frame's axes, with a fixed id, over the grid lines and under the marks", () => {
    const s = selectionMark(env(), { index: 3 });
    expect(s).toMatchObject({ type: "custom", id: "selected", xAxisIndex: 0, yAxisIndex: 0, z: 1, silent: true });
    expect(s.data).toEqual([[3, 0]]);
  });

  it("frames the point's band over the frame's height, tinted, in a 1.5px accent line inside the band", () => {
    const r = draw(env(), 3); // band 3 runs from x 172 to 212
    expect(r.type).toBe("rect");
    expect(r.shape).toEqual({ x: 172.75, y: 20.75, width: 38.5, height: 170.5 });
    expect(r.style).toEqual({ fill: "ink-tint", stroke: "ink-accent", lineWidth: 1.5 });
    // No highlight state: reading the selected point leaves its tint and frame as they are.
    expect(r).toMatchObject({ emphasisDisabled: true });
  });

  it("is an unfilled 2px frame in the accent, Highlight there, under forced colors", () => {
    const r = draw(env({ forced: true }), 0); // band 0 runs from x 52 to 92
    expect(r.shape).toEqual({ x: 53, y: 21, width: 38, height: 170 });
    expect(r.style).toEqual({ fill: "none", stroke: "ink-accent", lineWidth: 2 });
  });

  it("draws nothing for an index outside the axis, which ECharts would place in a margin or off the box", () => {
    // The frame runs from x 52 to 584: band 12's centre (552) is inside, band 13's (592) and band -1's (32) are not.
    expect(draw(env(), 12)).not.toBeNull();
    for (const i of [-1, 13, 25, NaN]) expect(draw(env(), i)).toBeNull();
  });
});

describe("lineSeries", () => {
  type Item = { value: number; symbol: string; symbolSize: number; itemStyle: Record<string, unknown> };
  const dots = (i: number) => (i === 2 ? "solid" as const : i === 4 ? "hollow" as const : undefined);
  const line = (e = env()) => lineSeries(e, { id: "rate", data: [.1, null, .3, .2, .05], color: "var(--critical)", dots, ...trackAxes(1) });

  it("is a silent line on its axes, broken at a null, not clipped, with no symbol but on the points named", () => {
    expect(line()).toMatchObject({
      type: "line", id: "rate", xAxisIndex: 2, yAxisIndex: 2, symbol: "none", showAllSymbol: true, connectNulls: false, clip: false, silent: true,
    });
  });

  it("draws in the color env.color resolves", () => {
    expect(line().lineStyle).toMatchObject({ color: "resolved(var(--critical))", width: 1.75 });
  });

  it("keeps each null, and sets a symbol only on the points dots names", () => {
    const d = line().data as (number | null | Item)[];
    expect([d[0], d[1], d[3]]).toEqual([.1, null, .2]);
    expect(d[2]).toMatchObject({ value: .3, symbol: "circle" });
    expect(d[4]).toMatchObject({ value: .05, symbol: "circle" });
    // No dot on a point with no value.
    expect(lineSeries(env(), { id: "r", data: [null], color: "x", dots: () => "hollow", ...trackAxes(0) }).data).toEqual([null]);
  });

  it("swaps a solid dot's fill and ring for a hollow one", () => {
    const d = line().data as Item[];
    expect(d[2]).toMatchObject({ symbolSize: 5, itemStyle: { color: "resolved(var(--critical))", borderColor: "ink-surface", borderWidth: 1.5 } });
    expect(d[4]).toMatchObject({ symbolSize: 6, itemStyle: { color: "ink-surface", borderColor: "resolved(var(--critical))", borderWidth: 1.5 } });
  });

  it("is the text ink under forced colors, its hollow dot a surface centre in a text ring", () => {
    const l = line(env({ forced: true })), d = l.data as Item[];
    expect(l.lineStyle!.color).toBe("ink-text");
    expect(d[2]!.itemStyle).toMatchObject({ color: "ink-text", borderColor: "ink-surface" });
    expect(d[4]!.itemStyle).toMatchObject({ color: "ink-surface", borderColor: "ink-text" });
    expect(JSON.stringify(l)).not.toContain("critical");
  });
});

describe("sliderTrend", () => {
  it("is a line of the given values on the given axes that draws nothing", () => {
    const t = sliderTrend([3, 1, 4], trackAxes(0));
    expect(t).toMatchObject({ type: "line", id: "trend", xAxisIndex: 1, yAxisIndex: 1, data: [3, 1, 4], symbol: "none", showSymbol: false, silent: true });
    // Transparent too: ECharts writes the path, and with no color it would take one of its default palette's.
    expect(t.lineStyle).toEqual({ color: "transparent", opacity: 0 });
    expect(t.areaStyle).toBeUndefined();
  });

  it("is the slider's trend on the first track, before a line on the next; not after a line on its own track or under one on an earlier axis", () => {
    const layout = trackLayout(1, { ...WORK, slider: true });
    const axes = tracksOption(env(), { layout, labels: ["a", "b"], format: String, y: [valueAxis(env(), { max: 1, step: 1, format: String }), valueAxis(env(), { max: 1, step: 1, format: String })] });
    const rate = (t: number) => lineSeries(env(), { id: "rate", data: [0, 1], color: "x", ...trackAxes(t) });
    const trend = (t: number) => sliderTrend([1, 2], trackAxes(t));
    const drawsFrom = (series: unknown[]) => sliderShadowOf({ ...axes, series, dataZoom: [zoomSlider(env())] })?.id;
    expect(drawsFrom([trend(0), rate(1)])).toBe("trend"); // the work chart: the trend on the bars, the rate under them
    expect(drawsFrom([trend(1), rate(0)])).toBe("rate"); // listed first, on a later axis: the earlier axis's line wins
    expect(drawsFrom([rate(0), trend(0)])).toBe("rate");
  });
});
