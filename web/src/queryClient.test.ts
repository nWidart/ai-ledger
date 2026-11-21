// The app's query defaults, and the refresh state the nav shows. What a status answer does through the nav (the refetch
// of data queries, Refresh's invalidation, the project order, the kinds, the +N flash) is Nav.test.tsx's; here only the
// cases it does not reach.
import { afterEach, describe, expect, it, vi } from "vitest";
import { freshLabel, getFlash, noteStatus, refreshState } from "./components/refresh";
import type { Status } from "./api";
import { makeQueryClient } from "./queryClient";
import { makeTestClient } from "./testing";

const status: Status = { ingesting: false, last_ingest: "2026-11-05T12:00:00+00:00", last_change: "2026-11-05T12:00:00+00:00", last_stats: { files: 1, lines: 2, inserted: 2, seconds: 0.1 }, error: null, counts: {}, interval: 60, project_order: [] } as unknown as Status;

describe("makeQueryClient", () => {
  it("sets the query and mutation defaults, and the tests' client only turns garbage collection off", () => {
    const defaults = makeQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({
      staleTime: Infinity,
      gcTime: 5 * 60_000,
      retry: false,
      networkMode: "always",
      refetchOnReconnect: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false, networkMode: "always" });
    expect(makeTestClient().getDefaultOptions().queries).toMatchObject({ gcTime: Infinity, staleTime: Infinity, retry: false, networkMode: "always" });
  });
});

describe("refreshState", () => {
  const q = (over: Partial<Parameters<typeof refreshState>[0]> = {}) => ({ data: status, dataUpdatedAt: 100, errorUpdatedAt: 0, ...over });
  it("shows the status text, or nothing before the first answer", () => {
    expect(refreshState(q(), "idle")).toMatchObject({ text: expect.stringMatching(/^Last ingest /), failed: false, busy: false, retry: false });
    expect(refreshState(q({ data: undefined, dataUpdatedAt: 0 }), "idle").text).toBe("");
    expect(refreshState(q({ data: { ...status, error: "boom" } }), "idle")).toMatchObject({ text: "Ingest failed: boom", failed: true });
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

  it("says Ingesting… for the first ingest, before any time, and the time once there is one", () => {
    expect(freshLabel(refreshState(q({ data: { ...status, ingesting: true, last_ingest: null } }), "idle"))).toBe("Ingesting…");
    expect(freshLabel(refreshState(q({ data: { ...status, ingesting: true } }), "idle"))).toBe(time(at));
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
