import { describe, expect, it } from "vitest";
import { when } from "../../../format";
import { dotAt, groupLabel, notes, quadrantFit, quadrantModel, readDot, stepDot, tipRows, type QuadRow } from "./quadrant";

let n = 0;
const row = (cost: number | null, tool_calls: number, extra: Partial<QuadRow> = {}): QuadRow =>
  ({ session_id: `s${String(++n).padStart(3, "0")}-session`, title: null, first_ts: "2026-11-03T14:20:00Z", cost, unpriced: 0, tool_calls, commits: 0, ...extra });
const model = (rows: QuadRow[], total = rows.length) => quadrantModel(rows, total);
const ids = (m: ReturnType<typeof model>) => m.dots.map(d => d.row.session_id);

describe("quadrantModel", () => {
  it("splits at the medians, a dot on a line counting as cheap or as little done", () => {
    const cases: [number, number, string][] = [[1, 10, "cheapLittle"], [2, 50, "cheapMuch"], [3, 30, "cheapLittle"], [4, 5, "costlyLittle"], [5, 40, "costlyMuch"]];
    const m = model(cases.map(([c, t]) => row(c, t)));
    expect(m.split).toEqual({ cost: 3, calls: 30 });
    expect(m.dots.map(d => [d.cost, d.calls, d.quadrant])).toEqual(cases);
    expect(m.counts).toEqual({ cheapMuch: 1, costlyMuch: 1, cheapLittle: 2, costlyLittle: 1 });
  });

  it.each([
    ["an odd count", [3, 1, 2], [9, 7, 8], { cost: 2, calls: 8 }, 1, 2],
    ["an even count", [1, 2, 3, 10], [4, 1, 3, 2], { cost: 2.5, calls: 2.5 }, 2, 2],
    ["ties on the line", [1, 1, 1, 2], [5, 5, 5, 5], { cost: 1, calls: 5 }, 1, 4],
  ])("takes the median of %s", (_, costs, calls, split, costly, little) => {
    const m = model(costs.map((c, i) => row(c, calls[i]!)));
    expect(m.split).toEqual(split);
    expect([m.dots.filter(d => d.quadrant!.startsWith("costly")).length, m.dots.filter(d => d.quadrant!.endsWith("Little")).length]).toEqual([costly, little]);
    expect(Object.values(m.counts!).reduce((a, b) => a + b)).toBe(m.dots.length);
  });

  it.each([0, 1, 2, 3])("splits only from three dots (%i)", k => {
    const m = model(Array.from({ length: k }, (_, i) => row(i + 1, i + 1)));
    expect([m.dots.length, m.split != null, m.counts != null, m.dots.some(d => d.quadrant)]).toEqual([k, k >= 3, k >= 3, k >= 3]);
    expect(notes(m).few).toBe(k === 1 ? "1 session: too few to split at a median." : k === 2 ? "2 sessions: too few to split at a median." : null);
    expect(notes(m).none).toBe(k ? null : "No session in this view has a known cost, so none can be placed.");
  });

  it("leaves out and counts the sessions with no known cost, and says the cut-off", () => {
    expect(notes(model([row(1, 1), row(null, 4), row(null, 2)]))).toEqual({ none: null, few: "1 session: too few to split at a median.", cut: null,
      leftOut: "2 sessions with no known cost are left out." });
    const one = model([row(1, 1), row(2, 2), row(3, 3), row(null, 4)], 412);
    expect([one.dots.length, one.leftOut]).toEqual([3, 1]);
    expect(notes(one)).toMatchObject({ cut: "The newest 4 of 412 sessions in this view; the medians are theirs.", leftOut: "1 session with no known cost is left out." });
    // None known: the plot's place says so, and no left-out line repeats it.
    expect(notes(model([row(null, 1), row(null, 2)]))).toEqual({ none: "No session in this view has a known cost, so none can be placed.", few: null, cut: null, leftOut: null });
    // A custom price list may hold negative rates: a session below $0 has no place on a log axis, nor in the zero lane.
    const below = model([row(-0.5, 3), row(-0.001, 1), row(1, 1), row(2, 2), row(3, 3), row(null, 4)]);
    expect([below.dots.map(d => d.cost), below.leftOut, below.negative, below.x.zero]).toEqual([[1, 2, 3], 1, 2, false]);
    expect(notes(below).leftOut).toBe("3 sessions are left out: 1 with no known cost and 2 with a negative cost.");
    expect(notes(model([row(1, 1), row(-2, 2)])).leftOut).toBe("1 session with a negative cost is left out.");
    expect(notes(model([row(-1, 1), row(null, 2)])).none).toBe("No session in this view has a known cost of $0 or more, so none can be placed.");
    // Cut: an older session may have a cost, and under three dots there is no median to be the newest sessions'.
    expect(notes(model([row(null, 1), row(-1, 2)], 412))).toEqual({ none: "No session in the newest 2 has a known cost of $0 or more, so none can be placed.",
      few: null, cut: "The newest 2 of 412 sessions in this view.", leftOut: null });
    expect(notes(model([row(1, 1), row(2, 2), row(null, 3)], 412))).toMatchObject({ none: null, cut: "The newest 3 of 412 sessions in this view.",
      few: "2 sessions: too few to split at a median.", leftOut: "1 session with no known cost is left out." });
  });

  it("reads cheapest first, then by tool calls, start and id, whatever the rows' order", () => {
    const rows = [row(1, 5, { first_ts: "2026-11-04T00:00:00Z", session_id: "a" }), row(1, 5, { first_ts: "2026-11-03T00:00:00Z", session_id: "c" }),
      row(1, 5, { first_ts: "2026-11-03T00:00:00Z", session_id: "b" }), row(1, 2, { session_id: "d" }), row(0, 9, { session_id: "e" }), row(9, 0, { session_id: "f" })];
    const want = ["e", "d", "b", "c", "a", "f"];
    for (const order of [rows, [...rows].reverse(), [rows[3]!, rows[0]!, rows[5]!, rows[1]!, rows[4]!, rows[2]!]]) expect(ids(model(order))).toEqual(want);
  });

  it.each([
    [[0.04, 20.01], 0.02, 50], [[3], 2, 5], [[2], 2, 20], [[1, 1], 1, 10], [[0.3, 0.7], 0.2, 1], [[1000], 1000, 10000], [[1, 85], 1, 100],
  ])("rounds %j out to 1, 2 or 5 times a power of ten", (vs, lo, hi) => {
    const m = model(vs.map(v => row(v, v)));
    expect([m.x.lo, m.x.hi, m.y.lo, m.y.hi]).toEqual([lo, hi, lo, hi]);
  });
});

describe("quadrantFit", () => {
  const finite = (v: unknown): boolean =>
    typeof v === "number" ? Number.isFinite(v) : v && typeof v === "object" ? Object.values(v).every(finite) : true;

  it.each([1, 1.25, 2])("sizes the box at text scale %d", s => {
    expect(quadrantFit(model([]), 343, s).height).toBe({ 1: 264, 1.25: 278, 2: 318 }[s]);
    expect(quadrantFit(model([]), 343, s).plot.w).toBe(343 - 72 * s);
    expect(quadrantFit(model([]), 343, s).nameGap).toBe(42 * s);
    // Wider labels widen the margins: the tool-call axis's widest, measured (jsdom: 0.6em a character), and half the cost
    // axis's last, which is centred on the plot's right edge. "200,000" is 46.2px at 11px, "$2,000" 39.6px.
    const wide = quadrantFit(model([row(0.4, 3), row(1500, 120000)]), 343, s);
    expect([wide.nameGap, wide.plot.x, wide.plot.w]).toEqual([46.2 * s + 12 * s, 46.2 * s + 28 * s, 343 - 46.2 * s - 28 * s - 19.8 * s].map(v => expect.closeTo(v, 9)));
    // The cost axis name is centred on the plot: past the box's right edge, it moves left by as much, never past the left
    // one ("Estimated cost (log scale)" is 171.6px at 11px; at text scale 2 the name fills the box).
    const name = 171.6 * s / 2, centre = wide.plot.x + wide.plot.w / 2;
    expect(wide.costNameShift).toBeCloseTo(Math.max(0, Math.min(centre + name - 343, centre - name)), 9);
    expect(quadrantFit(model([row(0.4, 3), row(1500, 120000)]), 343, 2).costNameShift).toBeGreaterThan(0);
    expect(quadrantFit(model([]), 800, s).costNameShift).toBe(0);
  });

  it("places a dot by the log formula, ECharts' with outerBoundsMode none", () => {
    const f = quadrantFit(model([row(0.1, 1), row(1, 10), row(10, 100)]), 343, 1);
    expect([f.x, f.y]).toEqual([{ min: 0.1, max: 10, lane: false }, { min: 1, max: 100, lane: false }]);
    expect(f.dots[1]).toEqual({ x: 1, y: 10, px: expect.closeTo(58 + 271 / 2, 9), py: expect.closeTo(10 + 105, 9), filled: false });
    expect([f.dots[0]!.px, f.dots[0]!.py, f.dots[2]!.px, f.dots[2]!.py]).toEqual([58, 220, 329, 10]);
  });

  it.each([[1, 0], [2, 300]])("gives an axis a lane only when a 0 is shown (s %d, width %d)", (s, width) => {
    expect(quadrantFit(model([row(1, 1), row(5, 9)]), 343, s)).toMatchObject({ x: { min: 1, lane: false }, y: { min: 1, lane: false } });
    const m = model([row(0, 4, { commits: 1 }), row(2, 0), row(5, 9), row(3, 3)]), f = quadrantFit(m, width, s);
    expect(finite(f)).toBe(true);
    expect([f.x.lane, f.y.lane, f.x.min < m.x.lo, f.y.min < m.y.lo]).toEqual([true, true, true, true]);
    // The 0s sit at the lane's min, the plot's edge; the smallest tick a lane's width in.
    expect(f.dots[0]).toMatchObject({ x: f.x.min, px: f.plot.x, filled: true });
    expect(f.dots.find(d => d.y === f.y.min)!.py).toBe(f.plot.y + f.plot.h);
    f.dots.forEach((d, i) => expect(dotAt(f, d.px, d.py)).toBe(i)); // each pixel reads back its own dot, in a lane or not
    // The smallest tick: ECharts ticks a log axis at the powers of ten, so it is 1 under lo 2, not lo.
    expect([m.x.lo, m.y.lo]).toEqual([2, 2]);
    const lo = quadrantFit({ ...m, dots: [{ ...m.dots[0]!, cost: 1, calls: 1 }] }, width, s).dots[0]!;
    expect(lo.px - f.plot.x).toBeCloseTo(width ? 30 * s : 0, 9); // no plot width: every dot at its left edge
    expect(f.plot.y + f.plot.h - lo.py).toBeCloseTo(16 * s, 9);
  });

  it("keeps a lane to a decade, so no other power of ten is ticked in it", () => {
    const m = model([row(0, 3), row(0.01, 3), row(20, 9)]);
    expect(quadrantFit(m, 343, 1).x.min).toBeCloseTo(0.01 * (0.01 / 20) ** (30 / 241), 12); // 30px: under a decade
    expect(quadrantFit(m, 343, 2).x.min).toBe(0.001); // 60px of 199 would be 1.4 decades
  });

  it.each([
    ["no dot", []], ["one dot", [[2, 7]]], ["equal dots", [[2, 7], [2, 7], [2, 7]]], ["all at 0", [[0, 0], [0, 0], [0, 0]]], ["a 0 cost", [[0, 3], [1, 3], [4, 8]]],
  ] as [string, [number, number][]][])("keeps every figure finite with %s", (_, pts) => {
    for (const w of [0, 343]) for (const s of [1, 2]) {
      const m = model(pts.map(([c, t]) => row(c, t)));
      expect([finite(m), finite(quadrantFit(m, w, s))]).toEqual([true, true]);
    }
  });

  it("draws a corner name only where it fits", () => {
    const m = model([row(0.1, 1), row(1, 10), row(10, 100)]);
    expect(quadrantFit(m, 343, 2).names).toEqual([]);
    expect(quadrantFit(m, 343, 1).names.map(n => n.label)).toEqual(["Cheap, much done", "Costly, much done", "Cheap, little done"]);
    const wide = quadrantFit(m, 800, 1), right = 800 - 14;
    expect(wide.names.map(n => [n.label, n.px, n.py, n.align, n.verticalAlign])).toEqual([
      ["Cheap, much done", 64, 16, "left", "top"], ["Costly, much done", right - 6, 16, "right", "top"],
      ["Cheap, little done", 64, 214, "left", "bottom"], ["Costly, little done", right - 6, 214, "right", "bottom"]]);
    // A median on the plot's edge leaves its side's quadrants no room: their names would sit across the guide.
    const names = (pts: [number, number][]) => quadrantFit(model(pts.map(([c, t]) => row(c, t))), 800, 1).names.map(n => n.quadrant);
    expect(names([[1, 0], [2, 0], [3, 0]])).toEqual(["cheapMuch", "costlyMuch"]);
    expect(names([[0, 1], [0, 2], [0, 3]])).toEqual(["costlyMuch", "costlyLittle"]);
  });
});

describe("reading", () => {
  it("picks the nearest dot within 12px, ties to the costlier, and counts a pile", () => {
    const m = model([row(1, 10), row(1, 30), row(5, 10), row(5, 10), row(5, 10), row(20, 10)]), f = quadrantFit(m, 343, 1);
    f.dots.forEach((d, i) => expect(dotAt(f, d.px, d.py)).toBe(i < 2 || i === 5 ? i : 4)); // one cost, two places: each its own
    const a = f.dots[0]!, pair = (gap: number) => ({ ...f, dots: [a, { ...a, px: a.px + gap }] });
    expect([dotAt(f, a.px + 12, a.py), dotAt(f, a.px - 13, a.py), dotAt(f, a.px, a.py + 13)]).toEqual([0, null, null]);
    expect([3, 5, 7].map(dx => dotAt(pair(10), a.px + dx, a.py))).toEqual([0, 1, 1]); // between two: the nearer; halfway: the costlier
    expect([tipRows(m, f, 4).more, tipRows(m, f, 0).more]).toEqual(["and 2 more sessions here", null]);
    expect([tipRows(m, pair(4), 0).more, tipRows(m, pair(4.5), 0).more]).toEqual(["and 1 more session here", null]);
  });

  it.each([
    [null, "ArrowRight", "a"], [null, "ArrowLeft", "c"], ["a", "ArrowLeft", "a"], ["c", "ArrowRight", "c"], ["b", "ArrowRight", "c"],
    ["b", "ArrowLeft", "a"], ["b", "Home", "a"], ["b", "End", "c"], ["gone", "ArrowRight", "a"], ["b", "ArrowUp", undefined], ["b", "Enter", undefined],
  ])("steps from %s on %s", (at, key, want) => expect(stepDot(["a", "b", "c"], at, key)).toBe(want));
  it("steps nowhere with no dot", () => expect(stepDot([], null, "Home")).toBeUndefined());
});

describe("sentences", () => {
  const ts = "2026-11-02T09:05:00Z";
  const m = model([
    row(4.2, 12, { title: "Add rate limiting to the /orders endpoint" }), row(0.85, 41, { title: "Fix the flaky invoice export test", commits: 2, first_ts: ts }),
    row(1.1, 30, { session_id: "demo-0123456", unpriced: 3, commits: 1 }), row(1.42, 23, { title: "Tidy" }), row(5, 1, { title: "Ship", commits: 1 }),
  ]);
  const at = (title: string) => m.dots.findIndex(d => d.row.title === title);

  it("reads a dot in words", () => {
    const t = when("2026-11-03T14:20:00Z");
    expect(readDot(m, at("Add rate limiting to the /orders endpoint"))).toBe(`Add rate limiting to the /orders endpoint, started ${t}: $4.20, 12 tool calls, no commit. Costly, little done.`);
    expect(readDot(m, at("Fix the flaky invoice export test"))).toBe(`Fix the flaky invoice export test, started ${when(ts)}: $0.85, 41 tool calls, 2 commits. Cheap, much done.`);
    expect(readDot(m, 1)).toBe(`#demo-012, started ${t}: at least $1.10, 30 tool calls, 1 commit. Cheap, much done.`);
    expect(readDot(m, at("Ship"))).toBe(`Ship, started ${t}: $5.00, 1 tool call, 1 commit. Costly, little done.`);
    const few = model([row(0, 0, { session_id: "zero0000-x", first_ts: null })]);
    expect(readDot(few, 0)).toBe("#zero0000, started –: $0, no tool call, no commit.");
    expect(tipRows(m, quadrantFit(m, 343, 1), 1)).toEqual({ name: "#demo-012", unpriced: true, quadrant: "Cheap, much done", more: null,
      rows: [["Started", t], ["Est. cost", "at least $1.10"], ["Tool calls", "30"], ["Commits", "1"]] });
    expect(tipRows(few, quadrantFit(few, 343, 1), 0)).toMatchObject({ unpriced: false, quadrant: null, rows: [["Started", "–"], ["Est. cost", "$0"], ["Tool calls", "0"], ["Commits", "0"]] });
    // A positive cost that rounds to $0.00 is not the zero lane's $0; with unpriced requests it is a floor.
    const tiny = model([row(0.003, 2, { title: "Tiny" }), row(0.002, 1, { title: "Floor", unpriced: 1 })]), tf = quadrantFit(tiny, 343, 1);
    expect(tiny.dots.map((_, i) => [readDot(tiny, i).split(": ")[1], tipRows(tiny, tf, i).rows[1]![1]])).toEqual([
      ["more than $0, 1 tool call, no commit.", "more than $0"], ["under $0.01, 2 tool calls, no commit.", "<$0.01"]]);
  });

  it("labels the plot with and without a split", () => {
    const keys = "Filled dots made a commit. Use the left and right arrow keys to step from the cheapest session to the costliest, Home and End for the ends, Enter to open one.";
    expect(groupLabel(m, "atlas-api")).toBe("Sessions of atlas-api by estimated cost and tool calls, both on log scales: 5 sessions, split at the medians of $1.42 and 23 tool calls. "
      + `Costly, little done: 2; cheap, much done: 2; costly, much done: 0; cheap, little done: 1. ${keys}`);
    expect(groupLabel(model([row(1, 10), row(2, 20), row(3, 25), row(4, 30)]), "p")).toContain("split at the medians of $2.50 and 22.5 tool calls.");
    expect(groupLabel(model([row(0, 1), row(0.004, 2), row(1, 3)]), "p")).toContain("split at the medians of under $0.01 and 2 tool calls.");
    expect(groupLabel(model([row(1, 1), row(2, 2)]), "atlas-api")).toBe(`Sessions of atlas-api by estimated cost and tool calls, both on log scales: 2 sessions: too few to split at a median. ${keys}`);
  });
});
