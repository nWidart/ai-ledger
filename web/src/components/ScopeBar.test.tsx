import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, renderRouter } from "../testing";
import { ScopeBar, scopeOf, useScopeProjects } from "./ScopeBar";
import context from "../__fixtures__/context";
import errors from "../__fixtures__/errors";
import insights from "../__fixtures__/insights";
import limits from "../__fixtures__/limits";
import usage from "../__fixtures__/usage";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const serve = () => {
  const bodies: Record<string, unknown> = { "/api/status": status, "/api/errors": errors, "/api/context": context, "/api/insights": insights, "/api/limits": limits };
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(bodies[new URL(url, "http://x").pathname] ?? usage) } as Response)));
};
/** jsdom applies no media query: this one says the window is narrow. */
const narrow = () => vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 56em"), media: q, addEventListener() {}, removeEventListener() {} }));
const brief = () => screen.queryByRole("link", { name: /^Brief, / });

afterEach(() => { vi.unstubAllGlobals(); document.documentElement.style.removeProperty("--scope-h"); });

describe("scopeOf", () => {
  it("shows each page the filters that change it", () => {
    const all = { project: true, range: true, source: true, automated: true };
    expect(scopeOf("/usage", false)).toEqual(all);
    expect(scopeOf("/cost", false)).toEqual(all);
    expect(scopeOf("/context", false)).toEqual(all);
    expect(scopeOf("/project", false)).toEqual(all);
    expect(scopeOf("/usage", true)).toEqual({ ...all, source: false });
    expect(scopeOf("/errors", false)).toEqual({ ...all, automated: false });
    expect(scopeOf("/live", false)).toEqual({ ...all, range: false });
    expect(scopeOf("/limits", false)).toEqual({ project: false, range: false, source: true, automated: false });
  });
});

describe("ScopeBar", () => {
  it("lists the projects the page hands it, and none once the page is gone", async () => {
    history.replaceState(null, "", "/cost?range=30");
    function Page() { useScopeProjects(["foo", "bar"]); return null; }
    const { rerender } = renderApp(<><ScopeBar /><Page /></>);
    await userEvent.click(screen.getByRole("combobox", { name: "Project" }));
    expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["All projects", "foo", "bar"]);
    await userEvent.keyboard("{Escape}");
    rerender(<ScopeBar />);
    await userEvent.click(screen.getByRole("combobox", { name: "Project" }));
    expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["All projects"]);
  });

  it("shows Brief with a project picked, takes it away when the project is cleared, and shows none on the Project page", async () => {
    history.replaceState(null, "", "/errors?range=7");
    renderApp(<ScopeBar />);
    expect(brief()).toBeNull();
    await act(async () => { history.pushState(null, "", "/errors?project=foo&range=7"); dispatchEvent(new PopStateEvent("popstate")); });
    await waitFor(() => expect(brief()).toBeTruthy());
    expect(brief()!.getAttribute("href")).toBe("/project?project=foo&range=7");
    await userEvent.click(screen.getByRole("button", { name: "Clear project filter" }));
    expect(brief()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Project" }));
    await act(async () => { history.pushState(null, "", "/project?project=foo&range=7"); dispatchEvent(new PopStateEvent("popstate")); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Clear project filter" })).toBeTruthy());
    expect(brief()).toBeNull();
  });

  it("shows no Brief on Limits, which has no project filter", () => {
    history.replaceState(null, "", "/limits?project=foo");
    renderApp(<ScopeBar />);
    expect(brief()).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
  });

  it("keeps the URL keys and the focus on the control a change came from", async () => {
    history.replaceState(null, "", "/cost?project=foo&range=30&session=s1");
    renderApp(<ScopeBar />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "7d" }));
    expect(location.search).toBe("?project=foo&range=7&session=s1");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "7d" }));
    await user.click(screen.getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?project=foo&range=7&source=codex"); // a new source closes the open sheet
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Codex" }));
    await user.click(screen.getByRole("checkbox", { name: "Include automated sessions" }));
    expect(location.search).toBe("?project=foo&range=7&source=codex&auto=1");
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Include automated sessions" }));
  });

  it("keeps its height in --scope-h while it shows", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(52);
    history.replaceState(null, "", "/cost");
    const { unmount } = renderApp(<ScopeBar />);
    expect(document.documentElement.style.getPropertyValue("--scope-h")).toBe("52px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--scope-h")).toBe("0px");
    vi.restoreAllMocks();
  });

  describe("narrow", () => {
    it("is one Filters button, named with how many filters are off their default", async () => {
      narrow();
      history.replaceState(null, "", "/cost?range=30");
      renderApp(<ScopeBar />);
      expect(screen.queryByRole("group", { name: "Filters" })).toBeNull();
      const button = screen.getByRole("button", { name: "Filters" });
      expect(button.querySelector(".scopebar-count")).toBeNull();
      await act(async () => { history.pushState(null, "", "/cost?project=foo&range=7&auto=1"); dispatchEvent(new PopStateEvent("popstate")); });
      await waitFor(() => expect(screen.getByRole("button", { name: "Filters, 3 filters set" })).toBeTruthy());
      expect(button.querySelector(".scopebar-count")!.textContent).toBe("3");
      // The project stays in sight with its Brief link, beside the button.
      expect(document.querySelector(".scopebar-chip")!.textContent).toBe("foo");
      expect(brief()).toBeTruthy();
    });

    it("counts only the filters the page shows", () => {
      narrow();
      history.replaceState(null, "", "/limits?project=foo&range=7&source=codex");
      renderApp(<ScopeBar />);
      expect(screen.getByRole("button", { name: "Filters, 1 filter set" })).toBeTruthy();
      expect(document.querySelector(".scopebar-chip")).toBeNull();
    });

    it("opens the filters over the page, keeps them open and the focus on a control that changes, and gives focus back on Escape", async () => {
      narrow();
      history.replaceState(null, "", "/usage?project=foo&range=30");
      renderApp(<ScopeBar />);
      const user = userEvent.setup();
      const button = screen.getByRole("button", { name: "Filters, 1 filter set" });
      await user.click(button);
      const pop = await screen.findByRole("dialog", { name: "Filters" });
      expect(within(pop).getByRole("combobox", { name: "Project" })).toBeTruthy();
      expect(within(pop).queryByRole("link", { name: /^Brief/ })).toBeNull(); // Brief is on the bar
      await user.click(within(pop).getByRole("button", { name: "7d" }));
      expect(location.search).toBe("?project=foo&range=7");
      expect(document.activeElement).toBe(within(pop).getByRole("button", { name: "7d" }));
      expect(screen.getByRole("button", { name: "Filters, 2 filters set" })).toBe(button);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull());
      expect(document.activeElement).toBe(button);
    });
  });
});

describe("the app shell's scope bar", () => {
  it("comes after the nav and before the page in the tab order, the same on every page", async () => {
    serve();
    for (const [path, first] of [["/cost?project=foo&range=30", "Project"], ["/limits?range=30", "All"], ["/usage?project=foo&view=judgments", "Project"]] as const) {
      history.replaceState(null, "", path);
      const { unmount } = renderRouter();
      await screen.findByRole("heading", { level: 1 });
      const bar = document.querySelector(".scopebar")!, nav = document.querySelector("nav.appnav")!, main = document.querySelector("main")!;
      // Document order is tab order here: nothing sets a positive tabindex.
      expect(nav.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(bar.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      document.getElementById("navTheme")!.focus();
      await userEvent.tab();
      expect(bar.contains(document.activeElement)).toBe(true);
      expect(document.activeElement!.getAttribute("aria-label") ?? document.activeElement!.textContent).toBe(first);
      unmount();
    }
  });

  it("puts Brief last in the bar, after the automated toggle", async () => {
    serve();
    history.replaceState(null, "", "/cost?project=foo&range=30");
    renderRouter();
    await screen.findByRole("heading", { level: 1 });
    const stops = [...document.querySelectorAll<HTMLElement>(".scopebar :is(input, button, a)")].map(e => e.id || e.getAttribute("aria-label") || e.textContent);
    expect(stops.indexOf("fProject")).toBe(0);
    expect(stops.indexOf("7d")).toBeGreaterThan(stops.indexOf("Clear project filter"));
    expect(stops.indexOf("Codex")).toBeGreaterThan(stops.indexOf("All"));
    expect(stops.indexOf("fAuto")).toBeGreaterThan(stops.indexOf("Codex"));
    expect(stops.at(-1)).toBe("Brief, foo project page");
  });
});
