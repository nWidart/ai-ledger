import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, LineSeriesOption, SeriesOption } from "../../components/echart/echarts";
import type { Source, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import usageCodex from "../../__fixtures__/usage-codex";
import { setOrder, TOP } from "../../colors";
import { niceMax } from "../../components/chart";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayRange, niceStep, pct } from "../../format";
import { costModel, costOption, type CostMetric, type CostModel } from "./costDaily";
import type { Stack, TokenScale } from "./cost";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 240, ...over });

const model = (d: UsagePayload, metric: CostMetric = "cost", { hidden = [] as string[], stack = "project" as Stack, scale = "volume" as TokenScale } = {}) =>
  costModel(d, metric, hidden, stack, scale);
const option = (m: CostModel, e = env()) => costOption(m, e);
const series = (m: CostModel, e?: ChartEnv) => option(m, e).series as SeriesOption[];
const byId = (m: CostModel, id: string, e?: ChartEnv) => series(m, e).find(s => s.id === id);

// A stubbed renderItem API over a category axis: 40px bands from x 0, the value axis 0 to `max` over a 200px plot.
const Y0 = 220, H = 200;
interface Shape { name: string; style: { fill?: string; decal?: unknown } }
function draw(s: SeriesOption, i: number, max: number) {
  const c = s as CustomSeriesOption, row = (c.data as number[][])[i]!;
  const api = {
    value: (dim: number) => row[dim]!,
    coord: ([x, v]: number[]) => [(x! + .5) * 40, Y0 - v! / max * H],
    size: ([dx, dy]: number[]) => [dx! * 40, dy! / max * H],
  } as unknown as CustomSeriesRenderItemAPI;
  const params = { dataIndex: i, dataIndexInside: i, coordSys: { x: 0, y: Y0 - H, width: 800, height: H } } as unknown as CustomSeriesRenderItemParams;
  return c.renderItem!(params, api) as unknown as { children?: Shape[]; style?: { text: string } } | null;
}
const stackOf = (m: CostModel) => byId(m, "stack")!;
const fills = (m: CostModel, i: number) => (draw(stackOf(m), i, m.axis.max)?.children ?? []).filter(c => !c.style.decal).map(c => c.style.fill);
const hatchedDays = (m: CostModel) => m.days.flatMap((_, i) => (draw(stackOf(m), i, m.axis.max)?.children ?? []).some(c => c.style.decal) ? [i] : []);
const peakText = (m: CostModel, e?: ChartEnv) => { const s = byId(m, "peak", e); return s ? draw(s, 0, m.axis.max)!.style!.text : undefined; };

// The payloads of CostChart.test.tsx: one day, A named and B to E in Other; then twenty days ending today.
const day = "2026-11-04";
const base = usage.by_project[0]!;
const proj = (project: string, cost: number) => ({ ...base, project, cost, unpriced: 0 });
const pd = (project: string, cost: number) => ({ day, project, cost, tokens: 1 });
const md = (model: string, cost: number) => ({ day, model, cost });
const sd = (source: Source, cost: number) => ({ day, source, cost });
const d: UsagePayload = { ...usage, start: day, end: day, range: 1, project: "", daily: [{ ...usage.daily[0]!, day, cost: 19.5, unpriced: 0 }],
  daily_projects: [pd("A", 10), pd("B", 5), pd("C", 3), pd("D", 1), pd("E", 0.5)],
  by_project: [proj("A", 10), proj("B", 5), proj("C", 3), proj("D", 1), proj("E", 0.5)],
  daily_models: [md("claude-opus-4", 12), md("claude-sonnet-4", 7), md("gpt-6", 0.5)], daily_sources: [sd("claude", 19), sd("codex", 0.5)] };
// $1 a day, today $40.
const days = dayRange("2026-10-16", "2026-11-04");
const long: UsagePayload = { ...d, start: days[0]!, end: days.at(-1)!, range: 20,
  daily: days.map((x, i) => ({ ...usage.daily[0]!, day: x, cost: i === 19 ? 40 : 1, unpriced: 0 })),
  daily_projects: days.map((x, i) => ({ day: x, project: "A", cost: i === 19 ? 40 : 1, tokens: 1 })), by_project: [proj("A", 59)],
  daily_models: days.map((x, i) => ({ day: x, model: "claude-opus-4", cost: i === 19 ? 40 : 1 })) };
// Tokens: 60 input, 20 output and 120 cache read (30%, 10%, 60% of 200), then a day with no tokens.
const empty = { input: 0, output: 0, thinking: 0, cache_read: 0, cache_5m: 0, cache_1h: 0 };
const tokens: UsagePayload = { ...d, start: day, end: "2026-11-05", range: 2,
  daily: [{ ...usage.daily[0]!, ...empty, day, input: 60, output: 20, cache_read: 120, cost: 1, unpriced: 0 }, { ...usage.daily[0]!, ...empty, day: "2026-11-05", cost: 0, unpriced: 0 }] };
const longTokens: UsagePayload = { ...tokens, start: days[0]!, end: days.at(-1)!, range: 20,
  daily: days.map(x => ({ ...usage.daily[0]!, ...empty, day: x, input: 1, cost: 1, unpriced: 0 })) };

beforeEach(() => setOrder(["A"]));
afterEach(() => setOrder([]));

describe("costModel", () => {
  it("stacks each stacking's series in its colors", () => {
    expect(fills(model(d), 0)).toEqual(["var(--proj-1)", "var(--proj-other)"]);
    expect(fills(model(d, "cost", { stack: "model" }), 0)).toEqual(["var(--series-1)", "var(--series-2)", "var(--series-3)"]);
    expect(fills(model(d, "cost", { stack: "source" }), 0)).toEqual(["var(--series-1)", "var(--series-2)"]);
    expect(model(d).totals).toEqual([19.5]);
  });

  it("leaves a hidden kind out of the series, the values and the total", () => {
    const all = model(tokens, "tokens"), less = model(tokens, "tokens", { hidden: ["cache_read"] });
    expect(less.kinds.map(k => k.k)).toEqual(all.kinds.map(k => k.k).filter(k => k !== "cache_read"));
    expect(less.values[0]).toHaveLength(5);
    expect(less.totals[0]).toBe(80);
    expect(fills(less, 0)).toEqual(["var(--series-1)", "var(--series-2)"]);
  });

  it("is none with every token kind hidden, and not in the cost metric", () => {
    const all = ["input", "text_out", "thinking", "cache_read", "cache_5m", "cache_1h"];
    expect(model(tokens, "tokens", { hidden: all }).none).toBe(true);
    expect(model(tokens, "cost", { hidden: all }).none).toBe(false);
  });

  it("draws no segment for a day without tokens", () => {
    const m = model(tokens, "tokens");
    expect(m.values[1]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(draw(stackOf(m), 1, m.axis.max)).toBeNull();
    expect(fills(m, 0)).toHaveLength(3);
  });
});

describe("costOption: today so far", () => {
  it.each(["project", "model"] as const)("hatches only the last day under %s", stack => {
    const m = model(long, "cost", { stack });
    expect(m.live).toBe(19);
    expect(hatchedDays(m)).toEqual([19]);
  });

  it("averages 13 days in a 20-day view, with no point for today, and halos the line", () => {
    const m = model(long);
    const line = byId(m, "avg") as LineSeriesOption, halo = byId(m, "avg-halo") as LineSeriesOption;
    const pts = (line.data as (number | null)[]);
    expect(pts.filter(v => v != null)).toHaveLength(13); // the 7th to the 19th day
    expect(pts.slice(0, 6).every(v => v == null)).toBe(true);
    expect(pts[19]).toBeNull();
    expect(pts[18]).toBe(1); // not dragged up by today's $40
    expect(halo.data).toEqual(line.data);
    expect(halo.lineStyle).toMatchObject({ color: "ink-surface", width: 4.5 });
    expect(line.lineStyle).toMatchObject({ color: "ink-text", width: 1.75 });
    expect(series(m).map(s => s.id)).toEqual(["stack", "avg-halo", "avg", "peak"]);
  });

  it("draws no average under 14 days", () => {
    const m = model({ ...long, start: days[7]!, daily: long.daily.slice(7), daily_projects: long.daily_projects.slice(7) });
    expect(m.days).toHaveLength(13);
    expect(m.showAvg).toBe(false);
    expect(byId(m, "avg")).toBeUndefined();
  });

  it("says 'so far' in the peak label when today is the peak, and not on another day", () => {
    expect(peakText(model(long))).toBe("Peak $40 · Nov 4 so far");
    const past = { ...long, daily: long.daily.map((r, i) => ({ ...r, cost: i === 3 ? 50 : 1 })),
      daily_projects: long.daily_projects.map((r, i) => ({ ...r, cost: i === 3 ? 50 : 1 })) };
    expect(peakText(model(past))).toBe("Peak $50 · Oct 19");
  });

  it("leaves the peak label out when the text is scaled up and the plot is under 300px times the scale", () => {
    const m = model(long);
    // The plot is the box less 60px times the scale: 800 − 120 = 680 ≥ 600; 600 − 120 = 480 < 600.
    expect(peakText(m, env({ textScale: 2, width: 800 }))).toBeDefined();
    expect(peakText(m, env({ textScale: 2, width: 600 }))).toBeUndefined();
    // At the default size the label is always drawn.
    expect(peakText(m, env({ width: 200 }))).toBeDefined();
  });

  it("scales the plot's margins with the text", () => {
    // A 20-day view has the slider under the day labels: its 28px do not scale.
    expect(option(model(long)).grid).toEqual({ left: 52, right: 8, top: 22, bottom: 26 + 28 });
    expect(option(model(long), env({ textScale: 1.5 })).grid).toEqual({ left: 78, right: 12, top: 33, bottom: 39 + 28 });
  });
});

describe("costOption: zoom", () => {
  const short = { ...long, start: days[7]!, daily: long.daily.slice(7), daily_projects: long.daily_projects.slice(7) };

  it("draws the slider under the day labels, aligned with the grid, from 14 days", () => {
    const m = model(long);
    expect(m.zoom).toBe(true);
    const o = option(m);
    expect(o.dataZoom).toEqual([expect.objectContaining({ id: "zoom", type: "slider", left: 52, right: 8 })]);
    expect(o.grid).toMatchObject({ bottom: 26 + 28 });
    expect(option(m, env({ textScale: 1.5 })).dataZoom).toEqual([expect.objectContaining({ left: 78, right: 12 })]);
  });

  it("draws no slider under 14 days", () => {
    const m = model(short);
    expect(m.days).toHaveLength(13);
    expect(m.zoom).toBe(false);
    expect(option(m).dataZoom).toBeUndefined();
    expect(option(m).grid).toMatchObject({ bottom: 26 });
  });

  it("keeps the whole view's value axis and average with the slider: the option names no window", () => {
    const m = model(long);
    const y = option(m).yAxis as { max: number };
    expect(y.max).toBe(niceMax(40, niceStep).max);
    expect((byId(m, "avg") as LineSeriesOption).data).toEqual(m.avg);
    for (const z of option(m).dataZoom as Record<string, unknown>[]) for (const k of ["start", "end", "startValue", "endValue"]) expect(z[k]).toBeUndefined();
  });
});

describe("costOption: tokens", () => {
  const yAxis = (m: CostModel) => option(m).yAxis as { max: number; interval: number; axisLabel: { formatter: (v: number) => string } };

  it("fills the plot with each day's shares on a 0 to 100% axis, and draws no average or peak", () => {
    const m = model(tokens, "tokens", { scale: "share" });
    expect(m.values[0]).toEqual([.3, .1, 0, .6, 0, 0]);
    const y = yAxis(m);
    expect([y.max, y.interval]).toEqual([1, .25]);
    expect([0, .25, .5, .75, 1].map(y.axisLabel.formatter)).toEqual(["0%", "25%", "50%", "75%", "100%"]);
    const share = model(longTokens, "tokens", { scale: "share" });
    expect(share.showAvg).toBe(false);
    expect(series(share).map(s => s.id)).toEqual(["stack"]);
  });

  it("keeps Volume's average line and peak label, on round ticks", () => {
    const m = model(longTokens, "tokens");
    expect(series(m).map(s => s.id)).toEqual(["stack", "avg-halo", "avg", "peak"]);
    expect(peakText(m)).toBe("Peak 1 · Oct 16");
    expect(yAxis(m).max).toBe(niceMax(1, niceStep).max);
    expect(yAxis(model(tokens, "tokens")).axisLabel.formatter(200)).toBe("200");
  });
});

// The page fixtures through the model, against figures worked out here from the payload: a day's total is its cost (or its
// tokens), the average the mean of its seven days, the peak the first largest day, and only the last day is hatched.
describe("costModel on the page fixtures", () => {
  const fixtures = { usage, "usage-all": usageAll, "usage-codex": usageCodex } as Record<string, UsagePayload>;
  const tokensOf = (r: UsagePayload["daily"][number]) => r.input + r.output + r.cache_read + r.cache_5m + r.cache_1h;

  describe.each(Object.keys(fixtures))("%s", name => {
    const f = fixtures[name]!;
    const span = dayRange(f.start || f.daily[0]!.day, f.end);
    const row = (x: string) => f.daily.find(r => r.day === x);

    it.each([["cost", "project"], ["cost", "model"], ["cost", "source"], ["tokens", "project"]] as const)("%s by %s", (metric, stack) => {
      setOrder(f.project_order);
      const m = model(f, metric, { stack });
      const want = span.map(x => (metric === "cost" ? row(x)?.cost || 0 : row(x) ? tokensOf(row(x)!) : 0));
      expect(m.days.map(p => p.day)).toEqual(span);
      want.forEach((t, i) => expect(m.totals[i]).toBeCloseTo(t, 9));
      expect(m.live).toBe(span.length - 1);
      expect(hatchedDays(m)).toEqual(want[span.length - 1]! > 0 ? [span.length - 1] : []);
      const peak = want.indexOf(Math.max(...want));
      expect(m.peak).toBe(peak);
      expect(m.showAvg).toBe(span.length >= 14);
      const avg = want.map((_, i) => (!m.showAvg || i < 6 || i === span.length - 1 ? null : want.slice(i - 6, i + 1).reduce((s, t) => s + t, 0) / 7));
      expect(m.avg.map(v => v == null)).toEqual(avg.map(v => v == null));
      avg.forEach((v, i) => expect(m.avg[i] ?? 0).toBeCloseTo(v ?? 0, 9));
      expect(m.axis).toEqual(niceMax(Math.max(...want), niceStep));
      // Each day's drawn values add up to its total.
      m.values.forEach((v, i) => expect(v.reduce((s, x) => s + x, 0)).toBeCloseTo(want[i]!, 9));
    });

    it("tokens by share: each day's fractions of its tokens", () => {
      const m = model(f, "tokens", { scale: "share" });
      span.forEach((x, i) => {
        const r = row(x), sum = r ? tokensOf(r) : 0;
        expect(m.values[i]!.reduce((s, v) => s + v, 0)).toBeCloseTo(sum ? 1 : 0, 9);
        expect(pct(m.values[i]![0]!, 1)).toBe(pct(sum ? r!.input / sum : 0, 1));
      });
      expect(m.axis).toEqual({ max: 1, step: .25 });
    });
  });

  it("gives the usage fixture's figures", () => {
    setOrder(usage.project_order);
    const m = model(usage);
    expect(m.days).toHaveLength(30);
    expect(m.peak).toBe(28); // Nov 4, $15.80
    expect(m.avg[28]).toBeCloseTo(15.8 / 7, 9);
    expect(m.avg[29]).toBeNull();
    expect(peakText(m)).toBe("Peak $16 · Nov 4");
  });
});

// The colors the model hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that is
// not a color resolves to the inherited text color, with no error (design decision 4). As in components/echart/tokens.test.ts.
describe("Cost's chart colors", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const themeCss = strip(readFileSync("src/theme.css", "utf8")); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);
  const tokensIn = (css: string) => [...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]!);
  const isColor = (name: string) => {
    expect(declared.has(name), `${name} is not declared in theme.css`).toBe(true);
    expect(declared.get(name), `${name} is not hex or rgb()`).toMatch(COLOR);
  };

  it("declares every var(--…) color of cost.ts and every project color of colors.ts", () => {
    const names = new Set([
      ...tokensIn(strip(readFileSync("src/pages/cost/cost.ts", "utf8"))),
      ...tokensIn(strip(readFileSync("src/colors.ts", "utf8"))),
      ...Array.from({ length: TOP }, (_, i) => `--proj-${i + 1}`), // colors.ts builds these from the slot
    ]);
    expect(names.has("--series-1") && names.has("--proj-other")).toBe(true);
    for (const name of names) isColor(name);
  });

  it("hands env.color only declared color tokens, in every metric and stacking", () => {
    const seen = new Set<string>();
    const recording = env({ color: s => { seen.add(s); return s; } });
    for (const f of [usage, usageAll, usageCodex, d, long]) {
      setOrder(f.project_order ?? ["A"]);
      for (const stack of ["project", "model", "source"] as const) costOption(model(f, "cost", { stack }), recording);
      costOption(model(f, "tokens"), recording);
    }
    expect(seen.size).toBeGreaterThan(3);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      isColor(m![1]!);
    }
  });
});
