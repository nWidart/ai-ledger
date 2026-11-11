import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LivePayload, LiveSession, LiveState, LiveToolEvent } from "../../api";
import live from "../../__fixtures__/live";
import liveListText from "../../__fixtures__/live-text";
import liveSession from "../../__fixtures__/live-session";
import liveText from "../../__fixtures__/live-session-text";
import liveCodex from "../../__fixtures__/live-session-codex";
import { mockApi } from "../../components/sheets/testing";
import { App } from "../../App";
import { LivePage } from "./LivePage";
import { groupSessions, lanesOf, likelyWaiting, mergeSession, stateNow, stateText, streamRows } from "./live";
import { FakeSource } from "./testing";

const list = live as LivePayload, listText = liveListText as LivePayload, s1 = liveSession as LiveSession, s1text = liveText as LiveSession, codex = liveCodex as LiveSession;

const status = { ingesting: false, last_ingest: "2026-11-10T10:00:00+00:00", last_change: "2026-11-10T10:00:00+00:00", last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
type Opts = { list?: LivePayload; session?: (q: URLSearchParams) => LiveSession | undefined; status?: () => unknown; app?: boolean };

/** The page alone, or inside the app (o.app) for what the nav and the tab title show. calls leaves the status polls out;
 *  polls counts them. */
function show(hash = "#session=s1", o: Opts = {}) {
  const f = mockApi({
    "/api/live": q => o.list ?? (q.get("text") ? listText : list),
    "/api/live/session": q => (o.session ? o.session(q) : q.get("id") === "s1" ? (q.get("text") ? s1text : s1) : { ...s1, session_id: q.get("id")!, project: "jobdesk" }),
    "/api/status": () => (o.status ? o.status() : status),
  });
  history.replaceState(null, "", "/live" + hash);
  const r = render(o.app ? <App /> : <LivePage />);
  const urls = () => f.mock.calls.map(c => String(c[0]));
  return { f, r, calls: () => urls().filter(u => u !== "/api/status"), polls: () => urls().filter(u => u === "/api/status").length };
}
const stream = () => screen.findByRole("region", { name: "Session" });
const rail = () => screen.findByRole("region", { name: "Active sessions" });
const wall = rail; // the wall takes the rail's place, under the same name
/** The rail or the wall as text: each group's heading, then its sessions' projects. */
const groups = (el: HTMLElement) => [...el.querySelectorAll("h3")].map(h =>
  [h.textContent, ...[...h.nextElementSibling!.querySelectorAll("button")].map(b => b.querySelector(".pname")!.textContent)].join(" "));
/** A list session of the given state that started at `first`. */
const sess = (id: string, kind: LiveState["kind"], first: string, since = first) => ({ ...list.sessions[0]!, session_id: id, project: id, title: null,
  first_ts: first, last_ts: since, state: { kind, tool: kind === "tool" || kind === "wait" ? "Bash" : null, since, inferred: kind === "wait", long: kind === "tool" } });
const fakeClock = (at: string) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(Date.parse(at));
};
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const ended = list.sessions.find(s => s.state.kind === "ended")!;
const toolRow = (name: string, nth = 0) => screen.getAllByRole("button", { name: new RegExp("^" + name) })[nth]!;

afterEach(() => { vi.useRealTimers(); });

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
    expect(new Set(texts.map(t => t.detail)).size).toBe(3);
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
  it("lists the active sessions and opens the newest when the URL names none", async () => {
    const { calls } = show("");
    expect(groups(await rail())).toEqual(["approval? · 1 foo", "your turn · 1 sketchbook", "working · 2 graft jobdesk", "idle · 1 dotfiles", "ended · 1 notes"]);
    await waitFor(() => expect(calls()).toContain("/api/live/session?id=s2")); // the one that wrote last, wherever its group puts it
    expect(screen.getByRole("button", { current: true }).querySelector(".pname")!.textContent).toBe("jobdesk");
  });

  it("keeps the rail's order through a write, a state change and a new session", async () => {
    const a = sess("a", "tool", "2026-11-10T09:00:00.000Z"), b = sess("b", "tool", "2026-11-10T09:30:00.000Z"), c = sess("c", "tool", "2026-11-10T09:45:00.000Z");
    const o = { list: { ...list, sessions: [b, a] } }; // b wrote last
    show("#session=a", o);
    const el = await rail(), after = async (sessions: typeof o.list.sessions, want: string[]) => {
      o.list = { ...list, sessions };
      FakeSource.last!.notify(null);
      await waitFor(() => expect(groups(el)).toEqual(want));
    };
    expect(groups(el)).toEqual(["working · 2 a b"]);
    await after([a, b], ["working · 2 a b"]); // a wrote: no entry moves
    await after([c, a, b], ["working · 3 a b c"]); // a new session joins the end of its group
    await after([{ ...b, state: sess("b", "you", b.first_ts).state }, c, a], ["your turn · 1 b", "working · 2 a c"]); // only b moves
  });

  it("shows how long a session has been on your turn or thinking, counting up with the clock", async () => {
    fakeClock("2026-11-10T10:04:00.000Z");
    const o = { list: { ...list, sessions: [sess("a", "you", "2026-11-10T09:00:00.000Z", "2026-11-10T10:00:00.000Z"), sess("b", "thinking", "2026-11-10T09:10:00.000Z", "2026-11-10T10:03:48.000Z")] } };
    show("#session=a", o);
    await tick(10);
    const states = () => [...screen.getByRole("region", { name: "Active sessions" }).querySelectorAll(".state")].map(s => s.textContent);
    expect(states()).toEqual(["your turn 4m 00s", "thinking 12s"]);
    await tick(1000);
    expect(states()).toEqual(["your turn 4m 01s", "thinking 13s"]);
    cleanup();
    show("#view=wall", o);
    await tick(10);
    expect(states()).toEqual(["your turn 4m 01s", "thinking 13s"]);
  });

  it("groups the wall as the rail, and frames the tiles that need the user", async () => {
    const at = "2026-11-10T09:00:00.000Z";
    show("#view=wall", { list: { ...list, sessions: [sess("r2", "tool", "2026-11-10T09:30:00.000Z"), sess("w", "wait", at), sess("r1", "tool", at), sess("y", "you", at)] } });
    const el = await wall();
    await waitFor(() => expect(groups(el)).toEqual(["approval? · 1 w", "your turn · 1 y", "working · 2 r1 r2"]));
    expect(within(el).getAllByRole("list").map(l => l.getAttribute("aria-label"))).toEqual(["approval?", "your turn", "working"]);
    expect(within(el).getByRole("button", { name: "Open y" }).className).toBe("panel tile st-you"); // .tile.st-you has the border
    expect(within(el).getByRole("button", { name: "Open w" }).className).toBe("panel tile st-wait");
  });

  it("counts the sessions that need the user in the tab title, and gives the title back on leaving", async () => {
    const at = "2026-11-10T09:00:00.000Z", o = { app: true, list: { ...list, sessions: [sess("w", "wait", at), sess("y", "you", at), sess("r", "tool", at), sess("e", "ended", at)] } };
    show("#session=w", o);
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
    show("#session=s", { app: true, list: { ...list, sessions: [{ ...slow, state: { ...slow.state, long: false } }] } });
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
    show("#session=a", { list: two });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    const entries = within(rail).getAllByRole("button");
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

  it("titles the stream with the session's title, and only the project without one", async () => {
    show();
    const main = await stream();
    expect(within(main).getByRole("heading", { level: 2 }).textContent).toBe("Fast ingest pass while Live is open");
    cleanup();
    show("#session=" + codex.session_id, { session: () => codex });
    const other = await stream();
    expect(await within(other).findByRole("button", { name: /^exec_command/ })).toBeTruthy();
    expect(within(other).queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("follows the URL's session, and still shows one that is no longer active", async () => {
    show("#session=gone", { list: { ...list, sessions: list.sessions.filter(s => s.session_id !== "s1") }, session: () => ({ ...s1, session_id: "gone", state: { kind: "idle", tool: null, since: s1.last_ts, inferred: false, long: false } }) });
    const main = await stream();
    expect(await within(main).findByText(/^idle/)).toBeTruthy();
  });

  it("says no session is active and links the newest one to Activity", async () => {
    show("", { list: { now: list.now, sessions: [], newest: { session_id: "s4", project: "dotfiles", last_ts: "2026-11-10T09:53:00.000Z" } } });
    const lede = await screen.findByText(/No session is active/);
    expect(within(lede).getByRole("link", { name: "dotfiles" }).getAttribute("href")).toBe("/usage#range=0&session=s4");
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
    const lane = screen.getByRole("button", { name: /^Agent find callers of ingest/ });
    expect(screen.getAllByRole("button", { name: /^Grep/ }).length).toBe(3);
    await userEvent.click(lane);
    expect(screen.queryAllByRole("button", { name: /^Grep/ }).length).toBe(0);
    expect(lane.textContent).toContain("3 tools");
  });

  it("keeps the lanes and their rows when a catch-up brings only a main-thread event", async () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    let next: LiveSession | undefined;
    show("#session=s1", { session: q => (q.get("after") && next ? next : s1) });
    await stream();
    expect(screen.getAllByRole("button", { name: /^Grep/ }).length).toBe(3);
    next = { ...s1, events: [{ ...main, key: "z#0", id: "t9", summary: "ls" }], cursor: "c2" };
    FakeSource.last!.notify(["s1"]);
    expect(await screen.findByRole("button", { name: /^Readls/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Grep/ }).length).toBe(3);
    expect(screen.getByRole("button", { name: /^Agent find callers of ingest/ }).textContent).toContain("3 tools");
  });

  it("names an MCP tool by its tool part, with the full name on hover", async () => {
    const main = s1.events.find(e => e.k === "tool" && !e.lane) as LiveToolEvent;
    show("#session=s1", { session: () => ({ ...s1, events: [{ ...main, tool: "mcp__docs__search_pages" }] }) });
    const row = await screen.findByRole("button", { name: /^search_pages/ });
    expect(row.querySelector(".nm")!.getAttribute("title")).toBe("mcp__docs__search_pages");
  });

  it("ticks a running call's timer every second and flags a slow shell call", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(Date.parse("2026-11-10T10:00:25.000Z"));
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
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(Date.parse("2026-11-10T10:01:30.000Z"));
    const long = { ...s1, state: { ...s1.state, kind: "tool" as const, inferred: false, long: true },
      events: s1.events.map(e => (e.k === "tool" && e.end == null ? { ...e, long: true } : e)) };
    show("#session=s1", { session: () => long });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(toolRow("Bash", 1).className).toBe("tool running");
    const panel = screen.getByRole("complementary", { name: "Agent" });
    expect(within(panel).queryByText(/approval\?/)).toBeNull();
    expect(within(panel).getByText("Bash running for 1m 08s")).toBeTruthy();
  });

  it("opens a failed call's detail in place with the error and the result size only", async () => {
    show();
    await stream();
    await userEvent.click(toolRow("Bash", 0));
    const detail = toolRow("Bash", 0).nextElementSibling!;
    expect(detail.textContent).toContain("uv run python -m unittest");
    expect(detail.textContent).toContain("FAIL: test_hot_pass");
    expect(detail.textContent).toContain("characters · turn on Full text to read it");
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(false);
  });

  it("stops following on scroll-up and offers Jump to latest when new events arrive", async () => {
    const more = { ...s1, events: [...s1.events, { ...(s1.events.at(-1) as LiveToolEvent), key: "n#0", id: "t10", summary: "ls" }], cursor: "c3" };
    let fresh = false;
    show("#session=s1", { session: () => (fresh ? more : s1) });
    const box = await screen.findByRole("region", { name: "Session events" }).catch(() => screen.findByLabelText("Session events"));
    Object.defineProperty(box, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(box, "clientHeight", { value: 400, configurable: true });
    box.scrollTop = 100;
    fireEvent.scroll(box);
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(false);
    fresh = true;
    FakeSource.last!.notify(["s1"]);
    const jump = await screen.findByRole("button", { name: "Jump to latest ↓" });
    await userEvent.click(jump);
    expect((screen.getByRole("checkbox", { name: "Follow" }) as HTMLInputElement).checked).toBe(true);
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

  it("shows reconnecting when the stream drops, then catches up", async () => {
    const { calls } = show();
    await stream();
    FakeSource.last!.open();
    FakeSource.last!.drop();
    expect(screen.getByRole("status").textContent).toBe("Connection lost · reconnecting…");
    const n = calls().length;
    FakeSource.last!.open();
    expect(screen.getByRole("status").textContent).toBe("Updating live");
    await waitFor(() => expect(calls().length).toBeGreaterThanOrEqual(n + 2));
  });

  it("opens a new stream after an HTTP error closed it, at 1 s, 2 s and 4 s, and starts over after a success", async () => {
    fakeClock("2026-11-10T10:01:00.000Z");
    const { calls } = show();
    await tick(10);
    const retried = async (ms: number) => {
      const was = FakeSource.last!;
      was.fail();
      expect([was.closed, screen.getByRole("status").textContent]).toEqual([true, "Connection lost · reconnecting…"]);
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
    expect(screen.getByRole("status").textContent).toBe("Updating live");
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
    expect([page.className, screen.getByRole("status").textContent]).toEqual(["wrap pg-live paused", "Paused"]);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect([page.className, screen.getByRole("status").textContent]).toEqual(["wrap pg-live", "Connecting…"]);
  });

  it("updates the nav's Last ingest on a change notice, without waiting for the nav's poll", async () => {
    const st = { ...status }, text = (ts: string) => `Last ingest ${new Date(ts).toLocaleTimeString()}`;
    show("#session=s1", { app: true, status: () => st });
    expect(await screen.findByText(text(st.last_ingest))).toBeTruthy();
    st.last_ingest = st.last_change = "2026-11-10T10:00:50+00:00";
    FakeSource.last!.notify(["s2"]);
    expect(await screen.findByText(text(st.last_ingest))).toBeTruthy();
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
    expect(screen.getByRole("status").textContent).toBe("Paused · 3 updates held");
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(calls().length).toBe(n + 2));
  });

  it("shows the agent panel: an inferred approval wait with its reason, the context and the figures", async () => {
    show();
    await stream();
    const panel = screen.getByRole("complementary", { name: "Agent" });
    expect(within(panel).getByText("approval?").closest(".state")!.textContent).toBe("approval? (inferred)");
    expect(within(panel).getByText(/transcripts record no permission prompt/)).toBeTruthy();
    expect(within(panel).getByRole("meter", { name: "Context used" }).className).toBe("meter");
    expect(within(panel).getByText("Errors").nextElementSibling!.textContent).toBe("1");
  });

  it("warns on a context above 80% and shows tokens only for an unknown window", async () => {
    let s = { ...s1, context: 850_000 };
    const { r } = show("#session=s1", { session: () => s });
    await stream();
    expect(screen.getByRole("meter", { name: "Context used" }).className).toBe("meter warn");
    r.unmount();
    s = { ...s1, context: 55_000, window: null };
    show("#session=s1", { session: () => s });
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

  it("links the note on older events to the session sheet", async () => {
    show("#session=s1", { session: () => ({ ...s1, truncated: true }) });
    await stream();
    expect(screen.getByRole("link", { name: "session sheet on Activity" }).getAttribute("href")).toBe("/usage#range=0&session=s1");
  });

  it("says a session is not found, with a way back to the active ones", async () => {
    show("#session=nope", { session: () => undefined });
    expect(await screen.findByText(/Session not found/)).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
    FakeSource.last!.notify(null); // a list load does not clear it
    await waitFor(() => expect(screen.getByText(/Session not found/)).toBeTruthy());
    await userEvent.click(screen.getByRole("link", { name: "Show the active sessions" }));
    expect(location.hash).toBe("");
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

  it("counts your-turn sessions apart from working ones in the rail's footer", async () => {
    show("");
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(rail.querySelector(".foot")!.textContent).toMatch(/^3 sessions working · 1 waiting for you · /);
  });

  it("shows an ended session as ended in the rail, in the agent panel and on the wall", async () => {
    show("#session=s5", { session: () => ({ ...s1, session_id: "s5", project: "notes", state: ended.state }) });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    const state = within(rail).getAllByRole("button").find(b => b.querySelector(".pname")!.textContent === "notes")!.querySelector(".state")!;
    expect([state.className, state.textContent]).toEqual(["state st-ended", "ended"]);
    await stream();
    const panel = screen.getByRole("complementary", { name: "Agent" });
    expect(panel.querySelector(".now")!.className).toBe("now ended");
    expect(within(panel).getByText("session closed")).toBeTruthy();
    cleanup();
    show("#view=wall");
    const el = await wall();
    expect(within(el).getByRole("button", { name: "Open notes" }).className).toBe("panel tile st-ended");
  });

  it("counts an ended session as neither working nor waiting for you", async () => {
    show("#session=s5", { list: { ...list, sessions: [ended] } });
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(rail.querySelector(".foot")!.textContent).toMatch(/^0 sessions working · \$/);
  });

  it("hides Follow on the wall", async () => {
    show("#view=wall");
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
    show("#session=" + codex.session_id, { session: () => codex });
    await stream();
    expect(await screen.findByRole("button", { name: /^exec_command/ })).toBeTruthy();
  });

  it("shows every active session on the wall and opens one in the stream", async () => {
    show("#view=wall");
    const el = await wall();
    const tiles = within(el).getAllByRole("button");
    expect(tiles.length).toBe(list.sessions.length);
    const foo = within(el).getByRole("button", { name: "Open Fast ingest pass while Live is open" });
    expect(foo.querySelector(".ttl")!.getAttribute("title")).toBe("Fast ingest pass while Live is open");
    expect(within(el).getByRole("button", { name: "Open dotfiles" }).querySelector(".ttl")).toBeNull();
    expect(foo.textContent).toContain("git push origin feat/live-page");
    expect(foo.textContent).toContain("1 errors");
    await userEvent.click(within(el).getByRole("button", { name: "Open graft" }));
    expect(location.hash).toBe("#session=0a0f7777-0000-7000-8000-000000000007");
    expect(await stream()).toBeTruthy();
  });
});
