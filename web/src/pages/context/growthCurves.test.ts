import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { GrowthPoint } from "../../api";
import type {
  CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, LineSeriesOption, SeriesOption, XAXisComponentOption, YAXisComponentOption,
} from "../../components/echart/echarts";
import type { ChartEnv } from "../../components/echart/tokens";
import { growthLayout, growthModel, growthOption, type GrowthModel } from "./growthCurves";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 302, ...over });
const color = (p: string | null) => (p === "foo" ? "var(--proj-1)" : p === "bar" ? "var(--proj-2)" : "var(--proj-other)");

const pt = (turn: number, median: number, sessions = 9): GrowthPoint => ({ turn, median, p25: median * .7, p75: median * 1.4, sessions });
const view = [1, 2, 3, 4, 5].map(t => pt(t, 20_000 + t * 10_000));
const shareView = [1, 2, 3, 4].map(t => ({ ...pt(t, .1 + t * .1, 7), p75: (.1 + t * .1) * 1.3 }));
const foo = { project: "foo", sessions: 6, curve: view.map(p => ({ ...p, median: p.median * 1.2 })), share_curve: shareView.map(p => ({ ...p, median: p.median * 1.1 })) };
const bar = { project: "bar", sessions: 5, curve: view.slice(0, 3).map(p => ({ ...p, median: p.median * .6 })), share_curve: [] };
// 83 turns, 99 sessions at turn 1 down to 17 at turn 83.
const long = Array.from({ length: 83 }, (_, i) => pt(i + 1, 10_000 + i * 1000, 99 - i));

const model = (o: { mode?: "tokens" | "share"; isolated?: string | null; curve?: GrowthPoint[] } = {}) =>
  growthModel(o.curve ?? view, [foo, bar], shareView, o.mode ?? "tokens", o.isolated ?? null, color);
const series = (m: GrowthModel, e = env()) => growthOption(m, e).series as SeriesOption[];
const byId = (m: GrowthModel, id: string, e = env()) => series(m, e).find(s => s.id === id);
const yAxes = (m: GrowthModel, e = env()) => growthOption(m, e).yAxis as (YAXisComponentOption & { max: number; interval: number; name: string; axisLabel: { show?: boolean; formatter: (v: number) => string } })[];

describe("growthModel", () => {
  it("makes a slot of each turn, labelling turn 1 and the round turns", () => {
    const m = model({ curve: long });
    expect(m.labels).toEqual(long.map(p => String(p.turn)));
    expect(m.labelled.flatMap((on, i) => (on ? [i + 1] : []))).toEqual([1, 20, 40, 60, 80]);
    // The frame's labels follow the rule; tracksOption adds the last turn.
    const frame = (growthOption(m, env()).xAxis as XAXisComponentOption[])[0]!;
    const interval = frame.axisLabel!.interval as (i: number, label: string) => boolean;
    expect(long.map((_, i) => i).filter(i => interval(i, String(i + 1))).map(i => i + 1)).toEqual([1, 20, 40, 60, 80]);
    expect(frame.axisLabel).toMatchObject({ showMaxLabel: true, alignMaxLabel: "right" });
  });

  it("scales tokens to the highest drawn value, and the share of the window with 80% inside", () => {
    // The view's 75th percentile at turn 5, 98k, plus 6%: in steps of 50k.
    expect(model().y).toEqual({ max: 150_000, step: 50_000 });
    expect(yAxes(model())[1]!.axisLabel.formatter(50_000)).toBe("50k");
    // The highest share drawn is 65%, under the 80% line: the line sets the top.
    const s = model({ mode: "share" });
    expect(s.share).toBe(true);
    expect(s.y).toEqual({ max: 1, step: .5 });
    expect(s.y.max).toBeGreaterThan(.8);
    expect(yAxes(s)[1]!.axisLabel.formatter(.5)).toBe("50%");
    // With a project isolated the view's band leaves the scale: the view's median and bar's band, 70k, set it.
    expect(model({ isolated: "bar" }).y).toEqual({ max: 80_000, step: 20_000 });
    // Share without a share curve draws tokens.
    expect(growthModel(view, [foo], [], "share", null, color).share).toBe(false);
  });

  it("gives the band to the view, or to the isolated project in its color", () => {
    const m = model();
    expect(m.band.owner).toBeNull();
    expect([m.band.lo, m.band.hi]).toEqual([view.map(p => p.p25), view.map(p => p.p75)]);
    expect(byId(m, "band")).toMatchObject({ type: "custom", xAxisIndex: 1, yAxisIndex: 1 });
    const draw = (s: SeriesOption | undefined) => drawItem(s, 0, view.length);
    expect(draw(byId(m, "band")).style).toMatchObject({ fill: "ink-secondary", opacity: .16 });
    const b = model({ isolated: "bar" });
    expect(b.band.owner).toBe(b.isolated);
    expect(b.band.lo).toEqual([...bar.curve.map(p => p.p25), null, null]);
    expect(draw(byId(b, "band")).style).toMatchObject({ fill: "var(--proj-2)", opacity: .18 });
  });

  it("draws one line per project, null past its last turn, thicker isolated, in its color on a halo in forced colors", () => {
    const m = model();
    expect(m.legend.map(p => p.project)).toEqual(["foo", "bar"]);
    expect(m.projects.map(p => p.median)).toEqual([foo.curve.map(p => p.median), [...bar.curve.map(p => p.median), null, null]]);
    const line = (mm: GrowthModel, e = env()) => byId(mm, "project:bar", e) as LineSeriesOption;
    expect(line(m)).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1, data: m.projects[1]!.median, lineStyle: { color: "var(--proj-2)", width: 1.5 } });
    const only = model({ isolated: "bar" });
    expect(only.projects.map(p => p.project)).toEqual(["bar"]);
    expect(line(only).lineStyle!.width).toBe(3);
    expect(byId(only, "project:foo")).toBeUndefined();
    // Forced colors: the project keeps its color, over a 4.5px page-colored halo; the median is the text ink.
    const forced = env({ forced: true });
    expect(line(m, forced).lineStyle!.color).toBe("var(--proj-2)");
    expect(byId(m, "project-halo:bar")).toBeUndefined();
    const ids = series(m, forced).map(s => s.id);
    expect(ids.indexOf("project-halo:bar")).toBe(ids.indexOf("project:bar") - 1);
    expect(byId(m, "project-halo:bar", forced)).toMatchObject({ lineStyle: { color: "ink-surface", width: 4.5 } });
    expect(byId(m, "median", forced)).toMatchObject({ lineStyle: { color: "ink-text" } });
    // A share curve that no project has: only foo's line.
    expect(model({ mode: "share" }).projects.map(p => p.project)).toEqual(["foo"]);
  });

  it("draws the 80% line in share mode only, between the band and the lines", () => {
    expect(series(model()).map(s => s.id)).toEqual(["band", "project:foo", "project:bar", "median-halo", "median", "median-dots", "strip"]);
    const s = model({ mode: "share" });
    expect(series(s).map(x => x.id)).toEqual(["band", "limit", "project:foo", "median-halo", "median", "median-dots", "strip"]);
    expect(byId(s, "limit")).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1, data: [[0, .8]] });
    expect(byId(model(), "median-halo")).toMatchObject({ data: view.map(p => p.median), lineStyle: { color: "ink-surface", width: 4.5 } });
  });

  it("strips the sessions still running under the curve, its bars 10px at most, its title shortened to fit", () => {
    const m = model({ curve: long });
    expect(m.strip.values).toEqual(long.map(p => p.sessions));
    expect(m.strip.top).toBe(99);
    expect(byId(m, "strip")).toMatchObject({ xAxisIndex: 2, yAxisIndex: 2 });
    const width = (band: number) => (drawItem(byId(m, "strip"), 0, long.length, band * long.length) as unknown as { children: El[] }).children[0]!.shape.width;
    expect(width(20)).toBe(10);
    expect(width(10)).toBeCloseTo(7);
    const strip = yAxes(m)[2]!;
    expect(strip).toMatchObject({ max: 99, axisLabel: { show: false } });
    // A canvas whose text is 4px a character: the long form fits 734px, the short 234px, the title alone 154px.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ font: "", measureText: (t: string) => ({ width: t.length * 4 }) } as unknown as CanvasRenderingContext2D);
    const name = (width: number) => yAxes(m, env({ width }))[2]!.name;
    expect(name(800)).toBe("Sessions still running at each turn · 99 at turn 1 to 17 at turn 83");
    expect(name(300)).toBe("Sessions still running at each turn · 99 to 17");
    expect(name(220)).toBe("Sessions still running at each turn");
  });
});

describe("growthLayout", () => {
  it("holds 302px with the curve and the strip fixed, 364 at twice the text", () => {
    const l = growthLayout(1);
    expect([l.height, l.left, l.right]).toEqual([302, 52, 14]);
    expect(l.tracks).toEqual([{ top: 12, height: 218 }, { top: 256, height: 22 }]);
    expect(growthLayout(2).height).toBe(364);
  });
});

// renderItem with a stubbed API: `slots` slots across a plot `width` px wide, y px up from the plot's bottom, one per unit.
interface El { type: string; shape: Record<string, number>; style: Record<string, unknown> }
function drawItem(s: SeriesOption | undefined, row: number, slots: number, width = 400) {
  const c = s as CustomSeriesOption, data = (c.data as number[][])[row]!, plot = { x: 52, y: 12, width, height: 218 }, band = width / slots;
  const api = {
    value: (d: number) => data[d]!,
    coord: ([x, v]: number[]) => [plot.x + (x! + .5) * band, plot.y + plot.height - v! / 1000],
    size: ([dx]: number[]) => [dx! * band, 0],
  } as unknown as CustomSeriesRenderItemAPI;
  return c.renderItem!({ coordSys: plot } as unknown as CustomSeriesRenderItemParams, api) as unknown as El;
}

// The colors the chart hands to env.color must be tokens theme.css declares as colors, as in rateTracks.test.ts.
describe("the growth chart's colors", () => {
  const themeCss = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

  it("hands env.color only declared color tokens, with a project isolated or not", () => {
    const seen = new Set<string>(), recording = env({ color: s => { seen.add(s); return s; } });
    for (const o of [{}, { isolated: "bar" }, { mode: "share" as const }]) {
      const m = model(o);
      growthOption(m, recording);
      drawItem(byId(m, "band", recording), 0, view.length);
    }
    for (const t of ["--text-primary", "--text-muted", "--proj-1", "--proj-2"]) expect(seen).toContain(`var(${t})`);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb() in theme.css`).toMatch(COLOR);
    }
  });
});
