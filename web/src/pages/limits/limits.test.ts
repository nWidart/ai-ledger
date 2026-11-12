import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LimitHistoryRow, LimitWindow, LimitsAlert, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import { alertText, barKey, barName, caption, closedWindow, hasScenario, historyStrips, STRIP_BARS, stripNote, windowNotes, nearestPoint, pace, readPoints, readText, recentText, shareText, surfacesText, tipPlace, usedHint, usedHref, usedRange, usedRangeName, whenDay } from "./limits";

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
  const now = "2026-11-06T12:00:00.000Z", zone = process.env.TZ;
  // The window's start at the beginning of the date that makes it `dates` local dates through today, inclusive.
  const began = (dates: number) => win({ start: new Date(Date.UTC(2026, 10, 6 - (dates - 1))).toISOString() });
  beforeAll(() => { process.env.TZ = "UTC"; });
  afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

  it("picks the smallest range preset that covers every date from the window's start", () => {
    expect([1, 7].map(n => usedRange(began(n), now))).toEqual([7, 7]);
    expect([8, 14].map(n => usedRange(began(n), now))).toEqual([14, 14]);
    expect([15, 30].map(n => usedRange(began(n), now))).toEqual([30, 30]);
    expect([31, 90].map(n => usedRange(began(n), now))).toEqual([90, 90]);
    expect([91, 400].map(n => usedRange(began(n), now))).toEqual([0, 0]);
  });

  it("counts calendar dates, as Cost's range does: 7 days and 0 hours ago starts a date Cost's 7 days leave out", () => {
    // Cost's last 7 days begin at Oct 31 00:00: a window that began Oct 30 at noon is in 8 dates, so it needs 14.
    expect(usedRange(win({ start: "2026-10-30T12:00:00.000Z" }), now)).toBe(14);
    expect(usedRange(win({ start: "2026-10-30T23:59:00.000Z" }), now)).toBe(14);
    expect(usedRange(win({ start: "2026-10-31T00:00:00.000Z" }), now)).toBe(7);
    expect(usedRange(win({ start: "2026-11-05T23:00:00.000Z" }), now)).toBe(7); // an hour into yesterday
  });

  it("reads the dates in the reader's zone", () => {
    process.env.TZ = "America/Los_Angeles";
    try {
      // Nov 5, 8 PM in Los Angeles; the window began Oct 30 at midnight there: 7 local dates, though 8 in UTC.
      expect(usedRange(win({ start: "2026-10-30T07:00:00.000Z" }), "2026-11-06T04:00:00.000Z")).toBe(7);
    } finally { process.env.TZ = "UTC"; }
    expect(usedRange(win({ start: "2026-10-30T07:00:00.000Z" }), "2026-11-06T04:00:00.000Z")).toBe(14);
  });

  it("names the range as the nearest preset", () => {
    expect(usedRangeName(7)).toBe("last 7 days");
    expect(usedRangeName(0)).toBe("all time");
  });

  it("links to Cost with the project, the range, the window's source and automated sessions, which the drawer counts", () => {
    const w = win({ provider: "codex", start: began(10).start });
    expect(usedHref(w, now, "ai-ledger")).toBe("/cost#project=ai-ledger&range=14&source=codex&auto=1");
    expect(usedHref(w, now)).toBe("/cost#range=14&source=codex&auto=1");
    expect(usedHref(win({ provider: "claude", start: began(200).start }), now, "a b&c")).toBe("/cost#project=a+b%26c&range=0&source=claude&auto=1");
  });

  it("hints with the top project and its share", () => {
    const row = { cost: 5, points: null };
    expect(usedHint({ total: 10, projects: [{ project: "ai-ledger", share: 0.54, ...row }], models: [] })).toBe("ai-ledger 54%");
    expect(usedHint({ total: 10, projects: [{ project: "tiny", share: 0.001, ...row }], models: [] })).toBe("tiny <1%");
    expect(usedHint({ total: 10000, projects: [{ project: "tiny", share: 0.0001, ...row }], models: [] })).toBe("tiny <1%"); // the payload's smallest share
    expect(usedHint({ total: 10, projects: [], models: [{ model: "m", share: 1, ...row }] })).toBeNull(); // no project to name
  });
});

describe("shareText", () => {
  it("says how much of the weekly allowance the limit is and how much is used through it", () => {
    expect(shareText(win({ weekly_share: { used: 21, allowance: 50 } })))
      .toBe("This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it");
    expect(shareText(win({ weekly_share: { used: 0, allowance: 100 } })))
      .toBe("This limit is 100% of the weekly allowance; 0% of the weekly allowance is used through it");
  });

  it("rounds to whole percents", () => {
    expect(shareText(win({ weekly_share: { used: 20.6, allowance: 49.5 } }))).toBe("This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it");
  });

  it("is null for a window without a share", () => {
    expect(shareText(win({ weekly_share: null }))).toBeNull();
  });
});

describe("surfacesText", () => {
  const rows = (...p: [string, number][]) => win({ surfaces: { as_of: "2026-11-06T11:20:00.000Z", rows: p.map(([label, percent]) => ({ key: label.toLowerCase(), label, percent })) } });

  it("says when one surface made all the use", () => {
    expect(surfacesText(rows(["Claude Code", 100], ["Chats", 0], ["Cowork", 0]))).toBe("All of this week's use so far came from Claude Code");
    expect(surfacesText(rows(["Claude Code", 0], ["Chats", 100]))).toBe("All of this week's use so far came from Chats");
  });

  it("lists the surfaces with use, most first", () => {
    expect(surfacesText(rows(["Claude Code", 40], ["Chats", 60], ["Cowork", 0], ["Other", 0]))).toBe("This week's use by surface: Chats 60%, Claude Code 40%");
    expect(surfacesText(rows(["Claude Code", 80], ["Chats", 15], ["Cowork", 5]))).toBe("This week's use by surface: Claude Code 80%, Chats 15%, Cowork 5%");
  });

  it("rounds to whole percents, and a surface that rounds to nothing reads <1%", () => {
    expect(surfacesText(rows(["Claude Code", 60.4], ["Chats", 39.2], ["Cowork", 0.4]))).toBe("This week's use by surface: Claude Code 60%, Chats 39%, Cowork <1%");
  });

  it("never says all from one surface while another has use, and never reads 100% beside it", () => {
    expect(surfacesText(rows(["Claude Code", 99.5], ["Chats", 0.5]))).toBe("This week's use by surface: Claude Code 99%, Chats 1%");
    expect(surfacesText(rows(["Claude Code", 99.9], ["Chats", 0.1]))).toBe("This week's use by surface: Claude Code 99%, Chats <1%");
    expect(surfacesText(rows(["Claude Code", 100], ["Chats", 0.2]))).toBe("This week's use by surface: Claude Code 99%, Chats <1%");
  });

  it("says all from one surface when it is the only one with use", () => {
    expect(surfacesText(rows(["Claude Code", 0], ["Chats", 100], ["Cowork", 0]))).toBe("All of this week's use so far came from Chats");
    expect(surfacesText(rows(["Claude Code", 0.4], ["Chats", 0]))).toBe("All of this week's use so far came from Claude Code");
  });

  it("is null when every surface is 0, with no rows or without a breakdown", () => {
    expect(surfacesText(rows(["Claude Code", 0], ["Chats", 0]))).toBeNull();
    expect(surfacesText(rows())).toBeNull();
    expect(surfacesText(win({ surfaces: null }))).toBeNull();
  });
});

describe("past-window bars", () => {
  const row = (over: Partial<LimitHistoryRow>): LimitHistoryRow => ({
    provider: "claude", provider_label: "Claude Code", label: "weekly", limit_id: "weekly_all", scope: "", window_minutes: 10080, plan: "max",
    start: "2026-10-31T14:00:00.000Z", closed_at: "2026-11-07T14:00:00.000Z", resets_at: "2026-11-07T14:00:00.000Z", final: 82,
    hit: false, hit_minutes: null, early: false, reason: null, estimated: false, ...over });

  it("names a bar with every signal its colour and hatching carry", () => {
    expect(barName(row({}))).toBe(`Claude Code weekly, ended ${whenDay("2026-11-07T14:00:00.000Z")}: 82%`);
    expect(barName(row({ hit: true, hit_minutes: 200, final: 100, early: true, reason: "plan change from max to pro", estimated: true })))
      .toBe(`Claude Code weekly, ended ${whenDay("2026-11-07T14:00:00.000Z")}: 100%, hit its limit for 3h 20m, ended early by a plan change, estimated`);
    expect(barName(row({ hit: true }))).toMatch(/: 82%, hit its limit$/);
    expect(barName(row({ early: true, reason: "early reset" }))).toMatch(/, ended early by an early reset$/);
    expect(barName(row({ estimated: true }))).toMatch(/: 82%, estimated$/);
  });

  it("tells a window from another by its limit and start", () => {
    expect(barKey(row({}))).not.toBe(barKey(row({ scope: "Fable" })));
    expect(barKey(row({}))).not.toBe(barKey(row({ start: "2026-11-07T14:00:00.000Z" })));
    expect(barKey(row({}))).toBe(barKey(row({ final: 3, hit: true })));
  });

  it("makes one strip per limit: provider in the given order, longest window first, then scope", () => {
    const codex = { provider: "codex", provider_label: "Codex" };
    const rows = [row({ ...codex, label: "5-hour", limit_id: "codex_300", window_minutes: 300 }),
      row({ label: "weekly · Fable", limit_id: "weekly_scoped", scope: "Fable" }), row({ ...codex, label: "weekly", limit_id: "codex_10080" }),
      row({ label: "5-hour", limit_id: "five_hour", window_minutes: 300 }), row({}),
      row({ label: "weekly · Fable", limit_id: "weekly_scoped", scope: "Fable", closed_at: "2026-11-08T00:00:00.000Z" })];
    expect(historyStrips(rows, ["claude", "codex"]).map(s => [s.name, s.bars.length])).toEqual([
      ["Claude Code weekly", 1], ["Claude Code weekly · Fable", 2], ["Claude Code 5-hour", 1], ["Codex weekly", 1], ["Codex 5-hour", 1]]);
    expect(historyStrips(rows, ["codex", "claude"]).map(s => s.name)[0]).toBe("Codex weekly");
    expect(historyStrips(rows, ["claude"]).map(s => s.name).slice(-2)).toEqual(["Codex weekly", "Codex 5-hour"]); // an unlisted provider goes last
    expect(historyStrips([], ["claude"])).toEqual([]);
  });

  it("makes a strip per limit id, even when two limits read alike, and one strip of a limit whose label changed", () => {
    const a = row({ limit_id: "codex_a_10080" }), b = row({ limit_id: "codex_b_10080", closed_at: "2026-11-08T00:00:00.000Z" });
    const strips = historyStrips([a, b, row({ limit_id: "codex_a_10080", closed_at: "2026-10-31T00:00:00.000Z", start: "2026-10-24T00:00:00.000Z" })], ["claude"]);
    expect(strips.map(s => [s.key, s.name, s.bars.length, s.total])).toEqual([
      ["claude|codex_a_10080|", "Claude Code weekly", 2, 2], ["claude|codex_b_10080|", "Claude Code weekly", 1, 1]]);
    // One limit whose window length (and label) changed: one strip, named as its newest window is, and one cap for all of it.
    const old = row({ label: "daily", window_minutes: 1440, start: "2026-10-01T00:00:00.000Z", closed_at: "2026-10-02T00:00:00.000Z" });
    const [one, ...rest] = historyStrips([old, row({})], ["claude"]);
    expect([rest.length, one!.name, one!.bars.length]).toEqual([0, "Claude Code weekly", 2]);
    const many = Array.from({ length: 70 }, (_, i) => row({ limit_id: i < 35 ? "a" : "b", closed_at: new Date(Date.UTC(2026, 0, 2 + i)).toISOString(), start: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() }));
    expect(historyStrips(many, ["claude"]).map(s => [s.bars.length, s.total])).toEqual([[35, 35], [35, 35]]); // one limit cannot crowd out the other
  });

  it("runs a strip oldest to newest, whatever order the history came in", () => {
    const days = [3, 1, 2].map(d => row({ start: `2026-10-0${d}T00:00:00.000Z`, closed_at: `2026-10-0${d + 1}T00:00:00.000Z` }));
    expect(historyStrips(days, ["claude"])[0]!.bars.map(h => h.closed_at.slice(8, 10))).toEqual(["02", "03", "04"]);
  });

  it("keeps the most recent bars of a long history, and says so", () => {
    const many = Array.from({ length: 70 }, (_, i) => row({ start: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), closed_at: new Date(Date.UTC(2026, 0, 2 + i)).toISOString() }));
    const [strip] = historyStrips(many, ["claude"]);
    expect([strip!.bars.length, strip!.total, STRIP_BARS]).toEqual([60, 70, 60]);
    expect(strip!.bars[59]!.closed_at).toBe(many[69]!.closed_at);
    expect(strip!.bars[0]!.closed_at).toBe(many[10]!.closed_at);
    expect(stripNote(60, 70)).toBe("60 most recent of 70; the table lists all");
    expect(stripNote(60, 60)).toBeNull();
  });

  it("gives the chart a closed window: to its close, at its final percent, with no forecast", () => {
    const h = row({ hit: true, estimated: true, early: true, reason: "early reset", closed_at: "2026-11-05T00:00:00.000Z" });
    const w = closedWindow(h, past);
    expect([w.start, w.resets_at, w.current, w.forecast, w.series, w.at_limit]).toEqual([h.start, h.closed_at, 82, null, past, true]);
    expect(windowNotes(h)).toEqual(["at its limit", "ended early by an early reset", "estimated from counted usage"]);
    expect(windowNotes(row({}))).toEqual([]);
  });
});

describe("alertText", () => {
  const alert = (over: Partial<LimitsAlert>): LimitsAlert => ({ kind: "at_limit", provider: "claude", provider_label: "Claude Code", label: "weekly", current: 100,
    at: "2026-11-14T12:00:00.000Z", resets_at: "2026-11-14T12:00:00.000Z", count: 1, ...over });
  it("says what each kind is, with the time in the page's format", () => {
    expect(alertText(alert({}))).toBe(`Claude Code weekly is at its limit until ${whenDay("2026-11-14T12:00:00.000Z")}`);
    expect(alertText(alert({ kind: "runs_out", current: 64, at: "2026-11-13T08:00:00.000Z" }))).toBe(`Claude Code weekly is forecast to run out ${whenDay("2026-11-13T08:00:00.000Z")}`);
    expect(alertText(alert({ kind: "high", provider_label: "Codex", label: "5-hour", current: 93.4 }))).toBe("Codex 5-hour is at 93%");
  });
  it("counts the other windows in alert", () => {
    expect(alertText(alert({ kind: "high", current: 91, count: 2 }))).toBe("Claude Code weekly is at 91% (and 1 more)");
    expect(alertText(alert({ kind: "high", current: 91, count: 4 }))).toBe("Claude Code weekly is at 91% (and 3 more)");
  });
});
