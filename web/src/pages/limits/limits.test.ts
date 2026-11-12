import { describe, expect, it } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import { caption, hasScenario, nearestPoint, pace, readPoints, readText, recentText, tipPlace, usedHint, usedHref, usedRange, usedRangeName, whenDay } from "./limits";

const claude = (limits as LimitsPayload).windows[0]!;
const win = (over: Partial<LimitWindow>): LimitWindow => ({ ...claude, ...over });
const past = [
  { t: "2026-11-07T10:00:00.000Z", pct: 40, measured: true },
  { t: "2026-11-07T11:00:00.000Z", pct: 42, measured: false },
];
const curve = [
  { t: "2026-11-07T11:00:00.000Z", mid: 42, lo: 42, hi: 42, recent: null }, // "now" again, as the payload sends it
  { t: "2026-11-07T12:00:00.000Z", mid: 50, lo: 45.04, hi: 60.46, recent: null },
  { t: "2026-11-07T13:00:00.000Z", mid: 58, lo: 58, hi: 58, recent: 72.34 },
];
const fc = (c: typeof curve) => ({ ...claude.forecast!, curve: c });

describe("readPoints", () => {
  it("lists the past points, then the forecast points after now, with no duplicate at now", () => {
    const pts = readPoints(win({ series: past, forecast: fc(curve) }));
    expect(pts.map(p => [p.kind, p.t.slice(11, 13)])).toEqual([["past", "10"], ["past", "11"], ["forecast", "12"], ["forecast", "13"]]);
  });

  it("lists the past points alone for a window without a forecast", () => {
    expect(readPoints(win({ series: past, forecast: null })).map(p => p.kind)).toEqual(["past", "past"]);
  });

  it("lists the whole curve when there is no past point", () => {
    expect(readPoints(win({ series: [], forecast: fc(curve) }))).toHaveLength(3);
  });

  it("lists nothing for a window with no series and no forecast", () => {
    expect(readPoints(win({ series: [], forecast: null }))).toEqual([]);
  });
});

describe("nearestPoint", () => {
  const pts = readPoints(win({ series: past, forecast: fc(curve) }));
  const at = (h: number) => Date.parse(`2026-11-07T${String(h).padStart(2, "0")}:00:00.000Z`);

  it("finds the point nearest in time, clamping beyond either end", () => {
    expect(nearestPoint(pts, at(10) + 20 * 60000)).toBe(0);
    expect(nearestPoint(pts, at(10) + 40 * 60000)).toBe(1);
    expect(nearestPoint(pts, at(12) + 10 * 60000)).toBe(2);
    expect(nearestPoint(pts, at(1))).toBe(0);
    expect(nearestPoint(pts, at(23))).toBe(3);
  });

  it("finds nothing in no points", () => {
    expect(nearestPoint([], at(10))).toBe(-1);
  });
});

describe("readText", () => {
  const [a, b] = readPoints(win({ series: past, forecast: fc(curve) }));
  const f = readPoints(win({ series: past, forecast: fc(curve) }));

  it("reads a past point as time, percent and measured or estimated", () => {
    expect(readText(a!)).toBe(`${whenDay(past[0]!.t)} · 40% · measured`);
    expect(readText(b!)).toBe(`${whenDay(past[1]!.t)} · 42% · estimated`);
  });

  it("reads a forecast point with its likely range, at most one decimal", () => {
    expect(readText(f[2]!)).toBe(`${whenDay(curve[1]!.t)} · forecast 50% (45–60.5%)`);
  });

  it("leaves out the range when low and high read the same, and adds the last-24-hours line when the point has one", () => {
    expect(readText(f[3]!)).toBe(`${whenDay(curve[2]!.t)} · forecast 58% · last 24 h pace 72.3%`);
  });

  it("carries the last-24-hours value through readPoints, and leaves it out when null", () => {
    expect(f.map(p => (p.kind === "forecast" ? p.recent : "past"))).toEqual(["past", "past", null, 72.34]);
    expect(readText(f[2]!)).not.toMatch(/last 24 h/);
  });
});

describe("tipPlace", () => {
  const box = { w: 300, h: 168 }, tip = { w: 120, h: 20 };

  it("puts the tip right of a point at the left edge, inside the box", () => {
    expect(tipPlace(box, tip, { x: 0, y: 60 })).toEqual({ left: 14, top: 50 });
    expect(tipPlace(box, tip, { x: -40, y: 60 }).left).toBe(0);
  });

  it("flips a long tip left of a point near the middle, and never past the box's left edge", () => {
    expect(tipPlace(box, { w: 200, h: 20 }, { x: 150, y: 60 }).left).toBe(0); // 150 - 14 - 200 would be negative
    expect(tipPlace(box, tip, { x: 200, y: 60 }).left).toBe(66); // 200 - 14 - 120
  });

  it("keeps the tip inside the box at the right edge", () => {
    expect(tipPlace(box, tip, { x: 300, y: 60 }).left).toBe(166);
    expect(tipPlace(box, tip, { x: 900, y: 60 }).left).toBe(180); // box.w - tip.w
  });

  it("puts a tip wider than the box at the origin", () => {
    expect(tipPlace(box, { w: 500, h: 20 }, { x: 150, y: 60 }).left).toBe(0);
    expect(tipPlace({ w: 100, h: 168 }, { w: 500, h: 20 }, { x: 99, y: 60 }).left).toBe(0);
  });

  it("keeps the tip from the top and the bottom of the box", () => {
    expect(tipPlace(box, tip, { x: 100, y: 3 }).top).toBe(0);
    expect(tipPlace(box, tip, { x: 100, y: 400 }).top).toBe(148);
    expect(tipPlace({ w: 300, h: 10 }, tip, { x: 100, y: 5 }).top).toBe(0);
  });
});

describe("recentText", () => {
  const f = claude.forecast!;
  const hot = win({ at_limit: false, forecast: { ...f, recent_pace: 20, recent_hits_at: "2026-11-07T20:00:00.000Z", recent_at_reset: null } });
  const calm = win({ at_limit: false, forecast: { ...f, recent_pace: 3, recent_hits_at: null, recent_at_reset: 41.26 } });

  it("says when the last 24 hours reach 100%, or where they stand at the reset", () => {
    expect(recentText(hot)).toBe(`If the last 24 hours continue: reaches 100% at ${whenDay("2026-11-07T20:00:00.000Z")}`);
    expect(recentText(calm)).toBe("If the last 24 hours continue: about 41% at its reset");
  });

  it("says nothing at the limit, without a forecast or without a scenario", () => {
    expect(recentText({ ...hot, at_limit: true })).toBeNull();
    expect(recentText(win({ forecast: null }))).toBeNull();
    expect(recentText(win({ at_limit: false, forecast: { ...f, recent_pace: null, recent_hits_at: null, recent_at_reset: null } }))).toBeNull();
  });
});

describe("hasScenario", () => {
  it("is true when a curve point carries the last-24-hours value, even for a window at its limit", () => {
    expect(hasScenario(win({ forecast: fc(curve) }))).toBe(true);
    expect(hasScenario(win({ at_limit: true, forecast: fc(curve) }))).toBe(true);
  });

  it("is false without a forecast or when no point carries it", () => {
    expect(hasScenario(win({ forecast: null }))).toBe(false);
    expect(hasScenario(win({ forecast: fc(curve.map(p => ({ ...p, recent: null }))) }))).toBe(false);
  });
});

describe("a percent at the reset never reads 100 unless it is 100", () => {
  const f = claude.forecast!;
  const reset = (at: number, low = at, high = at, rest: Partial<typeof f> = {}) => win({ at_limit: false,
    forecast: { ...f, hits_at: null, hits_at_early: null, hits_at_late: null, at_reset: at, at_reset_low: low, at_reset_high: high, recent_pace: 3, recent_hits_at: null, recent_at_reset: at, ...rest } });

  it("reads 99% for 99.9 and 99.5, 100% for 100 and what num reads for the rest", () => {
    expect(recentText(reset(99.9))).toBe("If the last 24 hours continue: about 99% at its reset");
    expect(recentText(reset(99.5))).toBe("If the last 24 hours continue: about 99% at its reset");
    expect(recentText(reset(100))).toBe("If the last 24 hours continue: about 100% at its reset");
    expect(recentText(reset(66.4))).toBe("If the last 24 hours continue: about 66% at its reset");
    expect(caption(reset(99.9))).toBe("Resets first at about 99%");
    expect(caption(reset(99.9, 97.2, 99.9))).toBe("Resets first at about 99% (97–99%)");
    expect(caption(reset(100))).toBe("Resets first at about 100%");
    expect(caption(reset(66.4, 60.2, 80))).toBe("Resets first at about 66% (60–80%)");
  });

  it("never says nothing would go unused from a value below 100", () => {
    const verdict = (at: number) => pace(reset(at, at, at, { pace: "behind", pace_target: 10 }), (limits as LimitsPayload).now).verdict;
    expect(verdict(99.9)).toBe("behind pace: about 1% would go unused");
    expect(verdict(66.4)).toBe("behind pace: about 34% would go unused");
    expect(verdict(100)).toBe("behind pace: about 0% would go unused");
  });
});

describe("what used this window", () => {
  const DAY = 86400000, now = "2026-11-06T12:00:00.000Z";
  const began = (days: number) => win({ start: new Date(Date.parse(now) - days * DAY).toISOString() });

  it("picks the smallest range preset that covers the window's start", () => {
    expect([0.01, 1, 7].map(d => usedRange(began(d), now))).toEqual([7, 7, 7]);
    expect([7.01, 14].map(d => usedRange(began(d), now))).toEqual([14, 14]);
    expect([14.01, 30].map(d => usedRange(began(d), now))).toEqual([30, 30]);
    expect([30.01, 90].map(d => usedRange(began(d), now))).toEqual([90, 90]);
    expect([90.01, 400].map(d => usedRange(began(d), now))).toEqual([0, 0]);
  });

  it("names the range as the nearest preset", () => {
    expect(usedRangeName(7)).toBe("last 7 days");
    expect(usedRangeName(0)).toBe("all time");
  });

  it("links to Cost with the project, the range and the window's source", () => {
    const w = win({ provider: "codex", start: began(10).start });
    expect(usedHref(w, now, "ai-ledger")).toBe("/cost#project=ai-ledger&range=14&source=codex");
    expect(usedHref(w, now)).toBe("/cost#range=14&source=codex");
    expect(usedHref(win({ provider: "claude", start: began(200).start }), now, "a b&c")).toBe("/cost#project=a+b%26c&range=0&source=claude");
  });

  it("hints with the top project and its share", () => {
    const row = { cost: 5, points: null };
    expect(usedHint({ total: 10, projects: [{ project: "ai-ledger", share: 0.54, ...row }], models: [] })).toBe("ai-ledger 54%");
    expect(usedHint({ total: 10, projects: [{ project: "tiny", share: 0.001, ...row }], models: [] })).toBe("tiny <1%");
    expect(usedHint({ total: 10, projects: [], models: [{ model: "m", share: 1, ...row }] })).toBeNull(); // no project to name
  });
});
