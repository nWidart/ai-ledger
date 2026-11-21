import { hashKey, queryOptions, type QueryKey } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, type LiveEvent, type LiveSession, type Status, type View } from "./api";
import { KEEP } from "./pages/live/live";
import { isData, queries } from "./queries";
import { makeTestClient, wrapper } from "./testing";
import { useApi } from "./useApi";

afterEach(() => vi.unstubAllGlobals());

const v: View = { project: "p", range: 30, automated: false, source: "" };
const ok = (body: unknown) => new Response(JSON.stringify(body));
const fail = (status: number) => new Response("", { status });
const ctx = (signal = new AbortController().signal) => ({ signal }) as never;
const opts = (url: string) => queryOptions({ queryKey: ["t", url], queryFn: ({ signal }) => getJson<{ n: number }>(url, { signal }) });
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("keys", () => {
  it("differ only in the view part between two views", () => {
    const a = queries.usage(v).queryKey, b = queries.usage({ ...v, range: 7 }).queryKey;
    expect(a[0]).toBe(b[0]);
    expect(a[2]).toBe(b[2]);
    expect(hashKey(a)).not.toBe(hashKey(b));
  });
  it("ignore key order and extra fields of the view", () => {
    const reordered = { source: "", automated: false, range: 30, project: "p" } as View;
    const extra = { ...v, auto: true, extra: 1 } as View;
    expect(hashKey(queries.usage(reordered).queryKey)).toBe(hashKey(queries.usage(v).queryKey));
    expect(hashKey(queries.context(extra).queryKey)).toBe(hashKey(queries.context(v).queryKey));
  });
  it("leave automated out of limits", () => {
    expect(hashKey(queries.limits({ ...v, automated: true }).queryKey)).toBe(hashKey(queries.limits(v).queryKey));
    expect(hashKey(queries.limits({ ...v, range: 7 }).queryKey)).not.toBe(hashKey(queries.limits(v).queryKey));
  });
  it("tell data from status and live", () => {
    expect(isData({ queryKey: ["usage", v, ""] })).toBe(true);
    expect(isData(queries.errors)).toBe(true);
    expect(isData(queries.status)).toBe(false);
    expect(isData({ queryKey: ["live", "x"] })).toBe(false);
    expect(isData(queries.errorDetail("x"))).toBe(false);
  });
  it("keep the sessions pages apart from the plain sessions list, and by every filter and the sort", () => {
    const o = { q: "a", near: true, day: "2026-11-04", sort: [{ key: "cost" as const, desc: true }] };
    const pages = queries.sessionPages(v, o).queryKey;
    expect(pages).toEqual(["sessions", "pages", { project: "p", range: 30, automated: false, source: "" }, o]);
    expect(hashKey(pages)).not.toBe(hashKey(queries.sessions(v, { q: "a" }).queryKey));
    expect(isData({ queryKey: pages })).toBe(true);
    for (const o2 of [{ ...o, q: "b" }, { ...o, near: false }, { ...o, day: "" }, { ...o, sort: [{ key: "tokens" as const, desc: true }] },
      { ...o, sort: [{ key: "cost" as const, desc: false }] }, { ...o, sort: [...o.sort, { key: "prompts" as const, desc: true }] }]) {
      expect(hashKey(queries.sessionPages(v, o2).queryKey)).not.toBe(hashKey(pages));
    }
  });
  it("ask for the next sessions page by the count loaded, and stop at the total", () => {
    const next = queries.sessionPages(v).getNextPageParam!;
    const page = (n: number, total: number) => ({ total, offset: 0, sessions: Array.from({ length: n }, () => ({}) as never) });
    expect(next(page(100, 250), [page(100, 250)], 0, [0])).toBe(100);
    expect(next(page(100, 250), [page(100, 250), page(100, 250)], 100, [0, 100])).toBe(200);
    expect(next(page(50, 250), [page(100, 250), page(100, 250), page(50, 250)], 200, [0, 100, 200])).toBeUndefined();
  });
  it("hold errorDetail forever", () => {
    expect(queries.errorDetail("x").staleTime).toBe(Infinity);
  });
});

describe("status", () => {
  const interval = (data?: Partial<Status>) => {
    const client = makeTestClient();
    if (data) client.setQueryData(queries.status.queryKey, data as Status);
    const fn = queries.status.refetchInterval as (q: unknown) => number;
    return fn(client.getQueryCache().find({ queryKey: queries.status.queryKey }) ?? { state: {} });
  };
  it("polls every 3 s while ingesting, else every 60 s", () => {
    expect(interval({ ingesting: true })).toBe(3_000);
    expect(interval({ ingesting: false })).toBe(60_000);
    expect(interval()).toBe(60_000);
  });
  it("is always stale, refetches on every focus and not in the background", () => {
    expect(queries.status.staleTime).toBe(0);
    expect(queries.status.refetchOnWindowFocus).toBe("always");
    expect(queries.status.refetchIntervalInBackground).toBe(false);
  });
  it("fetches at low priority with a signal", async () => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => ok({}));
    vi.stubGlobal("fetch", f);
    await (queries.status.queryFn as (c: unknown) => Promise<unknown>)(ctx());
    expect(f).toHaveBeenCalledWith("/api/status", expect.objectContaining({ priority: "low", signal: expect.any(AbortSignal) }));
  });
});

describe("live", () => {
  const event = (key: string, summary = key) => ({ key, k: "tool", ts: null, lane: null, summary }) as unknown as LiveEvent;
  const answer = (cursor: string | null, ...events: LiveEvent[]) => ({ session_id: "s1", cursor, truncated: false, events }) as LiveSession;
  /** fetch answering the session requests in turn; the URLs and inits it got. */
  const stub = (...answers: LiveSession[]) => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => ok(answers.shift()));
    vi.stubGlobal("fetch", f);
    return f;
  };
  /** Fetches the session, and answers what the cache then holds (what the page draws). */
  const asker = () => {
    const client = makeTestClient(), o = queries.liveSession("s1");
    return async () => { await client.fetchQuery(o); return client.getQueryData(o.queryKey)!; };
  };

  it("key the list by project, automated, source and text, and the session by id and text", () => {
    expect(queries.liveList(v, true).queryKey).toEqual(["live", "list", { project: "p", automated: false, source: "" }, true]);
    expect(hashKey(queries.liveList({ ...v, range: 7 }).queryKey)).toBe(hashKey(queries.liveList(v).queryKey)); // Live has no range
    expect(hashKey(queries.liveList({ ...v, automated: true }).queryKey)).not.toBe(hashKey(queries.liveList(v).queryKey));
    expect(queries.liveSession("s1").queryKey).toEqual(["live", "session", "s1", false]);
    expect(hashKey(queries.liveSession("s1", true).queryKey)).not.toBe(hashKey(queries.liveSession("s1").queryKey));
    expect([isData(queries.liveList(v)), isData(queries.liveSession("s1"))]).toEqual([false, false]);
  });

  it("are always stale and leave the return to the tab to the page", () => {
    for (const o of [queries.liveList(v), queries.liveSession("s1")]) expect([o.staleTime, o.refetchOnWindowFocus]).toEqual([0, false]);
  });

  it("ask for the session from the start, then for what came after its cursor, and merge that in", async () => {
    const f = stub(answer("c1", event("a"), event("b")), answer("c2", event("b", "done"), event("c")), answer(null));
    const ask = asker(), first = await ask(), second = await ask();
    expect(f.mock.calls.map(c => c[0])).toEqual(["/api/live/session?id=s1", "/api/live/session?id=s1&after=c1"]);
    expect(second).toMatchObject({ cursor: "c2", events: [{ key: "a" }, { key: "b", summary: "done" }, { key: "c" }] }); // b replaced in place
    expect(second.events[0]).toBe(first.events[0]); // an event the catch-up did not bring is the same object: its row is not drawn again
    expect((await ask()).cursor).toBe("c2"); // an answer with no cursor keeps the one held
    expect(f.mock.calls.at(-1)![0]).toBe("/api/live/session?id=s1&after=c2");
  });

  it("ask from the start for the same session with text: it is another query", async () => {
    const f = stub(answer("c1", event("a")), answer("c1", event("a")));
    const client = makeTestClient();
    await client.fetchQuery(queries.liveSession("s1"));
    await client.fetchQuery(queries.liveSession("s1", true));
    expect(f.mock.calls.map(c => c[0])).toEqual(["/api/live/session?id=s1", "/api/live/session?id=s1&text=1"]);
  });

  it("keep each event's object when a catch-up pushes the oldest off the top", async () => {
    const full = Array.from({ length: KEEP }, (_, i) => event("e" + i));
    stub(answer("c1", ...full), answer("c2", event("new")));
    const ask = asker(), first = await ask(), second = await ask();
    expect([second.events.length, second.truncated, second.events.at(-1)!.key]).toEqual([KEEP, true, "new"]);
    expect(second.events[0]).toBe(first.events[1]); // Query's structural sharing would copy every event here
  });

  it("send the recheck's priority with the signal, and the page's own requests with the signal alone", async () => {
    const f = stub(answer("c1"), answer("c2"), answer(null));
    const client = makeTestClient(), low: RequestInit = { priority: "low" };
    await client.fetchQuery(queries.liveSession("s1"));
    await client.fetchQuery(queries.liveSession("s1", false, low));
    await client.fetchQuery(queries.liveList(v, false, low));
    expect(f.mock.calls.map(c => c[1])).toEqual([{ signal: expect.any(AbortSignal) }, ...[1, 2].map(() => ({ priority: "low", signal: expect.any(AbortSignal) }))]);
  });
});

describe("getJson", () => {
  it("rejects with an AbortError for an aborted signal", async () => {
    vi.stubGlobal("fetch", (_: string, init?: RequestInit) =>
      init?.signal?.aborted ? Promise.reject(new DOMException("aborted", "AbortError")) : Promise.resolve(ok({})));
    const c = new AbortController();
    c.abort();
    await expect(getJson("/x", { signal: c.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("useApi", () => {
  const stub = (answers: Record<string, () => Response | Promise<Response>>) => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => Promise.resolve(answers[url]!()));
    vi.stubGlobal("fetch", f);
    return f;
  };

  it("loads: undefined and loading, then the data", async () => {
    stub({ "/a": () => ok({ n: 1 }) });
    const { result } = renderHook(() => useApi(opts("/a")), { wrapper: wrapper(makeTestClient()) });
    expect(result.current).toMatchObject({ data: undefined, loading: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ n: 1 });
  });

  it("answers a cached key at once with no request", async () => {
    const f = stub({ "/a": () => ok({ n: 1 }), "/b": () => ok({ n: 2 }) });
    const { result, rerender } = renderHook(({ u }) => useApi(opts(u)), { wrapper: wrapper(makeTestClient()), initialProps: { u: "/a" } });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    rerender({ u: "/b" });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    f.mockClear();
    rerender({ u: "/a" });
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("answers a remount from the cache", async () => {
    const f = stub({ "/a": () => ok({ n: 1 }) });
    const w = wrapper(makeTestClient());
    const first = renderHook(() => useApi(opts("/a")), { wrapper: w });
    await waitFor(() => expect(first.result.current.data).toEqual({ n: 1 }));
    first.unmount();
    f.mockClear();
    const { result } = renderHook(() => useApi(opts("/a")), { wrapper: w });
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps data through an invalidation and the same object for an equal answer", async () => {
    let n = 1;
    stub({ "/a": () => delay(150).then(() => ok({ n, same: [1] })) });
    const client = makeTestClient();
    const { result } = renderHook(() => useApi(opts("/a")), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const old = result.current.data;
    act(() => { void client.invalidateQueries(); });
    await waitFor(() => expect(result.current.loading).toBe(true)); // Query tells observers on a timer
    expect(result.current.data).toBe(old);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(old);
    n = 2;
    await act(async () => { void client.invalidateQueries(); });
    await waitFor(() => expect(result.current.data).toMatchObject({ n: 2 }));
  });

  it("drops data on a key change without keepPrevious", async () => {
    stub({ "/a": () => ok({ n: 1 }), "/b": () => delay(20).then(() => ok({ n: 2 })) });
    const { result, rerender } = renderHook(({ u }) => useApi(opts(u)), { wrapper: wrapper(makeTestClient()), initialProps: { u: "/a" } });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    rerender({ u: "/b" });
    expect(result.current).toMatchObject({ data: undefined, loading: true });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
  });

  it("keeps the old data while a new key loads, then shows the new", async () => {
    stub({ "/a": () => ok({ n: 1 }), "/b": () => delay(20).then(() => ok({ n: 2 })) });
    const { result, rerender } = renderHook(({ u }) => useApi(opts(u), { keepPrevious: true }), { wrapper: wrapper(makeTestClient()), initialProps: { u: "/a" } });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    rerender({ u: "/b" });
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: true });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(result.current.loading).toBe(false);
  });

  it("keeps the old data when the new key fails, with the error", async () => {
    stub({ "/a": () => ok({ n: 1 }), "/b": () => fail(500) });
    const { result, rerender } = renderHook(({ u }) => useApi(opts(u), { keepPrevious: true }), { wrapper: wrapper(makeTestClient()), initialProps: { u: "/a" } });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    rerender({ u: "/b" });
    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: false });
  });

  it("reports a failure, and Retry refetches with the error hidden meanwhile", async () => {
    let fails = true;
    stub({ "/a": () => (fails ? fail(500) : delay(150).then(() => ok({ n: 1 }))) });
    const { result } = renderHook(() => useApi(opts("/a")), { wrapper: wrapper(makeTestClient()) });
    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
    expect(result.current).toMatchObject({ data: undefined, loading: false });
    fails = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.error).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(result.current.error).toBeUndefined();
  });

  it("aborts the first request on a key change and never shows its late answer", async () => {
    const signals: Record<string, AbortSignal | null | undefined> = {};
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      signals[url] = init?.signal;
      return delay(url === "/a" ? 40 : 5).then(() => ok({ url }));
    });
    const { result, rerender } = renderHook(({ u }) => useApi(queryOptions({ queryKey: ["t", u] as QueryKey, queryFn: ({ signal }) => getJson<{ url: string }>(u, { signal }) })),
      { wrapper: wrapper(makeTestClient()), initialProps: { u: "/a" } });
    await waitFor(() => expect(signals["/a"]).toBeDefined());
    rerender({ u: "/b" });
    await waitFor(() => expect(result.current.data).toEqual({ url: "/b" }));
    expect(signals["/a"]?.aborted).toBe(true);
    await act(async () => { await delay(60); });
    expect(result.current.data).toEqual({ url: "/b" });
  });

  it("fetches nothing for null", async () => {
    const f = stub({});
    const { result } = renderHook(() => useApi<{ n: number }>(null), { wrapper: wrapper(makeTestClient()) });
    expect(result.current).toMatchObject({ data: undefined, loading: false, error: undefined });
    await act(async () => { await delay(10); });
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps old data for null with keepPrevious", async () => {
    stub({ "/a": () => ok({ n: 1 }) });
    const { result, rerender } = renderHook(({ o }) => useApi(o, { keepPrevious: true }), { wrapper: wrapper(makeTestClient()), initialProps: { o: opts("/a") as ReturnType<typeof opts> | null } });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    rerender({ o: null });
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: false });
  });

  it("keeps retry's identity across renders", async () => {
    stub({ "/a": () => ok({ n: 1 }) });
    const { result, rerender } = renderHook(() => useApi(opts("/a")), { wrapper: wrapper(makeTestClient()) });
    const first = result.current.retry;
    await waitFor(() => expect(result.current.data).toBeDefined());
    rerender();
    expect(result.current.retry).toBe(first);
  });
});
