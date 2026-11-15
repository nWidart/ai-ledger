import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasHue, setOrder } from "../colors";
import type { LimitsAlert } from "../api";
import { alertText, whenDay } from "../pages/limits/limits";
import { Nav } from "./Nav";
import { queries } from "../queries";
import { askedFor } from "./refresh";
import { renderApp, renderRouter } from "../testing";
import { useApi } from "../useApi";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import usage from "../__fixtures__/usage";
import sessions from "../__fixtures__/sessions";
import session from "../__fixtures__/session";
import limits from "../__fixtures__/limits";
import context from "../__fixtures__/context";
import insights from "../__fixtures__/insights";
import live from "../__fixtures__/live";
import liveSession from "../__fixtures__/live-session";

const status = { ingesting: false, last_ingest: "2026-11-05T12:00:00+00:00", last_change: "2026-11-05T12:00:00+00:00", last_stats: { files: 1, lines: 2, inserted: 2, seconds: 0.1 }, error: null, counts: {}, interval: 60, project_order: [] };
// What a status request asked from outside the nav is (Live's on a change notice): a fetch of the status query, which
// always goes out (staleTime 0). A failure is the answer null. Query tells its observers on a timer, so the helper waits one.
const flush = () => new Promise(r => setTimeout(r, 0));
const poll = (client: QueryClient) => act(async () => { await client.fetchQuery(queries.status).catch(() => null); await flush(); });
const view = { project: "", range: 30, automated: false, source: "" } as const;
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

describe("Nav", () => {
  it("switches tabs keeping project, range, source and auto, and marks the current tab", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/sessions") ? sessions : url.startsWith("/api/session") ? session : usage)));
    history.replaceState(null, "", "/usage?project=foo&range=14&source=codex&auto=1&session=s1");
    renderRouter();
    await screen.findByRole("link", { name: "Activity" });
    expect(screen.getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("page");
    expect(document.title).toBe("Activity · AI Ledger");
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(location.pathname).toBe("/cost");
    expect(location.search).toBe("?project=foo&range=14&source=codex&auto=1");
    expect(screen.getByRole("link", { name: "Cost" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBeNull();
    expect(document.title).toBe("Cost · AI Ledger");
    expect(screen.getByRole("link", { name: "Errors" }).getAttribute("href")).toBe("/errors?project=foo&range=14&source=codex&auto=1");
    // Back returns to Activity with its page-only keys.
    await act(async () => {
      history.back();
      await new Promise(r => addEventListener("popstate", r, { once: true }));
    });
    expect(location.pathname).toBe("/usage");
    expect(document.title).toBe("Activity · AI Ledger");
  });

  it("opens Limits with the project, range and source from Cost", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/limits") ? limits : usage)));
    history.replaceState(null, "", "/cost?project=foo&range=30&source=codex");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    await userEvent.click(screen.getByRole("link", { name: "Limits" }));
    expect(location.pathname).toBe("/limits");
    expect(location.search).toBe("?project=foo&range=30&source=codex");
    expect(document.title).toBe("Limits · AI Ledger");
    // The page's chunk loads on first show, so its fetch follows the click a tick later.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/limits?project=foo&range=30&source=codex")).toBe(true));
  });

  it("opens Insights with the project, range and source from Cost", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/insights") ? insights : usage)));
    history.replaceState(null, "", "/cost?project=foo&range=30&source=codex");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    // Within the nav: Cost's data now arrives with its page, which has a link to Insights of its own.
    await userEvent.click(within(screen.getByRole("navigation", { name: "Dashboards" })).getByRole("link", { name: "Insights" }));
    expect(location.pathname).toBe("/insights");
    expect(location.search).toBe("?project=foo&range=30&source=codex");
    expect(document.title).toBe("Insights · AI Ledger");
    // The page's chunk loads on first show, so its fetch follows the click a tick later.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/insights?project=foo&range=30&source=codex")).toBe(true));
  });

  it("opens Context from Cost with the project and range kept, after Cost in the nav", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/context") ? context : usage)));
    history.replaceState(null, "", "/cost?project=foo&range=30");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    const tabs = screen.getAllByRole("link").map(a => a.textContent);
    expect(tabs.slice(tabs.indexOf("Cost"), tabs.indexOf("Cost") + 2)).toEqual(["Cost", "Context"]);
    await userEvent.click(screen.getByRole("link", { name: "Context" }));
    expect(location.pathname).toBe("/context");
    expect(location.search).toBe("?project=foo&range=30");
    expect(document.title).toBe("Context · AI Ledger");
    expect(screen.getByRole("link", { name: "Context" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Cost" }).getAttribute("aria-current")).toBeNull();
  });

  it("keeps the automated toggle from Context to Cost and back", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/context") ? context : usage)));
    history.replaceState(null, "", "/context?project=foo&range=30&auto=1");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(location.pathname).toBe("/cost");
    expect(location.search).toBe("?project=foo&range=30&auto=1");
    await userEvent.click(screen.getByRole("link", { name: "Context" }));
    expect(location.pathname).toBe("/context");
    expect(location.search).toBe("?project=foo&range=30&auto=1");
  });

  it("opens Live with the project and source from Cost, and gives Cost its range back", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/live/session") ? liveSession
      : url.startsWith("/api/live") ? live : usage)));
    history.replaceState(null, "", "/cost?project=foo&range=14&source=claude");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    await userEvent.click(screen.getByRole("link", { name: "Live" }));
    expect(location.pathname).toBe("/live");
    await waitFor(() => expect(document.title).toBe("(2) Live · AI Ledger")); // one approval wait and one your turn in the list
    expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/live?project=foo&source=claude")).toBe(true);
    expect(screen.queryByRole("group", { name: "Time range" })).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(location.search).toBe("?project=foo&range=14&source=claude");
  });

  it("names the app AI Ledger", () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    const { container } = renderApp(<Nav />);
    expect(container.querySelector(".appnav-word")?.textContent).toBe("AI Ledger");
  });

  it("colors projects from the status, on any page", async () => {
    setOrder([]);
    vi.stubGlobal("fetch", vi.fn(() => json({ ...status, project_order: ["foo"] })));
    renderApp(<Nav />);
    await waitFor(() => expect(hasHue("foo")).toBe(true));
  });

  it("shows the project chip and clears the filter", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    history.replaceState(null, "", "/errors?project=foo&range=30&session=s1");
    renderApp(<Nav />);
    await userEvent.click(screen.getByRole("button", { name: "Clear project filter" }));
    expect(location.search).toBe("?range=30");
    expect(screen.queryByRole("button", { name: "Clear project filter" })).toBeNull();
    expect(screen.getByRole("link", { name: "Errors" }).getAttribute("aria-current")).toBe("page");
  });

  it("clears the Activity day with the project filter", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    history.replaceState(null, "", "/usage?project=foo&range=30&day=2026-11-04&q=api");
    renderApp(<Nav />);
    await userEvent.click(screen.getByRole("button", { name: "Clear project filter" }));
    expect(location.search).toBe("?range=30&q=api");
  });

  it("shows the ingest status, and a failed Refresh offers Retry until it is retried, whatever a status poll answers", async () => {
    setOrder([]);
    let down = true, order: string[] = [];
    const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" && down ? Promise.reject(new Error("down")) : json({ ...status, project_order: order }));
    vi.stubGlobal("fetch", f);
    history.replaceState(null, "", "/usage");
    const { client } = renderApp(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const btn = await screen.findByRole("button", { name: "Retry" });
    expect(btn.className).toBe("failed");
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    expect(f).toHaveBeenCalledWith("/api/refresh", { method: "POST" });
    order = ["foo"]; // the app is up: the nav's poll, or Live's on a change notice, still does its other work
    await poll(client);
    expect([screen.getByRole("button", { name: "Retry" }).className, hasHue("foo")]).toEqual(["failed", true]);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("button", { name: "Refresh" })).className).toBe("");
    expect(screen.getByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
  });

  it("keeps a failed Refresh's text through any number of polls, and shows Ingesting… while it runs", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    let down = true;
    const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" && down ? Promise.reject(new Error("down")) : json(status));
    vi.stubGlobal("fetch", f);
    renderApp(<Nav />);
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    await tick(0);
    act(() => { screen.getByRole("button", { name: "Refresh" }).click(); });
    await tick(0);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    await tick(30 * 60_000); // thirty polls, longer than Query keeps a mutation nobody observes
    expect(f.mock.calls.filter(c => String(c[0]) === "/api/status").length).toBeGreaterThan(20);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    down = false;
    f.mockImplementation((_url, init) => init?.method === "POST" ? new Promise<Response>(() => {}) : json(status));
    act(() => { screen.getByRole("button", { name: "Retry" }).click(); });
    await tick(0);
    expect(screen.getByText("Ingesting…")).toBeTruthy();
    vi.useRealTimers();
  });

  it("leaves the text to a running Refresh: no status poll replaces it, nor the answer to one asked before it ended", async () => {
    const answers: Record<string, () => void> = {}, later = (key: string, body: unknown) => new Promise<Response>(r => { answers[key] = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    const { client } = renderApp(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    f.mockImplementation((_url, init) => init?.method === "POST" ? later("refresh", { ...status, last_stats: { ...status.last_stats, inserted: 5 } }) : json({ ...status, ingesting: true }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await poll(client); // answered while the ingest runs
    expect(screen.getByText("Ingesting…")).toBeTruthy();
    f.mockImplementation(() => later("status", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // asked while it runs, answered after
    await act(async () => { answers.refresh!(); });
    expect(await screen.findByText(/Last ingest .* · 5 new lines/)).toBeTruthy();
    await act(async () => { answers.status!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 5 new lines/)).toBeTruthy();
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 } }));
    await poll(client); // asked after: shown
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
  });

  it("keeps Refresh focused and focusable while it runs, ignores activation, and names the search button by its label", async () => {
    const answers: Record<string, () => void> = {}, later = (body: unknown) => new Promise<Response>(r => { answers.refresh = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    renderApp(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Search/ }).getAttribute("aria-label")).toMatch(/^Search, open command palette \(/);
    f.mockImplementation((_url, init) => init?.method === "POST" ? later(status) : json(status));
    const btn = screen.getByRole("button", { name: "Refresh" });
    btn.focus();
    await userEvent.click(btn);
    const posts = () => f.mock.calls.filter(c => c[1]?.method === "POST").length;
    expect([posts(), btn.getAttribute("aria-disabled"), btn.hasAttribute("disabled"), document.activeElement]).toEqual([1, "true", false, btn]);
    await userEvent.click(btn); // a second press while it runs starts nothing
    await userEvent.keyboard("{Enter}");
    expect(posts()).toBe(1);
    await act(async () => { answers.refresh!(); });
    await waitFor(() => expect(btn.getAttribute("aria-disabled")).toBeNull());
    expect(document.activeElement).toBe(btn);
  });

  // Two status requests in flight at once, answered out of order, cannot exist: Query keeps one fetch per key. What can: a
  // poll in flight when Refresh starts or ends, and answered after it.
  it("keeps a Refresh's status when a poll sent before it is answered after it, whether the poll answers or fails", async () => {
    const answers: Record<string, () => void> = {}, later = (key: string, body: unknown) => new Promise<Response>(r => { answers[key] = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    const { client } = renderApp(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    const refresh = async (inserted: number) => {
      f.mockImplementation((_url, init) => init?.method === "POST" ? json({ ...status, last_stats: { ...status.last_stats, inserted } }) : json(status));
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      expect(await screen.findByText(new RegExp(`· ${inserted} new lines`))).toBeTruthy();
    };
    f.mockImplementation(() => later("nav", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // sent while an ingest runs
    await refresh(7);
    await act(async () => { answers.nav!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
    f.mockImplementation(() => new Promise<Response>((_, no) => { answers.down = () => no(new Error("down")); }));
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // sent before the next Refresh, and it fails after it
    await refresh(9);
    await act(async () => { answers.down!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 9 new lines/)).toBeTruthy();
  });

  describe("a new last_change", () => {
    // A mounted data query (Activity's), and a Live one that follows its own notices.
    const Probe = () => {
      useApi(queries.usage(view));
      useQuery({ queryKey: ["live", "list"], queryFn: () => fetch("/api/live").then(r => r.json()), staleTime: Infinity });
      return null;
    };
    const setup = async (answer: () => unknown) => {
      const f = vi.fn((url: string, _init?: RequestInit) => url.startsWith("/api/status") ? json(answer()) : url === "/api/refresh" ? json(answer()) : json({ n: 1 }));
      vi.stubGlobal("fetch", f);
      const { client } = renderApp(<><Nav /><Probe /></>);
      const calls = (prefix: string) => f.mock.calls.filter(c => String(c[0]).startsWith(prefix)).length;
      await waitFor(() => expect([calls("/api/usage"), calls("/api/live")]).toEqual([1, 1]));
      return { client, calls };
    };

    it("refetches the mounted data query, not for the first status or an identical last_change, and leaves a Live one alone", async () => {
      let change = status.last_change;
      const { client, calls } = await setup(() => ({ ...status, last_change: change }));
      await poll(client); // the same last_change
      expect(calls("/api/usage")).toBe(1);
      change = "2026-11-05T12:05:00+00:00";
      await poll(client);
      await waitFor(() => expect(calls("/api/usage")).toBe(2));
      expect(calls("/api/live")).toBe(1);
    });

    it("is asked for by Refresh, not by an ingest in the background, and the poll after a Refresh refetches nothing more", async () => {
      let change = status.last_change;
      const { client, calls } = await setup(() => ({ ...status, last_change: change }));
      expect(askedFor(client)).toBe(false);
      await userEvent.click(screen.getByRole("button", { name: "Refresh" })); // the same last_change: Refresh invalidates anyway
      await waitFor(() => expect(calls("/api/usage")).toBe(2));
      expect(askedFor(client)).toBe(true);
      await poll(client);
      await act(async () => { await new Promise(r => setTimeout(r, 30)); });
      expect([calls("/api/usage"), askedFor(client)]).toEqual([2, true]);
      change = "2026-11-05T12:05:00+00:00"; // an ingest in the background
      await poll(client);
      await waitFor(() => expect(calls("/api/usage")).toBe(3));
      expect(askedFor(client)).toBe(false);
    });
  });

  it("polls the status every minute, every 3 s while an ingest runs, and stops on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    let ingesting = true;
    const f = vi.fn(() => json({ ...status, ingesting }));
    vi.stubGlobal("fetch", f);
    const { unmount } = renderApp(<Nav />);
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    await tick(0);
    expect([f.mock.calls.length, screen.getByText("Ingesting transcripts…") != null]).toEqual([1, true]);
    ingesting = false;
    await tick(3000);
    expect(f.mock.calls.length).toBe(2);
    await tick(59_999);
    expect(f.mock.calls.length).toBe(2);
    await tick(1);
    expect(f.mock.calls.length).toBe(3);
    unmount();
    await tick(120_000);
    expect(f.mock.calls.length).toBe(3);
    vi.useRealTimers();
  });

  it("sends the status poll at low priority", async () => {
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    renderApp(<Nav />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(f.mock.calls[0]![0]).toBe("/api/status");
    expect(f.mock.calls[0]![1]).toMatchObject({ priority: "low" });
  });

  describe("in a background tab", () => {
    // Query's focusManager listens to visibilitychange on window and reads document.visibilityState.
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
      act(() => { window.dispatchEvent(new Event("visibilitychange")); });
    };
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    const setup = async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
      const f = vi.fn(() => json(status));
      vi.stubGlobal("fetch", f);
      const view = renderApp(<Nav />);
      await tick(0);
      expect(f.mock.calls.length).toBe(1);
      return { f, ...view };
    };
    afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(document, "hidden"); Reflect.deleteProperty(document, "visibilityState"); });

    it("sends no status request while hidden, and asks once on return", async () => {
      const { f } = await setup();
      setHidden(true);
      await tick(600_000);
      expect(f.mock.calls.length).toBe(1);
      setHidden(false);
      await tick(0);
      expect(f.mock.calls.length).toBe(2);
      expect(screen.getByText(/^Last ingest /).textContent).toContain(new Date(status.last_ingest).toLocaleTimeString());
    });

    // The old nav kept its schedule when the tab came back before a poll was due; the query asks on every return
    // (refetchOnWindowFocus "always"), so this is the nearest scenario: a short absence still asks once.
    it("asks once on return even when no poll came due meanwhile", async () => {
      const { f } = await setup();
      await tick(20_000);
      setHidden(true);
      await tick(10_000);
      setHidden(false);
      await tick(0);
      expect(f.mock.calls.length).toBe(2);
    });
  });

  it("shows a status poll asked from outside the nav, and says when the app does not answer", async () => {
    setOrder([]);
    const f = vi.fn(() => json(status));
    vi.stubGlobal("fetch", f);
    const { client } = renderApp(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 }, project_order: ["foo"] }));
    await poll(client);
    expect(client.getQueryData<typeof status>(queries.status.queryKey)?.project_order).toEqual(["foo"]);
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
    expect(hasHue("foo")).toBe(true);
    f.mockImplementation(() => Promise.reject(new Error("down")));
    await poll(client);
    expect(screen.getByText("App not reachable")).toBeTruthy();
  });

  it("says App not reachable when the first status request fails, and does not blink while the next poll runs", async () => {
    let answer = () => {};
    const f = vi.fn((_url: string, _init?: RequestInit): Promise<Response> => Promise.reject(new Error("down")));
    vi.stubGlobal("fetch", f);
    const { client } = renderApp(<Nav />);
    expect(await screen.findByText("App not reachable")).toBeTruthy();
    f.mockImplementation(() => new Promise<Response>(r => { answer = () => r(json(status)); }));
    let next!: Promise<unknown>;
    act(() => { next = client.refetchQueries({ queryKey: ["status"] }); });
    await act(flush); // Query's notice that the fetch began reaches the nav
    expect(screen.getByText("App not reachable")).toBeTruthy(); // the poll under way
    await act(async () => { answer(); await next; await flush(); });
    expect(screen.queryByText("App not reachable")).toBeNull();
    expect(screen.getByText(/Last ingest/)).toBeTruthy();
  });

  describe("Limits badge", () => {
    const alert = (over: Partial<LimitsAlert>): LimitsAlert => ({ kind: "at_limit", provider: "codex", provider_label: "Codex", label: "weekly", current: 100,
      at: "2026-11-14T12:00:00.000Z", resets_at: "2026-11-14T12:00:00.000Z", measured: true, count: 1, ...over });
    const badge = () => document.querySelector<HTMLElement>(".appnav-badge");
    const tab = (name: string | RegExp) => screen.getByRole("link", { name });

    it.each([
      ["at_limit", { kind: "at_limit" }, "critical", `Codex weekly is at its limit until ${whenDay("2026-11-14T12:00:00.000Z")}`],
      ["runs_out", { kind: "runs_out", current: 60, at: "2026-11-13T08:00:00.000Z" }, "critical", `Codex weekly is forecast to run out ${whenDay("2026-11-13T08:00:00.000Z")}`],
      ["high", { kind: "high", current: 92 }, "warning", "Codex weekly is at 92%"],
    ] as const)("marks the Limits tab for %s: a dot in the right tone, the sentence in its name and title", async (_kind, over, tone, sentence) => {
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, limits_alert: alert(over) })));
      history.replaceState(null, "", "/usage");
      renderApp(<Nav />);
      const link = await screen.findByRole("link", { name: `Limits alert: ${sentence}` });
      expect(sentence).toBe(alertText(alert(over)));
      // Exposed once: the sentence is in the link's name (a hidden span after the label), the link has no title to read again as a
      // description, and a plain span around the visible label and the dot carries the hover text, so it covers the whole tab.
      expect(link.hasAttribute("title")).toBe(false);
      expect(link.hasAttribute("aria-label")).toBe(false);
      expect(link.textContent).toBe(`Limits alert: ${sentence}`); // one space, a text node of the link before the hidden span
      expect(link.textContent!.split(sentence).length - 1).toBe(1);
      const wrap = link.querySelector<HTMLElement>("span[title]")!;
      expect(wrap.getAttribute("title")).toBe(sentence);
      expect(link.querySelectorAll("[title]").length).toBe(1);
      expect(wrap.textContent).toBe("Limits");
      expect(wrap.contains(badge())).toBe(true);
      expect(badge()?.hasAttribute("title")).toBe(false);
      expect(wrap.querySelector(".sr")).toBeNull();
      expect(link.querySelector(".sr")?.textContent).toBe(`alert: ${sentence}`);
      expect(badge()?.dataset.tone).toBe(tone);
      expect(link.contains(badge())).toBe(true);
      expect(badge()?.textContent).toBe(""); // a dot, not a number
      expect(badge()?.getAttribute("aria-hidden")).toBe("true");
      expect(document.querySelectorAll(".appnav-badge").length).toBe(1);
      expect(tab("Activity").textContent).toBe("Activity");
    });

    it("marks an estimate in the name and the hover text", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, limits_alert: alert({ kind: "high", current: 95, measured: false }) })));
      renderApp(<Nav />);
      const link = await screen.findByRole("link", { name: "Limits alert: Codex weekly is at an estimated 95%" });
      expect(link.querySelector("span[title]")?.getAttribute("title")).toBe("Codex weekly is at an estimated 95%");
    });

    it("says how many more windows are in alert", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, limits_alert: alert({ kind: "high", current: 95, count: 3 }) })));
      renderApp(<Nav />);
      expect(await screen.findByRole("link", { name: "Limits alert: Codex weekly is at 95% (and 2 more)" })).toBeTruthy();
    });

    it("shows none when limits_alert is null, or missing as an older server sends it", async () => {
      const f = vi.fn(() => json({ ...status, limits_alert: alert({}) }));
      vi.stubGlobal("fetch", f);
      const { client } = renderApp(<Nav />);
      await screen.findByRole("link", { name: /^Limits alert: / });
      f.mockImplementation(() => json({ ...status, limits_alert: null }));
      await poll(client);
      expect(badge()).toBeNull();
      expect(tab("Limits").textContent).toBe("Limits");
      f.mockImplementation(() => json({ ...status, limits_alert: alert({}) }));
      await poll(client);
      expect(badge()).not.toBeNull();
      f.mockImplementation(() => json(status)); // no field at all
      await poll(client);
      expect(badge()).toBeNull();
      expect(tab("Limits")).toBeTruthy();
    });

    it("follows the status poll: it appears, changes and goes, with no reload", async () => {
      const f = vi.fn(() => json({ ...status, limits_alert: null }));
      vi.stubGlobal("fetch", f);
      const { client } = renderApp(<Nav />);
      expect(await screen.findByText(/Last ingest/)).toBeTruthy();
      expect(badge()).toBeNull();
      f.mockImplementation(() => json({ ...status, limits_alert: alert({ kind: "high", current: 91 }) }));
      await poll(client);
      expect([badge()?.dataset.tone, document.querySelector("a span[title]")?.getAttribute("title")]).toEqual(["warning", "Codex weekly is at 91%"]);
      f.mockImplementation(() => json({ ...status, limits_alert: alert({ kind: "at_limit" }) }));
      await poll(client);
      expect(badge()?.dataset.tone).toBe("critical");
      f.mockImplementation(() => json({ ...status, limits_alert: null }));
      await poll(client);
      expect(badge()).toBeNull();
    });

    it("keeps the badge when the app does not answer, and takes a Refresh's answer", async () => {
      const f = vi.fn((_url: string, _init?: RequestInit) => json({ ...status, limits_alert: alert({ kind: "high", current: 91 }) }));
      vi.stubGlobal("fetch", f);
      const { client } = renderApp(<Nav />);
      await screen.findByRole("link", { name: /^Limits alert: / });
      f.mockImplementation(() => Promise.reject(new Error("down")));
      await poll(client);
      expect(badge()).not.toBeNull();
      f.mockImplementation(() => json({ ...status, limits_alert: null }));
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(badge()).toBeNull());
    });

    describe("announcement", () => {
      const region = () => screen.getByRole("status");
      const pollWith = async ({ f, client }: { f: ReturnType<typeof vi.fn>; client: QueryClient }, limits_alert: LimitsAlert | null | undefined) => {
        f.mockImplementation(() => json(limits_alert === undefined ? status : { ...status, limits_alert }));
        await poll(client);
      };
      const setup = async (first: LimitsAlert | null) => {
        const f = vi.fn((_url: string, _init?: RequestInit) => json({ ...status, limits_alert: first }));
        vi.stubGlobal("fetch", f);
        history.replaceState(null, "", "/usage");
        const { client } = renderApp(<Nav />);
        await screen.findByText(/Last ingest/);
        return { f, client };
      };

      it("is a persistent polite status region of its own, hidden from sight, that holds no alert until there is one", async () => {
        await setup(null);
        expect(region().className).toBe("sr");
        expect(region().textContent).toBe("");
        expect(region().id).not.toBe("navStatus");
        expect(document.getElementById("navStatus")!.getAttribute("role")).toBeNull();
      });

      it("says the sentence when an alert appears", async () => {
        const ctx = await setup(null);
        await pollWith(ctx, alert({ kind: "at_limit" }));
        expect(region().textContent).toBe(alertText(alert({ kind: "at_limit" })));
      });

      it("announces an alert that is there on the first status after load", async () => {
        const first = alert({ kind: "high", current: 92 });
        await setup(first);
        await waitFor(() => expect(region().textContent).toBe(alertText(first)));
      });

      it("leaves the text alone when only the time, the percent or the count drift, and does not touch the node", async () => {
        const ctx = await setup(alert({ kind: "runs_out", current: 60, at: "2026-11-13T08:00:00.000Z" }));
        const was = (await waitFor(() => { expect(region().textContent).not.toBe(""); return region().textContent; }));
        const seen: MutationRecord[] = [];
        const mo = new MutationObserver(r => seen.push(...r));
        mo.observe(region(), { childList: true, characterData: true, subtree: true });
        await pollWith(ctx, alert({ kind: "runs_out", current: 71, at: "2026-11-13T09:30:00.000Z", count: 2 }));
        expect(region().textContent).toBe(was);
        expect(seen.concat(mo.takeRecords())).toEqual([]);
        mo.disconnect();
        // the link's name still follows the newest sentence
        expect(screen.getByRole("link", { name: /^Limits alert: .*\(and 1 more\)$/ })).toBeTruthy();
      });

      it("says it again when the kind, the window or the measured flag changes", async () => {
        const ctx = await setup(alert({ kind: "high", current: 92 }));
        await waitFor(() => expect(region().textContent).toBe("Codex weekly is at 92%"));
        await pollWith(ctx, alert({ kind: "at_limit" }));
        expect(region().textContent).toBe(alertText(alert({ kind: "at_limit" })));
        await pollWith(ctx, alert({ kind: "at_limit", label: "5-hour" }));
        expect(region().textContent).toBe(alertText(alert({ kind: "at_limit", label: "5-hour" })));
        await pollWith(ctx, alert({ kind: "at_limit", label: "5-hour", measured: false }));
        expect(region().textContent).toBe(alertText(alert({ kind: "at_limit", label: "5-hour", measured: false })));
        await pollWith(ctx, alert({ kind: "at_limit", provider: "claude", provider_label: "Claude Code", label: "5-hour", measured: false }));
        expect(region().textContent).toBe("Claude Code 5-hour is estimated to be at its limit until " + whenDay("2026-11-14T12:00:00.000Z"));
      });

      it("empties when the alert goes, and says the next one when it comes back", async () => {
        const ctx = await setup(alert({ kind: "high", current: 92 }));
        await waitFor(() => expect(region().textContent).not.toBe(""));
        await pollWith(ctx, null);
        expect(region().textContent).toBe("");
        await pollWith(ctx, alert({ kind: "high", current: 92 }));
        expect(region().textContent).toBe("Codex weekly is at 92%");
        await pollWith(ctx, undefined); // an older app's status: no field
        expect(region().textContent).toBe("");
      });

      it("leaves the link's name, the dot and the hover text as they were", async () => {
        const a = alert({ kind: "high", current: 92 });
        await setup(a);
        const link = await screen.findByRole("link", { name: "Limits alert: Codex weekly is at 92%" });
        expect(link.hasAttribute("title")).toBe(false);
        expect(link.querySelector("span[title]")?.getAttribute("title")).toBe(alertText(a));
        expect(link.contains(region())).toBe(false);
      });
    });

    it("shows on the Limits page, whose tab is the current one", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? { ...status, limits_alert: alert({}) } : limits)));
      history.replaceState(null, "", "/limits");
      renderRouter();
      const link = await screen.findByRole("link", { name: /^Limits alert: / });
      expect(link.getAttribute("aria-current")).toBe("page");
      expect(badge()).not.toBeNull();
    });
  });

  it("steps the theme through light, dark and back to system", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    renderApp(<Nav />);
    const root = document.documentElement;
    const step = async (name: string) => userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "Theme: system" }).getAttribute("title")).toBe("Theme: system. Click for light.");
    await step("Theme: system");
    expect(root.dataset.theme).toBe("light");
    expect(localStorage.getItem("ai-ledger-theme")).toBe("light");
    await step("Theme: light");
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem("ai-ledger-theme")).toBe("dark");
    await step("Theme: dark");
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("ai-ledger-theme")).toBeNull();
    expect(screen.getByRole("button", { name: "Theme: system" })).toBeTruthy();
    // Two clicks before a re-render still step twice.
    const b = screen.getByRole("button", { name: "Theme: system" });
    b.click(); b.click();
    expect(root.dataset.theme).toBe("dark");
    delete root.dataset.theme;
  });
});
