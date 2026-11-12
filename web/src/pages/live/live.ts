// Live page logic with no React: merging a catch-up into the session held, the state as shown now, and the stream's
// layout of main-thread events and subagent lanes.
import type { LiveEvent, LiveListSession, LiveSession, LiveState, LiveToolEvent, Ts } from "../../api";

/** Events kept in memory per session; older ones drop off the top. */
export const KEEP = 2000;
/** A shell call pending this long reads as likely waiting for approval (as live.py's APPROVAL). */
const APPROVAL_MS = 30_000;
const APPROVAL_TOOLS = new Set(["Bash", "exec_command", "exec"]); // the shell tools
/** Whether a call pending for `pending` ms reads as likely waiting for approval, as live.py's state says it: a shell
 *  call past 30 s, unless it is a long one (its timeout is above 120 s). */
export const likelyWaiting = (tool: string | null, long: boolean, pending: number | null): boolean =>
  !!tool && APPROVAL_TOOLS.has(tool) && !long && pending != null && pending > APPROVAL_MS;

/** The session after a response: a full load replaces it; a catch-up (after=cursor) adds new events and replaces ones
 *  sent again (a call that finished, the last minute read again), keeping their place. Everything else comes from the
 *  newer response. */
export function mergeSession(prev: LiveSession | undefined, next: LiveSession, catchUp: boolean): LiveSession {
  if (!catchUp || !prev || prev.session_id !== next.session_id) return next;
  const at = new Map(prev.events.map((e, i) => [e.key, i]));
  const events = prev.events.slice();
  for (const e of next.events) {
    const i = at.get(e.key);
    if (i === undefined) { at.set(e.key, events.length); events.push(e); } else events[i] = e;
  }
  const cut = Math.max(0, events.length - KEEP);
  return { ...next, events: events.slice(cut), truncated: prev.truncated || cut > 0, cursor: next.cursor ?? prev.cursor };
}

const ms = (ts: string | null | undefined) => (ts ? Date.parse(ts) : NaN);
/** Milliseconds from ts to now, or null. */
export const since = (ts: string | null | undefined, now: number): number | null => (Number.isNaN(ms(ts)) ? null : Math.max(0, now - ms(ts)));

/** The state as of now: a shell call that passes 30 s between fetches turns into likely waiting for approval here. */
export function stateNow(st: LiveState, now: number): LiveState {
  return st.kind === "tool" && likelyWaiting(st.tool, st.long, since(st.since, now)) ? { ...st, kind: "wait", inferred: true } : st;
}

export const STATE_LABEL: Record<LiveState["kind"], string> = {
  tool: "running", wait: "approval?", thinking: "thinking", you: "your turn", idle: "idle", ended: "ended",
};

/** The groups of the rail and the wall, in the order of who needs the user first. Working is running a tool or thinking. */
export type LiveGroup = "wait" | "you" | "working" | "idle" | "ended";
const GROUPS: LiveGroup[] = ["wait", "you", "working", "idle", "ended"];
const groupOf = (kind: LiveState["kind"]): LiveGroup => (kind === "tool" || kind === "thinking" ? "working" : kind);
/** The states the tab title counts: the session waits for the user. */
export const needsYou = (kind: LiveState["kind"]) => kind === "wait" || kind === "you";

/** The sessions by state group, for the rail and the wall, without the empty groups. Inside a group the oldest start
 *  comes first, then the session id, so an entry moves only when its state changes group, never on a write. */
export function groupSessions<T extends Pick<LiveListSession, "session_id" | "first_ts" | "state">>(sessions: readonly T[], now: number):
  { id: LiveGroup; label: string; sessions: T[] }[] {
  const by = new Map<LiveGroup, T[]>();
  for (const s of sessions) {
    const g = groupOf(stateNow(s.state, now).kind);
    (by.get(g) ?? by.set(g, []).get(g)!).push(s);
  }
  const start = (s: T) => (Number.isNaN(ms(s.first_ts)) ? Infinity : ms(s.first_ts));
  return GROUPS.filter(g => by.has(g)).map(g => ({ id: g, label: g === "working" ? "working" : STATE_LABEL[g],
    sessions: by.get(g)!.sort((a, b) => start(a) - start(b) || (a.session_id < b.session_id ? -1 : 1)) }));
}

/** Milliseconds as the stream shows durations: 0.4s, 12s, 3m 05s, 2h 10m. */
export function elapsed(msec: number | null): string {
  if (msec == null) return "–";
  if (msec < 10_000) return (msec / 1000).toFixed(1) + "s";
  const s = Math.round(msec / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;
}

/** What one state says in words, for the rail, the wall and the panel. Your turn, thinking and idle say for how long. */
export function stateText(st: LiveState, now: number): { label: string; detail: string } {
  const el = elapsed(since(st.since, now)), timed = (label: string) => (el === "–" ? label : `${label} ${el}`);
  switch (st.kind) {
    case "tool": return { label: `${st.tool} ${el}`, detail: `${st.tool} running for ${el}` };
    case "wait": return { label: STATE_LABEL.wait, detail: `${st.tool} pending ${el}: likely waiting for your approval` };
    case "thinking": return { label: timed(STATE_LABEL.thinking), detail: st.inferred ? "a request is likely in flight" : "the turn is in progress" };
    case "you": return { label: timed(STATE_LABEL.you), detail: "turn ended, waiting for a prompt" };
    case "ended": return { label: STATE_LABEL.ended, detail: "session closed" };
    default: return { label: timed(STATE_LABEL.idle), detail: "no new lines for 5 minutes" };
  }
}

export const INFERRED_WHY: Partial<Record<LiveState["kind"], string>> = {
  wait: "Inferred: transcripts record no permission prompt; a shell call this slow is often waiting on one.",
  thinking: "Inferred: Claude Code records no request in flight; the last line is a prompt or a tool result.",
};

export const isTool = (e: LiveEvent): e is LiveToolEvent => e.k === "tool";
/** The label the agent gave a shell call, which is its row text in place of the command; null for any other call. */
export const labelOf = (e: LiveToolEvent): string | null => (APPROVAL_TOOLS.has(e.tool) && e.description) || null;

/** The stream's filters: failed calls only, no lane, no call that only reads unless it failed. They change what the
 *  stream draws, not what the page holds. */
export interface StreamFilters { errors: boolean; main: boolean; quiet: boolean }
export const NO_FILTERS: StreamFilters = { errors: false, main: false, quiet: false };
/** Whether the stream draws event e as a row: a main-thread prompt, reply, call, compaction or interruption, or a
 *  lane's call. */
export const isRow = (e: LiveEvent): boolean => (e.lane ? isTool(e) : e.k !== "turn_start" && e.k !== "turn_end");
/** Whether the filters leave row e in. With errors on, only failed calls stay: no prompt, reply or mark. A failed call
 *  is never left out as one that only reads. */
export const passes = (e: LiveEvent, f: StreamFilters): boolean =>
  !(f.main && e.lane) && (isTool(e) ? e.failed || !f.errors && !(f.quiet && e.quiet) : !f.errors);

/** The user's choices per lane, kept while the page is open: folded or not (none: a finished lane is folded), and
 *  every row of a running lane instead of its last few. */
export interface LaneChoices { folds: ReadonlyMap<string, boolean>; whole: ReadonlySet<string> }

/** A subagent's work: when its events start and end, its tool calls and how many failed, and the main-thread call that
 *  started it. */
export interface LiveLane {
  id: string; start: Ts | null; end: Ts | null; tools: number; errors: number;
  /** A call of its has no result, or, with no parent, its turn goes on. */
  running: boolean;
  /** The main-thread call that started it, when known; name is that call's tool. */
  parent: string | null; name: string; description: string | null;
  /** Finished: its parent call has ended. No call names a Codex lane: it is done when its last turn mark is a turn_end. */
  done: boolean;
}

/** The lanes of the events held, in order of their first event. Built from every event held, not from one response,
 *  so a catch-up with one lane's events leaves the other lanes whole. */
export function lanesOf(events: readonly LiveEvent[]): LiveLane[] {
  const parents = new Map<string, LiveToolEvent>(), out = new Map<string, LiveLane>(), turns = new Map<LiveLane, boolean>();
  for (const e of events) if (isTool(e) && e.agent && !e.lane) parents.set(e.agent, e);
  for (const e of events) {
    if (!e.lane) continue;
    let l = out.get(e.lane);
    if (!l) {
      const p = parents.get(e.lane);
      l = { id: e.lane, start: e.ts, end: e.ts, tools: 0, errors: 0, running: false, parent: p?.id ?? null, name: p?.tool ?? "Subagent",
        description: p?.description ?? null, done: !!p?.end };
      out.set(e.lane, l);
    }
    if (e.ts && !(ms(l.end) >= ms(e.ts))) l.end = e.ts;
    if (isTool(e)) { l.tools++; l.errors += +e.failed; l.running ||= e.end == null; }
    else if (!l.parent && (e.k === "turn_start" || e.k === "turn_end")) turns.set(l, e.k === "turn_start");
  }
  for (const [l, open] of turns) { l.done = !open; l.running ||= open; }
  return [...out.values()];
}

/** A row of the stream: a main-thread event, or a subagent lane with its events. */
export type StreamRow = { kind: "event"; e: LiveEvent } | { kind: "lane"; lane: LiveLane; events: LiveEvent[] };

/** The stream's rows: main-thread events in order. A lane follows the call that started it, or, untied, stands where
 *  its first event falls. */
export function streamRows(events: readonly LiveEvent[]): StreamRow[] {
  const lanes = lanesOf(events), byLane = new Map<string, LiveEvent[]>(), laneOf = new Map(lanes.map(l => [l.id, l]));
  for (const e of events) if (e.lane) (byLane.get(e.lane) ?? byLane.set(e.lane, []).get(e.lane)!).push(e);
  const tied = new Map(lanes.filter(l => l.parent).map(l => [l.parent!, l]));
  const rows: StreamRow[] = [], placed = new Set<string>();
  const lane = (l: LiveLane) => { if (!placed.has(l.id)) { placed.add(l.id); rows.push({ kind: "lane", lane: l, events: byLane.get(l.id)! }); } };
  for (const e of events) {
    if (e.lane) {
      const l = laneOf.get(e.lane)!;
      if (!l.parent) lane(l);
      continue;
    }
    rows.push({ kind: "event", e });
    if (e.k === "tool" && tied.has(e.id)) lane(tied.get(e.id)!);
  }
  for (const l of lanes) lane(l); // a tied lane whose parent call fell off the top
  return rows;
}
