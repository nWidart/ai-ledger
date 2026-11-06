import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import type { ErrorsPayload } from "../../api";
import {
  beforeAfter, bucketOf, buckets, byWeight, change, chartData, exList, filtered, incidentsOf, incSummary, makeModel, pointText,
  rangeStart, series, settle, summary, typeColors, typeRows, viewTypes, whereToStart, type View,
} from "./model";
import { DEFAULT_VIEW, loadFixes, loadMode, readView, viewHash, viewPatch } from "./view";

const m = makeModel(fixture);
const v = (o: Partial<View> = {}): View => ({ ...DEFAULT_VIEW, ...o });

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
  it("filters by project, subagents and noise", () => {
    expect(filtered(m, v()).errs).toHaveLength(6);
    expect(filtered(m, v({ project: "bar" })).errs).toHaveLength(0);
    expect(filtered(m, v({ project: "bar" })).calls).toHaveLength(0);
    const p: ErrorsPayload = { ...fixture, errors: fixture.errors.map((e, i) => ({ ...e, sub: i < 2 ? 1 : 0, c: i === 5 ? "infra" : e.c })) };
    const mm = makeModel(p);
    expect(filtered(mm, v({ sub: false })).errs).toHaveLength(4);
    expect(filtered(mm, v({ noise: true })).errs).toHaveLength(5);
  });
  it("rates per bucket, null without calls", () => {
    const f = filtered(m, v({ range: 7 })), keys = buckets(m, f.start, "day");
    const pts = series(v(), f.errs, f.calls, keys);
    expect(pts.find(p => p.k === "2026-11-04")).toEqual({ k: "2026-11-04", e: 6, c: 10, r: 60 });
    expect(pts.find(p => p.k === "2026-11-05")?.r).toBeNull();
  });
  it("change: arrows past min, New from zero, dashes without data", () => {
    expect(change(null, 2)).toMatchObject({ text: "–", cls: "muted", title: "Not enough data in the first half" });
    expect(change(2, null).title).toBe("Not enough data in the second half");
    expect(change(0, 3)).toEqual({ text: "New", cls: "delta-up" });
    expect(change(0, 0)).toEqual({ text: "–", cls: "muted" });
    expect(change(10, 20)).toEqual({ text: "▲ +100%", cls: "delta-up" });
    expect(change(10, 5)).toEqual({ text: "▼ -50%", cls: "delta-down" });
    expect(change(10, 10.3, 5)).toEqual({ text: "3%", cls: "muted" });
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
      error_days: ["a", "b", "c", "d", "e", "f"].map(c => ["2026-11-04", "foo", c, c === "f" ? 1 : 2, 0] as [string, string, string, number, number]) };
    const mm = makeModel(p), vv = v({ cat: "f" }), vt = viewTypes(mm, vv, filtered(mm, vv));
    expect(vt.top).toHaveLength(5);
    expect(vt.extra).toBe("f");
    expect(vt.colors.f).toBe("var(--type-sel)");
    const { pts } = chartData(mm, vv, filtered(mm, vv), vt), p4 = pts.find(x => x.k === "2026-11-04")!;
    expect(p4.e).toBe(11);
    expect(p4.other).toBe(0);
    expect(pointText(mm, vv, p4, vt)).toContain("Selected f: 1");
  });
  it("table rows carry share, color and the half-on-half change", () => {
    const rows = typeRows(m, v(), filtered(m, v()));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cid: "x", n: 6, share: 1, color: "var(--type-1)" });
    // Every call is in the second half: no first-half rate to compare with.
    expect(rows[0]!.delta.text).toBe("–");
  });
  it("closes a type with no errors in the view unless an example is linked", () => {
    expect(settle(m, v({ cat: "x" })).cat).toBe("x");
    expect(settle(m, v({ cat: "x", project: "bar" })).cat).toBeNull();
    expect(settle(m, v({ cat: "x", project: "bar", focus: "t01" })).cat).toBe("x");
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
    expect(s.inc.n).toBe(3);
    const all = summary(m, v({ range: 0 }), filtered(m, v({ range: 0 })), { x: "2026-11-04", gone: "2026-10-01" });
    expect(all.cmp).toBe("vs the first half");
    expect(all.nFix).toBe(2);
  });
  it("before and after a fix: all time, waiting for enough calls", () => {
    const ba = beforeAfter(m, v(), "x", "2026-11-04");
    expect(ba.sides[0]).toMatchObject({ e: 0, c: 0, r: null, empty: "No calls" });
    expect(ba.sides[1]).toMatchObject({ e: 6, c: 10, r: 60 });
    expect(ba.need).toBe(200);
    expect(ba.verdict).toEqual(["Not enough calls yet", "warn"]);
    const p: ErrorsPayload = { ...fixture, calls: [["2026-10-01", "foo", 1000, 0], ["2026-11-04", "foo", 1000, 0]],
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
      .toEqual({ project: "foo", range: 7, sub: false, noise: true, gran: "week", cat: "x", focus: null });
    expect(readView(raw("cat=nope&range=5"), {}, m).view).toMatchObject({ cat: null, range: 30 });
  });
  it("fills an empty hash from the saved view, and only an empty one", () => {
    const saved = { project: "foo", range: 90, gran: "week", sub: false, noise: true, cat: "x" };
    expect(readView({}, saved, m).view).toEqual({ project: "foo", range: 90, gran: "week", sub: false, noise: true, cat: "x", focus: null });
    expect(readView(raw("auto=1"), saved, m).view.range).toBe(90);
    expect(readView(raw("range=7"), saved, m).view).toEqual({ ...DEFAULT_VIEW, range: 7 });
  });
  it("writes the hash as the old page did", () => {
    const vv = v({ project: "foo", range: 0, sub: false, noise: true, gran: "week", cat: "x" });
    expect(viewHash(vv)).toBe("#project=foo&range=0&sub=0&noise=0&gran=week&cat=x");
    expect(viewHash(vv, "t01")).toBe("#project=foo&range=0&sub=0&noise=0&gran=week&ex=t01");
    expect(viewPatch(v({ cat: "x", focus: "t01" }))).toMatchObject({ ex: "t01", cat: null, sub: null, range: 30 });
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
