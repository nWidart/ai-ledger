// The tool-call chart's reading, pure (design decision 7): which call a key or the pointer reads, and its words: the sentence,
// the tooltip's rows, the group's label and the notes (decision 5). Every lookup of a call takes its id; an id the layout does
// not hold (a call gone from newer data) reads undefined, never an error.
import type { SessionInfo } from "../../../api";
import { dur, ms, num, plural } from "../../../format";
import { ROW, type Lane, type Span, type SpansLayout } from "./spans";

/** The pointer reads a span within this many px beside it, in its row's band. */
const NEAR_PX = 6;

const spanOf = (l: SpansLayout, id: string) => l.spans.find(s => s.id === id);
/** Where a call sits in time: its start, else its end, as the timeline's tick. */
const at = (s: Span) => (s.start ?? s.end)!;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** The lanes a key steps through: those with a call (the main thread is drawn empty while a subagent has a call). */
const read = (l: SpansLayout) => l.lanes.filter(x => x.ids.length);

/** The call id a key reads from the call at (null for none), or undefined for any other key, with no call, or for an id the
 *  layout does not hold. Right and Left the next and previous in the lane, Home and End its ends, staying at an end; Up and Down
 *  the lane above and below, its call nearest in time (ties to the earlier), staying at the top and bottom lane. With nothing
 *  read, the top lane's first call (Left and End: its last). */
export function stepSpan(l: SpansLayout, at0: string | null, key: string): string | undefined {
  const lanes = read(l);
  if (!lanes.length || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return undefined;
  if (at0 == null) return key === "ArrowLeft" || key === "End" ? lanes[0]!.ids.at(-1) : lanes[0]!.ids[0];
  const s = spanOf(l, at0);
  if (!s) return undefined;
  const li = lanes.findIndex(x => x === l.lanes[s.lane]), ids = lanes[li]!.ids, i = ids.indexOf(at0);
  switch (key) {
    case "ArrowRight": return ids[Math.min(i + 1, ids.length - 1)];
    case "ArrowLeft": return ids[Math.max(i - 1, 0)];
    case "Home": return ids[0];
    case "End": return ids.at(-1);
    default: {
      const to = lanes[key === "ArrowUp" ? li - 1 : li + 1];
      return to ? nearest(l, to, at(s)) : at0;
    }
  }
}
/** The lane's call nearest in time to t; the lane's ids run by time, so the first of equals is the earlier. */
function nearest(l: SpansLayout, lane: Lane, t: number): string {
  let best = lane.ids[0]!, d = Infinity;
  for (const id of lane.ids) {
    const e = Math.abs(at(spanOf(l, id)!) - t);
    if (e < d) { d = e; best = id; }
  }
  return best;
}

/** The call id under (x, y) in the box's px, or null: in the row band under the pointer (the row's bar and its gap), the span
 *  nearest across within 6px (0 inside it); ties go to the shorter span (drawn on top), then the earlier, then the id. */
export function spanAt(l: SpansLayout, x: number, y: number): string | null {
  const li = l.lanes.findIndex(n => y >= n.top && y < n.top + n.rows * ROW);
  if (li < 0) return null;
  const row = Math.floor((y - l.lanes[li]!.top) / ROW);
  let best: Span | null = null, bd = Infinity;
  for (const s of l.spans) {
    if (s.lane !== li || s.row !== row) continue;
    const d = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0;
    if (d > NEAR_PX) continue;
    if (!best || d < bd || (d === bd && (s.x1 - s.x0 - (best.x1 - best.x0) || at(s) - at(best) || cmp(s.id, best.id)) < 0)) { best = s; bd = d; }
  }
  return best ? best.id : null;
}

/** A call's time as an interval; a call with no duration or no result is the instant it sits at. */
const span = (s: Span): [number, number] => [at(s), s.ms != null ? s.start! + s.ms : at(s)];
/** Two calls ran at once: their intervals overlap, or an instant falls within the other's interval (its end excluded). */
function overlap(a: Span, b: Span): boolean {
  const [a0, a1] = span(a), [b0, b1] = span(b);
  if (a1 > a0 && b1 > b0) return a0 < b1 && b0 < a1;
  if (a1 > a0) return a0 <= b0 && b0 < a1;
  return b1 > b0 && b0 <= a0 && a0 < b1;
}
/** How many other calls, in any lane, ran during the call; undefined for an id the layout does not hold. */
export function alongside(l: SpansLayout, id: string): number | undefined {
  const s = spanOf(l, id);
  return s && l.spans.filter(o => o !== s && overlap(s, o)).length;
}

/** The session spans over 20 hours (the timeline's long rule), by its calls' own times: times then carry their date. */
function long(l: SpansLayout): boolean {
  const ts = l.spans.flatMap(s => [s.start, s.end]).filter((t): t is number => t != null);
  return ts.length > 0 && Math.max(...ts) - Math.min(...ts) > 20 * 3600e3;
}
const clock = (l: SpansLayout, t: number) => new Date(t).toLocaleTimeString(undefined,
  { ...(long(l) ? { month: "short", day: "numeric" } : {}), hour: "2-digit", minute: "2-digit", second: "2-digit" } as const);
/** A duration in one unit: dur() from a second, ms() under one. */
const length = (v: number) => (Math.round(v) < 1000 ? ms(v) : dur(v / 1000));
/** The call's own thread: a call of the folded lane keeps its subagent's number. */
const thread = (s: Span) => (s.sub === 0 ? "Main thread" : s.sub == null ? "Subagents, not told apart" : `Subagent ${s.sub}`);
const on = (s: Span) => (s.sub === 0 ? "the main thread" : s.sub == null ? "a subagent not told apart" : `subagent ${s.sub}`);

/** The call's time in words: [the sentence's, the tooltip's]. */
function when(l: SpansLayout, s: Span): [string, string] {
  if (s.start == null) return [`ended ${clock(l, s.end!)}, start not recorded`, `Ended ${clock(l, s.end!)}, start not recorded`];
  const t = clock(l, s.start);
  if (s.kind === "open") return [`started ${t}, no result recorded`, `Started ${t}, no result recorded`];
  if (s.kind === "still") return [`at ${t}, no duration recorded`, `At ${t}, no duration recorded`];
  const both = `${t} to ${clock(l, s.end!)}`;
  return [`${both}, ${length(s.ms!)}${s.kind === "failed" ? ", failed" : ""}`, both];
}

/** The call in one sentence, as the live region says it; undefined for an id the layout does not hold. */
export function readSpan(l: SpansLayout, id: string): string | undefined {
  const s = spanOf(l, id);
  if (!s) return undefined;
  const n = alongside(l, id)!;
  return `${s.tool} on ${on(s)}, ${when(l, s)[0]}${s.input ? `: ${s.input}` : ""}.`
    + (n ? ` ${plural(n, "other call")} ran during it.` : "");
}

/** The call's tooltip: the tool (bold), its input (null when empty), then the thread, the times, the duration, the outcome and
 *  the calls beside it, each when known. Undefined for an id the layout does not hold. */
export function tipRows(l: SpansLayout, id: string): { tool: string; input: string | null; rows: string[] } | undefined {
  const s = spanOf(l, id);
  if (!s) return undefined;
  const n = alongside(l, id)!;
  const rows = [thread(s), when(l, s)[1]];
  if (s.ms != null) rows.push(length(s.ms));
  if (s.kind === "ok" || s.kind === "failed") rows.push(s.kind === "failed" ? "Failed" : "Succeeded");
  if (n) rows.push(`and ${plural(n, "other call")} at the same time`);
  return { tool: s.tool, input: s.input || null, rows };
}

/** "a", "a and b", "a, b and c". */
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The chart's label, on the wrapper's focusable box. The threads: the main thread, each subagent, and the calls of subagents
 *  not told apart as one. */
export function groupLabel(l: SpansLayout, info: SessionInfo): string {
  const subs = new Set(l.spans.map(s => s.sub).filter(k => k != null && k > 0)).size;
  const parts = [
    ...(l.spans.some(s => s.sub === 0) ? ["the main thread"] : []),
    ...(subs ? [plural(subs, "subagent")] : []),
    ...(l.spans.some(s => s.sub == null) ? ["subagents not told apart"] : []),
  ];
  const longest = l.spans.reduce<Span | null>((b, s) => (s.ms != null && (!b || s.ms > b.ms!) ? s : b), null);
  const body = !l.spans.length ? "no tool call"
    : `${plural(l.spans.length, "call")} on ${plural(parts.length - (subs ? 1 : 0) + subs, "thread")}, ${list(parts)}`
      + (info.active_s != null ? `, over ${dur(info.active_s)} of active time` : "")
      + (longest ? `; the longest, ${longest.tool}, ${length(longest.ms!)}` : "");
  return `Tool calls of this session by thread, on the timeline's time axis: ${body}. `
    + "Use the left and right arrow keys to step through a thread's calls, up and down to change thread, Home and End for its first and last call, Enter to open the tool.";
}

/** A lane as the over-the-cap note names it. */
const laneWords = (x: Lane) =>
  x.key === "main" ? "the main thread" : x.key.startsWith("sub-") ? `subagent ${x.key.slice(4)}` : `the lane ${x.name.replace(/ \(.*\)$/, "")}`;
/** The folded subagents: "7", "7 to 9", or "7, 9 and 12" when their numbers skip. */
const ranks = (rs: number[]) => (rs.length > 1 && rs.at(-1)! - rs[0]! === rs.length - 1 ? `${rs[0]} to ${rs.at(-1)}` : list(rs.map(String)));

/** The notes above the chart, each only when its count is not 0 (decision 5). truncated: the payload cut the calls. */
export function noteLines(l: SpansLayout, truncated: boolean): string[] {
  const { still, clipped, squeezed, over, folded } = l.notes, one = (n: number) => n === 1;
  return [
    truncated && `Long session: only its first ${num(l.spans.length)} tool calls are drawn.`,
    still && `${plural(still, "call")} ${one(still) ? "has" : "have"} no recorded duration: drawn as ${one(still) ? "a tick" : "ticks"}.`,
    clipped && `${plural(clipped, "call")} ran past the last event: ${one(clipped) ? "its bar ends" : "their bars end"} at the edge.`,
    squeezed && `${plural(squeezed, "call")} ran through squeezed time; `
      + `${one(squeezed) ? "its bar is shorter than its duration" : "their bars are shorter than their durations"}.`,
    ...over.map(({ lane, n }) => `${plural(n, "call")} ran beside ${num(l.lanes[lane]!.rows)} others on ${laneWords(l.lanes[lane]!)} `
      + `and ${one(n) ? "is" : "are"} drawn over its last row.`),
    folded.length > 0 && `${one(folded.length) ? "Subagent" : "Subagents"} ${ranks(folded)} ${one(folded.length) ? "shares" : "share"} the lane Other subagents.`,
  ].filter((x): x is string => typeof x === "string");
}
