import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LivePayload, LiveSession, LiveToolEvent } from "../../api";
import live from "../../__fixtures__/live";
import liveListText from "../../__fixtures__/live-text";
import liveSession from "../../__fixtures__/live-session";
import liveText from "../../__fixtures__/live-session-text";
import liveCodex from "../../__fixtures__/live-session-codex";
import { mockApi } from "../../components/sheets/testing";
import { LivePage } from "./LivePage";
import { mergeSession, streamRows } from "./live";
import { FakeSource } from "./testing";

const list = live as LivePayload, listText = liveListText as LivePayload, s1 = liveSession as LiveSession, s1text = liveText as LiveSession, codex = liveCodex as LiveSession;

function show(hash = "#session=s1", o: { list?: LivePayload; session?: (q: URLSearchParams) => LiveSession | undefined } = {}) {
  const f = mockApi({
    "/api/live": q => o.list ?? (q.get("text") ? listText : list),
    "/api/live/session": q => (o.session ? o.session(q) : q.get("id") === "s1" ? (q.get("text") ? s1text : s1) : { ...s1, session_id: q.get("id")!, project: "jobdesk" }),
  });
  history.replaceState(null, "", "/live" + hash);
  const r = render(<LivePage />);
  return { f, r, calls: () => f.mock.calls.map(c => String(c[0])) };
}
const stream = () => screen.findByRole("region", { name: "Session" });
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

  it("places a tied lane after its call and leaves requests out", () => {
    const rows = streamRows(s1.events, s1.lanes);
    const at = rows.findIndex(r => r.kind === "event" && r.e.k === "tool" && r.e.id === "t2");
    expect(rows[at + 1]).toMatchObject({ kind: "lane", lane: { id: "a7" } });
    expect(rows.some(r => r.kind === "event" && r.e.k === "request")).toBe(false);
  });
});

describe("LivePage", () => {
  it("lists the active sessions and opens the newest when the URL names none", async () => {
    const { calls } = show("");
    const rail = await screen.findByRole("region", { name: "Active sessions" });
    expect(within(rail).getAllByRole("button").map(b => b.querySelector(".pname")!.textContent)).toEqual(["jobdesk", "sketchbook", "graft", "foo", "dotfiles"]);
    await waitFor(() => expect(calls()).toContain("/api/live/session?id=s2"));
    expect(within(rail).getAllByRole("button")[0]!.getAttribute("aria-current")).toBe("true");
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
    show("#session=gone", { list: { ...list, sessions: list.sessions.filter(s => s.session_id !== "s1") }, session: () => ({ ...s1, session_id: "gone", state: { kind: "idle", tool: null, since: s1.last_ts, inferred: false } }) });
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
    const lane = screen.getByRole("button", { name: /find callers of ingest/ });
    expect(screen.getAllByRole("button", { name: /^Grep/ }).length).toBe(3);
    await userEvent.click(lane);
    expect(screen.queryAllByRole("button", { name: /^Grep/ }).length).toBe(0);
    expect(lane.textContent).toContain("3 tools");
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
    const wall = await screen.findByRole("list", { name: "Active sessions" });
    const tiles = within(wall).getAllByRole("button");
    expect(tiles.length).toBe(list.sessions.length);
    const foo = within(wall).getByRole("button", { name: "Open Fast ingest pass while Live is open" });
    expect(foo.querySelector(".ttl")!.getAttribute("title")).toBe("Fast ingest pass while Live is open");
    expect(within(wall).getByRole("button", { name: "Open dotfiles" }).querySelector(".ttl")).toBeNull();
    expect(foo.textContent).toContain("git push origin feat/live-page");
    expect(foo.textContent).toContain("1 errors");
    await userEvent.click(within(wall).getByRole("button", { name: "Open graft" }));
    expect(location.hash).toBe("#session=0a0f7777-0000-7000-8000-000000000007");
    expect(await stream()).toBeTruthy();
  });
});
