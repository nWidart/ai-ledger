import { readFileSync } from "node:fs";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
// The freshness control: its group, its short visible label, its toggletip button, and the sentence the palette and Refresh's
// title carry ("Last ingest 12:00:00 PM · 2 new lines"), which the flows below follow.
const fresh = () => screen.getByRole("group", { name: "Ingest" });
const label = () => fresh().querySelector(".appnav-time")?.textContent;
const stateBtn = () => screen.getByRole("button", { name: /^Ingest status: / });
const ingestText = () => document.getElementById("navRefresh")!.title;
const ingested = (re: RegExp) => waitFor(() => expect(ingestText()).toMatch(re));
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const result = () => document.getElementById("navResult")!;

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

  it("opens Limits with the range and source from Cost, keeping the project in the URL for the other pages", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/limits") ? limits : usage)));
    history.replaceState(null, "", "/cost?project=foo&range=30&source=codex");
    renderRouter();
    await screen.findByRole("link", { name: "Cost" });
    await userEvent.click(screen.getByRole("link", { name: "Limits" }));
    expect(location.pathname).toBe("/limits");
    expect(location.search).toBe("?project=foo&range=30&source=codex");
    expect(document.title).toBe("Limits · AI Ledger");
    // The page's chunk loads on first show, so its fetch follows the click a tick later.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/limits?range=30&source=codex")).toBe(true));
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

  it("shows no project chip: the project's link and clear button are in the filter row", () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    history.replaceState(null, "", "/errors?project=foo&range=30");
    renderApp(<Nav />);
    expect(screen.queryByRole("link", { name: /project page/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear project filter" })).toBeNull();
    expect(screen.getByRole("link", { name: "Errors" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows the ingest status, and a failed Refresh offers Retry until it is retried, whatever a status poll answers", async () => {
    setOrder([]);
    let down = true, order: string[] = [];
    const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" && down ? Promise.reject(new Error("down")) : json({ ...status, project_order: order }));
    vi.stubGlobal("fetch", f);
    history.replaceState(null, "", "/usage");
    const { client } = renderApp(<Nav />);
    await ingested(/Last ingest .* · 2 new lines/);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const btn = await screen.findByRole("button", { name: "Retry" });
    expect(btn.className).toBe("failed");
    expect([btn.textContent, label(), fresh().dataset.kind]).toEqual(["Retry", "Failed", "retry"]);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBe(result());
    expect(f).toHaveBeenCalledWith("/api/refresh", { method: "POST" });
    order = ["foo"]; // the app is up: the nav's poll, or Live's on a change notice, still does its other work
    await poll(client);
    expect([screen.getByRole("button", { name: "Retry" }).className, hasHue("foo")]).toEqual(["failed", true]);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("button", { name: "Refresh" })).className).toBe("");
    expect(ingestText()).toMatch(/Last ingest .* · 2 new lines/);
    expect(screen.getByRole("button", { name: "Refresh" }).textContent).toBe(""); // icon-only again
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
    await ingested(/Last ingest .* · 2 new lines/);
    f.mockImplementation((_url, init) => init?.method === "POST" ? later("refresh", { ...status, last_stats: { ...status.last_stats, inserted: 5 } }) : json({ ...status, ingesting: true }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await poll(client); // answered while the ingest runs
    expect(label()).toBe("Ingesting…");
    f.mockImplementation(() => later("status", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // asked while it runs, answered after
    await act(async () => { answers.refresh!(); });
    await ingested(/Last ingest .* · 5 new lines/);
    await act(async () => { answers.status!(); await asked; });
    expect(ingestText()).toMatch(/Last ingest .* · 5 new lines/);
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 } }));
    await poll(client); // asked after: shown
    expect(ingestText()).toMatch(/Last ingest .* · 7 new lines/);
  });

  it("shows the project filter in the search button, and plain Search without one", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    history.replaceState(null, "", "/usage");
    const first = renderApp(<Nav />);
    const plain = await screen.findByRole("button", { name: /^Search, open command palette/ });
    expect(plain.textContent).toContain("Search");
    expect(plain.querySelector(".pdot")).toBeNull();
    first.unmount();
    history.replaceState(null, "", "/usage?project=foo");
    renderApp(<Nav />);
    const btn = await screen.findByRole("button", { name: /Search/ });
    expect(btn.textContent).toContain("foo");
    expect(btn.textContent).not.toContain("Search");
    expect(btn.querySelector(".pdot")).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toMatch(/^Search in foo, open command palette/);
    expect(btn.getAttribute("title")).toContain("foo");
  });

  it("keeps Refresh focused and focusable while it runs, ignores activation, and names the search button by its label", async () => {
    const answers: Record<string, () => void> = {}, later = (body: unknown) => new Promise<Response>(r => { answers.refresh = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    renderApp(<Nav />);
    await ingested(/Last ingest .* · 2 new lines/);
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
    await ingested(/Last ingest .* · 2 new lines/);
    const refresh = async (inserted: number) => {
      f.mockImplementation((_url, init) => init?.method === "POST" ? json({ ...status, last_stats: { ...status.last_stats, inserted } }) : json(status));
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await ingested(new RegExp(`· ${inserted} new lines`));
    };
    f.mockImplementation(() => later("nav", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // sent while an ingest runs
    await refresh(7);
    await act(async () => { answers.nav!(); await asked; });
    expect(ingestText()).toMatch(/Last ingest .* · 7 new lines/);
    f.mockImplementation(() => new Promise<Response>((_, no) => { answers.down = () => no(new Error("down")); }));
    act(() => { asked = client.fetchQuery(queries.status).catch(() => null); }); // sent before the next Refresh, and it fails after it
    await refresh(9);
    await act(async () => { answers.down!(); await asked; });
    expect(ingestText()).toMatch(/Last ingest .* · 9 new lines/);
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
    expect([f.mock.calls.length, ingestText()]).toEqual([1, "Ingesting transcripts…"]);
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
      expect(ingestText()).toContain(new Date(status.last_ingest).toLocaleTimeString());
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
    await ingested(/Last ingest .* · 2 new lines/);
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 }, project_order: ["foo"] }));
    await poll(client);
    expect(client.getQueryData<typeof status>(queries.status.queryKey)?.project_order).toEqual(["foo"]);
    expect(ingestText()).toMatch(/Last ingest .* · 7 new lines/);
    expect(hasHue("foo")).toBe(true);
    f.mockImplementation(() => Promise.reject(new Error("down")));
    await poll(client);
    expect([label(), ingestText()]).toEqual(["Offline", "App not reachable"]);
  });

  it("says Offline when the first status request fails, and does not blink while the next poll runs", async () => {
    let answer = () => {};
    const f = vi.fn((_url: string, _init?: RequestInit): Promise<Response> => Promise.reject(new Error("down")));
    vi.stubGlobal("fetch", f);
    const { client } = renderApp(<Nav />);
    await waitFor(() => expect(label()).toBe("Offline"));
    f.mockImplementation(() => new Promise<Response>(r => { answer = () => r(json(status)); }));
    let next!: Promise<unknown>;
    act(() => { next = client.refetchQueries({ queryKey: ["status"] }); });
    await act(flush); // Query's notice that the fetch began reaches the nav
    expect(label()).toBe("Offline"); // the poll under way
    await act(async () => { answer(); await next; await flush(); });
    expect(label()).toBe(`Stale · ${clock(status.last_ingest)}`);
    expect(ingestText()).toMatch(/^Last ingest/);
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
      await ingested(/^Last ingest/);
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
      // The alert's own region: not the Refresh result's, nor the toggletip's in the freshness control.
      const region = () => {
        const r = screen.getAllByRole("status").filter(el => el !== result() && !el.closest(".appnav-fresh"));
        expect(r.length).toBe(1);
        return r[0]!;
      };
      const pollWith = async ({ f, client }: { f: ReturnType<typeof vi.fn>; client: QueryClient }, limits_alert: LimitsAlert | null | undefined) => {
        f.mockImplementation(() => json(limits_alert === undefined ? status : { ...status, limits_alert }));
        await poll(client);
      };
      const setup = async (first: LimitsAlert | null) => {
        const f = vi.fn((_url: string, _init?: RequestInit) => json({ ...status, limits_alert: first }));
        vi.stubGlobal("fetch", f);
        history.replaceState(null, "", "/usage");
        const { client } = renderApp(<Nav />);
        await ingested(/^Last ingest/);
        return { f, client };
      };

      it("is a persistent polite status region of its own, hidden from sight, that holds no alert until there is one", async () => {
        await setup(null);
        expect(region().className).toBe("sr");
        expect(region().textContent).toBe("");
        expect(region().id).toBe("");
        expect(fresh().querySelector(".appnav-time")!.closest("[aria-live], [role=status]")).toBeNull();
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

  describe("freshness control", () => {
    const flashEl = () => fresh().querySelector<HTMLElement>(".appnav-flash");
    const popup = () => document.querySelector<HTMLElement>(".tt-pop");
    // The details as [term, value] pairs.
    const rows = () => [...popup()!.querySelectorAll("dt")].map(dt => [dt.textContent, dt.nextElementSibling?.textContent]);
    const open = async () => {
      stateBtn().focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(popup()).not.toBeNull());
    };

    it("shows the last ingest as a clock time, beside an icon-only Refresh, named for what it is", async () => {
      const now = new Date().toISOString();
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, last_ingest: now, last_change: now })));
      renderApp(<Nav />);
      await waitFor(() => expect(label()).toBe(clock(now)));
      expect(label()).toMatch(/^\d{1,2}[:.]\d{2}/);
      expect(label()).not.toMatch(/Stale/);
      expect(fresh().dataset.kind).toBe("idle");
      expect(stateBtn().getAttribute("aria-label")).toBe(`Ingest status: ${clock(now)}`);
      const btn = screen.getByRole("button", { name: "Refresh" });
      expect([btn.textContent, btn.querySelector("svg")?.getAttribute("aria-hidden"), fresh().contains(btn)]).toEqual(["", "true", true]);
    });

    it("says Stale with the time when the last ingest is older than three intervals", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status))); // 2026-11-05, long before the answer
      renderApp(<Nav />);
      await waitFor(() => expect(label()).toBe(`Stale · ${clock(status.last_ingest)}`));
      expect(fresh().dataset.kind).toBe("stale");
    });

    it("says Failed after an ingest error, and the toggletip holds the error's full text", async () => {
      const error = "IO Error: Could not set lock on file: Conflicting lock is held by PID 4242";
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, error })));
      renderApp(<Nav />);
      await waitFor(() => expect(label()).toBe("Failed"));
      expect(fresh().dataset.kind).toBe("failed");
      expect(screen.getByRole("button", { name: "Refresh" }).className).toBe("failed");
      await open();
      expect(rows()).toContainEqual(["Error", error]);
    });

    it("says Offline when the app does not answer, and why in the details", async () => {
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
      renderApp(<Nav />);
      await waitFor(() => expect(label()).toBe("Offline"));
      expect(fresh().dataset.kind).toBe("offline");
      await open();
      expect(popup()!.textContent).toContain("The app did not answer its status request.");
    });

    it("says No ingest yet before the first ingest", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, last_ingest: null, last_change: null, last_stats: null })));
      renderApp(<Nav />);
      await waitFor(() => expect(stateBtn().getAttribute("aria-label")).toBe("Ingest status: No ingest yet"));
      expect(label()).toBe("No ingest yet");
      await open();
      expect(popup()!.textContent).toContain("No ingest yet.");
      expect(rows()).toEqual([["Interval", "every 1 min"]]);
    });

    it("says Ingesting… while a Refresh runs", async () => {
      const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" ? new Promise<Response>(() => {}) : json(status));
      vi.stubGlobal("fetch", f);
      renderApp(<Nav />);
      await ingested(/^Last ingest/);
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      expect([label(), fresh().dataset.kind, stateBtn().getAttribute("aria-label")]).toEqual(["Ingesting…", "busy", "Ingest status: Ingesting…"]);
    });

    it("shows the details on activation: the exact time, lines, last change and interval, and Escape keeps focus", async () => {
      const at = "2026-11-05T20:00:04+00:00", change = "2026-11-05T19:58:00+00:00";
      vi.stubGlobal("fetch", vi.fn(() => json({ ...status, last_ingest: at, last_change: change, interval: 90, last_stats: { ...status.last_stats, inserted: 1234 } })));
      renderApp(<Nav />);
      await ingested(/1,234 new lines/);
      expect(stateBtn().getAttribute("aria-expanded")).toBe("false");
      await open();
      expect(stateBtn().getAttribute("aria-expanded")).toBe("true");
      expect(rows()).toEqual([
        ["Last ingest", expect.stringContaining(new Date(at).toLocaleTimeString())],
        ["New lines", "1,234"],
        ["Last data change", expect.stringContaining(new Date(change).toLocaleTimeString())],
        ["Interval", "every 90 s"],
      ]);
      expect(popup()!.textContent).toContain("Ingest runs on its own. Refresh runs it now.");
      // Read once it shows, through the toggletip's own region, which is empty while closed.
      const tipRegion = fresh().querySelector("[role=status]")!;
      expect(tipRegion.textContent).toContain("1,234");
      await userEvent.keyboard("{Escape}");
      expect(stateBtn().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(stateBtn());
      expect(tipRegion.textContent).toBe("");
    });

    it("says a failed Refresh's error in the details, beside Retry", async () => {
      const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" ? Promise.reject(new Error("connection refused")) : json(status));
      vi.stubGlobal("fetch", f);
      renderApp(<Nav />);
      await ingested(/^Last ingest/);
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByRole("button", { name: "Retry" });
      await open();
      expect(popup()!.textContent).toContain("Refresh failed.");
      expect(rows()).toContainEqual(["Error", "connection refused"]);
    });

    describe("live regions", () => {
      // Every live region in the nav, and its text.
      const regions = () => [...document.querySelectorAll(".appnav [role=status], .appnav [aria-live]")].map(r => r.textContent);

      it("announces nothing for a timed poll that brings a new time and new lines", async () => {
        const f = vi.fn(() => json(status));
        vi.stubGlobal("fetch", f);
        const { client } = renderApp(<Nav />);
        await ingested(/^Last ingest/);
        expect(document.querySelectorAll(".appnav [aria-live]").length).toBe(0);
        const seen: MutationRecord[] = [];
        const mo = new MutationObserver(r => seen.push(...r));
        document.querySelectorAll(".appnav [role=status]").forEach(r => mo.observe(r, { childList: true, characterData: true, subtree: true }));
        f.mockImplementation(() => json({ ...status, last_ingest: "2026-11-05T12:05:00+00:00", last_change: "2026-11-05T12:05:00+00:00",
          last_stats: { ...status.last_stats, inserted: 5 } }));
        await poll(client);
        expect(ingestText()).toMatch(/· 5 new lines/);
        expect(seen.concat(mo.takeRecords())).toEqual([]);
        expect(regions().every(t => t === "")).toBe(true);
        mo.disconnect();
      });

      it("says a manual Refresh's result once, in its own region, and leaves the limits alert's alone", async () => {
        const limits_alert: LimitsAlert = { kind: "high", provider: "codex", provider_label: "Codex", label: "weekly", current: 92,
          at: "2026-11-14T12:00:00.000Z", resets_at: "2026-11-14T12:00:00.000Z", measured: true, count: 1 };
        const answers: Record<string, () => void> = {};
        const f = vi.fn((_url: string, _init?: RequestInit) => json({ ...status, limits_alert }));
        vi.stubGlobal("fetch", f);
        const { client } = renderApp(<Nav />);
        const alertRegion = () => screen.getAllByRole("status").find(r => r.textContent === "Codex weekly is at 92%");
        await waitFor(() => expect(alertRegion()).toBeTruthy());
        const was = alertRegion()!;
        expect(result().textContent).toBe("");
        f.mockImplementation((_url, init) => init?.method === "POST"
          ? new Promise<Response>(r => { answers.refresh = () => r(json({ ...status, limits_alert, last_stats: { ...status.last_stats, inserted: 5 } })); })
          : json({ ...status, limits_alert }));
        await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
        expect(result().textContent).toBe(""); // nothing while it runs
        const seen: string[] = [];
        const mo = new MutationObserver(() => seen.push(result().textContent!));
        mo.observe(result(), { childList: true, characterData: true, subtree: true });
        await act(async () => { answers.refresh!(); });
        await waitFor(() => expect(result().textContent).toBe("Refreshed: 5 new lines"));
        await poll(client); // a timed poll after it says nothing again
        await act(flush);
        expect(seen).toEqual(["Refreshed: 5 new lines"]);
        mo.disconnect();
        expect([alertRegion(), was.textContent]).toEqual([was, "Codex weekly is at 92%"]);
        expect(was).not.toBe(result());
      });
    });

    describe("+N lines", () => {
      const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      afterEach(() => { vi.useRealTimers(); });

      it("shows +5 lines, hidden from assistive technology, after a poll with new data, for four seconds; nothing for nothing new", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
        let change = status.last_change, inserted = 2;
        vi.stubGlobal("fetch", vi.fn(() => json({ ...status, last_change: change, last_stats: { ...status.last_stats, inserted } })));
        const { client } = renderApp(<Nav />);
        const pollNow = () => act(async () => { void client.fetchQuery(queries.status).catch(() => null); await vi.advanceTimersByTimeAsync(0); });
        await tick(0);
        expect(flashEl()).toBeNull(); // the first answer's lines are already on the page
        change = "2026-11-05T12:05:00+00:00"; inserted = 5;
        await pollNow();
        expect([flashEl()?.textContent, flashEl()?.getAttribute("aria-hidden")]).toEqual(["+5 lines", "true"]);
        expect(stateBtn().getAttribute("aria-label")).not.toContain("+5");
        expect(fresh().firstElementChild).toBe(screen.getByRole("button", { name: "Refresh" }));
        await tick(3999);
        expect(flashEl()).not.toBeNull();
        await tick(1);
        expect(flashEl()).toBeNull();
        inserted = 0; change = "2026-11-05T12:06:00+00:00"; // an ingest that stored nothing
        await pollNow();
        expect(flashEl()).toBeNull();
        inserted = 1; change = "2026-11-05T12:07:00+00:00";
        await pollNow();
        expect(flashEl()?.textContent).toBe("+1 line");
      });
    });
  });

  // The page chooser stands in for the tabs on narrow screens. jsdom applies no media query, so both are in the document here:
  // the chooser's links exist only while its list is open, so the tabs' names stay unique.
  describe("page chooser", () => {
    const chooser = () => document.querySelector<HTMLButtonElement>(".appnav-chooser")!;
    const list = () => document.querySelector<HTMLElement>(".appnav-chooser-pop");
    const item = (name: string | RegExp) => within(list()!).getByRole("link", { name });
    const open = async () => {
      act(() => chooser().focus());
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(list()).not.toBeNull());
    };
    const alert: LimitsAlert = { kind: "at_limit", provider: "codex", provider_label: "Codex", label: "weekly", current: 100,
      at: "2026-11-14T12:00:00.000Z", resets_at: "2026-11-14T12:00:00.000Z", measured: true, count: 1 };

    it("is a collapsed button named for the current page, whose list holds the seven page links with the filters, the current one marked", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status)));
      history.replaceState(null, "", "/errors?project=foo&range=14");
      renderApp(<Nav />);
      const btn = screen.getByRole("button", { name: "Errors" });
      expect(btn).toBe(chooser());
      expect(btn.getAttribute("aria-expanded")).toBe("false");
      expect(btn.hasAttribute("aria-label")).toBe(false); // the visible label is the name
      expect(list()).toBeNull();
      const h = document.documentElement.style.getPropertyValue("--appnav-h");
      await open();
      expect(btn.getAttribute("aria-expanded")).toBe("true");
      const links = within(list()!).getAllByRole("link");
      expect(links.map(a => a.textContent)).toEqual(["Activity", "Cost", "Context", "Errors", "Limits", "Insights", "Live"]);
      expect(links.every(a => a.parentElement!.tagName === "LI" && a.parentElement!.parentElement!.tagName === "UL")).toBe(true);
      expect(list()!.querySelector("[role=menu], [role=menuitem]")).toBeNull(); // links, not a menu
      expect(item("Errors").getAttribute("aria-current")).toBe("page");
      expect(links.filter(a => a.hasAttribute("aria-current")).length).toBe(1);
      expect(item("Cost").getAttribute("href")).toBe("/cost?project=foo&range=14");
      // Portaled over the page: the nav's height, and --appnav-h with it, does not change.
      expect(document.querySelector("nav.appnav")!.contains(list())).toBe(false);
      expect(document.documentElement.style.getPropertyValue("--appnav-h")).toBe(h);
    });

    it("picks a page from the keyboard: the list closes, the page opens with the filters, and focus is on its heading", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : usage)));
      history.replaceState(null, "", "/usage?project=foo&range=14");
      renderRouter();
      await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
      await open();
      act(() => item("Cost").focus());
      await userEvent.keyboard("{Enter}");
      expect(location.pathname).toBe("/cost");
      expect(location.search).toBe("?project=foo&range=14");
      await waitFor(() => expect(list()).toBeNull());
      await waitFor(() => expect(document.querySelector("main.pg-cost")).toBeTruthy());
      await waitFor(() => expect(document.activeElement?.id).toBe("lede"));
      expect(document.activeElement!.closest(".pg-cost")).toBeTruthy();
      await new Promise(r => setTimeout(r, 20)); // nothing takes it back to the button afterwards
      expect(document.activeElement?.id).toBe("lede");
      expect(chooser().textContent).toBe("Cost");
    });

    // Here the page loads at once, so the heading has focus before the list goes. A page whose code is still loading has no heading
    // yet: had the list given focus back to the button, it would land there and the page switch would stop following the heading.
    it("gives focus back to no one when a page is picked, and to the button when the current page is", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status)));
      history.replaceState(null, "", "/usage");
      renderApp(<Nav />); // no page, and no page switch to move focus
      await open();
      act(() => item("Cost").focus());
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(list()).toBeNull());
      await flush();
      expect(location.pathname).toBe("/cost");
      expect(document.activeElement).toBe(document.body);
      await open();
      act(() => item("Cost").focus());
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(list()).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(chooser()));
    });

    it("closes on Escape, giving focus back to the button, and on a click outside", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status)));
      history.replaceState(null, "", "/cost");
      renderApp(<Nav />);
      await open();
      act(() => item("Errors").focus());
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(list()).toBeNull());
      expect(document.activeElement).toBe(chooser());
      expect(chooser().getAttribute("aria-expanded")).toBe("false");
      expect(location.pathname).toBe("/cost");
      await open();
      await userEvent.click(document.body);
      await waitFor(() => expect(list()).toBeNull());
      expect(location.pathname).toBe("/cost");
    });

    it("leaves a Cmd-click to the browser: the page stays", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status)));
      history.replaceState(null, "", "/cost?range=14");
      renderApp(<Nav />);
      await open();
      // What the app did with the click, read after React's handlers; then the default is dropped, as jsdom cannot open a tab.
      let prevented: boolean | undefined;
      const seen = (e: Event) => { prevented = e.defaultPrevented; e.preventDefault(); };
      addEventListener("click", seen, { once: true });
      fireEvent.click(item("Errors"), { metaKey: true });
      expect(prevented).toBe(false);
      expect(item("Errors").getAttribute("href")).toBe("/errors?range=14");
      expect(location.pathname).toBe("/cost");
      expect(location.search).toBe("?range=14");
    });

    it("reads Pages on the Project page and marks no link current", async () => {
      vi.stubGlobal("fetch", vi.fn(() => json(status)));
      history.replaceState(null, "", "/project?project=foo");
      renderApp(<Nav />);
      expect(screen.getByRole("button", { name: "Pages" })).toBe(chooser());
      await open();
      expect(within(list()!).getAllByRole("link").filter(a => a.hasAttribute("aria-current"))).toEqual([]);
    });

    it("carries the dot and says Limits alert while an alert is present; the Limits link is named for the alert", async () => {
      const f = vi.fn(() => json({ ...status, limits_alert: alert }));
      vi.stubGlobal("fetch", f);
      history.replaceState(null, "", "/errors");
      const { client } = renderApp(<Nav />);
      const btn = await screen.findByRole("button", { name: "Errors, Limits alert" });
      expect(btn).toBe(chooser());
      expect(btn.textContent).toBe("Errors"); // the name holds the visible label
      const dot = btn.querySelector<HTMLElement>(".appnav-dot")!;
      expect([dot.dataset.tone, dot.getAttribute("aria-hidden"), dot.textContent]).toEqual(["critical", "true", ""]);
      await open();
      const link = item(/^Limits alert: /);
      expect(link.textContent).toBe(`Limits alert: ${alertText(alert)}`);
      expect(link.querySelector<HTMLElement>(".appnav-badge")!.dataset.tone).toBe("critical");
      await userEvent.keyboard("{Escape}");
      f.mockImplementation(() => json({ ...status, limits_alert: null }));
      await poll(client);
      expect(screen.getByRole("button", { name: "Errors" })).toBe(btn);
      expect(btn.querySelector(".appnav-dot")).toBeNull();
    });
  });

  // jsdom applies no layout, so the one-row rule is read from the stylesheet: the row never wraps (a step missing shows as
  // overflow in review, not as a silent second row), and the narrow step swaps the tabs for the chooser.
  it("keeps the bar on one row: nowrap, no wrapping rule, and the chooser in the tabs' place on narrow screens", () => {
    const css = readFileSync("src/components/Nav.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel!.trim(), body: body! }));
    const of = (sel: string) => rules.filter(r => r.sel.split(",").map(s => s.trim()).includes(sel));
    expect(of(".appnav-in")[0]!.body).toMatch(/flex-wrap:\s*nowrap/);
    expect(rules.filter(r => /flex-wrap:\s*wrap/.test(r.body))).toEqual([]);
    const narrow = css.match(/@media \(max-width: ([\d.]+)em\) \{[^@]*\.appnav-tabs \{ display: none; \}[^@]*\.appnav \.appnav-chooser \{ display: inline-flex; \}/);
    expect(narrow).not.toBeNull();
    expect(of(".appnav .appnav-chooser")[0]!.body).toMatch(/display:\s*none/); // hidden at full width
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
