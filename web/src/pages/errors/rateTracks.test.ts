import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorsPayload } from "../../api";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, LineSeriesOption, SeriesOption, YAXisComponentOption } from "../../components/echart/echarts";
import { axisTitle } from "../../components/echart/option";
import type { ChartEnv } from "../../components/echart/tokens";
import { dayRange } from "../../format";
import { filtered, makeModel, viewTypes, type Fixes, type View } from "./model";
import { rateLayout, rateModel, rateOption, rateZoomWords, type RateModel } from "./rateTracks";
import { DEFAULT_VIEW } from "./view";

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: false, width: 800, height: 320, ...over });
const PHONE = { width: 343, textScale: 2 };

// A payload from its days: [day, tool calls, errors by type]. Every type is a category labelled "Type <id>", plus `known`.
type Row = [string, number, Record<string, number>];
function payload(rows: Row[], { today = rows.at(-1)![0], labels = {} as Record<string, string>, known = [] as string[] } = {}): ErrorsPayload {
  const ids = [...new Set([...rows.flatMap(r => Object.keys(r[2])), ...known])];
  return {
    generated: null, today, project_order: [], incidents: [], incident_gap_minutes: 10, incident_max_ok: 2, fixes: {}, muted: [],
    categories: ids.map(id => ({ id, label: labels[id] ?? `Type ${id}`, why: "", fix: "", snippet: "" })),
    calls: rows.filter(r => r[1]).map(([d, c]) => [d, "foo", c, 0, "claude"]),
    error_days: rows.flatMap(([d, , e]) => Object.entries(e).map(([c, n]) => [d, "foo", c, n, 0, "claude"] as ErrorsPayload["error_days"][number])),
    errors: rows.flatMap(([d, , e]) => Object.entries(e).flatMap(([c, n]) => Array.from({ length: n }, (_, k) => ({
      id: `${d}-${c}-${k}`, ts: `${d}T00:00:00Z`, p: "foo", s: "s", t: "Bash", c, i: "", e: "", r: "", sub: 0 as const, src: "claude" as const, d, n: null })))),
  };
}
const model = (p: ErrorsPayload, o: Partial<View> = {}, fixes: Fixes = {}) => {
  const m = makeModel(p), v = { ...DEFAULT_VIEW, ...o }, f = filtered(m, v);
  return rateModel(m, v, f, viewTypes(m, v, f), fixes);
};
const idleDays = (from: string, to: string): Row[] => dayRange(from, to).map(d => [d, 0, {}]);

// Nov 1 to Nov 20: a quiet day (10 calls, 5 errors), two idle days, errors with no call, ten idle days folded into one
// point, an idle last day. Points: 0 Nov 1 … 7 Nov 8, 8 the fold Nov 9–18, 9 Nov 19, 10 Nov 20.
const quiet = payload([
  ["2026-11-01", 100, { x: 4, y: 2 }], ["2026-11-02", 200, { x: 6, y: 1, z: 1 }], ["2026-11-03", 10, { x: 5 }],
  ...idleDays("2026-11-04", "2026-11-05"), ["2026-11-06", 100, { x: 2 }], ["2026-11-07", 0, { x: 1 }], ["2026-11-08", 100, { y: 3 }],
  ...idleDays("2026-11-09", "2026-11-18"), ["2026-11-19", 100, { x: 1, z: 1 }], ["2026-11-20", 0, {}],
], { labels: { y: "A very long error type name for a narrow plot" }, known: ["w"] });
// Seven types on one day: five layers and Other (t6 and t7).
const wide = payload([["2026-11-05", 100, { t1: 7, t2: 6, t3: 5, t4: 4, t5: 3, t6: 2, t7: 1 }]], { known: ["q"] });
const rare = payload([["2026-11-05", 500, { x: 1 }]]);
const long = payload(dayRange("2026-11-01", "2026-11-20").map((d, i): Row => [d, 100, { x: i % 3 }]));
const weekly = payload(dayRange("2026-06-29", "2026-11-15").map((d): Row => [d, 10, { x: 1 }]));

const ids = (o: ReturnType<typeof rateOption>) => (o.series as SeriesOption[]).map(s => s.id);
const byId = (m: RateModel, id: string, e = env()) => (rateOption(m, e).series as SeriesOption[]).find(s => s.id === id);
const yAxes = (m: RateModel, e = env()) => rateOption(m, e).yAxis as (YAXisComponentOption & { max: number; interval: number; name: string; axisLabel: { formatter: (v: number) => string } })[];

// renderItem with a stubbed API: points `from` to `to` shown across the plot, the others placed by extrapolation, as
// ECharts places them; y is px up from the plot's bottom, one per unit.
interface Plot { x: number; y: number; width: number; height: number }
interface El { type: string; shape: Record<string, number>; style: Record<string, unknown> }
const frameOf = (m: RateModel, e = env()): Plot => {
  const l = rateLayout(m, e.textScale);
  return { x: l.left, y: l.frame.top, width: e.width - l.left - l.right, height: l.frame.height };
};
function draw(s: SeriesOption | undefined, row: number, plot: Plot, from: number, to: number) {
  const c = s as CustomSeriesOption, data = (c.data as number[][])[row]!, band = plot.width / (to - from + 1);
  const api = {
    value: (d: number) => data[d]!,
    coord: ([x, v]: number[]) => [plot.x + (x! - from + .5) * band, plot.y + plot.height - v!],
    size: ([dx]: number[]) => [dx! * band, 0],
  } as unknown as CustomSeriesRenderItemAPI;
  return c.renderItem!({ coordSys: plot } as unknown as CustomSeriesRenderItemParams, api) as unknown as ({ children: El[] } & El) | null;
}
const whole = (m: RateModel) => [0, m.pts.length - 1] as const;

describe("rateModel", () => {
  it("scales the rate without the quiet bucket and the counts in whole steps, three of each", () => {
    const q = model(quiet), ticks = (m: RateModel, a: number) => { const y = yAxes(m)[a]!; return [0, y.interval, y.max].map(y.axisLabel.formatter); };
    // The busy days' highest rate is 6 (Nov 1), the quiet day's 50 is left out: 6.6 in steps of 5. The most failed calls: 8.
    expect(q.rate).toEqual({ max: 10, step: 5, digits: 0 });
    expect(q.count).toEqual({ max: 10, step: 5 });
    expect(ticks(q, 1)).toEqual(["0%", "5%", "10%"]);
    expect(ticks(q, 2)).toEqual(["0", "5", "10"]);
    // 1 of 500: 0.2% plus 10% in steps of 0.1; one failed call, plus 5%, in steps of at least 1.
    const r = model(rare);
    expect(r.rate.step).toBe(.1);
    expect(r.rate.max).toBe(.3); // exact: a max a hair over its last step makes ECharts draw a fifth line on the top one
    expect(ticks(r, 1).slice(0, 2)).toEqual(["0.0%", "0.1%"]); // every label of a scale in tenths has its decimal, 0 too
    expect(r.count).toEqual({ max: 2, step: 1 });
    // 3 of 2,500: 0.12% plus 10% in steps of 0.05, in hundredths so no two labels read the same.
    const h = model(payload([["2026-11-05", 2500, { x: 3 }]])), all = (m: RateModel) => [0, 1, 2, 3].map(n => yAxes(m)[1]!.axisLabel.formatter(n * m.rate.step));
    expect(h.rate).toEqual({ max: .15, step: .05, digits: 2 });
    expect(all(h)).toEqual(["0.00%", "0.05%", "0.10%", "0.15%"]);
  });

  it("draws a rate over the scale at its top, no point without calls, and a hollow dot on the quiet bucket", () => {
    const q = model(quiet);
    expect(q.rates.slice(0, 8)).toEqual([6, 4, 50, null, null, 2, null, 3]);
    expect(q.drawn.slice(0, 8)).toEqual([6, 4, 10, null, null, 2, null, 3]);
    expect(q.low.indexOf(true)).toBe(2);
    expect(q.low.filter(Boolean)).toHaveLength(1);
    expect(byId(q, "rate")).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1, data: q.drawn, lineStyle: { color: "var(--text-primary)" } });
    expect((byId(q, "rate-dots") as CustomSeriesOption).data).toContainEqual([2, 10, 1]);
  });

  it("stacks the layers by count, then Other, and dims every kind but the selected type's layer", () => {
    const w = model(wide), kinds = (o: Partial<View>) => model(wide, o).kinds;
    expect(w.kinds).toEqual([1, 2, 3, 4, 5].map(i => ({ k: `t${i}`, c: `var(--type-${i})` })).concat({ k: "__other", c: "var(--type-other)" }));
    expect(w.values).toEqual([[7, 6, 5, 4, 3, 3]]);
    expect(model(quiet).kinds.map(k => k.k)).toEqual(["x", "y", "z"]); // no point has Other
    const lit = (o: Partial<View>) => kinds(o).filter(k => k.o == null).map(k => k.k);
    expect(lit({ cat: "t2" })).toEqual(["t2"]);
    expect(kinds({ cat: "t2" }).filter(k => k.o === .2)).toHaveLength(5);
    // Outside the top five: a layer of its own in the neutral ink, after them; Other holds t6 alone.
    expect(kinds({ cat: "t7" }).at(-2)).toEqual({ k: "t7", c: "var(--type-sel)" });
    expect(lit({ cat: "t7" })).toEqual(["t7"]);
    expect(model(wide, { cat: "t7" }).values).toEqual([[7, 6, 5, 4, 3, 1, 2]]);
    expect(lit({ cat: "q" })).toEqual(["__other"]); // a type with no errors here has no layer: Other lights
  });

  it("draws each bar at 72% of its band, 26px at most", () => {
    const stack = byId(model(quiet), "stack"), plot = { x: 0, y: 0, width: 220, height: 100 };
    const width = (band: number) => draw(stack, 0, { ...plot, width: band * 11 }, 0, 10)!.children[0]!.shape.width;
    expect(width(20)).toBeCloseTo(14.4);
    expect(width(40)).toBe(26);
  });

  it("gives each idle point its run, a fold its own", () => {
    expect(model(quiet).idle).toEqual([{ i: 3, first: 3, last: 4 }, { i: 4, first: 3, last: 4 }, { i: 8, first: 8, last: 8 }, { i: 10, first: 10, last: 10 }]);
    expect(model(quiet).pts[8]).toMatchObject({ k: "2026-11-09", to: "2026-11-18" });
  });

  it("marks each applied fix on its point, rows by label, none for an unknown type or a day the chart lacks", () => {
    const fixes = { y: "2026-11-06", x: "2026-11-06", z: "2026-11-20", nope: "2026-11-02", w: "2026-10-01" };
    expect(model(quiet, {}, fixes).fixes).toEqual([
      { i: 5, row: 0, c: "y", label: "A very long error type na…" }, { i: 5, row: 1, c: "x", label: "Type x" }, { i: 10, row: 0, c: "z", label: "Type z" },
    ]);
    expect(model(quiet, { cat: "x" }, fixes).fixes.map(f => f.o)).toEqual([.2, undefined, .2]);
    expect(model(quiet, { gran: "week" }, fixes).fixes.map(f => f.i)).toEqual([1, 1, 3]); // the weeks of Nov 2 and Nov 16, after those of Oct 26 and Nov 9
  });

  it("selects a bucket's point, not a fold's or a key the chart lacks, and marks it on the frame", () => {
    expect(model(quiet, { at: "2026-11-02" }).selected).toBe(1);
    expect(model(quiet, { at: "2026-11-09" }).selected).toBeNull();
    expect(model(quiet, { at: "2026-10-01" }).selected).toBeNull();
    expect(byId(model(quiet), "selected")).toBeUndefined();
    expect(byId(model(quiet, { at: "2026-11-02" }), "selected")).toMatchObject({ xAxisIndex: 0, yAxisIndex: 0, data: [[1, 0]] });
  });

  it("says why it draws nothing: no tool call, or no error", () => {
    expect(model(quiet).bare).toBeNull();
    expect(model(payload([["2026-11-05", 0, {}]])).bare).toBe("empty");
    expect(model(payload([["2026-11-05", 40, {}]])).bare).toBe("noErrors");
    // Nothing drawn, nothing to zoom, at 14 points or more too.
    const calm = model(payload(long.calls.map(c => [c[0], c[2], {}] as Row)));
    expect([calm.pts.length, calm.bare, calm.zoom]).toEqual([20, "noErrors", false]);
  });

  it("keeps the view through the type, the selection, the fixes and a new last point, not through what moves the points", () => {
    const v = model(quiet).view, more = model({ ...quiet, today: "2026-11-21", calls: [...quiet.calls, ["2026-11-21", "foo", 50, 0, "claude"]] });
    expect(model(quiet, { cat: "x", at: "2026-11-02" }, { x: "2026-11-06" }).view).toBe(v);
    expect(more.pts).toHaveLength(12);
    expect(more.view).toBe(v);
    expect(model(quiet, { gran: "week" }).view).not.toBe(v);
    expect(model(quiet, { project: "bar" }).view).not.toBe(v);
    expect(model({ ...quiet, calls: [["2026-10-30", "foo", 5, 0, "claude"], ...quiet.calls] }).view).not.toBe(v); // an earlier first point
    expect(model({ ...quiet, calls: [...quiet.calls, ["2026-11-13", "foo", 5, 0, "claude"]] }).view).not.toBe(v); // the fold opens
  });
});

describe("rateLayout", () => {
  it("holds 320px with both tracks fixed, 348 with the slider from 14 points, 388 at twice the text", () => {
    const q = model(quiet), l = rateLayout(q, 1);
    expect([l.height, l.left, l.right]).toEqual([320, 52, 10]);
    expect(l.tracks).toEqual([{ top: 18, height: 100 }, { top: 144, height: 152 }]);
    expect(rateLayout(q, 2).height).toBe(388);
    expect(rateLayout(q, 2).tracks.map(t => t.height)).toEqual([100, 152]);
    expect(rateLayout(model(long), 1).height).toBe(348);
    expect(model(payload(long.calls.slice(7).map(c => [c[0], c[2], { x: 1 }] as Row))).zoom).toBe(false); // 13 points
    expect(model(payload(long.calls.slice(6).map(c => [c[0], c[2], { x: 1 }] as Row))).zoom).toBe(true); // 14
  });
});

describe("rateOption", () => {
  it("lists the trend first, on the rate track, then the marks, the bars, the bridge, the line, its dots and the fixes", () => {
    const z = model(long, { at: "2026-11-02" }), o = rateOption(z, env());
    expect(ids(o)).toEqual(["trend", "idle", "selected", "stack", "bridge", "rate", "rate-dots", "fixes"]);
    expect(byId(z, "trend")).toMatchObject({ xAxisIndex: 1, yAxisIndex: 1, data: z.totals });
    expect(byId(z, "stack")).toMatchObject({ xAxisIndex: 2, yAxisIndex: 2 });
    expect(o.dataZoom).toEqual([expect.objectContaining({ xAxisIndex: "all", left: 52, right: 10 })]);
    expect(ids(rateOption(model(quiet), env()))).toEqual(["idle", "stack", "bridge", "rate", "rate-dots", "fixes"]);
    expect(rateOption(model(quiet), env()).dataZoom).toBeUndefined();
  });

  it("bridges the gaps with a dotted line under the rate, muted, or in the selected type's color", () => {
    const bridge = (o: Partial<View>) => byId(model(quiet, o), "bridge") as LineSeriesOption;
    expect(bridge({})).toMatchObject({ connectNulls: true, xAxisIndex: 1, data: model(quiet).drawn, lineStyle: { color: "var(--text-muted)", width: 1.25, type: [1, 4], opacity: .7 } });
    expect(bridge({ cat: "x" }).lineStyle!.color).toBe("var(--type-1)");
    expect(byId(model(quiet, { cat: "x" }), "rate")).toMatchObject({ lineStyle: { color: "var(--type-1)" } });
  });

  it("titles each track, cut at the plot's width", () => {
    const [, r, b] = yAxes(model(quiet));
    expect([r!.name, b!.name]).toEqual(["Error rate, % of tool calls", "Failed calls per day, by type"]);
    expect(yAxes(model(quiet, { cat: "x", gran: "week" })).slice(1).map(a => a.name)).toEqual(["Type x rate, % of tool calls", "Failed calls per week, by type"]);
    const e = env(PHONE), cut = axisTitle(e, "Error rate, % of tool calls", 343 - 104 - 20).name;
    expect(cut).toMatch(/…$/);
    expect(yAxes(model(quiet), e)[1]!.name).toBe(cut);
  });
});

// A canvas whose text is 4px a character at 11px.
const stubMeasure = () => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
  font: "", measureText(this: { font: string }, t: string) { return { width: t.length * 4 * +/(\d+(?:\.\d+)?)px/.exec(this.font)![1]! / 11 }; },
} as unknown as CanvasRenderingContext2D);

describe("the marks on the frame", () => {
  beforeEach(stubMeasure);
  const q = model(quiet), plot = frameOf(q), band = plot.width / 11;
  const idleAt = (row: number, from: number, to: number, m = q, p = plot, e = env()) => draw(byId(m, "idle", e), row, p, from, to);

  it("draws a run as one band over the frame from its first point shown, labelled where the label fits", () => {
    const [run, label] = idleAt(0, ...whole(q))!.children;
    expect(run!.shape).toMatchObject({ y: plot.y, height: plot.height });
    expect(run!.shape.x).toBeCloseTo(plot.x + 3 * band);
    expect(run!.shape.width).toBeCloseTo(2 * band);
    expect(run!.style).toEqual({ fill: "var(--surface-2)", opacity: .75 });
    // Centred on the run, at the middle of the bars' track.
    const bars = rateLayout(q, 1).tracks[1]!;
    expect(label!.style).toMatchObject({ text: "no activity", align: "center", y: bars.top + bars.height / 2, fill: "ink-muted" });
    expect(label!.style.x).toBeCloseTo(plot.x + 4 * band);
    expect(idleAt(1, ...whole(q))).toBeNull(); // the run's second point
    // The window starts inside the run: its shown part starts at the plot's edge.
    const cut = idleAt(1, 4, 10)!.children[0]!;
    expect(cut.shape.x).toBeCloseTo(plot.x);
    expect(cut.shape.width).toBeCloseTo(plot.width / 7);
    // 343px: a band of 25px holds no label.
    const phone = frameOf(q, env({ width: 343 }));
    expect(idleAt(3, ...whole(q), q, phone, env({ width: 343 }))!.children.map(c => c.type)).toEqual(["rect"]);
  });

  it("draws // on a fold's band on the frame's bottom line, and a dashed frame with no fill in forced colors", () => {
    const fold = idleAt(2, ...whole(q))!.children.find(c => c.style.text === "//")!;
    expect(fold.style).toMatchObject({ y: plot.y + plot.height, align: "center" });
    expect(fold.style.x).toBeCloseTo(plot.x + 8.5 * band);
    const forced = env({ forced: true }), [rect] = idleAt(0, ...whole(q), q, plot, forced)!.children;
    expect(rect!.style).toEqual({ fill: "none", stroke: "ink-grid", lineWidth: 1, lineDash: [3, 2] });
    expect(rect!.shape.x).toBeCloseTo(plot.x + 3 * band + .5);
    // A run of one band under 2px keeps its frame inside it.
    const narrow = idleAt(3, ...whole(q), q, { ...plot, width: 11 * 1.5 }, forced)!.children[0]!;
    expect([narrow.style.lineWidth, narrow.shape.width]).toEqual([.75, .75]);
  });

  it("draws a fix as a dashed line over the frame with its label beside it, inside the plot or not at all", () => {
    const fixes = { y: "2026-11-06", x: "2026-11-06", z: "2026-11-20" }, f = model(quiet, {}, fixes);
    const at = (row: number, m = f, e = env()) => draw(byId(m, "fixes", e), row, frameOf(m, e), ...whole(m))!.children;
    const [line, label] = at(1), cx = plot.x + 5.5 * band;
    expect(line!.shape).toEqual({ x1: cx, y1: plot.y, x2: cx, y2: plot.y + plot.height });
    expect(line!.style).toEqual({ stroke: "var(--good)", lineWidth: 1.5, lineDash: [4, 3], opacity: 1 });
    expect(label!.style).toMatchObject({ text: "✓ Type x", x: cx + 4, align: "left", y: plot.y + 15, fill: "var(--good-text)" }); // its second row
    expect(at(0)[1]!.style.y).toBe(plot.y + 2);
    // The newest point: "✓ Type z" (32px) would pass the plot's right edge, so it sits left of the line.
    expect(at(2)[1]!.style).toMatchObject({ x: plot.x + 10.5 * band - 4, align: "right" });
    // At twice the text in 343px, the long label fits neither side; the short one still fits right.
    expect(at(0, f, env(PHONE)).map(c => c.type)).toEqual(["line"]);
    expect(at(1, f, env(PHONE))[1]!.style.align).toBe("left");
    // Another type than the selected one: line and label at 20%.
    const dim = at(0, model(quiet, { cat: "x" }, fixes));
    expect(dim.map(c => c.style.opacity)).toEqual([.2, .2]);
    // No wider than its band: 98 weeks in 246px.
    expect(draw(byId(f, "fixes"), 0, { ...plot, width: 11 * 246 / 98 }, ...whole(f))!.children[0]!.style.lineWidth).toBe(1.5);
    expect(draw(byId(f, "fixes"), 0, { ...plot, width: 11 }, ...whole(f))!.children[0]!.style.lineWidth).toBe(1);
  });
});

describe("rateZoomWords", () => {
  it("counts days or weeks, a fold as every bucket it stands for", () => {
    const l = model(long);
    expect(rateZoomWords(l, { from: 10, to: 19 })).toBe("Showing Nov 11 to Nov 20, 10 of 20 days.");
    expect(rateZoomWords(l, null)).toBe("Showing all 20 days.");
    const w = model(weekly, { gran: "week", range: 0 });
    expect(rateZoomWords(w, { from: 0, to: 5 })).toBe("Showing the weeks of Jun 29 to Aug 3, 6 of 20 weeks.");
    expect(rateZoomWords(w, null)).toBe("Showing all 20 weeks.");
    const q = model(quiet);
    expect(rateZoomWords(q, { from: 7, to: 9 })).toBe("Showing Nov 8 to Nov 19, 12 of 20 days.");
    expect(rateZoomWords(q, { from: 2, to: 8 })).toBe("Showing Nov 3 to Nov 18, 16 of 20 days.");
    expect(rateZoomWords(q, null)).toBe("Showing all 20 days.");
  });
});

// The colors the chart hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that
// is not a color resolves to the inherited text color, with no error. As in workTracks.test.ts.
describe("the rate chart's colors", () => {
  const themeCss = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
  const declared = new Map<string, string>();
  for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

  it("hands env.color only declared color tokens, with and without a type", () => {
    const seen = new Set<string>(), recording = env({ color: s => { seen.add(s); return s; } });
    for (const o of [{}, { cat: "t7" }, { cat: "q" }]) rateOption(model(wide, o), recording);
    rateOption(model(quiet, { cat: "x" }, { x: "2026-11-06" }), recording);
    for (const t of ["--surface-2", "--good", "--good-text", "--text-primary", "--text-muted", "--type-sel", "--type-other"]) expect(seen).toContain(`var(${t})`);
    for (const css of seen) {
      const m = /^var\((--[\w-]+)\)$/.exec(css);
      expect(m, `${css} is not a var(--…) token`).not.toBeNull();
      expect(declared.get(m![1]!), `${m![1]} is not hex or rgb() in theme.css`).toMatch(COLOR);
    }
  });
});
