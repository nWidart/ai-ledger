import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import type { ErrorsPayload } from "../../api";
import {
  beforeAfter, breakdown, bucketLabel, bucketOf, buckets, byWeight, change, chartData, compare, emptyTypes, exList, filtered, inBucket, incidentsOf, inTool, incSummary, makeModel, midDay, pointText,
  rangeStart, series, settle, summary, timeLost, typeColors, typeRows, uncategorized, viewTypes, whereToStart, withMuted, errorDays, type Err, type View,
} from "./model";
import { lostPayload } from "./lostData";
import { DEFAULT_VIEW, loadFixes, loadMode, readView, savedOf, viewHash, viewPatch } from "./view";

const m = makeModel(fixture);
const v = (o: Partial<View> = {}): View => ({ ...DEFAULT_VIEW, ...o });
// The fixture's errors all fall on Nov 4; two of them move to Nov 3 (a Tuesday, in the week of Nov 2) so a bucket splits them.
const two = makeModel({ ...fixture,
  errors: fixture.errors.map((e, i) => (i < 2 ? { ...e, d: "2026-11-03" } : e)),
  error_days: [["2026-11-03", "foo", "x", 2, 0, "claude"], ["2026-11-04", "foo", "x", 4, 0, "claude"]],
  calls: [["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]] });

afterEach(() => { vi.useRealTimers(); });

describe("ranges", () => {
  it("anchor on the payload's today, not the reader's clock", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2027-03-01T12:00:00Z"));
    const mm = makeModel(fixture);
    expect(mm.lastDay).toBe("2026-11-05");
    expect(rangeStart(mm, v({ range: 7 }))).toBe("2026-10-30");
    const keys = buckets(mm, rangeStart(mm, v({ range: 7 })), "day");
    expect(keys).toHaveLength(7);
    expect(keys.at(-1)).toBe("2026-11-05");
    // All time starts at the first day with tool calls.
    expect(rangeStart(mm, v({ range: 0 }))).toBe("2026-11-04");
  });
  it("buckets weeks from Monday", () => {
    expect(bucketOf("2026-11-05", "week")).toBe("2026-11-02");
    expect(bucketOf("2026-11-02", "week")).toBe("2026-11-02");
    expect(buckets(m, "2026-10-30", "week")).toEqual(["2026-10-26", "2026-11-02"]);
  });
});

describe("filtering and series", () => {
  it("says a project has no calls only within the chosen source", () => {
    const p = fixture.errors[0]!.p;
    expect(emptyTypes(m, v({ project: p }), filtered(m, v({ project: p })))).not.toMatch(/No tool calls recorded/);
    expect(emptyTypes(m, v({ project: p, source: "codex" }), filtered(m, v({ project: p, source: "codex" }))))
      .toBe(`No tool calls recorded for ${p}.`);
  });
  it("filters by project, subagents and noise", () => {
    expect(filtered(m, v()).errs).toHaveLength(6);
    expect(filtered(m, v({ project: "bar" })).errs).toHaveLength(0);
    expect(filtered(m, v({ project: "bar" })).calls).toHaveLength(0);
    const p: ErrorsPayload = { ...fixture, errors: fixture.errors.map((e, i) => ({ ...e, sub: i < 2 ? 1 : 0, c: i === 5 ? "infra" : e.c })) };
    const mm = makeModel(p);
    expect(filtered(mm, v({ sub: false })).errs).toHaveLength(4);
    expect(filtered(mm, v({ noise: true })).errs).toHaveLength(5);
  });
  it("leaves out days after today, as the chart has no bucket for them", () => {
    const late = { ...fixture, errors: fixture.errors.map((e, i) => (i ? e : { ...e, d: "2026-11-06" })),
      calls: [...fixture.calls, ["2026-11-06", "foo", 3, 0, "claude"]] } as ErrorsPayload;
    const f = filtered(makeModel(late), v());
    expect(f.errs).toHaveLength(fixture.errors.length - 1);
    expect(f.calls).toHaveLength(fixture.calls.length);
  });
  it("rates per bucket, null without calls", () => {
    const f = filtered(m, v({ range: 7 })), keys = buckets(m, f.start, "day");
    const pts = series(v(), f.errs, f.calls, keys);
    expect(pts.find(p => p.k === "2026-11-04")).toEqual({ k: "2026-11-04", e: 6, c: 10, r: 60 });
    expect(pts.find(p => p.k === "2026-11-05")?.r).toBeNull();
  });
  it("change compares the same sides everywhere, with enough calls on both", () => {
    // 11 calls in June, then the real activity: all time splits its calls in half, so June can't make a side of its own.
    const ed = (d: string, c: string, n: number) => [d, "foo", c, n, 0, "claude"] as [string, string, string, number, number, "claude"];
    const p: ErrorsPayload = { ...fixture,
      calls: [["2026-06-01", "foo", 11, 0, "claude"], ["2026-10-20", "foo", 1000, 0, "claude"], ["2026-10-21", "foo", 1000, 0, "claude"], ["2026-11-04", "foo", 1000, 0, "claude"]],
      error_days: [ed("2026-06-01", "y", 0), ed("2026-10-20", "x", 10), ed("2026-11-04", "x", 20), ed("2026-11-04", "y", 8), ed("2026-10-20", "z", 1), ed("2026-11-04", "z", 2)] };
    const mm = makeModel(p), all = v({ range: 0 }), f = filtered(mm, all), x = compare(mm, all, f);
    expect(f.from).toBe("2026-06-01");
    expect(midDay(all, f)).toBe("2026-10-21");
    expect(x).toMatchObject({ cmp: "vs before Oct 21", why: null, a: { c: 1011, e: 11 }, b: { c: 2000, e: 30 } });
    expect(change(x, "x", 5)).toMatchObject({ text: "1%", cls: "muted" });
    // Too few errors on a side for a percent: the counts, never "New".
    expect(change(x, "y", 5)).toMatchObject({ text: "0 → 8", cls: "muted" });
    expect(change(x, "z", 5).text).toBe("1 → 2");
    expect(whereToStart(mm, all, f, {}).rising.map(r => [r.c, r.e1, r.e2, r.d])).toEqual([["y", 0, 8, Infinity]]);
    // A range compares with the days before it; without enough calls there, nothing shows.
    const wk = v({ range: 7 }), xw = compare(mm, wk, filtered(mm, wk));
    expect(xw).toMatchObject({ cmp: "vs previous 7 days", why: "Fewer than 200 tool calls in the 7 days before" });
    expect(change(xw, "x")).toEqual({ text: "–", cls: "muted", title: xw.why, pct: null });
    expect(whereToStart(mm, wk, filtered(mm, wk), {})).toMatchObject({ rising: [], why: xw.why });
    const two = v({ range: 14 }), s14 = summary(mm, two, filtered(mm, two), {});
    expect(s14).toMatchObject({ cmp: "vs previous 14 days", why: null, r0: 11 / 2000 * 100, r1: 3 });
  });
  it("charts start at the range's first day with calls", () => {
    const p: ErrorsPayload = { ...fixture, calls: [["2026-11-03", "foo", 5, 0, "claude"], ["2026-11-04", "bar", 5, 0, "claude"]] };
    const mm = makeModel(p), vv = v({ range: 30, project: "bar" }), f = filtered(mm, vv);
    expect(f.from).toBe("2026-11-04");
    expect(chartData(mm, vv, f, viewTypes(mm, vv, f)).keys).toEqual(["2026-11-04", "2026-11-05"]);
    // A long stretch without calls folds into one bucket.
    const far: ErrorsPayload = { ...fixture, calls: [["2026-10-01", "foo", 5, 0, "claude"], ...fixture.calls] }, fm = makeModel(far), all = v({ range: 0 });
    const ff = filtered(fm, all), { keys, pts } = chartData(fm, all, ff, viewTypes(fm, all, ff));
    expect(keys).toEqual(["2026-10-01", "2026-10-02", "2026-11-04", "2026-11-05"]);
    expect(pts[1]).toMatchObject({ c: 0, to: "2026-11-03" });
    expect(pointText(fm, all, pts[1]!, viewTypes(fm, all, ff))).toBe("Oct 2, 2026 – Nov 3, 2026: no activity");
  });
});

describe("types", () => {
  it("keep the all-time top five's colors and fill free slots", () => {
    const rank = ["a", "b", "c", "d", "e", "f"];
    expect(typeColors(rank, ["c", "f", "a"])).toEqual({ c: "var(--type-3)", a: "var(--type-1)", f: "var(--type-2)" });
  });
  it("name an unknown type by its id and give a selected type outside the top its own layer", () => {
    expect(m.cats.x?.label).toBe("x");
    const p: ErrorsPayload = { ...fixture, errors: fixture.errors.map((e, i) => ({ ...e, c: ["a", "b", "c", "d", "e", "f"][i]! })),
      error_days: ["a", "b", "c", "d", "e", "f"].map(c => ["2026-11-04", "foo", c, c === "f" ? 1 : 2, 0, "claude"] as [string, string, string, number, number, "claude"]) };
    const mm = makeModel(p), vv = v({ cat: "f" }), vt = viewTypes(mm, vv, filtered(mm, vv));
    expect(vt.top).toHaveLength(5);
    expect(vt.extra).toBe("f");
    expect(vt.colors.f).toBe("var(--type-sel)");
    const { pts } = chartData(mm, vv, filtered(mm, vv), vt), p4 = pts.find(x => x.k === "2026-11-04")!;
    expect(p4.e).toBe(11);
    expect(p4.other).toBe(0);
    expect(pointText(mm, vv, p4, vt)).toContain("Selected f: 1");
  });
  it("table rows carry share, color and the change the summary shows", () => {
    const rows = typeRows(m, v(), filtered(m, v()));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cid: "x", n: 6, lost: 186e3, share: 1, color: "var(--type-1)" });
    // No calls in the 30 days before: nothing to compare with.
    expect(rows[0]!.delta).toMatchObject({ text: "–", title: "Fewer than 200 tool calls in the 30 days before" });
  });
  it("table rows carry the rate, the share of incidents that didn't recover and the change's percent, under a bucket too", () => {
    const e = (id: string, d: string, n: number | null) => ({ id, ts: `${d}T10:00:00.000Z`, d, p: "foo", s: "s1", t: "Edit", c: "x", i: "", e: "", r: "", sub: 0 as const, src: "claude" as const, n });
    const inc = (outcome: string) => ({ s: "s1", t: "Edit", c: "x", p: "foo", sub: 0, first: null, last: null, ok: 0, outcome, rid: null, ri: "", rts: null });
    const errors = [e("a", "2026-11-03", 0), e("b", "2026-11-03", 0), e("c", "2026-11-04", 1), e("d", "2026-11-04", 2), e("f", "2026-11-04", null)];
    const mm = makeModel({ ...fixture, errors, incidents: [inc("recovered"), inc("gave_up"), inc("failed_again")] as ErrorsPayload["incidents"],
      error_days: [["2026-11-03", "foo", "x", 2, 0, "claude"], ["2026-11-04", "foo", "x", 3, 0, "claude"]],
      calls: [["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 40, 0, "claude"]] });
    const row = (o: Partial<View> = {}) => typeRows(mm, v(o), filtered(mm, v(o)))[0]!;
    // The view: 5 errors over 50 calls; 3 incidents, 2 of them not recovered.
    expect(row()).toMatchObject({ rate: 10, inc: 3, bad: 2 });
    expect(row().unrec).toBeCloseTo(200 / 3);
    // Nov 3: its 2 errors over its 10 calls, one incident that recovered. Nov 4: 3 errors over 40 calls, 2 incidents, both bad.
    expect(row({ at: "2026-11-03" })).toMatchObject({ rate: 20, inc: 1, bad: 0, unrec: 0 });
    expect(row({ at: "2026-11-04" })).toMatchObject({ rate: 7.5, inc: 2, bad: 2, unrec: 100 });
    // A week holds both days.
    expect(row({ gran: "week", at: "2026-11-02" })).toMatchObject({ rate: 10, inc: 3, bad: 2 });
    // No calls: no rate. No incident: no share.
    expect(typeRows(mm, v(), { ...filtered(mm, v()), calls: [] })[0]!.rate).toBeNull();
    const none = makeModel({ ...fixture, errors: [e("z", "2026-11-04", null)], error_days: [["2026-11-04", "foo", "x", 1, 0, "claude"]] });
    expect(typeRows(none, v(), filtered(none, v()))[0]).toMatchObject({ inc: 0, bad: 0, unrec: null });
  });
  it("divides a type's errors by the calls the subagent toggle counts", () => {
    const e = (id: string, sub: 0 | 1) => ({ id, ts: "2026-11-04T10:00:00.000Z", d: "2026-11-04", p: "foo", s: "s1", t: "Edit", c: "x", i: "", e: "", r: "", sub, src: "claude" as const, n: null });
    // Nov 4: 100 calls, 60 of them by subagents; 2 errors by the main thread, 2 by a subagent.
    const mm = makeModel({ ...fixture, errors: [e("a", 0), e("b", 0), e("c", 1), e("d", 1)], error_days: [["2026-11-04", "foo", "x", 4, 2, "claude"]], calls: [["2026-11-04", "foo", 100, 60, "claude"]] });
    const rateOf = (o: Partial<View>) => typeRows(mm, v(o), filtered(mm, v(o)))[0]!.rate;
    expect(rateOf({ sub: true })).toBe(4); // 4 errors over 100 calls
    expect(rateOf({ sub: false })).toBe(5); // 2 errors over the 40 main-thread calls
  });
  it("gives a week bucket that starts before the range the rate of the chart's point for it", () => {
    const e = (id: string, d: string) => ({ id, ts: `${d}T10:00:00.000Z`, d, p: "foo", s: "s1", t: "Edit", c: "x", i: "", e: "", r: "", sub: 0 as const, src: "claude" as const, n: null });
    // A 7-day range ends Nov 5 and starts Fri Oct 30; its first week (Monday Oct 26) holds Oct 30, 31 and Nov 1. Oct 28 is outside the range:
    // its 1000 calls and its error must not count.
    const mm = makeModel({ ...fixture, errors: [e("a", "2026-10-28"), e("b", "2026-10-30"), e("c", "2026-11-01"), e("d", "2026-11-03")],
      error_days: [["2026-10-28", "foo", "x", 1, 0, "claude"], ["2026-10-30", "foo", "x", 1, 0, "claude"], ["2026-11-01", "foo", "x", 1, 0, "claude"], ["2026-11-03", "foo", "x", 1, 0, "claude"]],
      calls: [["2026-10-28", "foo", 1000, 0, "claude"], ["2026-10-30", "foo", 10, 0, "claude"], ["2026-11-01", "foo", 10, 0, "claude"], ["2026-11-03", "foo", 50, 0, "claude"]] });
    const vv = v({ range: 7, gran: "week", at: "2026-10-26" }), f = filtered(mm, vv);
    const pt = chartData(mm, vv, f, viewTypes(mm, vv, f)).pts.find(p => p.k === "2026-10-26")!;
    expect(pt).toMatchObject({ c: 20, e: 2 });
    expect(typeRows(mm, vv, f)[0]).toMatchObject({ n: 2, rate: 10 });
    expect(typeRows(mm, vv, f)[0]!.rate).toBe(pt.r);
  });
  it("carries the percent the change cell shows, and none for counts or a missing comparison", () => {
    const r = typeRows(m, v(), filtered(m, v()))[0]!;
    expect(r.delta.pct).toBeNull(); // "–": no calls in the 30 days before
    const c = (a: number, b: number) => ({ a: { c: 1000, e: a, by: { x: a } }, b: { c: 1000, e: b, by: { x: b } }, cmp: "", why: null });
    expect(change(c(6, 12), "x", 5)).toMatchObject({ text: "▲ +100%", pct: 100 });
    expect(change(c(18, 9), "x", 5)).toMatchObject({ text: "▼ -50%", pct: -50 });
    expect(change(c(6, 6), "x", 5)).toMatchObject({ text: "0%", pct: 0 });
    expect(change(c(1, 3), "x", 5)).toMatchObject({ text: "1 → 3", pct: null });
    expect(change({ ...c(6, 12), why: "no" }, "x", 5)).toMatchObject({ text: "–", pct: null });
  });
  it("closes a type with no errors in the view unless an example is linked", () => {
    expect(settle(m, v({ cat: "x" })).cat).toBe("x");
    expect(settle(m, v({ cat: "x", project: "bar" })).cat).toBeNull();
    expect(settle(m, v({ cat: "x", project: "bar", focus: "t01" })).cat).toBe("x");
  });
});

describe("bucket selection", () => {
  it("narrows the type table and the detail's errors, not the range-wide figures", () => {
    const vv = v({ at: "2026-11-03" }), f = filtered(two, vv);
    expect(inBucket(vv, f.errs)).toHaveLength(2);
    expect(inBucket(v(), f.errs)).toHaveLength(6);
    expect(typeRows(two, vv, f)[0]).toMatchObject({ cid: "x", n: 2, share: 1 });
    // The trend and the change stay range-wide, and so do the summary and the chart.
    expect(typeRows(two, vv, f)[0]!.pts.reduce((n, p) => n + p.e, 0)).toBe(6);
    expect(typeRows(two, vv, f)[0]!.delta).toEqual(typeRows(two, v(), f)[0]!.delta);
    expect(summary(two, vv, f, {}).n).toBe(6);
    expect(chartData(two, vv, f, viewTypes(two, vv, f)).pts.map(p => p.e)).toEqual([2, 4, 0]);
  });
  it("buckets a week by its Monday", () => {
    const vv = v({ gran: "week", at: "2026-11-02" });
    expect(inBucket(vv, filtered(two, vv).errs)).toHaveLength(6);
    expect(bucketLabel(two, vv)).toBe("Week of Nov 2");
    expect(bucketLabel(two, v({ at: "2026-11-03" }))).toBe("Nov 3");
  });
  it("marks the selected point for the keyboard reading", () => {
    const vv = v({ at: "2026-11-03" }), f = filtered(two, vv), vt = viewTypes(two, vv, f), { pts } = chartData(two, vv, f, vt);
    expect(pointText(two, vv, pts[0]!, vt)).toContain("Nov 3, 2026 (selected):");
    expect(pointText(two, vv, pts[1]!, vt)).not.toContain("selected");
  });
  it("clears when it no longer names a bucket of the view", () => {
    expect(settle(two, v({ at: "2026-11-03" })).at).toBe("2026-11-03");
    expect(settle(two, v({ at: "2026-11-03", gran: "week" })).at).toBeNull(); // not a Monday
    expect(settle(two, v({ at: "2026-11-02", gran: "week" })).at).toBe("2026-11-02");
    expect(settle(two, v({ at: "2026-11-03", range: 7 })).at).toBe("2026-11-03");
    expect(settle(two, v({ at: "2026-10-01", range: 7 })).at).toBeNull(); // before the range
    expect(settle(two, v({ at: "2026-11-06" })).at).toBeNull(); // after today
  });
  it("closes an open type with no errors in the bucket, unless an example is linked", () => {
    expect(settle(two, v({ cat: "x", at: "2026-11-03" })).cat).toBe("x");
    expect(settle(two, v({ cat: "x", at: "2026-11-05" })).cat).toBeNull(); // a drawn day without errors
    expect(settle(two, v({ cat: "x", at: "2026-11-05", focus: "t01" }))).toMatchObject({ cat: "x", at: "2026-11-05" });
  });
  it("clears a bucket the chart doesn't draw as a selectable point", () => {
    // Project bar's first call is Nov 4: its chart starts there, so Nov 3 is no point of it.
    const late = makeModel({ ...fixture, calls: [["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"], ["2026-11-04", "bar", 10, 0, "claude"]] });
    expect(settle(late, v({ at: "2026-11-03" })).at).toBe("2026-11-03");
    expect(settle(late, v({ at: "2026-11-03", project: "bar" })).at).toBeNull();
    expect(settle(late, v({ at: "2026-11-04", project: "bar" })).at).toBe("2026-11-04");
    // Calls on Oct 10 and Nov 4 only: the stretch between folds into one point keyed by its first day.
    const fold = makeModel({ ...fixture, calls: [["2026-10-10", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]] });
    expect(settle(fold, v({ at: "2026-10-10" })).at).toBe("2026-10-10");
    expect(settle(fold, v({ at: "2026-10-11" })).at).toBeNull(); // the fold's own key
    expect(settle(fold, v({ at: "2026-10-20" })).at).toBeNull(); // inside it
    expect(settle(fold, v({ at: "2026-11-04" })).at).toBe("2026-11-04");
    // A project filter folding the selected day into a gap clears it too.
    const gap = makeModel({ ...fixture, calls: [["2026-10-10", "foo", 10, 0, "claude"], ["2026-10-20", "bar", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]] });
    expect(settle(gap, v({ at: "2026-10-20" })).at).toBe("2026-10-20");
    expect(settle(gap, v({ at: "2026-10-20", project: "foo" })).at).toBeNull();
  });
  it("narrows a week to its own errors, a week that starts before the range included", () => {
    // Range 7 starts Fri Oct 30: the week of Mon Oct 26 is cut by it, and its Oct 28 error lies before the range.
    const day = (id: string, d: string) => ({ ...fixture.errors.find(e => e.id === id)!, d });
    const wk = makeModel({ ...fixture,
      errors: [day("t01", "2026-10-28"), day("t02", "2026-10-30"), day("t03", "2026-10-31"), day("t04", "2026-11-03"), day("t07", "2026-11-04"), day("t08", "2026-11-04")],
      error_days: [["2026-10-28", "foo", "x", 1, 0, "claude"], ["2026-10-30", "foo", "x", 1, 0, "claude"], ["2026-10-31", "foo", "x", 1, 0, "claude"],
        ["2026-11-03", "foo", "x", 1, 0, "claude"], ["2026-11-04", "foo", "x", 2, 0, "claude"]],
      calls: ["2026-10-30", "2026-10-31", "2026-11-03", "2026-11-04"].map(d => [d, "foo", 10, 0, "claude"] as [string, string, number, number, "claude"]) });
    const first = v({ range: 7, gran: "week", at: "2026-10-26" }), second = v({ range: 7, gran: "week", at: "2026-11-02" });
    expect(settle(wk, first).at).toBe("2026-10-26");
    expect(filtered(wk, first).errs).toHaveLength(5);
    expect(inBucket(first, filtered(wk, first).errs).map(e => e.id)).toEqual(["t02", "t03"]);
    expect(inBucket(second, filtered(wk, second).errs).map(e => e.id)).toEqual(["t04", "t07", "t08"]);
    expect(typeRows(wk, first, filtered(wk, first))[0]).toMatchObject({ n: 2, share: 1 });
    expect(typeRows(wk, second, filtered(wk, second))[0]).toMatchObject({ n: 3, share: 1 });
  });
  it("words an empty bucket", () => {
    const vv = v({ at: "2026-11-02" });
    expect(emptyTypes(two, vv, filtered(two, vv))).toBe("No errors in this day.");
  });
  it("counts the list in the bucket", () => {
    const vv = v({ at: "2026-11-03" }), base = inBucket(vv, filtered(two, vv).errs).slice().reverse();
    expect(exList(base, incSummary(two, base).groups, true, "", undefined, "day").count).toBe("2 in day, newest first");
  });
});

describe("incidents", () => {
  it("group the view's failures by the server's incident, in call order", () => {
    const g = incidentsOf(m, filtered(m, v()).errs.slice().reverse());
    expect(g.map(x => [x.t, x.errs.length, x.outcome])).toEqual([["mcp__srv__q", 1, "recovered"], ["Bash", 1, "gave_up"], ["Edit", 4, "gave_up"]]);
    expect(g.find(x => x.t === "Edit")!.errs.map(e => e.id)).toEqual(["t01", "t02", "t03", "t04"]);
    expect(g.sort(byWeight)[0]!.t).toBe("Edit");
  });
  it("count recovery: only a successful next call recovers", () => {
    const s = incSummary(m, filtered(m, v()).errs);
    expect(s.n).toBe(3);
    expect(s.bad).toBe(2);
    expect(Math.round(s.pct)).toBe(67);
    const rec = s.groups.find(x => x.outcome === "recovered")!;
    expect(rec).toMatchObject({ rid: "t09", rts: "2026-11-04T10:09:00.000Z" });
  });
  it("count only failures that pass the filters", () => {
    const s = incSummary(m, filtered(m, v()).errs.filter(e => e.t !== "Edit" || e.id === "t04"));
    expect(s.groups.find(x => x.t === "Edit")!.errs).toHaveLength(1);
  });
  it("list by search, with the linked incident first", () => {
    const f = filtered(m, v()), base = f.errs.slice().reverse(), groups = incSummary(m, base).groups.sort(byWeight);
    expect(exList(base, groups, false, "", undefined).count).toBe("3 in range, most attempts first");
    const l = exList(base, groups, false, "bash", m.byId.t08);
    expect(l.count).toBe("1 of 3 match");
    const linked = exList(base, groups, false, "", m.byId.t08);
    expect((linked.items[0] as { t: string }).t).toBe("mcp__srv__q");
    const flat = exList(base, groups, true, "", m.byId.t01);
    expect(flat.items.map(e => (e as { id: string }).id)).toEqual(["t01", "t08", "t07", "t04", "t03", "t02"]);
    expect(flat.count).toBe("6 in range, newest first");
  });
});

describe("uncategorized", () => {
  const e = (c: string, src: "claude" | "codex") => ({ c, src }) as Err;
  it("is empty with no errors", () => {
    expect(uncategorized([])).toEqual({ n: 0, share: 0, bySource: [] });
  });
  it("counts the catch-all types of one source", () => {
    const u = uncategorized([e("other", "claude"), e("x", "claude"), e("mcp", "claude"), e("x", "claude")]);
    expect(u.n).toBe(2);
    expect(u.share).toBe(0.5);
    expect(u.bySource).toEqual([["claude", 2, 0.5]]);
  });
  it("splits the share by source, ordered by source name", () => {
    // Codex first in the input, so the order comes from the sort, not from insertion.
    const u = uncategorized([e("exit_other", "codex"), e("mcp", "codex"), e("x", "codex"), e("other", "claude"), e("x", "claude"), e("x", "claude"), e("x", "claude")]);
    expect(u.n).toBe(3);
    expect(u.share).toBeCloseTo(3 / 7);
    expect(u.bySource.map(([s]) => s)).toEqual(["claude", "codex"]);
    expect(u.bySource[0]![1]).toBe(1);
    expect(u.bySource[0]![2]).toBeCloseTo(0.25);
    expect(u.bySource[1]![1]).toBe(2);
    expect(u.bySource[1]![2]).toBeCloseTo(2 / 3);
  });
  it("is zero when no error is a catch-all", () => {
    const u = uncategorized([e("x", "claude"), e("y", "codex")]);
    expect(u).toEqual({ n: 0, share: 0, bySource: [["claude", 0, 0], ["codex", 0, 0]] });
  });
});

describe("time lost", () => {
  const mm = makeModel(lostPayload), vv = v({ range: 0 }), min = 60e3;
  it("sums each type's incident spans; no span reads as none", () => {
    expect(timeLost(mm, filtered(mm, vv).errs)).toEqual({ worktree: min, git: 20 * min, sleep_poll: 0, tests: min });
    const rows = Object.fromEntries(typeRows(mm, vv, filtered(mm, vv)).map(r => [r.cid, r.lost]));
    expect(rows).toEqual({ worktree: min, git: 20 * min, sleep_poll: 0, tests: min });
    // The table keeps its order by error count.
    expect(typeRows(mm, vv, filtered(mm, vv)).map(r => r.cid).slice(0, 2)).toEqual(["worktree", "git"]);
  });
  it("counts an incident whole when one of its failures is in the view", () => {
    // Range 7 days (from Oct 30): git's second incident has only its Oct 30 failure in the view, yet its whole 10 min counts.
    const one = v({ range: 7 }), f = filtered(mm, one);
    expect(f.errs.map(e => e.id)).not.toContain("g2");
    expect(f.errs.map(e => e.id)).toContain("g3");
    expect(timeLost(mm, f.errs).git).toBe(20 * min);
  });
  it("follows a selected bucket: its errors' incidents, each whole, while Where to start stays range-wide", () => {
    const lostOf = (at: string) => { const x = v({ range: 0, at }), f = filtered(mm, x); return Object.fromEntries(typeRows(mm, x, f).map(r => [r.cid, r.lost])); };
    // Oct 30 holds only g3, the end of git's midnight incident: all 10 min of it, not the 20 of the range.
    expect(lostOf("2026-10-30")).toEqual({ git: 10 * min });
    expect(lostOf("2026-10-29")).toEqual({ git: 10 * min });
    expect(lostOf("2026-11-04")).toEqual({ worktree: min, git: 10 * min, sleep_poll: 0, tests: min });
    const x = v({ range: 0, at: "2026-10-30" });
    expect(whereToStart(mm, x, filtered(mm, x), {}).open[0]).toEqual({ c: "git", n: 3, lost: 20 * min });
  });
  it("ranks open fixes by time lost, then by error count", () => {
    const f = filtered(mm, vv);
    // git has fewer errors than worktree but lost far more time; tests ties worktree on time and has fewer errors.
    expect(whereToStart(mm, vv, f, {}).open).toEqual([
      { c: "git", n: 3, lost: 20 * min }, { c: "worktree", n: 4, lost: min }, { c: "tests", n: 1, lost: min }, { c: "sleep_poll", n: 1, lost: 0 }]);
  });
});

describe("summary and fixes", () => {
  it("sums the view: rate, previous period, incidents, open fixes", () => {
    const s = summary(m, v(), filtered(m, v()), {});
    expect(s).toMatchObject({ totalCalls: 10, n: 6, r: 60, r0: null, d: null, cmp: "vs previous 30 days", top: "x", nFix: 0, withFix: 0 });
    expect(s.why).toBe("Fewer than 200 tool calls in the 30 days before");
    expect(s.inc.n).toBe(3);
    const all = summary(m, v({ range: 0 }), filtered(m, v({ range: 0 })), { x: "2026-11-04", gone: "2026-10-01" });
    expect(all.cmp).toBe("vs before Nov 4");
    expect(all.nFix).toBe(2);
  });
  it("before and after a fix: all time, waiting for enough calls", () => {
    const ba = beforeAfter(m, v(), "x", "2026-11-04");
    expect(ba.sides[0]).toMatchObject({ e: 0, c: 0, r: null, empty: "No calls" });
    expect(ba.sides[1]).toMatchObject({ e: 6, c: 10, r: 60 });
    expect(ba.need).toBe(200);
    // No calls before the fix: there's nothing to compare with, however many come after.
    expect(ba.verdict).toEqual(["No calls before this date", "warn"]);
    expect(beforeAfter(m, v(), "x", "2025-12-30").sides[1].name).toBe("Since Dec 30, 2025");
    const p: ErrorsPayload = { ...fixture, calls: [["2026-10-01", "foo", 1000, 0, "claude"], ["2026-11-04", "foo", 1000, 0, "claude"]],
      errors: [...fixture.errors, ...Array.from({ length: 50 }, (_, i) => ({ ...fixture.errors[0]!, id: `old${i}`, d: "2026-10-01", n: null }))] };
    const after = beforeAfter(makeModel(p), v(), "x", "2026-11-04");
    expect(after.sides[0].name).toMatch(/^Before fix · Oct 1 – Nov 3$/);
    expect(after.sides[0].r).toBe(5);
    expect(after.sides[1].r).toBeCloseTo(0.6);
    expect(after.verdict).toEqual(["Rate lower", "ok"]);
  });
  it("where to start skips fixed types and types without a snippet", () => {
    const p: ErrorsPayload = { ...fixture, errors: fixture.errors.map(e => ({ ...e, c: "worktree" })) };
    const mm = makeModel(p), f = filtered(mm, v());
    expect(whereToStart(mm, v(), f, {}).open).toEqual([{ c: "worktree", n: 6, lost: 186e3 }]);
    expect(whereToStart(mm, v(), f, { worktree: "2026-11-04" }).open).toEqual([]);
    expect(whereToStart(m, v(), filtered(m, v()), {}).open).toEqual([]);
  });
});

describe("tool breakdown", () => {
  const errs = (ts: string[]) => ts.map(t => ({ ...m.errors[0]!, t }));
  it("counts a key's errors, most first, with the top five and the rest folded", () => {
    const b = breakdown(errs(["a", "b", "b", "c", "c", "c", "d", "e", "f", "g"]), e => e.t);
    expect(b.top).toEqual([["c", 3], ["b", 2], ["a", 1], ["d", 1], ["e", 1]]);
    expect(b).toMatchObject({ rest: 2, n: 10 });
    expect(b.rows).toHaveLength(7);
    // A kept row below the top five is listed after them and leaves the rest.
    const k = breakdown(errs(["a", "b", "b", "c", "c", "c", "d", "e", "f", "g"]), e => e.t, "g");
    expect(k.top.map(r => r[0])).toEqual(["c", "b", "a", "d", "e", "g"]);
    expect(k).toMatchObject({ rest: 1, folded: 1 });
    expect(breakdown(errs(["a", "b", "b", "c", "c", "c", "d", "e", "f", "g"]), e => e.t, "c").top).toHaveLength(5); // already in the top five
    expect(breakdown(errs(["a", "a"]), e => e.src)).toMatchObject({ rows: [["claude", 2]], rest: 0 });
  });
  it("narrows to the selected tool, or keeps everything", () => {
    const all = filtered(m, v()).errs;
    expect(inTool(v(), all)).toBe(all);
    expect(inTool(v({ tool: "Edit" }), all)).toHaveLength(4);
    expect(inTool(v({ tool: "Nope" }), all)).toEqual([]);
    // It narrows the detail only: the page's errors and calls are the same under it.
    expect(filtered(m, v({ tool: "Edit" }))).toEqual(filtered(m, v()));
  });
  it("applies on top of the bucket", () => {
    const f = filtered(two, v({ at: "2026-11-03", tool: "Edit" }));
    expect(inTool(v({ at: "2026-11-03", tool: "Edit" }), inBucket(v({ at: "2026-11-03" }), f.errs))).toHaveLength(2);
    expect(inTool(v({ tool: "Bash" }), inBucket(v({ at: "2026-11-03" }), f.errs))).toHaveLength(0);
  });
  it("settles: a tool with no errors in the open type's bucket, or with no type open, clears", () => {
    expect(settle(m, v({ cat: "x", tool: "Edit" })).tool).toBe("Edit");
    expect(settle(m, v({ cat: "x", tool: "Nope" })).tool).toBeNull();
    expect(settle(m, v({ tool: "Edit" })).tool).toBeNull();
    expect(settle(two, v({ cat: "x", at: "2026-11-03", tool: "Edit" })).tool).toBe("Edit");
    expect(settle(two, v({ cat: "x", at: "2026-11-03", tool: "Bash" })).tool).toBeNull(); // Bash is Nov 4
    expect(settle(m, v({ cat: "x", tool: "Edit", focus: "t07" }))).toMatchObject({ tool: "Edit", focus: "t07" }); // another tool's example stays linked
  });
});

describe("hash and storage", () => {
  const raw = (h: string) => Object.fromEntries(new URLSearchParams(h));
  it("reads the old page's keys; a bare #ex= link is all time and opens its type", () => {
    expect(readView(raw("ex=t07"), {}, m)).toEqual({ linked: true, dead: false, view: { ...DEFAULT_VIEW, range: 0, cat: "x", focus: "t07" } });
    expect(readView(raw("project=foo&range=7&sub=0&noise=0&gran=week&cat=x"), {}, m).view)
      .toEqual({ project: "foo", source: "", range: 7, sub: false, noise: true, gran: "week", cat: "x", focus: null, at: null, tool: null });
    expect(readView(raw("source=codex"), {}, m).view).toEqual({ ...DEFAULT_VIEW, source: "codex" });
    expect(readView(raw("source=grok&range=7"), {}, m).view).toEqual({ ...DEFAULT_VIEW, range: 7 });
    expect(readView(raw("cat=nope&range=5"), {}, m).view).toMatchObject({ cat: null, range: 30 });
  });
  it("flags a permalink to an example the store lacks; a dead bare #ex= keeps the default 30 days, not all time", () => {
    expect(readView(raw("ex=nope"), {}, m)).toEqual({ linked: false, dead: true, view: { ...DEFAULT_VIEW, range: 30 } });
    expect(readView(raw("ex=nope&range=7"), {}, m)).toMatchObject({ dead: true, view: { range: 7, focus: null } });
    expect(readView(raw("range=30"), {}, m).dead).toBe(false);
    expect(readView(raw("ex="), {}, m)).toMatchObject({ dead: false, view: { range: 0 } });
    expect(readView({}, { range: 7 }, m).dead).toBe(false);
  });
  it("flags nothing before the payload loads, so a permalink does not flash the notice", () => {
    expect(readView(raw("ex=nope"), {}, undefined)).toEqual({ linked: false, dead: false, view: { ...DEFAULT_VIEW, range: 0 } });
    expect(readView(raw("ex=t07"), {}, undefined).dead).toBe(false);
  });
  it("fills an empty hash from the saved view, and only an empty one", () => {
    const saved = { project: "foo", range: 90, source: "codex", gran: "week", sub: false, noise: true, cat: "x" };
    expect(readView({}, saved, m).view).toEqual({ project: "foo", source: "codex", range: 90, gran: "week", sub: false, noise: true, cat: "x", focus: null, at: null, tool: null });
    expect(readView(raw("auto=1"), saved, m).view.range).toBe(90);
    expect(readView(raw("range=7"), saved, m).view).toEqual({ ...DEFAULT_VIEW, range: 7 });
  });
  it("writes the hash as the old page did", () => {
    const vv = v({ project: "foo", range: 0, sub: false, noise: true, gran: "week", cat: "x" });
    expect(viewHash(vv)).toBe("#project=foo&range=0&sub=0&noise=0&gran=week&cat=x");
    expect(viewHash(vv, "t01")).toBe("#project=foo&range=0&sub=0&noise=0&gran=week&ex=t01");
    expect(viewPatch(v({ cat: "x", focus: "t01" }))).toMatchObject({ ex: "t01", cat: null, sub: null, range: 30, source: null });
    expect(viewHash(v({ source: "codex" }))).toBe("#range=30&source=codex");
  });
  it("holds the bucket under at, in the patch and the hash but not the saved view; a permalink leaves it out", () => {
    expect(readView(raw("range=30&at=2026-11-03"), {}, m).view.at).toBe("2026-11-03");
    expect(readView(raw("range=30&at=junk"), {}, m).view.at).toBeNull();
    expect(readView({}, { range: 7 }, m).view.at).toBeNull();
    expect(viewPatch(v({ at: "2026-11-03" })).at).toBe("2026-11-03");
    expect(viewPatch(v()).at).toBeNull();
    expect(viewPatch(v({ at: "2026-11-03", focus: "t01" }))).toMatchObject({ ex: "t01", at: "2026-11-03" });
    expect(viewHash(v({ cat: "x", at: "2026-11-03" }))).toBe("#range=30&cat=x&at=2026-11-03");
    expect(viewHash(v({ at: "2026-11-03" }), "t01")).toBe("#range=30&ex=t01");
    expect(savedOf(v({ at: "2026-11-03" }))).not.toHaveProperty("at");
  });
  it("holds the tool under etool (the tool sheet owns tool), in the patch and the hash but not the saved view; a permalink leaves it out", () => {
    expect(readView(raw("range=30&cat=x&etool=Edit"), {}, m).view.tool).toBe("Edit");
    expect(readView(raw("range=30&tool=Edit"), {}, m).view.tool).toBeNull();
    expect(readView(raw("etool=Edit"), {}, m).view.tool).toBe("Edit"); // a view key: the hash is the whole view
    expect(readView(raw("ex=t01&etool=Bash"), {}, m).view).toMatchObject({ cat: "x", focus: "t01", tool: "Bash" });
    expect(readView({}, { range: 7 }, m).view.tool).toBeNull();
    expect(viewPatch(v({ cat: "x", tool: "Edit" })).etool).toBe("Edit");
    expect(viewPatch(v()).etool).toBeNull();
    expect(viewPatch(v({ cat: "x", tool: "Bash", focus: "t01" }))).toMatchObject({ ex: "t01", etool: "Bash" });
    expect(viewHash(v({ cat: "x", at: "2026-11-03", tool: "Edit" }))).toBe("#range=30&cat=x&at=2026-11-03&etool=Edit");
    expect(viewHash(v({ cat: "x", tool: "Edit" }), "t01")).toBe("#range=30&ex=t01");
    expect(savedOf(v({ tool: "Edit" }))).not.toHaveProperty("tool");
  });
  it("reads fixes and the list mode in the old page's JSON", () => {
    localStorage.setItem("claude-errors-fixes", '{"x":"2026-11-04","worktree":"2026-10-01"}');
    localStorage.setItem("claude-errors-mode", '"flat"');
    expect(loadFixes()).toEqual({ x: "2026-11-04", worktree: "2026-10-01" });
    expect(loadMode()).toBe("flat");
    localStorage.setItem("claude-errors-mode", "garbage");
    expect(loadMode()).toBe("inc");
    localStorage.setItem("claude-errors-fixes", "[1]");
    expect(loadFixes()).toEqual({});
  });
});

describe("muted types", () => {
  const min = 60e3;
  it("come from the payload, and withMuted swaps them without touching the rest", () => {
    expect([...makeModel({ ...fixture, muted: ["x"] }).muted]).toEqual(["x"]);
    expect(m.muted.size).toBe(0);
    const mm = withMuted(m, ["x", "y"]);
    expect([...mm.muted]).toEqual(["x", "y"]);
    expect(mm.errors).toBe(m.errors);
  });
  it("join the fixed noise in the errors the toggle leaves out", () => {
    const mx = withMuted(m, ["x"]);
    expect(filtered(mx, v({ noise: true })).errs).toHaveLength(0);
    expect(filtered(mx, v()).errs).toHaveLength(6); // the toggle off: a muted type still counts
    expect(filtered(m, v({ noise: true })).errs).toHaveLength(6); // not muted: it stays
    // The fixed noise is noise with no one muting it.
    const p: ErrorsPayload = { ...fixture, errors: fixture.errors.map((e, i) => ({ ...e, c: i === 5 ? "infra" : e.c })) };
    expect(filtered(withMuted(makeModel(p), []), v({ noise: true })).errs).toHaveLength(5);
    expect(filtered(withMuted(makeModel(p), ["x"]), v({ noise: true })).errs).toHaveLength(0);
  });
  it("join the fixed noise in the server's per-day counts, which the rate, chart and comparison read", () => {
    const days = (mm: typeof m, o: Partial<View>) => errorDays(mm, v(o), "0").map(r => r.c);
    expect(days(m, { noise: true })).toEqual(["x"]);
    expect(days(withMuted(m, ["x"]), { noise: true })).toEqual([]);
    expect(days(withMuted(m, ["x"]), {})).toEqual(["x"]);
    // The summary's rate follows: 6 of 10 calls with the type, none without it.
    expect(summary(m, v({ noise: true }), filtered(m, v({ noise: true })), {}).r).toBe(60);
    const mx = withMuted(m, ["x"]);
    expect(summary(mx, v({ noise: true }), filtered(mx, v({ noise: true })), {})).toMatchObject({ n: 0, r: 0, uncat: { n: 0, share: 0 } });
  });
  it("close an open muted type under the toggle, and keep a linked example's type open", () => {
    const mx = withMuted(m, ["x"]);
    expect(settle(mx, v({ cat: "x", noise: true })).cat).toBeNull();
    expect(settle(mx, v({ cat: "x" })).cat).toBe("x");
    expect(settle(mx, v({ cat: "x", focus: "t07", noise: true })).cat).toBe("x");
  });
  describe("in Where to start", () => {
    const mm = makeModel(lostPayload), vv = (o: Partial<View> = {}) => v({ range: 0, ...o });
    const names = (x: typeof mm, o: Partial<View> = {}) => whereToStart(x, vv(o), filtered(x, vv(o)), {}).open.map(r => r.c);
    it("never suggests a muted type as an open fix, with the toggle on or off", () => {
      expect(names(mm)).toEqual(["git", "worktree", "tests", "sleep_poll"]);
      const mg = withMuted(mm, ["git"]);
      expect(names(mg)).toEqual(["worktree", "tests", "sleep_poll"]);
      expect(names(mg, { noise: true })).toEqual(["worktree", "tests", "sleep_poll"]);
      expect(whereToStart(mg, vv(), filtered(mg, vv()), {}).open[0]).toEqual({ c: "worktree", n: 4, lost: min });
    });
    it("never suggests a muted type as rising fastest", () => {
      // Two types, each from 1 to 20 errors over 300 calls a side: both rise, by the same gain.
      const rise = makeModel({ ...fixture, calls: [["2026-10-25", "foo", 300, 0, "claude"], ["2026-11-04", "foo", 300, 0, "claude"]],
        error_days: [["2026-10-25", "foo", "git", 1, 0, "claude"], ["2026-11-04", "foo", "git", 20, 0, "claude"],
          ["2026-10-25", "foo", "worktree", 1, 0, "claude"], ["2026-11-04", "foo", "worktree", 20, 0, "claude"]] });
      const rising = (x: typeof rise, o: Partial<View> = {}) => whereToStart(x, v({ range: 7, ...o }), filtered(x, v({ range: 7, ...o })), {}).rising.map(r => r.c).sort();
      expect(rising(rise)).toEqual(["git", "worktree"]);
      expect(rising(withMuted(rise, ["git"]))).toEqual(["worktree"]);
      expect(rising(withMuted(rise, ["git"]), { noise: true })).toEqual(["worktree"]);
    });
  });
});
