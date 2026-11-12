import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import type { ErrorsPayload } from "../../api";
import {
  beforeAfter, bucketLabel, bucketOf, buckets, byWeight, change, chartData, compare, emptyTypes, exList, filtered, inBucket, incidentsOf, incSummary, makeModel, midDay, pointText,
  rangeStart, series, settle, summary, typeColors, typeRows, viewTypes, whereToStart, type View,
} from "./model";
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
    expect(change(xw, "x")).toEqual({ text: "–", cls: "muted", title: xw.why });
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
    expect(rows[0]).toMatchObject({ cid: "x", n: 6, share: 1, color: "var(--type-1)" });
    // No calls in the 30 days before: nothing to compare with.
    expect(rows[0]!.delta).toMatchObject({ text: "–", title: "Fewer than 200 tool calls in the 30 days before" });
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
    expect(whereToStart(mm, v(), f, {}).open).toEqual([["worktree", 6]]);
    expect(whereToStart(mm, v(), f, { worktree: "2026-11-04" }).open).toEqual([]);
    expect(whereToStart(m, v(), filtered(m, v()), {}).open).toEqual([]);
  });
});

describe("hash and storage", () => {
  const raw = (h: string) => Object.fromEntries(new URLSearchParams(h));
  it("reads the old page's keys; a bare #ex= link is all time and opens its type", () => {
    expect(readView(raw("ex=t07"), {}, m)).toEqual({ linked: true, view: { ...DEFAULT_VIEW, range: 0, cat: "x", focus: "t07" } });
    expect(readView(raw("project=foo&range=7&sub=0&noise=0&gran=week&cat=x"), {}, m).view)
      .toEqual({ project: "foo", source: "", range: 7, sub: false, noise: true, gran: "week", cat: "x", focus: null, at: null });
    expect(readView(raw("source=codex"), {}, m).view).toEqual({ ...DEFAULT_VIEW, source: "codex" });
    expect(readView(raw("source=grok&range=7"), {}, m).view).toEqual({ ...DEFAULT_VIEW, range: 7 });
    expect(readView(raw("cat=nope&range=5"), {}, m).view).toMatchObject({ cat: null, range: 30 });
  });
  it("fills an empty hash from the saved view, and only an empty one", () => {
    const saved = { project: "foo", range: 90, source: "codex", gran: "week", sub: false, noise: true, cat: "x" };
    expect(readView({}, saved, m).view).toEqual({ project: "foo", source: "codex", range: 90, gran: "week", sub: false, noise: true, cat: "x", focus: null, at: null });
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
