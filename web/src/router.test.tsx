import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usage from "./__fixtures__/usage";
import { ROUTES } from "./App";
import { renderRouter } from "./testing";
import { setSearch } from "./url";

const PATHS = Object.keys(ROUTES) as (keyof typeof ROUTES)[];
const TABS: Record<string, string> = { "/usage": "Activity", "/cost": "Cost", "/context": "Context", "/errors": "Errors", "/limits": "Limits", "/insights": "Insights", "/live": "Live" };
const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const here = () => location.pathname + location.search + location.hash;
const title = (path: keyof typeof ROUTES) => ROUTES[path].title;
/** Opens url and renders the app; the history length before rendering comes back with it. */
const open = (url: string) => {
  history.replaceState(null, "", url);
  const length = history.length;
  return { length, ...renderRouter() };
};
/** The page's title is set once its route has loaded. */
const loaded = (path: keyof typeof ROUTES) => waitFor(() => expect(document.title).toBe(title(path)));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(url.startsWith("/api/status") ? status : url.startsWith("/api/usage") ? usage : {}) } as Response)));
});

describe("router", () => {
  it.each(PATHS)("opens %s with its title and its tab marked current", async path => {
    open(path);
    await loaded(path);
    expect(screen.getByRole("link", { name: TABS[path]! }).getAttribute("aria-current")).toBe("page");
    for (const p of PATHS.filter(p => p !== path)) expect(screen.getByRole("link", { name: TABS[p]! }).getAttribute("aria-current")).toBeNull();
  });

  describe("a canonical URL", () => {
    const urls = [...PATHS.map(p => p + "?project=foo&range=7"), "/errors?range=30&sub=0&cat=x"];
    it.each(urls)("is unchanged by loading %s", async url => {
      const { length } = open(url);
      await loaded(url.split("?")[0] as keyof typeof ROUTES);
      expect(here()).toBe(url);
      expect(history.length).toBe(length);
    });
  });

  it.each([["/", "/usage"], ["/nosuchpage?project=foo", "/usage?project=foo"]])("lands %s on %s without a new entry", async (from, to) => {
    const { length } = open(from);
    await waitFor(() => expect(location.pathname).toBe("/usage"));
    await loaded("/usage");
    expect(here()).toBe(to);
    expect(history.length).toBe(length);
  });

  describe("the old hash form", () => {
    const cases: [string, string][] = [
      ["/usage#project=foo&range=30&source=claude&auto=1&session=abc", "/usage?project=foo&range=30&source=claude&auto=1&session=abc"],
      ["/errors#ex=12345&cat=timeout", "/errors?ex=12345&cat=timeout"],
      ["/usage#project=123&range=7", "/usage?project=123&range=7"],
      ["/usage#project=my%20proj%2Fsub&session=true", "/usage?project=my+proj%2Fsub&session=true"],
      ["/usage?project=old&range=7#project=new", "/usage?project=new"],
    ];
    it.each(cases)("opens %s as the query string", async (old, now) => {
      const { length } = open(old);
      await waitFor(() => expect(location.search).toBe(now.slice(now.indexOf("?"))));
      await loaded(now.split("?")[0] as keyof typeof ROUTES);
      expect(location.pathname + location.search).toBe(now);
      expect(location.hash).toBe("");
      expect(history.length).toBe(length);
    });

    it("leaves a hash with no = as it is", async () => {
      const { length } = open("/usage#history");
      await loaded("/usage");
      expect(here()).toBe("/usage#history");
      expect(history.length).toBe(length);
    });

    it("opens an old link entered while the app is open", async () => {
      open("/usage");
      await loaded("/usage");
      act(() => { location.hash = "#project=foo"; });
      await waitFor(() => expect(location.search).toBe("?project=foo"));
      expect(location.hash).toBe("");
      await waitFor(() => expect(document.querySelector("#navFilter")?.textContent).toContain("foo"));
    });
  });

  describe("scrolling", () => {
    it("moves to the top on a page switch and stays put on a view change", async () => {
      const scroll = vi.spyOn(window, "scrollTo");
      open("/usage");
      await loaded("/usage");
      await userEvent.click(screen.getByRole("link", { name: "Cost" }));
      await loaded("/cost");
      expect(scroll).toHaveBeenCalled();
      expect(scroll.mock.calls.at(-1)).toEqual([{ top: 0, left: 0 }]);
      scroll.mockClear();
      act(() => setSearch({ range: 7 }));
      await new Promise(r => setTimeout(r, 20));
      expect(scroll).not.toHaveBeenCalled();
    });
  });
});

describe("a key no page knows", () => {
  it("is ignored: the page shows as it would without it", async () => {
    open("/cost?project=foo&nosuchkey=1");
    await loaded("/cost");
    expect(document.querySelector("#navFilter b")?.textContent).toBe("foo");
    expect(screen.getByRole("link", { name: "Cost" }).getAttribute("aria-current")).toBe("page");
  });
});
