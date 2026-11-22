import { describe, expect, it } from "vitest";
import session from "../../../__fixtures__/session";
import type { SessionDetail } from "../../../api";
import { timelineModel } from "../session";
import { spansLayout, type SpanCall } from "./spans";

const T0 = Date.parse("2026-11-04T10:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60e3).toISOString();
let n = 0;
/** A call from start to end, in minutes after T0. */
const call = (start: number | null, end: number | null, o: Partial<SpanCall> = {}): SpanCall => ({
  id: `c${String(++n).padStart(3, "0")}`, tool: "Bash", start_ts: start == null ? null : at(start), end_ts: end == null ? null : at(end),
  is_error: end == null ? null : false, subagent: false, lane: 0, input: "", ...o,
});
const sub = (lane: number | null, start: number, end: number) => call(start, end, { subagent: true, lane });
/** The fixture session with these calls only: the axis is their times. */
const sess = (calls: SpanCall[]): SessionDetail => ({
  ...session, requests: [], compaction_ts: [], calls: calls.map(c => ({ ...c, category: null, is_commit: false })) as unknown as SessionDetail["calls"],
});
const layout = (calls: SpanCall[], width = 600, ts = 1) => {
  const tl = timelineModel(sess(calls), width, ts)!;
  return { tl, l: spansLayout(tl, calls, width, ts)! };
};
const span = (l: ReturnType<typeof layout>["l"], c: SpanCall) => l.spans.find(s => s.id === c.id)!;

describe("the time mapping", () => {
  // Starts at 0, 2, 42 and 45: a squeezed gap from 2 to 42 before the axis's end; keep is 30 s (5 minutes active).
  // The last call starts at the axis's end and runs past it.
  const long = call(2, 30), short = call(2, 2.25), past = call(42, 50), last = call(45, 50), calls = [call(0, 1), long, short, past, last];
  const { tl, l } = layout(calls);
  const g = tl.gaps[0]!;

  it.each([
    ["a call longer than keep ending inside the gap: at the gap's far side", long, "x1", tl.x(g.b) + .5],
    ["a short call ending inside the gap: unchanged", short, "x1", tl.x(Date.parse(short.end_ts!)) + .5],
    ["a time past the axis's end: its point in the right margin, 2px before the box's edge", past, "x1", tl.m.l + tl.iw + tl.m.r - 2],
    ["a start on the axis", past, "x0", tl.x(Date.parse(past.start_ts!)) - .5],  ] as const)("%s", (_, c, edge, x) => {
    expect(tl.gaps).toHaveLength(1);
    expect(span(l, c)[edge]).toBeCloseTo(x, 9);
  });

  it("flags the clipped and the squeezed call, not the short one", () => {
    expect([span(l, long), span(l, short), span(l, past)].map(s => [s.clipped, s.squeezed])).toEqual([[false, true], [false, false], [true, false]]);
    expect([span(l, long).ms, span(l, past).end]).toEqual([28 * 60e3, Date.parse(past.end_ts!)]);
    expect(l.breaks).toEqual([g.bx]);
  });

  it("scales by the box's width below 300px, as the timeline's svg", () => {
    const narrow = timelineModel(sess(calls), 280, 1)!, small = spansLayout(narrow, calls, 280, 1)!;
    const t = Date.parse(past.start_ts!);
    // A clipped point 2px before the box's edge; the call that starts at the axis's end, in a margin narrowed to 7.5px, 6px long.
    expect([span(small, past).x0, span(small, past).x1, span(small, last).x0]).toEqual([narrow.x(t) * 280 / 300 - .5, 278, 272].map(x => expect.closeTo(x, 9)));
    expect([small.left, small.right]).toEqual([narrow.m.l * 280 / 300, (narrow.m.l + narrow.iw) * 280 / 300]);
    expect(small.breaks[0]).toBeCloseTo(narrow.gaps[0]!.bx * 280 / 300, 9);
  });

  it("never yields NaN, whatever the input", () => {
    // Two starts make an axis; the third call's start cannot be read.
    const bad = [call(0, 10), call(5, 6), call(null, null, { start_ts: "garbage", end_ts: at(3) })];
    const { l: odd } = layout(bad);
    expect(odd.spans.map(s => s.id)).toEqual([bad[0]!.id, bad[1]!.id]);
    expect(odd.spans.every(s => Number.isFinite(s.x0) && Number.isFinite(s.x1))).toBe(true);
    expect(spansLayout(null, bad, 600, 1)).toBeNull();
    const tl = timelineModel(sess(bad), 600, 1)!;
    expect([NaN, 0, -1, Infinity].map(w => spansLayout(tl, bad, w, 1))).toEqual([null, null, null, null]);
  });
});

describe("spansLayout", () => {
  it.each([
    ["a timed call", call(1, 1.5), "ok", false],
    ["a failed call", call(1, 1.5, { is_error: true }), "failed", true],
    ["a call with no result", call(1, null, { is_error: null }), "open", false],
    ["a call with no duration", call(1, 1), "still", false],
    ["a failed call with no duration", call(1, 1, { is_error: true }), "still", true],
    ["a call that ends before it starts", call(1, .5), "still", false],
    ["a call whose end cannot be read", call(1, null, { end_ts: "2026-13-45T99:00:00" }), "still", false],
    // A result with no time (Grok's agentTimestampMs absent): is_error says there is a result.
    ["a failed call with no end", call(1, null, { is_error: true }), "still", true],
    ["a succeeded call with no end", call(1, null, { is_error: false }), "still", false],
  ])("draws %s from x(start) − 0.5, at least 1px wide", (_, c, kind, failed) => {
    const calls = [call(0, .1), c, call(10, 11)], { tl, l } = layout(calls), s = span(l, c);
    expect([s.kind, s.failed]).toEqual([kind, failed]);
    expect(s.x0).toBeCloseTo(tl.x(Date.parse(c.start_ts!)) - .5, 9);
    expect(s.x1 - s.x0).toBeGreaterThanOrEqual(1);
    expect(s.ms).toBe(kind === "ok" || kind === "failed" ? 30e3 : null);
  });

  it("puts a call with no start at its end, as the timeline's tick, and names an unknown tool", () => {
    const c = call(null, 3, { tool: null }), { tl, l } = layout([call(0, 1), c, call(10, 11)]), s = span(l, c);
    expect([s.kind, s.start, s.tool, s.known]).toEqual(["still", null, "Unknown tool", false]);
    expect(s.x0).toBeCloseTo(tl.x(Date.parse(c.end_ts!)) - .5, 9);
  });

  it("orders the lanes by rank and keys them by it, whatever the calls' order", () => {
    const calls = [sub(2, 1, 2), sub(null, 3, 4), call(5, 6, { subagent: null, lane: null }), sub(1, 7, 8), call(9, 10)];
    const { l } = layout(calls);
    expect(l.lanes.map(x => [x.key, x.name, x.ids])).toEqual([
      ["main", "Main thread", [calls[2]!.id, calls[4]!.id]],
      ["sub-1", "Subagent 1", [calls[3]!.id]],
      ["sub-2", "Subagent 2", [calls[0]!.id]],
      ["apart", "Subagents, not told apart", [calls[1]!.id]],
    ]);
    expect(l.spans.map(s => [s.id, s.lane, s.sub])).toEqual(calls.map((c, i) => [c.id, [2, 3, 0, 1, 0][i], [2, null, 0, 1, 0][i]]));
    // The main thread stays while another lane has a call.
    expect(layout([sub(1, 0, 1), sub(1, 2, 3)]).l.lanes.map(x => [x.key, x.ids.length])).toEqual([["main", 0], ["sub-1", 2]]);
  });

  it.each([
    ["three calls at once", [[0, 5], [1, 6], [2, 7]], [0, 1, 2], 3, 0],
    ["two calls in sequence", [[0, 1], [1, 2]], [0, 0], 1, 0],
    ["a fifth call at once on the main thread, drawn over its last row", [[0, 9], [1, 9], [2, 9], [3, 9], [4, 9]], [0, 1, 2, 3, 3], 4, 1],
  ] as const)("packs %s", (_, times, rows, count, over) => {
    const calls = times.map(([a, b]) => call(a, b)), { l } = layout([...calls, call(20, 21)]);
    expect(calls.map(c => span(l, c).row)).toEqual(rows);
    expect(l.lanes[0]!.rows).toBe(count);
    expect(l.notes.over).toEqual(over ? [{ lane: 0, n: over }] : []);
  });

  it("caps a subagent lane at three rows, and folds the seventh subagent into Other subagents", () => {
    const calls = [1, 2, 3, 4, 5, 6, 7].map(r => sub(r, r, r + .5)), extra = [sub(1, 1, 9), sub(1, 1.1, 9), sub(1, 1.2, 9)];
    const { l } = layout([...calls, ...extra, call(0, 1)]);
    expect(l.lanes.map(x => x.key)).toEqual(["main", "sub-1", "sub-2", "sub-3", "sub-4", "sub-5", "sub-6", "other"]);
    expect(l.lanes.at(-1)!.name).toBe("Other subagents (1)");
    expect([span(l, calls[6]!).lane, span(l, calls[6]!).sub]).toEqual([7, 7]);
    expect([l.lanes[1]!.rows, extra.map(c => span(l, c).row)]).toEqual([3, [1, 2, 2]]);
    expect(l.notes).toMatchObject({ folded: [7], over: [{ lane: 1, n: 1 }] });
  });

  // Decision 5's examples; its 642px for every cap at 32px text is 622 by its own formula.
  it.each([
    ["one main row", () => [call(0, 1), call(2, 3)], 1, 50],
    ["main 3 rows and three subagent lanes of 2 rows", () => rows([3, 2, 2, 2]), 1, 190],
    ["every lane at its cap", capped, 1, 480],
    ["every lane at its cap at 32px text", capped, 2, 622],
  ] as const)("is %s high", (_, calls, ts, h) => {
    expect(layout(calls(), 600, ts).l.height).toBe(h);
  });

  it("counts every note", () => {
    const calls = [call(0, 1), call(1, 1), call(null, 1.5), call(2, null), call(2, 30), call(42, 50), call(42, 60)];
    expect(layout(calls).l.notes).toEqual({ still: 2, clipped: 2, squeezed: 1, over: [], folded: [] });
  });
});

/** Lanes of these many calls at once (the first the main thread, then subagents 1, 2, …), so as many rows. */
function rows(counts: number[]): SpanCall[] {
  return counts.flatMap((k, lane) => Array.from({ length: k }, (_, r) => (lane ? sub(lane, r, 10) : call(r, 10))));
}
/** Every lane at its cap: the main thread at 4 rows, 7 subagents (the seventh folded) and the not-told-apart lane at 3. */
function capped(): SpanCall[] {
  return [...rows([4, 3, 3, 3, 3, 3, 3, 3]), sub(null, 0, 10), sub(null, 1, 10), sub(null, 2, 10)];
}
