import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import limits from "./__fixtures__/limits";
import session from "./__fixtures__/session";
import usage from "./__fixtures__/usage";
import { closePalette } from "./components/palette/store";
import { mockApi } from "./components/sheets/testing";
import { navigate, setSearch } from "./url";
import { renderRouter } from "./testing";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
// /insights is Activity's Judgments view under its old address: the app redirects it there.
const PAGES = [["/usage", "pg-activity"], ["/cost", "pg-cost"], ["/errors", "pg-errors"], ["/limits", "pg-limits"], ["/insights", "pg-judgments"], ["/live", "pg-live"]] as const;
/** The app with every request left pending: each page shows its loading state. */
const pending = (path: string) => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  history.replaceState(null, "", path + "?range=30");
  return renderRouter();
};

/** The page's main, once its chunk has loaded: until then main is the empty fallback. */
const page = async (cls: string) => { await waitFor(() => expect(document.querySelector("main." + cls)).toBeTruthy()); return document.querySelector<HTMLElement>("main." + cls)!; };

describe("App", () => {
  // First in the file on purpose: a page module is imported once, so only its first render shows the Suspense fallback.
  it("loads each page as its own chunk behind an empty main, so the landmark never leaves", async () => {
    pending("/limits");
    const fallback = await screen.findByRole("main");
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
    expect(location.search).toBe("?range=30");
  });

  it("does not announce loading: no status region, no live heading, and aria-busy on the page", async () => {
    for (const [path, cls] of PAGES.filter(([p]) => p !== "/live")) { // Live's status is its connection
      const { unmount } = pending(path);
      const main = await page(cls);
      expect(main.querySelector("#lede, #load")?.textContent, path).toMatch(/^Loading/);
      expect(within(main).queryAllByRole("status").filter(e => e.textContent), path).toEqual([]); // an empty one says nothing
      expect([...main.querySelectorAll("[aria-live]")].filter(e => e.textContent), path).toEqual([]); // an empty announcer is fine
      expect(main.getAttribute("aria-busy") === "true" || main.querySelector("#load")?.getAttribute("aria-busy") === "true", path).toBe(true);
      unmount();
    }
  });

  describe("one sheet host", () => {
    it("mounts the sheets once, in the shell and outside the page, on every route", async () => {
      for (const [path, cls] of PAGES) {
        const { unmount } = pending(path);
        const main = await page(cls);
        const sheets = document.querySelectorAll("dialog.sheet");
        expect(sheets.length, path).toBe(1);
        expect(main.contains(sheets[0]!), path).toBe(false);
        unmount();
      }
    });

    it("opens the sheet the URL names over any page, under the page's key", async () => {
      for (const [path, key] of [["/limits", "session"], ["/cost", "session"], ["/live", "sheet"]] as const) {
        mockApi({ "/api/session": () => session, "/api/status": () => status });
        history.replaceState(null, "", `${path}?range=30&${key}=s1`);
        const { unmount } = renderRouter();
        await waitFor(() => expect(document.querySelector<HTMLDialogElement>("dialog.sheet")?.open, path).toBe(true));
        expect(await within(document.querySelector<HTMLElement>("dialog.sheet")!).findByText("Timeline"), path).toBeTruthy();
        expect(location.pathname, path).toBe(path);
        unmount();
      }
    });
  });

  describe("focus", () => {
    // Limits answers here: a failed load focuses its Retry button, which raced the heading and made this flaky.
    const show = (path: string) => {
      mockApi({ "/api/usage": () => usage, "/api/limits": () => limits, "/api/status": () => status });
      history.replaceState(null, "", path);
      return renderRouter();
    };

    it("moves to the new page's heading after a page switch, and waits for a page that is still loading", async () => {
      show("/usage?range=30");
      await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
      expect(document.activeElement).toBe(document.body); // the first load leaves focus alone
      await userEvent.click(screen.getByRole("link", { name: "Cost" }));
      await waitFor(() => expect(document.querySelector("main.pg-cost")).toBeTruthy());
      await waitFor(() => expect(document.activeElement?.id).toBe("lede"));
      expect(document.activeElement!.closest(".pg-cost")).toBeTruthy();
      act(() => navigate("/limits?range=30"));
      await waitFor(() => expect(document.activeElement!.closest(".pg-limits")).toBeTruthy());
      expect(document.activeElement!.id).toBe("lede");
    });

    it("leaves focus where it is on a hash-only change", async () => {
      show("/usage?range=30");
      await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
      const tab = screen.getByRole("link", { name: "Cost" });
      act(() => tab.focus());
      act(() => setSearch({ range: "7" }));
      await new Promise(r => setTimeout(r, 20));
      expect(document.activeElement).toBe(tab);
    });
  });

  describe("automated projects file", () => {
    const path = "/Users/me/Library/Application Support/ai-ledger/automated.json";
    const withFile = (error: string | null) => {
      // Every page's data stays pending: the warning and the hint come from the status poll alone.
      vi.stubGlobal("fetch", vi.fn((u: string) => new URL(u, "http://x").pathname === "/api/status"
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...status, automated_file: { path, error, projects: [] } }) } as Response)
        : new Promise<Response>(() => {})));
    };

    it("warns once above every page when the file was ignored, and keeps the warning across a page switch", async () => {
      withFile("Expecting value: line 1 column 1 (char 0)");
      history.replaceState(null, "", "/cost?range=30");
      renderRouter();
      await page("pg-cost");
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(path);
      expect(alert.textContent).toContain("Expecting value: line 1 column 1 (char 0)");
      expect(alert.textContent).toMatch(/ignored until it is fixed; only the built-in detection applies/);
      expect(alert.closest("section")!.getAttribute("aria-label")).toBe("Automated projects file");
      for (const [to, cls] of [["/limits", "pg-limits"], ["/errors", "pg-errors"], ["/usage", "pg-activity"]] as const) {
        act(() => navigate(to + "?range=30"));
        await page(cls);
        expect(screen.getAllByRole("alert").filter(a => a.textContent?.includes(path))).toHaveLength(1);
        // The same node, never remounted: a new alert would be read out again on every page.
        expect(screen.getByRole("alert")).toBe(alert);
        expect(alert.isConnected).toBe(true);
        expect(document.querySelector("main")!.contains(alert)).toBe(false); // the app's, not the page's
      }
    });

    it("shows no warning for a file that is fine, and names its path on the automated toggle", async () => {
      withFile(null);
      history.replaceState(null, "", "/live");
      renderRouter();
      await page("pg-live"); // its header shows before its data
      const tip = await screen.findByRole("button", { name: "About automated sessions" });
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]).includes("/api/status"))).toBe(true));
      await userEvent.click(tip);
      await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain(path));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
