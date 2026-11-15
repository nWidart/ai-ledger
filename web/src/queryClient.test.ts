import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasHue, setOrder } from "./colors";
import { askedFor, freshLabel, getFlash, noteStatus, refreshState, subscribeFlash, useRefresh } from "./components/refresh";
import type { Status, View } from "./api";
import { makeQueryClient } from "./queryClient";
import { queries } from "./queries";
import { makeTestClient } from "./testing";

afterEach(() => vi.unstubAllGlobals());

const v: View = { project: "p", range: 30, automated: false, source: "" };
const status: Status = { ingesting: false, last_ingest: "2026-11-05T12:00:00+00:00", last_change: "2026-11-05T12:00:00+00:00", last_stats: { files: 1, lines: 2, inserted: 2, seconds: 0.1 }, error: null, counts: {}, interval: 60, project_order: [] } as unknown as Status;
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

describe("makeQueryClient", () => {
  it("sets the query and mutation defaults", () => {
    const defaults = makeQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({
      staleTime: Infinity,
      gcTime: 5 * 60_000,
      retry: false,
      networkMode: "always",
      refetchOnReconnect: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false, networkMode: "always" });
  });
});

describe("what a status answer does", () => {
  // Mounted queries: the usage one is data, the live one follows its own notices.
  const setup = (answer: () => Partial<Status>) => {
    const f = vi.fn((url: string) => json(url.startsWith("/api/status") ? { ...status, ...answer() } : { url }));
    vi.stubGlobal("fetch", f);
    const client = makeTestClient();
    const subs = [
      new QueryObserver(client, queries.usage(v)),
      new QueryObserver(client, { queryKey: ["live", "list"], queryFn: () => fetch("/api/live").then(r => r.json()) }),
    ].map(o => o.subscribe(() => {}));
    const calls = (prefix: string) => f.mock.calls.filter(c => String(c[0]).startsWith(prefix)).length;
    const poll = () => client.fetchQuery(queries.status);
    return { client, calls, poll, stop: () => subs.forEach(s => s()) };
  };
  const settle = () => new Promise(r => setTimeout(r, 20));

  it("refetches a mounted data query for a new last_change, and leaves a Live query alone", async () => {
    let change = status.last_change;
    const { poll, calls, stop } = setup(() => ({ last_change: change }));
    await poll(); // the first answer invalidates nothing
    await settle();
    expect([calls("/api/usage"), calls("/api/live")]).toEqual([1, 1]);
    await poll(); // the same last_change
    await settle();
    expect(calls("/api/usage")).toBe(1);
    change = "2026-11-05T12:05:00+00:00";
    await poll();
    await settle();
    expect([calls("/api/usage"), calls("/api/live")]).toEqual([2, 1]);
    stop();
  });

  it("sets the project order from every answer", async () => {
    setOrder([]);
    const { poll, stop } = setup(() => ({ project_order: ["queried"] }));
    await poll();
    expect(hasHue("queried")).toBe(true);
    stop();
  });

  it("tells a Refresh's invalidation from an ingest's", async () => {
    let change = status.last_change;
    const { client, poll, stop } = setup(() => ({ last_change: change }));
    await poll();
    expect(askedFor(client)).toBe(false);
    noteStatus(client, status, true); // Refresh: invalidates whatever last_change says
    expect(askedFor(client)).toBe(true);
    await poll(); // the poll after it: the same last_change, nothing new
    expect(askedFor(client)).toBe(true);
    change = "2026-11-05T12:05:00+00:00";
    await poll(); // an ingest in the background
    expect(askedFor(client)).toBe(false);
    stop();
  });
});

describe("refreshState", () => {
  const q = (over: Partial<Parameters<typeof refreshState>[0]> = {}) => ({ data: status, dataUpdatedAt: 100, errorUpdatedAt: 0, ...over });
  it("shows the status text, or nothing before the first answer", () => {
    expect(refreshState(q(), "idle")).toMatchObject({ text: expect.stringMatching(/^Last ingest /), failed: false, busy: false, retry: false });
    expect(refreshState(q({ data: undefined, dataUpdatedAt: 0 }), "idle").text).toBe("");
    expect(refreshState(q({ data: { ...status, error: "boom" } }), "idle")).toMatchObject({ text: "Ingest failed: boom", failed: true });
  });
  it("says the app is not reachable while the last status request is the newer outcome", () => {
    expect(refreshState(q({ errorUpdatedAt: 200 }), "idle")).toMatchObject({ text: "App not reachable", failed: true });
    expect(refreshState(q({ errorUpdatedAt: 50 }), "idle").text).toMatch(/^Last ingest /);
  });
  it("lets a running or failed Refresh own the text, and always keeps the newest alert", () => {
    const alert = { kind: "high" } as never;
    const data = { ...status, limits_alert: alert };
    expect(refreshState(q({ data, errorUpdatedAt: 200 }), "pending")).toMatchObject({ kind: "busy", text: "Ingesting…", failed: false, busy: true, retry: false, alert });
    expect(refreshState(q({ data, errorUpdatedAt: 200 }), "error")).toMatchObject({ kind: "retry", text: "Refresh failed. Select Retry to try again.", failed: true, busy: false, retry: true, alert });
    expect(refreshState(q({ data: { ...status, ingesting: true } }), "error").text).toBe("Refresh failed. Select Retry to try again.");
    expect(refreshState(q(), "success").alert).toBeNull();
  });
});

describe("refreshState kinds", () => {
  const at = Date.parse(status.last_ingest!);
  const q = (over: Partial<Parameters<typeof refreshState>[0]> = {}) => ({ data: status, dataUpdatedAt: at + 10_000, errorUpdatedAt: 0, ...over });
  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  it("is idle with the status's fields, and labels the time", () => {
    const st = refreshState(q(), "idle");
    expect(st).toMatchObject({ kind: "idle", at: new Date(at), inserted: 2, changedAt: new Date(status.last_change!), interval: 60, error: null, said: "" });
    expect(freshLabel(st)).toBe(time(at));
    expect(freshLabel(refreshState(q({ data: undefined, dataUpdatedAt: 0 }), "idle"))).toBe("");
  });
  it("is stale when the last ingest is older than three intervals at the answer's time", () => {
    const st = refreshState(q({ dataUpdatedAt: at + 5 * 60_000 }), "idle");
    expect(st.kind).toBe("stale");
    expect(freshLabel(st)).toBe(`Stale · ${time(at)}`);
    expect(refreshState(q({ dataUpdatedAt: at + 70_000 }), "idle").kind).toBe("idle");
  });
  it("is failed after an ingest error, with the error's text", () => {
    const st = refreshState(q({ data: { ...status, error: "disk full" } }), "idle");
    expect(st).toMatchObject({ kind: "failed", error: "disk full" });
    expect(freshLabel(st)).toBe("Failed");
  });
  it("is offline when the status request fails", () => {
    const st = refreshState(q({ errorUpdatedAt: at + 20_000 }), "idle");
    expect(st).toMatchObject({ kind: "offline", at: new Date(at) });
    expect(freshLabel(st)).toBe("Offline");
  });
  it("is busy while a Refresh runs, and retry after one fails, over every status", () => {
    const worst = q({ data: { ...status, error: "disk full" }, dataUpdatedAt: at + 5 * 60_000, errorUpdatedAt: at + 6 * 60_000 });
    const busy = refreshState(worst, "pending");
    expect(busy).toMatchObject({ kind: "busy", busy: true });
    expect(freshLabel(busy)).toBe("Ingesting…");
    const retry = refreshState(worst, "error", { error: new Error("HTTP 500") });
    expect(retry).toMatchObject({ kind: "retry", retry: true, error: "HTTP 500" });
    expect(freshLabel(retry)).toBe("Failed");
  });
  it("says a Refresh's result, and nothing while one runs or before one", () => {
    const answer = (inserted: number) => ({ data: { ...status, last_stats: { ...status.last_stats!, inserted } } });
    expect(refreshState(q(), "success", answer(5)).said).toBe("Refreshed: 5 new lines");
    expect(refreshState(q(), "success", answer(1)).said).toBe("Refreshed: 1 new line");
    expect(refreshState(q(), "success", answer(0)).said).toBe("Refreshed: nothing new");
    expect(refreshState(q(), "error").said).toBe("Refresh failed. Select Retry to try again.");
    expect(refreshState(q(), "pending", answer(5)).said).toBe("");
    expect(refreshState(q(), "idle").said).toBe("");
  });
});

describe("the +N lines flash", () => {
  afterEach(() => vi.useRealTimers());
  const changed = (inserted: number, change = "2026-11-05T12:05:00+00:00") =>
    ({ ...status, last_change: change, last_stats: { ...status.last_stats!, inserted } });

  it("shows for a new last_change that stored lines, then goes after 4 s", () => {
    vi.useFakeTimers();
    const client = makeTestClient(), f = vi.fn<() => void>();
    const off = subscribeFlash(client, f);
    noteStatus(client, status);
    expect(getFlash(client)).toBeNull(); // the first answer after load
    noteStatus(client, changed(5));
    expect(getFlash(client)).toEqual({ n: 5 });
    vi.advanceTimersByTime(3999);
    expect(getFlash(client)).toEqual({ n: 5 });
    vi.advanceTimersByTime(1);
    expect(getFlash(client)).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    off();
  });
  it("shows nothing for an ingest that stored no lines, or for the same last_change again", () => {
    vi.useFakeTimers();
    const client = makeTestClient();
    noteStatus(client, status);
    noteStatus(client, status);
    expect(getFlash(client)).toBeNull();
    noteStatus(client, changed(0));
    expect(getFlash(client)).toBeNull();
  });
  it("shows for a Refresh's answer that stored lines, even as the first answer", () => {
    vi.useFakeTimers();
    const client = makeTestClient();
    noteStatus(client, changed(3), true);
    expect(getFlash(client)).toEqual({ n: 3 });
    noteStatus(client, changed(3)); // the poll after it: the same last_change
    vi.advanceTimersByTime(4000);
    expect(getFlash(client)).toBeNull();
  });
});

describe("useRefresh's said", () => {
  it("is set once by a Refresh's success or failure, and never by a timed poll", async () => {
    let fail = false;
    const answer = { ...status, last_change: "2026-11-05T12:05:00+00:00", last_stats: { ...status.last_stats!, inserted: 5 } };
    vi.stubGlobal("fetch", vi.fn((url: string) => url.startsWith("/api/refresh")
      ? (fail ? Promise.resolve(new Response("no", { status: 500 })) : json(answer)) : json(status)));
    const client = makeTestClient();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useRefresh(), { wrapper });
    await waitFor(() => expect(result.current.state.at).not.toBeNull());
    await act(() => client.fetchQuery({ ...queries.status, staleTime: 0 }));
    expect(result.current.state.said).toBe("");
    act(() => result.current.refresh());
    expect(result.current.state.said).toBe("");
    await waitFor(() => expect(result.current.state.said).toBe("Refreshed: 5 new lines"));
    await act(() => client.fetchQuery({ ...queries.status, staleTime: 0 }));
    expect(result.current.state.said).toBe("Refreshed: 5 new lines"); // unchanged, so not announced again
    fail = true;
    act(() => result.current.refresh());
    expect(result.current.state.said).toBe("");
    await waitFor(() => expect(result.current.state.said).toBe("Refresh failed. Select Retry to try again."));
  });
});
