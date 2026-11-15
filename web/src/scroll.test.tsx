// Scroll restoration (router.tsx `scrollRestoration`). jsdom has no layout: scrollTo is a spy that moves scrollY, and a
// scroll event on the document is what the router listens to for "the page was scrolled". Whether the browser really
// lands on the saved pixel once the page has its height is left to a real browser.
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import usage from "./__fixtures__/usage";
import { ROUTES } from "./App";
import { renderRouter } from "./testing";
import { closeSheets, go, setSearch } from "./url";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const loaded = (path: keyof typeof ROUTES) => waitFor(() => expect(document.title).toBe(ROUTES[path].title));
const settle = () => new Promise(r => setTimeout(r, 30));
let y = 0, scrollTo: ReturnType<typeof vi.fn>;
/** The user scrolls the window to `top`. */
const scrollBy = (top: number) => { y = top; document.dispatchEvent(new Event("scroll")); };
// The router tracks a scroll only after its render has finished, a tick after the title: open() and a page switch wait for it.
const open = async (url: string) => { history.replaceState(null, "", url); const r = renderRouter(); await loaded(url.split("?")[0] as keyof typeof ROUTES); await settle(); return r; };

beforeEach(() => {
  y = 0;
  scrollTo = vi.fn((o: ScrollToOptions) => { y = o.top ?? 0; });
  vi.stubGlobal("scrollTo", scrollTo);
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(url.startsWith("/api/status") ? status : url.startsWith("/api/usage") ? usage : {}) } as Response)));
});
afterEach(() => { vi.unstubAllGlobals(); delete (window as { scrollY?: number }).scrollY; try { sessionStorage.clear(); } catch { /* off */ } });

describe("scroll restoration", () => {
  it("Back returns a page to the position it had, Forward too", async () => {
    await open("/usage");
    scrollBy(500);
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    expect(scrollTo.mock.calls.at(-1)).toEqual([{ top: 0, left: 0 }]);
    await settle();
    scrollBy(120);
    act(() => history.back());
    await loaded("/usage");
    await settle();
    await waitFor(() => expect(scrollTo.mock.calls.at(-1)).toEqual([{ top: 500, left: 0 }]));
    act(() => history.forward());
    await loaded("/cost");
    await waitFor(() => expect(scrollTo.mock.calls.at(-1)).toEqual([{ top: 120, left: 0 }]));
  });

  it("a page switch by go() starts at the top, whatever the page above was", async () => {
    await open("/usage");
    scrollBy(300);
    act(() => go("/cost"));
    await loaded("/cost");
    expect(scrollTo.mock.calls.at(-1)).toEqual([{ top: 0, left: 0 }]);
    expect(y).toBe(0);
  });

  it("a filter change or a sheet opening makes no scroll", async () => {
    await open("/usage");
    scrollBy(500);
    scrollTo.mockClear();
    act(() => setSearch({ range: 7 }));
    await settle();
    act(() => setSearch({ session: "s1" }));
    await settle();
    expect(location.search).toContain("session=s1");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(y).toBe(500);
  });

  it("closing a sheet returns to the entry under it at the position it had when the sheet opened", async () => {
    await open("/usage");
    scrollBy(500);
    act(() => setSearch({ session: "s1" }));
    await settle();
    scrollTo.mockClear();
    act(() => closeSheets({ session: undefined }));
    await waitFor(() => expect(location.search).not.toContain("session"));
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(scrollTo.mock.calls.at(-1)).toEqual([{ top: 500, left: 0 }]);
  });

  // A write that changes nothing rewrites a URL spelled in another key order (url.ts). It is the same view: it must not
  // move the page either.
  it("a write that only respells the URL makes no scroll call", async () => {
    await open("/usage?range=7&project=foo");
    scrollBy(400);
    scrollTo.mockClear();
    act(() => setSearch({ range: 7 }));
    expect(location.search).toBe("?project=foo&range=7");
    await settle();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
