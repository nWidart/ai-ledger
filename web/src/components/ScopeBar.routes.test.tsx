// The scope bar in the whole app, routes and all: page switches with a page's code or data late, Back and Forward, a failed
// filter change, and the narrow popover across page changes.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigate } from "../url";
import { renderRouter } from "../testing";
import { VIEW_KEY } from "../pages/errors/view";
import context from "../__fixtures__/context";
import errors from "../__fixtures__/errors";
import insights from "../__fixtures__/insights";
import limits from "../__fixtures__/limits";
import usage from "../__fixtures__/usage";

// Errors' code waits for open(): the first test to show Errors holds it back; the module is then loaded for the rest.
const chunk = vi.hoisted(() => { let open!: () => void; const gate = new Promise<void>(r => { open = r; }); return { gate, open }; });
vi.mock("../pages/errors/ErrorsPage", async orig => { await chunk.gate; return orig(); });

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const failed = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "boom" }) } as Response);
/** The API: /api/errors waits while held (hold() returns its release), fail(q) answers 500 to the usage requests it says yes to. */
function serve() {
  const api = {
    held: null as Promise<void> | null, failErrors: false, fail: null as ((q: URLSearchParams) => boolean) | null,
    hold() { let release!: () => void; api.held = new Promise<void>(r => { release = r; }); return release; },
  };
  const bodies: Record<string, unknown> = { "/api/status": status, "/api/context": context, "/api/insights": insights, "/api/limits": limits };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = new URL(url, "http://x");
    if (u.pathname === "/api/errors") { if (api.held) await api.held; return api.failErrors ? failed() : ok(errors); }
    if (u.pathname === "/api/usage" && api.fail?.(u.searchParams)) return failed();
    return ok(bodies[u.pathname] ?? usage);
  }));
  return api;
}
/** jsdom applies no media query: this one says the window is as narrow as a phone (390px), or as wide as a laptop. */
const width = (narrow: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: narrow && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
const bar = () => within(document.querySelector<HTMLElement>(".scopebar")!);
const field = () => document.getElementById("fProject") as HTMLInputElement;
const pressed = (group: string) => bar().getByRole("group", { name: group }).querySelector("[aria-pressed=true]")!.textContent;
const options = () => screen.getAllByRole("option").map(o => o.textContent);
const tab = (name: string) => within(document.querySelector<HTMLElement>("nav.appnav")!).getByRole("link", { name: new RegExp("^" + name) });
const back = () => act(async () => { history.back(); await new Promise(r => setTimeout(r, 0)); });
const forward = () => act(async () => { history.forward(); await new Promise(r => setTimeout(r, 0)); });
const popover = () => screen.queryByRole("dialog", { name: "Filters" });

beforeEach(() => { width(false); vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} }); Element.prototype.scrollIntoView ??= () => {}; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the scope bar follows the page on screen", () => {
  it("keeps the old page's filters and projects until the new page's code has loaded, and Back and Forward do the same", async () => {
    serve();
    history.replaceState(null, "", "/cost?range=30");
    renderRouter();
    await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
    await userEvent.click(tab("Errors"));
    expect(location.pathname).toBe("/errors");
    // Cost is still on screen: its filters (the automated toggle, which Errors has not) and its projects.
    await new Promise(r => setTimeout(r, 20));
    expect(document.querySelector(".pg-cost")).toBeTruthy();
    expect(bar().queryByRole("checkbox", { name: "Include automated sessions" })).toBeTruthy();
    await userEvent.click(field());
    expect(options()).toEqual(["All projects", "foo", "bar"]);
    await userEvent.keyboard("{Escape}");
    await act(async () => { chunk.open(); await chunk.gate; });
    await screen.findByText(/tool errors/);
    expect(bar().queryByRole("checkbox", { name: "Include automated sessions" })).toBeNull();
    await userEvent.click(field());
    // Errors' own list, with its counts: none of Cost's names without them.
    await waitFor(() => expect(options().slice(1).every(o => / errors? \(all time\)$/.test(o!))).toBe(true));
    await userEvent.keyboard("{Escape}");
    await back();
    await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
    await waitFor(() => expect(bar().queryByRole("checkbox", { name: "Include automated sessions" })).toBeTruthy());
    await userEvent.click(field());
    expect(options()).toEqual(["All projects", "foo", "bar"]);
    await userEvent.keyboard("{Escape}");
    await forward();
    await screen.findByText(/tool errors/);
    await waitFor(() => expect(bar().queryByRole("checkbox", { name: "Include automated sessions" })).toBeNull());
  });
});

describe("Errors' saved view", () => {
  it("shows in the bar from its first frame while the payload loads, and a filter changed meanwhile keeps the rest of it", async () => {
    await act(async () => { chunk.open(); await chunk.gate; });
    const api = serve(), release = api.hold();
    localStorage.setItem(VIEW_KEY, JSON.stringify({ project: "foo", range: 7, source: "codex" }));
    history.replaceState(null, "", "/errors");
    // Every state the bar is drawn in, from the start.
    const drawn: string[] = [];
    const mo = new MutationObserver(() => {
      const f = field(), g = document.querySelector(".scopebar #fRange [aria-pressed=true]"), s = document.querySelector(".scopebar #fSource [aria-pressed=true]");
      if (f && g && s) drawn.push([f.value, g.textContent, s.textContent].join(" "));
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    renderRouter();
    await waitFor(() => expect(field()).toBeTruthy());
    expect(new Set(drawn)).toEqual(new Set(["foo 7d Codex"]));
    mo.disconnect();
    expect(location.search).toBe("?project=foo&range=7&source=codex");
    await userEvent.click(within(bar().getByRole("group", { name: "Source" })).getByRole("button", { name: "All" }));
    expect(location.search).toBe("?project=foo&range=7");
    await act(async () => { release(); });
    await screen.findByText(/tool errors/);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(VIEW_KEY)!)).toMatchObject({ project: "foo", range: 7, source: "" }));
    expect(field().value).toMatch(/^foo — /);
    expect(pressed("Time range")).toBe("7d");
  });

  it("opens the defaults when nothing is saved, and keeps an open sheet's key", async () => {
    serve();
    history.replaceState(null, "", "/errors?auto=1&session=s1");
    renderRouter();
    await screen.findByText(/tool errors/);
    expect(location.search).toBe("?range=30&auto=1&session=s1");
  });
});

describe("Errors' project picker", () => {
  it("names the project alone until the payload comes, and keeps what the user types when its counts arrive", async () => {
    const api = serve(), release = api.hold();
    history.replaceState(null, "", "/errors?project=foo&range=7");
    renderRouter();
    await waitFor(() => expect(field()).toBeTruthy());
    await screen.findByText("Loading errors…");
    expect(field().value).toBe("foo");
    await userEvent.click(field());
    await userEvent.keyboard("fo");
    expect(field().value).toBe("fo");
    await act(async () => { release(); });
    await screen.findByText(/tool errors/);
    expect(field().value).toBe("fo");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(field().value).toMatch(/^foo — \d+ errors? \(all time\)$/));
  });

  it("names the project alone when the payload fails", async () => {
    const api = serve();
    api.failErrors = true;
    history.replaceState(null, "", "/errors?project=nowhere&range=7");
    renderRouter();
    await screen.findByText("Could not load errors.");
    expect(field().value).toBe("nowhere");
  });
});

describe("a filter change that fails", () => {
  for (const narrow of [false, true]) {
    it(`keeps focus on the filter and says so in the page's alert (${narrow ? "390px, in the Filters popover" : "1440px"})`, async () => {
      width(narrow);
      const api = serve();
      api.fail = q => q.get("range") === "7";
      history.replaceState(null, "", "/cost?range=30");
      renderRouter();
      await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
      const user = userEvent.setup();
      if (narrow) await user.click(screen.getByRole("button", { name: "Filters" }));
      const scope = narrow ? within(await screen.findByRole("dialog", { name: "Filters" })) : bar();
      await user.click(scope.getByRole("button", { name: "7d" }));
      expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/^Could not load/));
      expect(document.activeElement).toBe(scope.getByRole("button", { name: "7d" }));
      if (narrow) expect(popover()).toBeTruthy();
      // The next change lands; focus stays on the control that made it.
      api.fail = null;
      await user.click(scope.getByRole("button", { name: "14d" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      await waitFor(() => expect(document.querySelector(".pg-cost.loading")).toBeNull());
      expect(document.activeElement).toBe(scope.getByRole("button", { name: "14d" }));
    });
  }
});

describe("narrow", () => {
  beforeEach(() => width(true));

  it("drops an unknown source from the URL with the Filters popover closed", async () => {
    serve();
    history.replaceState(null, "", "/cost?range=30&source=bad");
    renderRouter();
    await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
    expect(popover()).toBeNull();
    expect(location.search).toBe("?range=30");
  });

  it("closes the Filters popover on a page change, without giving focus back to the button: Back, Forward, a link and the palette", async () => {
    serve();
    history.replaceState(null, "", "/usage?range=30");
    renderRouter();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(tab("Cost"));
    await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
    const open = async () => { await userEvent.click(screen.getByRole("button", { name: /^Filters/ })); await screen.findByRole("dialog", { name: "Filters" }); };
    const closed = async () => {
      await waitFor(() => expect(popover()).toBeNull());
      expect(document.activeElement).not.toBe(screen.getByRole("button", { name: /^Filters/ }));
    };
    await open();
    await back();
    expect(location.pathname).toBe("/usage");
    await closed();
    await open();
    await forward();
    expect(location.pathname).toBe("/cost");
    await closed();
    await open();
    await act(async () => { navigate("/context?range=30"); }); // as the palette goes to a page
    await closed();
  });

  it("keeps the popover open for a change on the same page: a project picked, then cleared", async () => {
    serve();
    history.replaceState(null, "", "/cost?range=30");
    renderRouter();
    await screen.findByRole("heading", { level: 1, name: /estimated cost/ });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const pop = within(await screen.findByRole("dialog", { name: "Filters" }));
    await user.click(pop.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "bar" }));
    expect(location.search).toBe("?project=bar&range=30");
    expect(popover()).toBeTruthy();
    // The project and its Brief link show on the bar beside the button, at once.
    expect(document.querySelector(".scopebar-chip")!.textContent).toBe("bar");
    expect(bar().getByRole("link", { name: "Brief, bar project page" })).toBeTruthy();
    await user.click(pop.getByRole("button", { name: "Clear project filter" }));
    expect(location.search).toBe("?range=30");
    expect(popover()).toBeTruthy();
    expect(document.activeElement).toBe(pop.getByRole("combobox", { name: "Project" }));
    expect(document.querySelector(".scopebar-chip")).toBeNull();
  });
});
