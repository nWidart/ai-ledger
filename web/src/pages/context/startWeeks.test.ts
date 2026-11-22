import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CustomSeriesOption, SeriesOption } from "../../components/echart/echarts";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayLabel } from "../../format";
import { weeksLayout, weeksModel, weeksOption, type WeeksModel } from "./startWeeks";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 180, ...over });

const wk = (week: string, median: number, p25: number, p75: number, sessions = 9) => ({ week, median, p25, p75, sessions });
// Nov 2 and Nov 16 with Nov 9 empty, then Nov 23 right after Nov 16 (2 sessions).
const trend = [wk("2026-11-02", 24_000, 20_000, 31_000), wk("2026-11-16", 20_000, 16_000, 26_000, 2), wk("2026-11-23", 26_000, 21_000, 28_000)];
// Low starts: the axis stops short of 30k.
const low = [wk("2026-11-02", 6_000, 4_000, 10_000), wk("2026-11-09", 7_000, 5_000, 9_000)];

const series = (m: WeeksModel, e = env()) => weeksOption(m, e).series as SeriesOption[];
const byId = (m: WeeksModel, id: string, e = env()) => series(m, e).find(s => s.id === id);
type Y = { min: number; max: number; interval: number; axisLabel: { formatter: (v: number) => string } };

describe("weeksModel", () => {
  it("puts the weeks in calendar slots 7 days apart, an empty week as null", () => {
    const m = weeksModel(trend);
    expect(m.slots).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(m.weeks.map(w => w?.week ?? null)).toEqual(["2026-11-02", null, "2026-11-16", "2026-11-23"]);
    expect(m.median).toEqual([24_000, null, 20_000, 26_000]);
    expect(m.p25).toEqual([20_000, null, 16_000, 21_000]);
    expect(m.p75).toEqual([31_000, null, 26_000, 28_000]);
    expect(m.few).toEqual([false, false, true, false]);
  });

  it("scales y to the highest median or 75th percentile plus 8%, in round steps of a third", () => {
    // 31,000 × 1.08 = 33,480: steps of 20k (a third is 11,160), up to 40k, which reaches 30k.
    expect(weeksModel(trend)).toMatchObject({ max: 40_000, step: 20_000, large: true });
    // 10,000 × 1.08 = 10,800: steps of 5k, up to 15k.
    expect(weeksModel(low)).toMatchObject({ max: 15_000, step: 5_000, large: false });
    const y = weeksOption(weeksModel(low), env()).yAxis as Y;
    expect([y.min, y.max, y.interval]).toEqual([0, 15_000, 5_000]);
    expect([0, 5_000, 10_000, 15_000].map(y.axisLabel.formatter)).toEqual(["0", "5k", "10k", "15k"]);
  });

  it("holds no slot for no week", () => {
    expect(weeksModel([])).toMatchObject({ slots: [], weeks: [], median: [], large: false });
  });
});

describe("weeksLayout", () => {
  it("keeps the plot 144px and grows the margins with the text", () => {
    expect(weeksLayout(1)).toMatchObject({ height: 180, left: 52, right: 14, tracks: [{ top: 10, height: 144 }] });
    expect(weeksLayout(2)).toMatchObject({ height: 216, left: 104, right: 28, tracks: [{ top: 20, height: 144 }] });
  });
});

describe("weeksOption", () => {
  it("draws one grid placed by the layout over the week slots, labelled by day", () => {
    const m = weeksModel(trend), o = weeksOption(m, env({ textScale: 2 }));
    expect(o.grid).toEqual({ left: 104, right: 28, top: 20, height: 144, outerBoundsMode: "none" });
    const x = o.xAxis as { data: string[]; axisLabel: { formatter: (v: string) => string } };
    expect(x.data).toEqual(m.slots);
    expect(x.axisLabel.formatter("2026-11-02")).toBe(dayLabel("2026-11-02"));
  });

  it("puts null on the empty week in every series and breaks the band there", () => {
    const m = weeksModel(trend);
    expect(series(m).map(s => s.id)).toEqual(["band", "large", "halo", "median", "dots"]);
    for (const id of ["halo", "median"]) expect((byId(m, id)!.data as unknown[])[1]).toBeNull();
    // The band's runs: Nov 2 alone, then Nov 16 to Nov 23.
    expect(byId(m, "band")!.data).toEqual([[0, 0, 0], [2, 0, 3]]);
    // Dots stand on the weeks with a session only.
    expect(((byId(m, "dots") as CustomSeriesOption).data as number[][]).map(d => d[0])).toEqual([0, 2, 3]);
  });

  it("draws the median in the text color on a halo of the surface, the band in the secondary ink", () => {
    const m = weeksModel(trend);
    expect(byId(m, "halo")).toMatchObject({ type: "line", lineStyle: { color: "ink-surface", width: 4.5 } });
    expect(byId(m, "median")).toMatchObject({ type: "line", lineStyle: { color: "var(--text-primary)" } });
    expect(byId(m, "median", env({ forced: true }))).toMatchObject({ lineStyle: { color: "ink-text" } });
    expect(byId(m, "band")).toMatchObject({ type: "custom", z: 1 });
  });

  it("rings a week of few sessions", () => {
    const dots = byId(weeksModel(trend), "dots") as CustomSeriesOption;
    expect((dots.data as number[][]).map(d => d[2])).toEqual([0, 1, 0]); // Nov 16, of 2 sessions
  });

  it("draws the 30k line only when the axis reaches it", () => {
    expect(byId(weeksModel(trend), "large")).toMatchObject({ type: "custom", data: [[0, 30_000]] });
    expect(byId(weeksModel(low), "large")).toBeUndefined();
  });
});

// The colors the option hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that
// is not a color resolves to the inherited text color, with no error (foundation, decision 4). As in rateTracks.test.ts.
describe("the weekly start chart's colors", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const themeCss = strip(readFileSync("src/theme.css", "utf8")); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

  it("hands env.color only declared color tokens", () => {
    const seen = new Set<string>();
    const recording = env({ color: s => { seen.add(s); return s; } });
    for (const t of [trend, low]) weeksOption(weeksModel(t), recording);
    expect(seen.size).toBeGreaterThan(0);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.has(m![1]!), `${m![1]} is not declared in theme.css`).toBe(true);
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb()`).toMatch(COLOR);
    }
  });
});
