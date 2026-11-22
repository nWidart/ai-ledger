import { describe, expect, it } from "vitest";
import session from "../../../__fixtures__/session";
import type { SessionDetail } from "../../../api";
import { timelineModel } from "../session";
import { ROW, spansLayout, type SpanCall } from "./spans";
import { alongside, groupLabel, noteLines, readSpan, spanAt, stepSpan, tipRows } from "./spansReading";

const T0 = Date.parse("2026-11-04T10:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60e3).toISOString();
let n = 0;
/** A call from start to end, in minutes after T0. */
const call = (start: number | null, end: number | null, o: Partial<SpanCall> = {}): SpanCall => ({
  id: `c${String(++n).padStart(3, "0")}`, tool: "Bash", start_ts: start == null ? null : at(start), end_ts: end == null ? null : at(end),
  is_error: end == null ? null : false, subagent: false, lane: 0, input: "", ...o,
});
const sub = (lane: number | null, start: number, end: number | null, o: Partial<SpanCall> = {}) => call(start, end, { subagent: true, lane, ...o });
const layout = (calls: SpanCall[], compaction_ts: string[] = []) => {
  const s = { ...session, requests: [], compaction_ts, calls: calls.map(c => ({ ...c, category: null, is_commit: false })) } as unknown as SessionDetail;
  return spansLayout(timelineModel(s, 600, 1), calls, 600, 1)!;
};
const clock = (min: number, date = false) => new Date(T0 + min * 60e3).toLocaleTimeString(undefined,
  { ...(date ? { month: "short", day: "numeric" } : {}), hour: "2-digit", minute: "2-digit", second: "2-digit" });

describe("stepSpan", () => {
  // Main: a, b, c; subagent 1: d at 2.5, as near a as b (a tie, to the earlier), and e at 7, nearest b.
  const [a, b, c] = [call(0, 1), call(5, 6), call(10, 11)], [d, e] = [sub(1, 2.5, 4), sub(1, 7, 8)], l = layout([a, b, c, d, e]);
  it.each([
    [null, "ArrowRight", a], [null, "ArrowDown", a], [null, "Home", a], [null, "ArrowLeft", c], [null, "End", c],
    [a, "ArrowRight", b], [c, "ArrowRight", c], [b, "ArrowLeft", a], [a, "ArrowLeft", a], [b, "End", c], [c, "Home", a],
    [b, "ArrowDown", e], [e, "ArrowDown", e], [d, "ArrowUp", a], [a, "ArrowUp", a], [e, "ArrowUp", b],
  ] as const)("from %o on %s", (from, key, want) => expect(stepSpan(l, from?.id ?? null, key)).toBe(want.id));
  it("steps nowhere on another key, with no call, or from a gone call", () => {
    expect([stepSpan(l, a.id, "Enter"), stepSpan(l, null, "PageDown"), stepSpan(l, "gone", "ArrowRight")]).toEqual([undefined, undefined, undefined]);
  });
});

describe("spanAt", () => {
  // Four calls at once fill the main thread's rows; a fifth, a tick, is drawn over the last row's bar.
  const first = call(0, 10), tick = call(5, 5), l = layout([first, ...[1, 2, 3].map(k => call(k, 10)), tick, call(20, 21)]);
  const x0 = l.spans.find(x => x.id === first.id)!.x0, top = l.lanes[0]!.top;
  it.each([
    ["on a bar", x0 + 20, top + 4, first],
    ["6px beside a bar", x0 - 6, top + 4, first],
    ["7px beside a bar", x0 - 7, top + 4, null],
    ["over a tick that lies on a bar", l.spans.find(x => x.id === tick.id)!.x0 + .5, top + 3 * ROW + 4, tick],
    ["in the gap under a row's bar", x0 + 1, top + 9, first],
    ["in the gap after the lane", x0 + 1, top + 4 * ROW + 1, null],
  ])("%s", (_, x, y, want) => expect(spanAt(l, x, y)).toBe(want?.id ?? null));
});

describe("the words", () => {
  const timed = call(2, 8.5, { is_error: true, input: "npm test" }), open = sub(2, 2, null, { input: "npm run dev" });
  const still = call(20, 20, { tool: "exec_command", input: "cargo test" }), noStart = call(null, 22, { tool: "Read" });
  const stillFailed = call(23, 23, { tool: "exec_command", is_error: true });
  const past = call(30, 50), others = [sub(1, 5, 6)], folded = [1, 2, 3, 4, 5, 6, 7].map(r => sub(r, 25, 26));
  const l = layout([timed, open, still, noStart, stillFailed, past, ...others, ...folded, call(31, 32, { tool: null })]);

  it("says each call in one sentence, its true times and one-unit duration", () => {
    expect([timed, open, still, stillFailed, noStart, past, folded[6]!].map(c => readSpan(l, c.id))).toEqual([
      `Bash on the main thread, ${clock(2)} to ${clock(8.5)}, 7m, failed: npm test. 2 other calls ran during it.`,
      `Bash on subagent 2, started ${clock(2)}, no result recorded: npm run dev. 1 other call ran during it.`,
      `exec_command on the main thread, at ${clock(20)}, no duration recorded: cargo test.`,
      `exec_command on the main thread, at ${clock(23)}, no duration recorded, failed.`,
      `Read on the main thread, ended ${clock(22)}, start not recorded.`,
      `Bash on the main thread, ${clock(30)} to ${clock(50)}, 20m. 1 other call ran during it.`,
      `Bash on subagent 7, ${clock(25)} to ${clock(26)}, 1m. 6 other calls ran during it.`,
    ]);
    expect([alongside(l, still.id), alongside(l, timed.id)]).toEqual([0, 2]);
    const short = layout([call(0, 0.007), call(30, 31)]);
    expect(readSpan(short, short.spans[0]!.id)).toContain(", 420ms.");
    // The timeline's axis runs over 20 hours by a compaction, though the calls' own times do not.
    const long = layout([call(0, 1), call(2, 3)], [at(21 * 60)]);
    expect(readSpan(long, long.spans[0]!.id)).toContain(`${clock(0, true)} to ${clock(1, true)}`);
  });

  it("gives a clipped call's tooltip its true times", () => {
    expect(l.spans.find(s => s.id === past.id)!.clipped).toBe(true);
    expect(tipRows(l, past.id)).toEqual({ tool: "Bash", input: null, rows: ["Main thread", `${clock(30)} to ${clock(50)}`, "20m", "Succeeded", "and 1 other call at the same time"] });
    expect([still, stillFailed].map(c => tipRows(l, c.id)!.rows)).toEqual([
      ["Main thread", `At ${clock(20)}, no duration recorded`, "Succeeded"], ["Main thread", `At ${clock(23)}, no duration recorded`, "Failed"]]);
    expect(tipRows(l, open.id)).toEqual({ tool: "Bash", input: "npm run dev", rows: ["Subagent 2", `Started ${clock(2)}, no result recorded`, "and 1 other call at the same time"] });
  });

  it("labels the group", () => {
    expect(groupLabel(l, { ...session.info, active_s: 6840 })).toBe("Tool calls of this session by thread, on the timeline's time axis: "
      + "15 calls on 8 threads, the main thread and 7 subagents, over 1.9h of active time; the longest, Bash, 20m. Use the left and right arrow keys "
      + "to step through a thread's calls, up and down to change thread, Home and End for its first and last call, Enter to open the tool.");
  });

  it("says the notes", () => {
    const over = [0, .5, 1, 1.5].map(k => sub(1, k, 3)), cut = [call(0, 1), call(1, 1), call(2, 30), call(42, 50), call(42, 60), ...over];
    const many = layout([...cut, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => sub(r, 3, 3.1))]);
    expect(noteLines(many, true)).toEqual([
      "Long session: only its first 18 tool calls are drawn.",
      "1 call has no recorded duration: drawn as a tick.",
      "2 calls ran past the last event: their bars end at the edge.",
      "1 call ran through squeezed time; its bar is shorter than its duration.",
      "1 call ran beside 3 others on subagent 1 and is drawn over its last row.",
      "Subagents 7 to 9 share the lane Other subagents.",
    ]);
    expect(noteLines(layout([call(0, 1), call(2, 3)]), false)).toEqual(["1 call ran past the last event: its bar ends at the edge."]);
  });

  it("reads nothing of a gone call, and never says a missing value", () => {
    expect([readSpan(l, "gone"), tipRows(l, "gone"), alongside(l, "gone")]).toEqual([undefined, undefined, undefined]);
    const texts = l.spans.flatMap(s => { const t = tipRows(l, s.id)!; return [readSpan(l, s.id), t.tool, t.input ?? "", ...t.rows]; }).concat(groupLabel(l, { ...session.info, active_s: null }));
    for (const t of texts) expect(t).not.toMatch(/undefined|NaN|null/);
    expect(readSpan(l, l.spans.at(-1)!.id)).toMatch(/^Unknown tool on the main thread/);
  });
});
