// The session's tool calls by thread, pure: one lane per thread, each call a span from its start to its result, packed in
// rows of calls that did not overlap, on the session timeline's own time mapping (design decisions 2 to 5). Every x comes
// from timelineModel's x(); this file adds only the gap rule, the clamp and the width scale.
import type { TimelineModel } from "../session";

/** The fields of a payload call the layout reads. */
export interface SpanCall {
  id: string; tool: string | null; start_ts: string | null; end_ts: string | null; is_error: boolean | null;
  subagent: boolean | null; lane: number | null; input: string;
}

// The caps: assumed from the demo store (design decision 5).
export const MAIN_ROWS = 4;
export const LANE_ROWS = 3;
export const SUB_LANES = 6;

/** A row's height, the bar's height within it (the rest is the gap under it), in px. */
export const ROW = 10, BAR = 8;
const PAD = 4, LABEL = 14, LANE_GAP = 6, AXIS = 16;

/** ok and failed: a timed call; open: no result; still: no duration, or no start. */
export type SpanKind = "ok" | "failed" | "open" | "still";

export interface Span {
  id: string;
  /** "Unknown tool" when the payload's is NULL; known is then false, and Enter opens nothing (decision 8). */
  tool: string; known: boolean; input: string;
  /** The lane's index in lanes, the row's within it. */
  lane: number; row: number;
  /** The call's own thread: 0 the main thread, k subagent k (kept in a folded lane), null not told apart. */
  sub: number | null;
  /** The drawn edges in px of the box: at least 1px apart. */
  x0: number; x1: number;
  kind: SpanKind;
  /** Ran past the axis's end: drawn to the plot's edge. */
  clipped: boolean;
  /** Ran through squeezed time: drawn shorter than it lasted. */
  squeezed: boolean;
  /** The true times in ms since the epoch, and the duration (null for open and still). */
  start: number | null; end: number | null; ms: number | null;
}

export type LaneKey = "main" | `sub-${number}` | "other" | "apart";

export interface Lane {
  key: LaneKey; name: string;
  /** The rows drawn (at least 1, at most the lane's cap). */
  rows: number;
  /** The first row's top in px; the lane's label line is the LABEL × s above it. */
  top: number;
  /** The lane's call ids in reading order: by start (the end with no start), then id. */
  ids: string[];
}

export interface SpansLayout {
  /** Top to bottom: the main thread, subagents by rank, the folded "Other subagents", "Subagents, not told apart". */
  lanes: Lane[];
  /** In payload order. A call with no time the timeline can read has no span, as it has no tick. */
  spans: Span[];
  /** The box's height; bottom: where the lanes end and the time labels' line starts. */
  height: number; bottom: number;
  /** The plot's left and right edges in px. */
  left: number; right: number;
  /** Each squeezed gap's break, its centre's x in px. */
  breaks: number[];
  /** The notes' counts. over: each lane with calls drawn over its last row; folded: the subagents in "Other subagents". */
  notes: { still: number; clipped: number; squeezed: number; over: { lane: number; n: number }[]; folded: number[] };
}

/** A time's x on the timeline's axis, unclamped and unscaled; inside a squeezed gap, never past the gap's far side (decision 4). */
function gapX(tl: TimelineModel, t: number): number {
  let x = tl.x(t);
  for (const g of tl.gaps) if (g.a < t && t < g.b) x = Math.min(x, tl.x(g.b));
  return x;
}

/** A time's x in px of a box width px wide (decision 2): the timeline's x(), the gap rule, clamped to the plot, and scaled
 *  as the timeline's svg is below 300px. t: a finite time in ms. */
export function spanX(tl: TimelineModel, width: number, t: number): number {
  const x = Math.min(Math.max(gapX(tl, t), tl.m.l), tl.m.l + tl.iw);
  return x * width / tl.W;
}

const time = (ts: string | null | undefined): number | null => {
  const t = ts ? Date.parse(ts) : NaN;
  return isNaN(t) ? null : t;
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** tl: timelineModel(s, width, ts) for the same width; calls: the payload's; ts: the text scale. Null with no timeline. */
export function spansLayout(tl: TimelineModel | null, calls: readonly SpanCall[], width: number, ts: number): SpansLayout | null {
  if (!tl) return null;
  const k = width / tl.W;
  // The axis's px per ms where no gap ends: every gap is over 20 minutes, so none ends in the first minute.
  const perMs = (tl.x(tl.start + 60e3) - tl.x(tl.start)) / 60e3;

  // The span of each call the timeline places (by start_ts, else end_ts), its lane and row still to come.
  interface Placed { span: Span; at: number; until: number; group: string }
  const placed: Placed[] = [];
  for (const c of calls) {
    const at = time(c.start_ts || c.end_ts);
    if (at == null) continue;
    const start = c.start_ts ? at : null, end = time(c.end_ts);
    const sub = !c.subagent ? 0 : Number.isInteger(c.lane) && c.lane! >= 1 ? c.lane : null;
    const timed = start != null && end != null && end > start;
    const kind: SpanKind = !timed ? (start != null && end == null ? "open" : "still") : c.is_error ? "failed" : "ok";
    const xs = spanX(tl, width, at), xe = timed ? spanX(tl, width, end!) : xs;
    placed.push({
      at, until: timed ? end! : at, group: sub === 0 ? "main" : sub == null ? "apart" : `sub-${sub}`,
      span: {
        id: c.id, tool: c.tool ?? "Unknown tool", known: c.tool != null, input: c.input ?? "", lane: 0, row: 0, sub,
        x0: xs - .5, x1: Math.max(xe, xs) + .5, kind,
        clipped: timed && end! > tl.end,
        squeezed: timed && (end! - start!) * perMs - (gapX(tl, end!) - tl.x(start!)) > 1e-6,
        start, end, ms: timed ? end! - start! : null,
      },
    });
  }

  // Lanes: the first SUB_LANES subagents by rank, the rest folded into one.
  const ranks = [...new Set(placed.map(p => p.span.sub).filter((r): r is number => r != null && r > 0))].sort((a, b) => a - b);
  const folded = ranks.slice(SUB_LANES);
  const groups: { key: LaneKey; name: string; cap: number }[] = [
    { key: "main", name: "Main thread", cap: MAIN_ROWS },
    ...ranks.slice(0, SUB_LANES).map(r => ({ key: `sub-${r}` as LaneKey, name: `Subagent ${r}`, cap: LANE_ROWS })),
    ...(folded.length ? [{ key: "other" as LaneKey, name: `Other subagents (${folded.length})`, cap: LANE_ROWS }] : []),
    { key: "apart", name: "Subagents, not told apart", cap: LANE_ROWS },
  ];
  for (const p of placed) if (folded.includes(p.span.sub!)) p.group = "other";

  const lanes: Lane[] = [], over: { lane: number; n: number }[] = [];
  let y = PAD;
  for (const g of groups) {
    const mine = placed.filter(p => p.group === g.key).sort((a, b) => a.at - b.at || cmp(a.span.id, b.span.id));
    // The main thread is drawn while any lane has a call; any other lane only with a call of its own.
    if (!mine.length && (g.key !== "main" || !placed.length)) continue;
    const li = lanes.length;
    // Greedy by start, in time: a call takes the first row whose last call ended at or before its start.
    const ends: number[] = [];
    let n = 0;
    for (const p of mine) {
      let r = ends.findIndex(e => e <= p.at);
      if (r < 0 && ends.length < g.cap) r = ends.push(p.until) - 1;
      else if (r < 0) { r = g.cap - 1; n++; }
      ends[r] = Math.max(ends[r]!, p.until);
      p.span.lane = li; p.span.row = r;
    }
    if (n) over.push({ lane: li, n });
    const rows = Math.max(1, ends.length);
    lanes.push({ key: g.key, name: g.name, rows, top: y + LABEL * ts, ids: mine.map(p => p.span.id) });
    y += LABEL * ts + rows * ROW + LANE_GAP;
  }

  const spans = placed.map(p => p.span);
  return {
    lanes, spans, bottom: y, height: Math.ceil(y + AXIS * ts),
    left: tl.m.l * k, right: (tl.m.l + tl.iw) * k,
    breaks: tl.gaps.map(g => g.bx * k),
    notes: {
      still: spans.filter(s => s.kind === "still").length,
      clipped: spans.filter(s => s.clipped).length,
      squeezed: spans.filter(s => s.squeezed).length,
      over, folded,
    },
  };
}
