import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import usage from "./__fixtures__/usage";
import { App } from "./App";
import { closePalette } from "./components/palette/store";
import { mockApi } from "./components/sheets/testing";
import { navigate, setHash } from "./hash";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const PAGES = [["/usage", "pg-activity"], ["/cost", "pg-cost"], ["/errors", "pg-errors"], ["/limits", "pg-limits"], ["/insights", "pg-insights"], ["/live", "pg-live"]] as const;
/** The app with every request left pending: each page shows its loading state. */
const pending = (path: string) => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  history.replaceState(null, "", path + "#range=30");
  return render(<App />);
};

/** The page's main, once its chunk has loaded: until then main is the empty fallback. */
const page = async (cls: string) => { await waitFor(() => expect(document.querySelector("main." + cls)).toBeTruthy()); return document.querySelector<HTMLElement>("main." + cls)!; };

describe("App", () => {
  // First in the file on purpose: a page module is imported once, so only its first render shows the Suspense fallback.
  it("loads each page as its own chunk behind an empty main, so the landmark never leaves", async () => {
    pending("/limits");
    const fallback = screen.getByRole("main");
    expect(fallback.id).toBe("content");
    expect(fallback.getAttribute("aria-busy")).toBe("true");
    expect(fallback.querySelector(".pg-limits")).toBeNull();
    await waitFor(() => expect(document.querySelector("main.pg-limits")).toBeTruthy());
    expect(screen.getAllByRole("main").length).toBe(1);
  });

  it("loads the palette on its first open, from the shortcut or the nav button, and not before", async () => {
    pending("/usage");
    await waitFor(() => expect(document.querySelector("main.pg-activity")).toBeTruthy());
    expect(document.querySelector("dialog.palette")).toBeNull();
    act(() => screen.getByRole("link", { name: "Skip to content" }).focus()); // the palette gives focus back here on closing
    act(() => { dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })); });
    await waitFor(() => expect(document.querySelector<HTMLDialogElement>("dialog.palette")?.open).toBe(true));
    act(() => closePalette()); // its open state outlives the render
    await waitFor(() => expect(document.querySelector<HTMLDialogElement>("dialog.palette")?.open).toBe(false));
  });

  it("renders the page as the one main landmark, #content, on every route", async () => {
    for (const [path, cls] of PAGES) {
      const { unmount } = pending(path);
      const main = await page(cls);
      expect(main.id, path).toBe("content");
      expect(screen.getAllByRole("main").length, path).toBe(1);
      unmount();
    }
  });

  it("starts with a skip link that moves focus to the page heading, without touching the URL", async () => {
    pending("/usage");
    await page("pg-activity");
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(document.querySelector("a, button, input")).toBe(skip);
    expect(skip.getAttribute("href")).toBe("#content");
    await userEvent.tab();
    expect(document.activeElement).toBe(skip);
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(document.getElementById("lede"));
    expect(location.hash).toBe("#range=30");
  });

  it("does not announce loading: no status region, no live heading, and aria-busy on the page", async () => {
    for (const [path, cls] of PAGES.filter(([p]) => p !== "/live")) { // Live's status is its connection
      const { unmount } = pending(path);
      const main = await page(cls);
      expect(main.querySelector("#lede, #load")?.textContent, path).toMatch(/^Loading/);
      expect(within(main).queryAllByRole("status").filter(e => e.textContent), path).toEqual([]); // an empty one (a toggletip's) says nothing
      expect([...main.querySelectorAll("[aria-live]")].filter(e => e.textContent), path).toEqual([]); // an empty announcer is fine
      expect(main.getAttribute("aria-busy") === "true" || main.querySelector("#load")?.getAttribute("aria-busy") === "true", path).toBe(true);
      unmount();
    }
  });

  describe("focus", () => {
    const show = (path: string) => {
      mockApi({ "/api/usage": () => usage, "/api/status": () => status });
      history.replaceState(null, "", path);
      return render(<App />);
    };

    it("moves to the new page's heading after a page switch, and waits for a page that is still loading", async () => {
      show("/usage#range=30");
      await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
      expect(document.activeElement).toBe(document.body); // the first load leaves focus alone
      await userEvent.click(screen.getByRole("link", { name: "Cost" }));
      await waitFor(() => expect(document.querySelector("main.pg-cost")).toBeTruthy());
      await waitFor(() => expect(document.activeElement?.id).toBe("lede"));
      expect(document.activeElement!.closest(".pg-cost")).toBeTruthy();
      act(() => navigate("/limits#range=30"));
      await waitFor(() => expect(document.activeElement!.closest(".pg-limits")).toBeTruthy());
      expect(document.activeElement!.id).toBe("lede");
    });

    it("leaves focus where it is on a hash-only change", async () => {
      show("/usage#range=30");
      await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
      const tab = screen.getByRole("link", { name: "Cost" });
      act(() => tab.focus());
      act(() => setHash({ range: "7" }));
      await new Promise(r => setTimeout(r, 20));
      expect(document.activeElement).toBe(tab);
    });
  });
});
