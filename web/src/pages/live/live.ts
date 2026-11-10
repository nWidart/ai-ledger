// Live page logic with no React: merging a catch-up into the session held, the state as shown now, and the stream's
// layout of main-thread events and subagent lanes.
import type { LiveEvent, LiveLane, LiveSession, LiveState, LiveToolEvent } from "../../api";

/** Events kept in memory per session; older ones drop off the top. */
export const KEEP = 2000;
/** A shell call pending this long reads as likely waiting for approval (as live.py's APPROVAL). */
export const APPROVAL_MS = 30_000;
const APPROVAL_TOOLS = new Set(["Bash", "exec_command", "exec"]);

/** The session after a response: a full load replaces it; a catch-up (after=cursor) adds new events and replaces ones
 *  sent again (a call that finished), keeping their place. Everything else comes from the newer response. */
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
  const el = since(st.since, now);
  if (st.kind === "tool" && st.tool && APPROVAL_TOOLS.has(st.tool) && el != null && el > APPROVAL_MS) return { ...st, kind: "wait", inferred: true };
  return st;
}

export const STATE_LABEL: Record<LiveState["kind"], string> = {
  tool: "running", wait: "approval?", thinking: "thinking", you: "your turn", idle: "idle",
};

/** Milliseconds as the stream shows durations: 0.4s, 12s, 3m 05s, 2h 10m. */
export function elapsed(msec: number | null): string {
  if (msec == null) return "–";
  if (msec < 10_000) return (msec / 1000).toFixed(1) + "s";
  const s = Math.round(msec / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;
}

/** What one state says in words, for the rail and the panel. */
export function stateText(st: LiveState, now: number): { label: string; detail: string } {
  const el = elapsed(since(st.since, now));
  switch (st.kind) {
    case "tool": return { label: `${st.tool} ${el}`, detail: `${st.tool} running for ${el}` };
    case "wait": return { label: STATE_LABEL.wait, detail: `${st.tool} pending ${el}: likely waiting for your approval` };
    case "thinking": return { label: STATE_LABEL.thinking, detail: st.inferred ? "a request is likely in flight" : "the turn is in progress" };
    case "you": return { label: STATE_LABEL.you, detail: "turn ended, waiting for a prompt" };
    default: return { label: el === "–" ? "idle" : `idle ${elapsed(since(st.since, now))}`, detail: "no new lines for 5 minutes" };
  }
}

export const INFERRED_WHY: Partial<Record<LiveState["kind"], string>> = {
  wait: "Inferred: transcripts record no permission prompt; a shell call this slow is often waiting on one.",
  thinking: "Inferred: Claude Code records no request in flight; the last line is a prompt or a tool result.",
};

/** A row of the stream: a main-thread event, or a subagent lane with its events. */
export type StreamRow = { kind: "event"; e: LiveEvent } | { kind: "lane"; lane: LiveLane; events: LiveEvent[] };

/** The stream's rows: main-thread events in order. A lane follows the call that started it, or, untied, stands where
 *  its first event falls. Request rows carry no news in the stream and are left out. */
export function streamRows(events: readonly LiveEvent[], lanes: readonly LiveLane[]): StreamRow[] {
  const byLane = new Map<string, LiveEvent[]>(), laneOf = new Map(lanes.map(l => [l.id, l]));
  for (const e of events) if (e.lane) (byLane.get(e.lane) ?? byLane.set(e.lane, []).get(e.lane)!).push(e);
  const tied = new Map(lanes.filter(l => l.parent).map(l => [l.parent!, l]));
  const rows: StreamRow[] = [], placed = new Set<string>();
  const lane = (l: LiveLane) => { if (!placed.has(l.id)) { placed.add(l.id); rows.push({ kind: "lane", lane: l, events: byLane.get(l.id) ?? [] }); } };
  for (const e of events) {
    if (e.lane) {
      const l = laneOf.get(e.lane);
      if (l && !l.parent) lane(l);
      continue;
    }
    if (e.k === "request") continue;
    rows.push({ kind: "event", e });
    if (e.k === "tool" && tied.has(e.id)) lane(tied.get(e.id)!);
  }
  for (const l of lanes) if (byLane.has(l.id)) lane(l); // a tied lane whose parent call fell off the top
  return rows;
}

export const isTool = (e: LiveEvent): e is LiveToolEvent => e.k === "tool";
