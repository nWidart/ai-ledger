import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { CacheBucket, ContextPayload } from "../../api";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, SeriesOption, YAXisComponentOption } from "../../components/echart/echarts";
import { sliderShadowOf } from "../../components/echart/testing";
import type { ChartEnv } from "../../components/echart/tokens";
import { cacheLayout, cacheModel, cacheOption, cacheZoomWords, ratioFloor, type CacheModel } from "./cacheTracks";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 364, ...over });

type Series = ContextPayload["cost"]["series"];
const b = (day: string, o: Partial<CacheBucket> = {}): CacheBucket => ({ day, input: 0, cache_read: 0, cache_write: 0, model_switch: 0, expired: 0, other: 0, ...o });
/** A day's waste: 900k read from the cache, 60k written to it and 40k sent uncached, a 90% cache-hit ratio. */
const DAY = { cache_read: 900_000, cache_write: 60_000, input: 40_000 };
// Nov 1, no request on Nov 2, Nov 3: 100k and 5k of waste, 1M and 50k of prompt tokens, both at 90%, 3 and 4 breaks.
const gap: Series = { bucket: "day", rows: [b("2026-11-01", { ...DAY, model_switch: 2, expired: 1 }), b("2026-11-03", { input: 5_000, cache_read: 45_000, other: 4 })] };
/** `n` buckets from `first`, a day or a week apart, each with some uncached input. */
const run = (first: string, n: number, bucket: "day" | "week" = "day"): Series => ({
  bucket, rows: Array.from({ length: n }, (_, i) => b(new Date(+new Date(first + "T00:00:00Z") + i * (bucket === "week" ? 7 : 1) * 864e5).toISOString().slice(0, 10), { input: 10 })),
});

const ids = (o: ReturnType<typeof cacheOption>) => (o.series as SeriesOption[]).map(s => s.id);
const byId = (m: CacheModel, id: string, e = env()) => (cacheOption(m, e).series as SeriesOption[]).find(s => s.id === id);
const yAxes = (m: CacheModel, e = env()) => cacheOption(m, e).yAxis as (YAXisComponentOption & { min: number; max: number; interval: number; name: string; axisLabel: { show?: boolean; formatter: (v: number) => string } })[];

// renderItem with a stubbed API over three slots of 100px: y is px up from the plot's bottom at 200px, one per 10k tokens.
interface El { type: string; name?: string; shape: Record<string, unknown>; style: Record<string, unknown>; children: El[] }
function draw(s: SeriesOption | undefined, row: number) {
  const c = s as CustomSeriesOption, data = (c.data as number[][])[row]!;
  const api = {
    value: (d: number) => data[d]!,
    coord: ([x, v]: number[]) => [100 * x! + 50, 200 - v! / 1e4],
    size: ([dx]: number[]) => [100 * dx!, 0],
  } as unknown as CustomSeriesRenderItemAPI;
  return c.renderItem!({ coordSys: { x: 0, y: 0, width: 300, height: 200 } } as unknown as CustomSeriesRenderItemParams, api) as unknown as El | null;
}

describe("cacheModel", () => {
  it("draws the uncached input and the cache writes, the cache reads on top on request, nothing on an empty slot", () => {
    const off = cacheModel(gap, false), on = cacheModel(gap, true);
    expect(off.slots.map(s => [s.day, s.row == null])).toEqual([["2026-11-01", false], ["2026-11-02", true], ["2026-11-03", false]]);
    expect(off.kinds).toEqual([{ k: "input", c: "var(--accent)" }, { k: "cache_write", c: "var(--series-1)" }]);
    expect(off.values).toEqual([[40_000, 60_000], [0, 0], [5_000, 0]]);
    expect(off.totals).toEqual([100_000, 0, 5_000]);
    expect(on.kinds.at(-1)).toEqual({ k: "cache_read", c: "var(--track)" });
    expect(on.values).toEqual([[40_000, 60_000, 900_000], [0, 0, 0], [5_000, 0, 45_000]]);
    expect(on.totals).toEqual([1_000_000, 0, 50_000]);
  });

  it("scales the bars to the waste, or to the prompt tokens with the reads, and the breaks to the busiest slot", () => {
    // 100k plus 8% in nice steps; 1M likewise.
    expect(cacheModel(gap, false).scale).toEqual({ max: 150_000, step: 50_000 });
    expect(cacheModel(gap, true).scale).toEqual({ max: 1_500_000, step: 500_000 });
    const m = cacheModel(gap, false), [, bars, breaks] = yAxes(m);
    expect([bars!.max, bars!.interval, bars!.axisLabel.formatter(50_000)]).toEqual([150_000, 50_000, "50k"]);
    expect(m.breakKinds.map(k => k.c)).toEqual(["var(--cache-switch)", "var(--cache-expired)", "var(--text-muted)"]);
    expect(m.breaks).toEqual([[2, 1, 0], [0, 0, 0], [0, 0, 4]]);
    expect([breaks!.max, breaks!.interval, breaks!.axisLabel.show]).toEqual([4, 4, false]);
  });

  it("starts the ratio track at 90%, or lower at the lowest ratio's tenth", () => {
    expect(ratioFloor([.93, .97])).toBe(.9);
    expect(ratioFloor([.62, .97])).toBe(.6);
    expect(ratioFloor([0])).toBe(0);
    const m = cacheModel(gap, false), ratio = yAxes(m)[3]!;
    expect(m.ratios).toEqual([.9, null, .9]);
    expect([ratio.min, ratio.max, ratio.interval]).toEqual([.9, 1, .1]);
    expect([.9, 1].map(ratio.axisLabel.formatter)).toEqual(["90%", "100%"]);
    expect(yAxes(cacheModel({ bucket: "day", rows: [b("2026-11-01", { input: 38, cache_read: 62 })] }, false))[3]).toMatchObject({ min: .6, interval: .4 });
  });

  it("leaves an empty slot empty on every track", () => {
    const m = cacheModel(gap, true);
    expect(draw(byId(m, "stack"), 1)).toBeNull();
    expect(draw(byId(m, "reads-edge"), 1)).toBeNull();
    expect(draw(byId(m, "breaks"), 1)).toBeNull();
    expect((byId(m, "ratio") as { data: unknown[] }).data[1]).toBeNull();
    expect((byId(m, "ratio-dots") as CustomSeriesOption).data).toEqual([[0, .9, 0], [2, .9, 0]]);
  });

  it("titles each track with its figures: the total drawn, the busiest slot's breaks, the view's ratio", () => {
    expect(cacheModel(gap, false).titles).toEqual({
      bars: { title: "Tokens not read from the cache", figures: ["105k in this view", "105k"] },
      breaks: { title: "Cache breaks", figures: ["most in a day: 4", "most: 4"] },
      ratio: { title: "Cache-hit ratio", figures: ["90% in this view", "90%"] },
    });
    expect(cacheModel(gap, true).titles.bars).toEqual({ title: "Prompt tokens", figures: ["1.1M in this view", "1.1M"] });
    const calm = cacheModel({ bucket: "week", rows: [b("2026-11-02", { input: 10 })] }, false).titles;
    expect(calm.breaks.figures).toEqual(["none in this view", "none"]);
    expect(cacheModel({ bucket: "day", rows: [b("2026-11-01", { expired: 1 })] }, false).titles.ratio.figures).toEqual([]);
    expect(cacheModel({ bucket: "week", rows: [b("2026-11-02", { other: 2 })] }, false).titles.breaks.figures[0]).toBe("most in a week: 2");
  });

  it("zooms from 14 slots", () => {
    expect(cacheModel(run("2026-11-01", 13), false).zoom).toBe(false);
    expect(cacheModel(run("2026-11-01", 14), false).zoom).toBe(true);
    expect(cacheModel(run("2026-11-01", 14), false).week).toBe(false);
    expect(cacheModel(run("2026-11-02", 2, "week"), false).week).toBe(true);
  });
});

describe("cacheLayout", () => {
  it("holds 364px with the three tracks fixed, 392px with the slider, 456px at twice the text", () => {
    const m = cacheModel(gap, false), l = cacheLayout(m, 1);
    expect([l.height, l.left, l.right]).toEqual([364, 52, 8]);
    expect(l.tracks).toEqual([{ top: 20, height: 180 }, { top: 224, height: 48 }, { top: 296, height: 44 }]);
    expect(cacheLayout(cacheModel(run("2026-11-01", 14), false), 1).height).toBe(392);
    expect(cacheLayout(m, 2).height).toBe(456);
    expect(cacheLayout(m, 2).tracks.map(t => t.height)).toEqual([180, 48, 44]);
  });
});

describe("cacheOption", () => {
  it("lists the trend first, on the ratio track, then the bars, the breaks, the ratio line, its dots and the slider", () => {
    const z = cacheModel(run("2026-11-01", 14), false), o = cacheOption(z, env());
    expect(ids(o)).toEqual(["trend", "stack", "breaks", "ratio", "ratio-dots"]);
    expect(byId(z, "trend")).toMatchObject({ xAxisIndex: 3, yAxisIndex: 3, data: z.totals });
    expect(sliderShadowOf(o)).toBe((o.series as SeriesOption[])[0]);
    expect([byId(z, "stack"), byId(z, "breaks"), byId(z, "ratio")].map(s => s!.xAxisIndex)).toEqual([1, 2, 3]);
    expect(o.dataZoom).toEqual([expect.objectContaining({ xAxisIndex: "all", left: 52, right: 8 })]);
    expect(ids(cacheOption(cacheModel(gap, false), env()))).toEqual(["stack", "breaks", "ratio", "ratio-dots"]);
    expect(cacheOption(cacheModel(gap, false), env()).dataZoom).toBeUndefined();
  });

  it("frames each cache-read part in 1px of the muted ink, only with the reads on, and not in forced colors", () => {
    const m = cacheModel(gap, true);
    expect(ids(cacheOption(m, env()))).toEqual(["stack", "reads-edge", "breaks", "ratio", "ratio-dots"]);
    expect(byId(m, "reads-edge", env({ forced: true }))).toBeUndefined();
    expect(byId(cacheModel(gap, false), "reads-edge")).toBeUndefined();
    const part = draw(byId(m, "stack"), 0)!.children.find(c => c.name === "cache_read")!, edge = draw(byId(m, "reads-edge"), 0)!.children[0]!;
    const { x, y, width, height } = part.shape as { x: number; y: number; width: number; height: number };
    expect(edge.shape).toEqual({ x: x + .5, y: y + .5, width: width - 1, height: height - 1, r: part.shape.r });
    expect(edge.style).toEqual({ fill: "none", stroke: "ink-muted", lineWidth: 1 });
  });

  it("gives each title its long form, its short form or none, as the plot holds them", () => {
    // A canvas whose text is 4px a character: 130px of plot holds "Cache breaks · most in a day: 4" (124px), "Cache-hit
    // ratio · 90%" (84px) and "Tokens not read from the cache" (120px), not with "· 105k" (148px).
    const m = cacheModel(gap, false), names = (e: ChartEnv) => yAxes(m, e).slice(1).map(a => a.name);
    expect(names(env())).toEqual(["Tokens not read from the cache · 105k in this view", "Cache breaks · most in a day: 4", "Cache-hit ratio · 90% in this view"]);
    const measure = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ font: "", measureText: (t: string) => ({ width: t.length * 4 }) } as unknown as CanvasRenderingContext2D);
    expect(names(env({ width: 190 }))).toEqual(["Tokens not read from the cache", "Cache breaks · most in a day: 4", "Cache-hit ratio · 90%"]);
    measure.mockRestore();
  });
});

describe("cacheZoomWords", () => {
  it("counts the days or weeks shown, an empty slot as its day", () => {
    const days = cacheModel(run("2026-10-01", 30), false);
    expect(cacheZoomWords(days, { from: 10, to: 19 })).toBe("Showing Oct 11 to Oct 20, 10 of 30 days.");
    expect(cacheZoomWords(days, null)).toBe("Showing all 30 days.");
    const weeks = cacheModel(run("2026-10-05", 20, "week"), false);
    expect(cacheZoomWords(weeks, { from: 0, to: 5 })).toBe("Showing the weeks of Oct 5 to Nov 9, 6 of 20 weeks.");
    expect(cacheZoomWords(weeks, null)).toBe("Showing all 20 weeks.");
    expect(cacheZoomWords(cacheModel(gap, false), { from: 1, to: 2 })).toBe("Showing Nov 2 to Nov 3, 2 of 3 days.");
  });
});

// The colors the chart hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that
// is not a color resolves to the inherited text color, with no error. As in rateTracks.test.ts.
describe("the cache chart's colors", () => {
  const themeCss = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

  it("hands env.color only declared color tokens, with the reads off and on", () => {
    const seen = new Set<string>(), recording = env({ color: s => { seen.add(s); return s; } });
    for (const reads of [false, true]) cacheOption(cacheModel(gap, reads), recording);
    for (const t of ["--accent", "--series-1", "--track", "--cache-switch", "--cache-expired", "--text-muted", "--text-primary"]) expect(seen).toContain(`var(${t})`);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb() in theme.css`).toMatch(COLOR);
    }
  });
});
