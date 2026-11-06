import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clearApiCache, noteIngest, useApi } from "./useApi";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

describe("useApi", () => {
  it("caches by URL, keeps data through a refetch and retries failures", async () => {
    let n = 0;
    const f = vi.fn((url: string) => url === "/bad" ? json({}, false) : json({ n: ++n, url }));
    vi.stubGlobal("fetch", f);
    const { result, rerender } = renderHook(({ url }) => useApi<{ n: number }>(url), { initialProps: { url: "/a" } });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data?.n).toBe(1));
    rerender({ url: "/b" });
    await waitFor(() => expect(result.current.data?.n).toBe(2));
    rerender({ url: "/a" }); // cached: no request, no loading
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: false });
    expect(f).toHaveBeenCalledTimes(2);
    act(() => clearApiCache());
    expect(result.current).toMatchObject({ data: { n: 1 }, loading: true });
    await waitFor(() => expect(result.current.data?.n).toBe(3));
    rerender({ url: "/bad" });
    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
    expect(result.current.data).toBeUndefined();
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(5));
  });

  it("keepPrevious shows the last view while the next loads", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json({ url })));
    const { result, rerender } = renderHook(({ url }) => useApi<{ url: string }>(url, { keepPrevious: true }), { initialProps: { url: "/x" } });
    await waitFor(() => expect(result.current.data?.url).toBe("/x"));
    rerender({ url: "/y" });
    expect(result.current).toMatchObject({ data: { url: "/x" }, loading: true });
    await waitFor(() => expect(result.current.data?.url).toBe("/y"));
  });

  it("clears the cache when last_ingest changes", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(() => json({ n: ++n })));
    noteIngest("t1");
    const { result } = renderHook(() => useApi<{ n: number }>("/c"));
    await waitFor(() => expect(result.current.data?.n).toBe(1));
    act(() => noteIngest("t1"));
    expect(result.current.loading).toBe(false);
    act(() => noteIngest("t2"));
    await waitFor(() => expect(result.current.data?.n).toBe(2));
  });
});
