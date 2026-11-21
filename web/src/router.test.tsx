import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usage from "./__fixtures__/usage";
import { ROUTES } from "./App";
import { renderRouter } from "./testing";
import { setSearch } from "./url";

// The tabs; the Project page has none and needs a project, so it has tests of its own below.
const PATHS = (Object.keys(ROUTES) as (keyof typeof ROUTES)[]).filter(p => p !== "/project");
const TABS: Record<string, string> = { "/usage": "Activity", "/cost": "Cost", "/context": "Context", "/errors": "Errors", "/limits": "Limits", "/live": "Live" };
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
  // A page's data now arrives before the page renders (its route's loader starts it), so an endpoint with no fixture here
  // answers 404 (the page shows its error state) rather than `{}`, a payload the page cannot draw.
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const body = url.startsWith("/api/status") ? status : url.startsWith("/api/usage") ? usage : undefined;
    return Promise.resolve({ ok: body !== undefined, status: body !== undefined ? 200 : 404, json: () => Promise.resolve(body) } as Response);
  }));
});

describe("router", () => {
  it.each(PATHS)("opens %s with its title and its tab marked current", async path => {
    open(path);
    await loaded(path);
    // Within the nav: a page that has its data at once has links to other pages of its own.
    const tab = (p: string) => within(screen.getByRole("navigation", { name: "Dashboards" })).getByRole("link", { name: TABS[p]! });
    expect(tab(path).getAttribute("aria-current")).toBe("page");
    for (const p of PATHS.filter(p => p !== path)) expect(tab(p).getAttribute("aria-current")).toBeNull();
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

  // The routes validate their keys, and the router writes the URL back when validation changes it. A typed value must
  // be written as it was read, and a value that is not valid must stay as the user wrote it.
  describe("a URL with every key a page reads", () => {
    const urls = [
      "/usage?project=foo&range=7&source=claude&auto=1&q=abc&near=1&day=2026-11-03&session=s1",
      "/cost?project=foo&range=14&source=codex&auto=1&session=s1",
      "/context?project=foo&range=90&tip=t1",
      "/errors?project=foo&range=0&source=codex&sub=0&noise=0&gran=week&at=2026-11-03&etool=Bash&cat=x",
      "/limits?project=foo&range=30",
      "/usage?project=foo&range=90&view=judgments&outcome=achieved&friction=1&help=h&goal=g&fr=f&goalf=gf&frf=ff&session=s1",
      "/live?source=claude&view=wall",
    ];
    it.each(urls)("is unchanged by loading %s", async url => {
      const { length } = open(url);
      await loaded(url.split("?")[0] as keyof typeof ROUTES);
      expect(here()).toBe(url);
      expect(history.length).toBe(length);
    });
  });

  it("types the search of a route's match, and writes a typed value as the URL had it", async () => {
    const { router } = open("/usage?range=7&near=1&nosuchkey=1&day=never");
    await loaded("/usage");
    // The router lays the valid, typed values over the keys as written: what is unknown or not valid stays a string.
    await waitFor(() => expect(router.state.matches.at(-1)?.search).toEqual({ range: 7, near: true, nosuchkey: "1", day: "never" }));
    act(() => setSearch({ q: "x" }));
    expect(here()).toBe("/usage?range=7&near=1&nosuchkey=1&day=never&q=x");
  });

  describe("a URL with values that are not valid", () => {
    const urls = ["/usage?range=abc&near=0&day=2026-02-30", "/context?range=12&auto=yes", "/usage?range=-1&view=judgments&friction=0", "/usage?view=nosuchview", "/live?view=grid", "/cost?range=7.5"];
    it.each(urls)("opens the page with %s, and leaves the URL as written", async url => {
      open(url);
      await loaded(url.split("?")[0] as keyof typeof ROUTES);
      expect(here()).toBe(url);
      expect(document.getElementById("content")).not.toBeNull();
      expect(screen.queryByText(/something went wrong/i)).toBeNull();
    });
  });

  it.each([["/", "/usage"], ["/nosuchpage?project=foo", "/usage?project=foo"]])("lands %s on %s without a new entry", async (from, to) => {
    const { length } = open(from);
    await waitFor(() => expect(location.pathname).toBe("/usage"));
    await loaded("/usage");
    expect(here()).toBe(to);
    expect(history.length).toBe(length);
  });

  // /insights was a page before it became Activity's Judgments view: its links must keep opening what they named.
  describe("the old /insights address", () => {
    const cases: [string, string][] = [
      ["/insights", "/usage?view=judgments"],
      ["/insights?project=foo&range=7&source=claude&auto=1", "/usage?project=foo&range=7&source=claude&auto=1&view=judgments"],
      ["/insights?range=7&outcome=not_achieved&friction=1&frf=tooling", "/usage?range=7&view=judgments&outcome=not_achieved&friction=1&frf=tooling"],
      ["/insights?project=foo&session=abc", "/usage?project=foo&view=judgments&session=abc"],
      ["/insights#project=foo&range=30", "/usage?project=foo&range=30&view=judgments"], // the earlier hash form, too
      ["/insights?range=0#d-goals", "/usage?range=0&view=judgments#d-goals"], // a section anchor, kept
    ];
    it.each(cases)("opens %s as the Judgments view, with every key kept and no new entry", async (old, now) => {
      const { length } = open(old);
      await waitFor(() => expect(here()).toBe(now));
      await loaded("/usage");
      await waitFor(() => expect(document.querySelector("main.pg-judgments")).toBeTruthy());
      expect(within(screen.getByRole("navigation", { name: "Dashboards" })).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("page");
      expect(here()).toBe(now);
      expect(history.length).toBe(length);
    });

    it("opens Overview for a Codex-only link, with the view dropped from the URL and Judgments not available", async () => {
      const { length } = open("/insights?range=7&source=codex&outcome=not_achieved");
      await waitFor(() => expect(here()).toBe("/usage?range=7&source=codex"));
      await waitFor(() => expect(document.querySelector("main.pg-activity")).toBeTruthy());
      expect(document.querySelector("main.pg-judgments")).toBeNull();
      const judgments = await screen.findByRole("button", { name: "Judgments" });
      expect(judgments.getAttribute("aria-disabled")).toBe("true");
      expect(history.length).toBe(length);
    });

    it("opens an old link followed while the app is open, as one entry", async () => {
      const { router } = open("/cost?range=14");
      await loaded("/cost");
      const length = history.length;
      await act(() => router.navigate({ to: "/insights", search: { range: "14", outcome: "not_achieved" } } as never));
      await waitFor(() => expect(here()).toBe("/usage?range=14&view=judgments&outcome=not_achieved"));
      expect(history.length).toBe(length + 1);
    });
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
      expect(await screen.findByRole("link", { name: "Brief, foo project page" })).toBeTruthy();
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

describe("the Project page", () => {
  const tabs = () => within(screen.getByRole("navigation", { name: "Dashboards" }));
  it("opens at /project?project=foo with no tab current, and keeps the URL", async () => {
    const { length } = open("/project?project=foo&range=7");
    await loaded("/project");
    expect(here()).toBe("/project?project=foo&range=7");
    expect(history.length).toBe(length);
    expect(await screen.findByRole("heading", { level: 1, name: "foo" })).toBeTruthy();
    for (const p of PATHS) expect(tabs().getByRole("link", { name: TABS[p]! }).getAttribute("aria-current")).toBeNull();
  });

  it("opens Activity, with the view kept, when the URL names no project", async () => {
    const { length } = open("/project?range=7&source=codex");
    await waitFor(() => expect(location.pathname).toBe("/usage"));
    await loaded("/usage");
    expect(here()).toBe("/usage?range=7&source=codex");
    expect(history.length).toBe(length);
  });

  it("opens Activity when the project is cleared on the page, and Back does not return to a Project page without a project", async () => {
    open("/usage?range=7&source=claude");
    await loaded("/usage");
    act(() => setSearch({ project: "foo" }));
    await userEvent.click(tabs().getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    await userEvent.click(await screen.findByRole("link", { name: "Brief, foo project page" }));
    await loaded("/project");
    expect(here()).toBe("/project?project=foo&range=7&source=claude");
    await screen.findByRole("heading", { level: 1, name: "foo" });
    await userEvent.click(screen.getByRole("button", { name: "Clear project filter" }));
    await waitFor(() => expect(location.pathname).toBe("/usage"));
    expect(here()).toBe("/usage?range=7&source=claude");
    act(() => history.back());
    await waitFor(() => expect(location.pathname).toBe("/project"));
    expect(location.search).toBe("?project=foo&range=7&source=claude");
  });

  it("keeps the project when a tab is chosen", async () => {
    open("/project?project=foo&range=30");
    await loaded("/project");
    await userEvent.click(tabs().getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    expect(here()).toBe("/cost?project=foo&range=30");
  });
});

describe("a key no page knows", () => {
  it("is ignored: the page shows as it would without it", async () => {
    open("/cost?project=foo&nosuchkey=1");
    await loaded("/cost");
    expect((await screen.findByRole("link", { name: "Brief, foo project page" })).getAttribute("href")).toBe("/project?project=foo");
    expect(screen.getByRole("link", { name: "Cost" }).getAttribute("aria-current")).toBe("page");
  });
});
