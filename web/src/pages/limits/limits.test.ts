import { describe, expect, it } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import { nearestPoint, readPoints, readText, whenDay } from "./limits";

const claude = (limits as LimitsPayload).windows[0]!;
const win = (over: Partial<LimitWindow>): LimitWindow => ({ ...claude, ...over });
const past = [
  { t: "2026-11-07T10:00:00.000Z", pct: 40, measured: true },
  { t: "2026-11-07T11:00:00.000Z", pct: 42, measured: false },
];
const curve = [
  { t: "2026-11-07T11:00:00.000Z", mid: 42, lo: 42, hi: 42 }, // "now" again, as the payload sends it
  { t: "2026-11-07T12:00:00.000Z", mid: 50, lo: 45.04, hi: 60.46 },
  { t: "2026-11-07T13:00:00.000Z", mid: 58, lo: 58, hi: 58 },
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

  it("leaves out the range when low and high read the same", () => {
    expect(readText(f[3]!)).toBe(`${whenDay(curve[2]!.t)} · forecast 58%`);
  });
});
