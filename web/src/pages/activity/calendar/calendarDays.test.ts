import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DailyWorkRow } from "../../../api";
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "../../../components/echart/echarts";
import type { ChartEnv } from "../../../components/echart/tokens";
import { dayRange } from "../../../format";
import type { Range } from "../../../url";
import { calendarFit, calendarModel, calendarOption, rangeFor } from "./calendarDays";

type CalendarDays = Parameters<typeof calendarModel>[0];
type CalendarModel = ReturnType<typeof calendarModel>;

const ink = { text: "ink-text", secondary: "ink-secondary", muted: "ink-muted", grid: "ink-grid", surface: "ink-surface",
  border: "ink-border", cursor: "ink-cursor", accent: "ink-accent", tint: "ink-tint" };
const env = (over: Partial<ChartEnv> = {}): ChartEnv => ({ color: s => s, ink, forced: false, textScale: 1, motion: true, width: 343, height: 102, ...over });

const row = (day: string, commits: number, prompts = commits, sessions = 1): DailyWorkRow =>
  ({ day, sessions, prompts, commits, calls: 0, failed_calls: 0 });
// 53 weeks to Wednesday, Nov 18, 2026, recorded from Tuesday, Sep 1. Sep 2 has work and no commit.
const d: CalendarDays = {
  start: "2025-11-17", end: "2026-11-18", first: "2026-09-01",
  days: [row("2026-09-01", 3), row("2026-09-02", 0, 3), row("2026-10-06", 31), row("2026-11-16", 2), row("2026-11-18", 1)],
};
// A 343px box fits 26 weeks; a store recorded for 12 shows the floor of 13, from Monday, Aug 24.
const FIT = calendarFit(343, 1);
const model = (over: Partial<CalendarDays> = {}, sel: Parameters<typeof calendarModel>[3] = null, weeks = FIT.weeks) =>
  calendarModel({ ...d, ...over }, "commits", weeks, sel);
const dayOf = (m: CalendarModel, day: string) => m.days.find(c => c.day === day);
/** Days of commits from Sep 1, one per value. */
const valued = (values: readonly number[]) => dayRange("2026-09-01", "2026-11-18").slice(0, values.length).map((day, i) => row(day, values[i]!));
// 38 values rising to 21, then 30 and 44: 40 days with work, in four steps.
const forty = [...Array.from({ length: 38 }, (_, i) => Math.ceil((i + 1) * 21 / 38)), 30, 44];

const seriesOf = (o: ReturnType<typeof calendarOption>, id: string) => (o.series as CustomSeriesOption[]).find(s => s.id === id);
interface Drawn { type: string; shape: { x: number; y: number; width: number; height: number }; style: { fill: string; stroke?: string; lineWidth?: number } }
/** What a series' renderItem draws for its items, through a stubbed api: the custom series on no coordinate system reads
 *  only its item's value. */
const draw = (s: CustomSeriesOption | undefined) => (s?.data as number[][] | undefined ?? []).map(item => s!.renderItem!(
  { dataIndex: item[0] } as unknown as CustomSeriesRenderItemParams,
  { value: (dim: number) => item[dim]! } as unknown as CustomSeriesRenderItemAPI,
) as unknown as Drawn);
const cells = (m: CalendarModel, e = env()) => draw(seriesOf(calendarOption(m, FIT, e, false), "cells"));
const texts = (m: CalendarModel, fit = FIT, e = env()) =>
  (draw(seriesOf(calendarOption(m, fit, e, false), "labels"))[0] as unknown as { children: { style: { text: string; x: number } }[] }).children.map(c => c.style);

describe("calendarFit", () => {
  it.each([
    // box, text scale, weeks, pitch, cell, height
    [1174, 1, 53, 20, 17, 157],
    [800, 1, 53, 14, 12, 116],
    [343, 1, 26, 12, 10, 102],
    [309, 1, 23, 12, 10, 102],
    [343, 2, 20, 14, 12, 134],
    [1174, 2, 53, 20, 17, 175],
    [240, 2, 12, 14, 12, 134],
  ])("lays %ipx at a text scale of %i in %i weeks of %ipx, %ipx cells, %ipx high", (width, s, weeks, pitch, cell, height) => {
    expect(calendarFit(width, s)).toMatchObject({ weeks, pitch, cell, height, left: 30 * s, top: 18 * s });
  });

  it("keeps the block inside the plot at every width", () => {
    for (const s of [1, 1.25, 2])
      for (let w = 240; w <= 1400; w++) {
        const f = calendarFit(w, s);
        expect(f.weeks * f.pitch - f.gap, `${w}px at ${s}`).toBeLessThanOrEqual(w - f.left - 2);
      }
  });
});

describe("the calendar's steps", () => {
  it.each([
    ["the design's ten values", [1, 1, 1, 2, 2, 3, 5, 8, 13, 40], [[1, 2, 1], [3, 8, 3], [9, 40, 4]]],
    ["every day 1", [1, 1, 1, 1], [[1, 1, 3]]],
    ["two values", [1, 1, 2], [[1, 1, 2], [2, 2, 4]]],
    ["40 days, an open step over the 95th percentile", forty, [[1, 12, 1], [13, 18, 2], [19, 21, 3], [22, null, 4]]],
    ["none above 0", [0, 0], []],
  ] as const)("cuts %s", (_, values, want) => {
    expect(model({ days: valued([...values].reverse()) }).steps).toEqual(want.map(([from, to, shade]) => ({ from, to, shade })));
  });
});

describe("calendarModel", () => {
  it("holds the readable days of the weeks shown, each in its cell, step and shade", () => {
    const m = model();
    expect([m.from, m.weeks]).toEqual(["2026-08-24", 13]);
    // From the first recorded day to today: nothing before Sep 1 or after Nov 18.
    expect(m.days.map(c => c.day)).toEqual(dayRange("2026-09-01", "2026-11-18"));
    expect(m.steps).toEqual([{ from: 1, to: 2, shade: 2 }, { from: 3, to: 31, shade: 4 }]);
    expect(dayOf(m, "2026-09-01")).toMatchObject({ col: 1, row: 1, value: 3, step: 2, shade: 4, busy: true });
    // Work and no commit: step 0, its figures kept.
    expect(dayOf(m, "2026-09-02")).toMatchObject({ col: 1, row: 2, value: 0, step: 0, shade: 0, busy: true, work: { prompts: 3 } });
    expect(dayOf(m, "2026-09-03")).toMatchObject({ step: 0, busy: false, work: row("2026-09-03", 0, 0, 0) });
    // A Monday is row 0; today is in the newest week, the last column.
    expect(dayOf(m, "2026-11-16")).toMatchObject({ col: 12, row: 0, step: 1, shade: 2 });
    expect(m.days.at(-1)).toMatchObject({ day: "2026-11-18", col: 12, row: 2 });
    expect([m.peak?.day, m.peak?.value, m.active]).toEqual(["2026-10-06", 31, 4]);
  });

  it("starts at the first week shown when recording started before it, and holds no day without a recorded one", () => {
    expect(model({ first: "2025-01-01" }).days[0]).toMatchObject({ day: "2026-05-25", col: 0, row: 0 });
    // All 53 weeks: from the payload's start, the scale the same as at 26.
    const all = model({ first: "2025-01-01" }, null, 53);
    expect([all.from, all.weeks, all.days.length]).toEqual(["2025-11-17", 53, 367]);
    expect(all.steps).toEqual(model().steps);
    expect(model({ first: null, days: [] })).toMatchObject({ days: [], steps: [], peak: null, active: 0 });
  });

  it.each([
    // the first recorded day, box, text scale, weeks shown, first Monday shown, first cell's column, readable days
    ["11 weeks old on a desktop: two columns before it", "2026-09-08", 1174, 1, 13, "2026-08-24", 2, 72],
    ["11 weeks old where 12 fit", "2026-09-08", 240, 2, 12, "2026-08-31", 1, 72],
    ["30 weeks old on a phone", "2026-04-28", 343, 1, 26, "2026-05-25", 0, 178],
    ["older than a year", "2025-01-01", 1174, 1, 53, "2025-11-17", 0, 367],
    ["begun this week", "2026-11-18", 1174, 1, 13, "2026-08-24", 12, 1],
    ["never recorded", null, 1174, 1, 53, "2025-11-17", undefined, 0],
  ] as const)("shows the weeks of a store %s", (_, first, width, s, weeks, from, col, n) => {
    const m = calendarModel({ ...d, first, days: first ? d.days.filter(r => r.day >= first) : [] }, "commits", calendarFit(width, s).weeks, null);
    expect([m.weeks, m.from, m.days[0]?.col, m.days.length]).toEqual([weeks, from, col, n]);
    // The newest cell, today, is in the last column shown.
    if (n) expect(m.days.at(-1)).toMatchObject({ day: d.end, col: weeks - 1 });
  });

  it.each([
    ["a day", { day: "2026-10-06", days: 1 }, { col: 6, row: 1, rows: 1 }],
    ["a week", { day: "2026-09-07", days: 7 }, { col: 2, row: 0, rows: 7 }],
    ["the current week, to today", { day: "2026-11-16", days: 7 }, { col: 12, row: 0, rows: 3 }],
    ["the week recording started, from its first day", { day: "2026-08-31", days: 7 }, { col: 1, row: 1, rows: 6 }],
    ["a day before recording", { day: "2026-08-31", days: 1 }, null],
    ["a day before the weeks shown", { day: "2026-03-03", days: 1 }, null],
  ] as const)("places the selection of %s", (_, sel, want) => {
    expect(model({}, sel).selection).toEqual(want);
  });

  it("keeps its view key through newer figures and a selection, not through another measure or other weeks", () => {
    const v = model().view;
    expect(model({ days: [...d.days, row("2026-11-17", 9)] }, { day: "2026-10-06", days: 1 }).view).toBe(v);
    expect(calendarModel(d, "prompts", FIT.weeks, null).view).not.toBe(v);
    expect(model({}, null, 12).view).not.toBe(v); // fewer than the 13 fit
    expect(model({ end: "2026-11-23" }).view).not.toBe(v); // the same 13 weeks a week later
  });
});

describe("rangeFor", () => {
  it.each([
    ["inside the range", "2026-11-14", 7, 7],
    ["8 days back", "2026-11-10", 7, 14],
    ["20 days back", "2026-10-29", 7, 30],
    ["50 days back", "2026-09-29", 7, 90],
    ["120 days back", "2026-07-21", 7, 0],
    ["all time", "2025-11-17", 0, 0],
  ] as const)("keeps or widens the range for a day %s", (_, day, range, want) => {
    expect(rangeFor(day, "2026-11-18", range as Range)).toBe(want);
  });
});

describe("calendarOption", () => {
  it("draws on no grid or axis, never animates, and takes the pointer only with a pick", () => {
    const o = calendarOption(model(), FIT, env(), false);
    for (const k of ["grid", "xAxis", "yAxis", "dataZoom"]) expect(o).not.toHaveProperty(k);
    expect(o.animation).toBe(false);
    expect((o.series as CustomSeriesOption[]).map(s => [s.id, s.coordinateSystem, s.silent])).toEqual([["cells", "none", true], ["labels", "none", true]]);
    expect(seriesOf(calendarOption(model(), FIT, env(), true), "cells")!.silent).toBe(false);
    const framed = calendarOption(model({}, { day: "2026-10-06", days: 1 }), FIT, env(), true);
    expect(seriesOf(framed, "selected")).toMatchObject({ coordinateSystem: "none", silent: true, z: 3 });
  });

  it("puts each cell at the fit's pixel in its shade's token, or the grid ink for none of the measure", () => {
    const m = model(), drawn = cells(m);
    expect(drawn).toHaveLength(m.days.length);
    const at = (day: string) => drawn[m.days.findIndex(c => c.day === day)]!;
    // Sep 1: column 1, row 1, in a 12px pitch from (30, 18).
    expect(at("2026-09-01")).toMatchObject({ type: "rect", shape: { x: 42, y: 30, width: 10, height: 10 }, style: { fill: "var(--heat-4)" } });
    expect(at("2026-11-16")).toMatchObject({ shape: { x: 174, y: 18 }, style: { fill: "var(--heat-2)" } });
    expect(at("2026-09-02").style).toEqual({ fill: "ink-grid" });
  });

  it("draws shades as squares of growing side in the text ink under forced colors, and none of the measure as an edge", () => {
    // Four steps: Sep 1 to Oct 10.
    const m = model({ days: valued(forty) }), drawn = cells(m, env({ forced: true }));
    const byShade = [1, 2, 3, 4].map(s => drawn[m.days.findIndex(c => c.shade === s)]!);
    expect(byShade.map(r => r.shape.width)).toEqual([3, 5, 8, 10]);
    for (const [i, r] of byShade.entries()) {
      const c = m.days.find(x => x.shade === i + 1)!;
      expect(r.shape.height).toBe(r.shape.width);
      expect(r.shape.x + r.shape.width / 2).toBe(30 + c.col * 12 + 5); // centred in its cell
      expect(r.shape.y + r.shape.height / 2).toBe(18 + c.row * 12 + 5);
      expect(r.style).toEqual({ fill: "ink-text" });
    }
    const empty = drawn[m.days.findIndex(c => c.day === "2026-10-11")]!;
    expect(empty).toMatchObject({ shape: { width: 9, height: 9 }, style: { fill: "none", stroke: "ink-grid", lineWidth: 1 } });
  });

  it.each([
    ["a day", { day: "2026-10-06", days: 1 }, false, { x: 102.75, y: 30.75, width: 8.5, height: 8.5 }, 1.5],
    ["a week, under forced colors", { day: "2026-09-07", days: 7 }, true, { x: 55, y: 19, width: 8, height: 80 }, 2],
  ] as const)("frames the cells of %s in the accent, unfilled", (_, sel, forced, shape, lineWidth) => {
    const [frame] = draw(seriesOf(calendarOption(model({}, sel), FIT, env({ forced }), true), "selected"));
    expect(frame).toEqual({ type: "rect", emphasisDisabled: true, shape, style: { fill: "none", stroke: "ink-accent", lineWidth } });
  });

  it.each([
    // Aug holds the first two columns: Sep's name starts 24px after it.
    ["the cut first month", {}, ["Sep", "Oct", "Nov"]],
    // 26 weeks recorded; the newest starts June: its name would end past the box.
    ["a month in the last column", { start: "2025-06-02", end: "2026-06-03", first: "2025-06-02" }, ["Dec", "Jan", "Feb", "Mar", "Apr", "May"]],
  ])("names the weekdays and the months, leaving out %s", (_, over, months) => {
    const labels = texts(model(over));
    expect(labels.map(l => l.text)).toEqual(["Mon", "Wed", "Fri", ...months]);
    expect(labels[0]).toMatchObject({ x: 24, y: 23, align: "right", fill: "ink-muted", fontSize: 11 });
    expect(labels[3]).toMatchObject({ align: "left", y: 14 });
    // At twice the text the labels double and keep to their margins.
    expect(texts(model(over), calendarFit(1174, 2), env({ textScale: 2 }))[0]).toMatchObject({ x: 48, fontSize: 22 });
  });
});

// The colors the option hands to env.color must be tokens theme.css declares as colors zrender's parser reads: a token that
// is not a color resolves to the inherited text color, with no error. As in outcomeWeeks.test.ts.
describe("the calendar's colors", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Map<string, string>();
  for (const block of strip(readFileSync("src/theme.css", "utf8")).matchAll(/(?:^|\n):root \{([^}]*)\}/g)) // vitest runs from web/
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());
  const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
  const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

  it("hands env.color only declared color tokens", () => {
    const seen = new Set<string>();
    const values = [1, 1, 1, 2, 2, 3, 5, 8, 13, 40, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 60];
    const m = model({ days: valued(values) },{ day: "2026-09-07", days: 7 });
    cells(m, env({ color: s => { seen.add(s); return s; } }));
    expect([...seen].sort()).toEqual(["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"]);
    for (const css of seen) {
      const name = /^var\((--[\w-]+)\)$/.exec(css)![1]!;
      expect(declared.get(name), `${name} is not a hex or rgb() color in theme.css`).toMatch(COLOR);
    }
  });
});
