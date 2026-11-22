import { beforeEach, describe, expect, it } from "vitest";
import type { SessionPoint } from "../../api";
import { color, setOrder } from "../../colors";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, SeriesOption } from "../../components/echart/echarts";
import type { OptionEnv } from "../../components/echart/option";
import type { Quad } from "./context";
import { dotAt, fitLines, logFraction, mapFit, mapModel, mapOption, quadAtPixel, startDomain, startTicks, type MapFit } from "./mapDots";
import { themeColors } from "./themeColors.testing";

const pt = (id: string, o: Partial<SessionPoint> = {}): SessionPoint =>
  ({ session_id: id, project: "foo", source: "claude", first_ts: "2026-11-04T10:00:00.000Z", start: 10_000, peak: 50_000, window: 200_000, turns: 8, compactions: 0, title: null, ...o });
const heavy = pt("heavy000001", { first_ts: "2026-11-05T10:00:00.000Z", start: 60_000, peak: 180_000 });
const over = pt("over0000002", { first_ts: "2026-11-03T10:00:00.000Z", start: 20_000, peak: 230_000, compactions: 2 });
const calm = pt("calm0000003", { first_ts: "2026-11-04T10:00:00.000Z", project: "bar", source: "codex" });
const points = [heavy, over, calm];

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<OptionEnv> = {}): OptionEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: true, ...over });
/** A text measure of 6px a character at the default size, whatever the weight. */
const measure = (s = 1) => (t: string) => t.length * 6 * s;
const fit = (pts: SessionPoint[] = points, width = 800, s = 1, m = measure(s)) => mapFit(mapModel(pts), width, s, m);
const at = (f: MapFit, id: string) => f.dots[f.model.points.findIndex(p => p.session_id === id)]!;

beforeEach(() => setOrder(["foo", "bar"]));

describe("log scale", () => {
  it("gives equal distances to equal ratios", () => {
    const d = startDomain([1_000, 100_000]);
    expect(d).toEqual([1_000, 100_000]);
    expect(logFraction(2_000, d) - logFraction(1_000, d)).toBeCloseTo(logFraction(20_000, d) - logFraction(10_000, d));
  });
  it("rounds the domain out, always spanning 30k, and ticks inside it", () => {
    expect(startDomain([4_000, 8_000])).toEqual([2_000, 50_000]);
    expect(startTicks([1_000, 20_000])).toEqual([1_000, 2_000, 5_000, 10_000, 20_000]);
  });
});

describe("fitLines", () => {
  it("wraps a quadrant's name to the room beside the 30k line", () => {
    const est = (t: string) => t.length * 11 * .62;
    expect(fitLines("Grew full", 200, 11, est)).toEqual({ lines: ["Grew full"], fs: 11 });
    expect(fitLines("Grew full", 40, 11, est)).toEqual({ lines: ["Grew", "full"], fs: 11 });
    expect(fitLines("Heavy and full", 50, 11, est).lines).toEqual(["Heavy", "and", "full"]);
    const tight = fitLines("Heavy and full", 30, 11, est);
    expect(tight.fs).toBeLessThan(11);
    expect(tight.fs).toBeGreaterThanOrEqual(11 * .8);
  });
});

describe("mapFit", () => {
  it("puts a 60k start peaking at 90% right of the 30k line and above the 80% line", () => {
    const f = fit();
    expect(f.model.points.map(p => p.session_id)).toEqual(["over0000002", "calm0000003", "heavy000001"]);
    expect(f.model.counts).toEqual({ lean: 1, heavy: 0, full: 1, both: 1 });
    expect(at(f, "heavy000001").x).toBeGreaterThan(f.x30);
    expect(at(f, "heavy000001").y).toBeLessThan(f.y80);
    expect(at(f, "calm0000003").x).toBeLessThan(f.x30);
    expect(at(f, "calm0000003").y).toBeGreaterThan(f.y80);
  });

  it("draws a peak over its window at 100%", () => {
    expect(at(fit(), "over0000002").y).toBe(fit().plot.y);
  });

  it("keeps the plot 260px high as the text grows, and the margins grow with it", () => {
    expect([fit().height, fit().plot]).toEqual([320, { x: 52, y: 14, width: 732, height: 260 }]);
    expect([fit(points, 800, 2).height, fit(points, 800, 2).plot]).toEqual([380, { x: 104, y: 28, width: 664, height: 260 }]);
    expect([fit().yTitle, fit(points, 800, 2).yTitle]).toEqual(["Peak share of the window", "Peak share"]);
  });

  it("wraps a name to its room by the measure, and moves the 80% label right of the 30k line in a narrow plot", () => {
    const f = fit(points, 800, 1, t => t.length * 30); // the room right of the 30k line is 371px
    expect(f.names.both).toMatchObject({ lines: ["Heavy and", "full"], size: 11, align: "right", x: 784 - 6 });
    expect(f.names.lean).toMatchObject({ lines: ["Lean"], align: "left", x: 52 + 6, verticalAlign: "bottom" });
    const wide = [pt("a", { start: 20_000 }), pt("b", { start: 200_000 })];
    const w = fit(wide), n = fit(wide, 343);
    expect(w.nearLabel).toMatchObject({ x: w.x30 - 4, align: "right" });
    expect(n.nearLabel).toMatchObject({ x: n.x30 + 4, align: "left" });
  });
});

describe("dotAt and quadAtPixel", () => {
  it("reads the nearest dot within 12px", () => {
    const f = fit(), i = f.model.points.findIndex(p => p.session_id === "calm0000003"), d = f.dots[i]!;
    expect(dotAt(f, d.x, d.y)).toBe(i);
    expect(dotAt(f, d.x + 12, d.y)).toBe(i);
    expect(dotAt(f, d.x + 13, d.y)).toBeNull();
    const two = fit([pt("a", { start: 10_000 }), pt("b", { start: 10_200, first_ts: "2026-11-05T10:00:00.000Z" })]);
    const [a, b] = two.dots as [{ x: number; y: number }, { x: number; y: number }];
    expect(b.x - a.x).toBeGreaterThan(6);
    expect(dotAt(two, a.x + (b.x - a.x) / 3, a.y)).toBe(0);
    expect(dotAt(two, b.x - (b.x - a.x) / 3, a.y)).toBe(1);
    expect(dotAt(two, (a.x + b.x) / 2, a.y)).toBe(1); // a tie: the newer
  });

  it("reads the quadrant under each corner of the plot, and none outside it", () => {
    const f = fit(), { x, y, width, height } = f.plot;
    expect(quadAtPixel(f, x + 1, y + 1)).toBe("full");
    expect(quadAtPixel(f, x + width - 1, y + 1)).toBe("both");
    expect(quadAtPixel(f, x + 1, y + height - 1)).toBe("lean");
    expect(quadAtPixel(f, x + width - 1, y + height - 1)).toBe("heavy");
    expect(quadAtPixel(f, x - 1, y + 1)).toBeNull();
  });
});

// renderItem with a stubbed API that places a value as the fit does.
interface El { type: string; shape: Record<string, number>; style: Record<string, unknown> }
const seriesOf = (o: ReturnType<typeof mapOption>, id: string) => (o.series as SeriesOption[]).find(s => s.id === id) as CustomSeriesOption;
/** The item's children, or the item when it has none. */
function draw(f: MapFit, s: CustomSeriesOption, row: number): El[] {
  const data = (s.data as number[][])[row]!, { plot } = f;
  const api = {
    value: (d: number) => data[d]!,
    coord: ([v, share]: number[]) => [plot.x + logFraction(v!, f.model.domain) * plot.width, plot.y + plot.height * (1 - share!)],
  } as unknown as CustomSeriesRenderItemAPI;
  const el = s.renderItem!({ coordSys: plot } as unknown as CustomSeriesRenderItemParams, api) as unknown as El & { children?: El[] };
  return el.children ?? [el];
}
const option = (f: MapFit, quad: Quad | null, e = env()) => mapOption(f, e, { quad, color });

describe("mapOption", () => {
  it("puts the grid where the fit puts the plot, and labels the log axis at 1, 2 and 5", () => {
    const f = fit(), o = option(f, null);
    expect(o.grid).toEqual({ left: 52, top: 14, width: 732, height: 260, outerBoundsMode: "none" });
    expect(o.animation).toBe(false);
    const x = o.xAxis as { type: string; min: number; max: number; axisLabel: { customValues: number[]; formatter: (v: number) => string }; axisTick: { customValues: number[] } };
    expect(x).toMatchObject({ type: "log", min: 10_000, max: 100_000 });
    expect(x.axisLabel.customValues).toEqual([10_000, 20_000, 50_000, 100_000]);
    expect(x.axisTick.customValues).toEqual(x.axisLabel.customValues);
    expect(x.axisLabel.formatter(20_000)).toBe("20k");
    expect(o.yAxis).toMatchObject({ max: 1, interval: .2, name: "Peak share of the window", nameLocation: "middle", nameMoveOverlap: false });
  });

  it("rings a compacted session only, and dims the sessions outside the selected quadrant", () => {
    const f = fit(), dots = seriesOf(option(f, "full"), "dots"), row = (id: string) => f.model.points.findIndex(p => p.session_id === id);
    const [ring, dot] = draw(f, dots, row("over0000002")), { x, y } = at(f, "over0000002"), foo = color("foo");
    expect(ring).toMatchObject({ type: "circle", shape: { cx: x, cy: y, r: 7.5 }, style: { fill: "none", stroke: foo, lineWidth: 1.5, opacity: 1 } });
    expect(dot).toMatchObject({ type: "circle", shape: { cx: x, cy: y, r: 4 }, style: { fill: foo, fillOpacity: .75, stroke: "ink-surface", lineWidth: 1, opacity: 1 } });
    const calmDots = draw(f, dots, row("calm0000003"));
    expect(calmDots).toHaveLength(1);
    expect(calmDots[0]!.style.opacity).toBe(.2);
    const names = draw(f, seriesOf(option(f, "full"), "guides"), 0).filter(e => e.type === "text").slice(2);
    expect(names.map(n => [n.style.text, n.style.fill])).toEqual([["Lean", "ink-muted"], ["Heavy start", "ink-muted"], ["Grew full", "ink-text"], ["Heavy and full", "ink-muted"]]);
  });

  it("frames the selected quadrant and edges the dots and rings in the text color in forced colors", () => {
    const f = fit(), wash = (e: OptionEnv) => draw(f, seriesOf(option(f, "both", e), "wash"), 0)[0]!;
    expect(seriesOf(option(f, null), "wash")).toBeUndefined();
    expect(wash(env())).toMatchObject({ type: "rect", shape: { x: f.x30, y: f.plot.y }, style: { fill: "var(--surface-2)" } });
    expect(wash(env({ forced: true })).style).toEqual({ fill: "none", stroke: "ink-accent", lineWidth: 2 });
    expect([seriesOf(option(f, "both"), "wash").z, seriesOf(option(f, "both", env({ forced: true })), "wash").z]).toEqual([-1, 1]);
    const [ring, dot] = draw(f, seriesOf(option(f, null, env({ forced: true })), "dots"), 0);
    expect([ring!.style.stroke, dot!.style.stroke, dot!.style.fill]).toEqual(["ink-text", "ink-text", color("foo")]);
  });
});

describe("the session map's colors", () => {
  it("hands env.color only declared color tokens", () => {
    setOrder(["foo"]);
    const seen = new Set<string>(), declared = themeColors(), recording = env({ color: s => { seen.add(s); return s; } }), f = fit();
    const o = option(f, "lean", recording);
    draw(f, seriesOf(o, "wash"), 0);
    f.model.points.forEach((_, i) => draw(f, seriesOf(o, "dots"), i));
    for (const css of ["var(--surface-2)", color("foo"), "var(--proj-other)"]) expect(seen).toContain(css);
    for (const css of seen) expect(declared, `${css} is not a color token of theme.css`).toContain(css);
  });
});
