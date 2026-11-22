import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import session from "./__fixtures__/session";
import usage from "./__fixtures__/usage";
import calendar from "./__fixtures__/calendar";
import { ROUTES } from "./App";
import { renderRouter } from "./testing";
import { setSearch } from "./url";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const answer = (url: string) => url.startsWith("/api/status") ? status : url.startsWith("/api/usage") ? usage : url.startsWith("/api/calendar") ? calendar
  : url.startsWith("/api/sessions") ? { total: 0, offset: 0, sessions: [] } : url.startsWith("/api/session?") ? session : {};
const loaded =(path: keyof typeof ROUTES) => waitFor(() => expect(document.title).toBe(ROUTES[path].title));
let start: ReturnType<typeof vi.fn>;

// The router starts a transition once the new page's route has loaded, which can be after the title changes.
const settled = () => act(() => new Promise<void>(r => setTimeout(r, 50)));

/** Opens url with the API stubbed in; reduced says whether the user asked for less motion. */
const open = async (url: string, reduced = false) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  history.replaceState(null, "", url);
  renderRouter();
  await loaded(url.split("?")[0] as keyof typeof ROUTES);
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(answer(url)) } as Response)));
  // jsdom has no View Transitions: the stub runs the update, as a browser does, and resolves.
  start = vi.fn((arg: unknown) => {
    const update = typeof arg === "function" ? arg : (arg as { update: () => unknown }).update;
    const done = Promise.resolve(update()).then(() => undefined);
    return { finished: done, ready: done, updateCallbackDone: done, skipTransition() {} };
  });
  vi.stubGlobal("CSS", { supports: () => true });
  Object.defineProperty(document, "startViewTransition", { value: start, configurable: true, writable: true });
});

describe("view transitions", () => {
  it("starts one for a page switch by tab click, typed as a page", async () => {
    await open("/usage");
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await settled();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]![0]).toMatchObject({ types: ["page"] });
  });

  it("starts none for a filter change, nor when a session sheet opens", async () => {
    await open("/usage");
    await settled();
    act(() => setSearch({ range: 7 }));
    await waitFor(() => expect(location.search).toContain("range=7"));
    await settled();
    expect(start).not.toHaveBeenCalled();
    act(() => setSearch({ session: "s1" }));
    await waitFor(() => expect(location.search).toContain("session=s1"));
    await settled();
    expect(start).not.toHaveBeenCalled();
  });

  it("starts none for a page switch under reduced motion", async () => {
    await open("/usage", true);
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    await settled();
    expect(start).not.toHaveBeenCalled();
  });

  // Chrome before 125 and Safari 18.0 have view transitions without types: the router would crossfade every navigation.
  it("starts none in a browser without transition types", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    await open("/usage");
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    await loaded("/cost");
    act(() => setSearch({ range: 7 }));
    await new Promise(r => setTimeout(r, 50));
    expect(start).not.toHaveBeenCalled();
  });
});
