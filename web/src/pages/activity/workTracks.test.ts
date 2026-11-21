import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, LineSeriesOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from "../../components/echart/echarts";
import type { DailyWorkRow, UsagePayload } from "../../api";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import usageCodex from "../../__fixtures__/usage-codex";
import usageSources from "../../__fixtures__/usage-sources";
import { color, setOrder, TOP } from "../../colors";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayLabel, dayRange, niceStep } from "../../format";
import type { WorkMetric } from "./work";
import { bucketLabel, rateScale, workLayout, workModel, workOption, type WorkModel, type WorkPick } from "./workTracks";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 216, ...over });

const METRICS: WorkMetric[] = ["commits", "prompts", "sessions"];
const model = (d: UsagePayload, metric: WorkMetric = "commits", selected: WorkPick | null = null) => workModel(d, metric, selected);
const series = (m: WorkModel, e = env()) => workOption(m, e).series as SeriesOption[];
const byId = (m: WorkModel, id: string, e?: ChartEnv) => series(m, e).find(s => s.id === id);
const rateOf = (m: WorkModel) => byId(m, "rate") as LineSeriesOption | undefined;
const yAxes = (m: WorkModel) => workOption(m, env()).yAxis as (YAXisComponentOption & { max: number; interval: number; axisLabel: { formatter: (v: number) => string; verticalAlignMaxLabel?: string } })[];

const row = (day: string, o: Partial<DailyWorkRow> = {}): DailyWorkRow => ({ day, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });
type WP = UsagePayload["work_projects"][number];
const wp = (day: string, project: string | null, o: Partial<WP> = {}): WP => ({ day, project, sessions: 1, prompts: 1, commits: 0, calls: 0, failed_calls: 0, ...o });
const days = (d: UsagePayload, rows: DailyWorkRow[], projects: WP[] = []): UsagePayload => ({ ...d, start: null, end: rows.at(-1)!.day, work: rows, daily_work: rows, work_projects: projects });

// The payloads of WorkChart.test.tsx. Seven projects over two days: a gets the most commits, g the most prompts.
const projects = ["a", "b", "c", "d", "e", "f", "g"];
const split: WP[] = ["2026-11-04", "2026-11-05"].flatMap((day, j) => projects.map((p, i) => wp(day, p, { commits: 7 - i + j, prompts: i + 1 })));
const sum = (day: string, k: WorkMetric) => split.filter(r => r.day === day).reduce((s, r) => s + r[k], 0);
const two = ["2026-11-04", "2026-11-05"].map(day => row(day, { sessions: 7, commits: sum(day, "commits"), prompts: sum(day, "prompts"), calls: 10, failed_calls: 1 }));
const many: UsagePayload = { ...usage, work: two, daily_work: two, work_projects: split };
// Ten weeks to Wednesday Nov 11, work in two of them.
const weekly: UsagePayload = {
  ...usage, range: 0, start: null, end: "2026-11-11", work_bucket: "week",
  work: [row("2026-09-07", { commits: 3, calls: 10, failed_calls: 1 }), row("2026-10-19", { commits: 5, calls: 20, failed_calls: 2 })],
  work_projects: [wp("2026-09-07", "foo", { commits: 3 }), wp("2026-10-19", "foo", { commits: 5 })],
};
// 2 of 4 calls (above the scale), a day without calls, 6 of 200.
const gap = days(usage, [row("2026-11-03", { calls: 4, failed_calls: 2 }), row("2026-11-04"), row("2026-11-05", { calls: 200, failed_calls: 6 })]);
const fewCalls = days(usage, [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 200, failed_calls: 6 }), row("2026-11-06", { calls: 100, failed_calls: 5 })]);
const allFew = days(usage, [row("2026-11-04", { calls: 4, failed_calls: 2 }), row("2026-11-05", { calls: 10, failed_calls: 1 })]);
const idle = days(usage, [row("2026-11-04", { commits: 2 }), row("2026-11-05")]);
// Twenty days, so the chart zooms.
const twenty = dayRange("2026-10-17", "2026-11-05");
const long = days(usage, twenty.map((day, i) => row(day, { commits: i % 3, calls: 60, failed_calls: i % 4 })));

// A stubbed renderItem API over the bars' track: 40px bands from x 0, the value axis 0 to `max` over a 120px plot.
const Y0 = 140, H = 120;
function draw(s: SeriesOption, i: number, max: number) {
  const c = s as CustomSeriesOption, rowOf = (c.data as number[][])[i]!;
  const api = {
    value: (dim: number) => rowOf[dim]!,
    coord: ([x, v]: number[]) => [(x! + .5) * 40, Y0 - v! / max * H],
    size: ([dx, dy]: number[]) => [dx! * 40, dy! / max * H],
  } as unknown as CustomSeriesRenderItemAPI;
  const params = { dataIndex: i, dataIndexInside: i, coordSys: { x: 0, y: Y0 - H, width: 800, height: H } } as unknown as CustomSeriesRenderItemParams;
  return c.renderItem!(params, api) as unknown as { children?: { shape: { y: number; height: number }; style: { fill: string } }[]; style?: { text: string } } | null;
}
const segs = (m: WorkModel, i: number) => draw(byId(m, "stack")!, i, m.axis.max)?.children ?? [];
const peakText = (m: WorkModel, e?: ChartEnv) => { const s = byId(m, "peak", e); return s ? draw(s, 0, m.axis.max)!.style!.text : undefined; };

describe("workModel", () => {
  beforeEach(() => setOrder(["a", "c", "e", "g"]));
  afterEach(() => setOrder([]));

  it("stacks the projects with a hue and Other in the legend's order, on the bars' track", () => {
    const m = model(many);
    expect(m.stacked).toBe(true);
    expect(m.kinds.map(k => k.label)).toEqual(["a", "c", "e", "g", "Other (3)"]);
    expect(segs(m, 0).map(c => c.style.fill)).toEqual(["a", "c", "e", "g"].map(color).concat(color("")));
    expect(byId(m, "stack")).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1 });
    // Each bar's parts add up to it.
    m.values.forEach((v, i) => expect(v.reduce((s, n) => s + n, 0)).toBe(m.totals[i]));
    expect(m.values[0]!.at(-1)).toBe(12); // Other: b, d and f's 6 + 4 + 2 commits
    expect(model(many, "prompts").kinds.map(k => k.label)).toEqual(["g", "e", "c", "a", "Other (3)"]);
  });

  it("draws plain bars of the measure in the first series color for one project", () => {
    const m = model({ ...many, project: "a" }, "prompts");
    expect(m.stacked).toBe(false);
    expect(m.kinds).toEqual([{ k: "prompts", label: "Prompts", c: "var(--series-1)" }]);
    expect(m.values).toEqual(m.totals.map(t => [t]));
    expect(segs(m, 0).map(c => c.style.fill)).toEqual(["var(--series-1)"]);
  });

  it("keeps a thin segment at least 1px tall, inside the bar's height", () => {
    // 1 commit of c over 1,000 of a: drawn to scale it would be a tenth of a pixel, under the 2px gap. The next day: the same
    // 1,001 commits, all of a, as one segment.
    const rows = [row("2026-11-04", { commits: 1001 }), row("2026-11-05", { commits: 1001 })];
    const m = model(days(usage, rows, [wp("2026-11-04", "a", { commits: 1000 }), wp("2026-11-04", "c", { commits: 1 }), wp("2026-11-05", "a", { commits: 1001 })]));
    const [bar, whole] = [segs(m, 0), segs(m, 1)];
    expect(bar).toHaveLength(2);
    expect(whole).toHaveLength(1);
    expect(bar[1]!.shape.y).toBeCloseTo(whole[0]!.shape.y); // as tall as its total drawn to scale
    for (const s of bar) expect(s.shape.height).toBeGreaterThanOrEqual(1);
    expect(bar[0]!.shape.y + bar[0]!.shape.height).toBeCloseTo(Y0);
    expect(bar[1]!.shape.y + bar[1]!.shape.height + 2).toBeCloseTo(bar[0]!.shape.y); // the 2px gap below it
  });

  it("rates each bucket, with no point for a bucket without calls and a rate over the scale at its top", () => {
    const m = model(gap);
    expect(m.rates).toEqual([50, null, 3]);
    // The 4-call day is low: left out of the scale, its 50 is drawn at the top of 5.
    expect(m.rate.top).toBe(5);
    expect(m.drawn).toEqual([5, null, 3]);
    expect((rateOf(m)!.data as unknown[]).map(v => (v && typeof v === "object" ? (v as { value: number }).value : v))).toEqual([5, null, 3]);
    expect(rateOf(m)).toMatchObject({ xAxisIndex: 2, yAxisIndex: 2, connectNulls: false, lineStyle: { color: "var(--critical)" } });
  });

  it("puts a hollow dot on a bucket with few calls and a solid one on a point no line reaches", () => {
    const symbols = (m: WorkModel) => (rateOf(m)!.data as unknown[]).map(v => (v && typeof v === "object" ? (v as { itemStyle: { color: string } }).itemStyle.color : null));
    // Both points are alone: the low one is hollow (a surface center), the busy one solid.
    expect(model(gap).dots).toEqual(["hollow", undefined, "solid"]);
    expect(symbols(model(gap))).toEqual(["ink-surface", null, "var(--critical)"]);
    // The line runs through the hollow dot; no point is alone.
    expect(model(fewCalls).dots).toEqual(["hollow", undefined, undefined]);
    expect(model(fewCalls).hasLow).toBe(true);
  });

  it("ticks the rate track at 0 and its top, with decimals for small rates, the top label under its line", () => {
    // y axis 0 is the frame's, 1 the bars', 2 the rate track's.
    const ticks = (m: WorkModel) => { const a = yAxes(m)[2]!; expect(a.interval).toBe(a.max); return [0, a.max].map(v => a.axisLabel.formatter(v)); };
    expect(ticks(model(gap))).toEqual(["0", "5"]);
    const low = days(usage, [row("2026-11-04", { calls: 1000, failed_calls: 1 }), row("2026-11-05", { calls: 1000, failed_calls: 1 })]);
    expect(ticks(model(low))).toEqual(["0", "0.2"]);
    expect(ticks(model(fewCalls))).toEqual(["0", "10"]); // the busy days' 3 and 5 set it, not the quiet day's 50
    expect(yAxes(model(gap))[2]!.axisLabel.verticalAlignMaxLabel).toBe("top");
    expect(yAxes(model(gap))[1]!.axisLabel.verticalAlignMaxLabel).toBeUndefined();
  });

  it("marks nothing when every bar has few calls: the view scales to its own rates", () => {
    const m = model(allFew);
    expect(m.hasLow).toBe(false);
    expect(m.dots.includes("hollow")).toBe(false);
    expect(m.rate.top).toBe(100);
  });

  it("draws no rate track, no rate series and bars of the full room without tool calls", () => {
    const m = model(idle), o = workOption(m, env());
    expect(m.hasRate).toBe(false);
    expect(rateOf(m)).toBeUndefined();
    expect(o.grid).toHaveLength(2);
    expect(o.xAxis).toHaveLength(2);
    const l = workLayout(m, 1);
    expect(l.height).toBe(216);
    expect(l.tracks).toEqual([{ top: 20, height: 172 }]);
    expect(workLayout(m, 2).tracks[0]!.height).toBe(120 + 2 * 52);
  });

  it("lays the box out at 216px, 244px with the slider from 14 bars, the bars at 120px at any text size", () => {
    const m = model(gap), l = workLayout(m, 1);
    expect([l.height, l.left, l.right]).toEqual([216, 52, 16]);
    expect(l.tracks).toEqual([{ top: 20, height: 120 }, { top: 156, height: 36 }]);
    expect(l.frame).toEqual({ top: 20, height: 172 });
    expect(workLayout(m, 2).tracks.map(t => t.height)).toEqual([120, 72]);
    const z = model(long);
    expect(z.zoom).toBe(true);
    expect(workLayout(z, 1).height).toBe(244);
    expect(model(days(usage, twenty.slice(7).map(day => row(day)))).zoom).toBe(false); // 13 bars
    expect(model(days(usage, twenty.slice(6).map(day => row(day)))).zoom).toBe(true); // 14
  });

  it("gives the selected bar's index, and none for a week on a chart by day or a day the chart lacks", () => {
    expect(model(usage, "commits", { day: "2026-11-05", week: false }).selected).toBe(1);
    expect(model(usage, "commits", { day: "2026-11-02", week: true }).selected).toBeNull();
    expect(model(usage, "commits", { day: "2026-10-01", week: false }).selected).toBeNull();
    expect(model(weekly, "commits", { day: "2026-10-19", week: true }).selected).toBe(6);
    expect(model(weekly, "commits", { day: "2026-10-19", week: false }).selected).toBeNull();
    expect(model(usage).selected).toBeNull();
  });

  it("draws the selection mark on the frame only with a selection", () => {
    expect(byId(model(usage), "selected")).toBeUndefined();
    const mark = byId(model(usage, "commits", { day: "2026-11-04", week: false }), "selected") as CustomSeriesOption;
    expect(mark).toMatchObject({ xAxisIndex: 0, yAxisIndex: 0, z: 1, data: [[0, 0]] });
  });

  it("makes the totals the slider's trend, only with the slider", () => {
    // ECharts draws the first line series on the lowest x axis the slider drives that carries one: the trend must sit on a
    // lower axis than every other line, and come first among the lines on its own.
    const m = model(long), lines = series(m).filter((s): s is LineSeriesOption => s.type === "line");
    const trend = lines.find(s => s.id === "trend")!;
    expect(trend.data).toEqual(m.totals);
    expect(trend).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1 });
    expect(lines.filter(s => s !== trend).map(s => s.xAxisIndex)).toEqual([2]); // the rate line
    expect(lines.find(s => s.xAxisIndex === trend.xAxisIndex)).toBe(trend);
    expect(workOption(m, env()).dataZoom).toEqual([expect.objectContaining({ xAxisIndex: "all", left: 52, right: 16 })]);
    expect(byId(model(gap), "trend")).toBeUndefined();
    expect(workOption(model(gap), env()).dataZoom).toBeUndefined();
  });

  it("labels the peak bar, and draws no label at a zero peak or without room at a large text size", () => {
    expect(peakText(model(weekly))).toBe("Peak 5 commits · Week of Oct 19");
    expect(byId(model(weekly), "peak")).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1 });
    expect(peakText(model(gap, "prompts"))).toBe("Peak 1 prompt · Nov 3");
    expect(peakText(model(idle, "sessions"))).toBe("Peak 1 session · Nov 4");
    expect(byId(model(gap), "peak")).toBeUndefined(); // no commits
    expect(byId(model(weekly), "peak", env({ textScale: 2, width: 600 }))).toBeUndefined();
    expect(byId(model(weekly), "peak", env({ textScale: 2, width: 800 }))).toBeDefined();
  });

  it("labels the frame's axis by day or week, and hides the tracks' axes", () => {
    const o = workOption(model(weekly), env()), x = o.xAxis as (XAXisComponentOption & { data: string[]; axisLabel?: { formatter: (v: string) => string } })[];
    expect(x).toHaveLength(3);
    expect(x[0]!.axisLabel!.formatter("2026-09-07")).toBe("Week of Sep 7");
    expect(x.slice(1).every(a => a.show === false && a.data.length === 10)).toBe(true);
    expect((workOption(model(usage), env()).xAxis as typeof x)[0]!.axisLabel!.formatter("2026-11-04")).toBe("Nov 4");
  });

  it("keeps the view through a new last bar or a selection, not through another measure, bucket or first bar", () => {
    const v = model(usage).view;
    expect(model(usage, "commits", { day: "2026-11-04", week: false }).view).toBe(v);
    const more = [...usage.work, row("2026-11-06", { commits: 3 })];
    expect(model({ ...usage, end: "2026-11-06", work: more }).view).toBe(v);
    expect(model(usage, "prompts").view).not.toBe(v);
    expect(model({ ...usage, work_bucket: "week", work: [row("2026-11-02")] }).view).not.toBe(v);
    expect(model({ ...usage, work: [row("2026-11-03"), ...usage.work] }).view).not.toBe(v);
    expect(model({ ...usage, project: "foo" }).view).not.toBe(v);
  });
});

// Each page fixture, by day and by week, in each measure, against figures worked out here from the payload's rows.
describe("workModel on the page fixtures", () => {
  const monday = (k: string) => { const t = new Date(k + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7); return t.toISOString().slice(0, 10); };
  // The server's weeks: each Monday's rows summed.
  function byWeek(d: UsagePayload): UsagePayload {
    const add = <T extends { day: string }>(rows: readonly T[], key: (r: T) => string) => {
      const out = new Map<string, T>();
      for (const r of rows) {
        const k = key({ ...r, day: monday(r.day) }), was = out.get(k);
        out.set(k, was ? Object.fromEntries(Object.entries(r).map(([f, v]) => [f, typeof v === "number" ? (was as Record<string, unknown>)[f] as number + v : f === "day" ? monday(r.day) : v])) as T : { ...r, day: monday(r.day) });
      }
      return [...out.values()];
    };
    return { ...d, work_bucket: "week", work: add(d.work, r => r.day), work_projects: add(d.work_projects, r => `${r.day} ${r.project}`) };
  }
  const fixtures = { usage, usageAll, usageCodex, usageSources, many, weekly, gap, fewCalls, allFew, idle, long };
  const cases = Object.entries(fixtures).flatMap(([name, d]) => (d.work_bucket === "week" ? [[name, d] as const] : [[name, d] as const, [`${name} by week`, byWeek(d)] as const]));
  afterEach(() => setOrder([]));

  it.each(cases)("%s", (_, d) => {
    setOrder(d.project_order ?? ["a", "c", "e", "g"]);
    const week = d.work_bucket === "week";
    const first = d.work.find(r => r.sessions > 0)?.day ?? d.start ?? d.end;
    const all = dayRange(week ? monday(first) : first, d.end), keys = week ? all.filter((_, i) => i % 7 === 0) : all;
    for (const metric of METRICS) {
      const m = model(d, metric);
      expect(m.buckets.map(p => p.day)).toEqual(keys);
      const at = new Map(d.work.map(r => [r.day, r]));
      const totals = keys.map(k => at.get(k)?.[metric] ?? 0);
      expect(m.totals).toEqual(totals);
      // Each project's segment is its own rows' measure; Other is the rest.
      m.values.forEach((v, i) => {
        expect(v.reduce((s, n) => s + n, 0)).toBe(totals[i]);
        const own = m.kinds.flatMap((k, j) => (k.project ? [[v[j], d.work_projects.filter(r => r.day === keys[i] && r.project === k.project).reduce((s, r) => s + r[metric], 0)]] : []));
        own.forEach(([drawn, rows]) => expect(drawn).toBe(rows));
      });
      expect(m.stacked).toBe(!d.project && m.kinds.length > 1);
      const rates = keys.map(k => { const r = at.get(k); return r?.calls ? 100 * r.failed_calls / r.calls : null; });
      expect(m.rates).toEqual(rates);
      const calls = keys.map(k => at.get(k)?.calls ?? 0), steady = calls.some(c => c >= 50);
      const low = calls.map(c => steady && c > 0 && c < 50);
      expect(m.low).toEqual(low);
      const top = niceStep(Math.max(0, ...rates.map((r, i) => (low[i] ? 0 : r ?? 0))) * 1.08 || 1);
      expect(m.rate.top).toBe(top);
      expect(m.drawn).toEqual(rates.map(r => (r == null ? null : Math.min(r, top))));
      expect(m.dots).toEqual(rates.map((r, i) => (r == null ? undefined : low[i] ? "hollow" : rates[i - 1] == null && rates[i + 1] == null ? "solid" : undefined)));
      expect(m.hasRate).toBe(rates.some(r => r != null));
      const peak = totals.indexOf(Math.max(...totals));
      expect(m.peak).toBe(peak);
      const ceil = Math.max(...totals) * 1.08 || 1, step = niceStep(ceil / 4);
      expect(m.axis).toEqual({ max: Math.ceil(ceil / step) * step, step });
      expect(m.zoom).toBe(keys.length >= 14);
      // A partial week: the first when the view starts after its Monday, the last always (it holds the end).
      expect(keys.map(k => bucketLabel(k, week, true, m.span))).toEqual(keys.map((k, i) => (week
        ? `Week of ${dayLabel(k, true)}${d.start && d.start > k ? `, from ${dayLabel(d.start)}` : i === keys.length - 1 ? ", so far" : ""}`
        : dayLabel(k, true))));
      keys.forEach((k, i) => expect(model(d, metric, { day: k, week }).selected).toBe(i));
      expect(model(d, metric, { day: keys[0]!, week: !week }).selected).toBeNull();
      const o = workOption(model(d, metric, { day: keys[peak]!, week }), env());
      expect((o.series as SeriesOption[]).map(s => s.id)).toEqual([
        ...(m.zoom ? ["trend"] : []), "selected", "stack", ...(m.hasRate ? ["rate"] : []), ...(totals[peak]! > 0 ? ["peak"] : []),
      ]);
      expect(o.grid).toHaveLength(m.hasRate ? 3 : 2);
    }
  });
});

describe("rateScale", () => {
  it("leaves low buckets out, and gives a top of 1 with no steady rate", () => {
    expect(rateScale([50, null, 3], [true, false, false])).toEqual({ top: 5, digits: 0 });
    expect(rateScale([0.1], [false])).toEqual({ top: 0.2, digits: 1 });
    expect(rateScale([null], [false])).toEqual({ top: 1, digits: 0 });
  });
});

// The colors the model hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that is
// not a color resolves to the inherited text color, with no error. As in costDaily.test.ts.
describe("the work chart's colors", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const themeCss = strip(readFileSync("src/theme.css", "utf8")); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);
  afterEach(() => setOrder([]));

  it("hands env.color only declared color tokens, in every measure, with and without projects", () => {
    const seen = new Set<string>();
    const recording = env({ color: s => { seen.add(s); return s; } });
    for (const f of [usage, usageAll, usageCodex, usageSources, many, gap, long]) {
      setOrder(f.project_order ?? ["a", "c", "e", "g"]);
      for (const metric of METRICS) {
        workOption(model(f, metric, { day: f.work[0]!.day, week: false }), recording);
        workOption(model({ ...f, project: "foo" }, metric), recording);
      }
    }
    for (let i = 1; i <= TOP; i++) seen.add(`var(--proj-${i})`); // colors.ts builds these from the slot
    expect(seen.has("var(--critical)") && seen.has("var(--series-1)") && seen.has("var(--proj-other)")).toBe(true);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.has(m![1]!), `${m![1]} is not declared in theme.css`).toBe(true);
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb()`).toMatch(COLOR);
    }
  });
});
