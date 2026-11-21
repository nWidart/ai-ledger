import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent, LivePayload, LiveSession, LiveState, LiveToolEvent } from "../../api";
import live from "../../__fixtures__/live";
import liveListText from "../../__fixtures__/live-text";
import liveSession from "../../__fixtures__/live-session";
import liveText from "../../__fixtures__/live-session-text";
import liveCodex from "../../__fixtures__/live-session-codex";
import { mockApi } from "../../components/sheets/testing";
import { LivePage } from "./LivePage";
import { groupSessions, lanesOf, likelyWaiting, mergeSession, pulseMinutes, pulseSummary, stateNow, stateText, streamRows } from "./live";
import { pct, usd } from "../../format";
import { FakeSource } from "./testing";
import { queries } from "../../queries";
import { renderPage, renderRouter } from "../../testing";

const list = live as LivePayload, listText = liveListText as LivePayload, s1 = liveSession as LiveSession, s1text = liveText as LiveSession, codex = liveCodex as LiveSession;

const status = { ingesting: false, last_ingest: "2026-11-10T10:00:00+00:00", last_change: "2026-11-10T10:00:00+00:00", last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
type Opts = { list?: LivePayload; session?: (q: URLSearchParams) => LiveSession | undefined; status?: () => unknown; app?: boolean };

/** The page alone, or inside the app (o.app) for what the nav and the tab title show. calls leaves the status polls out;
 *  polls counts them. */
function show(hash = "?session=s1", o: Opts = {}) {
  const f = mockApi({
    "/api/live": q => o.list ?? (q.get("text") ? listText : list),
    "/api/live/session": q => (o.session ? o.session(q) : q.get("id") === "s1" ? (q.get("text") ? s1text : s1) : { ...s1, session_id: q.get("id")!, project: "jobdesk" }),
    "/api/status": () => (o.status ? o.status() : status),
  });
  history.replaceState(null, "", "/live" + hash);
  const r = (o.app ? renderRouter() : renderPage(<LivePage />));
  const urls = () => f.mock.calls.map(c => String(c[0]));
  return { f, r, calls: () => urls().filter(u => u !== "/api/status"), polls: () => urls().filter(u => u === "/api/status").length };
}
/** The Session region once its session has loaded: the region itself shows from the first render, with "Loading…" in it, so
 *  a query made on its heels would race the fetch. */
const stream = async () => {
  const region = await screen.findByRole("region", { name: "Session" });
  await within(region).findByLabelText("Session events");
  return region;
};
const rail = () => screen.findByRole("region", { name: "Active sessions" });
const wall = rail; // the wall takes the rail's place, under the same name
/** The rail or the wall as text: each group's heading, then its sessions' projects. */
const groups = (el: HTMLElement) => [...el.querySelectorAll(".group > h2, .group > h3")].map(h =>
  [h.textContent, ...[...h.nextElementSibling!.querySelectorAll("button")].map(b => b.querySelector(".pname")!.textContent)].join(" "));
/** A list session of the given state that started at `first`. */
const sess = (id: string, kind: LiveState["kind"], first: string, since = first) => ({ ...list.sessions[0]!, session_id: id, project: id, title: null,
  first_ts: first, last_ts: since, state: { kind, tool: kind === "tool" || kind === "wait" ? "Bash" : null, since, inferred: kind === "wait", long: kind === "tool" } });
/** setTimeout too: Query tells React of a change on one. */
const fakeClock = (at: string) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(Date.parse(at));
};
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const ended = list.sessions.find(s => s.state.kind === "ended")!;
const toolRow = (name: string, nth = 0) => screen.getAllByRole("button", { name: new RegExp("^" + name) })[nth]!;
const agentCall = s1.events.find(e => e.k === "tool" && e.id === "t2") as LiveToolEvent, grep = s1.events.find(e => e.lane === "a7") as LiveToolEvent;
/** A call of lane a7, n seconds after 10:00:04, taking a second. */
const laneCall = (n: number, failed = false): LiveToolEvent => {
  const ts = (sec: number) => new Date(Date.parse("2026-11-10T10:00:04.000Z") + sec * 1000).toISOString();
  return { ...grep, key: `g${n}#0`, id: `g${n}`, summary: `g${n}`, ts: ts(n), start: ts(n), end: ts(n + 1), failed };
};
/** s1 with n calls in its lane (g1 to gn), `failed` of them failed; the lane runs unless done. */
const laned = (n: number, o: { done?: boolean; failed?: number } = {}): LiveSession => ({ ...s1, events: s1.events.flatMap(e => (e.lane ? []
  : e === agentCall ? [{ ...agentCall, end: o.done ? "2026-11-10T10:00:11.000Z" : null }, ...Array.from({ length: n }, (_, i) => laneCall(i + 1, i < (o.failed ?? 0)))] : [e])) });
/** Codex ties no lane to a call: a thread's own turn marks tell whether it is done. A mark and a call of thread th2, n
 *  seconds after 10:00:30, and the Codex session with them. */
const at30 = (n: number) => new Date(Date.parse("2026-11-10T10:00:30.000Z") + n * 1000).toISOString();
const turn = (k: "turn_start" | "turn_end", n: number): LiveEvent => ({ key: `m${n}#0`, k, ts: at30(n), lane: "th2", ...(k === "turn_start" ? { window: null } : {}) } as LiveEvent);
const threadCall = (n: number): LiveToolEvent => ({ ...(codex.events.find(e => e.k === "tool") as LiveToolEvent), key: `c${n}#0`, id: `c${n}`, lane: "th2", summary: `c${n}`,
  ts: at30(n), start: at30(n), end: at30(n + 1) });
const threadCalls = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => threadCall(from + i));
const threaded = (...lane: LiveEvent[]): LiveSession => ({ ...codex, events: [...codex.events, ...lane] });
const threadHead = () => screen.getByRole("button", { name: /^Subagent/ });
const threadRows = () => screen.queryAllByRole("button", { name: /^exec_commandc/ }).map(b => b.querySelector(".sum")!.textContent);
/** The lane's header, and the input texts of the Grep rows drawn. */
const laneHead = (name = /^Agent find callers of ingest/) => screen.getByRole("button", { name });
const greps = () => screen.queryAllByRole("button", { name: /^Grep/ }).map(b => b.querySelector(".sum")!.textContent);
/** The stream's filter bar, the tools of the rows drawn, and what the bar says is hidden. */
const bar = () => screen.getByRole("group", { name: "Stream filters" });
/** The status strip above the stream: the state, the context, the figures, the limits and the pulse. */
const strip = () => screen.getByRole("group", { name: "Session status" });
/** The connection line ("Paused", "Connection lost · reconnecting…"): the stream has a status of its own for new events. */
const conn = () => document.querySelector<HTMLElement>("p.conn")!;
const drawn = () => [...screen.getByLabelText("Session events").querySelectorAll(".tool .nm")].map(n => n.textContent);
const hidden = () => bar().querySelector(".hid")?.textContent ?? null;
const check = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
/** The rail's entry of a project, the project in the stream's head, a wait long enough for any request to go out, and
 *  the request that catches s1 up from the fixture's cursor. */
const entry = async (project: string) => within(await rail()).getAllByRole("button").find(b => b.querySelector(".pname")!.textContent === project)!;
const headed = () => screen.getByRole("region", { name: "Session" }).querySelector(".stream-head .pname")?.textContent;
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 20)); });
const catchUp = `/api/live/session?id=s1&after=${encodeURIComponent(s1.cursor!)}`;
/** From this call on, the list and the session answer only when the test says so (answer(), or answer(n) for the n
 *  asked first), each with what the app held when it was asked. sent: the requests since, as URL and abort signal;
 *  waiting: how many are unanswered. */
const lateAnswers = (f: ReturnType<typeof show>["f"]) => {
  const normal = f.getMockImplementation()!, late: (() => void)[] = [], sent: { url: string; signal: AbortSignal }[] = [];
  f.mockImplementation(((input: string, init: RequestInit) => {
    const res = normal(input);
    if (input === "/api/status") return res;
    sent.push({ url: input, signal: init.signal! });
    return new Promise<Response>(r => { late.push(() => r(res)); });
  }) as typeof normal);
  return { sent, urls: () => sent.map(x => x.url), waiting: () => late.length, answer: async (n = late.length) => { late.splice(0, n).forEach(a => a()); await settle(); } };
};

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); Reflect.deleteProperty(document, "hidden"); Reflect.deleteProperty(document, "visibilityState"); });
/** The tab goes to the background (or comes back): document.hidden and visibilityState as the browser says them, and its
 *  event, which bubbles to the window, where Query listens for its own refetch on focus. */
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  act(() => { document.dispatchEvent(new Event("visibilitychange", { bubbles: true })); });
};

describe("live.ts", () => {
  it("merges a catch-up: new events appended, a finished call replaced in place", () => {
    const pending = s1.events.find(e => e.k === "tool" && e.end == null) as LiveToolEvent;
    const done = { ...pending, end: "2026-11-10T10:00:40.000Z" };
    const extra = { ...pending, key: "z#0", id: "t9" };
    const got = mergeSession(s1, { ...s1, events: [done, extra], cursor: "c2" }, true);
    expect(got.events.length).toBe(s1.events.length + 1);
    expect((got.events.find(e => e.key === pending.key) as LiveToolEvent).end).toBe(done.end);
    expect(got.events.at(-1)!.key).toBe("z#0");
    expect(mergeSession(s1, { ...s1, events: [extra] }, false).events).toEqual([extra]);
  });

  it("places a tied lane after its call", () => {
    const rows = streamRows(s1.events);
    const at = rows.findIndex(r => r.kind === "event" && r.e.k === "tool" && r.e.id === "t2");
    expect(rows[at + 1]).toMatchObject({ kind: "lane", lane: { id: "a7", name: "Agent", description: "find callers of ingest", tools: 3, done: true } });
  });

  it("keeps every lane whole after a catch-up that brings events of the main thread only", () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    const got = mergeSession(s1, { ...s1, events: [{ ...main, key: "z#0", id: "t9" }], cursor: "c2" }, true);
    expect(lanesOf(got.events)).toEqual(lanesOf(s1.events));
    expect(lanesOf(got.events)[0]!.tools).toBe(3);
  });

  it("ties a lane to its call once the call names it, and marks it running until the call ends", () => {
    const call = s1.events.find(e => e.k === "tool" && e.id === "t2") as LiveToolEvent;
    const running = s1.events.map(e => (e === call ? { ...call, end: null } : e));
    expect(lanesOf(running)[0]).toMatchObject({ parent: "t2", name: "Agent", done: false });
    expect(lanesOf(running.map(e => (e.k === "tool" && e.id === "t2" ? { ...e, agent: null } : e)))[0]).toMatchObject({ parent: null, name: "Subagent" });
  });

  it("tells a lane with turn marks done by its last one, and a lane with none by its call", () => {
    const lane = (...events: LiveEvent[]) => lanesOf(events)[0];
    expect(lane(turn("turn_start", 0), threadCall(1), turn("turn_end", 3))).toMatchObject({ parent: null, done: true, running: false, end: at30(3) });
    expect(lane(turn("turn_start", 0), threadCall(1), turn("turn_end", 3), turn("turn_start", 9))).toMatchObject({ done: false, running: true });
    expect(lane(threadCall(1))).toMatchObject({ done: false, running: false }); // no mark held: not known
    // A Codex spawn call returns at once: its thread's turn marks tell, not the call's end.
    const spawned = (...marks: LiveEvent[]) => lanesOf([...s1.events, ...marks.map(m => ({ ...m, lane: "a7" }))])[0];
    expect(spawned(turn("turn_start", 9))).toMatchObject({ parent: "t2", done: false, running: true });
    expect(spawned(turn("turn_start", 9), turn("turn_end", 12))).toMatchObject({ parent: "t2", done: true, running: false });
  });

  it("reads a shell call pending past 30 s as a likely approval wait, unless it is a long one", () => {
    const st: LiveState = { kind: "tool", tool: "Bash", since: "2026-11-10T10:00:00.000Z", inferred: false, long: false };
    const after = (seconds: number) => Date.parse(st.since!) + seconds * 1000;
    expect(stateNow(st, after(30)).kind).toBe("tool");
    expect(stateNow(st, after(31))).toMatchObject({ kind: "wait", inferred: true });
    expect(stateNow({ ...st, long: true }, after(600))).toMatchObject({ kind: "tool", inferred: false });
    expect(stateNow({ ...st, tool: "WebFetch" }, after(600)).kind).toBe("tool");
    expect([likelyWaiting("exec", false, 31_000), likelyWaiting("exec", true, 31_000), likelyWaiting("exec", false, null)]).toEqual([true, false, false]);
  });

  it("words an ended session apart from your turn and idle", () => {
    const texts = (["ended", "you", "idle"] as const).map(kind => stateText({ ...ended.state, kind }, Date.parse(list.now)));
    expect(texts.map(t => t.label)).toEqual(["ended", "your turn 25s", "idle 25s"]);
    expect(texts.map(t => t.detail)).toEqual(["session closed", "waiting for your prompt", "no new lines for 5 minutes"]); // only one says it ended
    expect(stateNow(ended.state, Date.parse(list.now) + 3_600_000)).toBe(ended.state);
  });

  it("groups by state in the order of need, oldest start first, then by id", () => {
    const at = "2026-11-10T09:00:00.000Z", now = Date.parse(list.now);
    const got = groupSessions([sess("e", "ended", at), sess("i", "idle", at), sess("t", "thinking", "2026-11-10T09:30:00.000Z"), sess("r", "tool", at),
      sess("b", "you", at), sess("a", "you", at), sess("w", "wait", at), sess("n", "thinking", null as unknown as string)], now);
    expect(got.map(g => `${g.label}: ${g.sessions.map(s => s.session_id).join(" ")}`)).toEqual(
      ["approval?: w", "your turn: a b", "working: r t n", "idle: i", "ended: e"]);
    expect(groupSessions([sess("r", "tool", at)], now).map(g => g.label)).toEqual(["working"]); // an empty group is not drawn
    // A plain shell call past 30 s joins approval? when the page notices, before the next fetch.
    const slow = { ...sess("s", "tool", at), state: { ...sess("s", "tool", at).state, long: false } };
    expect(groupSessions([slow], now)[0]!.label).toBe("approval?");
  });
});

describe("LivePage", () => {
  it("names the automated projects file on the automated toggle", async () => {
    const { r } = show("");
    await rail();
    act(() => { r.client.setQueryData(queries.status.queryKey, { ...status, automated_file: list.automated_file }); });
    expect(list.automated_file.path).toMatch(/automated\.json$/);
    await userEvent.click(screen.getByRole("button", { name: "About automated sessions" }));
    expect(within(screen.getByRole("group", { name: "Filters" })).getByRole("tooltip").textContent).toContain(list.automated_file.path);
  });

  it("lists the active sessions and opens the newest when the URL names none", async () => {
    const { calls } = show("");
    expect(groups(await rail())).toEqual(["approval? · 1 foo", "your turn · 1 sketchbook", "working · 2 graft jobdesk", "idle · 1 dotfiles", "ended · 1 notes"]);
    await waitFor(() => expect(calls()).toContain("/api/live/session?id=s2")); // the one that wrote last, wherever its group puts it
    expect(screen.getByRole("button", { current: true }).querySelector(".pname")!.textContent).toBe("jobdesk");
  });

  it("keeps the rail's order through a write, a state change and a new session", async () => {
    const a = sess("a", "tool", "2026-11-10T09:00:00.000Z"), b = sess("b", "tool", "2026-11-10T09:30:00.000Z"), c = sess("c", "tool", "2026-11-10T09:45:00.000Z");
    const o = { list: { ...list, sessions: [b, a] } }; // b wrote last
    show("?session=a", o);
    const el = await rail(), after = async (sessions: typeof o.list.sessions, want: string[]) => {
      o.list = { ...list, sessions };
      FakeSource.last!.notify(null);
      await waitFor(() => expect(groups(el)).toEqual(want));
    };
    await waitFor(() => expect(groups(el)).toEqual(["working · 2 a b"]));
    await after([a, b], ["working · 2 a b"]); // a wrote: no entry moves
    await after([c, a, b], ["working · 3 a b c"]); // a new session joins the end of its group
    await after([{ ...b, state: sess("b", "you", b.first_ts).state }, c, a], ["your turn · 1 b", "working · 2 a c"]); // only b moves
  });

  it.each([["the rail", "?session=a"], ["the wall", "?view=wall"]])("marks each session button as a session subject, in %s", async (_where, hash) => {
    show(hash);
    const el = await (hash === "?view=wall" ? wall() : rail());
    await waitFor(() => expect(el.querySelector("button[data-session]")).toBeTruthy());
    const buttons = [...el.querySelectorAll("button[data-session]")];
    for (const b of buttons) expect(b.getAttribute("data-subject")).toBe(`session:${b.getAttribute("data-session")}`);
  });

  it.each([["the rail", "?session=a"], ["the wall", "?view=wall"]])("keeps the keyboard focus on a session that changes group, in %s", async (_where, hash) => {
    const a = sess("a", "tool", "2026-11-10T09:00:00.000Z"), b = sess("b", "tool", "2026-11-10T09:30:00.000Z"), turn = sess("b", "you", b.first_ts);
    const o = { list: { ...list, sessions: [a, b] } };
    show(hash, o);
    const el = await (hash === "?view=wall" ? wall() : rail());
    const of = (project: string) => within(el).getAllByRole("button").find(x => x.querySelector(".pname")!.textContent === project)!;
    const after = async (sessions: typeof o.list.sessions, want: string[]) => {
      o.list = { ...list, sessions };
      FakeSource.last!.notify(null);
      await waitFor(() => expect(groups(el)).toEqual(want));
    };
    await waitFor(() => expect(groups(el)).toEqual(["working · 2 a b"]));
    const was = of("b");
    act(() => was.focus());
    await after([a, turn], ["your turn · 1 b", "working · 1 a"]);
    expect([of("b") === was, document.activeElement === of("b")]).toEqual([false, true]); // a new button, with the focus
    const pause = screen.getByRole("button", { name: "Pause" });
    act(() => pause.focus());
    await after([a, b], ["working · 2 a b"]); // the focus is elsewhere: it stays there
    expect(document.activeElement).toBe(pause);
    act(() => of("a").focus());
    await after([a, turn], ["your turn · 1 b", "working · 1 a"]); // another session moves
    expect(document.activeElement).toBe(of("a"));
  });

  it("shows how long a session has been on your turn or thinking, counting up with the clock", async () => {
    fakeClock("2026-11-10T10:04:00.000Z");
    const o = { list: { ...list, sessions: [sess("a", "you", "2026-11-10T09:00:00.000Z", "2026-11-10T10:00:00.000Z"), sess("b", "thinking", "2026-11-10T09:10:00.000Z", "2026-11-10T10:03:48.000Z")] } };
    show("?session=a", o);
    await tick(10);
    const states = () => [...screen.getByRole("region", { name: "Active sessions" }).querySelectorAll(".state")].map(s => s.textContent);
    expect(states()).toEqual(["your turn 4m 00s", "thinking 12s"]);
    await tick(1000);
    expect(states()).toEqual(["your turn 4m 01s", "thinking 13s"]);
    cleanup();
    show("?view=wall", o);
    await tick(10);
    expect(states()).toEqual(["your turn 4m 01s", "thinking 13s"]);
  });

  it("dates an event's time only when it is not from today, and widens the time column for it", async () => {
    show("?session=s1");
    const box = (await stream()).querySelector(".stream")!;
    const times = () => [...box.querySelectorAll(".ev .t")].map(t => t.textContent!).filter(Boolean);
    expect(box.classList.contains("dated")).toBe(true); // the fixture's events are from Nov 10, the clock is not
    expect(times().every(t => /^\D+ \d+, \d\d:\d\d:\d\d$/.test(t))).toBe(true);
    cleanup();
    fakeClock("2026-11-10T10:01:00.000Z");
    show("?session=s1");
    await tick(10);
    const same = screen.getByRole("region", { name: "Session" }).querySelector(".stream")!;
    expect(same.classList.contains("dated")).toBe(false);
    expect([...same.querySelectorAll(".ev .t")].every(t => /^\d\d:\d\d:\d\d$/.test(t.textContent!))).toBe(true);
  });

  it("groups the wall as the rail, and frames the tiles that need the user", async () => {
    const at = "2026-11-10T09:00:00.000Z";
    show("?view=wall", { list: { ...list, sessions: [sess("r2", "tool", "2026-11-10T09:30:00.000Z"), sess("w", "wait", at), sess("r1", "tool", at), sess("y", "you", at)] } });
    const el = await wall();
    await waitFor(() => expect(groups(el)).toEqual(["approval? · 1 w", "your turn · 1 y", "working · 2 r1 r2"]));
    expect(within(el).getAllByRole("list").map(l => l.getAttribute("aria-label"))).toEqual(["approval?", "your turn", "working"]);
    expect(within(el).getByRole("button", { name: "Pin y" }).className).toBe("panel tile st-you"); // .tile.st-you has the border
    expect(within(el).getByRole("button", { name: "Pin w" }).className).toBe("panel tile st-wait");
  });

  it("counts the sessions that need the user in the tab title, and gives the title back on leaving", async () => {
    const at = "2026-11-10T09:00:00.000Z", o = { app: true, list: { ...list, sessions: [sess("w", "wait", at), sess("y", "you", at), sess("r", "tool", at), sess("e", "ended", at)] } };
    show("?session=w", o);
    await waitFor(() => expect(document.title).toBe("(2) Live · AI Ledger"));
    o.list = { ...list, sessions: [sess("r", "tool", at), sess("i", "idle", at)] };
    FakeSource.last!.notify(null);
    await waitFor(() => expect(document.title).toBe("Live · AI Ledger"));
    o.list = { ...list, sessions: [sess("y", "you", at)] };
    FakeSource.last!.notify(null);
    await waitFor(() => expect(document.title).toBe("(1) Live · AI Ledger"));
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(document.title).toBe("Cost · AI Ledger");
  });

  it("counts a shell call passing 30 s in the tab title when the page notices", async () => {
    fakeClock("2026-11-10T10:00:20.000Z");
    const slow = sess("s", "tool", "2026-11-10T10:00:00.000Z");
    show("?session=s", { app: true, list: { ...list, sessions: [{ ...slow, state: { ...slow.state, long: false } }] } });
    await tick(10);
    expect(document.title).toBe("Live · AI Ledger");
    await tick(11_000);
    expect(document.title).toBe("(1) Live · AI Ledger");
  });

  it("names a titled session in the rail by its title, with the project on the second line", async () => {
    show("");
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    const entry = (project: string) => within(rail).getAllByRole("button").find(b => b.querySelector(".pname")!.textContent === project)!;
    const foo = entry("foo");
    expect(foo.querySelector(".ttl")!.textContent).toBe("Fast ingest pass while Live is open");
    expect(foo.querySelector(".ttl")!.getAttribute("title")).toBe("Fast ingest pass while Live is open");
    expect(foo.querySelector(".sub .pname")).toBeTruthy();
    expect(foo.querySelector(".sub code")).toBeNull(); // the branch is in the stream header
    const jobdesk = entry("jobdesk"); // a first-prompt title only: not sent without Full text
    expect(jobdesk.querySelector(".ttl")).toBeNull();
    expect(jobdesk.querySelector(".sub .pname")).toBeNull();
  });

  it("names two sessions of one project apart", async () => {
    const two = { ...list, sessions: [{ ...list.sessions[0]!, session_id: "a", project: "ai-ledger", title: "Add session titles", title_from: "agent" as const },
      { ...list.sessions[0]!, session_id: "b", project: "ai-ledger", title: "Fix Cost test", title_from: "agent" as const }] };
    show("?session=a", { list: two });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    const entries = await within(rail).findAllByRole("button");
    expect(entries.map(b => b.querySelector(".ttl")!.textContent)).toEqual(["Add session titles", "Fix Cost test"]);
    expect(entries.map(b => b.querySelector(".sub .pname")!.textContent)).toEqual(["ai-ledger", "ai-ledger"]);
  });

  it("shows a first-prompt title only with Full text, refetching the list with text", async () => {
    const { calls } = show("");
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(within(rail).queryByText("Freeze the clock in the snapshot test")).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Full text" }));
    await waitFor(() => expect(calls()).toContain("/api/live?text=1"));
    expect(await within(rail).findByText("Freeze the clock in the snapshot test")).toBeTruthy();
  });

  it("titles the stream with the session's title, and with the project without one", async () => {
    show();
    const main = await stream();
    expect(within(main).getByRole("heading", { level: 2 }).textContent).toBe("Fast ingest pass while Live is open");
    cleanup();
    show("?session=" + codex.session_id, { session: () => codex });
    const other = await stream();
    expect(await within(other).findByRole("button", { name: /^exec_command/ })).toBeTruthy();
    expect(codex.title).toBeFalsy();
    expect(within(other).getAllByRole("heading", { level: 2 }).map(h => h.textContent)).toEqual([codex.project]);
  });

  it("follows the URL's session, and still shows one that is no longer active", async () => {
    show("?session=gone", { list: { ...list, sessions: list.sessions.filter(s => s.session_id !== "s1") }, session: () => ({ ...s1, session_id: "gone", state: { kind: "idle", tool: null, since: s1.last_ts, inferred: false, long: false } }) });
    const main = await stream();
    expect(await within(main).findByText(/^idle/)).toBeTruthy();
  });

  it("says no session is active and links the newest one to its session sheet", async () => {
    show("", { list: { now: list.now, automated_file: list.automated_file, sessions: [], newest: { session_id: "s4", project: "dotfiles", last_ts: "2026-11-10T09:53:00.000Z" } } });
    const lede = await screen.findByText(/No session is active/);
    expect(screen.getByRole("heading", { level: 1 }).id).toBe("lede"); // the page heading stays the page's landing, not the note
    expect(lede.id).toBe("");
    const link = within(lede).getByRole("link", { name: "dotfiles" });
    expect(link.getAttribute("href")).toBe("/live?sheet=s4");
    await userEvent.click(link);
    expect(location.pathname + location.search).toBe("/live?sheet=s4");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("returns focus to the page heading when a sheet closes and nothing on the page opened it", async () => {
    show("?sheet=zz");
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Live" })));
  });

  it("shows tool rows with duration and result, a failed call, a compaction and the subagent lane", async () => {
    show();
    await stream();
    const read = await screen.findByRole("button", { name: /^Read/ });
    expect(read.textContent).toBe("Readstore.py1.0s✓");
    const failed = toolRow("Bash", 0);
    expect(failed.className).toContain("failed");
    expect(within(failed).getByRole("img", { name: "failed" })).toBeTruthy();
    expect(screen.getByText("context compacted at 180.0k tokens")).toBeTruthy();
    const lane = laneHead(); // finished: folded
    expect([greps(), lane.getAttribute("aria-expanded")]).toEqual([[], "false"]);
    await userEvent.click(lane);
    expect([greps(), lane.getAttribute("aria-expanded")]).toEqual([["store.ingest", "INTERVAL", "def loop"], "true"]);
    await userEvent.click(lane);
    expect(greps()).toEqual([]);
    expect(lane.textContent).toContain("3 tools");
  });

  it("shows the last 5 rows of a running lane, all of them on request, and the last 5 again", async () => {
    show("?session=s1", { session: () => laned(12) });
    await stream();
    const last5 = ["g8", "g9", "g10", "g11", "g12"], all = Array.from({ length: 12 }, (_, i) => `g${i + 1}`);
    expect([greps(), laneHead().getAttribute("aria-expanded")]).toEqual([last5, "true"]);
    expect(laneHead().textContent).toContain("12 tools");
    await userEvent.click(screen.getByRole("button", { name: "Show all 12 rows" }));
    expect(greps()).toEqual(all);
    await userEvent.click(screen.getByRole("button", { name: "Show last 5" }));
    expect(greps()).toEqual(last5);
    cleanup();
    show("?session=s1", { session: () => laned(5) }); // nothing to cut: no control
    await stream();
    expect([greps().length, screen.queryByRole("button", { name: /^Show / })]).toEqual([5, null]);
  });

  it("folds a lane when it finishes, unless the user opened it", async () => {
    const o = { s: laned(12) }, finish = async () => {
      o.s = { ...laned(12, { done: true }), cursor: "c2" };
      FakeSource.last!.notify(["s1"]);
      await waitFor(() => expect(within(laneHead()).getByRole("img", { name: "done" })).toBeTruthy());
    };
    show("?session=s1", { session: () => o.s });
    await stream();
    await userEvent.click(laneHead());
    expect(greps()).toEqual([]);
    await userEvent.click(laneHead());
    expect(greps().length).toBe(5);
    await finish();
    expect([greps().length, laneHead().getAttribute("aria-expanded")]).toEqual([12, "true"]); // the user's unfold holds; finished, it shows every row
    cleanup();
    o.s = laned(12);
    show("?session=s1", { session: () => o.s });
    await stream();
    expect(greps().length).toBe(5);
    await finish();
    expect([greps(), laneHead().getAttribute("aria-expanded")]).toEqual([[], "false"]); // untouched: folded as any finished lane
    cleanup();
    o.s = laned(12);
    show("?session=s1", { session: () => o.s });
    await stream();
    await userEvent.click(screen.getByRole("button", { name: "Show all 12 rows" })); // asking for every row opens it too
    await finish();
    expect(greps().length).toBe(12);
  });

  it("keeps a lane's fold and its expansion through a visit to another session", async () => {
    const other = { ...laned(12), session_id: "s2", project: "jobdesk", events: laned(12).events.map(e => ({ ...e, lane: e.lane && "b2" })) };
    show("?session=s1", { session: q => (q.get("id") === "s1" ? laned(12) : other) });
    await stream();
    const open = async (project: string) => {
      await userEvent.click(within(await rail()).getAllByRole("button").find(b => b.querySelector(".pname")!.textContent === project)!);
      await waitFor(() => expect(screen.getByRole("region", { name: "Session" }).querySelector(".stream-head .pname")!.textContent).toBe(project));
    };
    await userEvent.click(screen.getByRole("button", { name: "Show all 12 rows" }));
    await open("jobdesk");
    expect(greps().length).toBe(5); // its own lane, as any running one
    await userEvent.click(screen.getByRole("button", { name: /^Subagent/ }));
    await open("foo");
    expect(greps().length).toBe(12);
    await open("jobdesk");
    expect([greps(), screen.getByRole("button", { name: /^Subagent/ }).getAttribute("aria-expanded")]).toEqual([[], "false"]);
  });

  it("keeps each lane's rows and the user's choices when an update brings one lane's work", async () => {
    const of = (lane: string, n: number) => ({ ...laneCall(n), lane, key: `${lane}${n}#0`, id: `${lane}${n}`, summary: `${lane}-${n}` });
    const calls = (lane: string, n: number) => Array.from({ length: n }, (_, i) => of(lane, i + 1));
    const three = { ...s1, events: [...calls("b1", 7), ...calls("b2", 7), ...calls("b3", 2)] };
    let next: LiveSession | undefined;
    show("?session=s1", { session: q => (q.get("after") && next ? next : three) });
    await stream();
    const heads = () => screen.getAllByRole("button", { name: /^Subagent/ });
    const shown = () => heads().map(h => [h.querySelector(".muted")!.textContent!.split(" · ")[0], ...[...h.parentElement!.querySelectorAll(".tool .sum")].map(r => r.textContent)].join(" "));
    await userEvent.click(within(heads()[0]!.parentElement!).getByRole("button", { name: "Show all 7 rows" }));
    await userEvent.click(heads()[1]!);
    const before = shown();
    expect(before).toEqual(["7 tools b1-1 b1-2 b1-3 b1-4 b1-5 b1-6 b1-7", "7 tools", "2 tools b3-1 b3-2"]);
    next = { ...three, events: [of("b3", 3), of("b3", 4)], cursor: "c2" };
    FakeSource.last!.notify(["s1"]);
    await waitFor(() => expect(shown()).toEqual([before[0], before[1], "4 tools b3-1 b3-2 b3-3 b3-4"]));
  });

  it("shows a lane's errors, model and cost in its header, and leaves out what is not known", async () => {
    show("?session=s1", { session: () => ({ ...laned(8, { done: true, failed: 2 }), lanes: { a7: { cost: 0.05, model: "claude-haiku-5-5" } } }) });
    await stream();
    const figures = () => laneHead().querySelector(".muted")!;
    expect(figures().textContent).toBe("8 tools · 2 errors · 7.0s · claude-haiku-5-5 · $0.05");
    expect(within(figures() as HTMLElement).getByText("2 errors").className).toBe("bad");
    cleanup();
    show("?session=s1", { session: () => ({ ...laned(8, { done: true }), lanes: {} }) }); // no request of the lane's yet
    await stream();
    expect(figures().textContent).toBe("8 tools · 7.0s");
    cleanup();
    show("?session=s1", { session: () => ({ ...laned(8, { done: true }), lanes: { a7: { cost: null, model: "mystery-1" } } }) }); // an unpriced model
    await stream();
    expect(figures().textContent).toBe("8 tools · 7.0s · mystery-1");
  });

  it("folds a Codex lane whose turn ended, with its duration up to its last event", async () => {
    show("?session=" + codex.session_id, { session: () => threaded(turn("turn_start", 0), ...threadCalls(1, 12), turn("turn_end", 14)) });
    await stream();
    expect([threadRows(), threadHead().getAttribute("aria-expanded"), screen.queryByRole("button", { name: /^Show / })]).toEqual([[], "false", null]);
    expect(threadHead().querySelector(".muted")!.textContent).toBe("12 tools · 14s");
    expect(within(threadHead()).getByRole("img", { name: "done" })).toBeTruthy();
  });

  it("keeps a Codex lane open and running while its turn goes on, and folds it when a catch-up brings the turn's end", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    // A first turn that ended, then a second one in progress: the last mark decides.
    const o = { s: threaded(turn("turn_start", 0), ...threadCalls(1, 6), turn("turn_end", 8), turn("turn_start", 9), ...threadCalls(10, 15)) };
    show("?session=" + codex.session_id, { session: () => o.s });
    await tick(10);
    const figures = () => threadHead().querySelector(".muted")!.textContent;
    expect([threadRows(), threadHead().getAttribute("aria-expanded")]).toEqual([["c11", "c12", "c13", "c14", "c15"], "true"]);
    expect(screen.getByRole("button", { name: "Show all 12 rows" })).toBeTruthy();
    expect([figures(), within(threadHead()).getByRole("img").getAttribute("aria-label")]).toEqual(["12 tools · 30s", "running"]);
    await tick(1000);
    expect(figures()).toBe("12 tools · 31s");
    o.s = { ...o.s, events: [turn("turn_end", 20)], cursor: "c2" };
    FakeSource.last!.notify([codex.session_id]);
    await tick(10);
    expect([threadRows(), threadHead().getAttribute("aria-expanded"), figures()]).toEqual([[], "false", "12 tools · 20s"]);
    expect(within(threadHead()).getByRole("img").getAttribute("aria-label")).toBe("done");
    await tick(5000);
    expect(figures()).toBe("12 tools · 20s");
  });

  it("keeps the lanes and their rows when a catch-up brings only a main-thread event", async () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    let next: LiveSession | undefined;
    show("?session=s1", { session: q => (q.get("after") && next ? next : s1) });
    await stream();
    await userEvent.click(laneHead());
    expect(greps().length).toBe(3);
    next = { ...s1, events: [{ ...main, key: "z#0", id: "t9", summary: "ls" }], cursor: "c2" };
    FakeSource.last!.notify(["s1"]);
    expect(await screen.findByRole("button", { name: /^Readls/ })).toBeTruthy();
    expect(greps().length).toBe(3);
    expect(laneHead().textContent).toContain("3 tools");
  });

  it("names an MCP tool by its tool part, with the full name on hover", async () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    show("?session=s1", { session: () => ({ ...s1, events: [{ ...main, tool: "mcp__docs__search_pages" }] }) });
    const row = await screen.findByRole("button", { name: /^search_pages/ });
    expect(row.querySelector(".nm")!.getAttribute("title")).toBe("mcp__docs__search_pages");
  });

  it("ticks a running call's timer every second and flags a slow shell call", async () => {
    fakeClock("2026-11-10T10:00:25.000Z");
    show();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const push = () => toolRow("Bash", 1);
    expect(push().className).toContain("running");
    expect(within(push()).getByText("3.0s")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(within(push()).getByText("5.0s")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(push().className).toContain("waiting");
  });

  it("keeps a long shell call running past 30 s, in its row and in the state", async () => {
    fakeClock("2026-11-10T10:01:30.000Z");
    const long = { ...s1, state: { ...s1.state, kind: "tool" as const, inferred: false, long: true },
      events: s1.events.map(e => (e.k === "tool" && e.end == null ? { ...e, long: true } : e)) };
    show("?session=s1", { session: () => long });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(toolRow("Bash", 1).className).toBe("tool running");
    const panel = strip();
    expect(within(panel).queryByText(/approval\?/)).toBeNull();
    expect(within(panel).getByText("Bash running for 1m 08s")).toBeTruthy();
  });

  it("opens a failed call's detail in place with the error and the result size only", async () => {
    show();
    await stream();
    await userEvent.click((await screen.findAllByRole("button", { name: /^Bash/ }))[0]!); // the session loads after the stream shows
    const detail = toolRow("Bash", 0).nextElementSibling!;
    expect(detail.textContent).toContain("uv run python -m unittest");
    expect(detail.textContent).toContain("FAIL: test_hot_pass");
    expect(detail.textContent).toContain("characters · turn on Full text to read it");
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(false);
  });

  it("shows a shell call's description as its row text, with the command on hover and beside it when opened", async () => {
    show();
    await stream();
    const text = (row: HTMLElement) => [row.querySelector(".sum")!.textContent, row.getAttribute("title")];
    expect(text(toolRow("Bash", 0))).toEqual(["Run the Python tests", "uv run python -m unittest"]);
    expect(text(toolRow("Bash", 1))).toEqual(["git push origin feat/live-page", null]); // no description: the command
    expect(text(toolRow("Agent"))).toEqual(["find callers of ingest", null]); // not a shell call: its input, as before
    const terms = (row: HTMLElement) => [...row.nextElementSibling!.querySelectorAll("dt")].map(t => `${t.textContent}: ${t.nextElementSibling!.textContent}`);
    await userEvent.click(toolRow("Bash", 0));
    expect(terms(toolRow("Bash", 0)).slice(0, 2)).toEqual(["description: Run the Python tests", "input: uv run python -m unittest"]);
    await userEvent.click(toolRow("Bash", 1));
    expect(terms(toolRow("Bash", 1))[0]).toBe("input: git push origin feat/live-page");
  });

  it("stops following on scroll-up and offers Jump to latest when new events arrive", async () => {
    const more = { ...s1, events: [...s1.events, { ...(s1.events.at(-1) as LiveToolEvent), key: "n#0", id: "t10", summary: "ls" }], cursor: "c3" };
    let fresh = false;
    show("?session=s1", { session: () => (fresh ? more : s1) });
    const box = await screen.findByRole("region", { name: "Session events" }).catch(() => screen.findByLabelText("Session events"));
    box.scrollTop = 100; // no size changed: the scroll is the user's
    fireEvent.scroll(box);
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(false);
    fresh = true;
    FakeSource.last!.notify(["s1"]);
    const jump = await screen.findByRole("button", { name: "Jump to latest ↓" });
    await userEvent.click(jump);
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(true);
  });

  it("is a silent log, and shows the events that came while Follow is off beside Jump to latest, at most every 5 s", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    let n = 0;
    const add = (i: number) => ({ ...(s1.events.at(-1) as LiveToolEvent), key: `n#${i}`, id: `t1${i}`, summary: "ls" });
    show("?session=s1", { session: () => ({ ...s1, events: [...s1.events, ...Array.from({ length: n }, (_, i) => add(i))], cursor: `c${n}` }) });
    const arrive = async (count: number) => { n = count; FakeSource.last!.notify(["s1"]); await tick(10); };
    await tick(10);
    const box = screen.getByRole("log", { name: "Session events" });
    expect([box.getAttribute("aria-live"), box.tabIndex]).toEqual(["off", 0]);
    const news = () => box.querySelector<HTMLElement>(".news-n")!;
    expect([news().getAttribute("role"), news().getAttribute("aria-live")]).toEqual(["status", "polite"]);
    await arrive(1);
    expect(news().textContent).toBe(""); // Follow on: nothing said
    box.scrollTop = 100; // no size changed: the scroll is the user's
    fireEvent.scroll(box);
    await arrive(2);
    const jump = screen.getByRole("button", { name: "Jump to latest ↓" });
    expect(news().textContent).toBe("1 new event"); // the first count at once, on screen beside the button
    expect(news().parentElement).toBe(jump.parentElement);
    await arrive(4);
    await tick(1000);
    expect(news().textContent).toBe("1 new event"); // not on each arrival
    await tick(4000);
    expect(news().textContent).toBe("3 new events");
    fireEvent.click(jump);
    await tick(10);
    expect([news().textContent, screen.queryByRole("button", { name: "Jump to latest ↓" })]).toEqual(["", null]);
  });

  it("keeps following when the box or its rows change size, and puts the newest event back in view", async () => {
    // jsdom has no layout and no ResizeObserver: a box `room` px high over rows `rows` px high in all, which keeps its
    // scrollTop in bounds as a browser does, and the observers the page starts.
    const told = new Set<() => void>(), l = { room: 400, rows: 2000, top: 0 };
    vi.spyOn(globalThis, "ResizeObserver").mockImplementation(function (cb: () => void) {
      return { observe: () => { told.add(cb); }, unobserve() {}, disconnect: () => { told.delete(cb); } };
    } as never);
    show();
    await stream();
    const box = screen.getByLabelText("Session events"), follow = () => check("Follow").checked;
    Object.defineProperty(box, "clientHeight", { get: () => l.room, configurable: true });
    Object.defineProperty(box, "scrollHeight", { get: () => l.rows, configurable: true });
    Object.defineProperty(box, "scrollTop", { get: () => l.top, set: (v: number) => { l.top = Math.max(0, Math.min(v, l.rows - l.room)); }, configurable: true });
    // A resize as a browser does it: the box stays in bounds, with a scroll event when that moves it, and the observers
    // are told, before that event (Chromium) or after it (Firefox, Safari). Then: is Follow on, and is the box at its
    // foot, where the newest event of s1 is?
    const resize = (to: Partial<typeof l>, scrollFirst: boolean) => {
      const was = l.top, tell = () => act(() => told.forEach(cb => cb()));
      Object.assign(l, to);
      box.scrollTop = l.top;
      if (!scrollFirst) tell();
      if (l.top !== was) fireEvent.scroll(box);
      if (scrollFirst) tell();
      return [follow(), l.top === l.rows - l.room];
    };
    for (const scrollFirst of [false, true]) {
      expect(resize({ room: 400, rows: 2000 }, scrollFirst)).toEqual([true, true]);
      expect(resize({ rows: 1900 }, scrollFirst)).toEqual([true, true]); // a web font loads and rows wrap less: the box is clamped
      expect(resize({ room: 700 }, scrollFirst)).toEqual([true, true]); // a taller window: clamped again
      expect(resize({ room: 400, rows: 2600 }, scrollFirst)).toEqual([true, true]); // a narrower one: rows wrap more, and nothing scrolls
    }
    box.scrollTop = l.top - 100; // the user reads back
    fireEvent.scroll(box);
    expect(follow()).toBe(false);
    expect(resize({ rows: 3000 }, true)).toEqual([false, false]); // Follow is off: a resize moves nothing
  });

  it("follows the newest event into a lane in the middle of the stream, without its own scroll turning Follow off", async () => {
    const o = { s: laned(12) };
    show("?session=s1", { session: () => o.s });
    await stream();
    // jsdom lays nothing out: stand each drawn row 30 px under the one before, in a box that shows three of them.
    const box = screen.getByLabelText("Session events"), drawn = () => [...box.querySelectorAll(".ev")];
    Object.defineProperty(box, "clientHeight", { value: 90, configurable: true });
    Object.defineProperty(box, "scrollHeight", { get: () => drawn().length * 30, configurable: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this === box ? 0 : drawn().indexOf(this) * 30 - box.scrollTop, height = this === box ? 90 : 30;
      return { top, height, bottom: top + height } as DOMRect;
    });
    const inView = (el: Element) => { const at = drawn().indexOf(el) * 30; return at >= box.scrollTop && at + 30 <= box.scrollTop + 90; };
    const follow = () => (screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked;
    const arrive = async (n: number) => {
      o.s = { ...o.s, events: [laneCall(n)], cursor: `c${n}` };
      FakeSource.last!.notify(["s1"]);
      return (await screen.findByRole("button", { name: new RegExp(`^Grepg${n}`) })).closest(".ev")!;
    };
    const call = await arrive(30); // newer than the two main-thread calls under the lane
    expect([inView(call), inView(toolRow("Bash", 1).closest(".ev")!)]).toEqual([true, false]);
    fireEvent.scroll(box); // the scroll the page did itself
    expect(follow()).toBe(true);
    await userEvent.click(laneHead()); // folded: the lane's header stands for its newest call
    expect([inView(laneHead().closest(".ev")!), follow()]).toEqual([true, true]);
    await userEvent.click(laneHead());
    box.scrollTop = 0; // the user reads back
    fireEvent.scroll(box);
    expect(follow()).toBe(false);
    await arrive(31);
    expect(box.scrollTop).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Jump to latest ↓" }));
    expect([follow(), inView(toolRow("Grepg31").closest(".ev")!)]).toEqual([true, true]);
  });

  it("follows a row with no time to the foot when it ends the stream", async () => {
    const mark = { key: "c9#0", k: "compaction", ts: null, lane: null, pre: null } as LiveEvent; // a compaction that carries no time
    show("?session=s1", { session: () => ({ ...s1, events: [...s1.events, mark] }) });
    await stream();
    const box = screen.getByLabelText("Session events"), drawn = () => [...box.querySelectorAll(".ev, .compact")];
    Object.defineProperty(box, "clientHeight", { value: 90, configurable: true });
    Object.defineProperty(box, "scrollHeight", { get: () => drawn().length * 30, configurable: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this === box ? 0 : drawn().indexOf(this) * 30 - box.scrollTop, height = this === box ? 90 : 30;
      return { top, height, bottom: top + height } as DOMRect;
    });
    expect(drawn().at(-1)!.textContent).toBe("context compacted");
    await userEvent.click(check("Follow"));
    await userEvent.click(check("Follow")); // places the box anew, in this layout
    expect(box.scrollTop).toBe(box.scrollHeight);
  });

  it("holds one place for a followed row taller than the box, with its top in view", async () => {
    const told = new Set<() => void>();
    vi.spyOn(globalThis, "ResizeObserver").mockImplementation(function (cb: () => void) {
      return { observe: () => { told.add(cb); }, unobserve() {}, disconnect: () => { told.delete(cb); } };
    } as never);
    const o = { s: laned(12) };
    show("?session=s1", { session: () => o.s });
    await stream();
    // Each drawn row stands 30 px high under the one before, an opened one 300 px, in a box 90 px high.
    const box = screen.getByLabelText("Session events"), drawn = () => [...box.querySelectorAll(".ev")];
    const high = (el: Element) => (el.querySelector(":scope > div > .detail") ? 300 : 30);
    const topOf = (el: Element) => drawn().slice(0, drawn().indexOf(el)).reduce((sum, d) => sum + high(d), 0);
    Object.defineProperty(box, "clientHeight", { value: 90, configurable: true });
    Object.defineProperty(box, "scrollHeight", { get: () => drawn().reduce((sum, d) => sum + high(d), 0), configurable: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this === box ? 0 : topOf(this) - box.scrollTop, height = this === box ? 90 : high(this);
      return { top, height, bottom: top + height } as DOMRect;
    });
    o.s = { ...o.s, events: [laneCall(30)], cursor: "c30" };
    FakeSource.last!.notify(["s1"]);
    await userEvent.click(await screen.findByRole("button", { name: /^Grepg30/ })); // the lane's newest call, opened: Follow turns off
    await userEvent.click(check("Follow"));
    const places = [box.scrollTop], row = topOf(toolRow("Grepg30").closest(".ev")!);
    for (let i = 0; i < 3; i++) { act(() => told.forEach(cb => cb())); places.push(box.scrollTop); } // as each render places the box
    expect(new Set(places).size).toBe(1);
    expect(row >= places[0]! && row < places[0]! + 90).toBe(true);
  });

  it("follows the newest row the filters leave, not a newer one they hide", async () => {
    const failedCall = s1.events.find(e => e.k === "tool" && e.failed) as LiveToolEvent;
    const main = (key: string, sec: number, failed: boolean): LiveToolEvent => {
      const ts = `2026-11-10T10:00:${sec}.000Z`;
      return { ...failedCall, key, id: key, ts, start: ts, end: ts, failed };
    };
    // The newest failed call is in the lane, in the middle of the stream; the newest call of all passed, on the main thread.
    const s = { ...laned(12), events: [...laned(12).events, laneCall(30, true), main("f1#0", 15, true), main("f2#0", 16, true), main("ok#0", 50, false)] };
    show("?session=s1", { session: () => s });
    await stream();
    const box = screen.getByLabelText("Session events"), drawn = () => [...box.querySelectorAll(".ev")];
    Object.defineProperty(box, "clientHeight", { value: 60, configurable: true });
    Object.defineProperty(box, "scrollHeight", { get: () => drawn().length * 30, configurable: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this === box ? 0 : drawn().indexOf(this) * 30 - box.scrollTop, height = this === box ? 60 : 30;
      return { top, height, bottom: top + height } as DOMRect;
    });
    await userEvent.click(within(bar()).getByRole("button"));
    const at = drawn().indexOf(toolRow("Grepg30").closest(".ev")!) * 30;
    expect([check("Follow").checked, at >= box.scrollTop && at + 30 <= box.scrollTop + 60, drawn().length]).toEqual([true, true, 5]);
  });

  it("refetches only the list for another session's notice, and catches up the followed one with the cursor", async () => {
    const { calls } = show();
    await stream();
    const n = calls().length;
    FakeSource.last!.notify(["s2"]);
    await waitFor(() => expect(calls().length).toBe(n + 1));
    expect(calls().at(-1)).toBe("/api/live");
    FakeSource.last!.notify(["s1"]);
    await waitFor(() => expect(calls()).toContain(`/api/live/session?id=s1&after=${encodeURIComponent(s1.cursor!)}`));
  });

  it("refetches the list and the followed session for a notice that names no session", async () => {
    const { calls } = show();
    await stream();
    const n = calls().length;
    FakeSource.last!.notify(null);
    await settle();
    expect(calls().slice(n)).toEqual(["/api/live", catchUp]);
  });

  it("leaves the list and the session alone when a status answer tells of an ingest", async () => {
    const st = { ...status }, { calls, r } = show("?session=s1", { status: () => st });
    await stream();
    const n = calls().length;
    await act(async () => { await r.client.fetchQuery(queries.status); }); // the first answer, which invalidates nothing
    st.last_change = "2026-11-10T10:00:50+00:00";
    await act(async () => { await r.client.fetchQuery(queries.status); });
    await settle();
    expect(calls().length).toBe(n); // Live follows its own notices
  });

  it("shows a session opened again at once, and asks only for what came after its cursor", async () => {
    let back = false;
    const { calls } = show("?session=s1", { session: q => (q.get("id") !== "s1" ? { ...s1, session_id: "s2", project: "jobdesk" }
      : back ? new Promise(() => {}) as never : s1) }); // on return the answer never comes: what shows is what was held
    await stream();
    await userEvent.click(await entry("jobdesk"));
    await waitFor(() => expect(headed()).toBe("jobdesk"));
    back = true;
    const n = calls().length;
    await userEvent.click(await entry("foo"));
    expect([headed(), drawn()]).toEqual(["foo", ["Read", "Agent", "Bash", "Bash"]]);
    await settle();
    expect(calls().slice(n)).toEqual([catchUp]);
  });

  it("lets every request run to its end under a notice a second, and ends with what the last notice told of", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    const a = sess("a", "tool", "2026-11-10T09:00:00.000Z");
    let s = s1;
    const o = { list: { ...list, sessions: [a] }, session: () => s }, { f } = show("?session=s1", o);
    await tick(10);
    // Every answer takes a second and a half, and is what the app held when it was asked.
    const normal = f.getMockImplementation()!, sent: { url: string; signal: AbortSignal }[] = [];
    f.mockImplementation(((input: string, init: RequestInit) => {
      const res = normal(input);
      if (input === "/api/status") return res;
      sent.push({ url: input, signal: init.signal! });
      return new Promise<Response>(r => { setTimeout(() => r(res), 1500); });
    }) as typeof normal);
    for (let i = 1; i <= 5; i++) { // a notice at 0 s, 1 s, 2 s, 3 s and 4 s
      o.list = { ...list, sessions: [{ ...a, project: "n" + i }] };
      s = { ...s1, events: [{ ...(s1.events.at(-1) as LiveToolEvent), key: `n${i}#0`, id: "n" + i, summary: "ls" + i }], cursor: "c" + i };
      FakeSource.last!.notify(["s1"]);
      await tick(i < 5 ? 1000 : 5000);
    }
    expect(sent.map(x => x.signal.aborted)).not.toContain(true);
    // Asked at 0 s, 1.5 s, 3 s and 4.5 s: one at a time for each, and the last one after the last notice.
    expect(sent.map(x => x.url.split("?")[0])).toEqual(Array.from({ length: 4 }, () => ["/api/live", "/api/live/session"]).flat());
    expect(groups(screen.getByRole("region", { name: "Active sessions" }))).toEqual(["working · 1 n5"]);
    expect(screen.getAllByRole("button", { name: /^Bashls/ }).map(b => b.querySelector(".sum")!.textContent)).toEqual(["ls1", "ls2", "ls3", "ls5"]); // what the app held at each asking
  });

  it("follows a request under way with exactly one more, however many notices came meanwhile", async () => {
    const { f } = show();
    await stream();
    const { sent, urls, waiting, answer } = lateAnswers(f);
    for (let i = 0; i < 4; i++) FakeSource.last!.notify(["s1"]);
    await settle();
    expect(urls()).toEqual(["/api/live", catchUp]); // the first notice's, under way
    await answer();
    expect([urls().slice(2), waiting()]).toEqual([["/api/live", catchUp], 2]); // one more for the three notices since
    await answer();
    expect([urls().length, waiting(), sent.some(x => x.signal.aborted)]).toEqual([4, 0, false]);
  });

  it("follows a session's first load with one more request when a notice came during it", async () => {
    const { f } = show();
    await stream();
    const { urls, waiting, answer } = lateAnswers(f), s2 = "/api/live/session?id=s2";
    await userEvent.click(await entry("jobdesk"));
    FakeSource.last!.notify(["s2"]); // the load under way was asked before it
    await settle();
    expect(urls()).toEqual([s2, "/api/live"]);
    await answer();
    expect([headed(), urls().slice(2), waiting()]).toEqual(["jobdesk", [`${s2}&after=${encodeURIComponent(s1.cursor!)}`], 1]);
    await answer();
    expect([urls().length, waiting()]).toEqual([3, 0]);
  });

  it("sends the request owed to a notice for the session selected now, when the user opened another meanwhile", async () => {
    const { f } = show();
    await stream();
    const { urls, waiting, answer } = lateAnswers(f), s2 = "/api/live/session?id=s2";
    FakeSource.last!.notify(["s1"]);
    FakeSource.last!.notify(["s1"]); // one more owed, for the list and for s1
    await userEvent.click(await entry("jobdesk"));
    await settle();
    expect(urls()).toEqual(["/api/live", catchUp, s2]);
    await answer();
    expect([headed(), urls().slice(3), waiting()]).toEqual(["jobdesk", ["/api/live", `${s2}&after=${encodeURIComponent(s1.cursor!)}`], 2]); // nothing more for s1
    await answer();
    expect([urls().length, waiting()]).toEqual([5, 0]);
  });

  it("drops the session request owed to a notice when no session is selected any more", async () => {
    const o: Opts = {}, { f } = show("", o);
    await stream(); // the newest session, as the URL names none
    const { urls, waiting, answer } = lateAnswers(f);
    o.list = { ...list, sessions: [] };
    FakeSource.last!.notify(null);
    FakeSource.last!.notify(null); // one more owed, for the list and for the session
    await answer(1); // the list: no session is active
    expect(await screen.findByText(/No session is active/)).toBeTruthy();
    await answer();
    expect([urls().filter(u => u.startsWith("/api/live/session")).length, waiting()]).toEqual([1, 0]);
  });

  it("shows reconnecting when the stream drops, then catches up", async () => {
    const { calls } = show();
    await stream();
    FakeSource.last!.open();
    FakeSource.last!.drop();
    expect(conn().textContent).toBe("Connection lost · reconnecting…");
    const n = calls().length;
    FakeSource.last!.open();
    expect(conn().textContent).toBe("Updating live");
    await waitFor(() => expect(calls().length).toBeGreaterThanOrEqual(n + 2));
  });

  it("opens a new stream after an HTTP error closed it, at 1 s, 2 s and 4 s, and starts over after a success", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    const { calls } = show();
    await tick(10);
    const retried = async (ms: number) => {
      const was = FakeSource.last!;
      was.fail();
      expect([was.closed, conn().textContent]).toEqual([true, "Connection lost · reconnecting…"]);
      await tick(ms - 1);
      expect(FakeSource.last).toBe(was);
      await tick(1);
      expect(FakeSource.last).not.toBe(was);
    };
    FakeSource.last!.open();
    await retried(1000);
    await retried(2000);
    await retried(4000);
    const n = calls().length;
    FakeSource.last!.open();
    expect(conn().textContent).toBe("Updating live");
    await tick(10);
    expect(calls().slice(n)).toEqual(["/api/live", `/api/live/session?id=s1&after=${encodeURIComponent(s1.cursor!)}`]); // what it missed
    await retried(1000);
    for (const ms of [2000, 4000, 8000, 16_000, 30_000, 30_000]) await retried(ms); // capped at 30 s
  });

  it("leaves a stream that is still connecting to the browser, and clears its retry on unmount", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    const { r } = show();
    await tick(10);
    const src = FakeSource.last!;
    src.drop();
    await tick(60_000);
    expect([FakeSource.last, src.closed]).toEqual([src, false]);
    src.fail();
    r.unmount();
    await tick(60_000);
    expect(FakeSource.last).toBe(src);
  });

  it("looks paused while paused: the page carries the class that stills the dots", async () => {
    show();
    await stream();
    const page = screen.getByRole("main");
    expect(page.className).toBe("wrap pg-live");
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect([page.className, conn().textContent]).toEqual(["wrap pg-live paused", "Paused"]);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect([page.className, conn().textContent]).toEqual(["wrap pg-live", "Connecting…"]);
  });

  it("updates the nav's Last ingest on a change notice, without waiting for the nav's poll", async () => {
    // The nav's sentence for the last ingest, with seconds: Refresh's title (the visible label shows hours and minutes only).
    const st = { ...status }, text = (ts: string) => `Last ingest ${new Date(ts).toLocaleTimeString()}`;
    const said = () => document.getElementById("navRefresh")?.title;
    show("?session=s1", { app: true, status: () => st });
    await waitFor(() => expect(said()).toBe(text(st.last_ingest)));
    st.last_ingest = st.last_change = "2026-11-10T10:00:50+00:00";
    FakeSource.last!.notify(["s2"]);
    await waitFor(() => expect(said()).toBe(text(st.last_ingest)));
  });

  it("asks for the status once at a time however many notices arrive, and not while paused", async () => {
    const { polls } = show();
    await stream();
    expect(polls()).toBe(0);
    for (let i = 0; i < 10; i++) FakeSource.last!.notify(["s2"]);
    expect(polls()).toBe(1); // one in flight
    await waitFor(() => expect(polls()).toBe(2)); // and one more for the notices that came meanwhile
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(polls()).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    FakeSource.last!.notify(["s2"]);
    FakeSource.last!.notify(["s2"]);
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(polls()).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(polls()).toBe(3));
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(polls()).toBe(3); // once for all that was held
  });

  it("asks for the status when the stream reopens, as the app may be back, and not while paused", async () => {
    const { polls } = show();
    await stream();
    const reopen = async () => {
      FakeSource.last!.drop();
      FakeSource.last!.open();
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });
      return polls();
    };
    FakeSource.last!.open();
    expect(await reopen()).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await reopen()).toBe(1);
  });

  it("drops the status request owed to a notice when the user pauses before it is sent, and asks on resume with no notice held", async () => {
    let answer!: () => void;
    const slow = new Promise(r => { answer = () => r(status); });
    const { polls } = show("?session=s1", { status: () => slow });
    await stream();
    FakeSource.last!.notify(["s2"]);
    FakeSource.last!.notify(["s2"]);
    expect(polls()).toBe(1); // one in flight, one more owed
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await act(async () => { answer(); await new Promise(r => setTimeout(r, 20)); });
    expect([polls(), conn().textContent]).toEqual([1, "Paused"]);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(polls()).toBe(2); // once: the nav would else show the time before the second notice's ingest
  });

  it("holds updates while paused and fetches once on resume", async () => {
    const { calls } = show();
    await stream();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    const n = calls().length;
    FakeSource.last!.notify(["s1"]);
    FakeSource.last!.notify(["s1"]);
    FakeSource.last!.notify(["s2"]);
    expect(calls().length).toBe(n);
    expect(conn().textContent).toBe("Paused · 3 updates held");
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await settle();
    expect(calls().slice(n)).toEqual(["/api/live", catchUp]); // once each, whatever was held
  });

  it("still loads what the user asks for while paused: another session, the full text", async () => {
    const { calls } = show();
    await stream();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    const n = calls().length;
    await userEvent.click(await entry("jobdesk"));
    await waitFor(() => expect(headed()).toBe("jobdesk"));
    await userEvent.click(check("Full text"));
    expect(await within(await rail()).findByText("Freeze the clock in the snapshot test")).toBeTruthy();
    FakeSource.last!.notify(null);
    await settle();
    expect(calls().slice(n)).toEqual(["/api/live/session?id=s2", "/api/live?text=1", "/api/live/session?id=s2&text=1"]); // and nothing for the notice
    expect(conn().textContent).toBe("Paused · 1 update held");
  });

  it("holds the request owed to a notice when the user pauses before it is sent, and sends it once on Resume", async () => {
    const { f } = show();
    await stream();
    const { urls, waiting, answer } = lateAnswers(f);
    FakeSource.last!.notify(["s1"]);
    FakeSource.last!.notify(["s1"]); // one more owed, for the list and for the session
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await answer();
    expect([urls().length, waiting(), conn().textContent]).toEqual([2, 0, "Paused · 1 update held"]); // one, whatever both owed
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await settle();
    expect([urls().slice(2), waiting(), conn().textContent]).toEqual([["/api/live", catchUp], 2, "Connecting…"]);
    await answer();
    expect([urls().length, waiting()]).toEqual([4, 0]);
  });

  it("sends no request on Resume when no update was held", async () => {
    const { calls } = show();
    await stream();
    const n = calls().length;
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await settle();
    expect(calls().length).toBe(n);
  });

  it("shows the status strip: an inferred approval wait with its reason behind a toggletip, the context, the figures and the limits", async () => {
    const limits = [{ label: "5h", used_percent: 86, observed_at: null, resets_at: "2026-11-10T14:00:00.000Z" }, { label: "7d", used_percent: 31, observed_at: null, resets_at: null }];
    show("?session=s1", { session: () => ({ ...s1, limits }) });
    await stream();
    const panel = strip();
    expect(within(panel).getByText("approval?").closest(".state")!.textContent).toBe("approval? (inferred)");
    expect(within(panel).queryByText(/transcripts record no permission prompt/)).toBeNull(); // behind its toggletip
    await userEvent.click(within(panel).getByRole("button", { name: "Why inferred" }));
    expect(within(panel).getByText(/transcripts record no permission prompt/)).toBeTruthy();
    expect(within(panel).getByText(/likely waiting for your approval/)).toBeTruthy(); // the state's detail
    expect(within(panel).getByRole("meter", { name: "Context used" }).className).toBe("meter");
    expect(within(panel).getByText("Errors").nextElementSibling!.textContent).toBe("1");
    const fig = (k: string) => within(panel).getByText(k).parentElement!.textContent;
    expect([fig("Cost"), fig("Tools"), fig("Cache read")]).toEqual([`Cost ${usd(s1.cost)}`, `Tools ${s1.tools}`, `Cache read ${pct(s1.cache_read)}?`]); // ? is its toggletip
    expect(within(panel).getByRole("button", { name: "About cache read" })).toBeTruthy();
    const [h5, d7] = [fig("5h"), fig("7d")];
    expect(h5).toBe("5h 86% near?"); // near the limit in words, the reset behind its toggletip
    expect(within(panel).getByText("5h").parentElement!.className).toBe("it lim warn");
    expect(d7).toBe("7d 31%"); // no reset known: no toggletip
    const reset = within(panel).getByRole("button", { name: "About the 5h limit" });
    reset.focus();
    await userEvent.keyboard("{Enter}"); // the keyboard reaches the reset time
    expect(within(panel).getByText(/^The 5h limit resets /)).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(within(panel).getByText(s1.cwd!).closest("code")!.className).toBe("cwd");
    expect(within(panel).getByRole("group", { name: /^Last 10 minutes: / })).toBeTruthy(); // the pulse
    expect(screen.queryByRole("complementary")).toBeNull(); // no agent panel any more
  });

  it("copies the resume command from the strip, and says whether it worked", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    show();
    await stream();
    await userEvent.click(within(strip()).getByRole("button", { name: "Copy resume" }));
    expect(writeText).toHaveBeenCalledWith(`cd '${s1.cwd}' && claude --resume s1`);
    await waitFor(() => expect(within(strip()).getByText("Resume command copied to clipboard.")).toBeTruthy());
    expect(within(strip()).getByRole("button", { name: "Copied" })).toBeTruthy();
    writeText.mockImplementation(() => Promise.reject(new Error("denied")));
    await userEvent.click(within(strip()).getByRole("button", { name: "Copied" }));
    await waitFor(() => expect(within(strip()).getByText("Could not copy to clipboard.")).toBeTruthy());
    vi.unstubAllGlobals();
  });

  it("says Copied only in the strip of the session copied, and only for the last attempt", async () => {
    let done: (() => void)[] = [];
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    show();
    await stream();
    await userEvent.click(await entry("jobdesk")); // load s2, so it shows from the cache later
    await waitFor(() => expect(headed()).toBe("jobdesk"));
    await userEvent.click(await entry("foo"));
    await waitFor(() => expect(headed()).toBe("foo"));
    const copied = () => [within(strip()).queryByRole("button", { name: "Copied" }), within(strip()).queryByText("Resume command copied to clipboard.")];
    await userEvent.click(within(strip()).getByRole("button", { name: "Copy resume" }));
    await waitFor(() => expect(copied()[0]).toBeTruthy()); // foo's
    await userEvent.click(await entry("jobdesk")); // within the 2 s
    await waitFor(() => expect(headed()).toBe("jobdesk"));
    expect(copied()).toEqual([null, null]); // jobdesk's strip says nothing of it
    // A copy still under way when another session opens: its result is not said there either.
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(() => new Promise<void>(r => { done.push(r); })) } });
    await userEvent.click(await entry("foo"));
    await waitFor(() => expect(headed()).toBe("foo"));
    await userEvent.click(within(strip()).getByRole("button", { name: "Copy resume" }));
    await userEvent.click(await entry("jobdesk"));
    await waitFor(() => expect(headed()).toBe("jobdesk"));
    await act(async () => { done.forEach(r => r()); done = []; });
    expect(copied()).toEqual([null, null]);
    // Two attempts on one session: only the last one's result is said.
    const writeText = vi.fn().mockReturnValueOnce(new Promise<void>((_, no) => { done.push(() => no(new Error("late"))); })).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await userEvent.click(within(strip()).getByRole("button", { name: "Copy resume" }));
    await userEvent.click(within(strip()).getByRole("button", { name: "Copy resume" }));
    await waitFor(() => expect(within(strip()).getByRole("button", { name: "Copied" })).toBeTruthy());
    await act(async () => { done.forEach(r => r()); });
    expect(within(strip()).getByRole("button", { name: "Copied" })).toBeTruthy(); // the first one's late failure says nothing
    vi.unstubAllGlobals();
  });

  it("shows the pulse of the last 10 minutes: its minutes, its ticks and a readout by keyboard", async () => {
    const t = (min: number, s = 0) => new Date(Date.parse("2026-11-10T09:51:00.000Z") + min * 60_000 + s * 1000).toISOString();
    const pulse = { start: t(0), end: t(10), context: [{ ts: t(-2), tokens: 40_000 }, { ts: t(4, 10), tokens: 52_000 }, { ts: t(9, 30), tokens: 62_000 }],
      ticks: [{ ts: t(4, 20), failed: false }, { ts: t(4, 30), failed: true }, { ts: t(4, 40), failed: false }, { ts: t(9, 40), failed: false }, { ts: t(10), failed: true }] };
    expect(pulseMinutes(pulse).map(m => [m.context, m.calls, m.failed])).toEqual([
      [40_000, 0, 0], [40_000, 0, 0], [40_000, 0, 0], [40_000, 0, 0], [52_000, 3, 1], [52_000, 0, 0], [52_000, 0, 0], [52_000, 0, 0], [52_000, 0, 0], [62_000, 2, 1]]);
    expect(pulseMinutes({ ...pulse, context: [] })[0]!.context).toBeNull(); // no request yet
    show("?session=s1", { session: () => ({ ...s1, pulse }) });
    await stream();
    const chart = within(strip()).getByRole("group", { name: /^Last 10 minutes: / });
    expect(chart.getAttribute("aria-label")).toMatch(/^Last 10 minutes: context 40k to 62k tokens, 5 tool calls, 2 failed\. Use the left and right arrow keys/);
    // A success is an upright line, a failure a ✕ path: two shapes, not two colors of one.
    expect([chart.querySelectorAll("line.ok").length, chart.querySelectorAll("path.bad").length]).toEqual([3, 2]);
    const readout = strip().querySelector(".pulse .readout")!;
    expect(readout.getAttribute("aria-live")).toBe("polite");
    chart.focus();
    await userEvent.keyboard("{Home}");
    expect(readout.textContent).toMatch(/: context 40k, 0 calls, 0 failed$/);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(readout.textContent).toMatch(/^\d\d:\d\d to \d\d:\d\d: context 52k, 3 calls, 1 failed$/);
    await userEvent.keyboard("{End}");
    expect(readout.textContent).toMatch(/: context 62k, 2 calls, 1 failed$/);
    await userEvent.keyboard("{ArrowRight}"); // stays on the last minute
    expect(readout.textContent).toMatch(/: context 62k, 2 calls, 1 failed$/);
    await userEvent.keyboard("{Escape}");
    expect(readout.textContent).toBe("");
    expect(document.activeElement).toBe(chart);
    expect(chart.querySelector("rect.cur")).toBeNull();
  });

  it("names the pulse by the lowest and highest context it plots, and draws a flat cache as a level line", async () => {
    const t = (min: number) => new Date(Date.parse("2026-11-10T09:51:00.000Z") + min * 60_000).toISOString();
    const base = { start: t(0), end: t(10), ticks: [] };
    const up = (...tokens: number[]) => ({ ...base, context: tokens.map((n, i) => ({ ts: t(i * 3), tokens: n })) });
    expect(pulseSummary(up(40_000, 62_000, 40_000))).toBe("Last 10 minutes: context 40k to 62k tokens, 0 tool calls, 0 failed."); // the peak shows
    expect(pulseSummary(up(62_000, 40_000))).toBe("Last 10 minutes: context 40k to 62k tokens, 0 tool calls, 0 failed.");
    expect(pulseSummary({ ...base, context: [] })).toBe("Last 10 minutes: no request, 0 tool calls, 0 failed.");
    // A flat cache: every request reads the same context. One level, said once, drawn across the middle.
    const flat = up(40_000, 40_000, 40_000);
    expect(pulseSummary(flat)).toBe("Last 10 minutes: context 40k tokens, 0 tool calls, 0 failed.");
    expect(pulseMinutes(flat).map(m => m.context)).toEqual(Array(10).fill(40_000));
    show("?session=s1", { session: () => ({ ...s1, pulse: flat }) });
    await stream();
    const d = within(strip()).getByRole("group", { name: /^Last 10 minutes: / }).querySelector("path.l")!.getAttribute("d")!;
    expect([...d.matchAll(/[,V]([\d.]+)/g)].map(m => m[1])).toEqual(["9.5", "9.5", "9.5"]); // one height, mid-box
  });

  it("filters the stream to failed rows from the Errors count, in the stream's bar and in the status strip", async () => {
    show();
    await stream();
    const panel = strip();
    const inBar = within(bar()).getByRole("button", { name: "1 error" }), inPanel = within(panel).getByRole("button", { name: "1 error" });
    const pressed = () => [inBar, inPanel].map(b => b.getAttribute("aria-pressed"));
    expect([drawn(), pressed(), hidden()]).toEqual([["Read", "Agent", "Bash", "Bash"], ["false", "false"], null]);
    await userEvent.click(inBar);
    expect([drawn(), pressed(), hidden()]).toEqual([["Bash"], ["true", "true"], "9 rows hidden"]);
    expect(toolRow("Bash").className).toContain("failed");
    expect([screen.queryByText(/11 words/), screen.queryByText(/context compacted/), screen.queryAllByRole("button", { name: /^Agent find/ })]).toEqual([null, null, []]);
    await userEvent.click(inPanel); // either count clears it
    expect([drawn(), pressed(), hidden()]).toEqual([["Read", "Agent", "Bash", "Bash"], ["false", "false"], null]);
    expect(screen.getByText(/11 words/)).toBeTruthy();
  });

  it("hides every lane with Main thread only, and the rows that only read with Hide read-only", async () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    const row = (tool: string, quiet: boolean) => ({ ...main, key: tool + "#0", id: tool, tool, quiet });
    const other = { ...laneCall(40), lane: "b1", key: "b1#0", id: "b1" };
    show("?session=s1", { session: () => ({ ...laned(3), events: [...laned(3).events, row("Grep", true), row("Glob", true), row("Edit", false), other] }) });
    await stream();
    const lanes = () => screen.getByLabelText("Session events").querySelectorAll(".lane").length;
    expect([lanes(), drawn()]).toEqual([2, ["Read", "Agent", "Grep", "Grep", "Grep", "Bash", "Bash", "Grep", "Glob", "Edit", "Grep"]]);
    await userEvent.click(check("Main thread only"));
    expect([lanes(), drawn(), hidden()]).toEqual([0, ["Read", "Agent", "Bash", "Bash", "Grep", "Glob", "Edit"], "4 rows hidden"]);
    await userEvent.click(check("Main thread only"));
    await userEvent.click(check("Hide read-only"));
    expect([lanes(), drawn(), hidden()]).toEqual([0, ["Agent", "Bash", "Bash", "Edit"], "7 rows hidden"]); // a lane with no row left is hidden
    expect(screen.getByText(/11 words/)).toBeTruthy(); // prompts and replies stay
  });

  it("keeps a failed row that only reads under Hide read-only, with the Errors filter and without it", async () => {
    const read = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    const lost = { ...read, key: "lost#0", id: "lost", failed: true, error: "File does not exist." };
    show("?session=s1", { session: () => ({ ...s1, errors: 2, events: [...s1.events, lost] }) });
    await stream();
    await waitFor(() => expect([read.quiet, drawn()]).toEqual([true, ["Read", "Agent", "Bash", "Bash", "Read"]]));
    await userEvent.click(check("Hide read-only"));
    expect([drawn(), toolRow("Read").className, hidden()]).toEqual([["Agent", "Bash", "Bash", "Read"], "tool failed", "4 rows hidden"]); // the Read that passed and the lane's three
    await userEvent.click(within(bar()).getByRole("button", { name: "2 errors" }));
    expect(drawn()).toEqual(["Bash", "Read"]);
  });

  it("shows a lane's matching rows under its header, and says when the filters hide every row", async () => {
    // The session's only failed call is in its finished lane, one of six.
    const one = { ...laned(6, { done: true, failed: 1 }), errors: 1 };
    show("?session=s1", { session: () => ({ ...one, events: one.events.map(e => (e.k === "tool" && !e.lane ? { ...e, failed: false } : e)) }) });
    await stream();
    const panel = strip(), figures = panel.textContent;
    expect(greps()).toEqual([]);
    await userEvent.click(within(bar()).getByRole("button", { name: "1 error" }));
    expect([drawn(), greps(), hidden()]).toEqual([["Grep"], ["g1"], "12 rows hidden"]); // the filter opens the folded lane
    expect(laneHead().querySelector(".muted")!.textContent).toBe("6 tools · 1 error · 5.0s · claude-opus-5-5 · $0.01");
    await userEvent.click(check("Main thread only"));
    expect([drawn(), hidden(), screen.queryByRole("button", { name: /^Agent find/ })]).toEqual([[], "13 rows hidden", null]);
    expect(screen.getByText("The filters hide every row.")).toBeTruthy();
    expect(panel.textContent).toBe(figures); // the filters change no figure
    await userEvent.click(check("Main thread only"));
    await userEvent.click(laneHead()); // the user's fold still holds under the filter
    expect(drawn()).toEqual([]);
  });

  it("says there is no failed call when the Errors filter finds none", async () => {
    show("?session=s1", { session: () => ({ ...s1, errors: 0, events: s1.events.map(e => (e.k === "tool" ? { ...e, failed: false } : e)) }) });
    await stream();
    await userEvent.click(within(bar()).getByRole("button", { name: "0 errors" }));
    expect([drawn(), hidden()]).toEqual([[], "10 rows hidden"]);
    expect(screen.getByText("No failed calls in the events held.")).toBeTruthy();
  });

  it("keeps the filters on from one session to the next, and has them off after a reload", async () => {
    const { r } = show(""); // opens jobdesk, the one that wrote last
    await screen.findByRole("group", { name: "Stream filters" });
    await userEvent.click(check("Main thread only"));
    await userEvent.click(check("Hide read-only"));
    await userEvent.click(within(bar()).getByRole("button", { name: /error/ }));
    const on = () => [check("Main thread only").checked, check("Hide read-only").checked, within(bar()).getByRole("button", { name: /error/ }).getAttribute("aria-pressed")];
    const foo = within(await rail()).getAllByRole("button").find(b => b.querySelector(".pname")!.textContent === "foo")!;
    await userEvent.click(foo);
    await waitFor(() => expect(screen.getByRole("region", { name: "Session" }).querySelector(".stream-head .pname")!.textContent).toBe("foo"));
    expect([on(), drawn()]).toEqual([[true, true, "true"], ["Bash"]]);
    r.unmount();
    show();
    await stream();
    expect([on(), hidden()]).toEqual([[false, false, "false"], null]);
  });

  it("warns on a context above 80% and shows tokens only for an unknown window", async () => {
    let s = { ...s1, context: 850_000 };
    const { r } = show("?session=s1", { session: () => s });
    await stream();
    expect(screen.getByRole("meter", { name: "Context used" }).className).toBe("meter warn");
    r.unmount();
    s = { ...s1, context: 55_000, window: null };
    show("?session=s1", { session: () => s });
    await stream();
    expect(screen.queryByRole("meter", { name: "Context used" })).toBeNull();
    expect(screen.getByText(/window not known/)).toBeTruthy();
  });

  it("keeps open rows when Full text turns on, and shows their output once it arrives", async () => {
    show();
    await stream();
    await userEvent.click(toolRow("Bash", 0));
    await userEvent.click(screen.getByRole("checkbox", { name: "Full text" }));
    expect(toolRow("Bash", 0).getAttribute("aria-expanded")).toBe("true");
    const detail = toolRow("Bash", 0).nextElementSibling!;
    await waitFor(() => expect(detail.querySelector("pre")?.textContent).toContain("AssertionError"));
    expect(toolRow("Bash", 0).getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the events and their open rows, with the failure, when the full text cannot be loaded", async () => {
    show("?session=s1", { session: q => (q.get("text") ? undefined : s1) });
    await stream();
    await userEvent.click(toolRow("Bash", 0));
    await userEvent.click(check("Full text"));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not load. HTTP 404");
    expect([toolRow("Bash", 0).getAttribute("aria-expanded"), screen.queryByText(/Session not found/)]).toEqual(["true", null]);
  });

  it("takes the text off the screen at once when Full text turns off, with the events held before it", async () => {
    let off = false;
    const { calls } = show("?session=s1", { session: q => (q.get("text") ? s1text : off ? new Promise(() => {}) as never : s1) }); // no answer after the text
    await stream();
    await userEvent.click(toolRow("Bash", 0));
    await userEvent.click(check("Full text"));
    expect(await screen.findByText("Add a fast ingest pass while the Live page is open")).toBeTruthy();
    off = true;
    const n = calls().length;
    await userEvent.click(check("Full text"));
    expect([screen.queryByText("Add a fast ingest pass while the Live page is open"), toolRow("Bash", 0).nextElementSibling!.querySelector("pre")]).toEqual([null, null]);
    expect([drawn(), toolRow("Bash", 0).getAttribute("aria-expanded")]).toEqual([["Read", "Agent", "Bash", "Bash"], "true"]);
    await settle();
    expect(calls().slice(n)).toEqual(["/api/live", catchUp]);
  });

  it("takes a list loaded with Full text off the screen when Full text turns off, while the list without it loads", async () => {
    const { f } = show("");
    const title = () => within(screen.getByRole("main")).queryByText("Freeze the clock in the snapshot test");
    await rail();
    await userEvent.click(check("Full text"));
    await waitFor(() => expect(title()).toBeTruthy());
    await userEvent.click(screen.getByRole("checkbox", { name: /Include automated/ })); // a view whose list without text was never loaded
    await settle();
    expect(title()).toBeTruthy();
    const { urls, answer } = lateAnswers(f);
    await userEvent.click(check("Full text"));
    await settle();
    expect([urls()[0], title()]).toEqual(["/api/live?automated=1", null]); // asked, unanswered: no first-prompt title meanwhile
    await answer();
    expect([groups(await rail()).length, title()]).toEqual([5, null]);
  });

  it("links the note on older events to the session sheet", async () => {
    show("?session=s1", { session: () => ({ ...s1, truncated: true }) });
    await stream();
    expect(screen.getByRole("link", { name: "session sheet" }).getAttribute("href")).toBe("/live?session=s1&sheet=s1");
  });

  it("opens the session sheet over Live from the stream head, keeping the stream and its live connection", async () => {
    show("?session=s1", { app: true });
    await screen.findByRole("group", { name: "Stream filters" });
    const head = (await stream()).querySelector<HTMLElement>(".stream-head")!;
    const link = within(head).getByRole("link", { name: "Session sheet" });
    expect(link.getAttribute("href")).toBe("/live?session=s1&sheet=s1"); // a new tab opens the same
    const source = FakeSource.last!, events = screen.getByLabelText("Session events");
    await userEvent.click(link);
    expect(location.pathname + location.search).toBe("/live?session=s1&sheet=s1"); // in the app, without a reload
    expect(document.title).toMatch(/Live · AI Ledger$/);
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Session")).toBeTruthy();
    expect([FakeSource.last, source.closed, events.isConnected]).toEqual([source, false, true]); // same stream, same connection
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(location.search).toBe("?session=s1")); // Back to the stream as it was
    expect([FakeSource.last, source.closed, events.isConnected]).toEqual([source, false, true]);
    await waitFor(() => expect(document.activeElement).toBe(link));
  });

  it("opens a rail session's sheet over Live from its context menu, keeping the stream, and returns focus to it", async () => {
    show("?session=s1", { app: true });
    await stream();
    const source = FakeSource.last!;
    const s2 = within(await rail()).getAllByRole("button").find(b => b.dataset.session === "s2")!;
    s2.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Open session" }));
    await waitFor(() => expect(location.pathname + location.search).toBe("/live?session=s1&sheet=s2"));
    const dlg = await screen.findByRole("dialog");
    expect([FakeSource.last, source.closed]).toEqual([source, false]); // the stream still follows s1
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(location.search).toBe("?session=s1"));
    await waitFor(() => expect(document.activeElement).toBe(s2));
  });

  it("keeps the followed session when a sheet closes after picking sessions in the rail", async () => {
    show("?session=s1");
    await stream();
    await userEvent.click(within(await rail()).getAllByRole("button").find(b => b.dataset.session === "s2")!);
    expect(location.search).toBe("?session=s2");
    await userEvent.click(await within(screen.getByRole("region", { name: "Session" })).findByRole("link", { name: "Session sheet" }));
    expect(location.search).toBe("?session=s2&sheet=s2");
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(location.search).toBe("?session=s2")); // closing goes back over the sheet alone
  });

  it("dates the time of an event that is not from today", async () => {
    // The fixture's events are a day old on this clock, in any time zone; one more event is a minute old.
    fakeClock("2026-11-11T12:07:00.000Z");
    const fresh = { ...(s1.events.at(-1) as LiveToolEvent), key: "n#0", id: "t10", ts: "2026-11-11T12:06:00.000Z", start: "2026-11-11T12:06:00.000Z" };
    show("?session=s1", { session: () => ({ ...s1, events: [...s1.events, fresh] }) });
    await tick(10);
    const times = [...screen.getByLabelText("Session events").querySelectorAll(".ev > .t")].map(t => t.textContent!);
    const clock = (ts: string) => new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const day = (ts: string) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const old = s1.events[0]!.ts!;
    expect(times[0]).toContain(day(old));
    expect(times[0]!.endsWith(clock(old))).toBe(true);
    expect(times.at(-1)).toBe(clock(fresh.ts)); // today: the time alone
    fireEvent.click(toolRow("Read")); // the opened row's start time is dated too
    expect(toolRow("Read").nextElementSibling!.textContent).toContain(day(old));
  });

  it("says a session is not found, with a way back to the active ones", async () => {
    show("?session=nope", { session: () => undefined });
    expect(await screen.findByText(/Session not found/)).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
    FakeSource.last!.notify(null); // a list load does not clear it
    await waitFor(() => expect(screen.getByText(/Session not found/)).toBeTruthy());
    await userEvent.click(screen.getByRole("link", { name: "Show the active sessions" }));
    expect(location.search).toBe("");
  });

  it("keeps saying a session is not found, and that the list failed, while it asks again", async () => {
    const { f } = show("?session=nope", { session: () => undefined });
    expect(await screen.findByText(/Session not found/)).toBeTruthy();
    // From here the list and the session answer with an HTTP error, and late.
    const late: (() => void)[] = [], normal = f.getMockImplementation()!;
    f.mockImplementation((input: string) => (input === "/api/status" ? normal(input)
      : new Promise(r => { late.push(() => r({ ok: false, status: input.startsWith("/api/live/session") ? 404 : 500 } as Response)); })));
    const said = () => [late.length, !!screen.queryByText(/Session not found/), screen.queryByText("Loading…"), screen.queryByRole("alert")?.textContent];
    const answer = async () => { late.splice(0).forEach(a => a()); await settle(); return said(); };
    await userEvent.click(check("Full text")); // a list and a session the page holds nothing of
    await settle();
    expect(said()).toEqual([2, true, null, undefined]);
    expect(await answer()).toEqual([0, true, null, "Could not load. HTTP 500"]);
    for (let i = 0; i < 2; i++) {
      FakeSource.last!.notify(null);
      await settle();
      expect(said()).toEqual([2, true, null, "Could not load. HTTP 500"]); // both asked again, unanswered: nothing blinks off
      expect(await answer()).toEqual([0, true, null, "Could not load. HTTP 500"]);
    }
  });

  it("moves off a session the list no longer holds, as after a filter change", async () => {
    const o: { list?: LivePayload } = {};
    const { calls } = show("", o);
    await waitFor(() => expect(calls()).toContain("/api/live/session?id=s2"));
    o.list = { ...list, sessions: list.sessions.filter(s => s.session_id !== "s2") };
    FakeSource.last!.notify(null);
    await waitFor(() => expect(calls()).toContain(`/api/live/session?id=${o.list!.sessions[0]!.session_id}`));
    expect(screen.getByRole("button", { current: true }).querySelector(".pname")!.textContent).toBe(o.list.sessions[0]!.project);
  });

  it("counts in the rail's footer the sessions that need the user as the tab title does, apart from the working ones", async () => {
    show("", { app: true }); // one approval wait, one your turn, two thinking, one idle and one ended
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(rail.querySelector(".foot")!.textContent).toMatch(/^2 sessions working · 2 waiting for you · /);
    expect(document.title).toBe("(2) Live · AI Ledger");
  });

  it("shows an ended session as ended in the rail, in the status strip and on the wall", async () => {
    show("?session=s5", { session: () => ({ ...s1, session_id: "s5", project: "notes", state: ended.state }) });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    const state = (await within(rail).findAllByRole("button")).find(b => b.querySelector(".pname")!.textContent === "notes")!.querySelector(".state")!;
    expect([state.className, state.textContent]).toEqual(["state st-ended", "ended"]);
    await stream();
    const panel = strip();
    expect(panel.querySelector(".now")!.className).toBe("it now ended");
    expect(within(panel).getByText("session closed")).toBeTruthy();
    cleanup();
    show("?view=wall");
    const el = await wall();
    expect(within(el).getByRole("button", { name: "Pin notes" }).className).toBe("panel tile st-ended");
  });

  it("counts an ended session as neither working nor waiting for you", async () => {
    show("?session=s5", { list: { ...list, sessions: [ended] } });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(rail.querySelector(".foot")!.textContent).toMatch(/^0 sessions working · \$/);
  });

  it("hides Follow on the wall", async () => {
    show("?view=wall");
    await wall();
    expect(screen.queryByRole("checkbox", { name: "Follow" })).toBeNull();
  });

  it("turns Full text on with its banner and a text fetch, and is off after a reload", async () => {
    const { calls, r } = show();
    await stream();
    expect(screen.getByText(/11 words · turn on Full text/)).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Full text" }));
    expect(screen.getByRole("note").textContent).toContain("secrets included");
    await waitFor(() => expect(calls()).toContain("/api/live/session?id=s1&text=1"));
    expect(await screen.findByText("Add a fast ingest pass while the Live page is open")).toBeTruthy();
    r.unmount();
    show();
    await stream();
    expect((screen.getByRole("checkbox", { name: "Full text" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows a Codex session with the same rows", async () => {
    show("?session=" + codex.session_id, { session: () => codex });
    await stream();
    expect(await screen.findByRole("button", { name: /^exec_command/ })).toBeTruthy();
  });

  it("names a tile by its pin action and gives a screen reader all it shows, pinned or not", async () => {
    show("?view=wall");
    const el = await wall(), s = list.sessions.find(x => x.title === "Fast ingest pass while Live is open")!;
    const tile = within(el).getByRole("button", { name: "Pin Fast ingest pass while Live is open" });
    const said = () => tile.getAttribute("aria-description")!;
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    expect(said()).toMatch(new RegExp(`^Project ${s.project}\\. `));
    for (const part of ["Latest: Bash: git push origin feat/live-page", `${s.tools} tools`, "1 error", usd(s.cost), `Branch ${s.branch}`, "Claude Code", s.model!])
      expect(said()).toContain(part);
    expect(said()).toContain(`Context ${pct(s.context! / s.window!)}`);
    expect(said()).toContain(stateText(stateNow(s.state, Date.parse(list.now)), Date.parse(list.now)).label.split(" ")[0]!);
    // Without a title the project names the tile, so the description does not say it again.
    expect(within(el).getByRole("button", { name: "Pin dotfiles" }).getAttribute("aria-description")).not.toMatch(/^Project/);
    await userEvent.click(tile);
    expect([tile.getAttribute("aria-pressed"), within(el).getByRole("button", { name: "Pin Fast ingest pass while Live is open" })]).toEqual(["true", tile]);
  });

  it("shows every active session on the wall, pins one beside the tiles, and opens it in the stream", async () => {
    const { calls } = show("?view=wall");
    const el = await wall();
    const tiles = within(el).getAllByRole("button");
    expect(tiles.length).toBe(list.sessions.length);
    const foo = within(el).getByRole("button", { name: "Pin Fast ingest pass while Live is open" });
    expect(foo.querySelector(".ttl")!.getAttribute("title")).toBe("Fast ingest pass while Live is open");
    expect(within(el).getByRole("button", { name: "Pin dotfiles" }).querySelector(".ttl")).toBeNull();
    expect(foo.textContent).toContain("git push origin feat/live-page");
    expect(foo.textContent).toContain("1 error"); // one, singular
    expect(foo.textContent).not.toContain("1 errors");
    await settle();
    expect(calls().filter(u => u.startsWith("/api/live/session"))).toEqual([]); // the Wall shows no stream session
    const graft = within(el).getByRole("button", { name: "Pin graft" });
    expect(graft.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(graft);
    expect(location.search).toBe("?view=wall&pin=0a0f7777-0000-7000-8000-000000000007"); // the Wall stays
    expect(graft.getAttribute("aria-pressed")).toBe("true");
    expect(graft.textContent).toContain("Pinned"); // in words, not only by its frame
    const pin = await screen.findByRole("region", { name: "Pinned: graft" });
    expect(await within(pin).findByLabelText("Session events")).toBeTruthy();
    expect(within(pin).getByRole("group", { name: "Session status" })).toBeTruthy();
    expect(within(pin).getByRole("group", { name: "Stream filters" })).toBeTruthy();
    expect(document.querySelector(".pg-live > .sr[role=status]")!.textContent).toBe("Pinned graft.");
    await userEvent.click(within(pin).getByRole("button", { name: "Open in Stream" }));
    expect(location.search).toBe("?pin=0a0f7777-0000-7000-8000-000000000007&session=0a0f7777-0000-7000-8000-000000000007"); // the pins wait for the Wall
    expect(await stream()).toBeTruthy();
  });

  it("pins by keyboard, keeps two pins at most, replacing the oldest with an announcement, and unpins", async () => {
    show("?view=wall");
    const el = await wall();
    const tile = (name: string) => within(el).getByRole("button", { name: "Pin " + name });
    const pinned = () => screen.queryAllByRole("region", { name: /^Pinned: / }).map(r => r.getAttribute("aria-label"));
    const note = () => document.querySelector(".pg-live > .sr[role=status]")!.textContent;
    const url = () => decodeURIComponent(location.search); // the comma is written %2C
    tile("notes").focus();
    await userEvent.keyboard("{Enter}");
    tile("jobdesk").focus();
    await userEvent.keyboard(" ");
    expect([url(), pinned()]).toEqual(["?view=wall&pin=s5,s2", ["Pinned: notes", "Pinned: jobdesk"]]);
    await userEvent.click(tile("dotfiles"));
    expect([url(), pinned()]).toEqual(["?view=wall&pin=s2,s4", ["Pinned: jobdesk", "Pinned: dotfiles"]]);
    expect(note()).toBe("Pinned dotfiles. Unpinned notes: 2 pins at most.");
    expect(tile("notes").getAttribute("aria-pressed")).toBe("false");
    // Unpin from the stream's own button: the focus goes to the session's tile, which stays on the Wall.
    await userEvent.click(within(screen.getByRole("region", { name: "Pinned: jobdesk" })).getByRole("button", { name: "Unpin jobdesk" }));
    expect([url(), pinned(), note()]).toEqual(["?view=wall&pin=s4", ["Pinned: dotfiles"], "Unpinned jobdesk."]);
    await waitFor(() => expect(document.activeElement).toBe(tile("jobdesk")));
    await userEvent.click(tile("dotfiles")); // the tile toggles its pin
    expect([url(), pinned()]).toEqual(["?view=wall", []]);
  });

  it("opens the Wall with the URL's pins, oldest first, and leaves out what is not a pin", async () => {
    show("?view=wall&pin=s3,s1,bad%20id");
    await wall();
    await waitFor(() => expect(screen.getAllByRole("region", { name: /^Pinned: / }).map(r => r.getAttribute("aria-label")))
      .toEqual(["Pinned: Rename the theme tokens across every page, the charts and the print stylesheet", "Pinned: Fast ingest pass while Live is open"]));
    expect(decodeURIComponent(location.search)).toBe("?view=wall&pin=s3,s1,bad id"); // read as it is, written anew on the next pin
  });

  it("says an unknown pin is not found, keeps it removable, and survives Full text whatever its id", async () => {
    show("?view=wall&pin=constructor", { session: () => undefined }); // an id an object would answer with its own
    const pin = await screen.findByRole("region", { name: "Pinned: session" });
    expect(await within(pin).findByText(/^Session not found\./)).toBeTruthy();
    expect(within(pin).queryByText(/HTTP 404/)).toBeNull();
    await userEvent.click(check("Full text"));
    await settle();
    expect(within(screen.getByRole("region", { name: "Pinned: session" })).getByText(/^Session not found\./)).toBeTruthy();
    await userEvent.click(within(pin).getByRole("button", { name: "Unpin session" }));
    expect(location.search).toBe("?view=wall");
    // No tile and no other pin to go to: the first tile takes the focus.
    const el = await wall();
    await waitFor(() => expect(document.activeElement).toBe(el.querySelector("[data-session]")));
  });

  it("hands the focus on from a pin whose session left the list: to the other pin, then to the tile", async () => {
    show("?view=wall&pin=gone,s2", { session: q => ({ ...s1, session_id: q.get("id")!, title: q.get("id") === "gone" ? "Gone session" : "Other" }) });
    const el = await wall();
    const gone = await screen.findByRole("region", { name: "Pinned: Gone session" });
    await within(gone).findByLabelText("Session events");
    await userEvent.click(within(gone).getByRole("button", { name: "Unpin Gone session" }));
    const other = screen.getAllByRole("region", { name: /^Pinned: / });
    expect(other.map(r => r.dataset.pin)).toEqual(["s2"]);
    await waitFor(() => expect(document.activeElement).toBe(within(other[0]!).getByRole("button", { name: "Open in Stream" })));
    await userEvent.click(within(other[0]!).getByRole("button", { name: /^Unpin / }));
    await waitFor(() => expect(document.activeElement).toBe([...el.querySelectorAll<HTMLElement>("[data-session]")].find(b => b.dataset.session === "s2")));
  });

  it("moves the focus into the stream on Open in Stream", async () => {
    show("?view=wall&pin=s1");
    const pin = await screen.findByRole("region", { name: /^Pinned: / });
    await within(pin).findByLabelText("Session events");
    await userEvent.click(within(pin).getByRole("button", { name: "Open in Stream" }));
    const region = await stream();
    await waitFor(() => expect(document.activeElement).toBe(region.querySelector(".stream-head h2")));
  });

  it("shows the empty state on the Wall with no active session, whatever session the URL keeps from the Stream view", async () => {
    show("?view=wall&session=s1", { list: { ...list, sessions: [] } });
    expect(await screen.findByText(/No session is active in this view/)).toBeTruthy();
  });

  it("says once that a session failed to load, in its panel, with nothing of it to show", async () => {
    const { f } = show();
    await stream();
    const normal = f.getMockImplementation()!;
    f.mockImplementation(((input: string) => (input.startsWith("/api/live/session") ? Promise.resolve({ ok: false, status: 500 } as Response) : normal(input))) as typeof normal);
    await userEvent.click(await entry("jobdesk")); // a session the page holds nothing of
    const region = screen.getByRole("region", { name: "Session" });
    expect(await within(region).findByText("Could not load this session. HTTP 500")).toBeTruthy();
    expect([screen.queryByText("Loading…"), screen.queryByText(/^Could not load\.$/), screen.getAllByRole("alert").length]).toEqual([null, null, 1]);
  });

  it("marks a pin busy while it loads, and says a failed update while it keeps what it showed", async () => {
    const { f } = show("?view=wall");
    const el = await wall();
    const late = lateAnswers(f);
    await userEvent.click(within(el).getByRole("button", { name: "Pin jobdesk" }));
    const pin = await screen.findByRole("region", { name: "Pinned: jobdesk" });
    expect([pin.getAttribute("aria-busy"), within(pin).getByText("Loading…")]).toEqual(["true", expect.anything()]);
    await late.answer();
    await within(pin).findByLabelText("Session events");
    expect(pin.getAttribute("aria-busy")).toBeNull();
    const normal = f.getMockImplementation()!;
    f.mockImplementation(((input: string) => (input.startsWith("/api/live/session") ? Promise.resolve({ ok: false, status: 500 } as Response)
      : normal(input))) as typeof normal);
    FakeSource.last!.notify(["s2"]);
    expect((await within(pin).findByRole("alert")).textContent).toBe("Could not update this session. HTTP 500");
    expect(within(pin).getByLabelText("Session events")).toBeTruthy(); // still shown
  });

  it("keeps each pin's filters and Follow its own", async () => {
    let more = false;
    const late = { ...s1.events.find(e => e.k === "prompt")!, key: "late#0", ts: "2026-11-10T10:00:59.000Z" };
    show("?view=wall&pin=s1,s2", { session: q => {
      const id = q.get("id")!, base = id === "s1" ? s1 : { ...s1, session_id: id, project: "jobdesk" };
      return more ? { ...base, events: [...base.events, late] } : base;
    } });
    await wall();
    const pinOf = (id: string) => document.querySelector<HTMLElement>(`.pin[data-pin="${id}"]`)!;
    await within(pinOf("s1")).findByLabelText("Session events");
    await within(pinOf("s2")).findByLabelText("Session events");
    const main = (id: string) => (within(pinOf(id)).getByRole("checkbox", { name: "Main thread only" }) as HTMLInputElement).checked;
    await userEvent.click(within(pinOf("s1")).getByRole("checkbox", { name: "Main thread only" }));
    expect([main("s1"), main("s2")]).toEqual([true, false]);
    await userEvent.click(within(pinOf("s2")).getAllByRole("button", { name: /^Read/ })[0]!); // opening a row turns s2's Follow off
    more = true;
    FakeSource.last!.notify(["s1", "s2"]);
    await waitFor(() => expect(within(pinOf("s2")).getByRole("button", { name: "Jump to latest ↓" })).toBeTruthy());
    expect(within(pinOf("s1")).queryByRole("button", { name: "Jump to latest ↓" })).toBeNull(); // s1 still follows
  });

  it("opens a pin's session sheet over the Wall, with the pins mounted and one notice stream", async () => {
    show("?view=wall&pin=s1,s2", { app: true });
    await wall();
    const source = FakeSource.last!, made = FakeSource.made;
    source.open();
    const pin = document.querySelector<HTMLElement>('.pin[data-pin="s1"]')!;
    await within(pin).findByLabelText("Session events");
    const box = within(pin).getByLabelText("Session events");
    await userEvent.click(within(pin).getByRole("link", { name: "Session sheet" }));
    const dlg = await screen.findByRole("dialog");
    expect([box.isConnected, document.querySelectorAll(".pin").length]).toEqual([true, 2]); // nothing remounted under the sheet
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    expect([box.isConnected, FakeSource.made, FakeSource.last, source.closed]).toEqual([true, made, source, false]);
  });

  it("keeps one notice stream through pinning, unpinning, Stream and Wall and a sheet, and refetches a pinned session it names", async () => {
    const { calls } = show("?view=wall", { app: true });
    const el = await wall();
    const made = FakeSource.made, source = FakeSource.last!;
    source.open();
    await userEvent.click(within(el).getByRole("button", { name: "Pin notes" }));
    await userEvent.click(within(el).getByRole("button", { name: "Pin jobdesk" }));
    const pin = await screen.findByRole("region", { name: "Pinned: notes" });
    await within(pin).findByLabelText("Session events");
    await settle();
    const before = calls().length;
    source.notify(["s5"]);
    await settle();
    expect(calls().slice(before).filter(u => u.startsWith("/api/live/session"))).toEqual([expect.stringMatching(/^\/api\/live\/session\?id=s5&after=/)]);
    await userEvent.click(within(el).getByRole("button", { name: "Pin notes" })); // unpin
    // A sheet over the Wall: the session sheet of a pinned stream, from its strip's Session sheet link in the Stream view.
    await userEvent.click(screen.getByRole("button", { name: "Stream" }));
    await userEvent.click(await within(await stream()).findByRole("link", { name: "Session sheet" }));
    const dlg = await screen.findByRole("dialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Wall" }));
    await wall();
    expect([FakeSource.made, FakeSource.last, source.closed]).toEqual([made, source, false]);
  });

  it("shows each rail entry's context, latest action and errors on a third line", async () => {
    show();
    await stream();
    const r = await rail();
    const third = (id: string) => within(r).getAllByRole("button").find(b => b.dataset.session === id)!.querySelector(".third")!;
    const foo = third("s1");
    expect(foo.querySelector(".act")!.textContent).toBe("Bash · git push origin feat/live-page");
    expect(foo.querySelector(".errs")!.textContent).toBe("✕ 11 error"); // ✕ 1 shown, "1 error" for a screen reader
    expect(foo.querySelector(".errs [aria-hidden]")!.textContent).toBe("✕ 1");
    expect(foo.querySelector(".ctx")!.textContent).toBe("context 0%");
    expect(third("0a0f7777-0000-7000-8000-000000000007").querySelector(".ctx")!.textContent).toBe("context 8%");
    expect(third("s2").querySelector(".errs")).toBeNull(); // none to count
    expect(third("s4").querySelector(".ctx")).toBeNull(); // no known window
    expect(third("s2").querySelector(".act")!.textContent).toBe("▸ prompt");
  });

  it("opens the Full text warning over the page, so the stream keeps its place, and dismisses it in place", async () => {
    show();
    const region = await stream();
    const grid = region.closest(".grid")!, before = () => [...document.querySelector(".pg-live")!.children].map(c => c.className);
    const shape = before();
    await userEvent.click(check("Full text"));
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("secrets included");
    expect(note.parentElement!.className).toBe("top"); // inside the bar, which it overlays: no block before the grid
    expect([before(), grid.isConnected, check("Full text").closest("label")!.className]).toEqual([shape, true, "chk ft on"]);
    within(note).getByRole("button", { name: "Dismiss" }).focus();
    await userEvent.keyboard("{Enter}");
    expect([screen.queryByRole("note"), check("Full text").checked, check("Full text").closest("label")!.className]).toEqual([null, true, "chk ft on"]);
    expect(document.activeElement).toBe(check("Full text")); // the focus goes back to the control the note is about
    await userEvent.click(check("Full text"));
    await userEvent.click(check("Full text"));
    expect(screen.getByRole("note")).toBeTruthy(); // it opens again each time Full text is turned on
  });
});

describe("Live in a background tab", () => {
  const clock = () => fakeClock("2026-11-10T10:00:25.000Z");
  const flush = (ms = 10) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  /** The init each fetch got, by URL path: Query's abort signal, and the low priority of a background request. */
  const inits = (f: ReturnType<typeof show>["f"], path: string) => f.mock.calls.filter(c => String(c[0]).startsWith(path)).map(c => (c as unknown[])[1]);
  const own = { signal: expect.any(AbortSignal) }, low = { priority: "low", ...own };

  it("closes the notice stream, stops the timers and requests while hidden, and fetches once on return", async () => {
    clock();
    const { f, calls, polls } = show();
    await flush();
    const first = FakeSource.last!;
    first.open();
    const n = calls().length;
    setHidden(true);
    expect(first.closed).toBe(true); // the app stops ingesting every second for a page nobody sees
    await flush(60_000);
    expect([calls().length, polls()]).toEqual([n, 0]); // no recheck, no status request
    expect(FakeSource.last).toBe(first);
    setHidden(false);
    await flush();
    expect(calls().length).toBe(n + 2); // the list and the session, once
    expect(polls()).toBe(1);
    expect(inits(f, "/api/live").slice(2)).toEqual([own, own]); // on return they are the page's own requests, at normal priority
    expect(FakeSource.last).not.toBe(first); // and the stream is open again
    expect(FakeSource.last!.closed).toBe(false);
    FakeSource.last!.open();
    expect(conn().textContent).toBe("Updating live");
    await flush(10_000); // the recheck runs again
    expect(calls().length).toBe(n + 4);
    await flush(10_000);
    expect(calls().length).toBe(n + 6);
  });

  it("sends the timer's recheck and the status polls at low priority, and the page's own requests at normal priority", async () => {
    clock();
    const { f, calls } = show();
    await flush();
    FakeSource.last!.open();
    expect(inits(f, "/api/live")).toEqual([own, own]); // the first load of the list and of the session
    FakeSource.last!.notify(["s1"]);
    await flush();
    expect(inits(f, "/api/live")).toEqual([own, own, own, own]); // a notice is news the user waits on
    expect(inits(f, "/api/status")).toEqual([low]);
    const n = calls().length;
    await flush(10_000);
    expect(calls().length).toBe(n + 2);
    expect(inits(f, "/api/live").slice(-2)).toEqual([low, low]);
    FakeSource.last!.notify(["s1"]);
    await flush();
    expect(inits(f, "/api/live").slice(-2)).toEqual([own, own]); // a notice after a recheck is the page's own request again
  });

  it("stops the clock while hidden and shows the real elapsed time on return", async () => {
    clock();
    show();
    await flush();
    const push = () => within(toolRow("Bash", 1));
    expect(push().getByText("3.0s")).toBeTruthy();
    setHidden(true);
    await flush(30_000);
    expect(push().getByText("3.0s")).toBeTruthy(); // no tick drew meanwhile
    setHidden(false);
    await flush();
    expect(push().getByText("33s")).toBeTruthy();
    await flush(2000);
    expect(push().getByText("35s")).toBeTruthy();
  });

  it("stays paused through a hidden tab, and holds what the closed stream missed for Resume", async () => {
    clock();
    const { calls, polls } = show();
    await flush();
    FakeSource.last!.open();
    fireEvent.click(screen.getByRole("button", { name: "Pause" })); // not userEvent: it waits on a setTimeout, faked here
    const n = calls().length;
    setHidden(true);
    setHidden(false);
    await flush(30_000);
    expect([calls().length, polls(), conn().textContent]).toEqual([n, 0, "Paused · 1 update held"]);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await flush();
    expect(calls().length).toBe(n + 2);
  });

  it("drops the request owed to a notice when the tab is hidden before it is sent, and fetches once on return", async () => {
    const { f } = show();
    await stream();
    const { urls, waiting, answer } = lateAnswers(f);
    FakeSource.last!.notify(["s1"]);
    FakeSource.last!.notify(["s1"]); // one more owed, for the list and for the session
    setHidden(true);
    await answer();
    expect([urls().length, waiting()]).toEqual([2, 0]);
    setHidden(false);
    await settle();
    expect([urls().slice(2), waiting()]).toEqual([["/api/live", catchUp], 2]);
    await answer();
    expect([urls().length, waiting()]).toEqual([4, 0]);
  });

  it("draws finished rows once: a tick formats no date for them", async () => {
    clock();
    const done = s1.events.find(e => e.k === "tool" && e.end != null && !e.lane) as LiveToolEvent;
    const many = { ...s1, events: [...s1.events, ...Array.from({ length: 300 }, (_, i) => ({ ...done, key: `m${i}#0`, id: `m${i}` }))] };
    show("?session=s1", { session: () => many });
    await flush();
    expect(document.querySelectorAll(".stream .ev").length).toBeGreaterThan(300);
    const day = vi.spyOn(Date.prototype, "toDateString");
    await flush(3000); // three ticks
    expect(day.mock.calls.length).toBeLessThanOrEqual(3); // the stream's key for the day, not two per row
  });
});
