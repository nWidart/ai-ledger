import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { InsightsPayload, TrendWeek } from "../../../api";
import insights from "../../../__fixtures__/insights";
import insightsEmpty from "../../../__fixtures__/insights-empty";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../../components/echart/echarts";
import type { ChartEnv } from "../../../components/echart/tokens";
import { stackRects } from "../../../components/echart/stack";
import { dayLabel, pct } from "../../../format";
import { FEW_SESSIONS, TREND_PARTS } from "./figures";
import { trendModel, trendOption, type TrendModel } from "./outcomeWeeks";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 240, ...over });

const week = (day: string, fully: number, mostly: number, partially: number, not_achieved: number, other = 0): TrendWeek =>
  ({ week: day, n: fully + mostly + partially + not_achieved + other, achieved: fully + mostly, fully, mostly, partially, not_achieved });
// The weeks of Judgments.test.tsx: 12 sessions, then 3 (few), then 8 with one of no clear outcome.
const trend = [week("2026-10-19", 7, 2, 2, 1), week("2026-10-26", 1, 0, 1, 1), week("2026-11-02", 4, 2, 1, 0, 1)];
// 26 weeks from May 4, as many as the trend holds.
const many = Array.from({ length: 26 }, (_, i) => week(new Date(Date.UTC(2026, 4, 4 + 7 * i)).toISOString().slice(0, 10), 10 + i, 2, 1, 1));

type Axis = { type?: string; position?: string; data?: string[]; gridIndex?: number; axisPointer?: { show?: boolean };
  axisLabel: { formatter: (v: string, i?: number) => string } };
const xAxes = (m: TrendModel, e = env()) => trendOption(m, e).xAxis as Axis[];
const stackOf = (m: TrendModel, e = env()) => (trendOption(m, e).series as CustomSeriesOption[])[0]!;

// A stubbed renderItem API over a category axis: 40px bands from x 0, the value axis 0 to 1 over a 200px plot.
const Y0 = 220, H = 200, BAND = 40;
interface Rect { name: string; shape: { x: number; y: number; width: number; height: number }; style: { fill: string; opacity?: number } }
function draw(m: TrendModel, i: number, e = env()) {
  const s = stackOf(m, e), row = (s.data as number[][])[i]!;
  const api = {
    value: (dim: number) => row[dim]!,
    coord: ([x, v]: number[]) => [(x! + .5) * BAND, Y0 - v! * H],
    size: ([dx, dy]: number[]) => [dx! * BAND, dy! * H],
  } as unknown as CustomSeriesRenderItemAPI;
  const params = { dataIndex: i, dataIndexInside: i, coordSys: { x: 0, y: Y0 - H, width: 800, height: H } } as unknown as CustomSeriesRenderItemParams;
  return ((s.renderItem!(params, api) as unknown as { children: Rect[] } | null)?.children ?? []);
}

describe("trendModel", () => {
  it("gives each week's shares in the legend's order, adding up to 1, with 0 for a part without a session", () => {
    const m = trendModel(trend);
    expect(m.shares[0]).toEqual([7 / 12, 2 / 12, 2 / 12, 1 / 12, 0]);
    expect(m.shares[2]).toEqual([4 / 8, 2 / 8, 1 / 8, 0, 1 / 8]); // the session of no clear outcome is the last part
    m.shares.forEach(s => expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12));
    expect(m.counts).toEqual([12, 3, 8]);
    expect(m.few).toEqual([false, true, false]);
  });

  it("holds nothing for no weeks", () => {
    expect(trendModel([])).toEqual({ weeks: [], shares: [], counts: [], few: [] });
  });
});

describe("trendOption", () => {
  it("draws each week as one bar that fills the plot, stacked best outcome first in the legend's colors", () => {
    const m = trendModel(trend);
    const bars = m.weeks.map((_, i) => draw(m, i));
    expect(bars.map(b => b.length)).toEqual([4, 3, 4]); // a part with no session is not drawn
    // The parts of a bar add up to the whole plot, less the 2px gaps between them, whatever the week's sessions.
    bars.forEach(b => expect(b.reduce((a, r) => a + r.shape.height, 0) + 2 * (b.length - 1)).toBeCloseTo(H, 9));
    bars.forEach(b => { expect(b[0]!.shape.y + b[0]!.shape.height).toBeCloseTo(Y0, 9); expect(b.at(-1)!.shape.y).toBeCloseTo(Y0 - H, 9); });
    expect(bars[0]![0]!.shape.height / H).toBeCloseTo(7 / 12, 2); // fully achieved, at the bottom
    expect(bars[0]!.map(r => r.style.fill)).toEqual(["var(--good)", "var(--good-text)", "var(--warning)", "var(--critical)"]);
    expect(bars[2]!.map(r => r.name)).toEqual(["fully", "mostly", "partially", "other"]);
    expect((stackOf(m).data as number[][])[0]).toEqual([0, 1, ...m.shares[0]!]);
    // Each part keeps one order and one color, as the legend lists them.
    expect(TREND_PARTS.map(p => p.c)).toEqual(["var(--good)", "var(--good-text)", "var(--warning)", "var(--critical)", "var(--proj-other)"]);
  });

  it("draws a week with few sessions at half width, centred in its band, in full color", () => {
    const m = trendModel(trend);
    const [full, few] = [draw(m, 0), draw(m, 1)];
    expect(full[0]!.shape.width).toBe(BAND - 6); // the band less min(6, a quarter of it)
    expect(few[0]!.shape.width).toBeCloseTo(full[0]!.shape.width / 2, 9);
    expect(few[0]!.shape.x + few[0]!.shape.width / 2).toBeCloseTo(1.5 * BAND, 9);
    expect(few.every(r => r.style.opacity == null)).toBe(true);
    expect(FEW_SESSIONS).toBe(5);
  });

  it("keeps a part of 1 in 150 visible: at least 1px painted, with the 2px gap below it", () => {
    const m = trendModel([week("2026-10-19", 149, 0, 0, 1), trend[2]!]);
    const h = draw(m, 0).map(r => r.shape.height);
    expect(h).toHaveLength(2);
    expect(h[1]!).toBeGreaterThanOrEqual(1);
    expect(h[0]! + h[1]! + 2).toBeCloseTo(H, 9); // the slots still fill the bar
    // The same rects as stackRects gives for the shares.
    expect(draw(m, 0).map(r => r.shape)).toEqual(stackRects(m.shares[0]!, Y0, Y0 - H, 3, BAND - 6).map(({ x, y, width, height }) => ({ x, y, width, height, r: 0 })));
  });

  it("puts the weeks under the bars and each week's sessions over its bar, on a top axis that reads no pointer", () => {
    const m = trendModel(trend), [weeks, counts] = xAxes(m);
    expect(weeks!.data).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(weeks!.axisLabel.formatter("2026-10-19")).toBe(dayLabel("2026-10-19"));
    expect(weeks!.axisPointer?.show).toBe(true);
    expect(counts).toMatchObject({ type: "category", position: "top", data: weeks!.data, axisLabel: { hideOverlap: true } });
    expect(counts!.gridIndex ?? 0).toBe(0);
    expect(counts!.data!.map(w => counts!.axisLabel.formatter(w))).toEqual(["12", "3", "8"]);
    expect(xAxes(trendModel(many))[1]!.data!.map(w => xAxes(trendModel(many))[1]!.axisLabel.formatter(w))).toEqual(many.map(w => String(w.n)));
    // Only the first x axis shows a pointer: a second would draw a second band.
    expect(xAxes(m).filter(a => a.axisPointer?.show !== false).length).toBe(1);
    expect(counts!.axisPointer).toEqual({ show: false });
  });

  it("reads 0 to 100% in quarters, in one grid with the margins scaled by the text, and draws no zoom", () => {
    const m = trendModel(many);
    const o = trendOption(m, env());
    const y = o.yAxis as { min: number; max: number; interval: number; axisLabel: { formatter: (v: number) => string } };
    expect([y.min, y.max, y.interval]).toEqual([0, 1, .25]);
    expect([0, .25, .5, .75, 1].map(y.axisLabel.formatter)).toEqual(["0%", "25%", "50%", "75%", "100%"]);
    expect(o.grid).toEqual({ left: 40, right: 8, top: 20, bottom: 26 });
    expect(trendOption(m, env({ textScale: 2 })).grid).toEqual({ left: 80, right: 16, top: 40, bottom: 52 });
    expect(o.dataZoom).toBeUndefined();
    expect(o.series).toHaveLength(1);
  });

  it("builds an option for one week and for none", () => {
    for (const w of [[trend[0]!], []]) {
      const m = trendModel(w), o = trendOption(m, env());
      expect((o.xAxis as Axis[]).map(a => a.data)).toEqual([w.map(x => x.week), w.map(x => x.week)]);
      expect((stackOf(m).data as unknown[]).length).toBe(w.length);
    }
  });
});

// The page fixtures that carry Judgments data, and the weeks the Judgments tests draw, through the model, against figures
// worked out here from the payload: a week's shares are its four outcomes and the rest of n over n, in the legend's order.
describe("trendModel on the page fixtures", () => {
  const cases: Record<string, TrendWeek[]> = {
    insights: (insights as InsightsPayload).trend,
    "insights-empty": (insightsEmpty as InsightsPayload).trend,
    "three weeks": trend,
    "26 weeks": many,
    "1 in 150": [week("2026-10-19", 149, 0, 0, 1), trend[2]!],
  };
  it.each(Object.keys(cases))("%s", name => {
    const weeks = cases[name]!, m = trendModel(weeks);
    expect(m.weeks.map(w => w.week)).toEqual(weeks.map(w => w.week));
    weeks.forEach((w, i) => {
      const rest = w.n - w.fully - w.mostly - w.partially - w.not_achieved;
      const want = [w.fully, w.mostly, w.partially, w.not_achieved, rest].map(n => n / w.n);
      want.forEach((v, j) => expect(m.shares[i]![j]).toBeCloseTo(v, 12));
      expect(pct(m.shares[i]!.reduce((a, b) => a + b, 0))).toBe("100%");
      expect(m.counts[i]).toBe(w.n);
      expect(m.few[i]).toBe(w.n < 5);
      // The bar fills the plot, whatever its parts.
      const bar = draw(m, i);
      expect(bar.reduce((a, r) => a + r.shape.height, 0) + 2 * (bar.length - 1)).toBeCloseTo(H, 9);
      expect(bar.map(r => r.style.fill)).toEqual(want.flatMap((v, j) => (v > 0 ? [TREND_PARTS[j]!.c] : [])));
    });
  });

  it("finds the fixtures' weeks", () => {
    expect((insights as InsightsPayload).trend).toHaveLength(1);
    expect((insights as InsightsPayload).trend[0]!.n).toBe(3); // a week of few sessions
    expect((insightsEmpty as InsightsPayload).trend).toEqual([]);
  });
});

// The colors the option hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that
// is not a color resolves to the inherited text color, with no error (foundation, decision 4). As in costDaily.test.ts.
describe("the trend's chart colors", () => {
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
    for (const w of [trend, many, (insights as InsightsPayload).trend]) {
      const m = trendModel(w);
      trendOption(m, recording);
      m.weeks.forEach((_, i) => draw(m, i, recording));
    }
    expect([...seen].sort()).toEqual(TREND_PARTS.map(p => p.c).sort());
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.has(m![1]!), `${m![1]} is not declared in theme.css`).toBe(true);
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb()`).toMatch(COLOR);
    }
  });
});
