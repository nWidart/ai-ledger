import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasHue, setOrder } from "./colors";
import { askedFor, noteStatus, refreshState } from "./components/refresh";
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
    expect(refreshState(q({ data, errorUpdatedAt: 200 }), "pending")).toEqual({ text: "Ingesting…", failed: false, busy: true, retry: false, alert });
    expect(refreshState(q({ data, errorUpdatedAt: 200 }), "error")).toEqual({ text: "Refresh failed. Select Retry to try again.", failed: true, busy: false, retry: true, alert });
    expect(refreshState(q({ data: { ...status, ingesting: true } }), "error").text).toBe("Refresh failed. Select Retry to try again.");
    expect(refreshState(q(), "success").alert).toBeNull();
  });
});
